const CACHE_NAME = 'bat-tv-pwa-v8'
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

// Helper para recuperar Blob do IndexedDB quando o Cache Storage estiver indisponível ou com cota excedida
function getBlobFromIndexedDB(id) {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('bat-tv-downloads-db', 2)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
      req.onsuccess = () => {
        const db = req.result
        try {
          const tx = db.transaction('media_blobs', 'readonly')
          const store = tx.objectStore('media_blobs')
          const getReq = store.get(id)
          getReq.onsuccess = () => {
            if (getReq.result && getReq.result.blob) {
              resolve(getReq.result.blob)
            } else {
              resolve(null)
            }
          }
          getReq.onerror = () => resolve(null)
        } catch {
          resolve(null)
        }
      }
    } catch {
      resolve(null)
    }
  })
}

// Interceptação de requisições
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // 1. Atende requisições de vídeos offline baixados (/offline-media/...) com suporte a HTTP 206 Range (iOS Safari)
  if (url.pathname.startsWith('/offline-media/')) {
    event.respondWith(
      (async () => {
        const idMatch = url.pathname.match(/\/offline-media\/(.+?)\.mp4$/i)
        const mediaId = idMatch ? decodeURIComponent(idMatch[1]) : ''

        if (!self._videoBlobCache) self._videoBlobCache = new Map()
        let blob = self._videoBlobCache.get(url.pathname)

        // 1.1 Se não está na memória temporária do SW, busca no Cache Storage
        if (!blob) {
          try {
            const cache = await caches.open('bat-tv-media-cache')
            const matchRes = (await cache.match(event.request.url)) || (await cache.match(url.pathname))
            if (matchRes) {
              blob = await matchRes.blob()
            }
          } catch {}
        }

        // 1.2 Se não encontrou no Cache Storage, busca diretamente no IndexedDB do app
        if (!blob && mediaId) {
          try {
            blob = await getBlobFromIndexedDB(mediaId)
          } catch {}
        }

        if (!blob || blob.size === 0) {
          return new Response('Vídeo offline não encontrado no armazenamento local', { status: 404 })
        }

        // Armazena em cache na memória do SW durante a sessão de reprodução
        self._videoBlobCache.set(url.pathname, blob)

        const totalSize = blob.size
        const rangeHeader = event.request.headers.get('range')

        // Se o player não enviou cabeçalho Range, retorna o vídeo com cabeçalhos de aceitação de Range
        if (!rangeHeader) {
          return new Response(blob, {
            status: 200,
            statusText: 'OK',
            headers: {
              'Content-Type': 'video/mp4',
              'Content-Length': String(totalSize),
              'Accept-Ranges': 'bytes',
            },
          })
        }

        // Suporte a HTTP 206 Partial Content para iOS Safari / AVPlayer conseguir dar seek e reproduzir offline
        try {
          const parts = rangeHeader.replace(/bytes=/, '').split('-')
          let start = 0
          let end = totalSize - 1

          if (parts[0] === '' && parts[1]) {
            // Range do tipo: bytes=-500 (últimos 500 bytes)
            const suffix = parseInt(parts[1], 10)
            if (!isNaN(suffix) && suffix > 0) {
              start = Math.max(0, totalSize - suffix)
            }
          } else {
            if (parts[0]) {
              const pStart = parseInt(parts[0], 10)
              if (!isNaN(pStart)) start = pStart
            }
            if (parts[1]) {
              const pEnd = parseInt(parts[1], 10)
              if (!isNaN(pEnd)) end = pEnd
            }
          }

          if (start >= totalSize || end >= totalSize || start > end) {
            return new Response('Range não satisfatório', {
              status: 416,
              headers: {
                'Content-Range': `bytes */${totalSize}`,
              },
            })
          }

          const sliced = blob.slice(start, end + 1, 'video/mp4')

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
          return new Response(blob, {
            status: 200,
            headers: {
              'Content-Type': 'video/mp4',
              'Content-Length': String(totalSize),
              'Accept-Ranges': 'bytes',
            },
          })
        }
      })()
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
