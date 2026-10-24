const CACHE_NAME = 'bat-tv-pwa-v10'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.png',
  '/icon.png',
  '/logo.png'
]

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Falha pontual ao pré-cachear ativos estáticos:', err)
      })
    }).then(() => self.skipWaiting())
  )
})

// Ativação e limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== 'bat-tv-media-cache') {
            return caches.delete(key)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})

/**
 * Atende requisições de mídia baixada offline (/offline-media/*) com suporte a HTTP 206 Partial Content (Range)
 * Essencial para que o Safari iOS / WebKit não trave e reproduza vídeos offline com estabilidade.
 */
async function handleOfflineMedia(request) {
  try {
    const cache = await caches.open('bat-tv-media-cache')
    const url = new URL(request.url)
    let response = await cache.match(request) || await cache.match(url.pathname)
    if (!response) {
      const filename = url.pathname.split('/').pop()
      response = await cache.match(`/offline-media/${filename}`)
    }

    if (!response) {
      return new Response('Vídeo offline não encontrado', { status: 404 })
    }

    const rangeHeader = request.headers.get('range')
    if (!rangeHeader) {
      return response
    }

    const blob = await response.blob()
    const totalSize = blob.size

    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
    if (!match) {
      return response
    }

    const start = parseInt(match[1], 10)
    let end = match[2] ? parseInt(match[2], 10) : totalSize - 1

    if (start >= totalSize || end >= totalSize || start > end) {
      return new Response('Range Inválido', {
        status: 416,
        headers: { 'Content-Range': `bytes */${totalSize}` }
      })
    }

    // Fatia exatamente os bytes solicitados pelo player Safari iOS / Chrome
    const chunk = blob.slice(start, end + 1, 'video/mp4')

    return new Response(chunk, {
      status: 206,
      statusText: 'Partial Content',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Content-Length': String(chunk.size),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000'
      }
    })
  } catch (err) {
    console.error('Erro ao servir mídia offline via SW:', err)
    return new Response('Erro ao ler mídia offline', { status: 500 })
  }
}

// Interceptação de requisições
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  if (event.request.method !== 'GET') return

  // 1. Intercepta imediatamente mídias baixadas offline (/offline-media/*)
  if (url.pathname.startsWith('/offline-media/')) {
    event.respondWith(handleOfflineMedia(event.request))
    return
  }
  if (
    event.request.destination === 'video' ||
    event.request.destination === 'audio' ||
    event.request.headers.has('range') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/iptv-proxy') ||
    url.searchParams.has('url') ||
    url.pathname.endsWith('.m3u8') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.mp4') ||
    url.pathname.endsWith('.mkv') ||
    url.pathname.includes('/live/') ||
    url.pathname.includes('/movie/') ||
    url.pathname.includes('/series/') ||
    url.hostname.includes('workers.dev') ||
    url.hostname.includes('site.api.espn.com') ||
    url.hostname.includes('themoviedb.org') ||
    url.hostname.includes('tmdb.org')
  ) {
    return
  }

  // 2. Para navegação de páginas (HTML shell do app no Safari iOS e PWA)
  // Network-first com fallback imediato para o cache quando estiver offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, copy)
              cache.put('/index.html', copy.clone())
              cache.put('/', copy.clone())
            })
          }
          return networkResponse
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME)
          const cached =
            (await cache.match(event.request)) ||
            (await cache.match('/index.html')) ||
            (await cache.match('/'))
          if (cached) return cached
          return new Response('Offline', { status: 503, statusText: 'Offline' })
        })
    )
    return
  }

  // 3. Recursos estáticos da aplicação (JS, CSS, Imagens, Fontes)
  // Cache-first com atualização em segundo plano para garantir carregamento instantâneo offline
  if (
    url.origin === self.location.origin ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Atualiza em background para a próxima visita (Stale-While-Revalidate)
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const responseToCache = networkResponse.clone()
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, responseToCache)
                })
              }
            })
            .catch(() => {})
          return cachedResponse
        }

        return fetch(event.request)
          .then((networkResponse) => {
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse
            }
            const responseToCache = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache)
            })
            return networkResponse
          })
          .catch(() => {
            // Se offline e solicitar imagem, retorna vazio sem crashar
            if (event.request.destination === 'image') {
              return new Response('', { status: 408, headers: { 'Content-Type': 'image/png' } })
            }
            return new Response('Offline', { status: 503 })
          })
      })
    )
  }
})
