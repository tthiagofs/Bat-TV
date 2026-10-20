import { useCallback } from 'react'
import { useProfiles } from './ProfileContext'
import type { MediaItem } from '../types'

/** Favoritos agora pertencem ao perfil ativo (independentes da lista IPTV). */
export function useFavorites() {
  const { active, toggleFavorite } = useProfiles()
  const favorites = active?.favorites ?? []
  const isFavorite = useCallback((key: string) => favorites.some((f) => f.key === key), [favorites])
  const toggle = useCallback((item: MediaItem) => toggleFavorite(item), [toggleFavorite])
  return { favorites, isFavorite, toggle }
}
