import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Play, Info, Star, ChevronLeft, ChevronRight, Loader2, Sparkles, Volume2, VolumeX, Plus, Check } from 'lucide-react'
import { getTrailerKey, getTrailerKeyByTitle, type TmdbItem } from '../services/tmdbService'
import { useAuth } from '../context/AuthContext'
import { usePlayback } from '../context/PlaybackContext'
import { useFavorites } from '../context/FavoritesContext'
import { searchTitleInCatalog } from '../services/catalog'
import { useTrailerSync } from '../hooks/useTrailerSync'

interface Props {
  items: TmdbItem[]
  badgeLabel?: string | ((item: TmdbItem, index: number) => string)
  onOpenDetails: (item: TmdbItem) => void
  isActive?: boolean
}

export default function CatalogHeroBanner({
  items,
  badgeLabel = 'Destaque Nº 1 no Brasil',
  onOpenDetails,
  isActive = true,
}: Props) {
  const { service } = useAuth()
  const { play } = usePlayback()

  const [currentIdx, setCurrentIdx] = useState(0)
  const [searching, setSearching] = useState(false)
  const [notFound, setNotFound] = useState(false)

  // Controle de Trailer Panorâmico de 30s
  const [trailerKey, setTrailerKey] = useState<string | null>(null)
  const [isPlayingTrailer, setIsPlayingTrailer] = useState(false)

  const bannerRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const timerRef = useRef<number | null>(null)
  const trailerTimerRef = useRef<number | null>(null)
  const trailerEndRef = useRef<number | null>(null)

  // Suporte a swipe de toque em celulares
  const touchStartX = useRef<number | null>(null)
  const touchEndX = useRef<number | null>(null)

  const current = items[currentIdx]
  const trailerId = current ? `hero-${current.id}` : undefined

  // Sincronizador global de áudio e player único
  const { isMuted, toggleMuted, activeId, requestPlay, releasePlay, stopAll } = useTrailerSync(trailerId)

  // Encerramento instantâneo (0ms) do trailer e corte de áudio no WebView
  const stopTrailerNow = useCallback(() => {
    if (iframeRef.current) {
      try {
        iframeRef.current.src = 'about:blank'
      } catch {}
    }
    setIsPlayingTrailer(false)
    setTrailerKey(null)
    if (trailerId) releasePlay(trailerId)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (trailerTimerRef.current) clearTimeout(trailerTimerRef.current)
    if (trailerEndRef.current) clearTimeout(trailerEndRef.current)
  }, [trailerId, releasePlay])

  // Se outro vídeo começou a tocar ou stopAll() foi chamado, desliga o hero imediatamente
  useEffect(() => {
    if (activeId !== trailerId && isPlayingTrailer) {
      stopTrailerNow()
    }
  }, [activeId, trailerId, isPlayingTrailer, stopTrailerNow])

  // Desativa e interrompe o trailer imediatamente se a aba atual não estiver ativa
  useEffect(() => {
    if (!isActive) {
      stopTrailerNow()
    }
  }, [isActive, stopTrailerNow])

  // Interrompe o trailer IMEDIATAMENTE (0ms) se o foco sair do banner (ex: usuário desceu para as categorias ou cards)
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const banner = bannerRef.current
      if (!banner) return
      if (e.target && !banner.contains(e.target as Node)) {
        stopTrailerNow()
      }
    }
    window.addEventListener('focusin', handleFocusIn, true)
    return () => window.removeEventListener('focusin', handleFocusIn, true)
  }, [stopTrailerNow])

  // Interrompe o trailer IMEDIATAMENTE quando a tela começar a rolar
  useEffect(() => {
    const handleScroll = () => {
      const banner = bannerRef.current
      if (!banner) return
      const rect = banner.getBoundingClientRect()
      if (rect.top < -40) {
        stopTrailerNow()
      }
    }
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [stopTrailerNow])

  // Pré-busca chave do trailer para iniciar imediatamente sem atraso quando o tempo expirar
  useEffect(() => {
    if (!current?.id) return
    getTrailerKey(current.id, current.mediaType).catch(() => {})
  }, [current?.id, current?.mediaType])

  // Linha do tempo do Banner: Se Versão Lite, apenas rotação suave de imagem; senão, trailer após debounce
  useEffect(() => {
    const hasModal = !!document.querySelector('[data-tv-modal="true"]')
    const hasPlayer = !!document.querySelector('[data-tv-player="true"]')
    if (!isActive || !current || items.length <= 1 || hasModal || hasPlayer) return

    // Reseta estado do trailer anterior
    setIsPlayingTrailer(false)
    setTrailerKey(null)
    if (trailerId) releasePlay(trailerId)

    if (timerRef.current) clearTimeout(timerRef.current)
    if (trailerTimerRef.current) clearTimeout(trailerTimerRef.current)
    if (trailerEndRef.current) clearTimeout(trailerEndRef.current)

    const isLite = typeof window !== 'undefined' && (
      localStorage.getItem('iptv-rea:lite') === '1' ||
      document.documentElement.classList.contains('lite')
    )

    // Se Versão Lite estiver ligada, não carrega trailers no banner (economiza memória e GPU)
    if (isLite) {
      timerRef.current = window.setTimeout(() => {
        setCurrentIdx((prev) => (prev + 1) % items.length)
      }, 8000)
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current)
      }
    }

    let isCurrent = true

    // 1. Após 3 segundos na imagem estática, tenta buscar e iniciar o trailer
    trailerTimerRef.current = window.setTimeout(async () => {
      if (!isCurrent || !isActive) return
      try {
        let key = await getTrailerKey(current.id, current.mediaType)
        if (!key) {
          key = await getTrailerKeyByTitle(current.title, current.mediaType)
        }
        if (!isCurrent || !isActive) return
        if (key) {
          // Registra como o único trailer ativo no app
          requestPlay(trailerId)
          setTrailerKey(key)
          setIsPlayingTrailer(true)

          // 2. O trailer roda por 30 segundos. Ao encerrar, volta à imagem e avança o slide
          trailerEndRef.current = window.setTimeout(() => {
            stopTrailerNow()
            setCurrentIdx((prev) => (prev + 1) % items.length)
          }, 30000)
        } else {
          // Sem trailer: permanece na imagem estática por 6 segundos e avança
          timerRef.current = window.setTimeout(() => {
            setCurrentIdx((prev) => (prev + 1) % items.length)
          }, 6000)
        }
      } catch {
        timerRef.current = window.setTimeout(() => {
          setCurrentIdx((prev) => (prev + 1) % items.length)
        }, 6000)
      }
    }, 3000)

    return () => {
      isCurrent = false
      if (timerRef.current) clearTimeout(timerRef.current)
      if (trailerTimerRef.current) clearTimeout(trailerTimerRef.current)
      if (trailerEndRef.current) clearTimeout(trailerEndRef.current)
      if (trailerId) releasePlay(trailerId)
    }
  }, [isActive, currentIdx, current?.id, items.length])

  const nextSlide = () => {
    setIsPlayingTrailer(false)
    if (trailerId) releasePlay(trailerId)
    setCurrentIdx((prev) => (prev + 1) % items.length)
    setNotFound(false)
  }

  const prevSlide = () => {
    setIsPlayingTrailer(false)
    if (trailerId) releasePlay(trailerId)
    setCurrentIdx((prev) => (prev - 1 + items.length) % items.length)
    setNotFound(false)
  }

  const handlePlayNow = async () => {
    if (!service || !current) return

    // Pausa e desliga o trailer imediatamente no clique
    setIsPlayingTrailer(false)
    setTrailerKey(null)
    if (trailerId) releasePlay(trailerId)
    stopAll()

    // Se já tiver o item original do IPTV, toca imediatamente sem busca!
    if (current.mediaItem) {
      play(current.mediaItem)
      return
    }

    setSearching(true)
    setNotFound(false)

    try {
      const type = current.mediaType === 'movie' ? 'movies' : 'series'
      const found = await searchTitleInCatalog(service, type, current)

      if (found) {
        play(found)
      } else {
        setNotFound(true)
        setTimeout(() => setNotFound(false), 4000)
      }
    } catch {
      setNotFound(true)
    } finally {
      setSearching(false)
    }
  }

  const { isFavorite, toggle } = useFavorites()
  const [addingFav, setAddingFav] = useState(false)

  const isCurrentFavorite = useMemo(() => {
    if (!current) return false
    if (current.mediaItem) return isFavorite(current.mediaItem.key)
    return isFavorite(`tmdb:${current.id}`) || isFavorite(`movies:${current.id}`) || isFavorite(`series:${current.id}`)
  }, [current, isFavorite])

  const handleToggleFavorite = async () => {
    if (!current) return
    if (current.mediaItem) {
      toggle(current.mediaItem)
      return
    }

    // Se ainda não temos o mediaItem mapeado, tenta localizar no catálogo para vincular direto
    setAddingFav(true)
    try {
      if (service) {
        const type = current.mediaType === 'movie' ? 'movies' : 'series'
        const found = await searchTitleInCatalog(service, type, current)
        if (found) {
          toggle(found)
          setAddingFav(false)
          return
        }
      }
    } catch {}

    // Fallback: adiciona à lista com objeto MediaItem compatível
    const fallbackItem = {
      key: `tmdb:${current.id}`,
      type: (current.mediaType === 'movie' ? 'movies' : 'series') as any,
      id: current.id,
      name: current.title,
      image: current.posterPath || current.backdropPath || '',
      rating: String(current.voteAverage || ''),
    }
    toggle(fallbackItem)
    setAddingFav(false)
  }

  const [isBannerFocused, setIsBannerFocused] = useState(false)

  if (items.length === 0 || !current) return null

  // Rótulo da badge (personalizado ou calculado)
  const currentBadge = typeof badgeLabel === 'function' ? badgeLabel(current, currentIdx) : badgeLabel

  return (
    <div
      ref={bannerRef}
      tabIndex={0}
      data-tv-banner="true"
      role="region"
      aria-label={`${current.title}. Use as setas esquerda e direita para mudar de destaque.`}
      onFocus={(e) => {
        if (e.target === e.currentTarget) {
          setIsBannerFocused(true)
        }
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsBannerFocused(false)
        }
      }}
      onKeyDown={(e) => {
        // Se o foco estiver em um botão dentro do banner ("Assistir Agora", etc.), não intercepta as setas
        if (e.target !== e.currentTarget) return

        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          e.stopPropagation()
          prevSlide()
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          e.stopPropagation()
          nextSlide()
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handlePlayNow()
        }
      }}
      onTouchStart={(e) => {
        touchStartX.current = e.targetTouches[0].clientX
        touchEndX.current = null
      }}
      onTouchMove={(e) => {
        touchEndX.current = e.targetTouches[0].clientX
      }}
      onTouchEnd={() => {
        if (touchStartX.current === null || touchEndX.current === null) return
        const diff = touchStartX.current - touchEndX.current
        if (diff > 45) {
          nextSlide()
        } else if (diff < -45) {
          prevSlide()
        }
      }}
      className={`relative w-full shrink-0 h-[440px] sm:h-[560px] lg:h-[620px] overflow-hidden bg-zinc-950 select-none group focus:outline-none transition-all duration-300 touch-pan-y ${
        isBannerFocused ? 'ring-4 ring-inset ring-rose-500 shadow-[inset_0_0_80px_rgba(244,63,94,0.45)]' : ''
      }`}
    >
      {/* Indicador de Atalho D-pad quando o Banner está focado (Padrão Netflix) */}
      {isBannerFocused && (
        <div className="absolute top-20 right-8 z-40 flex items-center gap-3 bg-black/85 backdrop-blur-md border border-rose-500/60 px-4 py-2 rounded-xl shadow-2xl fade-up">
          <span className="text-xs font-black text-white flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono">◀</span>
            <span className="px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono">▶</span>
            <span>Mudar Destaque</span>
          </span>
          <span className="w-px h-3.5 bg-white/20" />
          <span className="text-xs font-black text-rose-400 flex items-center gap-1">
            <span className="px-1.5 py-0.5 rounded bg-rose-600/30 border border-rose-500/40 text-[10px] font-mono text-white">OK</span>
            <span>Assistir</span>
          </span>
          <span className="w-px h-3.5 bg-white/20" />
          <span className="text-xs font-black text-zinc-300 flex items-center gap-1">
            <span className="px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono">▼</span>
            <span>Opções</span>
          </span>
        </div>
      )}

      {/* 1. Backdrop HD Estático */}
      {current.backdropPath && (
        <img
          key={current.id}
          src={current.backdropPath}
          alt={current.title}
          className={`absolute inset-0 w-full h-full object-cover object-center filter brightness-[0.8] contrast-105 transition-opacity duration-1000 scale-[1.02] ${
            isPlayingTrailer && trailerKey ? 'opacity-0' : 'opacity-100'
          }`}
        />
      )}


      {/* 2. Trailer Panorâmico Widescreen em Full HD (Sem barras pretas e sem controles ou botões do YouTube) */}
      {isActive && isPlayingTrailer && trailerKey && (
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-[1] select-none fade-up">
          <iframe
            ref={iframeRef}
            tabIndex={-1}
            data-tv-ignore="true"
            src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&mute=${
              isMuted ? 1 : 0
            }&controls=0&disablekb=1&fs=0&iv_load_policy=3&modestbranding=1&rel=0&showinfo=0&loop=1&playlist=${trailerKey}&playsinline=1&enablejsapi=1&vq=hd720`}
            title={current.title}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full w-[130vw] h-[80vw] pointer-events-none border-0 scale-125 select-none"
            allow="autoplay; encrypted-media"
          />
        </div>
      )}

      {/* Botão de Som Global do Trailer (🔊 / 🔇) (Apenas Mouse) */}
      {isActive && isPlayingTrailer && trailerKey && (
        <button
          type="button"
          tabIndex={-1}
          data-tv-ignore="true"
          onClick={toggleMuted}
          className="absolute bottom-24 sm:bottom-28 right-8 sm:right-14 z-40 p-3 rounded-full bg-black/75 hover:bg-black/90 text-white border border-white/20 shadow-2xl backdrop-blur-md transition hover:scale-110 cursor-pointer"
          title={isMuted ? 'Ativar Som do Trailer (Volume Geral)' : 'Silenciar Trailer (Volume Geral)'}
        >
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} className="text-rose-400" />}
        </button>
      )}

      {/* Gradientes Cinematográficos Profundos Multi-Camadas */}
      <div className="absolute inset-x-0 bottom-0 h-80 sm:h-96 bg-gradient-to-t from-zinc-950 via-zinc-950/90 via-40% via-zinc-950/30 to-transparent pointer-events-none z-[2]" />
      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none z-[3]" />
      <div className="absolute inset-y-0 left-0 w-full sm:w-[75%] lg:w-[60%] bg-gradient-to-r from-zinc-950 via-zinc-950/85 via-50% to-transparent pointer-events-none z-[2]" />
      <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-zinc-950/90 via-zinc-950/40 to-transparent pointer-events-none z-[2]" />

      {/* Setas de navegação (Toque fácil no mobile e hover no desktop) */}
      <button
        type="button"
        tabIndex={-1}
        data-tv-ignore="true"
        aria-hidden="true"
        onClick={prevSlide}
        className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 z-30 p-2 sm:p-3 rounded-full bg-black/60 hover:bg-rose-600 text-white opacity-85 sm:opacity-0 sm:group-hover:opacity-100 transition duration-300 shadow-2xl backdrop-blur-md border border-white/10 cursor-pointer touch-manipulation active:scale-90"
        aria-label="Anterior"
      >
        <ChevronLeft size={22} className="sm:w-7 sm:h-7" />
      </button>
      <button
        type="button"
        tabIndex={-1}
        data-tv-ignore="true"
        aria-hidden="true"
        onClick={nextSlide}
        className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 z-30 p-2 sm:p-3 rounded-full bg-black/60 hover:bg-rose-600 text-white opacity-85 sm:opacity-0 sm:group-hover:opacity-100 transition duration-300 shadow-2xl backdrop-blur-md border border-white/10 cursor-pointer touch-manipulation active:scale-90"
        aria-label="Próximo"
      >
        <ChevronRight size={22} className="sm:w-7 sm:h-7" />
      </button>

      {/* Conteúdo do Destaque */}
      <div className="relative z-10 h-full flex flex-col justify-end px-4 sm:px-14 lg:px-16 pt-16 sm:pt-24 pb-8 sm:pb-16 max-w-3xl space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <span className="px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-md bg-rose-600 text-white font-black text-[10px] sm:text-[11px] tracking-wider uppercase shadow-lg flex items-center gap-1.5">
            <Sparkles size={12} />
            {currentBadge}
          </span>
          <div className="flex items-center gap-1 text-amber-400 font-extrabold text-[11px] sm:text-xs bg-black/60 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md backdrop-blur-md border border-white/10">
            <Star size={12} className="fill-amber-400" />
            <span>{current.voteAverage}</span>
          </div>
          {current.releaseDate && (
            <span className="text-[11px] sm:text-xs text-zinc-300 font-semibold bg-black/40 px-2 py-0.5 rounded border border-white/5">
              {current.releaseDate.split('-')[0]}
            </span>
          )}
          <span className="text-[11px] sm:text-xs text-zinc-400 font-bold uppercase tracking-wider bg-black/40 px-2 py-0.5 rounded border border-white/5">
            {current.mediaType === 'movie' ? 'Filme' : 'Série'}
          </span>
        </div>

        <h1 className="text-2xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight sm:leading-none drop-shadow-2xl font-['Montserrat',sans-serif] line-clamp-2">
          {current.title}
        </h1>

        <p className="text-xs sm:text-sm text-zinc-200 line-clamp-2 sm:line-clamp-3 leading-relaxed max-w-2xl drop-shadow font-normal">
          {current.overview || 'Os títulos mais assistidos e aclamados pelo público.'}
        </p>

        {/* Botões de Ação estilo Netflix / Prime Video com Foco TV */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 pt-1 sm:pt-2 flex-wrap">
          <button
            tabIndex={0}
            disabled={searching}
            onClick={handlePlayNow}
            className="flex items-center gap-2 px-5 sm:px-8 py-2.5 sm:py-3.5 rounded-xl bg-white hover:bg-zinc-200 font-black text-xs sm:text-sm text-black shadow-2xl transition transform active:scale-95 focus:scale-105 focus:ring-4 focus:ring-rose-500 focus:outline-none disabled:opacity-60 cursor-pointer touch-manipulation"
          >
            {searching ? (
              <Loader2 size={16} className="animate-spin text-black" />
            ) : (
              <Play size={16} className="fill-black text-black" />
            )}
            <span>Assistir Agora</span>
          </button>

          <button
            tabIndex={0}
            disabled={addingFav}
            onClick={handleToggleFavorite}
            className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-xl border font-bold text-xs sm:text-sm shadow-xl transition backdrop-blur-md focus:scale-105 focus:ring-4 focus:ring-rose-500 focus:outline-none cursor-pointer touch-manipulation active:scale-95 ${
              isCurrentFavorite
                ? 'bg-rose-600/20 text-rose-400 border-rose-500/40 hover:bg-rose-600/30'
                : 'bg-zinc-800/80 hover:bg-zinc-700/80 border-zinc-600/60 text-white'
            }`}
          >
            {addingFav ? (
              <Loader2 size={16} className="animate-spin" />
            ) : isCurrentFavorite ? (
              <Check size={16} className="text-rose-400" />
            ) : (
              <Plus size={16} />
            )}
            <span>{isCurrentFavorite ? 'Na Minha Lista' : 'Minha Lista'}</span>
          </button>

          <button
            tabIndex={0}
            onClick={() => {
              setIsPlayingTrailer(false)
              setTrailerKey(null)
              if (trailerId) releasePlay(trailerId)
              stopAll()
              onOpenDetails(current)
            }}
            className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-600/60 font-bold text-xs sm:text-sm text-white shadow-xl transition backdrop-blur-md focus:scale-105 focus:ring-4 focus:ring-rose-500 focus:outline-none cursor-pointer touch-manipulation"
          >
            <Info size={16} />
            <span>Mais Informações</span>
          </button>
        </div>

        {notFound && (
          <p className="text-xs font-bold text-rose-400 pt-1 drop-shadow">
            Título não localizado na lista IPTV com este nome exato.
          </p>
        )}
      </div>

      {/* Indicadores de Slide (Clicáveis) */}
      <div className="absolute bottom-4 sm:bottom-10 right-4 sm:right-14 z-30 flex items-center gap-1.5 sm:gap-2 bg-black/50 backdrop-blur-md px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-full border border-white/10 shadow-2xl">
        {items.map((it, idx) => (
          <button
            key={it.id}
            onClick={() => setCurrentIdx(idx)}
            className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer touch-manipulation ${
              idx === currentIdx ? 'w-6 sm:w-8 bg-rose-600 shadow-md shadow-rose-600/50' : 'w-1.5 sm:w-2 bg-white/40'
            }`}
            aria-label={`Destaque ${idx + 1}`}
          />
        ))}
      </div>

    </div>
  )
}
