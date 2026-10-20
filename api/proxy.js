import http from 'node:http'
import https from 'node:https'

export default function handler(req, res) {
  // Permite CORS total e cabeçalhos de streaming
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD')
  res.setHeader('Access-Control-Allow-Headers', '*')
  res.setHeader('Accept-Ranges', 'bytes')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const urlParam = req.query?.url
  if (!urlParam) {
    res.statusCode = 400
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
      const headers = {
        'User-Agent': 'IPTVSmarters/1.0.0 (Linux; Android 10; Fire TV)',
        Accept: '*/*',
      }

      if (req.headers.range) {
        headers['Range'] = req.headers.range
      }

      const proxyReq = client.get(
        targetUrl,
        { headers },
        (proxyRes) => {
          if (
            [301, 302, 307, 308].includes(proxyRes.statusCode || 0) &&
            proxyRes.headers.location
          ) {
            const redirectUrl = new URL(proxyRes.headers.location, targetUrl).toString()
            return fetchWithRedirects(redirectUrl, maxRedirects - 1)
          }

          res.statusCode = proxyRes.statusCode || 200
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Headers', '*')
          res.setHeader('Accept-Ranges', 'bytes')

          const contentType = proxyRes.headers['content-type'] || 'application/json'
          res.setHeader('Content-Type', contentType)

          if (proxyRes.headers['content-range']) {
            res.setHeader('Content-Range', proxyRes.headers['content-range'])
          }
          if (proxyRes.headers['content-length']) {
            res.setHeader('Content-Length', proxyRes.headers['content-length'])
          }

          // Se for manifesto HLS (.m3u8), reescreve os links para passar pelo proxy
          const isM3u8 = contentType.includes('mpegurl') || targetUrl.includes('.m3u8')
          if (isM3u8) {
            let manifestText = ''
            proxyRes.on('data', (chunk) => {
              manifestText += chunk.toString('utf-8')
            })
            proxyRes.on('end', () => {
              const rewritten = manifestText
                .split('\n')
                .map((line) => {
                  const trimmed = line.trim()
                  if (!trimmed || trimmed.startsWith('#')) return line
                  try {
                    const absUrl = new URL(trimmed, targetUrl).toString()
                    return `/api/proxy?url=${encodeURIComponent(absUrl)}`
                  } catch {
                    return line
                  }
                })
                .join('\n')
              res.end(rewritten)
            })
            return
          }

          proxyRes.pipe(res)
        }
      )

      proxyReq.on('error', (err) => {
        res.statusCode = 500
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.end(JSON.stringify({ error: err.message }))
      })
    } catch (e) {
      res.statusCode = 500
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.end(JSON.stringify({ error: e.message }))
    }
  }

  fetchWithRedirects(urlParam)
}
