const CACHE_NAME = 'bat-tv-pwa-v2'
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
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Ignora falha de algum recurso pontual
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

  // 1. Atende requisições de vídeos offline baixados (/offline-media/...) com suporte a Range (iOS Safari)
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
          const blob = await cachedRes.blob()
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

  // 2. Não intercepta streams externos que não sejam GET
  if (event.request.method !== 'GET') return
  if (
    url.pathname.endsWith('.m3u8') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.includes('/live/') ||
    url.pathname.includes('/movie/') ||
    url.pathname.includes('/series/') ||
    url.hostname.includes('site.api.espn.com')
  ) {
    return
  }

  // 3. Para navegação de páginas (HTML)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html') || caches.match('/')
      })
    )
    return
  }

  // 3. Stale-while-revalidate para recursos estáticos (CSS, JS, imagens locais)
  if (
    url.origin === self.location.origin ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone()
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, copy)
              })
            }
            return networkResponse
          })
          .catch(() => cachedResponse)

        return cachedResponse || fetchPromise
      })
    )
  }
})
