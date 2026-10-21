/**
 * CLOUDFLARE WORKER PROXY PARA O BAT TV (IPTV)
 * 
 * - 100.000 requisições diárias gratuitas
 * - Banda ilimitada (não gasta limite da Vercel)
 * - Suporte a Range (HTTP 206) para seek no player e downloads offline
 * - Reescreve manifestos HLS (.m3u8) para canais ao vivo e filmes
 * - Resolve redirecionamentos com Load Balancers de IPTV que usam IP direto (evita erro 1003)
 */

function normalizeUrlForCloudflare(rawUrl) {
  try {
    const u = new URL(rawUrl)
    // Se o host for um IP numérico direto (ex: 79.127.148.162), converte para hostname compatível (nip.io)
    // Isso evita o bloqueio de segurança "error code: 1003 (Direct IP Access Not Allowed)" da Cloudflare
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(u.hostname)) {
      u.hostname = u.hostname + '.nip.io'
      return u.toString()
    }
  } catch {}
  return rawUrl
}

async function fetchWithSmartRedirects(initialUrl, requestMethod, headers) {
  let curUrl = normalizeUrlForCloudflare(initialUrl)
  let redirects = 0
  const maxRedirects = 8

  while (redirects < maxRedirects) {
    const res = await fetch(curUrl, {
      method: requestMethod,
      headers: headers,
      redirect: 'manual',
    })

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location')
      if (loc) {
        const nextUrl = new URL(loc, curUrl).toString()
        curUrl = normalizeUrlForCloudflare(nextUrl)
        redirects++
        continue
      }
    }

    return { response: res, finalUrl: curUrl }
  }

  // Se exceder, tenta seguir direto
  const res = await fetch(curUrl, { method: requestMethod, headers, redirect: 'follow' })
  return { response: res, finalUrl: curUrl }
}

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

      // 3. Executa a requisição até o servidor IPTV resolvendo redirecionamentos para IPs
      const reqMethod = request.method === 'HEAD' ? 'HEAD' : 'GET'
      const { response: originResponse, finalUrl } = await fetchWithSmartRedirects(targetUrl, reqMethod, fetchHeaders)

      const contentType = originResponse.headers.get('content-type') || 'application/octet-stream'
      const isM3u8 =
        targetUrl.includes('.m3u8') ||
        finalUrl.includes('.m3u8') ||
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
                  const absoluteUrl = normalizeUrlForCloudflare(new URL(uri, finalUrl).toString())
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
              const absoluteUrl = normalizeUrlForCloudflare(new URL(trimmed, finalUrl).toString())
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
