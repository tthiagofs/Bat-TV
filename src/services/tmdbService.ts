/**
 * Serviço de Integração oficial com a API do The Movie Database (TMDB)
 */
const TMDB_API_KEY = '4e44d9029b1270a757cddc766a1bcb63'
const BASE_URL = 'https://api.themoviedb.org/3'
export const TMDB_IMAGE_ORIGINAL = 'https://image.tmdb.org/t/p/original'
export const TMDB_IMAGE_W500 = 'https://image.tmdb.org/t/p/w500'
export const TMDB_IMAGE_W1280 = 'https://image.tmdb.org/t/p/w1280'

import type { MediaItem } from '../types'

export interface TmdbItem {
  id: number
  title: string
  originalTitle?: string
  overview: string
  backdropPath: string | null
  posterPath: string | null
  voteAverage: number
  popularity?: number
  releaseDate?: string
  mediaType: 'movie' | 'tv'
  genreIds?: number[]
  mediaItem?: MediaItem
}

export interface EpisodeItem {
  id: number
  episodeNumber: number
  name: string
  overview: string
  stillPath: string | null
  runtime?: number
  airDate?: string
}

export interface TmdbDetails extends TmdbItem {
  runtime?: number
  genres?: string[]
  cast?: { id: number; name: string; character: string; profilePath: string | null }[]
  trailerKey?: string | null
  numberOfSeasons?: number
  seasons?: { seasonNumber: number; name: string; episodeCount: number }[]
}

export interface StreamingProvider {
  id: number
  name: string
  logo: string
  network?: string
}

export const STREAMING_PROVIDERS: StreamingProvider[] = [
  { id: 8, name: 'Netflix', logo: 'https://images.ctfassets.net/4cd45et68cgf/Rx83JoRBen9qmCVgfQEkh/d422da2639a73704c6715d23f54b59f4/Netflix-Symbol.png', network: '213' },
  { id: 119, name: 'Prime Video', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Amazon_Prime_Video_logo.svg/512px-Amazon_Prime_Video_logo.svg.png', network: '1024' },
  { id: 1899, name: 'Max', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Max_logo.svg/512px-Max_logo.svg.png', network: '49|3186' },
  { id: 337, name: 'Disney+', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Disney%2B_logo.svg/512px-Disney%2B_logo.svg.png', network: '2739' },
]

const tmdbCache = new Map<string, { t: number; p: Promise<unknown> }>()
const TMDB_DISK_KEY = 'iptv-rea:tmdb-disk:v1'
const TMDB_TTL_SHORT = 60 * 60_000 // 1 hora para listas dinâmicas/trending
const TMDB_TTL_LONG = 24 * 3600_000 // 24 horas para detalhes, trailers, elenco e sinopses

function readTmdbDisk(): Record<string, { t: number; data: unknown }> {
  try {
    return JSON.parse(localStorage.getItem(TMDB_DISK_KEY) || '{}')
  } catch {
    return {}
  }
}

function writeTmdbDisk(key: string, data: unknown) {
  try {
    const disk = readTmdbDisk()
    disk[key] = { t: Date.now(), data }
    const keys = Object.keys(disk)
    if (keys.length > 250) delete disk[keys[0]]
    localStorage.setItem(TMDB_DISK_KEY, JSON.stringify(disk))
  } catch {
    /* ignore storage quota */
  }
}

async function fetchTmdb<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}/${endpoint}`)
  url.searchParams.set('api_key', TMDB_API_KEY)
  url.searchParams.set('language', 'pt-BR')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v))
  }
  const key = url.toString()
  const ttl = /^(trending|discover|search)/.test(endpoint) ? TMDB_TTL_SHORT : TMDB_TTL_LONG

  // 1. Verifica cache em memória
  const memHit = tmdbCache.get(key)
  if (memHit && Date.now() - memHit.t < ttl) return memHit.p as Promise<T>

  // 2. Verifica cache persistente em disco (Item C: 24h de TTL para detalhes e trailers)
  const disk = readTmdbDisk()
  const diskHit = disk[key]
  if (diskHit && Date.now() - diskHit.t < ttl) {
    const resolved = Promise.resolve(diskHit.data as T)
    tmdbCache.set(key, { t: diskHit.t, p: resolved })
    return resolved
  }

  // 3. Busca na rede e salva em ambos os caches
  const p = fetch(key).then(async (res) => {
    if (!res.ok) throw new Error(`TMDB HTTP ${res.status}`)
    const data = (await res.json()) as T
    writeTmdbDisk(key, data)
    return data
  })
  tmdbCache.set(key, { t: Date.now(), p })
  p.catch(() => tmdbCache.delete(key))
  if (tmdbCache.size > 200) tmdbCache.delete(tmdbCache.keys().next().value as string)
  return p
}

function parseTmdb(raw: Record<string, any>, defaultType?: 'movie' | 'tv'): TmdbItem {
  const isMovie = raw.media_type ? raw.media_type === 'movie' : defaultType === 'movie' || !!raw.title
  return {
    id: raw.id,
    title: raw.title || raw.name || 'Sem título',
    originalTitle: raw.original_title || raw.original_name,
    overview: raw.overview || '',
    backdropPath: raw.backdrop_path ? `${TMDB_IMAGE_W1280}${raw.backdrop_path}` : null,
    posterPath: raw.poster_path ? `${TMDB_IMAGE_W500}${raw.poster_path}` : null,
    voteAverage: Number(raw.vote_average ? Number(raw.vote_average).toFixed(1) : '7.0'),
    popularity: Number(raw.popularity || 0),
    releaseDate: raw.release_date || raw.first_air_date || '',
    mediaType: isMovie ? 'movie' : 'tv',
    genreIds: raw.genre_ids || [],
  }
}

/** Top 8 Títulos mais em alta no Brasil no momento (Mix de Filmes e Séries para o Hero da Home) */
export async function getTrendingHero(count = 8): Promise<TmdbItem[]> {
  try {
    const [moviesData, tvData] = await Promise.all([
      fetchTmdb<{ results: any[] }>('trending/movie/week', { region: 'BR' }).catch(() => ({ results: [] })),
      fetchTmdb<{ results: any[] }>('trending/tv/week', { region: 'BR' }).catch(() => ({ results: [] })),
    ])

    const movies = (moviesData.results || [])
      .filter((m) => !!m.backdrop_path && !!m.title && (m.overview || '').length > 10)
      .map((m) => parseTmdb(m, 'movie'))

    const series = (tvData.results || [])
      .filter((s) => !!s.backdrop_path && !!(s.name || s.title) && (s.overview || '').length > 10 && !s.genre_ids?.includes(10767) && !s.genre_ids?.includes(10763))
      .map((s) => parseTmdb(s, 'tv'))

    // Intercala filme e série para variedade perfeita no Top 8
    const combined: TmdbItem[] = []
    const maxLen = Math.max(movies.length, series.length)
    for (let i = 0; i < maxLen; i++) {
      if (movies[i]) combined.push(movies[i])
      if (series[i]) combined.push(series[i])
      if (combined.length >= count) break
    }

    return combined.slice(0, count)
  } catch (err) {
    console.error('Erro ao carregar trending TMDB:', err)
    return []
  }
}

/** 5 Filmes mais populares e em alta no Brasil no momento */
export async function getTrendingMovies(count = 5): Promise<TmdbItem[]> {
  try {
    const data = await fetchTmdb<{ results: any[] }>('trending/movie/week', { region: 'BR' })
    return (data.results || [])
      .filter((i) => !!i.backdrop_path && !!i.title && (i.overview || '').length > 10)
      .slice(0, count)
      .map((i) => parseTmdb(i, 'movie'))
  } catch (err) {
    console.error('Erro ao carregar trending movies TMDB:', err)
    return []
  }
}

/** 5 Séries mais populares e em alta no momento */
export async function getTrendingSeries(count = 5): Promise<TmdbItem[]> {
  try {
    const data = await fetchTmdb<{ results: any[] }>('trending/tv/week', { region: 'BR' })
    return (data.results || [])
      .filter((i) => !!i.backdrop_path && !!(i.name || i.title) && (i.overview || '').length > 10 && !i.genre_ids?.includes(10767) && !i.genre_ids?.includes(10763))
      .slice(0, count)
      .map((i) => parseTmdb(i, 'tv'))
  } catch (err) {
    console.error('Erro ao carregar trending series TMDB:', err)
    return []
  }
}

/** Busca título no TMDB para obter detalhes, sinopse, poster e episódios */
export async function searchTmdbItem(query: string, mediaType: 'movie' | 'tv'): Promise<TmdbItem | null> {
  try {
    // Limpa tags típicas de releases IPTV como [FHD], 1080p, (2024), 4K, Dublado, Legendado
    const cleanQ = query
      .replace(/\[.*?\]|\(.*?\)/g, '')
      .replace(/\b(4k|fhd|hd|1080p|720p|dublado|legendado|dual|multi|h264|h265|hevc|web-dl|rip)\b/gi, '')
      .trim()

    if (!cleanQ) return null

    const endpoint = mediaType === 'movie' ? 'search/movie' : 'search/tv'
    const data = await fetchTmdb<{ results: any[] }>(endpoint, {
      query: cleanQ,
      include_adult: 'false',
    })

    const first = (data.results || []).find((r) => !!r.backdrop_path || !!r.poster_path) || data.results?.[0]
    if (first) {
      return parseTmdb(first, mediaType)
    }
    return null
  } catch (err) {
    console.error('Erro ao buscar item no TMDB:', err)
    return null
  }
}

/** Top 10 mais populares no Brasil filtrado por Streaming autêntico */
export async function getTop10ByProvider(providerId: number): Promise<TmdbItem[]> {
  try {
    const provConfig = STREAMING_PROVIDERS.find((p) => p.id === providerId)
    const networkId = provConfig?.network || '213'

    const [moviesData, tvData] = await Promise.all([
      fetchTmdb<{ results: any[] }>('discover/movie', {
        sort_by: 'popularity.desc',
        watch_region: 'BR',
        with_watch_providers: providerId,
        with_watch_monetization_types: 'flatrate',
      }).catch(() => ({ results: [] })),
      fetchTmdb<{ results: any[] }>('discover/tv', {
        sort_by: 'popularity.desc',
        with_networks: networkId,
      }).catch(() => ({ results: [] })),
    ])

    const combined: TmdbItem[] = [
      ...(moviesData.results || []).slice(0, 7).map((m) => parseTmdb(m, 'movie')),
      ...(tvData.results || []).slice(0, 7).map((t) => parseTmdb(t, 'tv')),
    ]

    // Ordena rigorosamente pela popularidade real de audiência da plataforma
    return combined
      .filter((i) => !!i.posterPath)
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, 10)
  } catch (err) {
    console.error('Erro ao buscar Top 10 Streaming TMDB:', err)
    return []
  }
}

/** Detalhes completos (elenco, trailer do YouTube, sinopse completa, temporadas) */
export async function getMediaDetails(id: number, mediaType: 'movie' | 'tv'): Promise<TmdbDetails | null> {
  try {
    const [details, credits, videos] = await Promise.all([
      fetchTmdb<any>(`${mediaType}/${id}`),
      fetchTmdb<any>(`${mediaType}/${id}/credits`).catch(() => ({ cast: [] })),
      fetchTmdb<any>(`${mediaType}/${id}/videos`).catch(() => ({ results: [] })),
    ])

    const trailer = (videos.results || []).find(
      (v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'),
    )

    const cast = (credits.cast || []).slice(0, 6).map((c: any) => ({
      id: c.id,
      name: c.name,
      character: c.character,
      profilePath: c.profile_path ? `${TMDB_IMAGE_W500}${c.profile_path}` : null,
    }))

    const seasons = (details.seasons || [])
      .filter((s: any) => s.season_number > 0)
      .map((s: any) => ({
        seasonNumber: s.season_number,
        name: s.name || `Temporada ${s.season_number}`,
        episodeCount: s.episode_count,
      }))

    return {
      ...parseTmdb(details, mediaType),
      runtime: details.runtime || details.episode_run_time?.[0],
      genres: (details.genres || []).map((g: any) => g.name),
      cast,
      trailerKey: trailer?.key || null,
      numberOfSeasons: details.number_of_seasons,
      seasons: seasons.length > 0 ? seasons : undefined,
    }
  } catch (err) {
    console.error('Erro ao buscar detalhes TMDB:', err)
    return null
  }
}

/** Busca apenas a chave do trailer do YouTube de forma ultra-rápida */
export async function getTrailerKey(id: number, mediaType: 'movie' | 'tv'): Promise<string | null> {
  try {
    const videos = await fetchTmdb<any>(`${mediaType}/${id}/videos`).catch(() => ({ results: [] }))
    const trailer = (videos.results || []).find(
      (v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'),
    ) || videos.results?.[0]
    return trailer?.key || null
  } catch {
    return null
  }
}

/** Busca a chave do trailer do YouTube pelo nome do filme ou série */
export async function getTrailerKeyByTitle(title: string, mediaType: 'movie' | 'tv'): Promise<string | null> {
  try {
    const tmdb = await searchTmdbItem(title, mediaType)
    if (tmdb?.id) {
      return getTrailerKey(tmdb.id, mediaType)
    }
    return null
  } catch {
    return null
  }
}

/** Busca os episódios de uma temporada específica de uma série */
export async function getTvSeasonEpisodes(tvId: number, seasonNumber = 1): Promise<EpisodeItem[]> {
  try {
    const data = await fetchTmdb<any>(`tv/${tvId}/season/${seasonNumber}`)
    return (data.episodes || []).map((ep: any) => ({
      id: ep.id,
      episodeNumber: ep.episode_number,
      name: ep.name || `Episódio ${ep.episode_number}`,
      overview: ep.overview || 'Sinopse não disponível para este episódio.',
      stillPath: ep.still_path ? `${TMDB_IMAGE_W500}${ep.still_path}` : null,
      runtime: ep.runtime,
      airDate: ep.air_date,
    }))
  } catch (err) {
    console.error(`Erro ao carregar temporada ${seasonNumber} da série ${tvId}:`, err)
    return []
  }
}

/** Títulos recomendados / similares ("Os clientes também assistiram") */
export async function getSimilarRecommendations(id: number, mediaType: 'movie' | 'tv'): Promise<TmdbItem[]> {
  try {
    const [rec, sim] = await Promise.all([
      fetchTmdb<{ results: any[] }>(`${mediaType}/${id}/recommendations`).catch(() => ({ results: [] })),
      fetchTmdb<{ results: any[] }>(`${mediaType}/${id}/similar`).catch(() => ({ results: [] })),
    ])

    const list = [...(rec.results || []), ...(sim.results || [])]
    const seen = new Set<number>()
    const unique: TmdbItem[] = []

    for (const item of list) {
      if (item.id !== id && !seen.has(item.id) && (item.backdrop_path || item.poster_path)) {
        seen.add(item.id)
        unique.push(parseTmdb(item, mediaType))
      }
    }

    return unique.slice(0, 10)
  } catch (err) {
    console.error('Erro ao buscar recomendações similares:', err)
    return []
  }
}
