import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import Hls from 'hls.js'
import { Capacitor } from '@capacitor/core'
import { NativePlayer } from '../plugins/NativePlayer'
import { buildProxyUrl } from '../services/proxyConfig'
import {
  X, Play, Pause, Volume2, Volume1, VolumeX, Maximize, Minimize, RectangleHorizontal, Loader2, Radio,
  FastForward, SkipForward, Sliders, Check, Languages, MessageSquare, ListVideo, Search, Tv,
  AlertTriangle, RotateCcw
} from 'lucide-react'
import type { EpgEntry } from '../services/xtreamService'
import type { MediaItem } from '../types'

export interface ChannelQualityVariant {
  name: string
  quality: string // '4K' | 'FHD' | 'HD' | 'SD'
  isCurrent: boolean
  onSelect: () => void
}

interface Props {
  url: string
  title: string
  /** TV ao vivo => baixa latência; filme/série => buffer grande */
  isLive: boolean
  onClose: () => void
  /** Troca rápida de canais (só TV ao vivo) */
  onPrev?: () => void
  onNext?: () => void
  channelLabel?: string
  /** Carrega a programação (EPG) do canal ao vivo */
  getEpg?: () => Promise<EpgEntry[]>
  /** Retomar a partir de (segundos) — filmes/séries */
  startAt?: number
  /** Chamado a cada 10s e ao fechar, para salvar 'continuar assistindo' */
  onProgress?: (position: number, duration: number) => void
  /** Identifica se é episódio de série para habilitar 'Pular Abertura (+30s)' e próximo ep */
  isSeries?: boolean
  /** Carrega o próximo episódio da série */
  onNextEpisode?: () => void
  /** Título do próximo episódio */
  nextEpisodeTitle?: string
  /** Variantes de qualidade do mesmo canal ao vivo (FHD, HD, SD) */
  channelVariants?: ChannelQualityVariant[]
  /** Lista de canais da categoria para Guia Rápido / Mini-EPG (Quick Zap) */
  channelsList?: MediaItem[]
  onSelectChannel?: (item: MediaItem) => void
}

type Aspect = 'contain' | 'cover'

/** Configuração Inteligente de Buffer do hls.js (Otimizado para Android 9 / Fire TV Stick) */
function buildHlsConfig(isLive: boolean): Partial<Hls['config']> {
  if (isLive) {
    return {
      lowLatencyMode: false,
      maxBufferLength: 20,
      maxMaxBufferLength: 35,
      maxBufferSize: 40 * 1000 * 1000,
      backBufferLength: 10,
      liveSyncDuration: 8, // Margem de segurança estável de ~8 segundos contra congelamento
      liveMaxLatencyDuration: 25,
      maxLiveSyncPlaybackRate: 1, // Fixo em 1.0x! Nunca acelera nem distorce o fluxo
      enableWorker: true,
      manifestLoadingTimeOut: 15000,
      manifestLoadingMaxRetry: 5,
      levelLoadingTimeOut: 15000,
      levelLoadingMaxRetry: 5,
      fragLoadingTimeOut: 20000,
      fragLoadingMaxRetry: 6,
      fragLoadingRetryDelay: 1000,
      fragLoadingMaxRetryTimeout: 20000,
    }
  }
  return {
    lowLatencyMode: false,
    maxBufferLength: 20,
    maxMaxBufferLength: 40,
    maxBufferSize: 40 * 1000 * 1000,
    backBufferLength: 10,
    enableWorker: true,
    manifestLoadingTimeOut: 12000,
    fragLoadingTimeOut: 20000,
    fragLoadingMaxRetry: 4,
  }
}

const fmt = (s: number) => {
  if (!isFinite(s)) return '--:--'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  const mm = String(m).padStart(h ? 2 : 1, '0')
  return `${h ? h + ':' : ''}${mm}:${String(sec).padStart(2, '0')}`
}

export default function Player({
  url,
  title,
  isLive,
  onClose,
  onPrev,
  onNext,
  channelLabel,
  getEpg,
  startAt = 0,
  onProgress,
  isSeries = false,
  onNextEpisode,
  nextEpisodeTitle,
  channelVariants,
  channelsList = [],
  onSelectChannel,
}: Props) {
  const isNative = useMemo(() => Capacitor.isNativePlatform(), [])

  useEffect(() => {
    if (!isNative) return
    document.documentElement.classList.add('native-player-active')
    document.body.classList.add('native-player-active')
    return () => {
      document.documentElement.classList.remove('native-player-active')
      document.body.classList.remove('native-player-active')
    }
  }, [isNative])

  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const hideTimer = useRef<number | undefined>(undefined)

  const [showQualityMenu, setShowQualityMenu] = useState(false)
  const [showQuickZap, setShowQuickZap] = useState(false)
  const [quickZapFilter, setQuickZapFilter] = useState('')
  const [hlsLevels, setHlsLevels] = useState<Array<{ id: number; label: string }>>([])
  const [currentHlsLevel, setCurrentHlsLevel] = useState<number>(-1)

  // Faixas de Áudio e Legendas HLS / HTML5
  const [audioTracks, setAudioTracks] = useState<Array<{ id: number; label: string }>>([])
  const [currentAudioTrack, setCurrentAudioTrack] = useState<number>(-1)
  const [subtitles, setSubtitles] = useState<Array<{ id: number; label: string }>>([])
  const [currentSubtitle, setCurrentSubtitle] = useState<number>(-1)
  const [showAudioSubMenu, setShowAudioSubMenu] = useState(false)

  // Salva o progresso (continuar assistindo)
  const lastPos = useRef({ pos: 0, dur: 0 })
  const progressRef = useRef(onProgress)
  progressRef.current = onProgress
  useEffect(() => {
    const flush = () => {
      const { pos, dur } = lastPos.current
      if (dur > 0) progressRef.current?.(pos, dur)
    }
    const t = window.setInterval(flush, 10000)
    return () => { window.clearInterval(t); flush(); lastPos.current = { pos: 0, dur: 0 } }
  }, [url])

  const [playing, setPlaying] = useState(false)
  const [buffering, setBuffering] = useState(true)
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [activeUrl, setActiveUrl] = useState(url)
  const [streamAttempt, setStreamAttempt] = useState<'m3u8' | 'ts'>('m3u8')
  const [hasAutoTriedExt, setHasAutoTriedExt] = useState(false)
  const [needsUserGesture, setNeedsUserGesture] = useState(false)
  const [needsUnmute, setNeedsUnmute] = useState(false)

  useEffect(() => {
    setActiveUrl(url)
    setStreamAttempt('m3u8')
    setHasAutoTriedExt(false)
    setNeedsUserGesture(false)
    setNeedsUnmute(false)
  }, [url])

  // Watchdog contra buffering infinito no mobile (se o vídeo estiver pausado pelo navegador)
  useEffect(() => {
    if (!buffering || error || isNative) return
    const watchdogTimer = setTimeout(() => {
      const v = videoRef.current
      if (v && v.paused && !playing) {
        console.warn('Buffering watchdog disparado: vídeo em pausa no navegador mobile.')
        setBuffering(false)
        setNeedsUserGesture(true)
      }
    }, 2000)
    return () => clearTimeout(watchdogTimer)
  }, [buffering, error, isNative, playing])

  // Watchdog ativo contra congelamento de imagem no mobile/web (live stream freeze recovery)
  useEffect(() => {
    if (!isLive || isNative || error) return
    let lastTime = -1
    let frozenChecks = 0

    const interval = setInterval(() => {
      const v = videoRef.current
      if (!v || v.paused || v.ended) return

      // Se o player está tocando mas o tempo do vídeo congelou no mesmo segundo
      if (Math.abs(v.currentTime - lastTime) < 0.25) {
        frozenChecks++
        // Se a imagem permanecer congelada por ~3.6 segundos (3 checagens consecutivas)
        if (frozenChecks >= 3) {
          console.warn('Congelamento detectado no canal ao vivo! Executando recuperação automática...')
          frozenChecks = 0

          // 1. Se estiver rodando com Hls.js, tenta recuperação de buffer/mídia
          if (hlsRef.current) {
            try {
              hlsRef.current.recoverMediaError()
            } catch {}
          }

          // 2. Nudge para a borda ao vivo mais recente (seekable end)
          try {
            if (v.seekable && v.seekable.length > 0) {
              const liveEdge = v.seekable.end(v.seekable.length - 1)
              if (liveEdge > v.currentTime + 0.8) {
                v.currentTime = Math.max(0, liveEdge - 1)
                v.play().catch(() => {})
                return
              }
            }
          } catch {}

          // 3. Se persistir congelado, reconecta o stream suavemente sem sair da tela
          setRetryKey((k) => k + 1)
        }
      } else {
        lastTime = v.currentTime
        frozenChecks = 0
      }
    }, 1200)

    return () => clearInterval(interval)
  }, [isLive, isNative, error])

  const toggleVodFormat = useCallback(() => {
    setError('')
    setBuffering(true)
    setNeedsUserGesture(false)
    setNeedsUnmute(false)
    setActiveUrl((prev) => {
      if (prev.endsWith('.mp4')) return prev.replace(/\.mp4$/, '.mkv')
      if (prev.endsWith('.mkv')) return prev.replace(/\.mkv$/, '.mp4')
      return prev
    })
    setRetryKey((k) => k + 1)
  }, [])
  const [volume, setVolume] = useState(() => Number(localStorage.getItem('iptv-rea:volume') ?? 1))
  const [muted, setMuted] = useState(false)
  const [aspect, setAspect] = useState<Aspect>('contain')
  const [fullscreen, setFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)

  // Detecção de Mobile e Orientação da Tela para Auto-Landscape
  const [isMobileDevice, setIsMobileDevice] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth <= 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  })
  const [isPortrait, setIsPortrait] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerHeight > window.innerWidth
  })
  const [forceLandscape, setForceLandscape] = useState(true)
  const [isDraggingProgress, setIsDraggingProgress] = useState(false)
  const [dragProgressVal, setDragProgressVal] = useState<number | null>(null)

  // Detecta se está rodando no ambiente desktop Electron (pacote PC instalado ou executável)
  const isElectronEnv = typeof window !== 'undefined' && (
    window.navigator.userAgent.toLowerCase().includes('electron') ||
    window.location.protocol === 'file:'
  )

  useEffect(() => {
    const handleOrientation = () => {
      const mobile = window.innerWidth <= 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      setIsMobileDevice(mobile)
      setIsPortrait(window.innerHeight > window.innerWidth)
    }

    window.addEventListener('resize', handleOrientation)
    window.addEventListener('orientationchange', handleOrientation)

    // Tenta forçar landscape nativo se a Screen Orientation API for suportada
    try {
      if (screen.orientation && 'lock' in screen.orientation) {
        ;(screen.orientation as any).lock('landscape').catch(() => {})
      }
    } catch {}

    return () => {
      window.removeEventListener('resize', handleOrientation)
      window.removeEventListener('orientationchange', handleOrientation)
      // Destrava a orientação e restaura portrait ao fechar o player
      try {
        if (screen.orientation && 'unlock' in screen.orientation) {
          ;(screen.orientation as any).unlock()
        }
      } catch {}
    }
  }, [])

  const isRotatedLandscape = isMobileDevice && isPortrait && forceLandscape

  const resetHideTimer = useCallback(() => {
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => {
      // Se algum menu/gaveta de seleção estiver aberto, não oculta os controles
      setShowControls((prev) => (showQuickZap || showQualityMenu || showAudioSubMenu ? true : false))
    }, 4500)
  }, [showQuickZap, showQualityMenu, showAudioSubMenu])

  const wake = useCallback(() => {
    setShowControls(true)
    resetHideTimer()
  }, [resetHideTimer])

  // Pular Abertura (+30s) para Séries - duração de 5 segundos
  const [showFloatingSkip, setShowFloatingSkip] = useState(false)
  const floatingSkipTimer = useRef<number | undefined>(undefined)
  const hasShownSkipIntroRef = useRef(false)

  // Toque/Clique na tela: se fechado, abre e permanece por 4.5s; se aberto, fecha imediatamente
  const toggleControlsViaTap = useCallback((e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation()
    }

    // Se o botão flutuante de pular abertura estiver visível, fecha imediatamente ao clicar na tela
    if (showFloatingSkip) {
      setShowFloatingSkip(false)
      window.clearTimeout(floatingSkipTimer.current)
    }

    // Se estava mudo pelo autoplay do mobile, ativa o som no primeiro toque
    if (needsUnmute && videoRef.current) {
      videoRef.current.muted = false
      setMuted(false)
      setNeedsUnmute(false)
    }

    // Se estava aguardando toque ou se o vídeo estiver pausado/travado, toca imediatamente
    const v = videoRef.current
    if (v && (needsUserGesture || (v.paused && !playing))) {
      v.play().then(() => {
        setNeedsUserGesture(false)
        setPlaying(true)
        setBuffering(false)
      }).catch(() => {
        v.muted = true
        v.play().then(() => {
          setNeedsUserGesture(false)
          setPlaying(true)
          setBuffering(false)
          setNeedsUnmute(true)
        }).catch(() => {})
      })
    }

    window.clearTimeout(hideTimer.current)
    setShowControls((prev) => {
      const next = !prev
      if (next) {
        hideTimer.current = window.setTimeout(() => {
          setShowControls((cur) => (showQuickZap || showQualityMenu || showAudioSubMenu ? true : false))
        }, 4500)
      }
      return next
    })
  }, [showQuickZap, showQualityMenu, showAudioSubMenu, needsUnmute, needsUserGesture, showFloatingSkip])

  const [time, setTime] = useState({ current: 0, duration: 0 })
  const [epg, setEpg] = useState<EpgEntry[]>([])
  const [nowSec, setNowSec] = useState(() => Date.now() / 1000)

  const startFloatingSkipTimer = useCallback(() => {
    window.clearTimeout(floatingSkipTimer.current)
    setShowFloatingSkip(true)
    floatingSkipTimer.current = window.setTimeout(() => {
      setShowFloatingSkip(false)
      // Se o foco estava no botão flutuante que sumiu após 5s, transfere suavemente para a barra ou play
      if (document.activeElement?.id === 'player-skip-intro-floating-btn') {
        const fallback = document.getElementById('player-progress') || document.getElementById('player-play')
        fallback?.focus()
      }
    }, 5000)
  }, [])

  // Exibe o botão de pular abertura apenas quando o episódio realmente já carregou e começou a tocar nos primeiros 60 segundos
  useEffect(() => {
    if (!isSeries || buffering || !playing || error || hasShownSkipIntroRef.current) return
    if (time.current >= 0.5 && time.current < 60) {
      hasShownSkipIntroRef.current = true
      startFloatingSkipTimer()
      const timer = setTimeout(() => {
        document.getElementById('player-skip-intro-floating-btn')?.focus()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isSeries, buffering, playing, error, time.current, startFloatingSkipTimer])



  // Popup de Próximo Episódio aos 40 segundos restantes (duração de 10s)
  const [showPrompt40s, setShowPrompt40s] = useState(false)
  const [prompt40sDismissed, setPrompt40sDismissed] = useState(false)
  const prompt40sTimer = useRef<number | undefined>(undefined)

  // Contagem regressiva de 5 segundos nos últimos 5 segundos do episódio para passar automaticamente
  const [nextEpCountdown, setNextEpCountdown] = useState<number | null>(null)
  const [autoNextCancelled, setAutoNextCancelled] = useState(false)
  const nextTriggeredRef = useRef(false)

  // Transição imediata para o próximo episódio com limpeza instantânea dos popups
  const handlePlayNextEpisode = useCallback(() => {
    setShowPrompt40s(false)
    setPrompt40sDismissed(true)
    setNextEpCountdown(null)
    setAutoNextCancelled(true)
    nextTriggeredRef.current = true
    window.clearTimeout(prompt40sTimer.current)
    onNextEpisode?.()
  }, [onNextEpisode])

  useEffect(() => {
    setAutoNextCancelled(false)
    setNextEpCountdown(null)
    nextTriggeredRef.current = false
    setShowPrompt40s(false)
    setPrompt40sDismissed(false)
    window.clearTimeout(prompt40sTimer.current)
  }, [url])

  useEffect(() => {
    if (!isSeries || !onNextEpisode || isLive) return
    if (!time.duration || time.duration < 30) return

    const remaining = time.duration - time.current

    // 1. Faltando entre 40s e 10s: Exibe o popup de 10s para Próximo Episódio com auto-foco
    if (remaining <= 40 && remaining > 10 && !prompt40sDismissed && !showPrompt40s) {
      setShowPrompt40s(true)
      wake()
      setTimeout(() => {
        document.getElementById('player-prompt40-play-btn')?.focus()
      }, 250)
      prompt40sTimer.current = window.setTimeout(() => {
        setShowPrompt40s(false)
        setPrompt40sDismissed(true)
        if (
          document.activeElement?.id === 'player-prompt40-play-btn' ||
          document.activeElement?.id === 'player-prompt40-cancel-btn'
        ) {
          const fallback = document.getElementById('player-progress') || document.getElementById('player-play')
          fallback?.focus()
        }
      }, 10000)
    }

    // 2. Faltando <= 5 segundos: Contagem regressiva de 5 segundos que passa automaticamente
    if (remaining <= 5 && remaining > 0 && !autoNextCancelled) {
      if (showPrompt40s) setShowPrompt40s(false)

      const count = Math.max(1, Math.ceil(remaining))
      setNextEpCountdown(count)

      // Auto-foca no botão se nada no popup estiver focado
      if (
        document.activeElement?.id !== 'player-countdown-play-btn' &&
        document.activeElement?.id !== 'player-countdown-cancel-btn'
      ) {
        document.getElementById('player-countdown-play-btn')?.focus()
      }

      if (remaining <= 1.2 && !nextTriggeredRef.current) {
        handlePlayNextEpisode()
      }
    } else if (remaining > 5) {
      setNextEpCountdown(null)
      nextTriggeredRef.current = false
    }
  }, [time.current, time.duration, isSeries, onNextEpisode, autoNextCancelled, isLive, prompt40sDismissed, showPrompt40s, wake, handlePlayNextEpisode])

  // Programação do canal (atualiza a cada minuto)
  const getEpgRef = useRef(getEpg)
  getEpgRef.current = getEpg
  useEffect(() => {
    setEpg([])
    if (!isLive || !getEpgRef.current) return
    let cancelled = false
    const load = () =>
      getEpgRef.current?.().then((l) => { if (!cancelled) setEpg(l) }).catch(() => {})
    load()
    const t = window.setInterval(() => { setNowSec(Date.now() / 1000); load() }, 60000)
    return () => { cancelled = true; window.clearInterval(t) }
  }, [url, isLive])

  const current = epg.find((e) => e.start <= nowSec && e.end > nowSec)
  const upcoming = epg.filter((e) => e.start >= (current?.end ?? nowSec)).slice(0, 2)
  const hhmm = (s: number) => new Date(s * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  // Carrega o stream com ExoPlayer nativo na TV ou Hls.js no navegador
  useEffect(() => {
    if (isNative) {
      setError('')
      setBuffering(true)
      let active = true

      NativePlayer.play({
        url: activeUrl,
        isLive,
        startAt: isLive ? 0 : startAt,
      }).catch((err) => {
        if (!active) return
        console.warn('Erro ao reproduzir via NativePlayer:', err)
        setError('Não foi possível iniciar a reprodução no player nativo.')
        setBuffering(false)
      })

      const timeSubPromise = NativePlayer.addListener('timeUpdate', (data) => {
        if (!active) return
        lastPos.current = { pos: data.currentTime, dur: data.duration }
        setTime({ current: data.currentTime, duration: data.duration })
      })

      const stateSubPromise = NativePlayer.addListener('stateChange', (data) => {
        if (!active) return
        if (data.state === 'buffering') {
          setBuffering(true)
        } else if (data.state === 'ready') {
          setBuffering(false)
          setPlaying(true)
          if (data.duration && data.duration > 0) {
            setTime((prev) => ({ ...prev, duration: data.duration! }))
          }
        } else if (data.state === 'ended') {
          setPlaying(false)
          setBuffering(false)
          if (isSeries && onNextEpisode) {
            handlePlayNextEpisode()
          }
        }
      })

      const isPlayingSubPromise = NativePlayer.addListener('isPlayingChange', (data) => {
        if (!active) return
        setPlaying(data.isPlaying)
      })

      const errorSubPromise = NativePlayer.addListener('playbackError', (data) => {
        if (!active) return
        setBuffering(false)
        setError(data.error || 'Erro ao carregar transmissão.')
      })

      return () => {
        active = false
        timeSubPromise.then((s) => s.remove()).catch(() => {})
        stateSubPromise.then((s) => s.remove()).catch(() => {})
        isPlayingSubPromise.then((s) => s.remove()).catch(() => {})
        errorSubPromise.then((s) => s.remove()).catch(() => {})
        NativePlayer.stop().catch(() => {})
      }
    }

    const video = videoRef.current
    if (!video) return
    try {
      video.disableRemotePlayback = true
    } catch {}
    setError('')
    setBuffering(true)
    setNeedsUserGesture(false)
    setNeedsUnmute(false)
    let hls: Hls | null = null
    let networkRetryCount = 0

    // Se for TV ao vivo com URL do Xtream, tenta m3u8 primeiro para usar o Hls.js inteligente
    let rawUrl = activeUrl
    if (isLive) {
      if (streamAttempt === 'm3u8' && activeUrl.endsWith('.ts')) {
        rawUrl = activeUrl.replace(/\.ts$/, '.m3u8')
      } else if (streamAttempt === 'ts' && activeUrl.endsWith('.m3u8')) {
        rawUrl = activeUrl.replace(/\.m3u8$/, '.ts')
      }
    }

    // No Electron (PC Desktop) e no Capacitor (Android APK), a conexão de vídeo vai DIRETO ao servidor de IPTV.
    // No navegador web (Safari/Chrome/Vercel), usa proxy para contornar Mixed Content (HTTP em HTTPS) e CORS.
    let streamUrl = rawUrl.trim().replace(/^https?:/i, (m) => m.toLowerCase())
    if (!Capacitor.isNativePlatform() && !isElectronEnv && /^https?:\/\//i.test(streamUrl)) {
      streamUrl = buildProxyUrl(streamUrl)
    }

    const tryStartPlayback = (v: HTMLVideoElement) => {
      const playPromise = v.play()
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setBuffering(false)
            setPlaying(true)
            setNeedsUserGesture(false)
            setNeedsUnmute(false)
          })
          .catch((err) => {
            console.warn('Autoplay com som recusado pelo navegador mobile:', err)
            // Tenta imediatamente muted autoplay (permitido por padrão no Chrome Mobile e Safari iOS)
            v.muted = true
            setMuted(true)
            const mutedPromise = v.play()
            if (mutedPromise !== undefined) {
              mutedPromise
                .then(() => {
                  setBuffering(false)
                  setPlaying(true)
                  setNeedsUserGesture(false)
                  setNeedsUnmute(true)
                })
                .catch((err2) => {
                  console.warn('Autoplay mudo também bloqueado pelo navegador:', err2)
                  setBuffering(false)
                  setPlaying(false)
                  setNeedsUserGesture(true)
                })
            } else {
              setBuffering(false)
              setPlaying(false)
              setNeedsUserGesture(true)
            }
          })
      }
    }

    const isHls = (rawUrl.includes('.m3u8') || (isLive && streamAttempt === 'm3u8')) && Hls.isSupported()

    if (isHls) {
      hls = new Hls(buildHlsConfig(isLive))
      hlsRef.current = hls
      hls.loadSource(streamUrl)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        tryStartPlayback(video)
        if (data.levels && data.levels.length > 1) {
          const lvls = data.levels.map((l, i) => ({
            id: i,
            label: l.height ? `${l.height}p` : `${Math.round(l.bitrate / 1000)}k`,
          }))
          setHlsLevels(lvls)
        }

        // Detecta faixas de áudio do HLS
        if (hls && hls.audioTracks && hls.audioTracks.length > 1) {
          setAudioTracks(hls.audioTracks.map((t, idx) => ({
            id: idx,
            label: t.name || t.lang || `Áudio ${idx + 1}`,
          })))
          setCurrentAudioTrack(hls.audioTrack)
        }

        // Detecta legendas embutidas (closed captions / subtitles)
        if (hls && hls.subtitleTracks && hls.subtitleTracks.length > 0) {
          setSubtitles(hls.subtitleTracks.map((s, idx) => ({
            id: idx,
            label: s.name || s.lang || `Legenda ${idx + 1}`,
          })))
          setCurrentSubtitle(hls.subtitleTrack)
        }
      })
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) {
          // Recupera automaticamente pequenas estagnações de buffer sem congelar a tela
          if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
            hls?.recoverMediaError()
          }
          return
        }
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          networkRetryCount++
          if (networkRetryCount <= 2) {
            setTimeout(() => hls?.startLoad(), 1000)
          } else {
            console.warn('HLS Network Error persistente. Tentando reconectar stream...')
            networkRetryCount = 0
            setTimeout(() => setRetryKey((k) => k + 1), 1500)
          }
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          console.warn('HLS Media Error detectado, recuperando codec/buffer...')
          hls?.recoverMediaError()
        } else {
          console.warn('HLS erro fatal não recuperável.')
          hls?.destroy()
          hlsRef.current = null
          if (video && video.canPlayType('application/vnd.apple.mpegurl')) {
            console.warn('Tentando fallback para player nativo da Apple...')
            video.src = streamUrl
            video.preload = 'auto'
            video.load()
            tryStartPlayback(video)
            return
          }
          setTimeout(() => setRetryKey((k) => k + 1), 1200)
        }
      })
    } else {
      video.src = streamUrl
      video.preload = 'auto'
      video.load()

      const onCanPlay = () => {
        video.removeEventListener('loadedmetadata', onCanPlay)
        video.removeEventListener('canplay', onCanPlay)
        tryStartPlayback(video)
      }

      if (video.readyState >= 2) {
        tryStartPlayback(video)
      } else {
        video.addEventListener('loadedmetadata', onCanPlay, { once: true })
        video.addEventListener('canplay', onCanPlay, { once: true })
        setTimeout(() => {
          if (video && video.paused && !playing) {
            tryStartPlayback(video)
          }
        }, 1200)
      }
    }
    return () => {
      hls?.destroy()
      hlsRef.current = null
      if (video) {
        try {
          video.pause()
          video.removeAttribute('src')
          video.src = ''
          video.load()
        } catch {}
      }
    }
  }, [activeUrl, isLive, retryKey, streamAttempt, isNative, startAt, isSeries, onNextEpisode])

  useEffect(() => {
    if (isNative) {
      NativePlayer.setVolume({ volume: muted ? 0 : volume }).catch(() => {})
      localStorage.setItem('iptv-rea:volume', String(volume))
      return
    }
    const v = videoRef.current
    if (!v) return
    v.volume = volume
    v.muted = muted
    localStorage.setItem('iptv-rea:volume', String(volume))
  }, [volume, muted, isNative])

  const toggleFullscreen = useCallback(() => {
    const v = videoRef.current as any
    const c = containerRef.current as any

    // 1. Verifica se já está em tela cheia nativa
    const isFs = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement ||
      (v && v.webkitDisplayingFullscreen)
    )

    if (isFs) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen()
      } else if (v && v.webkitExitFullscreen) {
        v.webkitExitFullscreen()
      }
      setFullscreen(false)
      return
    }

    // 2. Se o usuário estiver no celular com a tela em pé (isPortrait):
    // Como a trava de orientação vertical do iOS pode estar ligada, o QuickTime do iOS
    // FORÇARIA o vídeo para vertical se chamado. Por isso, mantemos a rotação horizontal
    // inteligente em 90 graus (como Netflix/Prime Video) e alternamos para preenchimento total!
    if (isMobileDevice && isPortrait) {
      if (c && typeof c.requestFullscreen === 'function') {
        c.requestFullscreen()
          .then(() => {
            try {
              if (screen.orientation && 'lock' in screen.orientation) {
                ;(screen.orientation as any).lock('landscape').catch(() => {})
              }
            } catch {}
            setFullscreen(true)
          })
          .catch(() => {})
        return
      }

      // No Safari do iPhone: alterna proporção para preenchimento total e fecha controles
      setForceLandscape(true)
      setAspect((prev) => (prev === 'contain' ? 'cover' : 'contain'))
      setShowControls(false)
      return
    }

    // 3. Se o aparelho já estiver fisicamente na horizontal (landscape, isPortrait = false) ou Desktop:
    if (c && typeof c.requestFullscreen === 'function') {
      c.requestFullscreen()
        .then(() => setFullscreen(true))
        .catch(() => {
          if (v && typeof v.webkitEnterFullscreen === 'function') {
            v.webkitEnterFullscreen()
            setFullscreen(true)
          }
        })
      return
    }

    if (c && typeof c.webkitRequestFullscreen === 'function') {
      c.webkitRequestFullscreen()
      setFullscreen(true)
      return
    }

    if (v && typeof v.webkitEnterFullscreen === 'function') {
      try {
        v.webkitEnterFullscreen()
        setFullscreen(true)
        return
      } catch (err) {
        console.warn('Erro ao abrir tela cheia nativa no Safari:', err)
      }
    }

    setForceLandscape((prev) => !prev)
  }, [isMobileDevice, isPortrait])

  const togglePlay = useCallback(() => {
    if (isNative) {
      if (playing) NativePlayer.pause().catch(() => {})
      else NativePlayer.resume().catch(() => {})
      setPlaying((p) => !p)
      return
    }
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }, [isNative, playing])

  useEffect(() => {
    const onFs = () => {
      const isFs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (videoRef.current as any)?.webkitDisplayingFullscreen
      )
      setFullscreen(isFs)
    }
    document.addEventListener('fullscreenchange', onFs)
    document.addEventListener('webkitfullscreenchange', onFs)
    const v = videoRef.current as any
    const onWebkitBegin = () => setFullscreen(true)
    const onWebkitEnd = () => setFullscreen(false)
    if (v) {
      v.addEventListener('webkitbeginfullscreen', onWebkitBegin)
      v.addEventListener('webkitendfullscreen', onWebkitEnd)
    }
    return () => {
      document.removeEventListener('fullscreenchange', onFs)
      document.removeEventListener('webkitfullscreenchange', onFs)
      if (v) {
        v.removeEventListener('webkitbeginfullscreen', onWebkitBegin)
        v.removeEventListener('webkitendfullscreen', onWebkitEnd)
      }
    }
  }, [])

  const BOTTOM_CONTROL_IDS = [
    'player-play',
    'player-mute',
    'player-skip-intro-bar-btn',
    'player-quality-btn',
    'player-quickzap-btn',
    'player-audio-sub-btn',
    'player-aspect',
    'player-fullscreen',
  ]


  // Avança ou retrocede tempo relativo (ex: +10s ou -10s com setas do controle)
  const seekRelative = useCallback((delta: number) => {
    if (isLive) return
    const dur = time.duration > 0 ? time.duration : Infinity
    const cur = time.current
    const nextTime = Math.max(0, Math.min(dur, cur + delta))
    if (isNative) {
      NativePlayer.seekTo({ position: nextTime }).catch(() => {})
      setTime((prev) => ({ ...prev, current: nextTime }))
      wake()
      return
    }
    const v = videoRef.current
    if (!v) return
    v.currentTime = nextTime
    setTime((prev) => ({ ...prev, current: nextTime }))
    wake()
  }, [isLive, wake, isNative, time.duration, time.current])

  // Clique no botão avança +30 segundos com segurança e fecha o botão flutuante
  const handleSkipIntro = useCallback(() => {
    setShowFloatingSkip(false)
    window.clearTimeout(floatingSkipTimer.current)
    const dur = time.duration > 0 ? time.duration : Infinity
    const cur = time.current
    const nextTime = Math.max(0, Math.min(dur, cur + 30))
    if (isNative) {
      NativePlayer.seekTo({ position: nextTime }).catch(() => {})
      setTime((prev) => ({ ...prev, current: nextTime }))
      wake()
      return
    }
    const v = videoRef.current
    if (!v) return
    try {
      v.currentTime = nextTime
      setTime((prev) => ({ ...prev, current: nextTime }))
    } catch (err) {
      console.warn('Erro ao pular abertura:', err)
    }
    wake()
  }, [wake, isNative, time.duration, time.current])

  useEffect(() => {
    wake()
    return () => window.clearTimeout(hideTimer.current)
  }, [wake])

  // Foco automático ao abrir Gaveta Quick Zap (Guia Rápido)
  useEffect(() => {
    if (showQuickZap) {
      const timer = setTimeout(() => {
        const cur =
          document.querySelector<HTMLButtonElement>('[data-quickzap-current="true"]') ||
          document.querySelector<HTMLButtonElement>('[data-quickzap-item="true"]')
        cur?.focus()
        cur?.scrollIntoView({ block: 'center' })
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [showQuickZap])

  // Foco automático ao abrir Menu de Qualidade
  useEffect(() => {
    if (showQualityMenu) {
      const timer = setTimeout(() => {
        const cur =
          document.querySelector<HTMLButtonElement>('[data-quality-current="true"]') ||
          document.querySelector<HTMLButtonElement>('[data-quality-item="true"]')
        cur?.focus()
      }, 60)
      return () => clearTimeout(timer)
    }
  }, [showQualityMenu])

  // Atalhos de teclado (Compatível com D-pad e Controle Remoto de TV / Fire TV Stick)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      wake()

      const isBack =
        e.key === 'Escape' ||
        e.key === 'GoBack' ||
        e.keyCode === 27 ||
        e.keyCode === 4 ||
        e.keyCode === 10009

      if (isBack) {
        e.preventDefault()
        e.stopPropagation()
        if (showQuickZap) {
          setShowQuickZap(false)
          setTimeout(() => document.getElementById('player-quickzap-btn')?.focus(), 50)
          return
        }
        if (showQualityMenu) {
          setShowQualityMenu(false)
          setTimeout(() => document.getElementById('player-quality-btn')?.focus(), 50)
          return
        }
        if (showAudioSubMenu) {
          setShowAudioSubMenu(false)
          setTimeout(() => document.getElementById('player-audio-sub-btn')?.focus(), 50)
          return
        }
        if (showControls) {
          setShowControls(false)
          return
        }
        onClose()
        return
      }

      // 1. Navegação D-Pad na Gaveta Quick Zap
      if (showQuickZap) {
        const items = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-quickzap-item="true"]'))
        const activeIdx = items.indexOf(document.activeElement as HTMLButtonElement)
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          const next = items[Math.min(items.length - 1, activeIdx + 1)]
          if (next) {
            next.focus()
            next.scrollIntoView({ block: 'nearest' })
          }
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          const prev = items[Math.max(0, activeIdx - 1)]
          if (prev) {
            prev.focus()
            prev.scrollIntoView({ block: 'nearest' })
          }
          return
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          setShowQuickZap(false)
          document.getElementById('player-quickzap-btn')?.focus()
          return
        }
        return
      }

      // 2. Navegação D-Pad no Menu de Qualidade
      if (showQualityMenu) {
        const items = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-quality-item="true"]'))
        const activeIdx = items.indexOf(document.activeElement as HTMLButtonElement)
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          const next = items[Math.min(items.length - 1, activeIdx + 1)]
          next?.focus()
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          const prev = items[Math.max(0, activeIdx - 1)]
          prev?.focus()
          return
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault()
          setShowQualityMenu(false)
          document.getElementById('player-quality-btn')?.focus()
          return
        }
        return
      }

      // 3. Controles ocultos: qualquer tecla de navegação revela a barra e foca
      if (!showControls) {
        if (e.key === 'ArrowRight' && !isLive) {
          e.preventDefault()
          setShowControls(true)
          seekRelative(10)
          setTimeout(() => document.getElementById('player-progress')?.focus(), 50)
          return
        }
        if (e.key === 'ArrowLeft' && !isLive) {
          e.preventDefault()
          setShowControls(true)
          seekRelative(-10)
          setTimeout(() => document.getElementById('player-progress')?.focus(), 50)
          return
        }
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault()
          setShowControls(true)
          setTimeout(() => {
            const initialFocus =
              document.getElementById('player-skip-intro-floating-btn') ||
              (!isLive ? document.getElementById('player-progress') : null) ||
              document.getElementById('player-quickzap-btn') ||
              document.getElementById('player-quality-btn') ||
              document.getElementById('player-play')
            initialFocus?.focus()
          }, 50)
          return
        }
      }

      // 4. Controles visíveis: navegação D-Pad precisa entre camadas:
      // Camada 0 (Topo): player-close
      // Camada 1 (Flutuante, se visível): player-skip-intro-floating-btn
      // Camada 2 (Meio): player-progress
      // Camada 3 (Inferior): Botões dinâmicos em player-bottom-controls
      const activeEl = document.activeElement as HTMLElement | null
      const isProgressFocused = activeEl?.id === 'player-progress'
      const isCloseFocused = activeEl?.id === 'player-close'
      const isSkipFloatingFocused = activeEl?.id === 'player-skip-intro-floating-btn'
      const isPrompt40PlayFocused = activeEl?.id === 'player-prompt40-play-btn'
      const isPrompt40CancelFocused = activeEl?.id === 'player-prompt40-cancel-btn'
      const isCountdownPlayFocused = activeEl?.id === 'player-countdown-play-btn'
      const isCountdownCancelFocused = activeEl?.id === 'player-countdown-cancel-btn'
      const isPopupNextFocused = isPrompt40PlayFocused || isPrompt40CancelFocused || isCountdownPlayFocused || isCountdownCancelFocused

      const getBottomControls = () => {
        const bar = document.getElementById('player-bottom-controls')
        if (!bar) return []
        return Array.from(bar.querySelectorAll<HTMLElement>('button:not([disabled]):not([tabindex="-1"])'))
      }
      const bottomControls = getBottomControls()
      const isBottomFocused = !!(activeEl && bottomControls.includes(activeEl))

      if (showControls) {
        // Se nada da interface do player estiver focado, foca na barra de progresso ou no play
        if (!isProgressFocused && !isCloseFocused && !isSkipFloatingFocused && !isBottomFocused && !isPopupNextFocused &&
            ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          e.preventDefault()
          e.stopImmediatePropagation()
          const initialFocus =
            (!isLive ? document.getElementById('player-progress') : null) ||
            document.getElementById('player-play')
          initialFocus?.focus()
          return
        }

        // A. Foco na Barra de Progresso
        if (isProgressFocused) {
          if (e.key === 'ArrowRight') {
            e.preventDefault()
            e.stopImmediatePropagation()
            seekRelative(10)
            return
          }
          if (e.key === 'ArrowLeft') {
            e.preventDefault()
            e.stopImmediatePropagation()
            seekRelative(-10)
            return
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            e.stopImmediatePropagation()
            document.getElementById('player-play')?.focus()
            return
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            e.stopImmediatePropagation()
            const floating = document.getElementById('player-skip-intro-floating-btn')
            if (floating && showFloatingSkip) floating.focus()
            else document.getElementById('player-close')?.focus()
            return
          }
        }

        // B. Foco no Botão Flutuante Pular Abertura
        if (isSkipFloatingFocused) {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            e.stopImmediatePropagation()
            setShowFloatingSkip(false)
            window.clearTimeout(floatingSkipTimer.current)
            const target =
              document.getElementById('player-aspect') ||
              (!isLive ? document.getElementById('player-progress') : null) ||
              document.getElementById('player-play')
            target?.focus()
            return
          }
          if (e.key === 'ArrowRight') {
            e.preventDefault()
            e.stopImmediatePropagation()
            setShowFloatingSkip(false)
            window.clearTimeout(floatingSkipTimer.current)
            const target = document.getElementById('player-aspect') || document.getElementById('player-fullscreen')
            target?.focus()
            return
          }
          if (e.key === 'ArrowLeft') {
            e.preventDefault()
            e.stopImmediatePropagation()
            setShowFloatingSkip(false)
            window.clearTimeout(floatingSkipTimer.current)
            const target =
              document.getElementById('player-skip-intro-bar-btn') ||
              (!isLive ? document.getElementById('player-progress') : null) ||
              document.getElementById('player-close')
            target?.focus()
            return
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            e.stopImmediatePropagation()
            setShowFloatingSkip(false)
            window.clearTimeout(floatingSkipTimer.current)
            document.getElementById('player-close')?.focus()
            return
          }
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            e.stopImmediatePropagation()
            setShowFloatingSkip(false)
            window.clearTimeout(floatingSkipTimer.current)
            handleSkipIntro()
            return
          }
        }

        // B1. Foco no Popup de Próximo Episódio aos 40s (Assistir Agora / Cancelar)
        if (isPrompt40PlayFocused) {
          if (e.key === 'ArrowRight') {
            e.preventDefault()
            e.stopImmediatePropagation()
            document.getElementById('player-prompt40-cancel-btn')?.focus()
            return
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            e.stopImmediatePropagation()
            setShowPrompt40s(false)
            setPrompt40sDismissed(true)
            window.clearTimeout(prompt40sTimer.current)
            const target =
              document.getElementById('player-next-episode-bar-btn') ||
              document.getElementById('player-aspect') ||
              document.getElementById('player-progress')
            target?.focus()
            return
          }
          if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            e.preventDefault()
            e.stopImmediatePropagation()
            setShowPrompt40s(false)
            setPrompt40sDismissed(true)
            window.clearTimeout(prompt40sTimer.current)
            document.getElementById('player-close')?.focus()
            return
          }
        }

        if (isPrompt40CancelFocused) {
          if (e.key === 'ArrowLeft') {
            e.preventDefault()
            e.stopImmediatePropagation()
            document.getElementById('player-prompt40-play-btn')?.focus()
            return
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            e.stopImmediatePropagation()
            setShowPrompt40s(false)
            setPrompt40sDismissed(true)
            window.clearTimeout(prompt40sTimer.current)
            const target = document.getElementById('player-aspect') || document.getElementById('player-fullscreen')
            target?.focus()
            return
          }
          if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
            e.preventDefault()
            e.stopImmediatePropagation()
            setShowPrompt40s(false)
            setPrompt40sDismissed(true)
            window.clearTimeout(prompt40sTimer.current)
            document.getElementById('player-close')?.focus()
            return
          }
        }

        // B2. Foco na Contagem Regressiva de 5s (Assistir Agora / Cancelar)
        if (isCountdownPlayFocused) {
          if (e.key === 'ArrowRight') {
            e.preventDefault()
            e.stopImmediatePropagation()
            document.getElementById('player-countdown-cancel-btn')?.focus()
            return
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            e.stopImmediatePropagation()
            setAutoNextCancelled(true)
            setNextEpCountdown(null)
            const target =
              document.getElementById('player-next-episode-bar-btn') ||
              document.getElementById('player-aspect') ||
              document.getElementById('player-progress')
            target?.focus()
            return
          }
          if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            e.preventDefault()
            e.stopImmediatePropagation()
            setAutoNextCancelled(true)
            setNextEpCountdown(null)
            document.getElementById('player-close')?.focus()
            return
          }
        }

        if (isCountdownCancelFocused) {
          if (e.key === 'ArrowLeft') {
            e.preventDefault()
            e.stopImmediatePropagation()
            document.getElementById('player-countdown-play-btn')?.focus()
            return
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            e.stopImmediatePropagation()
            setAutoNextCancelled(true)
            setNextEpCountdown(null)
            const target = document.getElementById('player-aspect') || document.getElementById('player-fullscreen')
            target?.focus()
            return
          }
          if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
            e.preventDefault()
            e.stopImmediatePropagation()
            setAutoNextCancelled(true)
            setNextEpCountdown(null)
            document.getElementById('player-close')?.focus()
            return
          }
        }

        // C. Foco no Botão Fechar (Topo)
        if (isCloseFocused) {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            e.stopImmediatePropagation()
            onClose()
            return
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            e.stopImmediatePropagation()
            const floating = document.getElementById('player-skip-intro-floating-btn')
            if (floating && showFloatingSkip) floating.focus()
            else if (!isLive && document.getElementById('player-progress')) document.getElementById('player-progress')?.focus()
            else document.getElementById('player-play')?.focus()
            return
          }
        }

        // D. Foco na Linha Inferior de Botões (Play, Mute, 16:9, Qualidade, Canais, etc.)
        if (isBottomFocused) {
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            e.stopImmediatePropagation()
            if (!isLive && document.getElementById('player-progress')) {
              document.getElementById('player-progress')?.focus()
            } else {
              const floating = document.getElementById('player-skip-intro-floating-btn')
              if (floating && showFloatingSkip) floating.focus()
              else document.getElementById('player-close')?.focus()
            }
            return
          }

          if (e.key === 'ArrowDown') {
            e.preventDefault()
            e.stopImmediatePropagation()
            return
          }

          if (e.key === 'ArrowRight') {
            e.preventDefault()
            e.stopImmediatePropagation()
            const curIdx = bottomControls.indexOf(activeEl as HTMLElement)
            if (curIdx >= 0 && curIdx < bottomControls.length - 1) {
              bottomControls[curIdx + 1]?.focus()
            }
            return
          }

          if (e.key === 'ArrowLeft') {
            e.preventDefault()
            e.stopImmediatePropagation()
            const curIdx = bottomControls.indexOf(activeEl as HTMLElement)
            if (curIdx > 0) {
              bottomControls[curIdx - 1]?.focus()
            }
            return
          }

          // Se Enter/Espaço for pressionado com um botão em foco, deixa o clique nativo do botão acontecer!
          if ((e.key === ' ' || e.key === 'Enter') && activeEl && activeEl.tagName === 'BUTTON') {
            return
          }
        }
      }

      // Se o foco estiver em QUALQUER botão ou link, não intercepta Enter/Espaço para togglePlay
      if ((e.key === ' ' || e.key === 'Enter') && activeEl && (activeEl.tagName === 'BUTTON' || activeEl.getAttribute('role') === 'button' || activeEl.tagName === 'A')) {
        return
      }

      switch (e.key.toLowerCase()) {
        case 's': if (isSeries) { e.preventDefault(); handleSkipIntro() } break
        case 'f': toggleFullscreen(); break
        case ' ': case 'enter': e.preventDefault(); togglePlay(); break
        case 'm': setMuted((m) => !m); break
        case 'a': {
          const next = aspect === 'contain' ? 'cover' : 'contain'
          setAspect(next)
          if (isNative) NativePlayer.setResizeMode({ mode: next }).catch(() => {})
          break
        }
        case 'z': if (isLive && channelsList.length > 0) setShowQuickZap((prev) => !prev); break
        case 'pageup': case 'channelup': if (isLive) { e.preventDefault(); onPrev?.() } break
        case 'pagedown': case 'channeldown': if (isLive) { e.preventDefault(); onNext?.() } break
        case '+': case '=': setVolume((v) => Math.min(1, +(v + 0.05).toFixed(2))); break
        case '-': setVolume((v) => Math.max(0, +(v - 0.05).toFixed(2))); break
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [
    toggleFullscreen,
    togglePlay,
    onClose,
    isLive,
    onPrev,
    onNext,
    showControls,
    showQuickZap,
    showQualityMenu,
    showAudioSubMenu,
    wake,
    channelsList.length,
    seekRelative,
    handleSkipIntro,
    isSeries,
    isNative,
    aspect,
  ])

  // Overlay de número/nome do canal ao trocar
  const [osd, setOsd] = useState(false)
  useEffect(() => {
    if (!channelLabel) return
    setOsd(true)
    const t = window.setTimeout(() => setOsd(false), 2500)
    return () => window.clearTimeout(t)
  }, [url, channelLabel])

  const VolIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2
  const btn = 'p-1.5 sm:p-2 rounded-full hover:bg-white/15 focus:bg-white/25 focus:ring-4 focus:ring-rose-500 focus:outline-none transition cursor-pointer'

  return (
    <div
      data-tv-player="true"
      ref={containerRef}
      onMouseMove={isMobileDevice ? undefined : wake}
      onWheel={(e) => setVolume((v) => Math.min(1, Math.max(0, +(v + (e.deltaY < 0 ? 0.05 : -0.05)).toFixed(2))))}
      style={
        isRotatedLandscape
          ? {
              width: '100dvh',
              height: '100dvw',
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(90deg)',
              transformOrigin: 'center center',
              zIndex: 9999,
            }
          : undefined
      }
      className={`fixed inset-0 z-50 ${isNative ? 'bg-transparent' : 'bg-black'} select-none ${showControls ? '' : 'cursor-none'} touch-manipulation`}
    >

      {!isNative && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          preload="auto"
          disableRemotePlayback
          {...{
            'webkit-playsinline': 'true',
            'x5-playsinline': 'true',
            'x5-video-player-type': 'h5-page',
            'x-webkit-airplay': 'deny',
          }}
          onPlay={() => {
            setPlaying(true)
            setNeedsUserGesture(false)
          }}
          onPause={() => setPlaying(false)}
          onWaiting={() => setBuffering(true)}
          onSeeking={() => setBuffering(true)}
          onSeeked={() => setBuffering(false)}
          onPlaying={() => {
            setBuffering(false)
            setPlaying(true)
            setNeedsUserGesture(false)
          }}
          onCanPlay={() => setBuffering(false)}
          onLoadedData={() => setBuffering(false)}
          onError={(e) => {
            if (isLive && streamAttempt === 'm3u8') {
              console.warn('Tag video falhou com m3u8, tentando TS...')
              setStreamAttempt('ts')
              return
            }

            const videoEl = e.currentTarget
            const mediaErr = videoEl.error

            // 1. Ignora cancelamentos intencionais do navegador (código 1 = MEDIA_ERR_ABORTED ao dar seek)
            if (mediaErr && mediaErr.code === 1) {
              return
            }

            // 2. Se o usuário estiver arrastando a barra ou no meio do seek, não dispara erro
            if (isDraggingProgress || videoEl.seeking) {
              return
            }

            // 3. Se for falha real no início da reprodução, tenta automaticamente o formato alternativo (.mp4 <-> .mkv)
            if (!isLive && !hasAutoTriedExt && time.current < 5 && (activeUrl.endsWith('.mp4') || activeUrl.endsWith('.mkv'))) {
              setHasAutoTriedExt(true)
              const nextUrl = activeUrl.endsWith('.mp4')
                ? activeUrl.replace(/\.mp4$/, '.mkv')
                : activeUrl.replace(/\.mkv$/, '.mp4')
              console.warn(`Formato VOD falhou no início. Tentando alternativo: ${nextUrl}`)
              setActiveUrl(nextUrl)
              setRetryKey((k) => k + 1)
              return
            }

            let msg = 'Não foi possível reproduzir este conteúdo.'
            if (mediaErr) {
              if (mediaErr.code === 2) msg = 'Falha de conexão com o servidor de transmissão.'
              else if (mediaErr.code === 3) msg = 'Codec de áudio ou vídeo incompatível ou resposta inválida do servidor.'
              else if (mediaErr.code === 4) msg = 'Formato de vídeo incompatível ou link expirado (404).'
            }
            setBuffering(false)
            setError(msg)
          }}
          onTimeUpdate={(e) => {
            const { currentTime, duration } = e.currentTarget
            lastPos.current = { pos: currentTime, dur: isFinite(duration) ? duration : 0 }
            if (!isDraggingProgress) {
              setTime({ current: currentTime, duration })
            }
          }}
          onLoadedMetadata={(e) => { if (startAt > 0 && !isLive) e.currentTarget.currentTime = startAt }}
          className={`w-full h-full relative z-0 ${aspect === 'cover' ? 'object-cover' : 'object-contain'}`}
        />
      )}

      {/* Camada de Toque Transparente para Exibir/Ocultar Controles com Duração Garantida de 4.5s */}
      <div
        id="player-touch-surface"
        onClick={toggleControlsViaTap}
        onDoubleClick={toggleFullscreen}
        className="absolute inset-0 z-10 cursor-pointer touch-manipulation"
      />

      {/* Botão flutuante para desmutar quando autoplay iniciar mudo no celular */}
      {needsUnmute && !error && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 fade-up pointer-events-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (videoRef.current) {
                videoRef.current.muted = false
                setMuted(false)
              }
              setNeedsUnmute(false)
            }}
            className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm shadow-2xl backdrop-blur-md animate-bounce cursor-pointer touch-manipulation border border-white/20 active:scale-95 transition"
          >
            <VolumeX size={18} />
            <span>Toque para ativar o som</span>
          </button>
        </div>
      )}

      {/* Botão central quando o navegador móvel exigir interação explícita do usuário */}
      {needsUserGesture && !playing && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-40 bg-black/60 backdrop-blur-xs p-6 text-center space-y-4 fade-up">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setNeedsUserGesture(false)
              setBuffering(true)
              const v = videoRef.current
              if (v) {
                v.muted = false
                setMuted(false)
                v.play()
                  .then(() => {
                    setBuffering(false)
                    setPlaying(true)
                  })
                  .catch(() => {
                    v.muted = true
                    setMuted(true)
                    v.play().catch(() => {})
                    setNeedsUnmute(true)
                    setBuffering(false)
                    setPlaying(true)
                  })
              }
            }}
            className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-black text-base sm:text-lg shadow-2xl transition cursor-pointer touch-manipulation border border-white/20"
          >
            <Play size={26} className="fill-white" />
            <span>Toque para Assistir</span>
          </button>
          <p className="text-xs sm:text-sm text-zinc-300 max-w-xs">
            O navegador do seu celular exige um toque para iniciar a reprodução com som.
          </p>
        </div>
      )}

      {buffering && !error && !needsUserGesture && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <Loader2 size={48} className="animate-spin text-white/80" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-50 p-6 text-center space-y-5 fade-up">
          <div className="p-4 rounded-full bg-rose-600/20 text-rose-500 border border-rose-500/30 shadow-2xl">
            <AlertTriangle size={44} />
          </div>
          <div className="max-w-md space-y-2">
            <h3 className="text-xl sm:text-2xl font-black text-white">Falha na Reprodução</h3>
            <p className="text-sm text-zinc-300 leading-relaxed">{error}</p>
          </div>
          <div className="flex items-center gap-3.5 pt-2">
            <button
              tabIndex={0}
              onClick={() => {
                setError('')
                setRetryKey((k) => k + 1)
              }}
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-sm text-white shadow-xl transition focus:ring-4 focus:ring-white focus:outline-none cursor-pointer"
            >
              <RotateCcw size={18} />
              <span>Tentar Novamente</span>
            </button>
            {!isLive && (activeUrl.endsWith('.mp4') || activeUrl.endsWith('.mkv')) && (
              <button
                tabIndex={0}
                onClick={toggleVodFormat}
                className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 font-bold text-sm text-zinc-950 shadow-xl transition focus:ring-4 focus:ring-white focus:outline-none cursor-pointer"
              >
                <Sliders size={18} />
                <span>Tentar em {activeUrl.endsWith('.mp4') ? 'MKV' : 'MP4'}</span>
              </button>
            )}
            <button
              tabIndex={0}
              onClick={onClose}
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 font-bold text-sm text-zinc-200 border border-white/15 transition focus:ring-4 focus:ring-rose-500 focus:outline-none cursor-pointer"
            >
              <X size={18} />
              <span>Voltar ao Catálogo</span>
            </button>
          </div>
        </div>
      )}

      {osd && channelLabel && (
        <div className="absolute top-20 right-8 px-4 py-2 rounded-lg bg-black/70 text-lg font-semibold fade-up z-20">
          {channelLabel}
          {current && <div className="text-sm font-normal text-zinc-300 mt-0.5">{current.title}</div>}
        </div>
      )}

      {/* Botão de Fechar (Aparece e some junto com os controles) */}
      <button
        type="button"
        id="player-always-close"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        className={`fixed z-50 p-2.5 sm:p-3 rounded-full bg-black/85 hover:bg-rose-600 text-white border border-white/25 shadow-2xl backdrop-blur-md active:scale-90 transition-opacity duration-300 cursor-pointer touch-manipulation ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          top: isRotatedLandscape ? '1.5rem' : 'max(env(safe-area-inset-top, 0px), 1rem)',
          left: isRotatedLandscape ? 'max(env(safe-area-inset-top, 0px), 4.5rem)' : 'max(env(safe-area-inset-left, 0px), 1.25rem)',
        }}
        title="Fechar e Voltar"
        aria-label="Fechar"
      >
        <X size={20} className="text-white" />
      </button>

      {/* Barra superior */}
      <div
        className={`absolute top-0 inset-x-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-6 pt-[max(env(safe-area-inset-top,0px),0.75rem)] pb-2 sm:pb-4 bg-gradient-to-b from-black/85 to-transparent transition-opacity duration-300 z-30 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          paddingLeft: isRotatedLandscape ? 'max(env(safe-area-inset-top, 0px), 7.5rem)' : 'max(env(safe-area-inset-left, 0px), 4rem)',
        }}
        onClick={(e) => {
          e.stopPropagation()
          resetHideTimer()
        }}
      >
        <button id="player-close" onClick={onClose} className={btn} aria-label="Fechar (Esc)" title="Fechar (Esc)">
          <X size={20} className="sm:w-[22px] sm:h-[22px]" />
        </button>
        <h2 className="font-semibold text-xs sm:text-base truncate flex-1">{title}</h2>
        {isLive && (
          <span className="flex items-center gap-1 text-[10px] sm:text-xs font-bold bg-rose-600 px-2 py-0.5 rounded shrink-0">
            <Radio size={11} /> AO VIVO
          </span>
        )}
        {/* Botão de Girar Orientação (Mobile) */}
        {isMobileDevice && (
          <button
            onClick={() => setForceLandscape((prev) => !prev)}
            className={btn}
            title={forceLandscape ? 'Modo Normal' : 'Girar Horizontal'}
            aria-label="Girar orientação"
          >
            <RotateCcw size={18} className={forceLandscape ? 'rotate-90 text-rose-400' : 'text-zinc-300'} />
          </button>
        )}
      </div>

      {/* Controles inferiores */}
      <div
        className={`absolute bottom-0 inset-x-0 px-3 sm:px-6 pb-[max(env(safe-area-inset-bottom,0px),1rem)] pt-6 sm:pt-10 bg-gradient-to-t from-black/95 to-transparent transition-opacity duration-300 z-30 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={
          isRotatedLandscape
            ? {
                paddingLeft: 'max(env(safe-area-inset-top, 0px), 4rem)',
                paddingRight: 'max(env(safe-area-inset-bottom, 0px), 2.5rem)',
              }
            : undefined
        }
        onClick={(e) => {
          e.stopPropagation()
          resetHideTimer()
        }}
      >
        {isLive && epg.length > 0 && (
          <div className="mb-2 max-w-xl text-xs sm:text-sm">
            {current && (
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] sm:text-xs font-bold text-rose-400">AGORA</span>
                  <span className="font-semibold truncate text-xs sm:text-sm">{current.title}</span>
                  <span className="text-[10px] sm:text-xs text-zinc-400 shrink-0">{hhmm(current.start)} – {hhmm(current.end)}</span>
                </div>
                <div className="mt-1 h-1 rounded bg-white/20 overflow-hidden">
                  <div className="h-full bg-rose-500" style={{ width: `${Math.min(100, Math.max(0, ((nowSec - current.start) / (current.end - current.start)) * 100))}%` }} />
                </div>
                {current.description && <p className="mt-0.5 text-[11px] text-zinc-400 line-clamp-1">{current.description}</p>}
              </div>
            )}
            {upcoming.slice(0, 1).map((e) => (
              <div key={e.start} className="mt-1 flex items-baseline gap-2 text-zinc-300 hidden sm:flex">
                <span className="text-[10px] sm:text-xs font-bold text-zinc-500">DEPOIS</span>
                <span className="truncate text-xs">{e.title}</span>
                <span className="text-[10px] sm:text-xs text-zinc-500 shrink-0">{hhmm(e.start)}</span>
              </div>
            ))}
          </div>
        )}
        {!isLive && (
          <div className="flex items-center gap-2 sm:gap-3 mb-1.5 text-[11px] sm:text-xs text-zinc-300">
            <span className="w-10 sm:w-14 text-right tabular-nums font-semibold">{fmt(dragProgressVal !== null ? dragProgressVal : time.current)}</span>
            <input
              id="player-progress"
              tabIndex={0}
              type="range"
              min={0}
              max={time.duration || 0}
              step={1}
              value={dragProgressVal !== null ? dragProgressVal : time.current}
              onPointerDown={() => setIsDraggingProgress(true)}
              onTouchStart={() => setIsDraggingProgress(true)}
              onInput={(e) => {
                const target = Number(e.currentTarget.value)
                setDragProgressVal(target)
              }}
              onChange={(e) => {
                const target = Number(e.target.value)
                setDragProgressVal(null)
                setIsDraggingProgress(false)
                if (isNative) {
                  NativePlayer.seekTo({ position: target }).catch(() => {})
                  setTime((prev) => ({ ...prev, current: target }))
                } else if (videoRef.current) {
                  videoRef.current.currentTime = target
                  setTime((prev) => ({ ...prev, current: target }))
                }
              }}
              onPointerUp={() => {
                setIsDraggingProgress(false)
                setDragProgressVal(null)
              }}
              onTouchEnd={() => {
                setIsDraggingProgress(false)
                setDragProgressVal(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') {
                  e.preventDefault()
                  seekRelative(-10)
                } else if (e.key === 'ArrowRight') {
                  e.preventDefault()
                  seekRelative(10)
                }
              }}
              className="flex-1 accent-rose-500 cursor-pointer h-2.5 sm:h-2.5 rounded-lg bg-zinc-700 focus:ring-4 focus:ring-rose-500 focus:outline-none transition-all touch-manipulation"
              aria-label="Progresso do vídeo"
            />
            <span className="w-10 sm:w-14 tabular-nums font-semibold">{fmt(time.duration)}</span>
          </div>
        )}
        <div id="player-bottom-controls" className="flex items-center gap-1.5 sm:gap-2">
          <button id="player-play" tabIndex={0} onClick={togglePlay} className={btn} aria-label="Play/Pause (Espaço)" title="Play/Pause (Espaço)">
            {playing ? <Pause size={20} className="sm:w-[22px] sm:h-[22px]" /> : <Play size={20} className="sm:w-[22px] sm:h-[22px]" />}
          </button>
          <button id="player-mute" tabIndex={0} onClick={() => setMuted((m) => !m)} className={btn} aria-label="Mudo (M)" title="Mudo (M)">
            <VolIcon size={20} className="sm:w-[22px] sm:h-[22px]" />
          </button>
          <input
            id="player-volume"
            type="range"
            min={0}
            max={1}
            step={0.01}
            tabIndex={-1}
            data-tv-ignore="true"
            value={muted ? 0 : volume}
            onChange={(e) => { setVolume(Number(e.target.value)); setMuted(false) }}
            className="w-20 sm:w-28 accent-rose-500 hidden sm:block"
            aria-label="Volume"
          />
          <div className="flex-1" />
          {isSeries && (
            <button
              id="player-skip-intro-bar-btn"
              tabIndex={0}
              onClick={handleSkipIntro}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-white/10 hover:bg-white/20 focus:bg-rose-600 focus:text-white focus:ring-2 focus:ring-rose-500 focus:outline-none text-[11px] sm:text-xs font-bold text-zinc-200 hover:text-white transition cursor-pointer shrink-0"
              title="Pular Abertura (+30s)"
            >
              <FastForward size={13} className="text-rose-400" />
              <span>+30s</span>
            </button>
          )}
          {isSeries && onNextEpisode && (
            <button
              id="player-next-episode-bar-btn"
              tabIndex={0}
              onClick={handlePlayNextEpisode}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-white/10 hover:bg-white/20 focus:bg-rose-600 focus:text-white focus:ring-2 focus:ring-rose-500 focus:outline-none text-[11px] sm:text-xs font-bold text-zinc-200 hover:text-white transition cursor-pointer shrink-0"
              title="Próximo Episódio (N)"
            >
              <SkipForward size={13} className="text-rose-400" />
              <span className="hidden sm:inline">Próximo</span>
            </button>
          )}
          {/* Seletor de Qualidade de Canal e HLS (FHD, HD, SD, 4K) */}
          {((channelVariants && channelVariants.length > 1) || hlsLevels.length > 1) && (
            <div className="relative">
              <button
                id="player-quality-btn"
                tabIndex={0}
                onClick={() => setShowQualityMenu((prev) => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 hover:bg-white/20 focus:bg-rose-600 focus:text-white focus:ring-4 focus:ring-rose-500 focus:outline-none text-zinc-200 hover:text-white transition cursor-pointer"
                title="Qualidade do Canal / Transmissão"
              >
                <Sliders size={14} className="text-rose-400" />
                <span>
                  {channelVariants?.find((v) => v.isCurrent)?.quality ||
                    (currentHlsLevel === -1
                      ? 'Auto'
                      : hlsLevels[currentHlsLevel]?.label || 'Qualidade')}
                </span>
              </button>

              {showQualityMenu && (
                <div
                  onMouseLeave={() => setShowQualityMenu(false)}
                  className="absolute bottom-full right-0 mb-2 w-52 bg-zinc-950/95 border border-zinc-700/80 rounded-2xl p-2 shadow-2xl backdrop-blur-md z-50 fade-up space-y-1 text-xs select-none"
                >
                  <div className="px-2.5 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider border-b border-white/10">
                    Qualidade da Transmissão
                  </div>

                  {/* Variantes do canal IPTV (ex: FHD, HD, SD) */}
                  {channelVariants && channelVariants.length > 1 && (
                    <div className="space-y-0.5">
                      {channelVariants.map((variant) => (
                        <button
                          key={variant.name}
                          tabIndex={0}
                          data-quality-item="true"
                          data-quality-current={variant.isCurrent ? 'true' : undefined}
                          onClick={() => {
                            setShowQualityMenu(false)
                            variant.onSelect()
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl transition text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white/20 ${
                            variant.isCurrent
                              ? 'bg-rose-600/20 text-rose-400 font-bold'
                              : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span className="truncate">{variant.quality} · {variant.name}</span>
                          {variant.isCurrent && <Check size={14} className="text-rose-500 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Níveis de resolução HLS */}
                  {hlsLevels.length > 1 && (
                    <div className="pt-1 border-t border-white/10 space-y-0.5">
                      <button
                        onClick={() => {
                          if (hlsRef.current) hlsRef.current.currentLevel = -1
                          setCurrentHlsLevel(-1)
                          setShowQualityMenu(false)
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl transition text-left cursor-pointer ${
                          currentHlsLevel === -1
                            ? 'bg-rose-600/20 text-rose-400 font-bold'
                            : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <span>Automático</span>
                        {currentHlsLevel === -1 && <Check size={14} className="text-rose-500 shrink-0" />}
                      </button>
                      {hlsLevels.map((lvl) => (
                        <button
                          key={lvl.id}
                          onClick={() => {
                            if (hlsRef.current) hlsRef.current.currentLevel = lvl.id
                            setCurrentHlsLevel(lvl.id)
                            setShowQualityMenu(false)
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl transition text-left cursor-pointer ${
                            currentHlsLevel === lvl.id
                              ? 'bg-rose-600/20 text-rose-400 font-bold'
                              : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span>{lvl.label}</span>
                          {currentHlsLevel === lvl.id && <Check size={14} className="text-rose-500 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {/* Seletor de Áudio e Legenda (Dublado / Legendado) */}
          {(audioTracks.length > 1 || subtitles.length > 0) && (
            <div className="relative">
              <button
                id="player-audio-sub-btn"
                tabIndex={0}
                onClick={() => setShowAudioSubMenu((prev) => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 hover:bg-white/20 focus:bg-rose-600 focus:text-white focus:ring-4 focus:ring-rose-500 focus:outline-none text-zinc-200 hover:text-white transition cursor-pointer"
                title="Áudio & Legendas"
              >
                <Languages size={14} className="text-rose-400" />
                <span>Áudio & Legendas</span>
              </button>

              {showAudioSubMenu && (
                <div
                  onMouseLeave={() => setShowAudioSubMenu(false)}
                  className="absolute bottom-full right-0 mb-2 w-56 bg-zinc-950/95 border border-zinc-700/80 rounded-2xl p-2.5 shadow-2xl backdrop-blur-md z-50 fade-up space-y-2 text-xs select-none"
                >
                  {/* Faixas de Áudio */}
                  {audioTracks.length > 1 && (
                    <div className="space-y-1">
                      <div className="px-2 py-0.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1 border-b border-white/10">
                        <MessageSquare size={11} className="text-rose-400" />
                        <span>Trilha de Áudio</span>
                      </div>
                      {audioTracks.map((trk) => (
                        <button
                          key={trk.id}
                          onClick={() => {
                            if (hlsRef.current) hlsRef.current.audioTrack = trk.id
                            setCurrentAudioTrack(trk.id)
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl transition text-left cursor-pointer ${
                            currentAudioTrack === trk.id
                              ? 'bg-rose-600/20 text-rose-400 font-bold'
                              : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span className="truncate">{trk.label}</span>
                          {currentAudioTrack === trk.id && <Check size={14} className="text-rose-500 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Legendas */}
                  {subtitles.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-white/10">
                      <div className="px-2 py-0.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                        <Languages size={11} className="text-rose-400" />
                        <span>Legendas</span>
                      </div>
                      <button
                        onClick={() => {
                          if (hlsRef.current) hlsRef.current.subtitleTrack = -1
                          setCurrentSubtitle(-1)
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl transition text-left cursor-pointer ${
                          currentSubtitle === -1
                            ? 'bg-rose-600/20 text-rose-400 font-bold'
                            : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <span>Desativada</span>
                        {currentSubtitle === -1 && <Check size={14} className="text-rose-500 shrink-0" />}
                      </button>
                      {subtitles.map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() => {
                            if (hlsRef.current) hlsRef.current.subtitleTrack = sub.id
                            setCurrentSubtitle(sub.id)
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl transition text-left cursor-pointer ${
                            currentSubtitle === sub.id
                              ? 'bg-rose-600/20 text-rose-400 font-bold'
                              : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span className="truncate">{sub.label}</span>
                          {currentSubtitle === sub.id && <Check size={14} className="text-rose-500 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Botão Quick Zap (Guia Rápido de Canais) para TV Ao Vivo */}
          {isLive && channelsList.length > 0 && onSelectChannel && (
            <button
              id="player-quickzap-btn"
              tabIndex={0}
              onClick={() => setShowQuickZap((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer focus:outline-none focus:ring-4 focus:ring-rose-500 ${
                showQuickZap
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/50'
                  : 'bg-white/10 hover:bg-white/20 focus:bg-rose-600 focus:text-white text-zinc-200 hover:text-white'
              }`}
              title="Guia Rápido / Zapear Canais (Z)"
            >
              <ListVideo size={15} className={showQuickZap ? 'text-white' : 'text-rose-400'} />
              <span>Canais ({channelsList.length})</span>
            </button>
          )}

          <button
            id="player-aspect"
            tabIndex={0}
            onClick={() => {
              const next = aspect === 'contain' ? 'cover' : 'contain'
              setAspect(next)
              if (isNative) {
                NativePlayer.setResizeMode({ mode: next }).catch(() => {})
              }
            }}
            className="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm hover:bg-white/15 focus:bg-white/25 focus:ring-2 focus:ring-rose-500 focus:outline-none transition cursor-pointer shrink-0"
            title="Proporção (A)"
          >
            <RectangleHorizontal size={16} /> <span className="hidden sm:inline">{aspect === 'contain' ? '16:9' : 'Preencher'}</span>
          </button>
          <button id="player-fullscreen" tabIndex={0} onClick={toggleFullscreen} className={btn} aria-label="Tela cheia (F)" title="Tela cheia (F)">
            {fullscreen ? <Minimize size={20} className="sm:w-[22px] sm:h-[22px]" /> : <Maximize size={20} className="sm:w-[22px] sm:h-[22px]" />}
          </button>
        </div>
      </div>

      {/* Gaveta Lateral Translúcida do Quick Zap (Mini-EPG / Zapear rápido) */}
      {isLive && showQuickZap && channelsList.length > 0 && (
        <>
          {/* Backdrop para fechar a gaveta ao clicar em qualquer outro lugar da tela */}
          <div
            onClick={(e) => {
              e.stopPropagation()
              setShowQuickZap(false)
            }}
            className="absolute inset-0 z-40 bg-black/60 backdrop-blur-xs cursor-pointer touch-manipulation"
          />
          <div className="absolute inset-y-0 left-0 w-72 sm:w-96 max-w-[85vw] bg-zinc-950/95 backdrop-blur-xl border-r border-white/15 z-50 flex flex-col shadow-2xl fade-up select-none">
          {/* Topo do Quick Zap */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-rose-600 text-white">
                <Tv size={16} />
              </div>
              <span className="font-bold text-sm text-white">Guia Rápido de Canais</span>
            </div>
            <button
              onClick={() => setShowQuickZap(false)}
              className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer focus:ring-2 focus:ring-rose-500 focus:outline-none"
              title="Fechar Guia"
            >
              <X size={18} />
            </button>
          </div>

          {/* Busca rápida de canal */}
          <div className="p-3 border-b border-white/5">
            <div className="relative flex items-center">
              <Search size={14} className="absolute left-3 text-zinc-400" />
              <input
                type="text"
                value={quickZapFilter}
                onChange={(e) => setQuickZapFilter(e.target.value)}
                placeholder="Buscar canal..."
                className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Lista de canais */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
            {channelsList
              .filter((ch) => !quickZapFilter || ch.name.toLowerCase().includes(quickZapFilter.toLowerCase()))
              .map((ch, idx) => {
                const isCurrent = ch.name === title || (channelLabel && channelLabel.includes(ch.name))
                return (
                  <button
                    key={ch.key}
                    tabIndex={0}
                    data-quickzap-item="true"
                    data-quickzap-current={isCurrent ? 'true' : undefined}
                    onClick={() => {
                      onSelectChannel?.(ch)
                      setShowQuickZap(false)
                    }}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white/25 ${
                      isCurrent
                        ? 'bg-rose-600 text-white font-bold shadow-lg shadow-rose-950/50'
                        : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="text-xs text-zinc-400 tabular-nums w-6 shrink-0">{idx + 1}</span>
                    {ch.image ? (
                      <img src={ch.image} alt="" className="w-7 h-7 object-contain rounded bg-black/40 shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded bg-zinc-800 flex items-center justify-center shrink-0">
                        <Tv size={14} className="text-zinc-500" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs truncate font-medium">{ch.name}</p>
                    </div>
                    {isCurrent && (
                      <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded uppercase font-bold shrink-0">
                        No Ar
                      </span>
                    )}
                  </button>
                )
              })}
          </div>
        </div>
      </>
    )}

      {/* Botão Flutuante de Pular Abertura (+30s) - Versão Compacta Mobile Elevada Acima da Barra */}
      {isSeries && showFloatingSkip && (
        <div className="absolute bottom-28 right-4 sm:bottom-32 sm:right-8 z-40 transition-all duration-300 select-none">
          <button
            id="player-skip-intro-floating-btn"
            tabIndex={0}
            onClick={handleSkipIntro}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-zinc-950/90 hover:bg-zinc-900 text-white font-bold text-xs sm:text-sm shadow-2xl border border-zinc-700/80 backdrop-blur-md hover:scale-105 active:scale-95 transition-all group cursor-pointer focus:ring-4 focus:ring-rose-500 focus:outline-none focus:border-rose-400 touch-manipulation"
          >
            <FastForward size={14} className="text-rose-500 group-hover:scale-110 transition-transform" />
            <span>Pular Abertura</span>
            <span className="px-1.5 py-0.5 rounded bg-rose-600/30 text-rose-400 text-[10px] font-black border border-rose-500/40">
              +30s
            </span>
          </button>
        </div>
      )}

      {/* 1. Popup de Próximo Episódio aos 40 segundos restantes (duração de 10s com auto-foco) */}
      {isSeries && onNextEpisode && showPrompt40s && nextEpCountdown === null && (
        <div className="absolute bottom-28 right-4 sm:bottom-32 sm:right-8 z-40 transition-all duration-300 fade-up max-w-sm bg-zinc-950/95 border border-zinc-700/80 p-4 rounded-2xl shadow-2xl backdrop-blur-md space-y-3 select-none">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">Próximo Episódio</span>
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 text-[10px] font-bold">
              Disponível
            </span>
          </div>
          {nextEpisodeTitle && (
            <p className="text-sm font-bold text-white line-clamp-1">{nextEpisodeTitle}</p>
          )}
          <div className="flex items-center gap-2 pt-1">
            <button
              id="player-prompt40-play-btn"
              tabIndex={0}
              onClick={handlePlayNextEpisode}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow cursor-pointer focus:ring-4 focus:ring-rose-500 focus:outline-none"
            >
              <SkipForward size={14} />
              <span>Assistir Agora</span>
            </button>
            <button
              id="player-prompt40-cancel-btn"
              tabIndex={0}
              onClick={() => {
                setShowPrompt40s(false)
                setPrompt40sDismissed(true)
                const fallback = document.getElementById('player-progress') || document.getElementById('player-play')
                fallback?.focus()
              }}
              className="py-2.5 px-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition cursor-pointer focus:ring-4 focus:ring-rose-500 focus:outline-none"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* 2. Contagem regressiva de 5 segundos para passar automaticamente */}
      {isSeries && onNextEpisode && nextEpCountdown !== null && !autoNextCancelled && (
        <div className="absolute bottom-28 right-4 sm:bottom-32 sm:right-8 z-40 transition-all duration-300 fade-up max-w-sm bg-zinc-950/95 border border-zinc-700/80 p-4 rounded-2xl shadow-2xl backdrop-blur-md space-y-3 select-none">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">Próximo Episódio</span>
            <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-xs font-black tabular-nums animate-pulse">
              em {nextEpCountdown}s
            </span>
          </div>
          {nextEpisodeTitle && (
            <p className="text-sm font-bold text-white line-clamp-1">{nextEpisodeTitle}</p>
          )}
          <div className="flex items-center gap-2 pt-1">
            <button
              id="player-countdown-play-btn"
              tabIndex={0}
              onClick={handlePlayNextEpisode}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow cursor-pointer focus:ring-4 focus:ring-rose-500 focus:outline-none"
            >
              <SkipForward size={14} />
              <span>Assistir Agora</span>
            </button>
            <button
              id="player-countdown-cancel-btn"
              tabIndex={0}
              onClick={() => {
                setAutoNextCancelled(true)
                setNextEpCountdown(null)
                const fallback = document.getElementById('player-progress') || document.getElementById('player-play')
                fallback?.focus()
              }}
              className="py-2.5 px-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition cursor-pointer focus:ring-4 focus:ring-rose-500 focus:outline-none"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
