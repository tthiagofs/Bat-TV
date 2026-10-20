import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import http from 'node:http'
import https from 'node:https'

function iptvDevProxy(): Plugin {
  return {
    name: 'iptv-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/iptv-proxy', (req, res) => {
        const urlParam = new URL(req.url || '', 'http://localhost').searchParams.get('url')
        if (!urlParam) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'URL param required' }))
          return
        }

        const fetchWithRedirects = (targetUrl: string, maxRedirects = 5) => {
          if (maxRedirects <= 0) {
            res.statusCode = 502
            res.end(JSON.stringify({ error: 'Too many redirects' }))
            return
          }

          try {
            const parsed = new URL(targetUrl)
            const client = parsed.protocol === 'https:' ? https : http
            const headers: Record<string, string> = {
              'User-Agent': 'IPTVSmarters/1.0.0 (Linux; Android 10; Fire TV)',
              Accept: '*/*',
            }
            if (req.headers.range) {
              headers['Range'] = req.headers.range as string
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
                  fetchWithRedirects(redirectUrl, maxRedirects - 1)
                  return
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

                // Se for manifesto HLS (.m3u8), reescreve as linhas de chunks para passar pelo proxy local
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
                          return `/iptv-proxy?url=${encodeURIComponent(absUrl)}`
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
          } catch (e: any) {
            res.statusCode = 500
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.end(JSON.stringify({ error: e.message }))
          }
        }

        fetchWithRedirects(urlParam)
      })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), iptvDevProxy()],
  server: { port: 5173, strictPort: true },
})

