import { useState, useEffect, useMemo } from 'react'
import { Play, Star, Film, Tv, Radio, Loader2, Clock, Flame, Info } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { usePlayback } from '../../context/PlaybackContext'
import { useProfiles } from '../../context/ProfileContext'
import { getRecommendedItems, getPreviewItems, searchTitleInCatalog } from '../../services/catalog'
import { getTrendingHero, searchTmdbItem, getTop10ByProvider, STREAMING_PROVIDERS, type TmdbItem, type StreamingProvider } from '../../services/tmdbService'
import { getProviderLogoComponent } from '../StreamingLogos'
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

  // Top 10 Streamings (padrão Netflix)
  const [activeProvider, setActiveProvider] = useState<StreamingProvider>(STREAMING_PROVIDERS[0])
  const [top10Items, setTop10Items] = useState<TmdbItem[]>([])
  const [top10Loading, setTop10Loading] = useState(false)

  // Continuar Assistindo (histórico do perfil com progresso > 0)
  const continueWatching = useMemo(() => {
    return (profile?.history || [])
      .filter((h) => h.duration > 0 && h.position / h.duration > 0.02 && h.position / h.duration < 0.95)
      .slice(0, 10)
  }, [profile?.history])

  // Busca Top 10 da plataforma selecionada (Netflix, Prime, Max, Disney+)
  useEffect(() => {
    let active = true
    setTop10Loading(true)

    getTop10ByProvider(activeProvider.id)
      .then((res) => {
        if (active) setTop10Items(res)
      })
      .finally(() => {
        if (active) setTop10Loading(false)
      })

    return () => {
      active = false
    }
  }, [activeProvider])

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
      <div className="px-4 space-y-7">
        {/* Continuar Assistindo (Se houver progresso salvo no perfil) */}
        {continueWatching.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-rose-500" />
              <h2 className="font-extrabold text-base text-white tracking-tight">
                Continuar assistindo
              </h2>
            </div>

            <div className="flex gap-3 overflow-x-auto no-scrollbar py-1">
              {continueWatching.map((item) => {
                const percent = Math.min(100, Math.max(2, (item.position / item.duration) * 100))
                const remainingMin = Math.max(1, Math.round((item.duration - item.position) / 60))

                return (
                  <div
                    key={item.key || item.id}
                    onClick={() => play(item, { fromStart: false })}
                    className="shrink-0 w-44 rounded-xl overflow-hidden bg-zinc-900 border border-white/10 active:scale-95 transition cursor-pointer flex flex-col group"
                  >
                    {/* Thumbnail 16:9 com Barra de Progresso */}
                    <div className="aspect-video w-full bg-zinc-800 relative overflow-hidden">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-500">
                          {item.type === 'series' ? <Tv size={24} /> : <Film size={24} />}
                        </div>
                      )}

                      {/* Botão de Play circular translúcido no centro */}
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-black/70 border border-white/30 backdrop-blur-xs flex items-center justify-center text-white shadow-lg group-active:scale-90 transition">
                          <Play size={14} className="fill-white translate-x-0.5" />
                        </div>
                      </div>

                      {/* Barra de Progresso Vermelha na Base */}
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-700/80">
                        <div
                          className="h-full bg-rose-600 rounded-r-full"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    {/* Título e Info do Episódio */}
                    <div className="p-2 flex-1 flex flex-col justify-between">
                      <p className="text-xs font-bold text-white truncate leading-tight">
                        {item.name}
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-0.5 truncate">
                        {item.episode?.title
                          ? item.episode.title
                          : item.type === 'series'
                          ? 'Série'
                          : `Restam ${remainingMin} min`}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Top 10 Mais Assistidos no Brasil Adaptado para Mobile Vertical */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-600/20 text-rose-500 border border-rose-500/30">
              <Flame size={16} />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-white tracking-tight leading-tight">
                Top 10 no Brasil
              </h2>
              <p className="text-[11px] text-zinc-400">
                Mais assistidos hoje na {activeProvider.name}
              </p>
            </div>
          </div>

          {/* Seletor Compacto das 4 Plataformas com Logos Oficiais em SVG */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
            {STREAMING_PROVIDERS.map((prov) => {
              const isSel = prov.id === activeProvider.id
              const LogoComp = getProviderLogoComponent(prov.id)
              return (
                <button
                  key={prov.id}
                  onClick={() => setActiveProvider(prov)}
                  className={`shrink-0 flex items-center justify-center px-3.5 py-1.5 rounded-xl transition cursor-pointer active:scale-95 ${
                    isSel
                      ? 'bg-zinc-800 text-white border border-zinc-600 shadow-md ring-1 ring-zinc-500 scale-[1.02]'
                      : 'bg-zinc-950/80 text-zinc-400 border border-zinc-800/80 hover:text-white'
                  }`}
                  title={prov.name}
                >
                  <div className="h-4 flex items-center">
                    <LogoComp className="h-3.5 w-auto" />
                  </div>
                </button>
              )
            })}
          </div>

          {/* Carrossel do Top 10 com Número Estilizado e Pôster Compacto */}
          {top10Loading ? (
            <div className="h-44 bg-zinc-950/60 rounded-2xl border border-zinc-800/60 flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-rose-500" />
            </div>
          ) : (
            <div className="flex gap-1 overflow-x-auto no-scrollbar py-2">
              {top10Items.map((it, idx) => (
                <div
                  key={it.id}
                  onClick={() => setSelectedItem(it)}
                  className="shrink-0 flex items-end group relative select-none cursor-pointer active:scale-95 transition"
                >
                  {/* Número Estilizado 1 ao 10 no estilo Netflix */}
                  <span
                    className="font-black text-6xl leading-none text-zinc-800 select-none -mr-3 z-0"
                    style={{ WebkitTextStroke: '1.5px #3f3f46' }}
                  >
                    {idx + 1}
                  </span>

                  {/* Pôster Vertical Compacto */}
                  <div className="w-28 aspect-[2/3] rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 z-10 relative shadow-md">
                    {it.posterPath ? (
                      <img
                        src={it.posterPath}
                        alt={it.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-2 text-center text-[10px] text-zinc-500 font-bold">
                        {it.title}
                      </div>
                    )}

                    <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 bg-black/75 px-1.5 py-0.5 rounded text-[10px] text-amber-400 font-bold backdrop-blur-xs">
                      <Star size={10} className="fill-amber-400" />
                      <span>{it.voteAverage}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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
