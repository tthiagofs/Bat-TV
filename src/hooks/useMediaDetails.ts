import { useCallback, useState } from 'react'
import { searchTmdbItem, type TmdbItem } from '../services/tmdbService'
import type { MediaItem } from '../types'

/** Abre o modal "Mais Informações" para qualquer item do catálogo IPTV (busca o título no TMDB). */
export function useMediaDetails() {
  const [detailItem, setDetailItem] = useState<TmdbItem | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const openDetails = useCallback(async (item: MediaItem) => {
    const isTv = item.type === 'series'
    const fallback: TmdbItem = {
      id: item.id,
      title: item.name,
      overview: '',
      backdropPath: item.image,
      posterPath: item.image,
      voteAverage: parseFloat(item.rating || '7.5') || 7.5,
      releaseDate: '',
      mediaType: isTv ? 'tv' : 'movie',
      mediaItem: item,
    }
    setLoadingDetail(true)
    try {
      const found = await searchTmdbItem(item.name, isTv ? 'tv' : 'movie')
      if (found) {
        found.mediaItem = item
        setDetailItem(found)
      } else {
        setDetailItem(fallback)
      }
    } catch {
      setDetailItem(fallback)
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  const closeDetails = useCallback(() => setDetailItem(null), [])

  return { detailItem, loadingDetail, openDetails, closeDetails, setDetailItem }
}
