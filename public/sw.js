const CACHE_NAME = 'bat-tv-pwa-v9'
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

  // 1. Não intercepta streams de vídeo ao vivo remotos, proxies ou APIs externas (permite streaming HTTP nativo instantâneo)
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
