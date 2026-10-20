import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import {
  getAllDownloads,
  getDownload,
  upsertDownload,
  updateDownloadProgress,
  markDownloadCompleted,
  markDownloadError,
  deleteDownloadRecord,
  type DownloadedMedia,
} from './downloadDb'

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean
      startDownload: (item: { id: string; url: string; filename: string }) => Promise<{ success: boolean; localPath: string; playUrl: string }>
      pauseDownload: (id: string) => Promise<{ success: boolean }>
      resumeDownload: (id: string) => Promise<{ success: boolean }>
      cancelDownload: (id: string) => Promise<{ success: boolean }>
      deleteDownload: (item: { id: string; localPath?: string; filename?: string }) => Promise<{ success: boolean }>
      getDiskSpace: () => Promise<{ freeBytes: number; totalBytes: number }>
      onDownloadProgress: (callback: (data: { id: string; receivedBytes: number; totalBytes: number; percent: number }) => void) => () => void
      onDownloadCompleted: (callback: (data: { id: string; localPath: string; playUrl: string; totalBytes: number }) => void) => () => void
      onDownloadError: (callback: (data: { id: string; error: string }) => void) => () => void
    }
  }
}

export interface StorageInfo {
  freeBytes: number
  totalBytes: number
  usedByAppBytes: number
}

type DownloadListener = (items: DownloadedMedia[]) => void

class DownloadManager {
  private isProcessing = false
  private listeners: Set<DownloadListener> = new Set()
  private cleanupElectronListeners: (() => void)[] = []

  constructor() {
    this.setupListeners()
    // Retoma fila ao iniciar
    setTimeout(() => this.processQueue(), 2000)
  }

  private setupListeners() {
    if (typeof window !== 'undefined' && window.electronAPI) {
      const unsubProgress = window.electronAPI.onDownloadProgress((data) => {
        updateDownloadProgress(data.id, data.percent, data.receivedBytes, data.totalBytes).then(() => {
          this.notify()
        })
      })
      const unsubCompleted = window.electronAPI.onDownloadCompleted((data) => {
        markDownloadCompleted(data.id, data.localPath, data.playUrl, data.totalBytes).then(() => {
          this.isProcessing = false
          this.notify()
          this.processQueue()
        })
      })
      const unsubError = window.electronAPI.onDownloadError((data) => {
        markDownloadError(data.id, data.error).then(() => {
          this.isProcessing = false
          this.notify()
          this.processQueue()
        })
      })
      this.cleanupElectronListeners = [unsubProgress, unsubCompleted, unsubError]
    }
  }

  public subscribe(listener: DownloadListener): () => void {
    this.listeners.add(listener)
    this.getDownloads().then((items) => listener(items))
    return () => {
      this.listeners.delete(listener)
    }
  }

  private async notify() {
    const items = await this.getDownloads()
    this.listeners.forEach((l) => l(items))
  }

  public async getDownloads(): Promise<DownloadedMedia[]> {
    return getAllDownloads()
  }

  public async getStorageInfo(): Promise<StorageInfo> {
    let freeBytes = 10 * 1024 * 1024 * 1024
    let totalBytes = 32 * 1024 * 1024 * 1024

    if (window.electronAPI?.getDiskSpace) {
      try {
        const space = await window.electronAPI.getDiskSpace()
        freeBytes = space.freeBytes
        totalBytes = space.totalBytes
      } catch {}
    } else if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate()
        if (estimate.quota && estimate.usage) {
          totalBytes = estimate.quota
          freeBytes = estimate.quota - estimate.usage
        }
      } catch {}
    }

    const all = await this.getDownloads()
    const usedByAppBytes = all.reduce((sum, item) => sum + (item.downloadedBytes || item.totalBytes || 0), 0)

    return { freeBytes, totalBytes, usedByAppBytes }
  }

  /** Converte imagem de capa para base64 para que funcione 100% offline */
  private async cachePoster(url: string): Promise<string> {
    if (!url || url.startsWith('data:')) return url
    try {
      const res = await fetch(url, { mode: 'cors' })
      if (!res.ok) return url
      const blob = await res.blob()
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve((reader.result as string) || url)
        reader.onerror = () => resolve(url)
        reader.readAsDataURL(blob)
      })
    } catch {
      return url
    }
  }

  public async requestDownload(item: {
    id: string
    mediaType: 'movie' | 'series'
    title: string
    subtitle?: string
    seriesName?: string
    seasonNumber?: number
    episodeNumber?: number
    posterUrl: string
    remoteUrl: string
    duration?: number
  }): Promise<{ success: boolean; error?: string }> {
    // 1. Checagem de segurança de espaço: mínimo de 1.5 GB livre
    const space = await this.getStorageInfo()
    const MIN_REQUIRED_BYTES = 1.5 * 1024 * 1024 * 1024
    if (space.freeBytes < MIN_REQUIRED_BYTES) {
      return {
        success: false,
        error: 'Espaço em disco insuficiente. Seu aparelho precisa de pelo menos 1.5 GB livres para baixar com segurança.',
      }
    }

    // 2. Verifica se já está baixado ou na fila
    const existing = await getDownload(item.id)
    if (existing && (existing.status === 'completed' || existing.status === 'downloading' || existing.status === 'queued')) {
      return { success: true }
    }

    // 3. Salva a imagem da capa em base64 para uso offline
    const cachedPoster = await this.cachePoster(item.posterUrl)

    // 4. Cria registro no IndexedDB com status 'queued'
    const newRecord: DownloadedMedia = {
      id: item.id,
      mediaType: item.mediaType,
      title: item.title,
      subtitle: item.subtitle,
      seriesName: item.seriesName,
      seasonNumber: item.seasonNumber,
      episodeNumber: item.episodeNumber,
      posterUrl: cachedPoster,
      remoteUrl: item.remoteUrl,
      status: 'queued',
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      duration: item.duration || 0,
      createdAt: Date.now(),
    }

    await upsertDownload(newRecord)
    this.notify()

    // 5. Aciona o processador de fila
    this.processQueue()
    return { success: true }
  }

  private async processQueue() {
    if (this.isProcessing) return
    const list = await getAllDownloads()
    const queued = list.find((i) => i.status === 'queued')
    if (!queued) return

    this.isProcessing = true
    await this.startItemDownload(queued)
  }

  private async startItemDownload(item: DownloadedMedia) {
    const filename = `${item.id}.mp4`

    // Plataforma 1: Electron (PC Desktop)
    if (window.electronAPI?.startDownload) {
      try {
        await upsertDownload({ ...item, status: 'downloading' })
        this.notify()
        await window.electronAPI.startDownload({
          id: item.id,
          url: item.remoteUrl,
          filename,
        })
      } catch (err: any) {
        await markDownloadError(item.id, err?.message || 'Falha ao baixar vídeo')
        this.isProcessing = false
        this.notify()
        this.processQueue()
      }
      return
    }

    // Plataforma 2: Android / Fire TV Stick (Capacitor Nativo)
    if (Capacitor.isNativePlatform()) {
      try {
        await upsertDownload({ ...item, status: 'downloading' })
        this.notify()

        // Garante que o diretório downloads exista
        try {
          await Filesystem.mkdir({ path: 'downloads', directory: Directory.Data, recursive: true })
        } catch {}

        const targetPath = `downloads/${filename}`

        let progressListener: any = null
        if (Filesystem.addListener) {
          progressListener = await Filesystem.addListener('progress', (status: any) => {
            if (status.url === item.remoteUrl) {
              const percent = status.contentLength > 0 ? Math.round((status.bytes / status.contentLength) * 100) : 0
              updateDownloadProgress(item.id, percent, status.bytes, status.contentLength)
              this.notify()
            }
          })
        }

        await Filesystem.downloadFile({
          url: item.remoteUrl,
          path: targetPath,
          directory: Directory.Data,
          progress: true,
        })

        if (progressListener) {
          progressListener.remove()
        }

        const uriResult = await Filesystem.getUri({
          path: targetPath,
          directory: Directory.Data,
        })

        const playUrl = Capacitor.convertFileSrc(uriResult.uri)
        const statResult = await Filesystem.stat({
          path: targetPath,
          directory: Directory.Data,
        }).catch(() => ({ size: 0 }))

        await markDownloadCompleted(item.id, targetPath, playUrl, statResult.size)
        this.isProcessing = false
        this.notify()
        this.processQueue()
      } catch (err: any) {
        console.error('Erro no download Capacitor:', err)
        await markDownloadError(item.id, err?.message || 'Erro ao gravar arquivo no Android')
        this.isProcessing = false
        this.notify()
        this.processQueue()
      }
      return
    }

    // Plataforma 3: Web Browser simulado (Dev environment)
    try {
      await upsertDownload({ ...item, status: 'downloading' })
      this.notify()
      let simulatedPercent = 0
      const timer = setInterval(async () => {
        simulatedPercent += 15
        if (simulatedPercent >= 100) {
          clearInterval(timer)
          await markDownloadCompleted(item.id, 'local-storage://simulated', item.remoteUrl, 1024 * 1024 * 250)
          this.isProcessing = false
          this.notify()
          this.processQueue()
        } else {
          await updateDownloadProgress(item.id, simulatedPercent, simulatedPercent * 2.5 * 1024 * 1024, 250 * 1024 * 1024)
          this.notify()
        }
      }, 500)
    } catch (err: any) {
      await markDownloadError(item.id, err?.message || 'Erro')
      this.isProcessing = false
      this.notify()
      this.processQueue()
    }
  }

  public async cancelDownload(id: string): Promise<void> {
    if (window.electronAPI?.cancelDownload) {
      await window.electronAPI.cancelDownload(id)
    }
    const item = await getDownload(id)
    if (item && item.status !== 'completed') {
      await deleteDownloadRecord(id)
      this.isProcessing = false
      this.notify()
      this.processQueue()
    }
  }

  public async deleteDownload(id: string): Promise<void> {
    const item = await getDownload(id)
    if (!item) return

    const filename = `${id}.mp4`

    if (window.electronAPI?.deleteDownload) {
      await window.electronAPI.deleteDownload({ id, localPath: item.localPath, filename })
    } else if (Capacitor.isNativePlatform()) {
      try {
        await Filesystem.deleteFile({
          path: item.localPath || `downloads/${filename}`,
          directory: Directory.Data,
        })
      } catch {}
    }

    await deleteDownloadRecord(id)
    this.notify()
  }
}

export const downloadManager = new DownloadManager()
