/**
 * Coordenador Global de Trailers e Áudio (BAT TV)
 * - Mantém o volume ativado por padrão em todo o aplicativo (conforme solicitado).
 * - Sincroniza o estado de mudo/desmudo entre o Hero Banner e todas as mini-telas.
 * - Garante que APENAS UM trailer toque por vez em todo o app (evita 2 vídeos simultâneos).
 */

type Listener = () => void

class TrailerCoordinator {
  // Volume ativado por padrão toda vez que abre o app (a não ser que o usuário tenha desativado e salvo)
  private _isMuted: boolean = false
  // ID do trailer atualmente em reprodução (ex: 'hero-123' ou 'card-456')
  private _activeTrailerId: string | null = null
  private listeners: Set<Listener> = new Set()

  constructor() {
    try {
      const saved = localStorage.getItem('iptv_trailer_muted')
      // Se já houver preferência salva, usa; senão, padrão é FALSE (som ATIVADO)
      if (saved !== null) {
        this._isMuted = saved === 'true'
      } else {
        this._isMuted = false
      }
    } catch {
      this._isMuted = false
    }
  }

  get isMuted(): boolean {
    return this._isMuted
  }

  get activeTrailerId(): string | null {
    return this._activeTrailerId
  }

  setMuted(muted: boolean) {
    if (this._isMuted === muted) return
    this._isMuted = muted
    try {
      localStorage.setItem('iptv_trailer_muted', String(muted))
    } catch {}
    this.notify()
  }

  toggleMuted() {
    this.setMuted(!this._isMuted)
  }

  /**
   * Registra um trailer como o único ativo. Se outro estiver tocando, ele será desativado.
   */
  requestPlay(id: string): boolean {
    if (this._activeTrailerId === id) return true
    this._activeTrailerId = id
    this.notify()
    return true
  }

  /**
   * Notifica que um trailer parou ou foi fechado.
   */
  releasePlay(id: string) {
    if (this._activeTrailerId === id) {
      this._activeTrailerId = null
      this.notify()
    }
  }

  /**
   * Para todos os trailers imediatamente (ex: ao rolar a página ou abrir um player de vídeo real).
   */
  stopAll() {
    if (this._activeTrailerId !== null) {
      this._activeTrailerId = null
      this.notify()
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify() {
    for (const l of this.listeners) {
      try {
        l()
      } catch (err) {
        console.error('Erro no listener do TrailerCoordinator:', err)
      }
    }
  }
}

export const trailerCoordinator = new TrailerCoordinator()
