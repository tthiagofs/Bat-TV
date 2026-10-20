import { memo, useState, useRef, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { Star, Play, Info, Plus, Check, Volume2, VolumeX, ChevronDown, ThumbsUp } from 'lucide-react'
import LazyImage from './LazyImage'
import type { MediaItem } from '../types'
import { searchTmdbItem, getTrailerKey } from '../services/tmdbService'
import { useTrailerSync } from '../hooks/useTrailerSync'

export type CardBadge = 'EM ALTA' | 'NOVOS NO CATÁLOGO' | 'MAIS CURTIDO' | 'TOP 10'

interface Props {
  item: MediaItem
  fav: boolean
  onPlay: (item: MediaItem) => void
  onToggleFav: (item: MediaItem) => void
  onInfo?: (item: MediaItem) => void
  /** 0..1 — barra de progresso (continuar assistindo) */
  progress?: number
  /** largura fixa (linhas horizontais da Home) */
  fixedWidth?: number
  /** Formato do card: 'landscape' (16:9 Widescreen Prime Video) ou 'poster' (2:3) */
  aspectRatio?: 'landscape' | 'poster'
  /** Badge estilizada no topo do card (EM ALTA, NOVOS NO CATÁLOGO, etc) */
  badge?: CardBadge
}

function MediaCardBase({
  item,
  fav,
  onPlay,
  onToggleFav,
  onInfo,
  progress,
  fixedWidth,
  aspectRatio = 'landscape',
  badge,
}: Props) {
  const isLandscape = aspectRatio === 'landscape' || item.type === 'live'

  // Controle de Mini-Tela Expandida (Hover / Focus estilo Netflix)
  const [isExpanded, setIsExpanded] = useState(false)
  const [trailerKey, setTrailerKey] = useState<string | null>(null)
  const [isPlayingTrailer, setIsPlayingTrailer] = useState(false)
  const [isLiked, setIsLiked] = useState(false)

  const trailerId = `card-${item.key}`
  const { isMuted, toggleMuted, activeId, requestPlay, releasePlay } = useTrailerSync(trailerId)

  const hoverTimerRef = useRef<number | null>(null)
  const trailerTimerRef = useRef<number | null>(null)

  // Se outro trailer começou a tocar em outro lugar, para este imediatamente
  useEffect(() => {
    if (activeId && activeId !== trailerId && isPlayingTrailer) {
      setIsPlayingTrailer(false)
      setTrailerKey(null)
    }
  }, [activeId, trailerId, isPlayingTrailer])

  // Quando o usuário pousa sobre o card com mouse (desativado no Android TV e na Versão Lite para máxima fluidez)
  const handleMouseEnter = () => {
    const isLite = typeof window !== 'undefined' && (
      localStorage.getItem('iptv-rea:lite') === '1' ||
      document.documentElement.classList.contains('lite')
    )
    if (Capacitor.isNativePlatform() || item.type === 'live' || isLite) return

    hoverTimerRef.current = window.setTimeout(async () => {
      setIsExpanded(true)
      try {
        const tmdb = await searchTmdbItem(item.name, item.type === 'movies' ? 'movie' : 'tv')
        if (tmdb) {
          const key = await getTrailerKey(tmdb.id, tmdb.mediaType)
          if (key) {
            requestPlay(trailerId)
            setTrailerKey(key)
            setIsPlayingTrailer(true)

            // Trailer toca por exatamente 30 segundos e depois para
            trailerTimerRef.current = window.setTimeout(() => {
              setIsPlayingTrailer(false)
              releasePlay(trailerId)
            }, 30000)
          }
        }
      } catch {}
    }, 1000) // Debounce de 1 segundo (Item D): ultra-leve e evita acionamento acidental ao rolar
  }

  // Ao sair do card, descarrega qualquer estado pendente
  const handleMouseLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    if (trailerTimerRef.current) clearTimeout(trailerTimerRef.current)
    setIsExpanded(false)
    setIsPlayingTrailer(false)
    setTrailerKey(null)
    releasePlay(trailerId)
  }

  // Tecla Enter/OK do controle remoto (Padrão Netflix / Smart TV)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (item.type === 'live') {
        onPlay(item)
      } else if (onInfo) {
        onInfo(item)
      } else {
        onPlay(item)
      }
    }
  }

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
      if (trailerTimerRef.current) clearTimeout(trailerTimerRef.current)
      releasePlay(trailerId)
    }
  }, [trailerId])

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="group relative text-left shrink-0"
      style={fixedWidth ? { width: fixedWidth } : undefined}
    >
      <div className="block w-full text-left rounded-2xl transition-all duration-200">
        {/* Container do Card Normal (Único alvo de foco do controle remoto na TV) */}
        <div
          tabIndex={0}
          role="button"
          aria-label={`Assistir ${item.name}`}
          onKeyDown={handleKeyDown}
          onClick={() => (onInfo && item.type !== 'live' ? onInfo(item) : onPlay(item))}
          className={`relative ${
            isLandscape ? 'aspect-video' : 'aspect-[2/3]'
          } rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 group-hover:border-rose-500 group-hover:scale-[1.04] focus-visible:border-white focus-visible:scale-[1.06] focus-visible:ring-4 focus-visible:ring-rose-500 focus-visible:shadow-[0_0_25px_rgba(244,63,94,0.6)] focus-visible:outline-none transition-all duration-200 ease-out cursor-pointer z-10 focus-visible:z-20 scroll-mt-28`}
        >
          <LazyImage
            src={item.image}
            alt={item.name}
            width={isLandscape ? 360 : 342}
            fit="cover"
          />

          {/* Badges estilizadas estilo Netflix / BAT TV */}
          {badge && (
            <div className="absolute top-2.5 right-2.5 z-20 pointer-events-none">
              <span
                className={`px-2.5 py-0.5 rounded-md font-extrabold text-[10px] uppercase tracking-wider shadow-md backdrop-blur-md ${
                  badge === 'EM ALTA'
                    ? 'bg-rose-600 text-white'
                    : badge === 'NOVOS NO CATÁLOGO'
                    ? 'bg-white text-zinc-950 shadow-white/20'
                    : badge === 'TOP 10'
                    ? 'bg-amber-400 text-zinc-950 font-black'
                    : 'bg-black/75 text-zinc-200 border border-white/20'
                }`}
              >
                {badge}
              </span>
            </div>
          )}

          {/* Selo BAT TV no Canto Inferior Direito */}
          <div className="absolute bottom-2.5 right-2.5 z-20 pointer-events-none opacity-80 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
            <span className="text-[9px] font-black tracking-widest uppercase bg-black/60 backdrop-blur-md text-zinc-300 px-1.5 py-0.5 rounded border border-white/10">
              BAT TV
            </span>
          </div>

          {/* Overlay Padrão com Botão Play no Centro no Hover de Mouse */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-200 z-10 p-3 pointer-events-none">
            <div className="p-3 rounded-full bg-rose-600 text-white shadow-xl shadow-rose-950/60 transform scale-90 group-hover:scale-100 group-focus-visible:scale-100 transition-transform duration-300 mb-2">
              <Play size={20} className="fill-white translate-x-0.5" />
            </div>

            {/* Ações Rápidas de Mouse (Ignoradas pelo D-pad da TV) */}
            <div className="flex items-center gap-2 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
              {onInfo && item.type !== 'live' && (
                <button
                  type="button"
                  tabIndex={-1}
                  data-tv-ignore="true"
                  onClick={() => onInfo(item)}
                  className="px-2.5 py-1 rounded-full bg-zinc-800/90 hover:bg-zinc-700 text-white border border-white/20 text-[11px] font-bold flex items-center gap-1 shadow backdrop-blur-md transition cursor-pointer"
                  title="Mais Informações"
                >
                  <Info size={12} />
                  <span>Info</span>
                </button>
              )}

              <button
                type="button"
                tabIndex={-1}
                data-tv-ignore="true"
                onClick={() => onToggleFav(item)}
                className={`p-1.5 rounded-full border text-[11px] font-bold flex items-center justify-center shadow backdrop-blur-md transition cursor-pointer ${
                  fav
                    ? 'bg-rose-600 text-white border-rose-500'
                    : 'bg-zinc-800/90 hover:bg-zinc-700 text-white border-white/20'
                }`}
                title={fav ? 'Salvo nos Favoritos' : 'Adicionar à Lista'}
              >
                {fav ? <Check size={13} /> : <Plus size={13} />}
              </button>
            </div>
          </div>

          {/* Barra de Progresso na Base (Continuar Assistindo) */}
          {progress !== undefined && (
            <div className="absolute bottom-0 inset-x-0 h-1.5 bg-black/70 z-20">
              <div
                className="h-full bg-rose-500 rounded-r-full shadow-sm"
                style={{ width: `${Math.min(100, Math.max(5, Math.round(progress * 100)))}%` }}
              />
            </div>
          )}
        </div>

        {/* Título do Card */}
        <div className="flex items-center justify-between gap-1.5 mt-2">
          <p
            onClick={() => (onInfo && item.type !== 'live' ? onInfo(item) : onPlay(item))}
            className="text-xs sm:text-sm font-semibold text-zinc-200 group-hover:text-white group-focus-visible:text-rose-400 truncate transition-colors cursor-pointer flex-1"
          >
            {item.name}
          </p>
          {onInfo && item.type !== 'live' && (
            <button
              type="button"
              tabIndex={-1}
              data-tv-ignore="true"
              onClick={(e) => {
                e.stopPropagation()
                onInfo(item)
              }}
              className="text-zinc-500 hover:text-white p-0.5 rounded transition shrink-0 opacity-0 group-hover:opacity-100 cursor-pointer"
              title="Mais detalhes"
            >
              <Info size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Botão de Favoritar Rápido no Canto Superior Esquerdo (Apenas Mouse) */}
      <button
        type="button"
        tabIndex={-1}
        data-tv-ignore="true"
        onClick={(e) => {
          e.stopPropagation()
          onToggleFav(item)
        }}
        aria-label="Favoritar"
        className="absolute top-2 left-2 p-1.5 rounded-full bg-black/60 hover:bg-black/90 text-white transition z-20 focus:outline-none cursor-pointer"
        title={fav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
      >
        <Star size={14} className={fav ? 'fill-amber-400 text-amber-400' : 'text-zinc-400'} />
      </button>


      {/* MINI-TELA EXPANDIDA COM TRAILER DE 30s ESTILO NETFLIX (Apenas Desktop / PC com mouse) */}
      {!Capacitor.isNativePlatform() && isExpanded && item.type !== 'live' && (
        <div
          onMouseEnter={() => setIsExpanded(true)}
          onMouseLeave={handleMouseLeave}
          className="absolute -top-10 -left-6 -right-6 z-50 bg-zinc-950 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.95)] border border-white/25 overflow-hidden transform scale-105 sm:scale-110 transition-all duration-200 fade-up"
        >
          {/* Topo: Vídeo do Trailer (ou Capa se o trailer encerrar) */}
          <div className="relative aspect-video w-full bg-zinc-900 overflow-hidden">
            {isPlayingTrailer && trailerKey ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&mute=${
                  isMuted ? 1 : 0
                }&controls=0&disablekb=1&fs=0&iv_load_policy=3&modestbranding=1&rel=0&showinfo=0&loop=1&playlist=${trailerKey}&playsinline=1&enablejsapi=1&vq=hd720`}
                title={item.name}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full w-[125%] h-[125%] pointer-events-none border-0 object-cover"
                allow="autoplay; encrypted-media"
              />
            ) : (
              <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
            )}

            {/* Botão de Volume Global do Trailer */}
            {isPlayingTrailer && trailerKey && (
              <button
                type="button"
                tabIndex={-1}
                data-tv-ignore="true"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleMuted()
                }}
                className="absolute bottom-2.5 right-2.5 p-2 rounded-full bg-black/75 hover:bg-black/90 text-white border border-white/20 transition hover:scale-105 cursor-pointer z-10 shadow-lg"
                title={isMuted ? 'Ativar som (Volume Geral)' : 'Silenciar (Volume Geral)'}
              >
                {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} className="text-rose-400" />}
              </button>
            )}

            {/* Selo BAT TV no topo da minitela */}
            <span className="absolute top-2.5 left-2.5 text-[9px] font-black uppercase bg-black/70 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded shadow">
              BAT TV
            </span>
          </div>

          {/* Conteúdo e Botões estilo Netflix */}
          <div className="p-3.5 space-y-2.5">
            {/* Linha de Botões de Ação */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Play redondo */}
                <button
                  type="button"
                  tabIndex={-1}
                  data-tv-ignore="true"
                  onClick={() => onPlay(item)}
                  className="p-2 rounded-full bg-white hover:bg-zinc-200 text-black shadow-lg transition hover:scale-110 cursor-pointer"
                  title="Assistir Agora"
                >
                  <Play size={16} className="fill-black" />
                </button>

                {/* Adicionar à Lista */}
                <button
                  type="button"
                  tabIndex={-1}
                  data-tv-ignore="true"
                  onClick={() => onToggleFav(item)}
                  className={`p-2 rounded-full border transition hover:scale-110 cursor-pointer ${
                    fav
                      ? 'bg-rose-600 text-white border-rose-500'
                      : 'border-white/30 bg-black/50 text-white hover:border-white'
                  }`}
                  title={fav ? 'Salvo' : 'Adicionar à Lista'}
                >
                  {fav ? <Check size={16} /> : <Plus size={16} />}
                </button>

                {/* Gostei */}
                <button
                  type="button"
                  tabIndex={-1}
                  data-tv-ignore="true"
                  onClick={() => setIsLiked(!isLiked)}
                  className={`p-2 rounded-full border transition hover:scale-110 cursor-pointer ${
                    isLiked
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'border-white/30 bg-black/50 text-white hover:border-white'
                  }`}
                  title="Gostei"
                >
                  <ThumbsUp size={16} className={isLiked ? 'fill-white' : ''} />
                </button>
              </div>

              {/* Botão de Mais Informações (seta para baixo) */}
              {onInfo && (
                <button
                  type="button"
                  tabIndex={-1}
                  data-tv-ignore="true"
                  onClick={() => onInfo(item)}
                  className="p-2 rounded-full border border-white/30 bg-black/50 text-white hover:border-white transition hover:scale-110 cursor-pointer"
                  title="Episódios e Mais Informações"
                >
                  <ChevronDown size={16} />
                </button>
              )}
            </div>


            {/* Metadados: Título e Tags */}
            <div>
              <p className="text-xs font-bold text-white truncate">{item.name}</p>
              <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-semibold pt-1">
                <span className="text-emerald-400 font-bold">98% relevante</span>
                <span className="px-1 border border-zinc-600 rounded text-[9px]">HD</span>
                <span className="uppercase text-[9px] font-bold text-zinc-300">
                  {item.type === 'movies' ? 'Filme' : 'Série'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(MediaCardBase)
