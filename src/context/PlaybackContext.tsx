import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Capacitor } from '@capacitor/core'
import Player from '../components/Player'
import PwaPlayer from '../components/PwaPlayer'
import ErrorBoundary from '../components/ErrorBoundary'
import { useAuth } from './AuthContext'
import { useProfiles } from './ProfileContext'
import type { MediaItem } from '../types'
import type { HistoryEntry } from '../services/profileDb'
import { trailerCoordinator } from '../services/trailerCoordinator'
import { searchTitleInCatalog } from '../services/catalog'
import { buildSportsPlaylist } from '../utils/sportsPlaylist'

interface PlayOpts {
  /** Lista usada na troca rápida de canais (ao vivo) */
  playlist?: MediaItem[]
  /** Metadados do jogo/campeonato para alerta de gols simultâneos */
  matchContext?: {
    leagueId?: string
    matchId?: string
    leagueName?: string
  }
  /** Ignora o ponto de retomada salvo */
  fromStart?: boolean
  /** Temporada alvo específica (para séries) */
  seasonNumber?: number
  /** Número do episódio alvo específico (para séries) */
  episodeNumber?: number
  /** ID do episódio específico (se já conhecido) */
  episodeId?: string
}

interface Current {
  item: MediaItem
  url: string
  title: string
  isLive: boolean
  startAt: number
  episode?: HistoryEntry['episode']
  allEpisodes?: Array<{ id: string; ext: string; title: string }>
  matchContext?: {
    leagueId?: string
    matchId?: string
    leagueName?: string
  }
}

interface PlaybackValue {
  play: (item: MediaItem, opts?: PlayOpts) => Promise<void>
  playLocalMedia: (opts: { id: string; title: string; url: string; poster?: string }) => void
  error: string
}

const Ctx = createContext<PlaybackValue | null>(null)

/** Dono do Player: qualquer tela (Home, Navegar, Favoritos) pode tocar um item. */
export function PlaybackProvider({ children }: { children: ReactNode }) {
  const { service } = useAuth()
  const { active, upsertHistory } = useProfiles()
  const [current, setCurrent] = useState<Current | null>(null)
  const [openingMediaTitle, setOpeningMediaTitle] = useState<string | null>(null)
  const [playlist, setPlaylist] = useState<MediaItem[]>([])
  const [error, setError] = useState('')
  const historyRef = useRef(active?.history ?? [])
  historyRef.current = active?.history ?? []

  // Detecta se está rodando no PWA instalado (Standalone / Tela de Início no iPhone ou Android móvel).
  // No Fire Stick / Android TV / Capacitor nativo ou Electron, NUNCA usa o PwaPlayer.
  const isPwa = useMemo(() => {
    if (typeof window === 'undefined') return false
    if (Capacitor.isNativePlatform()) return false
    if (window.__IS_ANDROID_TV__ === true) return false
    return (
      (window.navigator as any).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches
    )
  }, [])

  // Garante que nenhum trailer toque no fundo enquanto o player estiver aberto
  useEffect(() => {
    if (current) {
      trailerCoordinator.stopAll()
    }
  }, [current])

  const play = useCallback(async (item: MediaItem, opts: PlayOpts = {}) => {
    trailerCoordinator.stopAll()
    if (!service) return
    setError('')
    setOpeningMediaTitle(item.name)
    const saved = historyRef.current.find((h) => h.key === item.key)
    const resumable = !opts.fromStart && saved && saved.duration > 0 &&
      saved.position / saved.duration > 0.02 && saved.position / saved.duration < 0.95
    const startAt = resumable ? saved.position : 0

    let activeItem = item

    // Se o item veio do TMDB ou foi salvo na Minha Lista sem ID/extensão real do IPTV, resolve no catálogo
    const needsCatalogLookup =
      activeItem.key.startsWith('tmdb:') ||
      (activeItem.type === 'movies' && !activeItem.ext) ||
      (activeItem.type === 'series' && activeItem.key.startsWith('tmdb:'))

    if (needsCatalogLookup && (activeItem.type === 'movies' || activeItem.type === 'series')) {
      setOpeningMediaTitle(`Localizando "${activeItem.name}" no servidor...`)
      try {
        const found = await searchTitleInCatalog(service, activeItem.type, { title: activeItem.name })
        if (found) {
          activeItem = found
        } else if (item.key.startsWith('tmdb:')) {
          setError(`"${item.name}" não foi encontrado no seu servidor IPTV.`)
          setOpeningMediaTitle(null)
          return
        }
      } catch (err) {
        console.warn('Erro ao resolver item no catálogo:', err)
      }
    }

    if (activeItem.type === 'live') {
      const isYoutube = activeItem.key?.startsWith('youtube:') || (activeItem as any).url?.includes('youtube')
      const targetUrl = isYoutube
        ? ((activeItem as any).url || 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCZiYbVptd3PVPf4f6eR6UaQ&autoplay=1')
        : service.liveUrl(activeItem.id, 'm3u8')
      setPlaylist(opts.playlist ?? [])
      upsertHistory({ ...activeItem, position: 0, duration: 0, updatedAt: Date.now() })
      setCurrent({
        item: activeItem,
        url: targetUrl,
        title: activeItem.name,
        isLive: true,
        startAt: 0,
        matchContext: opts.matchContext,
      })
      setOpeningMediaTitle(null)
      return
    }
    if (activeItem.type === 'movies') {
      const preferredExt = Capacitor.isNativePlatform() ? (activeItem.ext || 'mp4') : 'mp4'
      setCurrent({ item: activeItem, url: service.vodUrl(activeItem.id, preferredExt), title: activeItem.name, isLive: false, startAt })
      setOpeningMediaTitle(null)
      return
    }
    try {
      let info = await service.getSeriesInfo(activeItem.id)

      // Fallback: se info de episódios veio vazia, tenta buscar pelo nome para recuperar o stream_id correto
      if (!info?.episodes || Object.keys(info.episodes).length === 0) {
        const foundSeries = await searchTitleInCatalog(service, 'series', { title: activeItem.name })
        if (foundSeries && foundSeries.id !== activeItem.id) {
          activeItem = foundSeries
          info = await service.getSeriesInfo(foundSeries.id)
        }
      }

      // 1. Ordena temporadas numericamente (Temporada 1, 2, 3...)
      const seasonKeys = Object.keys(info?.episodes || {}).sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, ''), 10) || 0
        const numB = parseInt(b.replace(/\D/g, ''), 10) || 0
        return numA - numB
      })

      const allEpisodes: Array<{
        id: string
        ext: string
        title: string
        seasonNum: number
        episodeNum: number
      }> = []

      seasonKeys.forEach((sKey) => {
        const sNum = parseInt(sKey.replace(/\D/g, ''), 10) || 1
        const epList = info.episodes[sKey] || []
        const sortedEps = [...epList].sort((a, b) => (Number(a.episode_num) || 0) - (Number(b.episode_num) || 0))
        sortedEps.forEach((ep) => {
          allEpisodes.push({
            id: String(ep.id),
            ext: ep.container_extension || 'mp4',
            title: ep.title || `T${sNum} E${ep.episode_num}`,
            seasonNum: ep.season ? Number(ep.season) : sNum,
            episodeNum: Number(ep.episode_num) || 1,
          })
        })
      })

      let episode: (typeof allEpisodes)[0] | undefined

      // Se foi solicitado um ID específico
      if (opts.episodeId) {
        episode = allEpisodes.find((e) => String(e.id) === String(opts.episodeId))
      }

      // Se foi solicitada temporada ou número de episódio específico
      if (!episode && (opts.seasonNumber != null || opts.episodeNumber != null)) {
        const targetSeason = opts.seasonNumber ?? 1
        const targetEpisode = opts.episodeNumber ?? 1

        // 1º: Procura match exato por Temporada + Episódio
        episode = allEpisodes.find(
          (e) => e.seasonNum === targetSeason && e.episodeNum === targetEpisode
        )

        // 2º: Procura na chave de temporada da API
        if (!episode) {
          const sKey = seasonKeys.find((k) => (parseInt(k.replace(/\D/g, ''), 10) || 0) === targetSeason)
          if (sKey && info.episodes[sKey]) {
            const rawEp =
              info.episodes[sKey].find((e) => Number(e.episode_num) === targetEpisode) ||
              info.episodes[sKey][targetEpisode - 1]
            if (rawEp) {
              episode = allEpisodes.find((e) => String(e.id) === String(rawEp.id))
            }
          }
        }

        // 3º: Se a série só tem 1 temporada no provedor, busca pelo número do episódio
        if (!episode) {
          episode = allEpisodes.find((e) => e.episodeNum === targetEpisode)
        }
      }

      // Se o usuário não clicou num episódio específico, retoma o do histórico ou vai para o 1º
      if (!episode) {
        const savedEp = saved?.episode
        if (savedEp && allEpisodes.some((e) => String(e.id) === String(savedEp.id))) {
          episode = allEpisodes.find((e) => String(e.id) === String(savedEp.id))
        } else {
          episode = allEpisodes[0]
        }
      }

      if (!episode) {
        setError('Nenhum episódio disponível.')
        return
      }

      // Se for o mesmo episódio salvo no histórico, retoma do ponto. Se mudou de episódio, começa do zero!
      const isSameEpisode = saved?.episode && String(saved.episode.id) === String(episode.id)
      const isResumable = !opts.fromStart && isSameEpisode && saved && saved.duration > 0 &&
        saved.position / saved.duration > 0.02 && saved.position / saved.duration < 0.95
      const episodeStartAt = isResumable ? saved.position : 0

      const preferredExt = Capacitor.isNativePlatform() ? (episode.ext || 'mp4') : 'mp4'
      setCurrent({
        item: activeItem,
        episode: { id: episode.id, ext: preferredExt, title: episode.title },
        startAt: episodeStartAt,
        allEpisodes: allEpisodes.map((e) => ({ id: e.id, ext: e.ext, title: e.title })),
        url: service.episodeUrl(episode.id, preferredExt),
        title: `${activeItem.name} - ${episode.title}`,
        isLive: false,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar série')
    } finally {
      setOpeningMediaTitle(null)
    }
  }, [service, upsertHistory])

  // Próximo episódio da série
  const playNextEpisode = useCallback(() => {
    if (!service || !current?.allEpisodes || !current.episode) return
    const curIdx = current.allEpisodes.findIndex((e) => String(e.id) === String(current.episode?.id))
    if (curIdx >= 0 && curIdx < current.allEpisodes.length - 1) {
      const nextEp = current.allEpisodes[curIdx + 1]
      const preferredExt = Capacitor.isNativePlatform() ? (nextEp.ext || 'mp4') : 'mp4'
      setCurrent({
        ...current,
        episode: nextEp,
        startAt: 0,
        url: service.episodeUrl(nextEp.id, preferredExt),
        title: `${current.item.name} - ${nextEp.title}`,
      })
    }
  }, [current, service])

  const nextEpisodeTitle = useMemo(() => {
    if (!current?.allEpisodes || !current.episode) return undefined
    const curIdx = current.allEpisodes.findIndex((e) => String(e.id) === String(current.episode?.id))
    if (curIdx >= 0 && curIdx < current.allEpisodes.length - 1) {
      return current.allEpisodes[curIdx + 1].title
    }
    return undefined
  }, [current])

  // troca rápida de canais (percorre a lista de canais ao vivo de onde o usuário veio)
  const live = useMemo(() => playlist.filter((i) => i.type === 'live'), [playlist])
  const zap = useCallback((delta: number) => {
    if (!current?.isLive || live.length === 0) return
    const idx = live.findIndex((i) => i.key === current.item.key)
    const next = live[(idx + delta + live.length) % live.length]
    if (next) play(next, { playlist })
  }, [current, live, play, playlist])
  const zapPrev = useCallback(() => zap(-1), [zap])
  const zapNext = useCallback(() => zap(1), [zap])

  const channelLabel = useMemo(() => {
    if (!current?.isLive) return undefined
    const idx = live.findIndex((i) => i.key === current.item.key)
    return idx >= 0 ? `${idx + 1} · ${current.item.name}` : current.item.name
  }, [current, live])

  const item = current?.item
  const episode = current?.episode
  const onProgress = useCallback((position: number, duration: number) => {
    if (!item || !duration || !isFinite(duration)) return
    try {
      upsertHistory({
        ...item,
        image: item.image?.startsWith('data:') ? '' : (item.image || ''),
        position,
        duration,
        updatedAt: Date.now(),
        episode,
      })
    } catch (err) {
      console.warn('Erro ao salvar histórico de reprodução:', err)
    }
  }, [item, episode, upsertHistory])

  // Agrupamento de qualidades (FHD, HD, SD, 4K) do mesmo canal ao vivo
  const channelVariants = useMemo(() => {
    if (!current?.isLive || playlist.length === 0) return []
    const cleanChannelName = (name: string) =>
      name
        .replace(/\b(4k|fhd|hd|sd|hevc|60fps|uhd|h265|full hd)\b/gi, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase()

    const currentBase = cleanChannelName(current.item.name)
    const matching = playlist.filter((ch) => cleanChannelName(ch.name) === currentBase)
    if (matching.length <= 1) return []

    return matching.map((ch) => {
      let quality = 'SD'
      const n = ch.name.toUpperCase()
      if (n.includes('4K') || n.includes('UHD')) quality = '4K'
      else if (n.includes('FHD') || n.includes('FULL HD') || n.includes('1080')) quality = 'FHD'
      else if (n.includes('HD') || n.includes('720')) quality = 'HD'
      else quality = 'SD'

      return {
        name: ch.name,
        quality,
        isCurrent: ch.key === current.item.key,
        onSelect: () => play(ch, { playlist }),
      }
    })
  }, [current, playlist, play])

  const getEpg = useMemo(
    () => (current?.isLive && service ? () => service.getShortEpg(current.item.id) : undefined),
    [current, service],
  )

  const playLocalMedia = useCallback(
    (opts: { id: string; title: string; url: string; poster?: string }) => {
      trailerCoordinator.stopAll()
      setError('')
      const itemKey = `download:${opts.id}`
      const saved = historyRef.current.find((h) => h.key === itemKey)
      const resumable =
        saved &&
        saved.duration > 0 &&
        saved.position / saved.duration > 0.02 &&
        saved.position / saved.duration < 0.95
      const startAt = resumable ? saved.position : 0

      const localItem: MediaItem = {
        key: itemKey,
        type: 'movies',
        id: Math.abs(opts.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) || 999999,
        name: opts.title,
        image: opts.poster?.startsWith('data:') ? '' : (opts.poster || ''),
      }

      setCurrent({
        item: localItem,
        url: opts.url,
        title: opts.title,
        isLive: false,
        startAt,
      })
    },
    [],
  )

  return (
    <Ctx.Provider value={{ play, playLocalMedia, error }}>
      <div id="app-shell-wrapper" style={{ display: current ? 'none' : 'contents' }}>
        {children}
      </div>
      {current && (
        <ErrorBoundary
          fallback={(err, reset) => (
            <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-6 text-center space-y-4 select-none">
              <div className="h-14 w-14 rounded-full bg-rose-600/20 text-rose-500 border border-rose-500/30 flex items-center justify-center">
                <span className="text-2xl font-bold">!</span>
              </div>
              <h2 className="text-xl font-bold text-white">Falha ao reproduzir conteúdo</h2>
              <p className="text-xs text-zinc-400 max-w-md">{err?.message || 'Ocorreu um erro ao inicializar o player na sua TV.'}</p>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  tabIndex={0}
                  autoFocus
                  onClick={() => {
                    setCurrent(null)
                    reset()
                  }}
                  className="px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm cursor-pointer focus:ring-4 focus:ring-white focus:outline-none"
                >
                  Voltar ao Catálogo
                </button>
              </div>
            </div>
          )}
        >
          {isPwa ? (
            <PwaPlayer
              key={current.url}
              url={current.url}
              title={current.title}
              isLive={current.isLive}
              startAt={current.startAt}
              onClose={() => setCurrent(null)}
              onPrev={current.isLive ? zapPrev : undefined}
              onNext={current.isLive ? zapNext : undefined}
              channelLabel={channelLabel}
              getEpg={getEpg}
              onProgress={current.isLive ? undefined : onProgress}
              isSeries={current.item.type === 'series'}
              onNextEpisode={nextEpisodeTitle ? playNextEpisode : undefined}
              nextEpisodeTitle={nextEpisodeTitle}
              channelVariants={channelVariants}
              channelsList={live}
              matchContext={current.matchContext}
              onSelectChannel={(ch) => {
                const updatedPlaylist = current.matchContext
                  ? buildSportsPlaylist(live, ch)
                  : playlist
                play(ch, { playlist: updatedPlaylist, matchContext: current.matchContext })
              }}
            />
          ) : (
            <Player
              key={current.url}
              url={current.url}
              title={current.title}
              isLive={current.isLive}
              startAt={current.startAt}
              onClose={() => setCurrent(null)}
              onPrev={current.isLive ? zapPrev : undefined}
              onNext={current.isLive ? zapNext : undefined}
              channelLabel={channelLabel}
              getEpg={getEpg}
              onProgress={current.isLive ? undefined : onProgress}
              isSeries={current.item.type === 'series'}
              onNextEpisode={nextEpisodeTitle ? playNextEpisode : undefined}
              nextEpisodeTitle={nextEpisodeTitle}
              channelVariants={channelVariants}
              channelsList={live}
              matchContext={current.matchContext}
              onSelectChannel={(ch) => {
                const updatedPlaylist = current.matchContext
                  ? buildSportsPlaylist(live, ch)
                  : playlist
                play(ch, { playlist: updatedPlaylist, matchContext: current.matchContext })
              }}
            />
          )}
        </ErrorBoundary>
      )}

      {openingMediaTitle && !current && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center space-y-4 fade-up select-none">
          <div className="h-12 w-12 border-3 border-rose-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-center space-y-1">
            <p className="text-base font-bold text-white tracking-wide">Iniciando Reprodução</p>
            <p className="text-xs text-zinc-400">{openingMediaTitle}</p>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}

export function usePlayback() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePlayback fora do PlaybackProvider')
  return ctx
}
