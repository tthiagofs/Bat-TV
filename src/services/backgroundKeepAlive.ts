// Serviço para manter o processo JS e conexões de rede ativas em segundo plano no Safari iOS e Chrome Mobile
class BackgroundKeepAliveService {
  private wakeLock: any = null
  private silentAudio: HTMLAudioElement | null = null
  private audioCtx: AudioContext | null = null
  private activeCount = 0

  public async acquire() {
    this.activeCount++
    if (this.activeCount > 1) return

    // 1. Screen Wake Lock (Impede que a tela do celular apague/durma durante downloads)
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        this.wakeLock = await (navigator as any).wakeLock.request('screen')
        this.wakeLock.addEventListener('release', () => {
          this.wakeLock = null
        })
      } catch {}
    }

    // 2. Silent Audio Loop (Garante que o iOS Safari e Android Chrome concedam privilégio de áudio em background)
    // No iOS WebKit, abas com áudio ativo continuam executando JavaScript e conexões fetch mesmo se o usuário mudar de app
    if (typeof window !== 'undefined') {
      try {
        if (!this.silentAudio) {
          // WAV silencioso de 1s codificado em base64 (tamanho mínimo, 0kbps)
          const silentWavBase64 =
            'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAP8A/w=='
          this.silentAudio = new Audio(silentWavBase64)
          this.silentAudio.loop = true
          this.silentAudio.volume = 0.01
        }
        this.silentAudio.play().catch(() => {
          // Fallback para Web Audio API se a política do navegador exigir contexto
          try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
            if (AudioContextClass && !this.audioCtx) {
              this.audioCtx = new AudioContextClass()
              const osc = this.audioCtx.createOscillator()
              const gain = this.audioCtx.createGain()
              gain.gain.value = 0.0001
              osc.connect(gain)
              gain.connect(this.audioCtx.destination)
              osc.start()
            }
          } catch {}
        })
      } catch {}
    }
  }

  public release() {
    this.activeCount = Math.max(0, this.activeCount - 1)
    if (this.activeCount === 0) {
      if (this.wakeLock) {
        try {
          this.wakeLock.release()
        } catch {}
        this.wakeLock = null
      }
      if (this.silentAudio) {
        try {
          this.silentAudio.pause()
        } catch {}
      }
      if (this.audioCtx && this.audioCtx.state !== 'closed') {
        try {
          this.audioCtx.close()
        } catch {}
        this.audioCtx = null
      }
    }
  }
}

export const backgroundKeepAlive = new BackgroundKeepAliveService()
