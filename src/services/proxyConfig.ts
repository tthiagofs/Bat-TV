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

export function getProxyEndpoint(): string {
  // 1. Prioridade 1: Proxy customizado salvo no navegador
  const custom = getCustomProxy()
  if (custom) return custom

  // 2. Prioridade 2: Variável de ambiente VITE_PROXY_URL configurada na Vercel (.env)
  const envProxy = import.meta.env.VITE_PROXY_URL
  if (envProxy && typeof envProxy === 'string' && envProxy.trim()) {
    return envProxy.trim().replace(/\/+$/, '')
  }

  // 3. Fallback: Proxy Serverless local da Vercel
  return import.meta.env.DEV ? '/iptv-proxy' : '/api/proxy'
}

export function buildProxyUrl(rawUrl: string): string {
  if (!rawUrl) return ''
  const endpoint = getProxyEndpoint()
  return `${endpoint}?url=${encodeURIComponent(rawUrl)}`
}
