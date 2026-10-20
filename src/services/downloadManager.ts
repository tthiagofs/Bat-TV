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
  saveMediaBlob,
  getMediaBlob,
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
  private webAbortControllers: Map<string, AbortController> = new Map()
  private activeBlobUrls: Map<string, string> = new Map()

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

    // Plataforma 3: Web Browser (Safari iOS / Chrome / PWA / Vercel)
    try {
      await upsertDownload({ ...item, status: 'downloading', progress: 0, downloadedBytes: 0 })
      this.notify()

      const abortController = new AbortController()
      this.webAbortControllers.set(item.id, abortController)
      const signal = abortController.signal

      // Se for Web / iOS, sempre prefere container MP4 (Xtream faz remux automático e Safari suporta 100%)
      const targetUrl = item.remoteUrl.replace(/\.mkv$/i, '.mp4')
      const proxyEndpoint = import.meta.env.DEV ? '/iptv-proxy' : '/api/proxy'
      const proxyUrl = `${proxyEndpoint}?url=${encodeURIComponent(targetUrl)}`

      // 1. Tenta descobrir o tamanho total do arquivo
      let totalBytes = item.totalBytes || 0
      let supportsRange = false

      try {
        const probeRes = await fetch(proxyUrl, {
          method: 'GET',
          headers: { Range: 'bytes=0-1023' },
          signal,
        })

        if (probeRes.status === 206) {
          supportsRange = true
          const contentRange = probeRes.headers.get('content-range')
          if (contentRange) {
            const match = contentRange.match(/\/(\d+)$/)
            if (match && match[1]) {
              totalBytes = parseInt(match[1], 10)
            }
          }
        } else if (probeRes.ok) {
          const cl = probeRes.headers.get('content-length')
          if (cl) totalBytes = parseInt(cl, 10)
        }
      } catch (e: any) {
        if (e.name === 'AbortError') throw e
      }

      const chunks: BlobPart[] = []
      let receivedBytes = 0

      // Se o servidor suporta Range e temos o tamanho total, baixa em fatias seguras de 4MB
      // Isso evita timeout no Vercel Serverless Function e permite download resiliente
      const CHUNK_SIZE = 4 * 1024 * 1024 // 4 MB

      if (supportsRange && totalBytes > 0) {
        let start = 0
        while (start < totalBytes) {
          if (signal.aborted) throw new DOMException('Aborted', 'AbortError')

          const end = Math.min(start + CHUNK_SIZE - 1, totalBytes - 1)
          let chunkSuccess = false
          let lastErr: any = null

          for (let attempt = 0; attempt < 3; attempt++) {
            if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
            try {
              const chunkRes = await fetch(proxyUrl, {
                headers: { Range: `bytes=${start}-${end}` },
                signal,
              })

              if (!chunkRes.ok && chunkRes.status !== 206) {
                throw new Error(`HTTP ${chunkRes.status} na fatia ${start}-${end}`)
              }

              const buffer = await chunkRes.arrayBuffer()
              chunks.push(buffer)
              receivedBytes += buffer.byteLength
              chunkSuccess = true
              break
            } catch (err: any) {
              if (err.name === 'AbortError') throw err
              lastErr = err
              await new Promise((r) => setTimeout(r, 800))
            }
          }

          if (!chunkSuccess) {
            throw lastErr || new Error(`Falha ao descarregar bloco ${start}-${end}`)
          }

          start = end + 1
          const percent = Math.min(99, Math.round((receivedBytes / totalBytes) * 100))
          await updateDownloadProgress(item.id, percent, receivedBytes, totalBytes)
          this.notify()
        }
      } else {
        // Fallback: Streaming contínuo via ReadableStream caso o servidor não suporte Range
        const streamRes = await fetch(proxyUrl, { signal })
        if (!streamRes.ok) {
          throw new Error(`Erro na conexão com servidor: HTTP ${streamRes.status}`)
        }

        const cl = streamRes.headers.get('content-length')
        if (cl && !totalBytes) totalBytes = parseInt(cl, 10)

        if (!streamRes.body) {
          throw new Error('Navegador não forneceu stream de download')
        }

        const reader = streamRes.body.getReader()
        let lastNotify = Date.now()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (value) {
            chunks.push(value)
            receivedBytes += value.length

            const now = Date.now()
            if (now - lastNotify > 300) {
              lastNotify = now
              const percent = totalBytes > 0 ? Math.min(99, Math.round((receivedBytes / totalBytes) * 100)) : 0
              await updateDownloadProgress(item.id, percent, receivedBytes, totalBytes)
              this.notify()
            }
          }
        }
      }

      // Cria Blob com formato MP4 compatível com Safari iOS e Chrome
      const blob = new Blob(chunks, { type: 'video/mp4' })
      const finalSize = blob.size || receivedBytes

      // Grava no IndexedDB local do dispositivo
      await saveMediaBlob(item.id, blob)

      const localPath = `indexeddb://${item.id}`
      const playUrl = `blob-store://${item.id}`

      await markDownloadCompleted(item.id, localPath, playUrl, finalSize)
      this.webAbortControllers.delete(item.id)
      this.isProcessing = false
      this.notify()
      this.processQueue()
    } catch (err: any) {
      this.webAbortControllers.delete(item.id)
      if (err.name === 'AbortError') {
        console.log('Download cancelado:', item.id)
      } else {
        console.error('Erro no download web:', err)
        await markDownloadError(item.id, err?.message || 'Falha ao baixar mídia')
      }
      this.isProcessing = false
      this.notify()
      this.processQueue()
    }
  }

  public async cancelDownload(id: string): Promise<void> {
    const controller = this.webAbortControllers.get(id)
    if (controller) {
      try {
        controller.abort()
      } catch {}
      this.webAbortControllers.delete(id)
    }
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
    const controller = this.webAbortControllers.get(id)
    if (controller) {
      try {
        controller.abort()
      } catch {}
      this.webAbortControllers.delete(id)
    }

    const cachedBlobUrl = this.activeBlobUrls.get(id)
    if (cachedBlobUrl) {
      URL.revokeObjectURL(cachedBlobUrl)
      this.activeBlobUrls.delete(id)
    }

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

  public async getPlayableUrl(item: DownloadedMedia): Promise<string> {
    // 1. Se for mídia salva no IndexedDB (Web / PWA)
    if (item.playUrl?.startsWith('blob-store://') || item.localPath?.startsWith('indexeddb://')) {
      if (this.activeBlobUrls.has(item.id)) {
        return this.activeBlobUrls.get(item.id)!
      }
      const blob = await getMediaBlob(item.id)
      if (blob) {
        const blobUrl = URL.createObjectURL(blob)
        this.activeBlobUrls.set(item.id, blobUrl)
        return blobUrl
      }
    }

    // 2. Se for arquivo nativo no Capacitor ou Electron
    if (item.playUrl && !item.playUrl.startsWith('blob-store://') && item.playUrl !== 'local-storage://simulated') {
      return item.playUrl
    }

    // 3. Fallback para URL remota se houver internet
    return item.remoteUrl
  }
}

export const downloadManager = new DownloadManager()
