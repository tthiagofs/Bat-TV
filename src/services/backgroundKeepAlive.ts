// Serviço aprimorado para manter o processo JS, Web Workers e conexões de rede
// 100% ativas em segundo plano no Safari iOS, PWA (iPhone) e Chrome Mobile.

function createSilentWavUrl(): string {
  // Gera um WAV válido de 3 segundos de silêncio (8000Hz, 8-bit mono PCM)
  // O iOS CoreAudio necessita de um buffer contínuo de vários segundos para
  // não sofrer 'buffer underrun' e suspender o processo ao minimizar o app.
  const sampleRate = 8000
  const durationSec = 3
  const numSamples = sampleRate * durationSec
  const headerSize = 44
  const totalSize = headerSize + numSamples
  const buffer = new Uint8Array(totalSize)

  // Header RIFF
  buffer[0] = 0x52; buffer[1] = 0x49; buffer[2] = 0x46; buffer[3] = 0x46 // 'RIFF'
  const view = new DataView(buffer.buffer)
  view.setUint32(4, 36 + numSamples, true)
  // Header WAVE
  buffer[8] = 0x57; buffer[9] = 0x41; buffer[10] = 0x56; buffer[11] = 0x45 // 'WAVE'
  // Header fmt
  buffer[12] = 0x66; buffer[13] = 0x6d; buffer[14] = 0x74; buffer[15] = 0x20 // 'fmt '
  view.setUint32(16, 16, true) // Subchunk1Size (16 bytes para PCM)
  view.setUint16(20, 1, true)  // AudioFormat (1 = PCM não comprimido)
  view.setUint16(22, 1, true)  // NumChannels (1 = Mono)
  view.setUint32(24, sampleRate, true) // SampleRate
  view.setUint32(28, sampleRate, true) // ByteRate (SampleRate * NumChannels * Bits/8)
  view.setUint16(32, 1, true)  // BlockAlign
  view.setUint16(34, 8, true)  // BitsPerSample (8 bits)
  // Header data
  buffer[36] = 0x64; buffer[37] = 0x61; buffer[38] = 0x74; buffer[39] = 0x61 // 'data'
  view.setUint32(40, numSamples, true)

  // Em 8-bit PCM, 128 (0x80) representa amplitude zero absoluta (silêncio total)
  buffer.fill(128, headerSize)

  const blob = new Blob([buffer], { type: 'audio/wav' })
  return URL.createObjectURL(blob)
}

class BackgroundKeepAliveService {
  private wakeLock: any = null
  private silentAudio: HTMLAudioElement | null = null
  private audioCtx: AudioContext | null = null
  private audioUrl: string | null = null
  private isKeepAliveActive = false
  private releaseWebLock: (() => void) | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      // Re-ativa Wake Lock e Áudio caso o usuário volte ou minimize a aba
      document.addEventListener('visibilitychange', () => {
        if (!this.isKeepAliveActive) return

        if (document.visibilityState === 'visible') {
          this.requestWakeLock()
          this.resumeAudio()
        } else if (document.visibilityState === 'hidden') {
          // Garante que o áudio continue tocando antes do WebKit suspender timers
          this.resumeAudio()
        }
      })

      // Escuta toques do usuário para desbloquear áudio de background com garantia de User Gesture no iOS
      const gestureEvents = ['touchstart', 'touchend', 'click', 'keydown']
      const onUserGesture = () => {
        if (this.isKeepAliveActive) {
          this.resumeAudio()
        }
      }
      gestureEvents.forEach((ev) => {
        window.addEventListener(ev, onUserGesture, { passive: true })
      })
    }
  }

  private async requestWakeLock() {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        if (!this.wakeLock) {
          this.wakeLock = await (navigator as any).wakeLock.request('screen')
          this.wakeLock.addEventListener('release', () => {
            this.wakeLock = null
          })
        }
      } catch {}
    }
  }

  private resumeAudio() {
    if (this.silentAudio) {
      if (this.silentAudio.paused) {
        this.silentAudio.play().catch(() => {})
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {})
    }
  }

  /**
   * Ativa a proteção em background. DEVE ser chamada sincronicamente no clique do usuário (User Gesture).
   */
  public acquire() {
    this.isKeepAliveActive = true

    // 1. Screen Wake Lock (Impede que a tela apague enquanto o app estiver no foco)
    this.requestWakeLock()

    // 2. Web Locks API (Informa ao motor Chromium/WebKit que há uma operação crítica de background em andamento)
    if (typeof navigator !== 'undefined' && 'locks' in navigator && !this.releaseWebLock) {
      navigator.locks
        .request('bat_tv_download_keepalive', () => {
          return new Promise<void>((resolve) => {
            this.releaseWebLock = resolve
          })
        })
        .catch(() => {})
    }

    // 3. Silent Audio Loop para iOS Safari / PWA
    // No WebKit da Apple, uma aba executando áudio não é congelada em background.
    if (typeof window !== 'undefined') {
      try {
        if (!this.audioUrl) {
          this.audioUrl = createSilentWavUrl()
        }
        if (!this.silentAudio) {
          this.silentAudio = new Audio(this.audioUrl)
          this.silentAudio.setAttribute('playsinline', 'true')
          this.silentAudio.setAttribute('webkit-playsinline', 'true')
          this.silentAudio.loop = true
          this.silentAudio.volume = 0.01 // Volume mínimo audível para o CoreAudio registrar sessão ativa
          this.silentAudio.preload = 'auto'
        }

        const playPromise = this.silentAudio.play()
        if (playPromise) {
          playPromise.catch(() => {
            // Fallback imediato para Web Audio API caso o navegador exija AudioContext
            try {
              const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
              if (AudioContextClass && !this.audioCtx) {
                this.audioCtx = new AudioContextClass()
                const silentBuf = this.audioCtx.createBuffer(1, this.audioCtx.sampleRate * 2, this.audioCtx.sampleRate)
                const source = this.audioCtx.createBufferSource()
                source.buffer = silentBuf
                source.loop = true
                source.connect(this.audioCtx.destination)
                source.start(0)
              } else if (this.audioCtx && this.audioCtx.state === 'suspended') {
                this.audioCtx.resume().catch(() => {})
              }
            } catch {}
          })
        }
      } catch {}

      // 4. MediaSession API (Registra oficialmente o app na Central de Controle e Tela Bloqueada do iOS)
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        try {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: 'Baixando em segundo plano...',
            artist: 'Bat-TV',
            album: 'Downloads Offline',
          })
          navigator.mediaSession.playbackState = 'playing'
          navigator.mediaSession.setActionHandler('play', () => {
            this.resumeAudio()
          })
          navigator.mediaSession.setActionHandler('pause', () => {
            // Mantém ativo mesmo se o sistema emitir evento de pausa
            this.resumeAudio()
          })
        } catch {}
      }
    }
  }

  /**
   * Libera os recursos de background quando a fila inteira de downloads for finalizada.
   */
  public release() {
    this.isKeepAliveActive = false

    if (this.wakeLock) {
      try {
        this.wakeLock.release()
      } catch {}
      this.wakeLock = null
    }

    if (this.releaseWebLock) {
      try {
        this.releaseWebLock()
      } catch {}
      this.releaseWebLock = null
    }

    if (this.silentAudio) {
      try {
        this.silentAudio.pause()
        this.silentAudio.currentTime = 0
      } catch {}
    }

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        this.audioCtx.close().catch(() => {})
      } catch {}
      this.audioCtx = null
    }

    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = 'none'
      } catch {}
    }
  }

  public isActive(): boolean {
    return this.isKeepAliveActive
  }
}

export const backgroundKeepAlive = new BackgroundKeepAliveService()
