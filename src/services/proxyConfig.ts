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
    return (localStorage.getItem(STORAGE_KEY) || '').trim()
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

export function getWorkerEndpoint(): string {
  // 1. Prioridade 1: Proxy customizado salvo no navegador
  const custom = getCustomProxy()
  if (custom) return custom

  // 2. Prioridade 2: Variável de ambiente VITE_PROXY_URL configurada na Vercel (.env)
  const envProxy = import.meta.env.VITE_PROXY_URL
  if (envProxy && typeof envProxy === 'string' && envProxy.trim()) {
    return envProxy.trim().replace(/\/+$/, '')
  }

  return ''
}

export function getLocalProxyEndpoint(): string {
  const path = import.meta.env.DEV ? '/iptv-proxy' : '/api/proxy'
  if (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http')) {
    return `${window.location.origin}${path}`
  }
  return path
}

export function getProxyEndpoint(): string {
  const worker = getWorkerEndpoint()
  if (worker) return worker
  return import.meta.env.DEV ? '/iptv-proxy' : '/api/proxy'
}

/**
 * Verifica se a URL pode ir diretamente para o Cloudflare Worker sem precisar
 * resolver redirecionamento 302 no auth router do servidor IPTV.
 * Servidores Xtream (como auth.xplist.vip) bloqueiam o IP sintético do Cloudflare Worker (erro 500)
 * na rota inicial de stream (/live/, /movie/, /series/), mas os servidores finais de mídia
 * (/vauth/, /rauth/, IPs de storage) aceitam o Cloudflare Worker normalmente com banda ilimitada.
 */
function isDirectWorkerCompatible(url: string): boolean {
  const lower = url.toLowerCase()
  if (
    lower.includes('player_api.php') ||
    lower.includes('xmltv.php') ||
    lower.includes('site.api.espn.com') ||
    lower.includes('youtube.com') ||
    lower.includes('googlevideo.com')
  ) {
    return true
  }
  try {
    const u = new URL(url)
    if (
      u.pathname.includes('/vauth/') ||
      u.pathname.includes('/rauth/') ||
      u.hostname.endsWith('.nip.io') ||
      /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(u.hostname)
    ) {
      return true
    }
  } catch {}
  return false
}

export interface BuildProxyOptions {
  forceLocalProxy?: boolean
}

export function buildProxyUrl(rawUrl: string, options?: BuildProxyOptions): string {
  if (!rawUrl) return ''
  const normalized = rawUrl.trim().replace(/^https?:/i, (m) => m.toLowerCase())
  const localEndpoint = getLocalProxyEndpoint()

  if (options?.forceLocalProxy) {
    return `${localEndpoint}?url=${encodeURIComponent(normalized)}`
  }

  const worker = getWorkerEndpoint()
  if (!worker) {
    return `${localEndpoint}?url=${encodeURIComponent(normalized)}`
  }

  // APIs (catálogo, EPG, esportes) e URLs de storage já resolvidas vão direto ao Worker
  if (isDirectWorkerCompatible(normalized)) {
    return `${worker}?url=${encodeURIComponent(normalized)}`
  }

  // Streams de vídeo (/live/, /movie/, /series/) resolvem o 302 inicial via /api/proxy (IPv4)
  // e fazem handoff automático (302) para o Cloudflare Worker fazer o streaming sem gastar banda da Vercel
  return `${localEndpoint}?worker=${encodeURIComponent(worker)}&url=${encodeURIComponent(normalized)}`
}

