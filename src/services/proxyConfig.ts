/**
 * Configuração Centralizada de Proxy para Streaming e Downloads
 * 
 * Permite usar um Cloudflare Worker externo gratuito (com tráfego ilimitado)
 * para não consumir a cota de 10 GB da Vercel.
 */

const STORAGE_KEY = 'iptv-rea:custom-proxy'

export function getCustomProxy(): string {
  if (typeof window === 'undefined') return ''
  try {
    const saved = (localStorage.getItem(STORAGE_KEY) || '').trim()
    // Se o usuário tiver salvo o worker antigo que estava com erro 500 (bat-tv-proxy.thiagofelipefreire.workers.dev),
    // remove automaticamente para restaurar a reprodução imediata via proxy Vercel
    if (saved && saved.includes('bat-tv-proxy.thiagofelipefreire.workers.dev')) {
      localStorage.removeItem(STORAGE_KEY)
      return ''
    }
    return saved
  } catch {
    return ''
  }
}

export function setCustomProxy(url: string) {
  if (typeof window === 'undefined') return
  try {
    if (url && url.trim()) {
      localStorage.setItem(STORAGE_KEY, url.trim().replace(/\/+$/, ''))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {}
}

export function getLocalProxyEndpoint(): string {
  const path = import.meta.env.DEV ? '/iptv-proxy' : '/api/proxy'
  if (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http')) {
    return `${window.location.origin}${path}`
  }
  return path
}

export function getProxyEndpoint(forceLocal = false): string {
  if (!forceLocal) {
    // 1. Prioridade 1: Proxy customizado salvo no navegador (se configurado pelo usuário)
    const custom = getCustomProxy()
    if (custom) return custom

    // 2. Prioridade 2: Variável de ambiente VITE_PROXY_URL configurada na Vercel (.env)
    const envProxy = import.meta.env.VITE_PROXY_URL
    if (envProxy && typeof envProxy === 'string' && envProxy.trim()) {
      return envProxy.trim().replace(/\/+$/, '')
    }
  }

  // 3. Fallback: Proxy local (Vercel /api/proxy ou Vite /iptv-proxy)
  return getLocalProxyEndpoint()
}

export interface BuildProxyOptions {
  forceLocal?: boolean
  forceLocalProxy?: boolean
}

export function buildProxyUrl(rawUrl: string, options?: BuildProxyOptions): string {
  if (!rawUrl) return ''
  const normalized = rawUrl.trim().replace(/^https?:/i, (m) => m.toLowerCase())
  const shouldForceLocal = Boolean(options?.forceLocal || options?.forceLocalProxy)
  const endpoint = getProxyEndpoint(shouldForceLocal)
  const path = `${endpoint}?url=${encodeURIComponent(normalized)}`
  if (typeof window !== 'undefined' && path.startsWith('/') && window.location.origin) {
    return `${window.location.origin}${path}`
  }
  return path
}
