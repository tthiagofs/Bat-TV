import { Capacitor, CapacitorHttp } from '@capacitor/core'

export interface Credentials {
  server: string
  username: string
  password: string
}

export interface UserInfo {
  username: string
  status: string
  exp_date: string | null
  is_trial: string
  active_cons: string
  max_connections: string
}

export interface AuthResponse {
  user_info: UserInfo & { auth: number }
  server_info: { url: string; port: string; https_port: string; server_protocol: string }
}

export interface Category {
  category_id: string
  category_name: string
  parent_id: number
}

export interface LiveStream {
  num: number
  name: string
  stream_id: number
  stream_icon: string
  epg_channel_id: string | null
  category_id: string
}

export interface VodStream {
  num: number
  name: string
  stream_id: number
  stream_icon: string
  rating: string
  category_id: string
  container_extension: string
}

export interface Series {
  num: number
  name: string
  series_id: number
  cover: string
  plot: string
  rating: string
  category_id: string
}

export interface Episode {
  id: string
  title: string
  episode_num: number
  container_extension: string
  season?: number
  info?: { movie_image?: string; plot?: string; duration?: string }
}

export interface SeriesInfo {
  info: { name: string; cover: string; plot: string; rating: string }
  episodes: Record<string, Episode[]>
}

export interface EpgEntry {
  title: string
  description: string
  /** timestamps em segundos (Unix) */
  start: number
  end: number
}

function b64(s: string | undefined): string {
  if (!s) return ''
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)))
  } catch {
    return s
  }
}

export function normalizeServer(url: string): string {
  let u = url.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(u)) u = 'http://' + u
  return u
}

export class XtreamService {
  private base: string
  constructor(private creds: Credentials) {
    this.base = normalizeServer(creds.server)
  }

  /** Identificador estável da conexão (usado em caches) */
  get id(): string {
    return `${this.base}|${this.creds.username}`
  }

  private async call<T>(action?: string, extra: Record<string, string | number> = {}): Promise<T> {
    const params = new URLSearchParams({
      username: this.creds.username,
      password: this.creds.password,
    })
    if (action) params.set('action', action)
    for (const [k, v] of Object.entries(extra)) params.set(k, String(v))
    const fullUrl = `${this.base}/player_api.php?${params}`

    // 1. Se estiver rodando no Fire Stick / Android nativo, usa CapacitorHttp com suporte a 301/302 redirects
    if (Capacitor.isNativePlatform()) {
      let currentUrl = fullUrl
      let redirectsLeft = 5

      while (redirectsLeft > 0) {
        try {
          const response = await CapacitorHttp.get({
            url: currentUrl,
            headers: {
              'User-Agent': 'IPTVSmarters/1.0.0 (Linux; Android 10; Fire TV)',
              Accept: '*/*',
            },
            connectTimeout: 20000,
            readTimeout: 25000,
          })

          // Se o servidor responder com redirect (Load Balancer de IPTV 301/302)
          if ([301, 302, 307, 308].includes(response.status)) {
            const location = response.headers?.['Location'] || response.headers?.['location']
            if (location) {
              currentUrl = new URL(location, currentUrl).toString()
              redirectsLeft--
              continue
            }
          }

          if (response.status >= 200 && response.status < 300) {
            const body = response.data
            return (typeof body === 'string' ? JSON.parse(body) : body) as T
          }
          throw new Error(`Erro HTTP ${response.status}`)
        } catch (err: any) {
          console.error('Erro na requisição nativa Xtream:', err)
          throw new Error(`Não foi possível acessar o servidor "${this.base}". Verifique o endereço (host e porta).`)
        }
      }
      throw new Error(`Muitos redirecionamentos no servidor "${this.base}".`)
    }

    // 2. Ambiente Electron (Desktop PC): faz fetch direto sem tentar proxy local inexistente
    const isElectronEnv = typeof window !== 'undefined' && (
      window.navigator.userAgent.toLowerCase().includes('electron') ||
      window.location.protocol === 'file:'
    )

    if (isElectronEnv) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 15000)
      try {
        const direct = await fetch(fullUrl, { signal: controller.signal })
        clearTimeout(timer)
        if (!direct.ok) throw new Error(`Erro HTTP ${direct.status}`)
        return (await direct.json()) as T
      } catch {
        clearTimeout(timer)
        throw new Error(`Não foi possível acessar o servidor "${this.base}". Verifique o endereço (host e porta).`)
      }
    }

    // 3. Ambiente Web (Navegador com servidor Vite): usa o proxy local para contornar bloqueio de CORS
    if (import.meta.env.DEV) {
      try {
        const proxyUrl = `/iptv-proxy?url=${encodeURIComponent(fullUrl)}`
        const res = await fetch(proxyUrl)
        if (res.ok) {
          return (await res.json()) as T
        }
      } catch {
        // Se não estiver em dev server, tenta fetch direto
      }
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    try {
      const direct = await fetch(fullUrl, { signal: controller.signal })
      clearTimeout(timer)
      if (!direct.ok) throw new Error(`Erro HTTP ${direct.status}`)
      return (await direct.json()) as T
    } catch {
      clearTimeout(timer)
      throw new Error(`Não foi possível acessar o servidor "${this.base}". Verifique o endereço (host e porta).`)
    }
  }


  async authenticate(): Promise<AuthResponse> {
    const data = await this.call<AuthResponse>()
    if (!data?.user_info || Number(data.user_info.auth) !== 1) {
      throw new Error('Credenciais inválidas')
    }
    return data
  }

  getLiveCategories() { return this.call<Category[]>('get_live_categories') }
  getVodCategories() { return this.call<Category[]>('get_vod_categories') }
  getSeriesCategories() { return this.call<Category[]>('get_series_categories') }

  getLiveStreams(categoryId?: string) {
    return this.call<LiveStream[]>('get_live_streams', categoryId ? { category_id: categoryId } : {})
  }
  getVodStreams(categoryId?: string) {
    return this.call<VodStream[]>('get_vod_streams', categoryId ? { category_id: categoryId } : {})
  }
  getSeries(categoryId?: string) {
    return this.call<Series[]>('get_series', categoryId ? { category_id: categoryId } : {})
  }
  getSeriesInfo(seriesId: number) {
    return this.call<SeriesInfo>('get_series_info', { series_id: seriesId })
  }

  /** Programação do canal (agora + próximos). Retorna [] se o provedor não tiver EPG. */
  async getShortEpg(streamId: number, limit = 4): Promise<EpgEntry[]> {
    const data = await this.call<{ epg_listings?: Array<Record<string, string | number>> }>(
      'get_short_epg', { stream_id: streamId, limit },
    )
    return (data?.epg_listings ?? [])
      .map((e) => ({
        title: b64(String(e.title ?? '')),
        description: b64(String(e.description ?? '')),
        start: Number(e.start_timestamp),
        end: Number(e.stop_timestamp),
      }))
      .filter((e) => e.title && e.end > e.start)
  }

  /** URL de canal ao vivo. Formato 'm3u8' (HLS) ou 'ts'. */
  liveUrl(streamId: number, format: 'm3u8' | 'ts' = 'm3u8'): string {
    const { username, password } = this.creds
    return `${this.base}/live/${username}/${password}/${streamId}.${format}`
  }
  vodUrl(streamId: number, ext = 'mp4'): string {
    const { username, password } = this.creds
    return `${this.base}/movie/${username}/${password}/${streamId}.${ext}`
  }
  episodeUrl(episodeId: string, ext = 'mp4'): string {
    const { username, password } = this.creds
    return `${this.base}/series/${username}/${password}/${episodeId}.${ext}`
  }
}
