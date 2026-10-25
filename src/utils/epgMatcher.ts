import type { MediaItem } from '../types'
import type { XtreamService } from '../services/xtreamService'
import { getTeamSearchKeywords } from './sportsPlaylist'

interface EpgMatchResult {
  channel: MediaItem
  matchedProgram: string
  score: number
}

// Cache em memória do EPG por canal para resposta instantânea (3 minutos de TTL)
const epgCache = new Map<number, { time: number; programs: Array<{ title: string; desc: string; start: number; end: number }> }>()

/**
 * Filtra os canais candidatos mais prováveis para escanear o EPG com base no campeonato.
 */
export function getCandidateChannelsForLeague(
  liveList: MediaItem[],
  leagueSlug?: string,
  preferredBroadcasters?: string[]
): MediaItem[] {
  if (!liveList || liveList.length === 0) return []

  const slug = (leagueSlug || '').toLowerCase()
  const candidates: MediaItem[] = []

  // 1. Se temos emissoras sugeridas (ex: ESPN 4, Premiere, SporTV)
  const prefLower = (preferredBroadcasters || []).map((p) => p.toLowerCase())

  for (const item of liveList) {
    const name = item.name.toLowerCase()

    // Descarta notícias e canais generalistas
    if (
      name.includes('news') ||
      name.includes('goytacaz') ||
      name.includes('campos') ||
      name.includes('novela') ||
      name.includes('kids') ||
      name.includes('desenho')
    ) {
      continue
    }

    // 2. Se bate com as emissoras preferidas da partida
    if (prefLower.some((pref) => name.includes(pref))) {
      candidates.push(item)
      continue
    }

    // 3. Filtro por liga
    if (slug.includes('eng') || slug.includes('esp') || slug.includes('ita')) {
      // Futebol Europeu (ESPN 1 a 6, Extra, Disney+)
      if (name.includes('espn') || name.includes('disney') || name.includes('star+')) {
        candidates.push(item)
      }
    } else if (slug.includes('bra')) {
      // Futebol Brasileiro (Premiere 1 a 9, SporTV 1 a 3, CazéTV)
      if (
        name.includes('premiere') ||
        name.includes('sportv') ||
        name.includes('spor tv') ||
        name.includes('cazetv') ||
        name.includes('caze tv')
      ) {
        candidates.push(item)
      }
    } else if (slug.includes('champions')) {
      if (name.includes('tnt') || name.includes('space') || name.includes('max')) {
        candidates.push(item)
      }
    } else if (slug.includes('libertadores') || slug.includes('sudamericana')) {
      if (name.includes('espn') || name.includes('paramount') || name.includes('globo') || name.includes('sbt')) {
        candidates.push(item)
      }
    } else {
      // Fallback geral de esportes principais
      if (
        name.includes('espn') ||
        name.includes('sportv') ||
        name.includes('premiere') ||
        name.includes('tnt sports')
      ) {
        candidates.push(item)
      }
    }

    if (candidates.length >= 12) break
  }

  return candidates
}

/**
 * Consulta a programação EPG dos canais candidatos do IPTV para identificar
 * com precisão cirúrgica qual canal está exibindo a partida ao vivo.
 */
export async function findChannelByEpg(
  service: XtreamService | null,
  liveList: MediaItem[],
  homeTeam: string,
  awayTeam: string,
  options?: {
    leagueSlug?: string
    broadcasters?: string[]
    matchTimestamp?: number
  }
): Promise<MediaItem | null> {
  if (!service || !liveList || liveList.length === 0 || !homeTeam || !awayTeam) {
    return null
  }

  const homeKeywords = getTeamSearchKeywords(homeTeam)
  const awayKeywords = getTeamSearchKeywords(awayTeam)
  if (homeKeywords.length === 0 && awayKeywords.length === 0) return null

  const candidates = getCandidateChannelsForLeague(liveList, options?.leagueSlug, options?.broadcasters)
  if (candidates.length === 0) return null

  const nowSec = Date.now() / 1000
  const matchSec = options?.matchTimestamp ? options.matchTimestamp / 1000 : nowSec
  const windowStart = matchSec - 3600 // 1 hora antes
  const windowEnd = matchSec + 3 * 3600 // até 3 horas depois

  const fetchChannelEpg = async (channel: MediaItem): Promise<EpgMatchResult | null> => {
    try {
      let cached = epgCache.get(channel.id)
      if (!cached || Date.now() - cached.time > 180_000) {
        // Timeout de 2.2 segundos para não atrasar a abertura do player
        const entries = await Promise.race([
          service.getShortEpg(channel.id, 5),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2200)),
        ])

        const parsed = (entries || []).map((e) => ({
          title: (e.title || '').toLowerCase(),
          desc: (e.description || '').toLowerCase(),
          start: e.start,
          end: e.end,
        }))

        cached = { time: Date.now(), programs: parsed }
        epgCache.set(channel.id, cached)
      }

      for (const prog of cached.programs) {
        const isTimeMatch =
          (prog.end >= windowStart && prog.start <= windowEnd) ||
          (prog.start <= nowSec && prog.end >= nowSec)

        if (!isTimeMatch) continue

        const fullText = `${prog.title} ${prog.desc}`

        const hasHome = homeKeywords.some((kw) => fullText.includes(kw))
        const hasAway = awayKeywords.some((kw) => fullText.includes(kw))

        if (hasHome && hasAway) {
          return { channel, matchedProgram: prog.title, score: 1000 }
        }
        if (hasHome || hasAway) {
          return { channel, matchedProgram: prog.title, score: 500 }
        }
      }

      return null
    } catch {
      return null
    }
  }

  try {
    const results = await Promise.allSettled(candidates.map(fetchChannelEpg))
    let bestMatch: EpgMatchResult | null = null

    for (const res of results) {
      if (res.status === 'fulfilled' && res.value) {
        if (!bestMatch || res.value.score > bestMatch.score) {
          bestMatch = res.value
        }
      }
    }

    if (bestMatch && bestMatch.score >= 500) {
      return bestMatch.channel
    }
  } catch {
    // Silencioso
  }

  return null
}
