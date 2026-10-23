import { useEffect, useState, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Capacitor } from '@capacitor/core'
import { X, Play, Plus, ThumbsUp, ThumbsDown, Star, Loader2, Check, Film, Tv, ChevronRight, Download, CheckCircle2, AlertCircle } from 'lucide-react'
import {
  getMediaDetails,
  getTvSeasonEpisodes,
  getSimilarRecommendations,
  searchTmdbItem,
  type TmdbDetails,
  type TmdbItem,
  type EpisodeItem,
} from '../services/tmdbService'
import { useAuth } from '../context/AuthContext'
import { usePlayback } from '../context/PlaybackContext'
import { searchTitleInCatalog } from '../services/catalog'
import { useProfiles } from '../context/ProfileContext'
import { useFavorites } from '../context/FavoritesContext'
import { useDownloads } from '../hooks/useDownloads'
import { backgroundKeepAlive } from '../services/backgroundKeepAlive'
import type { MediaItem } from '../types'
import CarouselContainer from './CarouselContainer'
import { cleanTitle, findInCatalog } from '../utils/match'
import { trailerCoordinator } from '../services/trailerCoordinator'

interface Props {
  item: TmdbItem
  onClose: () => void
}

export default function MediaDetailsModal({ item, onClose }: Props) {
  const { service } = useAuth()
  const { play } = usePlayback()
  const { active: activeProfile } = useProfiles()
  const { favorites, toggle } = useFavorites()

  const [currentItem, setCurrentItem] = useState<TmdbItem>(item)
  const [details, setDetails] = useState<TmdbDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSeason, setSelectedSeason] = useState(1)
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([])
  const [loadingEpisodes, setLoadingEpisodes] = useState(false)
  const [activeEpisode, setActiveEpisode] = useState<EpisodeItem | null>(null)
  const [recommendations, setRecommendations] = useState<TmdbItem[]>([])
  const [searchingIptv, setSearchingIptv] = useState(false)
  const [searchFailed, setSearchFailed] = useState(false)
  const [showTrailer, setShowTrailer] = useState(false)

  const { isDownloaded, isDownloading, getStatus, startDownload } = useDownloads()
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [startingDownload, setStartingDownload] = useState(false)

  const closeTrailerBtnRef = useRef<HTMLButtonElement | null>(null)
  const trailerBtnRef = useRef<HTMLButtonElement | null>(null)

  // Interrompe qualquer trailer em segundo plano ao abrir a tela de detalhes
  useEffect(() => {
    trailerCoordinator.stopAll()
    return () => {
      trailerCoordinator.stopAll()
    }
  }, [])

  // Sincroniza se item mudar externamente
  useEffect(() => {
    setCurrentItem(item)
  }, [item])

  const isTv = currentItem.mediaType === 'tv'

  // Sistema de Favoritos / Minha Lista
  const itemMediaKey = currentItem.mediaItem ? currentItem.mediaItem.key : `${isTv ? 'series' : 'movies'}:${currentItem.id}`
  const inWatchlist = useMemo(() => {
    const curTitle = cleanTitle(currentItem.title)
    return favorites.some(
      (f) =>
        f.key === itemMediaKey ||
        f.key === `tmdb:${currentItem.id}` ||
        (currentItem.mediaItem && f.key === currentItem.mediaItem.key) ||
        cleanTitle(f.name) === curTitle
    )
  }, [favorites, itemMediaKey, currentItem.title, currentItem.id, currentItem.mediaItem])

  const handleToggleWatchlist = () => {
    if (currentItem.mediaItem) {
      toggle(currentItem.mediaItem)
      return
    }
    const mediaItem: MediaItem = {
      key: `tmdb:${currentItem.id}`,
      type: isTv ? 'series' : 'movies',
      id: currentItem.id,
      name: currentItem.title,
      image: currentItem.posterPath || currentItem.backdropPath || '',
      rating: String(currentItem.voteAverage),
    }
    toggle(mediaItem)
  }

  // Sistema de Curtidos e Descurtidos por perfil
  const ratingStorageKey = `iptv_ratings_${activeProfile?.id || 'default'}`
  const [ratings, setRatings] = useState<Record<string, 'like' | 'dislike'>>(() => {
    try {
      return JSON.parse(localStorage.getItem(ratingStorageKey) || '{}')
    } catch {
      return {}
    }
  })

  const currentRating = ratings[String(currentItem.id)]

  const handleRate = (type: 'like' | 'dislike') => {
    const nextRating = currentRating === type ? undefined : type
    const updated = { ...ratings }
    if (nextRating) {
      updated[String(currentItem.id)] = nextRating
    } else {
      delete updated[String(currentItem.id)]
    }
    setRatings(updated)
    try {
      localStorage.setItem(ratingStorageKey, JSON.stringify(updated))
    } catch {}
  }

  // Para todos os trailers de fundo ao abrir o modal de Mais Informações
  useEffect(() => {
    trailerCoordinator.stopAll()
    const timer = setTimeout(() => {
      document.getElementById('modal-play-btn')?.focus()
    }, 150)
    return () => clearTimeout(timer)
  }, [currentItem.id])

  // Auto-foco e controle de retorno para o trailer
  useEffect(() => {
    if (showTrailer) {
      const timer = setTimeout(() => {
        closeTrailerBtnRef.current?.focus()
      }, 60)
      return () => clearTimeout(timer)
    } else {
      trailerBtnRef.current?.focus()
    }
  }, [showTrailer])

  // Controle de teclado e controle remoto para fechar o trailer (Escape, Backspace, D-pad, Android Back)
  useEffect(() => {
    if (!showTrailer) return

    const handleTrailerKeyDown = (e: KeyboardEvent) => {
      // Intercepta qualquer tecla de retorno/cancelamento
      if (
        e.key === 'Escape' ||
        e.key === 'Backspace' ||
        e.key === 'GoBack' ||
        e.keyCode === 27 ||
        e.keyCode === 8 ||
        e.keyCode === 10009 ||
        e.keyCode === 4
      ) {
        e.preventDefault()
        e.stopPropagation()
        setShowTrailer(false)
        return
      }

      // Se navegar com setas no trailer, garante que o foco permaneça no botão de fechar (evita ficar preso no iframe)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
        if (document.activeElement !== closeTrailerBtnRef.current) {
          e.preventDefault()
          closeTrailerBtnRef.current?.focus()
        }
      }
    }

    window.addEventListener('keydown', handleTrailerKeyDown, true)
    return () => window.removeEventListener('keydown', handleTrailerKeyDown, true)
  }, [showTrailer])

  // Fecha o modal de detalhes com a tecla Esc (apenas se o trailer não estiver ativo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showTrailer) return
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, showTrailer])

  // Carrega detalhes e recomendações do TMDB para currentItem (com resolução automática por título caso o ID seja do IPTV)
  useEffect(() => {
    let active = true
    setLoading(true)

    async function loadData() {
      let targetId = currentItem.id
      let initialOverview = currentItem.overview

      // Se a sinopse atual estiver vazia ou for mensagem padrão, ou se o ID não for TMDB, busca pelo título no TMDB
      if (!initialOverview || initialOverview.startsWith('Destaque em ') || String(targetId).length < 2) {
        try {
          const tmdbFound = await searchTmdbItem(currentItem.title, currentItem.mediaType)
          if (tmdbFound && active) {
            targetId = tmdbFound.id
            if (tmdbFound.overview) {
              initialOverview = tmdbFound.overview
              setCurrentItem((prev) => ({
                ...prev,
                id: tmdbFound.id,
                overview: tmdbFound.overview,
                posterPath: tmdbFound.posterPath || prev.posterPath,
                backdropPath: tmdbFound.backdropPath || prev.backdropPath,
                releaseDate: tmdbFound.releaseDate || prev.releaseDate,
                voteAverage: tmdbFound.voteAverage || prev.voteAverage,
              }))
            }
          }
        } catch {}
      }

      try {
        const [det, rec] = await Promise.all([
          getMediaDetails(targetId, currentItem.mediaType),
          getSimilarRecommendations(targetId, currentItem.mediaType),
        ])
        if (!active) return
        if (det) {
          setDetails(det)
          if (det.overview && det.overview !== initialOverview) {
            setCurrentItem((prev) => ({ ...prev, overview: det.overview }))
          }
        }
        setRecommendations(rec || [])
      } catch (err) {
        console.warn('Erro ao carregar detalhes TMDB:', err)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadData()

    return () => {
      active = false
    }
  }, [currentItem.title, currentItem.id, currentItem.mediaType])

  // Se for série, carrega episódios da temporada selecionada
  useEffect(() => {
    if (!isTv) return
    let active = true
    setLoadingEpisodes(true)

    getTvSeasonEpisodes(currentItem.id, selectedSeason).then((eps) => {
      if (!active) return
      setEpisodes(eps)
      setActiveEpisode(eps[0] || null)
      setLoadingEpisodes(false)
    })

    return () => {
      active = false
    }
  }, [currentItem.id, isTv, selectedSeason])

  // Busca e reproduz o título na lista IPTV respeitando rigorosamente a temporada e o episódio selecionados
  const handleSearchAndPlay = async (seasonNum?: number, episodeNum?: number) => {
    trailerCoordinator.stopAll()
    if (!service) return

    const sNum = isTv ? (seasonNum ?? selectedSeason) : undefined
    const epNum = isTv ? (episodeNum ?? activeEpisode?.episodeNumber ?? 1) : undefined

    // Se já tiver o item original do IPTV (e não for TMDB não resolvido), reproduz imediatamente com temporada/episódio!
    if (
      currentItem.mediaItem &&
      !currentItem.mediaItem.key.startsWith('tmdb:') &&
      (currentItem.mediaItem.type === 'live' || currentItem.mediaItem.ext)
    ) {
      onClose()
      play(currentItem.mediaItem, {
        seasonNumber: sNum,
        episodeNumber: epNum,
        fromStart: true,
      })
      return
    }

    setSearchingIptv(true)
    setSearchFailed(false)

    try {
      const type = isTv ? 'series' : 'movies'
      const found = await searchTitleInCatalog(service, type, currentItem)

      if (found) {
        onClose()
        play(found, {
          seasonNumber: sNum,
          episodeNumber: epNum,
          fromStart: true,
        })
      } else {
        setSearchFailed(true)
      }
    } catch {
      setSearchFailed(true)
    } finally {
      setSearchingIptv(false)
    }
  }

  const movieDownloadId = `movie_${currentItem.id}`
  const isMovieDownloaded = isDownloaded(movieDownloadId)
  const isMovieDownloading = isDownloading(movieDownloadId)
  const movieStatus = getStatus(movieDownloadId)

  const handleDownloadMovie = async () => {
    if (isMovieDownloaded || isMovieDownloading || startingDownload) return
    if (!service) return
    // Ativa imediatamente dentro do gesto do usuário no iOS Safari / PWA
    backgroundKeepAlive.acquire()
    setStartingDownload(true)
    setDownloadError(null)

    try {
      let targetItem = currentItem.mediaItem
      if (!targetItem) {
        targetItem = await searchTitleInCatalog(service, 'movies', currentItem)
      }

      if (!targetItem) {
        setDownloadError('Título não localizado no servidor IPTV.')
        return
      }

      const preferredExt = (!Capacitor.isNativePlatform() && !window.electronAPI) ? 'mp4' : (targetItem.ext || 'mp4')
      const remoteUrl = service.vodUrl(targetItem.id, preferredExt)
      const res = await startDownload({
        id: movieDownloadId,
        mediaType: 'movie',
        title: currentItem.title,
        posterUrl: currentItem.posterPath || currentItem.backdropPath || '',
        remoteUrl,
        duration: (details?.runtime || 0) * 60,
      })

      if (!res.success && res.error) {
        setDownloadError(res.error)
      }
    } catch (err: any) {
      setDownloadError(err?.message || 'Erro ao iniciar download')
    } finally {
      setStartingDownload(false)
    }
  }

  const getEpisodeDownloadId = (epNum: number) => `series_${currentItem.id}_s${selectedSeason}_e${epNum}`

  const handleDownloadEpisode = async (ep: EpisodeItem) => {
    if (!service) return
    const epId = getEpisodeDownloadId(ep.episodeNumber)
    if (isDownloaded(epId) || isDownloading(epId)) return
    // Ativa imediatamente dentro do gesto do usuário no iOS Safari / PWA
    backgroundKeepAlive.acquire()

    try {
      let targetItem = currentItem.mediaItem
      if (!targetItem) {
        targetItem = await searchTitleInCatalog(service, 'series', currentItem)
      }
      if (!targetItem) {
        alert('Série não localizada no catálogo IPTV.')
        return
      }

      const seriesInfo = await service.getSeriesInfo(targetItem.id)
      const seasonKeys = Object.keys(seriesInfo.episodes || {})
      const sKey =
        seasonKeys.find((k) => (parseInt(k.replace(/\D/g, ''), 10) || 0) === selectedSeason) ||
        seasonKeys[0]
      const rawEps = seriesInfo.episodes[sKey] || []
      const rawEp =
        rawEps.find((e: any) => Number(e.episode_num) === ep.episodeNumber) ||
        rawEps[ep.episodeNumber - 1]

      if (!rawEp) {
        alert(`Episódio ${ep.episodeNumber} não localizado no provedor IPTV.`)
        return
      }

      const preferredExt = (!Capacitor.isNativePlatform() && !window.electronAPI) ? 'mp4' : (rawEp.container_extension || 'mp4')
      const remoteUrl = service.episodeUrl(String(rawEp.id), preferredExt)
      await startDownload({
        id: epId,
        mediaType: 'series',
        title: currentItem.title,
        subtitle: `T${selectedSeason}: E${ep.episodeNumber} - ${ep.name}`,
        seriesName: currentItem.title,
        seasonNumber: selectedSeason,
        episodeNumber: ep.episodeNumber,
        posterUrl: ep.stillPath || currentItem.backdropPath || currentItem.posterPath || '',
        remoteUrl,
        duration: (ep.runtime || 0) * 60,
      })
    } catch (err: any) {
      alert(err?.message || 'Falha ao baixar episódio.')
    }
  }

  const castNames = useMemo(() => {
    return (details?.cast || []).map((c) => c.name).join(', ')
  }, [details?.cast])

  return createPortal(
    <div
      data-tv-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 pt-[max(env(safe-area-inset-top),1.25rem)] pb-[max(env(safe-area-inset-bottom),1.25rem)] fade-up select-none overflow-x-hidden"
    >
      <div className="bg-zinc-950 border border-white/10 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative text-zinc-100 overscroll-contain">
        {/* Botão de Fechar Proeminente */}
        <button
          onClick={onClose}
          className="absolute top-10 right-5 sm:top-7 sm:right-7 z-50 p-3 rounded-full bg-black/90 hover:bg-rose-600 text-white border border-white/30 transition shadow-2xl cursor-pointer focus:ring-4 focus:ring-rose-500 focus:outline-none touch-manipulation active:scale-95"
          title="Fechar detalhes (Esc)"
          aria-label="Fechar"
        >
          <X size={20} />
        </button>

        <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar pb-12 w-full max-w-full">
          {/* 1. Hero Backdrop no Padrão Amazon Prime Video TV / Mobile Netflix */}
          <div className="relative w-full min-h-[400px] sm:min-h-[460px] lg:min-h-[480px] flex flex-col justify-end p-5 sm:p-10 pt-16 bg-zinc-950 overflow-hidden">
            {currentItem.backdropPath || currentItem.posterPath ? (
              <img
                src={currentItem.backdropPath || currentItem.posterPath || ''}
                alt={currentItem.title}
                className="absolute inset-0 w-full h-full object-cover object-center filter brightness-90"
              />
            ) : (
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-950 via-zinc-900 to-black" />
            )}
            {/* Gradientes Suaves */}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-black/40 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/90 via-zinc-950/40 to-transparent pointer-events-none" />

            {/* Conteúdo do Topo estilo Prime Video TV */}
            <div className="relative z-10 flex flex-col justify-end space-y-3 sm:space-y-4">
              {/* Selo Prime Video / IPTV */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-widest text-sky-400 bg-sky-950/60 border border-sky-400/30 px-2 py-0.5 rounded">
                  IPTV Rea
                </span>
                <span className="px-2 py-0.5 rounded bg-white/10 text-white text-[10px] font-bold uppercase tracking-wider">
                  {isTv ? 'SÉRIE' : 'FILME'}
                </span>
                {isTv && (
                  <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
                    📣 Todos os episódios disponíveis
                  </span>
                )}
              </div>

              {/* Título Principal em Tipografia Grande */}
              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase leading-none drop-shadow-lg">
                {currentItem.title}
              </h1>

              {/* Botões de Ação estilo TV com Foco Nítido */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  id="modal-play-btn"
                  tabIndex={0}
                  onClick={() => handleSearchAndPlay(selectedSeason, activeEpisode?.episodeNumber || 1)}
                  disabled={searchingIptv}
                  className="flex items-center gap-2.5 px-6 py-3 rounded-full bg-white text-zinc-950 hover:bg-zinc-200 font-extrabold text-sm shadow-xl hover:scale-105 active:scale-95 focus:scale-105 focus:ring-4 focus:ring-rose-500 focus:outline-none transition cursor-pointer"
                >
                  {searchingIptv ? (
                    <Loader2 size={18} className="animate-spin text-zinc-900" />
                  ) : (
                    <Play size={18} className="fill-zinc-950" />
                  )}
                  <span>
                    {isTv ? `Reproduzir T${selectedSeason} E${activeEpisode?.episodeNumber || 1}` : 'Assistir Agora'}
                  </span>
                </button>

                <button
                  tabIndex={0}
                  onClick={handleToggleWatchlist}
                  className={`p-3 rounded-full border transition cursor-pointer hover:scale-105 focus:scale-105 focus:ring-4 focus:ring-rose-500 focus:outline-none ${
                    inWatchlist
                      ? 'bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-950/60'
                      : 'bg-black/60 text-white border-white/20 hover:bg-white/10'
                  }`}
                  title={inWatchlist ? 'Salvo nos favoritos do seu perfil' : 'Adicionar aos Favoritos'}
                >
                  {inWatchlist ? <Check size={18} /> : <Plus size={18} />}
                </button>

                <button
                  tabIndex={0}
                  onClick={() => handleRate('like')}
                  className={`p-3 rounded-full border transition cursor-pointer hover:scale-105 focus:scale-105 focus:ring-4 focus:ring-rose-500 focus:outline-none ${
                    currentRating === 'like'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-950/60'
                      : 'bg-black/60 text-white border-white/20 hover:bg-white/10'
                  }`}
                  title="Gostei (Curtiu)"
                >
                  <ThumbsUp size={18} className={currentRating === 'like' ? 'fill-white' : ''} />
                </button>

                <button
                  tabIndex={0}
                  onClick={() => handleRate('dislike')}
                  className={`p-3 rounded-full border transition cursor-pointer hover:scale-105 focus:scale-105 focus:ring-4 focus:ring-rose-500 focus:outline-none ${
                    currentRating === 'dislike'
                      ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-950/60'
                      : 'bg-black/60 text-white border-white/20 hover:bg-white/10'
                  }`}
                  title="Não é para mim (Descurtiu)"
                >
                  <ThumbsDown size={18} className={currentRating === 'dislike' ? 'fill-white' : ''} />
                </button>

                {/* Botão de Trailer Oficial do YouTube */}
                {details?.trailerKey && (
                  <button
                    ref={trailerBtnRef}
                    tabIndex={0}
                    onClick={() => setShowTrailer(true)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-red-600/90 hover:bg-red-600 text-white font-bold text-xs shadow-lg transition hover:scale-105 focus:scale-105 focus:ring-4 focus:ring-rose-500 focus:outline-none cursor-pointer"
                  >
                    <Film size={14} />
                    <span>Ver Trailer</span>
                  </button>
                )}

                {/* Botão de Download para Filmes */}
                {!isTv && (
                  <button
                    tabIndex={0}
                    onClick={handleDownloadMovie}
                    disabled={isMovieDownloading || isMovieDownloaded || startingDownload}
                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full border transition cursor-pointer hover:scale-105 focus:scale-105 focus:ring-4 focus:ring-rose-500 focus:outline-none text-xs font-bold ${
                      isMovieDownloaded
                        ? 'bg-emerald-600/30 text-emerald-400 border-emerald-500/40'
                        : isMovieDownloading || startingDownload
                        ? 'bg-rose-950/60 text-rose-300 border-rose-500/50'
                        : 'bg-black/60 text-white border-white/20 hover:bg-white/10'
                    }`}
                    title={
                      isMovieDownloaded
                        ? 'Filme baixado para assistir offline'
                        : isMovieDownloading
                        ? `Baixando... (${movieStatus?.progress || 0}%)`
                        : 'Baixar filme para assistir offline'
                    }
                  >
                    {isMovieDownloaded ? (
                      <>
                        <CheckCircle2 size={15} className="text-emerald-400" />
                        <span>Baixado</span>
                      </>
                    ) : isMovieDownloading || startingDownload ? (
                      <>
                        <Loader2 size={15} className="animate-spin text-rose-400" />
                        <span>Baixando ({movieStatus?.progress || 0}%)</span>
                      </>
                    ) : (
                      <>
                        <Download size={15} />
                        <span>Baixar Filme</span>
                      </>
                    )}
                  </button>
                )}

                {downloadError && (
                  <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-950/80 px-3 py-1.5 rounded-full border border-rose-800">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{downloadError}</span>
                  </div>
                )}

                {searchFailed && (
                  <span className="text-xs text-rose-400 font-semibold bg-rose-950/60 px-3 py-1.5 rounded-full border border-rose-800">
                    Título não localizado no catálogo atual
                  </span>
                )}
              </div>

              {/* Informações Rápidas e Tags de Áudio / Vídeo */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-300 font-medium">
                {details?.genres && <span>{details.genres.join(' • ')}</span>}
                <span>•</span>
                <div className="flex items-center gap-1 text-amber-400 font-bold">
                  <Star size={13} className="fill-amber-400" />
                  <span>IMDb {currentItem.voteAverage}/10</span>
                </div>
                <span>•</span>
                {currentItem.releaseDate && <span>{currentItem.releaseDate.split('-')[0]}</span>}
                {isTv && details?.numberOfSeasons && (
                  <>
                    <span>•</span>
                    <span>{details.numberOfSeasons} temporada(s)</span>
                  </>
                )}
              </div>

              {/* Tags Técnicas de Qualidade estilo Prime Video TV */}
              <div className="flex items-center gap-1.5 pt-1">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-zinc-800 text-zinc-300 border border-zinc-700">
                  A16
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-zinc-800 text-zinc-300 border border-zinc-700">
                  CC
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-zinc-800 text-zinc-300 border border-zinc-700">
                  AD
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-zinc-800 text-zinc-300 border border-zinc-700">
                  5.1
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-zinc-800 text-zinc-300 border border-zinc-700">
                  UHD
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-zinc-800 text-zinc-300 border border-zinc-700">
                  HDR
                </span>
              </div>

              {/* Sinopse Principal */}
              <p className="text-xs sm:text-sm text-zinc-300 max-w-3xl leading-relaxed line-clamp-3">
                {details?.overview || currentItem.overview || 'Sinopse não disponível no momento.'}
              </p>

              {/* Elenco */}
              {castNames && (
                <p className="text-xs text-zinc-400">
                  <span className="font-bold text-zinc-300">Elenco: </span>
                  {castNames}
                </p>
              )}
            </div>
          </div>

          {/* 2. Se for Série: Seletor de Temporadas e Cards de Episódios em Formato Horizontal 16:9 */}
          {isTv && (
            <div className="px-6 sm:px-10 mt-8 space-y-6 w-full max-w-full overflow-hidden">
              {/* Seletor de Temporadas */}
              <div className="flex items-center gap-2 border-b border-white/10 pb-4 overflow-x-auto no-scrollbar touch-pan-x">
                {(details?.seasons || [{ seasonNumber: 1, name: 'Temporada 1', episodeCount: 8 }]).map((s) => (
                  <button
                    key={s.seasonNumber}
                    tabIndex={0}
                    onClick={() => setSelectedSeason(s.seasonNumber)}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer focus:ring-4 focus:ring-rose-500 focus:outline-none ${
                      selectedSeason === s.seasonNumber
                        ? 'bg-white/20 text-white border border-white/20 backdrop-blur-md'
                        : 'text-zinc-400 hover:text-white hover:bg-white/5 focus:bg-white/20 focus:text-white'
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>

              {/* Informações do Episódio Ativo Selecionado */}
              {activeEpisode && (
                <div className="space-y-2 bg-white/5 p-4 rounded-2xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-white">
                      {activeEpisode.episodeNumber}. {activeEpisode.name}
                    </h3>
                    <p className="text-xs text-zinc-300 max-w-2xl leading-relaxed">
                      {activeEpisode.overview || 'Sem sinopse disponível para este episódio.'}
                    </p>
                  </div>
                  {/* Botões de Ação do Episódio Selecionado */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      tabIndex={0}
                      onClick={() => handleSearchAndPlay(selectedSeason, activeEpisode.episodeNumber)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition cursor-pointer focus:outline-none focus:ring-4 focus:ring-rose-500"
                    >
                      <Play size={14} className="fill-black" />
                      <span>Assistir Ep. {activeEpisode.episodeNumber}</span>
                    </button>

                    {(() => {
                      const activeEpDownloadId = getEpisodeDownloadId(activeEpisode.episodeNumber)
                      const isActDownloaded = isDownloaded(activeEpDownloadId)
                      const isActDownloading = isDownloading(activeEpDownloadId)
                      const actStatus = getStatus(activeEpDownloadId)
                      return (
                        <button
                          type="button"
                          tabIndex={0}
                          onClick={() => handleDownloadEpisode(activeEpisode)}
                          disabled={isActDownloaded || isActDownloading}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer focus:outline-none focus:ring-4 focus:ring-rose-500 ${
                            isActDownloaded
                              ? 'bg-emerald-600/30 text-emerald-400 border-emerald-500/40'
                              : isActDownloading
                              ? 'bg-rose-950/60 text-rose-300 border-rose-500/50'
                              : 'bg-black/60 text-white border-white/20 hover:bg-white/10'
                          }`}
                        >
                          {isActDownloaded ? (
                            <>
                              <CheckCircle2 size={14} className="text-emerald-400" />
                              <span>Baixado</span>
                            </>
                          ) : isActDownloading ? (
                            <>
                              <Loader2 size={14} className="animate-spin text-rose-400" />
                              <span>Baixando ({actStatus?.progress || 0}%)</span>
                            </>
                          ) : (
                            <>
                              <Download size={14} />
                              <span>Baixar Ep.</span>
                            </>
                          )}
                        </button>
                      )
                    })()}
                  </div>
                </div>
              )}

              {/* Carrossel dos Episódios em 16:9 Landscape com Botão Baixar Abaixo */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-zinc-200">Episódios</h4>
                {loadingEpisodes ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="animate-spin text-rose-500" size={24} />
                  </div>
                ) : (
                  <CarouselContainer className="gap-4 pb-2">
                    {episodes.map((ep) => {
                      const isSelected = activeEpisode?.id === ep.id
                      const epDownloadId = getEpisodeDownloadId(ep.episodeNumber)
                      const isEpDownloaded = isDownloaded(epDownloadId)
                      const isEpDownloading = isDownloading(epDownloadId)

                      return (
                        <div
                          key={ep.id}
                          className="shrink-0 w-[240px] sm:w-[280px] flex flex-col space-y-2 group"
                        >
                          {/* 1. Card do Episódio (Navegável com Esquerda / Direita, Enter para assistir) */}
                          <button
                            type="button"
                            tabIndex={0}
                            data-tv-episode="true"
                            onClick={() => {
                              setActiveEpisode(ep)
                              handleSearchAndPlay(selectedSeason, ep.episodeNumber)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                setActiveEpisode(ep)
                                handleSearchAndPlay(selectedSeason, ep.episodeNumber)
                              }
                            }}
                            className={`relative aspect-video rounded-xl overflow-hidden bg-zinc-900 border transition-all duration-300 text-left cursor-pointer focus:outline-none ${
                              isSelected
                                ? 'border-white ring-2 ring-white/50 scale-[1.03]'
                                : 'border-white/10 group-hover:border-rose-500 group-hover:scale-[1.02] group-focus:border-white group-focus:ring-4 group-focus:ring-rose-500 group-focus:scale-[1.03]'
                            }`}
                          >
                            {ep.stillPath ? (
                              <img
                                src={ep.stillPath}
                                alt={ep.name}
                                className="w-full h-full object-cover filter brightness-90 group-hover:brightness-100 group-focus:brightness-100 transition"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-xs text-zinc-500 font-bold">
                                Ep. {ep.episodeNumber}
                              </div>
                            )}

                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                            {/* Badge sutil de baixado sobre a imagem */}
                            {isEpDownloaded && (
                              <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-600/90 text-white flex items-center gap-1 text-[10px] font-bold shadow-md">
                                <CheckCircle2 size={10} />
                                Baixado
                              </div>
                            )}

                            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                              <span className="text-xs font-bold text-white flex items-center gap-1">
                                <Play size={10} className="fill-white" /> T{selectedSeason} Ep.{ep.episodeNumber}
                              </span>
                              {ep.runtime && (
                                <span className="text-[10px] text-zinc-400">{ep.runtime} min</span>
                              )}
                            </div>
                          </button>

                          {/* 2. Título e Botão de Download ABAIXO do card (Navegável com Seta para Baixo) */}
                          <div className="flex flex-col space-y-1.5 px-0.5">
                            <p
                              className="text-xs font-bold text-zinc-300 truncate"
                              title={`${ep.episodeNumber}. ${ep.name}`}
                            >
                              {ep.episodeNumber}. {ep.name}
                            </p>

                            {(() => {
                              const isEpDownloaded = isDownloaded(epDownloadId)
                              const isEpDownloading = isDownloading(epDownloadId)
                              const epStatus = getStatus(epDownloadId)
                              return (
                                <button
                                  type="button"
                                  tabIndex={0}
                                  data-tv-episode-download="true"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDownloadEpisode(ep)
                                  }}
                                  disabled={isEpDownloaded || isEpDownloading}
                                  className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold border transition cursor-pointer focus:outline-none focus:ring-4 focus:ring-rose-500 ${
                                    isEpDownloaded
                                      ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30'
                                      : isEpDownloading
                                      ? 'bg-rose-950/60 text-rose-300 border-rose-500/50'
                                      : 'bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white border-white/10'
                                  }`}
                                  title={
                                    isEpDownloaded
                                      ? 'Episódio já baixado'
                                      : isEpDownloading
                                      ? `Baixando episódio (${epStatus?.progress || 0}%)...`
                                      : `Baixar Episódio ${ep.episodeNumber}`
                                  }
                                >
                                  {isEpDownloaded ? (
                                    <>
                                      <CheckCircle2 size={13} className="text-emerald-400" />
                                      <span>Baixado</span>
                                    </>
                                  ) : isEpDownloading ? (
                                    <>
                                      <Loader2 size={13} className="animate-spin text-rose-400" />
                                      <span>Baixando ({epStatus?.progress || 0}%)</span>
                                    </>
                                  ) : (
                                    <>
                                      <Download size={13} />
                                      <span>Baixar Ep. {ep.episodeNumber}</span>
                                    </>
                                  )}
                                </button>
                              )
                            })()}
                          </div>
                        </div>
                      )
                    })}
                  </CarouselContainer>
                )}
              </div>
            </div>
          )}

          {/* 3. Recomendações: "Os clientes também assistiram" (Cards 16:9 estilo Screenshot 2) */}
          {recommendations.length > 0 && (
            <div className="px-6 sm:px-10 mt-10 space-y-4 w-full max-w-full overflow-hidden">
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Os clientes também assistiram
                </h3>
              </div>
              <CarouselContainer className="gap-4 pb-2">
                {recommendations.map((rec, i) => (
                  <button
                    type="button"
                    key={rec.id}
                    tabIndex={0}
                    data-tv-recommendation="true"
                    onClick={() => {
                      setCurrentItem(rec)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setCurrentItem(rec)
                      }
                    }}
                    className="shrink-0 w-[220px] sm:w-[260px] group cursor-pointer text-left focus:outline-none"
                  >
                    <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-900 border border-white/10 group-hover:border-rose-500 group-hover:scale-[1.03] group-focus:border-white group-focus:ring-4 group-focus:ring-rose-500 group-focus:scale-[1.03] transition-all duration-300">
                      {rec.backdropPath || rec.posterPath ? (
                        <img
                          src={rec.backdropPath || rec.posterPath || ''}
                          alt={rec.title}
                          className="w-full h-full object-cover filter brightness-90 group-hover:brightness-100 group-focus:brightness-100 transition"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full bg-zinc-800" />
                      )}

                      {/* Badges de estilo Prime */}
                      <div className="absolute top-2 right-2">
                        <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase bg-rose-600 text-white">
                          {i % 2 === 0 ? 'EM ALTA' : 'TOP 10'}
                        </span>
                      </div>

                      <div className="absolute bottom-2 right-2">
                        <span className="text-[9px] font-black uppercase text-zinc-300 bg-black/60 px-1.5 py-0.5 rounded border border-white/10">
                          IPTV
                        </span>
                      </div>
                    </div>
                    <p className="mt-1.5 text-xs font-semibold text-zinc-300 group-hover:text-white group-focus:text-white group-focus:underline truncate">
                      {rec.title}
                    </p>
                  </button>
                ))}
              </CarouselContainer>
            </div>
          )}
        </div>
      </div>

      {/* Overlay com Player do YouTube para o Trailer Oficial com Navegação TV Completa */}
      {showTrailer && details?.trailerKey && (
        <div
          data-tv-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowTrailer(false)
          }}
          className="fixed inset-0 z-[120] bg-black/95 flex flex-col items-center justify-center p-3 sm:p-6 fade-up"
        >
          {/* Barra superior de controle do Trailer amigável para controle remoto e teclado */}
          <div className="w-full max-w-4xl flex items-center justify-between mb-3 px-2">
            <span className="text-sm font-bold text-zinc-300 truncate pr-4">
              Trailer Oficial · {currentItem.title}
            </span>
            <button
              ref={closeTrailerBtnRef}
              id="close-trailer-btn"
              tabIndex={0}
              autoFocus
              onClick={() => setShowTrailer(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setShowTrailer(false)
                }
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-black text-xs sm:text-sm shadow-2xl transition cursor-pointer ring-2 ring-white/50 focus:ring-4 focus:ring-white focus:outline-none"
              title="Fechar Trailer (ESC / Voltar)"
              aria-label="Fechar Trailer"
            >
              <X size={18} />
              <span>Fechar Trailer (Voltar)</span>
            </button>
          </div>

          <div className="relative w-full max-w-4xl aspect-video rounded-2xl sm:rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${details.trailerKey}?autoplay=1&rel=0&modestbranding=1&vq=hd720`}
              title={`Trailer de ${currentItem.title}`}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}

    </div>,
    document.body
  )
}
