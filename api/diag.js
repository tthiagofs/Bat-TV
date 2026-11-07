export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')

  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '201.17.216.236'
  const targetMovie = 'http://auth.xplist.vip/movie/thiagofelipe038/r56k25jame/1038017.mp4'

  const tests = {}

  // Test 1: Plain fetch
  try {
    const r1 = await fetch(targetMovie, {
      redirect: 'manual',
      headers: { 'User-Agent': 'IPTVSmarters/1.0.0 (Linux; Android 10; Fire TV)' }
    })
    tests.plain = { status: r1.status, location: r1.headers.get('location'), body: await r1.text() }
  } catch (e) {
    tests.plain = { error: e.message }
  }

  // Test 2: With X-Forwarded-For: clientIp
  try {
    const r2 = await fetch(targetMovie, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'IPTVSmarters/1.0.0 (Linux; Android 10; Fire TV)',
        'X-Forwarded-For': clientIp,
        'X-Real-IP': clientIp,
        'Client-IP': clientIp
      }
    })
    tests.withXFF = { clientIp, status: r2.status, location: r2.headers.get('location'), body: await r2.text() }
  } catch (e) {
    tests.withXFF = { error: e.message }
  }

  res.end(JSON.stringify({ clientIp, tests }, null, 2))
}
