import http from 'node:http'
import https from 'node:https'

const agentHttp = new http.Agent({ keepAlive: true, maxSockets: 100, maxFreeSockets: 20, timeout: 60000 })
const agentHttps = new https.Agent({ keepAlive: true, maxSockets: 100, maxFreeSockets: 20, timeout: 60000 })

export default async function handler(req, res) {
  // Permite CORS total e cabeçalhos de streaming de vídeo
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD')
  res.setHeader('Access-Control-Allow-Headers', '*')
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, ETag, Last-Modified')
  res.setHeader('Accept-Ranges', 'bytes')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  let isDiag = req.query?.diag
  if (!isDiag && req.url) {
    try {
      const parsedReq = new URL(req.url, 'http://localhost')
      isDiag = parsedReq.searchParams.get('diag')
    } catch {}
  }

  if (isDiag) {
    const target = 'http://auth.xplist.vip/movie/thiagofelipe038/r56k25jame/1038017.mp4'
    const uas = [
      'IPTVSmarters/1.0.0 (Linux; Android 10; Fire TV)',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'VLC/3.0.18 LibVLC/3.0.18',
      'ExoPlayerLib/2.18.1',
      'Lavf/58.29.100',
      'okhttp/4.9.0'
    ]
    const results = {}
    for (const ua of uas) {
      try {
        const r = await fetch(target, {
          redirect: 'manual',
          headers: { 'User-Agent': ua }
        })
        results[ua] = { status: r.status, location: r.headers.get('location') }
      } catch (e) {
        results[ua] = { error: e.message }
      }
    }
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify(results, null, 2))
  }

  let urlParam = req.query?.url
  if (Array.isArray(urlParam)) urlParam = urlParam[0]
  let workerParam = req.query?.worker
  if (Array.isArray(workerParam)) workerParam = workerParam[0]

  if (req.url) {
    try {
      const parsedReq = new URL(req.url, 'http://localhost')
      if (!urlParam) urlParam = parsedReq.searchParams.get('url')
      if (!workerParam) workerParam = parsedReq.searchParams.get('worker')
    } catch {}
  }

  const cleanWorker =
    workerParam && typeof workerParam === 'string' && /^https?:\/\//i.test(workerParam.trim())
      ? workerParam.trim().replace(/\/+$/, '')
      : ''

  if (!urlParam) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ error: 'Parâmetro url é obrigatório' }))
  }

  const fetchWithRedirects = (targetUrl, maxRedirects = 5) => {
    if (maxRedirects <= 0) {
      res.statusCode = 502
      return res.end(JSON.stringify({ error: 'Muitos redirecionamentos no servidor IPTV' }))
    }

    try {
      const parsed = new URL(targetUrl)
      const client = parsed.protocol === 'https:' ? https : http
      const agent = parsed.protocol === 'https:' ? agentHttps : agentHttp
      const headers = {
        'User-Agent': 'IPTVSmarters/1.0.0 (Linux; Android 10; Fire TV)',
        Accept: '*/*',
        'Accept-Encoding': 'identity',
      }

      if (req.headers.range) {
        headers['Range'] = req.headers.range
      }
      if (req.headers['if-range']) {
        headers['If-Range'] = req.headers['if-range']
      }

      const clientMethod = req.method === 'HEAD' ? 'HEAD' : 'GET'
      const proxyReq = client.request(
        targetUrl,
        { method: clientMethod, headers, agent },
        (proxyRes) => {
          if (
            [301, 302, 303, 307, 308].includes(proxyRes.statusCode || 0) &&
            proxyRes.headers.location
          ) {
            proxyRes.resume()
            const redirectUrl = new URL(proxyRes.headers.location, targetUrl).toString()

            // Handoff para Cloudflare Worker: resolve o redirecionamento 302 no IPv4 da Vercel
            // e redireciona o navegador para o Cloudflare Worker transmitir o vídeo da URL final (/vauth/, /rauth/)
            if (cleanWorker) {
              let shouldHandoff = false
              try {
                const origHost = new URL(urlParam).hostname.toLowerCase()
                const nextU = new URL(redirectUrl)
                const nextHost = nextU.hostname.toLowerCase()
                if (
                  nextHost !== origHost ||
                  nextU.pathname.includes('/vauth/') ||
                  nextU.pathname.includes('/rauth/')
                ) {
                  shouldHandoff = true
                }
              } catch {
                shouldHandoff = true
              }

              if (shouldHandoff) {
                const workerStreamUrl = `${cleanWorker}/?url=${encodeURIComponent(redirectUrl)}`
                res.statusCode = 302
                res.setHeader('Access-Control-Allow-Origin', '*')
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD')
                res.setHeader('Access-Control-Allow-Headers', '*')
                res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Location')
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
                res.setHeader('Location', workerStreamUrl)
                return res.end()
              }
            }

            return fetchWithRedirects(redirectUrl, maxRedirects - 1)
          }

          res.statusCode = proxyRes.statusCode || 200
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD')
          res.setHeader('Access-Control-Allow-Headers', '*')
          res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges')
          res.setHeader('Accept-Ranges', 'bytes')

          let contentType = proxyRes.headers['content-type'] || ''
          // Se o servidor Xtream retornar application/octet-stream ou genérico, detecta o MIME type real pelo formato
          if (!contentType || contentType === 'application/octet-stream' || contentType === 'binary/octet-stream' || contentType.startsWith('text/plain')) {
            const lower = targetUrl.toLowerCase()
            if (lower.includes('.m3u8') || lower.includes('m3u8')) {
              contentType = 'application/vnd.apple.mpegurl'
            } else if (lower.includes('.mp4') || lower.includes('/movie/') || lower.includes('/series/')) {
              contentType = 'video/mp4'
            } else if (lower.includes('.ts') || lower.includes('/live/')) {
              contentType = 'video/mp2t'
            } else if (lower.includes('.mkv')) {
              contentType = 'video/mp4'
            } else {
              contentType = 'video/mp4'
            }
          }
          res.setHeader('Content-Type', contentType)

          if (proxyRes.headers['content-range']) {
            res.setHeader('Content-Range', proxyRes.headers['content-range'])
          }
          if (proxyRes.headers['content-length']) {
            res.setHeader('Content-Length', proxyRes.headers['content-length'])
          }
          if (proxyRes.headers['etag']) {
            res.setHeader('ETag', proxyRes.headers['etag'])
          }
          if (proxyRes.headers['last-modified']) {
            res.setHeader('Last-Modified', proxyRes.headers['last-modified'])
          }

          if (req.headers.range || targetUrl.includes('/movie/') || targetUrl.includes('/series/')) {
            res.setHeader('Cache-Control', 'private, max-age=86400')
          }

          if (req.method === 'HEAD') {
            proxyRes.resume()
            return res.end()
          }

          // Se for manifesto HLS (.m3u8), reescreve chaves AES-128 e segmentos .ts
          const isM3u8 = contentType.includes('mpegurl') || targetUrl.includes('.m3u8')
          if (isM3u8) {
            let manifestText = ''
            proxyRes.on('data', (chunk) => {
              manifestText += chunk.toString('utf-8')
            })
            proxyRes.on('end', () => {
              const host = req.headers['x-forwarded-host'] || req.headers.host
              const proto = req.headers['x-forwarded-proto'] || 'https'
              const origin = host ? `${proto}://${host}` : ''
              const proxyBaseUrl = cleanWorker
                ? `${cleanWorker}/?url=`
                : `${origin}/api/proxy?url=`

              const rewritten = manifestText
                .split('\n')
                .map((line) => {
                  let l = line.trim()
                  if (!l) return line

                  // 1. Reescreve chaves de criptografia e mapas (#EXT-X-KEY, #EXT-X-MAP, etc)
                  if (l.includes('URI=')) {
                    l = l.replace(/URI=["']?([^"',>\s]+)["']?/g, (_, uri) => {
                      try {
                        const absUrl = new URL(uri, targetUrl).toString()
                        return `URI="${proxyBaseUrl}${encodeURIComponent(absUrl)}"`
                      } catch {
                        return `URI="${uri}"`
                      }
                    })
                    return l
                  }

                  // 2. Não altera outras tags de metadados HLS
                  if (l.startsWith('#')) return line

                  // 3. Linhas de segmentos (.ts) ou sub-playlists (.m3u8)
                  try {
                    const absUrl = new URL(l, targetUrl).toString()
                    return `${proxyBaseUrl}${encodeURIComponent(absUrl)}`
                  } catch {
                    return line
                  }
                })
                .join('\n')

              res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8')
              res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
              res.setHeader('Pragma', 'no-cache')
              res.setHeader('Expires', '0')
              res.setHeader('Content-Length', Buffer.byteLength(rewritten, 'utf-8'))
              res.end(rewritten)
            })
            return
          }

          if (targetUrl.includes('.ts')) {
            res.setHeader('Cache-Control', 'public, max-age=3600')
          }
          proxyRes.pipe(res)
        }
      )

      proxyReq.end()

      req.on('close', () => {
        if (!res.writableEnded) {
          try {
            proxyReq.destroy()
          } catch {}
        }
      })

      proxyReq.setTimeout(55000, () => {
        proxyReq.destroy()
        if (!res.headersSent) {
          res.statusCode = 504
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.end(JSON.stringify({ error: 'Tempo limite esgotado no servidor IPTV' }))
        }
      })

      proxyReq.on('error', (err) => {
        if (!res.headersSent) {
          res.statusCode = 500
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.end(JSON.stringify({ error: err.message }))
        }
      })
    } catch (e) {
      if (!res.headersSent) {
        res.statusCode = 500
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.end(JSON.stringify({ error: e.message }))
      }
    }
  }

  fetchWithRedirects(urlParam)
}
