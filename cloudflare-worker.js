/**
 * CLOUDFLARE WORKER PROXY PARA O BAT TV (IPTV)
 * 
 * Este script roda gratuitamente nos servidores da Cloudflare:
 * - 100.000 requisições grátis por dia
 * - Largura de banda ILIMITADA (não gasta 1 centavo da Vercel)
 * - Suporte a Range (HTTP 206) para seek no player e downloads offline
 * - Reescreve manifestos HLS (.m3u8) para canais ao vivo e filmes
 */

export default {
  async fetch(request, env, ctx) {
    // 1. Responde a requisições de preflight do navegador (CORS OPTIONS)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    const workerUrl = new URL(request.url)
    const targetUrl = workerUrl.searchParams.get('url')

    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'Parâmetro ?url= é obrigatório' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    try {
      // 2. Prepara os cabeçalhos para o provedor de IPTV
      const fetchHeaders = new Headers()
      fetchHeaders.set('User-Agent', 'IPTVSmarters/1.0.0 (Linux; Android 10; Fire TV)')
      fetchHeaders.set('Accept', '*/*')

      // Repassa Range caso o navegador esteja pedindo um trecho específico de vídeo
      const range = request.headers.get('range')
      if (range) {
        fetchHeaders.set('Range', range)
      }

      // 3. Executa a requisição até o servidor IPTV (com suporte a redirecionamentos)
      const originResponse = await fetch(targetUrl, {
        method: request.method === 'HEAD' ? 'HEAD' : 'GET',
        headers: fetchHeaders,
        redirect: 'follow',
      })

      const contentType = originResponse.headers.get('content-type') || 'application/octet-stream'
      const isM3u8 =
        targetUrl.includes('.m3u8') ||
        contentType.includes('mpegurl') ||
        contentType.includes('x-mpegURL')

      // 4. Se for manifesto HLS (.m3u8), reescreve as linhas para passarem por este Worker
      if (isM3u8 && originResponse.ok) {
        const text = await originResponse.text()
        const workerOrigin = `${workerUrl.origin}${workerUrl.pathname}`

        const rewrittenText = text
          .split('\n')
          .map((line) => {
            const trimmed = line.trim()
            if (!trimmed) return line

            // Reescreve chaves de criptografia (#EXT-X-KEY, #EXT-X-MAP)
            if (trimmed.includes('URI=')) {
              return trimmed.replace(/URI=["']?([^"',>\s]+)["']?/g, (_, uri) => {
                try {
                  const absoluteUrl = new URL(uri, targetUrl).toString()
                  return `URI="${workerOrigin}?url=${encodeURIComponent(absoluteUrl)}"`
                } catch {
                  return `URI="${uri}"`
                }
              })
            }

            // Não altera comentários ou tags de metadados
            if (trimmed.startsWith('#')) return line

            // Reescreve URLs de segmentos .ts e submanifestos
            try {
              const absoluteUrl = new URL(trimmed, targetUrl).toString()
              return `${workerOrigin}?url=${encodeURIComponent(absoluteUrl)}`
            } catch {
              return line
            }
          })
          .join('\n')

        const responseHeaders = new Headers()
        responseHeaders.set('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8')
        responseHeaders.set('Access-Control-Allow-Origin', '*')
        responseHeaders.set('Access-Control-Allow-Headers', '*')
        responseHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges')
        responseHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate')

        return new Response(rewrittenText, {
          status: originResponse.status,
          headers: responseHeaders,
        })
      }

      // 5. Para arquivos binários de vídeo (MP4, TS, MKV, etc.), faz streaming direto em tempo real
      const responseHeaders = new Headers()
      responseHeaders.set('Access-Control-Allow-Origin', '*')
      responseHeaders.set('Access-Control-Allow-Headers', '*')
      responseHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges')
      responseHeaders.set('Accept-Ranges', 'bytes')

      // Copia cabeçalhos essenciais da resposta do IPTV
      for (const [key, value] of originResponse.headers.entries()) {
        const lower = key.toLowerCase()
        if (
          lower === 'content-type' ||
          lower === 'content-length' ||
          lower === 'content-range' ||
          lower === 'accept-ranges'
        ) {
          responseHeaders.set(key, value)
        }
      }

      return new Response(originResponse.body, {
        status: originResponse.status,
        statusText: originResponse.statusText,
        headers: responseHeaders,
      })
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Erro ao conectar com servidor IPTV', details: err?.message }),
        {
          status: 502,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }
  },
}
