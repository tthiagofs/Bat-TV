import type { MediaItem } from '../types'

/** Normaliza um título (sem acentos, símbolos ou espaços) para comparação. */
export function cleanTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

interface TitleLike {
  title: string
  originalTitle?: string
}

/** Encontra no catálogo IPTV o item que corresponde a um título do TMDB (exato → original → parcial). */
export function findInCatalog(catalog: MediaItem[], target: TitleLike): MediaItem | undefined {
  const t = cleanTitle(target.title)
  const o = target.originalTitle ? cleanTitle(target.originalTitle) : ''
  if (!t && !o) return undefined

  return (
    catalog.find((i) => cleanTitle(i.name) === t) ||
    (o ? catalog.find((i) => cleanTitle(i.name) === o) : undefined) ||
    catalog.find((i) => {
      const n = cleanTitle(i.name)
      return (t && n.includes(t)) || (o && n.includes(o))
    })
  )
}
