import { useState, useEffect, useCallback } from 'react'
import { downloadManager, type StorageInfo } from '../services/downloadManager'
import type { DownloadedMedia } from '../services/downloadDb'

export function useDownloads() {
  const [downloads, setDownloads] = useState<DownloadedMedia[]>([])
  const [storage, setStorage] = useState<StorageInfo>({
    freeBytes: 0,
    totalBytes: 0,
    usedByAppBytes: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = downloadManager.subscribe((items) => {
      setDownloads(items)
      setLoading(false)
      downloadManager.getStorageInfo().then(setStorage)
    })
    return () => unsub()
  }, [])

  const getStatus = useCallback(
    (mediaId: string): DownloadedMedia | undefined => {
      return downloads.find((d) => d.id === mediaId)
    },
    [downloads]
  )

  const isDownloaded = useCallback(
    (mediaId: string): boolean => {
      return downloads.some((d) => d.id === mediaId && d.status === 'completed')
    },
    [downloads]
  )

  const isDownloading = useCallback(
    (mediaId: string): boolean => {
      return downloads.some(
        (d) => d.id === mediaId && (d.status === 'downloading' || d.status === 'queued')
      )
    },
    [downloads]
  )

  const startDownload = useCallback(
    async (item: {
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
    }) => {
      return downloadManager.requestDownload(item)
    },
    []
  )

  const cancel = useCallback(async (id: string) => {
    return downloadManager.cancelDownload(id)
  }, [])

  const remove = useCallback(async (id: string) => {
    return downloadManager.deleteDownload(id)
  }, [])

  return {
    downloads,
    storage,
    loading,
    getStatus,
    isDownloaded,
    isDownloading,
    startDownload,
    cancel,
    remove,
  }
}
