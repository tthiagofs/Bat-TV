import http from 'node:http'
import https from 'node:https'

const agentHttp = new http.Agent({ keepAlive: true, maxSockets: 100, maxFreeSockets: 20, timeout: 60000 })
const agentHttps = new https.Agent({ keepAlive: true, maxSockets: 100, maxFreeSockets: 20, timeout: 60000 })

export default function handler(req, res) {
  // Permite CORS total e cabeçalhos de streaming de vídeo
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD')
  res.setHeader('Access-Control-Allow-Headers', '*')
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, ETag, Last-Modified')
  res.setHeader('Accept-Ranges', 'bytes')

  if (req.method === 'OPTIONS') {
    res.statusCode = 200
    return res.end()
  }

  let urlParam = req.query?.url
  if (Array.isArray(urlParam)) urlParam = urlParam[0]
  if (!urlParam && req.url) {
    try {
      const parsedReq = new URL(req.url, 'http://localhost')
      urlParam = parsedReq.searchParams.get('url')
    } catch {}
  }

  if (!urlParam) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ error: 'Parâmetro url é obrigatório' }))
  }

  if (req.query?.diag || (req.url && req.url.includes('diag=1'))) {
    const testUrl = urlParam || 'http://auth.xplist.vip/movie/thiagofelipe038/r56k25jame/1038017.mp4'
    const clientIp = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '189.6.12.34').split(',')[0].trim()
    const diagHeaders = {
      'User-Agent': 'IPTVSmarters/1.0.0 (Linux; Android 10; Fire TV)',
      Accept: '*/*',
      'X-Forwarded-For': clientIp,
      'X-Real-IP': clientIp,
      'CF-Connecting-IP': clientIp,
      'True-Client-IP': clientIp,
    }
    const client = testUrl.startsWith('https') ? https : http
    const dReq = client.request(testUrl, { method: 'GET', headers: diagHeaders }, (dRes) => {
      const loc = dRes.headers.location
      const result = {
        clientIpUsed: clientIp,
        step1: {
          url: testUrl,
          status: dRes.statusCode,
          headers: dRes.headers,
        }
      }
      dRes.resume()
      if (loc) {
        const nextUrl = new URL(loc, testUrl).toString()
        const client2 = nextUrl.startsWith('https') ? https : http
        const dReq2 = client2.request(nextUrl, { method: 'GET', headers: { ...diagHeaders, Range: 'bytes=0-100' } }, (dRes2) => {
          result.step2 = {
            url: nextUrl,
            status: dRes2.statusCode,
            headers: dRes2.headers,
          }
          dRes2.resume()
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(result, null, 2))
        })
        dReq2.on('error', (e) => {
          result.step2Error = e.message
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(result, null, 2))
        })
        dReq2.end()
      } else {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(result, null, 2))
      }
    })
    dReq.on('error', (e) => {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ step1Error: e.message }, null, 2))
    })
    dReq.end()
    return
  }

  return new Promise((resolve) => {
    let isDone = false
    const finish = () => {
      if (!isDone) {
        isDone = true
        resolve()
      }
    }

    const fetchWithRedirects = (targetUrl, maxRedirects = 5) => {
      if (maxRedirects <= 0) {
        if (!res.headersSent) {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Muitos redirecionamentos no servidor IPTV' }))
        }
        return finish()
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
              return fetchWithRedirects(redirectUrl, maxRedirects - 1)
            }

            res.statusCode = proxyRes.statusCode || 200
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD')
            res.setHeader('Access-Control-Allow-Headers', '*')
            res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges')
            res.setHeader('Accept-Ranges', 'bytes')

            let contentType = proxyRes.headers['content-type'] || ''
            if (
              !contentType ||
              contentType === 'application/octet-stream' ||
              contentType === 'binary/octet-stream' ||
              contentType.startsWith('text/plain')
            ) {
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
              res.end()
              return finish()
            }

            // Manifesto HLS (.m3u8)
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
                          return `URI="${origin}/api/proxy?url=${encodeURIComponent(absUrl)}"`
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
                      return `${origin}/api/proxy?url=${encodeURIComponent(absUrl)}`
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
                finish()
              })
              proxyRes.on('error', () => {
                if (!res.headersSent) {
                  res.statusCode = 502
                  res.end()
                }
                finish()
              })
              return
            }

            if (targetUrl.includes('.ts')) {
              res.setHeader('Cache-Control', 'public, max-age=3600')
            }

            proxyRes.pipe(res)
            proxyRes.on('end', finish)
            proxyRes.on('error', finish)
            res.on('finish', finish)
            res.on('close', finish)
          }
        )

        proxyReq.end()

        req.on('close', () => {
          if (!res.writableEnded) {
            try {
              proxyReq.destroy()
            } catch {}
          }
          finish()
        })

        proxyReq.setTimeout(55000, () => {
          proxyReq.destroy()
          if (!res.headersSent) {
            res.statusCode = 504
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.end(JSON.stringify({ error: 'Tempo limite esgotado no servidor IPTV' }))
          }
          finish()
        })

        proxyReq.on('error', (err) => {
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.end(JSON.stringify({ error: err.message }))
          }
          finish()
        })
      } catch (e) {
        if (!res.headersSent) {
          res.statusCode = 500
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.end(JSON.stringify({ error: e.message }))
        }
        finish()
      }
    }

    fetchWithRedirects(urlParam)
  })
}
