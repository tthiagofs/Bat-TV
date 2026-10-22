const CACHE_NAME = 'bat-tv-pwa-v7'
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

// Interceptação de requisições
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // 1. Atende requisições de vídeos offline baixados (/offline-media/...) com suporte a HTTP 206 Range (iOS Safari)
  if (url.pathname.startsWith('/offline-media/')) {
    event.respondWith(
      caches.open('bat-tv-media-cache').then(async (cache) => {
        const cachedRes = await cache.match(event.request.url)
        if (!cachedRes) {
          return new Response('Vídeo offline não encontrado', { status: 404 })
        }

        const rangeHeader = event.request.headers.get('range')
        if (!rangeHeader) {
          return cachedRes
        }

        // Suporte a HTTP 206 Partial Content para iOS Safari conseguir dar seek e reproduzir offline
        try {
          if (!self._videoBlobCache) self._videoBlobCache = new Map()
          let blob = self._videoBlobCache.get(event.request.url)
          if (!blob) {
            blob = await cachedRes.blob()
            self._videoBlobCache.set(event.request.url, blob)
            setTimeout(() => self._videoBlobCache.delete(event.request.url), 30 * 60 * 1000)
          }

          const totalSize = blob.size
          const parts = rangeHeader.replace(/bytes=/, '').split('-')
          const start = parseInt(parts[0], 10) || 0
          const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1
          const sliced = blob.slice(start, end + 1)

          return new Response(sliced, {
            status: 206,
            statusText: 'Partial Content',
            headers: {
              'Content-Type': 'video/mp4',
              'Content-Range': `bytes ${start}-${end}/${totalSize}`,
              'Content-Length': String(sliced.size),
              'Accept-Ranges': 'bytes',
            },
          })
        } catch {
          return cachedRes
        }
      })
    )
    return
  }

  // 2. Não intercepta streams de vídeo ao vivo remotos, proxies ou APIs externas (permite streaming HTTP nativo)
  if (event.request.method !== 'GET') return
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

  // 3. Para navegação de páginas (HTML shell do app no Safari iOS e PWA)
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

  // 4. Recursos estáticos da aplicação (JS, CSS, Imagens, Fontes)
  // Cache-first com atualização em segundo plano para garantir carregamento instantâneo offline
  if (
    url.origin === self.location.origin ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Atualiza o cache silenciosamente em background se houver internet
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const copy = networkResponse.clone()
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, copy)
                })
              }
            })
            .catch(() => {})
          return cachedResponse
        }

        // Não estava no cache: busca na rede e guarda no cache
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone()
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, copy)
              })
            }
            return networkResponse
          })
          .catch(() => {
            return cachedResponse || new Response('', { status: 408 })
          })
      })
    )
  }
})
