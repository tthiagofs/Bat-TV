import type { XtreamService } from './xtreamService'
import { makeKey, type MediaItem, type MediaType } from '../types'

/** Cache compartilhado (Home, Navegação e Busca) — cada lista/servidor tem seu próprio cache. */
const cache = new Map<string, Promise<MediaItem[]>>()
const CATALOG_STORAGE_PREFIX = 'iptv-rea:catalog-disk'

function readCatalogDisk(ck: string): MediaItem[] | null {
  try {
    const raw = sessionStorage.getItem(`${CATALOG_STORAGE_PREFIX}:${ck}`)
    if (raw) return JSON.parse(raw) as MediaItem[]
  } catch {}
  return null
}

function writeCatalogDisk(ck: string, list: MediaItem[]) {
  try {
    sessionStorage.setItem(`${CATALOG_STORAGE_PREFIX}:${ck}`, JSON.stringify(list.slice(0, 1000)))
  } catch {}
}

import { findInCatalog } from '../utils/match'

export function getItems(service: XtreamService, type: MediaType, category = 'all'): Promise<MediaItem[]> {
  const ck = `${service.id}|${type}|${category}`
  const hit = cache.get(ck)
  if (hit) return hit

  // Cache de disco (sessionStorage) para abertura rápida
  const diskHit = readCatalogDisk(ck)
  if (diskHit && diskHit.length > 0) {
    const resolved = Promise.resolve(diskHit)
    cache.set(ck, resolved)
    // Atualiza em background para obter lista completa sem truncamento
    setTimeout(() => {
      fetchItemsFromService(service, type, category).then((fresh) => {
        if (fresh && fresh.length > 0) {
          cache.set(ck, Promise.resolve(fresh))
          writeCatalogDisk(ck, fresh)
        }
      }).catch(() => {})
    }, 50)
    return resolved
  }

  const p = fetchItemsFromService(service, type, category)
  cache.set(ck, p)
  p.then((items) => writeCatalogDisk(ck, items)).catch(() => cache.delete(ck))
  return p
}

async function fetchItemsFromService(service: XtreamService, type: MediaType, category = 'all'): Promise<MediaItem[]> {
  const c = category === 'all' ? undefined : category

  if (type === 'live') {
    return (await service.getLiveStreams(c)).map((s) => ({
      key: makeKey('live', s.stream_id),
      type: 'live' as const,
      id: s.stream_id,
      name: s.name,
      image: s.stream_icon,
    }))
  }

  if (type === 'series') {
    // Para séries, o endpoint get_series sem category_id retorna todas as séries da conta
    try {
      const list = await service.getSeries(c)
      if (list && list.length > 0) {
        return list.map((s) => ({
          key: makeKey('series', s.series_id),
          type: 'series' as const,
          id: s.series_id,
          name: s.name,
          image: s.cover,
          rating: s.rating,
        }))
      }
    } catch {
      // Se falhar chamada global, busca por categorias
    }

    if (category === 'all') {
      try {
        const cats = await service.getSeriesCategories()
        const lists = await Promise.all(
          cats.map((cat) => getItems(service, 'series', cat.category_id).catch(() => [] as MediaItem[]))
        )
        const combined: MediaItem[] = []
        const seen = new Set<string>()
        for (const l of lists) {
          for (const item of l) {
            if (!seen.has(item.key)) {
              seen.add(item.key)
              combined.push(item)
            }
          }
        }
        return combined
      } catch {}
    }
    return []
  }

  // Filmes (VOD)
  try {
    const list = await service.getVodStreams(c)
    if (list && list.length > 0) {
      return list.map((s) => ({
        key: makeKey('movies', s.stream_id),
        type: 'movies' as const,
        id: s.stream_id,
        name: s.name,
        image: s.stream_icon,
        ext: s.container_extension,
        rating: s.rating,
      }))
    }
  } catch {
    // Fallback por categorias se get_vod_streams global falhar
  }

  if (category === 'all') {
    try {
      const cats = await service.getVodCategories()
      const lists = await Promise.all(
        cats.map((cat) => getItems(service, 'movies', cat.category_id).catch(() => [] as MediaItem[]))
      )
      const combined: MediaItem[] = []
      const seen = new Set<string>()
      for (const l of lists) {
        for (const item of l) {
          if (!seen.has(item.key)) {
            seen.add(item.key)
            combined.push(item)
          }
        }
      }
      return combined
    } catch {}
  }

  return []
}

/**
 * Busca por título no catálogo IPTV:
 * 1º Tenta no catálogo unificado (em cache de memória).
 * 2º Se não encontrar, busca em todas as categorias.
 */
export async function searchTitleInCatalog(
  service: XtreamService,
  type: MediaType,
  target: { title: string; originalTitle?: string }
): Promise<MediaItem | undefined> {
  const fullList = await getItems(service, type, 'all').catch(() => [])
  const found = findInCatalog(fullList, target)
  if (found) return found

  try {
    const cats = type === 'movies' ? await service.getVodCategories() : await service.getSeriesCategories()
    const allCatResults = await Promise.all(
      cats.map((c) => getItems(service, type, c.category_id).catch(() => [] as MediaItem[]))
    )
    for (const list of allCatResults) {
      const match = findInCatalog(list, target)
      if (match) return match
    }
  } catch (err) {
    console.warn('Erro ao pesquisar título no IPTV:', err)
  }
  return undefined
}

/** Prévia leve para a Home: só a 1ª categoria (em vez do catálogo inteiro) e no máximo `count` itens. */
export async function getPreviewItems(service: XtreamService, type: MediaType, count = 24): Promise<MediaItem[]> {
  try {
    const cats =
      type === 'live' ? await service.getLiveCategories()
      : type === 'movies' ? await service.getVodCategories()
      : await service.getSeriesCategories()
    for (const cat of cats.slice(0, 3)) {
      const list = await getItems(service, type, cat.category_id)
      if (list.length > 0) return list.slice(0, count)
    }
    return []
  } catch {
    return []
  }
}

const GENRE_KEYWORDS_MAP: Record<string, string[]> = {
  dorama: ['dorama', 'corean', 'k-drama', 'kdrama', 'asiatic', 'asia', 'japones'],
  anime: ['anime', 'animacao', 'desenho', 'manga', 'animado'],
  acao: ['acao', 'aventura', 'action', 'adventure', 'guerra', 'policial'],
  comedia: ['comedia', 'comedy', 'stand-up', 'humor'],
  suspense: ['suspense', 'terror', 'horror', 'thriller', 'misterio', 'crime'],
  romance: ['romance', 'romantico', 'drama'],
  ficcao: ['ficcao', 'sci-fi', 'fantasia', 'super', 'marvel', 'dc', 'heroi'],
  infantil: ['infantil', 'kids', 'desenho', 'animacao', 'familia', 'disney'],
  documentario: ['documentar', 'doc', 'biografia', 'historia'],
  futebol: ['futebol', 'esporte', 'sport', 'jogos', 'luta'],
}

/**
 * Motor Inteligente de Recomendações:
 * Cruza as preferências de gênero do perfil e palavras-chave de itens que o usuário curtiu (Gostei),
 * encontrando as categorias correspondentes e mesclando os melhores títulos.
 */
export async function getRecommendedItems(
  service: XtreamService,
  type: MediaType,
  genreKeywords: string[] = [],
  likedNames: string[] = [],
  count = 24
): Promise<MediaItem[]> {
  try {
    const cats =
      type === 'live' ? await service.getLiveCategories()
      : type === 'movies' ? await service.getVodCategories()
      : await service.getSeriesCategories()

    if (!cats || cats.length === 0) return []

    // 1. Identifica categorias que combinam com os gêneros prediletos
    const matchedCatIds: string[] = []
    const cleanStr = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

    // Cruzamento por gêneros escolhidos no perfil
    for (const gid of genreKeywords) {
      const terms = GENRE_KEYWORDS_MAP[gid] || [gid]
      for (const cat of cats) {
        const catNorm = cleanStr(cat.category_name)
        if (terms.some((t) => catNorm.includes(t)) && !matchedCatIds.includes(cat.category_id)) {
          matchedCatIds.push(cat.category_id)
        }
      }
    }

    // Cruzamento adicional por nomes de títulos curtidos (ex: se curtiu "Doutor Estranho", busca categorias com herói/ação)
    if (likedNames.length > 0) {
      const likedTerms = likedNames.flatMap((n) => cleanStr(n).split(/\s+/).filter((w) => w.length > 3))
      for (const cat of cats) {
        const catNorm = cleanStr(cat.category_name)
        if (likedTerms.some((t) => catNorm.includes(t)) && !matchedCatIds.includes(cat.category_id)) {
          matchedCatIds.push(cat.category_id)
        }
      }
    }

    // Se encontrou categorias personalizadas, carrega as principais
    if (matchedCatIds.length > 0) {
      const topCats = matchedCatIds.slice(0, 4)
      const results = await Promise.all(
        topCats.map((catId) => getItems(service, type, catId).catch(() => [] as MediaItem[]))
      )
      const combined: MediaItem[] = []
      const maxRows = Math.max(...results.map((r) => r.length), 0)
      // Intercala os itens das categorias para dar variedade equilibrada
      for (let i = 0; i < maxRows && combined.length < count; i++) {
        for (const list of results) {
          if (list[i] && !combined.some((x) => x.key === list[i].key)) {
            combined.push(list[i])
            if (combined.length >= count) break
          }
        }
      }
      if (combined.length > 0) return combined
    }

    // Fallback: traz os itens da primeira e segunda categoria popular do catálogo
    for (const cat of cats.slice(0, 3)) {
      const list = await getItems(service, type, cat.category_id).catch(() => [])
      if (list.length > 0) return list.slice(0, count)
    }
    return []
  } catch {
    return []
  }
}

/**
 * Busca fileira temática exclusiva de nicho (ex: Doramas, Animes, Ação)
 */
export async function getPersonalizedItems(
  service: XtreamService,
  type: MediaType,
  genreKeywords: string[],
  count = 20
): Promise<{ title: string; items: MediaItem[] } | null> {
  if (!genreKeywords || genreKeywords.length === 0) return null
  try {
    const cats =
      type === 'live' ? await service.getLiveCategories()
      : type === 'movies' ? await service.getVodCategories()
      : await service.getSeriesCategories()

    const cleanStr = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

    for (const genreId of genreKeywords) {
      const matchTerms = GENRE_KEYWORDS_MAP[genreId] || [genreId]
      const matchingCat = cats.find((c) => {
        const catName = cleanStr(c.category_name)
        return matchTerms.some((t) => catName.includes(t))
      })

      if (matchingCat) {
        const list = await getItems(service, type, matchingCat.category_id)
        if (list.length > 0) {
          const displayLabel =
            genreId === 'dorama' ? 'Doramas & K-Dramas Recomendados'
            : genreId === 'anime' ? 'Animes & Animações Recomendados'
            : `Destaque: ${matchingCat.category_name}`
          return { title: displayLabel, items: list.slice(0, count) }
        }
      }
    }
    return null
  } catch {
    return null
  }
}

