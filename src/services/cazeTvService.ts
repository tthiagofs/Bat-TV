import type { MediaItem } from '../types'
import { buildProxyUrl } from './proxyConfig'
import { Capacitor } from '@capacitor/core'

const CAZE_CHANNEL_ID = 'UCZiYbVptd3PVPf4f6eR6UaQ'
let cachedLiveVideoId: string | null = null
let cacheTimestamp = 0

/**
 * Resolve a URL do player do YouTube para a transmissão oficial ao vivo da CazéTV.
 */
export async function getCazeTvLiveEmbedUrl(): Promise<string> {
  const now = Date.now()
  if (cachedLiveVideoId && now - cacheTimestamp < 120_000) {
    return `https://www.youtube-nocookie.com/embed/${cachedLiveVideoId}?autoplay=1&rel=0&modestbranding=1`
  }

  const isWeb = typeof window !== 'undefined' &&
    !window.navigator.userAgent.toLowerCase().includes('electron') &&
    window.location.protocol !== 'file:' &&
    !Capacitor.isNativePlatform()

  const targetUrl = 'https://www.youtube.com/@CazeTV/live'
  const fetchUrl = isWeb ? buildProxyUrl(targetUrl) : targetUrl

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)

    const res = await fetch(fetchUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })
    clearTimeout(timer)

    if (res.ok) {
      const text = await res.text()
      const match = text.match(/"videoId":"([a-zA-Z0-9_-]{11})"/)
      if (match && match[1]) {
        cachedLiveVideoId = match[1]
        cacheTimestamp = now
        return `https://www.youtube-nocookie.com/embed/${match[1]}?autoplay=1&rel=0&modestbranding=1`
      }
    }
  } catch (err) {
    console.warn('Erro ao resolver stream ao vivo da CazéTV via YouTube:', err)
  }

  // Fallback garantido usando o channel_id oficial
  return `https://www.youtube-nocookie.com/embed/live_stream?channel=${CAZE_CHANNEL_ID}&autoplay=1&rel=0`
}

/**
 * Retorna o link direto oficial para assistir a transmissão ao vivo da CazéTV no YouTube.
 * Abre diretamente no app do YouTube no Fire TV Stick / Celular ou no navegador do PC,
 * contornando qualquer bloqueio de incorporação (iframe) da LiveMode O&O.
 */
export async function getCazeTvWatchUrl(): Promise<string> {
  const now = Date.now()
  if (cachedLiveVideoId && now - cacheTimestamp < 120_000) {
    return `https://www.youtube.com/watch?v=${cachedLiveVideoId}`
  }

  const isWeb = typeof window !== 'undefined' &&
    !window.navigator.userAgent.toLowerCase().includes('electron') &&
    window.location.protocol !== 'file:' &&
    !Capacitor.isNativePlatform()

  const targetUrl = 'https://www.youtube.com/@CazeTV/live'
  const fetchUrl = isWeb ? buildProxyUrl(targetUrl) : targetUrl

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)

    const res = await fetch(fetchUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })
    clearTimeout(timer)

    if (res.ok) {
      const text = await res.text()
      const match = text.match(/"videoId":"([a-zA-Z0-9_-]{11})"/)
      if (match && match[1]) {
        cachedLiveVideoId = match[1]
        cacheTimestamp = now
        return `https://www.youtube.com/watch?v=${match[1]}`
      }
    }
  } catch (err) {
    console.warn('Erro ao resolver link direto da CazéTV no YouTube:', err)
  }

  return 'https://www.youtube.com/@CazeTV/live'
}

/**
 * Abre a transmissão oficial da CazéTV diretamente no YouTube.
 * No Fire TV Stick, aciona o app oficial do YouTube na TV.
 * No PC / Web, abre a transmissão oficial em uma nova aba com qualidade máxima.
 */
export async function openCazeTvLive(): Promise<void> {
  const watchUrl = await getCazeTvWatchUrl()
  if (Capacitor.isNativePlatform()) {
    window.open(watchUrl, '_system')
  } else {
    window.open(watchUrl, '_blank')
  }
}

/**
 * Cria o item de canal virtual da CazéTV para ser reproduzido diretamente no player do app.
 */
export function createCazeTvVirtualChannel(embedUrl: string): MediaItem {
  return {
    key: 'youtube:cazetv',
    id: 999901,
    name: 'CazéTV (Ao Vivo no YouTube)',
    type: 'live',
    url: embedUrl,
    image: 'https://yt3.googleusercontent.com/ytc/AIdro_k9_f96l5n-qGk1Fv2rV-w8eG4gQh9C8m4z7d9A=s900-c-k-c0x00ffffff-no-rj',
  }
}

