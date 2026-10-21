import { useState, useEffect } from 'react'
import { Play, Star, Film, Tv, Radio, Loader2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { usePlayback } from '../../context/PlaybackContext'
import { useProfiles } from '../../context/ProfileContext'
import { getRecommendedItems, getPreviewItems } from '../../services/catalog'
import { getTrendingHero, searchTmdbItem, type TmdbItem } from '../../services/tmdbService'
import type { MediaItem, Section } from '../../types'
import MobileHeroBanner from './MobileHeroBanner'
import MediaDetailsModal from '../MediaDetailsModal'

interface Props {
  onNavigate: (s: Section) => void
}

export default function MobileHome({ onNavigate }: Props) {
  const { service } = useAuth()
  const { active: profile } = useProfiles()
  const { play } = usePlayback()

  const [heroItems, setHeroItems] = useState<TmdbItem[]>([])
  const [movies, setMovies] = useState<MediaItem[]>([])
  const [series, setSeries] = useState<MediaItem[]>([])
  const [live, setLive] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<TmdbItem | null>(null)

  useEffect(() => {
    let isCurrent = true

    // 1. Busca os destaques verticais para o Hero Banner
    getTrendingHero(6).then((items) => {
      if (isCurrent && items.length > 0) {
        setHeroItems(items)
      }
    })

    // 2. Busca catálogo do servidor IPTV com carregamento progressivo e rápido
    if (service) {
      const genres = profile?.preferredGenres || []
      const likedNames = (profile?.favorites || []).map((f) => f.name)
      const hasPrefs = genres.length > 0 || likedNames.length > 0

      const fetchMovies = hasPrefs
        ? getRecommendedItems(service, 'movies', genres, likedNames, 16)
        : getPreviewItems(service, 'movies', 16)

      const fetchSeries = hasPrefs
        ? getRecommendedItems(service, 'series', genres, likedNames, 16)
        : getPreviewItems(service, 'series', 16)

      const fetchLive = getPreviewItems(service, 'live', 15)

      fetchMovies
        .then((m) => {
          if (!isCurrent) return
          setMovies(m)
          setLoading(false)
        })
        .catch(() => {})

      fetchSeries
        .then((s) => {
          if (!isCurrent) return
          setSeries(s)
          setLoading(false)
        })
        .catch(() => {})

      fetchLive
        .then((l) => {
          if (!isCurrent) return
          setLive(l)
          setLoading(false)
        })
        .catch(() => {})
    }

    return () => {
      isCurrent = false
    }
  }, [service, profile])

  const handleOpenMedia = async (media: MediaItem) => {
    // Busca informações enriquecidas no TMDB para abrir o modal completo
    const tmdb = await searchTmdbItem(media.name, media.type === 'series' ? 'tv' : 'movie')
    if (tmdb) {
      setSelectedItem({ ...tmdb, mediaItem: media })
    } else {
      // Se não achar no TMDB, reproduz direto
      play(media)
    }
  }

  const handleHeroPlay = async (hero: TmdbItem) => {
    if (hero.mediaItem) {
      play(hero.mediaItem)
    } else {
      setSelectedItem(hero)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar pb-28 space-y-6 bg-black text-white">
      {/* 1. Hero Banner Vertical estilo Netflix Mobile */}
      {heroItems.length > 0 ? (
        <MobileHeroBanner
          items={heroItems}
          onOpenDetails={(item) => setSelectedItem(item)}
          onPlay={handleHeroPlay}
        />
      ) : (
        <div className="w-full aspect-[3/4] bg-zinc-950 flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-rose-500" />
        </div>
      )}

      {/* 2. Carrosséis de Conteúdo com Toque Horizontal */}
      <div className="px-4 space-y-6">
        {/* Séries em Alta */}
        {series.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-base text-white tracking-tight">
                Séries Populares
              </h2>
              <button
                onClick={() => onNavigate('series')}
                className="text-xs text-rose-400 font-semibold"
              >
                Ver mais
              </button>
            </div>

            <div className="flex gap-2.5 overflow-x-auto no-scrollbar py-1">
              {series.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleOpenMedia(item)}
                  className="shrink-0 w-28 rounded-md overflow-hidden bg-zinc-900 border border-white/10 active:scale-95 transition cursor-pointer"
                >
                  <div className="aspect-[2/3] w-full bg-zinc-800 relative">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-500">
                        <Tv size={24} />
                      </div>
                    )}
                    <div className="absolute top-1.5 left-1.5 px-1 py-0.5 rounded bg-black/60 text-[9px] font-bold text-white">
                      HD
                    </div>
                  </div>
                  <div className="p-1.5">
                    <p className="text-[11px] font-bold text-white truncate">{item.name}</p>
                    <p className="text-[10px] text-zinc-400">Série</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filmes em Alta */}
        {movies.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-base text-white tracking-tight">
                Filmes Imperdíveis
              </h2>
              <button
                onClick={() => onNavigate('movies')}
                className="text-xs text-rose-400 font-semibold"
              >
                Ver mais
              </button>
            </div>

            <div className="flex gap-2.5 overflow-x-auto no-scrollbar py-1">
              {movies.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleOpenMedia(item)}
                  className="shrink-0 w-28 rounded-md overflow-hidden bg-zinc-900 border border-white/10 active:scale-95 transition cursor-pointer"
                >
                  <div className="aspect-[2/3] w-full bg-zinc-800 relative">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-500">
                        <Film size={24} />
                      </div>
                    )}
                  </div>
                  <div className="p-1.5">
                    <p className="text-[11px] font-bold text-white truncate">{item.name}</p>
                    <p className="text-[10px] text-zinc-400">Filme</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Canais de TV Ao Vivo */}
        {live.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <h2 className="font-extrabold text-base text-white tracking-tight">
                  Canais Ao Vivo
                </h2>
              </div>
              <button
                onClick={() => onNavigate('live')}
                className="text-xs text-rose-400 font-semibold"
              >
                Ver todos
              </button>
            </div>

            <div className="flex gap-2.5 overflow-x-auto no-scrollbar py-1">
              {live.map((ch) => (
                <div
                  key={ch.id}
                  onClick={() => play(ch)}
                  className="shrink-0 w-36 rounded-lg overflow-hidden bg-zinc-900 border border-white/10 active:scale-95 transition cursor-pointer p-2 flex flex-col items-center justify-center text-center space-y-1.5"
                >
                  <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center overflow-hidden p-1">
                    {ch.image ? (
                      <img src={ch.image} alt={ch.name} className="w-full h-full object-contain" />
                    ) : (
                      <Radio size={20} className="text-zinc-400" />
                    )}
                  </div>
                  <p className="text-[11px] font-bold text-white truncate w-full">{ch.name}</p>
                  <span className="text-[9px] font-black uppercase text-rose-400 bg-rose-950/60 px-1.5 py-0.5 rounded">
                    AO VIVO
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Detalhes ao Clicar em Qualquer Filme / Série */}
      {selectedItem && (
        <MediaDetailsModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  )
}
