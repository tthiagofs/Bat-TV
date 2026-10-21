import { Capacitor } from '@capacitor/core'
import { buildProxyUrl } from './proxyConfig'
import type { Club } from '../data/teams'

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer'
const CACHE_KEY = 'iptv-rea:sports-cache:v4'

export interface TeamInfo {
  id: string
  name: string
  badge: string
  leagueIds: string[]
}

export interface Match {
  id: string
  time: number // epoch ms
  home: string
  away: string
  homeBadge: string
  awayBadge: string
  homeScore: number | null
  awayScore: number | null
  league: string
  leagueId: string
  leagueBadge: string
  status?: string // 'NS' (não iniciado), 'FT' (finalizado), '1H'/'2H'/'LIVE'/'HT' (ao vivo)
  statusDetail?: string // e.g. "73'", "HT", "FT"
  channels?: string[]
}

export interface TeamData {
  team: TeamInfo
  next: Match[]
  last: Match[]
  channels: string[]
}

/** Configuração e badges oficiais das Ligas Principais */
export const MAIN_LEAGUES: Record<string, { slug: string; name: string; badge: string; tv: string[] }> = {
  'bra.1': {
    slug: 'bra.1',
    name: 'Brasileirão Série A',
    badge: 'https://a.espncdn.com/i/leaguelogos/soccer/500/85.png',
    tv: ['Premiere', 'SporTV', 'Globo'],
  },
  'bra.2': {
    slug: 'bra.2',
    name: 'Brasileirão Série B',
    badge: 'https://a.espncdn.com/i/leaguelogos/soccer/500/85.png',
    tv: ['Premiere', 'SporTV', 'Canal GOAT'],
  },
  'bra.copa_do_brazil': {
    slug: 'bra.copa_do_brazil',
    name: 'Copa do Brasil',
    badge: 'https://r2.thesportsdb.com/images/media/league/badge/h38dax1582151151.png',
    tv: ['SporTV', 'Premiere', 'Prime Video'],
  },
  'conmebol.libertadores': {
    slug: 'conmebol.libertadores',
    name: 'Copa Libertadores',
    badge: 'https://r2.thesportsdb.com/images/media/league/badge/gq50361582151025.png',
    tv: ['ESPN', 'Paramount+', 'Globo'],
  },
  'conmebol.sudamericana': {
    slug: 'conmebol.sudamericana',
    name: 'Copa Sul-Americana',
    badge: 'https://r2.thesportsdb.com/images/media/league/badge/03v2p51582151068.png',
    tv: ['ESPN', 'Paramount+', 'SBT'],
  },
  'uefa.champions': {
    slug: 'uefa.champions',
    name: 'UEFA Champions League',
    badge: 'https://a.espncdn.com/i/leaguelogos/soccer/500/2.png',
    tv: ['Max', 'TNT', 'Space'],
  },
  'uefa.europa': {
    slug: 'uefa.europa',
    name: 'UEFA Europa League',
    badge: 'https://a.espncdn.com/i/leaguelogos/soccer/500/2310.png',
    tv: ['CazéTV', 'ESPN'],
  },
  'eng.1': {
    slug: 'eng.1',
    name: 'Premier League',
    badge: 'https://a.espncdn.com/i/leaguelogos/soccer/500/23.png',
    tv: ['ESPN', 'Disney+'],
  },
  'esp.1': {
    slug: 'esp.1',
    name: 'La Liga',
    badge: 'https://a.espncdn.com/i/leaguelogos/soccer/500/15.png',
    tv: ['ESPN', 'Disney+'],
  },
  'ita.1': {
    slug: 'ita.1',
    name: 'Serie A (Itália)',
    badge: 'https://a.espncdn.com/i/leaguelogos/soccer/500/12.png',
    tv: ['ESPN', 'Disney+'],
  },
  'ger.1': {
    slug: 'ger.1',
    name: 'Bundesliga',
    badge: 'https://a.espncdn.com/i/leaguelogos/soccer/500/10.png',
    tv: ['CazéTV', 'SporTV', 'Canal GOAT'],
  },
  'fra.1': {
    slug: 'fra.1',
    name: 'Ligue 1',
    badge: 'https://a.espncdn.com/i/leaguelogos/soccer/500/9.png',
    tv: ['CazéTV', 'ESPN'],
  },
}

/** Mapeamento de IDs da ESPN para os clubes suportados no app */
export const CLUB_ESPN_MAP: Record<string, { id: string; league: string }> = {
  flamengo: { id: '819', league: 'bra.1' },
  corinthians: { id: '874', league: 'bra.1' },
  palmeiras: { id: '2029', league: 'bra.1' },
  saopaulo: { id: '2026', league: 'bra.1' },
  santos: { id: '2024', league: 'bra.2' },
  gremio: { id: '6273', league: 'bra.1' },
  internacional: { id: '1999', league: 'bra.1' },
  cruzeiro: { id: '2022', league: 'bra.1' },
  'atletico-mg': { id: '2027', league: 'bra.1' },
  fluminense: { id: '3445', league: 'bra.1' },
  vasco: { id: '3454', league: 'bra.1' },
  botafogo: { id: '2028', league: 'bra.1' },
  bahia: { id: '3458', league: 'bra.1' },
  fortaleza: { id: '6363', league: 'bra.1' },
  'real-madrid': { id: '86', league: 'esp.1' },
  barcelona: { id: '83', league: 'esp.1' },
  'man-city': { id: '382', league: 'eng.1' },
  'man-united': { id: '360', league: 'eng.1' },
  liverpool: { id: '364', league: 'eng.1' },
  arsenal: { id: '359', league: 'eng.1' },
  chelsea: { id: '363', league: 'eng.1' },
  bayern: { id: '132', league: 'ger.1' },
  psg: { id: '160', league: 'fra.1' },
  juventus: { id: '111', league: 'ita.1' },
  milan: { id: '103', league: 'ita.1' },
  inter: { id: '110', league: 'ita.1' },
}

/** Canais estritos por clube */
export const TEAM_STRICT_CHANNELS: Record<string, string[]> = {
  cruzeiro: ['SporTV', 'Premiere'],
  'atletico-mg': ['SporTV', 'Premiere'],
  vasco: ['SBT', 'Paramount+', 'Premiere', 'SporTV', 'Globo'],
  corinthians: ['SBT', 'Paramount+', 'Premiere', 'SporTV'],
  flamengo: ['Premiere', 'SporTV', 'Globo', 'Paramount+'],
}

type Json = Record<string, any>

const memoryCache = new Map<string, { t: number; data: unknown }>()
const SPORTS_CACHE_KEY = 'iptv-rea:sports-cache:v5'
const SPORTS_HUB_MATCHES_KEY = 'iptv-rea:sports-hub-matches:v2'

function readPersistentCache(): Record<string, { t: number; data: unknown }> {
  try {
    return JSON.parse(localStorage.getItem(SPORTS_CACHE_KEY) || '{}')
  } catch {
    return {}
  }
}

let persistentCacheLoaded = false
function ensurePersistentCacheLoaded() {
  if (persistentCacheLoaded) return
  persistentCacheLoaded = true
  try {
    const raw = readPersistentCache()
    const now = Date.now()
    for (const [k, v] of Object.entries(raw)) {
      if (v && typeof v === 'object' && now - v.t < 1800_000) {
        memoryCache.set(k, v)
      }
    }
  } catch {}
}

async function fetchEspnJson<T = Json>(url: string, ttlMs = 120_000): Promise<T> {
  ensurePersistentCacheLoaded()
  const hit = memoryCache.get(url)
  if (hit && Date.now() - hit.t < ttlMs) {
    return hit.data as T
  }

  const isWeb = typeof window !== 'undefined' &&
    !window.navigator.userAgent.toLowerCase().includes('electron') &&
    window.location.protocol !== 'file:' &&
    !Capacitor.isNativePlatform()

  const targetUrl = isWeb ? buildProxyUrl(url) : url

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 7000) // 7s timeout max

  try {
    const res = await fetch(targetUrl, { signal: controller.signal })
    clearTimeout(timeoutId)
    if (!res.ok) throw new Error(`ESPN HTTP ${res.status}`)
    const data = (await res.json()) as T

    const entry = { t: Date.now(), data }
    memoryCache.set(url, entry)

    // Salva no localStorage assincronamente sem bloquear a UI
    setTimeout(() => {
      try {
        const fresh = readPersistentCache()
        fresh[url] = entry
        const keys = Object.keys(fresh)
        if (keys.length > 50) delete fresh[keys[0]]
        localStorage.setItem(SPORTS_CACHE_KEY, JSON.stringify(fresh))
      } catch {}
    }, 0)

    return data
  } catch (err) {
    clearTimeout(timeoutId)
    // Se falhou no network mas temos versão anterior em cache, usa para não travar a tela
    if (hit) return hit.data as T
    throw err
  }
}

export function getCachedSportsHubMatches(): Match[] {
  try {
    const raw = localStorage.getItem(SPORTS_HUB_MATCHES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed.matches) && parsed.matches.length > 0 && Date.now() - parsed.savedAt < 15 * 60_000) {
      return parsed.matches
    }
  } catch {}
  return []
}

export function saveCachedSportsHubMatches(matches: Match[]): void {
  try {
    if (matches && matches.length > 0) {
      localStorage.setItem(
        SPORTS_HUB_MATCHES_KEY,
        JSON.stringify({
          savedAt: Date.now(),
          matches,
        })
      )
    }
  } catch {}
}

/** Normaliza texto removendo acentos e símbolos */
export const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')

/** Retorna data em Brasília (America/Sao_Paulo / UTC-3) com offset opcional de dias */
export function getBrasiliaDateString(offsetDays = 0): string {
  const d = new Date()
  if (offsetDays !== 0) d.setDate(d.getDate() + offsetDays)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d)
}

/** Retorna a data no fuso de Brasília (YYYY-MM-DD) para um timestamp epoch */
export function getBrasiliaDateForTimestamp(ts: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(ts))
}

export function parseUtcToTimestamp(e: Json): number {
  if (e.date) return Date.parse(e.date)
  if (e.strTimestamp) {
    const s = String(e.strTimestamp).trim().replace(' ', 'T')
    return Date.parse(s.endsWith('Z') ? s : s + 'Z')
  }
  return Date.now()
}

/** Normaliza e extrai o nome canônico do clube para deduplicação estável */
export function canonicalTeamName(name: string): string {
  if (!name) return ''
  let s = norm(name)

  if (s.includes('cruzeiro')) return 'cruzeiro'
  if (s.includes('bragantino')) return 'bragantino'
  if (s.includes('botafogo')) return 'botafogo'
  if (s.includes('palmeiras')) return 'palmeiras'
  if (s.includes('fluminense')) return 'fluminense'
  if (s.includes('coritiba') || s.includes('coxa')) return 'coritiba'
  if (s.includes('corinthians')) return 'corinthians'
  if (s.includes('flamengo')) return 'flamengo'
  if (s.includes('saopaulo')) return 'saopaulo'
  if (s.includes('santos')) return 'santos'
  if (s.includes('gremio')) return 'gremio'
  if (s.includes('internacional') || s.includes('interrs')) return 'internacional'
  if (s.includes('athletico') || s.includes('atleticopr') || s.includes('athleticopr')) return 'athleticopr'
  if (s.includes('atleticomg') || s.includes('atletico-mg') || s.includes('galo')) return 'atleticomg'
  if (s.includes('vasco')) return 'vasco'
  if (s.includes('bahia')) return 'bahia'
  if (s.includes('fortaleza')) return 'fortaleza'
  if (s.includes('ceara')) return 'ceara'
  if (s.includes('vitoria')) return 'vitoria'
  if (s.includes('juventude')) return 'juventude'
  if (s.includes('cuiaba')) return 'cuiaba'
  if (s.includes('criciuma')) return 'criciuma'
  if (s.includes('atleticogo')) return 'atleticogo'
  if (s.includes('mirassol')) return 'mirassol'
  if (s.includes('sportrecife') || s.includes('sport')) return 'sport'
  if (s.includes('chapecoense')) return 'chapecoense'
  if (s.includes('remo')) return 'remo'
  if (s.includes('realmadrid')) return 'realmadrid'
  if (s.includes('barcelona')) return 'barcelona'
  if (s.includes('manchestercity') || s.includes('mancity')) return 'mancity'
  if (s.includes('manchesterunited') || s.includes('manunited') || s.includes('manutd')) return 'manutd'
  if (s.includes('liverpool')) return 'liverpool'
  if (s.includes('arsenal')) return 'arsenal'
  if (s.includes('chelsea')) return 'chelsea'
  if (s.includes('bayern')) return 'bayern'
  if (s.includes('psg') || s.includes('parissaintgermain')) return 'psg'
  if (s.includes('juventus')) return 'juventus'
  if (s.includes('milan') && !s.includes('inter')) return 'milan'
  if (s.includes('intermilan') || s.includes('internazionale')) return 'intermilan'

  s = s.replace(/^(redbull|rb|se|cr|sc|clube|ec|fc|fbc|saf|ad)/g, '')
  s = s.replace(/(mg|sp|rj|rs|pr|ba|pe|ce|sc|go|df|es|rn|al|mt|ms|pb|pi|se|ma|pa|am|ac|ro|ap|rr|to)$/g, '')
  s = s.replace(/(fc|fbc|ec|saf|esporteclube|futebolclube)$/g, '')

  return s || norm(name)
}

export function getMatchDedupeKey(home: string, away: string, timestamp: number): string {
  const cHome = canonicalTeamName(home)
  const cAway = canonicalTeamName(away)
  const dateStr = getBrasiliaDateForTimestamp(timestamp)
  const matchup = [cHome, cAway].sort().join('-vs-')
  return `${matchup}-${dateStr}`
}

/** Converte um evento nativo da API ESPN para a interface universal Match */
function parseEspnEvent(event: Json, leagueSlug: string): Match | null {
  if (!event || !event.competitions || !event.competitions[0]) return null
  const comp = event.competitions[0]
  const competitors: Json[] = comp.competitors || []
  if (competitors.length < 2) return null

  const homeComp = competitors.find((c) => c.homeAway === 'home') || competitors[0]
  const awayComp = competitors.find((c) => c.homeAway === 'away') || competitors[1]

  const homeName = homeComp.team?.displayName || homeComp.team?.name || ''
  const awayName = awayComp.team?.displayName || awayComp.team?.name || ''
  if (!homeName || !awayName) return null

  const getTeamBadge = (team: any): string => {
    if (!team) return ''
    if (typeof team.logo === 'string' && team.logo) return team.logo
    if (Array.isArray(team.logos) && team.logos[0]?.href) return team.logos[0].href
    if (team.id) return `https://a.espncdn.com/i/teamlogos/soccer/500/${team.id}.png`
    return ''
  }

  const homeBadge = getTeamBadge(homeComp.team)
  const awayBadge = getTeamBadge(awayComp.team)

  const parseScore = (v: any): number | null => {
    if (v === null || v === undefined || v === '') return null
    if (typeof v === 'object' && v.value !== undefined) return Number(v.value)
    const n = Number(v)
    return isNaN(n) ? null : n
  }

  const homeScore = parseScore(homeComp.score)
  const awayScore = parseScore(awayComp.score)

  const rawStatus = event.status || comp.status || {}
  const statusType = rawStatus.type || {}
  const state = statusType.state // 'pre', 'in', 'post'
  const isCompleted = statusType.completed === true

  let status: string = 'NS'
  if (state === 'in') {
    status = 'LIVE'
    const desc = (statusType.description || '').toLowerCase()
    if (desc.includes('first half') || statusType.name === 'STATUS_FIRST_HALF') status = '1H'
    else if (desc.includes('second half') || statusType.name === 'STATUS_SECOND_HALF') status = '2H'
    else if (desc.includes('halftime') || statusType.name === 'STATUS_HALFTIME') status = 'HT'
  } else if (isCompleted || state === 'post') {
    status = 'FT'
  }

  const leagueConfig = MAIN_LEAGUES[leagueSlug]
  const leagueName = leagueConfig ? leagueConfig.name : (event.league?.name || 'Futebol')
  const leagueBadge = leagueConfig ? leagueConfig.badge : (comp.league?.logos?.[0]?.href || '')

  let channels = leagueConfig ? [...leagueConfig.tv] : ['SporTV', 'ESPN', 'Premiere']
  const homeLower = homeName.toLowerCase()
  const awayLower = awayName.toLowerCase()
  const isCruzeiro = homeLower.includes('cruzeiro') || awayLower.includes('cruzeiro')
  const isVasco = homeLower.includes('vasco') || awayLower.includes('vasco')

  if (isCruzeiro) {
    channels = ['SporTV', 'Premiere']
  } else if (leagueSlug === 'conmebol.sudamericana') {
    // Na Copa Sul-Americana no Brasil, os jogos principais de TV aberta/streaming pertencem a SBT e Paramount+
    if (isVasco || homeLower.includes('corinthians') || awayLower.includes('corinthians') || homeLower.includes('fortaleza') || awayLower.includes('fortaleza') || homeLower.includes('cruzeiro') || awayLower.includes('cruzeiro')) {
      channels = ['SBT', 'Paramount+', 'ESPN']
    } else {
      channels = ['Paramount+', 'ESPN', 'SBT']
    }
  } else if (leagueSlug === 'conmebol.libertadores') {
    channels = ['Globo', 'Paramount+', 'ESPN']
  } else if (leagueSlug === 'bra.copa_do_brazil') {
    channels = ['SporTV', 'Premiere', 'Prime Video', 'Globo']
  }

  const ts = event.date ? Date.parse(event.date) : Date.now()

  return {
    id: String(event.id || `${homeName}-${awayName}-${ts}`),
    time: ts,
    home: homeName,
    away: awayName,
    homeBadge,
    awayBadge,
    homeScore,
    awayScore,
    league: leagueName,
    leagueId: leagueSlug,
    leagueBadge,
    status,
    statusDetail: statusType.detail || statusType.shortDetail || (status === 'LIVE' ? 'Ao Vivo' : undefined),
    channels,
  }
}

export function enrichMatch(m: Match): Match {
  return m
}

export function mergeMatches(base: Match, incoming: Match): Match {
  const isCruzeiro =
    base.home.toLowerCase().includes('cruzeiro') ||
    base.away.toLowerCase().includes('cruzeiro') ||
    incoming.home.toLowerCase().includes('cruzeiro') ||
    incoming.away.toLowerCase().includes('cruzeiro')

  return {
    ...base,
    id: base.id || incoming.id,
    time: incoming.time && Math.abs(incoming.time - base.time) < 3600_000 * 6 ? incoming.time : base.time,
    homeBadge: base.homeBadge || incoming.homeBadge,
    awayBadge: base.awayBadge || incoming.awayBadge,
    homeScore: base.homeScore !== null ? base.homeScore : incoming.homeScore,
    awayScore: base.awayScore !== null ? base.awayScore : incoming.awayScore,
    status: incoming.status && incoming.status !== 'NS' ? incoming.status : base.status,
    statusDetail: incoming.statusDetail || base.statusDetail,
    leagueBadge: base.leagueBadge || incoming.leagueBadge,
    channels: isCruzeiro
      ? ['SporTV', 'Premiere']
      : base.channels && base.channels.length > 0
        ? base.channels
        : incoming.channels,
  }
}

/** Deduplica com inteligência qualquer lista de partidas por fixture.id E chave canônica de confronto */
export function dedupeMatchList(matches: Match[]): Match[] {
  const byId = new Map<string, Match>()
  const byMatchup = new Map<string, Match>()

  for (const m of matches) {
    if (!m || !m.home || !m.away) continue

    const matchupKey = getMatchDedupeKey(m.home, m.away, m.time)
    const existingMatchup = byMatchup.get(matchupKey)

    if (existingMatchup) {
      const merged = mergeMatches(existingMatchup, m)
      byMatchup.set(matchupKey, merged)
      byId.set(merged.id, merged)
    } else {
      const existingId = byId.get(m.id)
      if (existingId) {
        const merged = mergeMatches(existingId, m)
        byId.set(m.id, merged)
        byMatchup.set(matchupKey, merged)
      } else {
        byId.set(m.id, m)
        byMatchup.set(matchupKey, m)
      }
    }
  }

  return Array.from(byMatchup.values())
}

let inFlightSportsFetch: Promise<Match[]> | null = null

/**
 * Busca partidas oficiais de todas as ligas principais diretamente da API ESPN.
 * Inclui placares ao vivo em tempo real, minutos do jogo, logos oficiais e transmissões.
 * Otimizado com cache em memória, execução paralela e timeout para carregar no Fire Stick em < 1s.
 */
export async function getTodayMainLeaguesGames(): Promise<Match[]> {
  if (inFlightSportsFetch) return inFlightSportsFetch

  inFlightSportsFetch = (async () => {
    const leagueSlugs = Object.keys(MAIN_LEAGUES)

    // 1. Busca os scoreboards atuais de todas as ligas simultaneamente em paralelo
    const promises = leagueSlugs.map(async (slug) => {
      try {
        const data = await fetchEspnJson<{ events?: Json[]; leagues?: Json[] }>(
          `${ESPN_BASE}/${slug}/scoreboard`,
          45_000 // Cache de 45s para jogos ao vivo
        )
        const events = data.events || []
        const parsed = events.map((e) => parseEspnEvent(e, slug)).filter(Boolean) as Match[]

        // Se houver poucas partidas e calendário com data futura próxima (próximos 5 dias), busca 1 data adicional
        const calendar = data.leagues?.[0]?.calendar || []
        const now = Date.now()
        const fiveDays = now + 5 * 24 * 3600_000

        if (Array.isArray(calendar) && typeof calendar[0] === 'string' && parsed.length < 5) {
          const futureDates = (calendar as string[])
            .map((d) => d.slice(0, 10).replace(/-/g, ''))
            .filter((dStr) => {
              const y = Number(dStr.slice(0, 4))
              const m = Number(dStr.slice(4, 6)) - 1
              const day = Number(dStr.slice(6, 8))
              const dt = new Date(Date.UTC(y, m, day)).getTime()
              return dt > now && dt <= fiveDays
            })
            .slice(0, 1)

          if (futureDates.length > 0) {
            try {
              const dateData = await fetchEspnJson<{ events?: Json[] }>(
                `${ESPN_BASE}/${slug}/scoreboard?dates=${futureDates[0]}`,
                300_000
              )
              const dateEvents = (dateData.events || []).map((e) => parseEspnEvent(e, slug)).filter(Boolean) as Match[]
              parsed.push(...dateEvents)
            } catch {}
          }
        }

        return parsed
      } catch {
        return [] as Match[]
      }
    })

    const settled = await Promise.allSettled(promises)
    const results: Match[] = []
    for (const res of settled) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        results.push(...res.value)
      }
    }

    const deduped = dedupeMatchList(results)
    if (deduped.length > 0) {
      saveCachedSportsHubMatches(deduped)
    }
    return deduped
  })().finally(() => {
    inFlightSportsFetch = null
  })

  return inFlightSportsFetch
}

/** Jogos ao vivo ou ativos no momento */
export async function getGeActiveMatches(): Promise<Match[]> {
  const games = await getTodayMainLeaguesGames()
  return games.filter((m) => m.status === 'LIVE' || m.status === '1H' || m.status === '2H' || m.status === 'HT')
}

/** Partidas garantidas da Copa do Brasil via ESPN (já incluídas em MAIN_LEAGUES) */
export async function getCopaDoBrasilGuaranteedMatches(): Promise<Match[]> {
  return []
}

/** Partidas garantidas de Libertadores e Sul-Americana (já incluídas em MAIN_LEAGUES) */
export async function getContinentalAndEuropeanGuaranteedMatches(): Promise<Match[]> {
  return []
}

/** Resolve as informações do time de coração a partir do mapping ESPN */
export async function resolveTeam(club: Club): Promise<TeamInfo | null> {
  const mapping = CLUB_ESPN_MAP[club.key]
  if (!mapping) {
    return {
      id: club.key,
      name: club.name,
      badge: club.badge,
      leagueIds: ['bra.1'],
    }
  }

  try {
    const data = await fetchEspnJson<{ team?: Json }>(
      `${ESPN_BASE}/${mapping.league}/teams/${mapping.id}`,
      3600_000 // Cache de 1 hora
    )
    const t = data.team
    return {
      id: String(mapping.id),
      name: t?.displayName || club.name,
      badge: t?.logos?.[0]?.href || club.badge,
      leagueIds: [mapping.league],
    }
  } catch {
    return {
      id: mapping.id,
      name: club.name,
      badge: club.badge,
      leagueIds: [mapping.league],
    }
  }
}

/** Busca os próximos e últimos jogos do clube do coração diretamente da ESPN */
export async function getTeamData(club: Club): Promise<TeamData | null> {
  const mapping = CLUB_ESPN_MAP[club.key]
  const info = await resolveTeam(club)
  if (!info) return null

  const channels = TEAM_STRICT_CHANNELS[club.key] || ['SporTV', 'Premiere', 'ESPN', 'CazéTV']
  if (!mapping) {
    return { team: info, next: [], last: [], channels }
  }

  try {
    // 1. Busca próximos confrontos (fixtures futuros)
    const nextData = await fetchEspnJson<{ events?: Json[] }>(
      `${ESPN_BASE}/${mapping.league}/teams/${mapping.id}/schedule?fixture=true`,
      120_000
    )
    const nextEvents = nextData.events || []
    const nextMatches = nextEvents
      .map((e) => parseEspnEvent(e, mapping.league))
      .filter(Boolean) as Match[]

    // 2. Busca histórico recente de resultados (jogos finalizados)
    const pastData = await fetchEspnJson<{ events?: Json[] }>(
      `${ESPN_BASE}/${mapping.league}/teams/${mapping.id}/schedule`,
      300_000
    )
    const pastEvents = pastData.events || []
    const pastMatches = pastEvents
      .map((e) => parseEspnEvent(e, mapping.league))
      .filter((m) => m && m.status === 'FT') as Match[]

    // Ordenação precisa: próximos em ordem cronológica crescente, passados em ordem decrescente
    const now = Date.now()
    const sortedNext = nextMatches
      .filter((m) => m.time >= now - 3 * 3600_000 || m.status === 'LIVE')
      .sort((a, b) => a.time - b.time)

    const sortedLast = pastMatches
      .sort((a, b) => b.time - a.time)
      .slice(0, 5)

    return {
      team: info,
      next: sortedNext,
      last: sortedLast,
      channels,
    }
  } catch (err) {
    console.warn(`Erro ao carregar dados do time ${club.name}:`, err)
    return { team: info, next: [], last: [], channels }
  }
}

export function matchChannels<T extends { name: string }>(channels: T[], wanted: string[], max = 4): T[] {
  const out: T[] = []
  const normList = wanted.map(norm)
  for (const c of channels) {
    const n = norm(c.name)
    if (normList.some((w) => n.includes(w))) {
      out.push(c)
      if (out.length >= max) break
    }
  }
  return out
}

export const SPORTS_FALLBACK = ['sportv', 'premiere', 'espn', 'cazetv', 'globo', 'tnt']
