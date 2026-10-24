import type { MediaItem } from '../types'

/** Dicionário de variações e sub-canais por emissora */
const CHANNEL_ALIASES: Record<string, string[]> = {
  sportv: ['sportv', 'spor tv', 'sport tv', 'sportv 1', 'spor tv 1'],
  'sportv 2': ['sportv 2', 'spor tv 2', 'sport tv 2'],
  'sportv 3': ['sportv 3', 'spor tv 3', 'sport tv 3'],
  espn: ['espn', 'espn brasil', 'espn 1'],
  'espn 2': ['espn 2', 'espn2'],
  'espn 3': ['espn 3', 'espn3'],
  'espn 4': ['espn 4', 'espn4'],
  'espn 5': ['espn 5', 'espn5'],
  'espn 6': ['espn 6', 'espn6'],
  'espn extra': ['espn extra'],
  premiere: ['premiere clubes', 'premiere club', 'premiere hd', 'premiere'],
  'premiere 2': ['premiere 2', 'premiere2'],
  'premiere 3': ['premiere 3', 'premiere3'],
  'premiere 4': ['premiere 4', 'premiere4'],
  'premiere 5': ['premiere 5', 'premiere5'],
  'premiere 6': ['premiere 6', 'premiere6'],
  cazetv: ['cazetv', 'caze tv', 'cazé tv', 'caze tv hd', 'cazetv hd', 'caze tv fhd', 'canal caze', 'caze', 'cazé'],
  record: ['record tv', 'rede record', 'tv record', 'record sp', 'record rj', 'record paulista', 'record'],
  globo: ['tv globo', 'globo sp', 'globo rj', 'rede globo', 'globo minas', 'globo'],
  sbt: ['tv sbt', 'sbt sp', 'sbt rj', 'rede sbt', 'sbt'],
  band: ['tv band', 'band sp', 'rede bandeirantes', 'band'],
  bandsports: ['bandsports', 'band sports'],
  tnt: ['tnt sports', 'tnt'],
  space: ['space'],
  max: ['hbo max', 'max hd', 'max fhd', 'max 4k', 'max'],
  'prime video': ['prime video', 'amazon prime', 'prime'],
  'paramount+': ['paramount+', 'paramount'],
  goat: ['canal goat', 'goat'],
  'disney+': ['disney+', 'disney plus', 'disney', 'star+', 'star plus'],
}

/**
 * Encontra com inteligência o melhor canal ao vivo da lista do usuário para uma emissora/canal desejado.
 * Evita bugs clássicos como abrir "SBT News" em vez do "SBT", ou "GloboNews" em vez da "TV Globo".
 */
export function findBestLiveChannel(
  liveList: MediaItem[],
  targets: string | string[]
): MediaItem | null {
  if (!liveList || liveList.length === 0 || !targets) return null

  const targetList = Array.isArray(targets) ? targets : [targets]
  const cleanedTargets = targetList
    .map((t) => (t || '').trim().toLowerCase())
    .filter(Boolean)

  if (cleanedTargets.length === 0) return null

  for (const rawTarget of cleanedTargets) {
    // Expande variações se existirem no dicionário
    const searchTerms = CHANNEL_ALIASES[rawTarget] || [rawTarget]

    let bestItem: MediaItem | null = null
    let highestScore = -Infinity

    for (const item of liveList) {
      const name = item.name.toLowerCase()

      // Verifica se o canal contém algum dos termos de busca
      const matchedTerm = searchTerms.find((t) => name.includes(t))
      if (!matchedTerm) continue

      let score = 100

      // 1. Penalidades Severas para canais de notícias e novelas
      const isTargetNews = rawTarget.includes('news')
      if (!isTargetNews && (name.includes('news') || name.includes('noticias'))) {
        score -= 250 // Ex: 'SBT News', 'BandNews'
      }
      if (name.includes('novelas')) {
        score -= 250 // Ex: 'TNT Novelas'
      }

      // 2. Diferenciação de canais numerados e isolamento de emissoras
      if (rawTarget !== 'record' && !rawTarget.includes('record') && (name.includes('record') || name.includes('rederecord'))) {
        score -= 300 // Impede que Record seja puxada para canais como CazéTV, Premiere, etc.
      }

      if (rawTarget === 'cazetv') {
        if (!name.includes('caze') && !name.includes('cazé')) {
          score -= 500
        }
      }

      if (rawTarget === 'sportv' || rawTarget === 'sportv 1') {
        if (name.includes('sportv 2') || name.includes('spor tv 2') || name.includes('sportv 3') || name.includes('spor tv 3') || name.includes('sportv 4')) {
          score -= 90
        }
      } else if (rawTarget === 'espn' || rawTarget === 'espn 1') {
        if (name.includes('espn 2') || name.includes('espn 3') || name.includes('espn 4') || name.includes('espn 5') || name.includes('espn 6') || name.includes('extra')) {
          score -= 90
        }
      } else if (rawTarget === 'globo') {
        if (name.includes('globonews') || name.includes('globo news') || name.includes('rural')) {
          score -= 250
        }
      } else if (rawTarget === 'band') {
        if (name.includes('bandnews') || name.includes('band sports') || name.includes('bandsports')) {
          score -= 150
        }
      }

      // 3. Correspondência exata da palavra (Word boundary)
      const wordRegex = new RegExp(`\\b${matchedTerm}\\b`, 'i')
      if (wordRegex.test(name)) {
        score += 60
      }

      // 4. Bônus por Qualidade de Imagem HD / Full HD / 4K
      if (name.includes('4k') || name.includes('uhd')) score += 35
      else if (name.includes('fhd') || name.includes('1080')) score += 30
      else if (name.includes('hd') || name.includes('720')) score += 20

      // 5. Bônus para praças principais ou feed nacional
      if (
        name.includes('sp') ||
        name.includes('são paulo') ||
        name.includes('rj') ||
        name.includes('nacional') ||
        name.includes('rede')
      ) {
        score += 15
      }

      // 6. Preferência por nomes mais limpos e curtos
      score -= Math.min(30, name.length * 0.5)

      if (score > highestScore) {
        highestScore = score
        bestItem = item
      }
    }

    if (bestItem) return bestItem
  }

  // Fallback: busca parcial direta
  for (const rawTarget of cleanedTargets) {
    const searchTerms = CHANNEL_ALIASES[rawTarget] || [rawTarget]
    for (const term of searchTerms) {
      const found = liveList.find((ch) => ch.name.toLowerCase().includes(term))
      if (found) return found
    }
  }

  return null
}

export interface MatchedChannelOption {
  targetName: string
  channel: MediaItem
  quality: string
}

/**
 * Encontra todos os canais correspondentes distintos da lista IPTV
 * para os canais transmitindo a partida (ex: ESPN, CazéTV, Premiere, SporTV).
 * Expande automaticamente sub-canais (ex: ESPN 1 a 4, Premiere 2 a 6, SporTV 1 a 3)
 * para que o usuário possa escolher a emissora e a qualidade exata desejada.
 */
export function findAllMatchingLiveChannels(
  liveList: MediaItem[],
  targets: string | string[]
): MatchedChannelOption[] {
  if (!liveList || liveList.length === 0 || !targets) return []

  const targetList = Array.isArray(targets) ? targets : [targets]
  const cleanedTargets = targetList
    .map((t) => (t || '').trim())
    .filter(Boolean)

  if (cleanedTargets.length === 0) return []

  // Constrói a lista expandida de sub-alvos para cada emissora
  const subTargets: { displayGroup: string; searchTarget: string }[] = []

  for (const raw of cleanedTargets) {
    const low = raw.toLowerCase()

    const hasSpecificSubchannel = /\b([2-9]|extra)\b/i.test(low)

    if (low.includes('espn')) {
      if (hasSpecificSubchannel) {
        subTargets.push({ displayGroup: raw, searchTarget: low })
      } else {
        subTargets.push(
          { displayGroup: 'ESPN', searchTarget: 'espn' },
          { displayGroup: 'ESPN 2', searchTarget: 'espn 2' },
          { displayGroup: 'ESPN 3', searchTarget: 'espn 3' },
          { displayGroup: 'ESPN 4', searchTarget: 'espn 4' },
          { displayGroup: 'ESPN 5', searchTarget: 'espn 5' },
          { displayGroup: 'ESPN 6', searchTarget: 'espn 6' }
        )
      }
    } else if (low.includes('premiere')) {
      if (hasSpecificSubchannel) {
        subTargets.push({ displayGroup: raw, searchTarget: low })
      } else {
        subTargets.push(
          { displayGroup: 'Premiere Clubes', searchTarget: 'premiere' },
          { displayGroup: 'Premiere 2', searchTarget: 'premiere 2' },
          { displayGroup: 'Premiere 3', searchTarget: 'premiere 3' },
          { displayGroup: 'Premiere 4', searchTarget: 'premiere 4' },
          { displayGroup: 'Premiere 5', searchTarget: 'premiere 5' }
        )
      }
    } else if (low.includes('sportv') || low.includes('spor tv')) {
      if (hasSpecificSubchannel) {
        subTargets.push({ displayGroup: raw, searchTarget: low })
      } else {
        subTargets.push(
          { displayGroup: 'SporTV', searchTarget: 'sportv' },
          { displayGroup: 'SporTV 2', searchTarget: 'sportv 2' },
          { displayGroup: 'SporTV 3', searchTarget: 'sportv 3' }
        )
      }
    } else if (low.includes('caze') || low.includes('cazé')) {
      subTargets.push({ displayGroup: 'CazéTV', searchTarget: 'cazetv' })
    } else if (low.includes('record')) {
      subTargets.push({ displayGroup: 'Record TV', searchTarget: 'record' })
    } else if (low.includes('globo')) {
      subTargets.push({ displayGroup: 'TV Globo', searchTarget: 'globo' })
    } else if (low.includes('sbt')) {
      subTargets.push({ displayGroup: 'SBT', searchTarget: 'sbt' })
    } else if (low.includes('bandsports') || low.includes('band sports')) {
      subTargets.push({ displayGroup: 'BandSports', searchTarget: 'bandsports' })
    } else if (low.includes('band')) {
      subTargets.push({ displayGroup: 'Band', searchTarget: 'band' })
    } else if (low.includes('tnt')) {
      subTargets.push(
        { displayGroup: 'TNT Sports', searchTarget: 'tnt' },
        { displayGroup: 'Space', searchTarget: 'space' },
        { displayGroup: 'Max', searchTarget: 'max' }
      )
    } else if (low.includes('space')) {
      subTargets.push({ displayGroup: 'Space', searchTarget: 'space' })
    } else if (low.includes('max') || low.includes('hbo')) {
      subTargets.push({ displayGroup: 'Max', searchTarget: 'max' })
    } else if (low.includes('prime')) {
      subTargets.push({ displayGroup: 'Prime Video', searchTarget: 'prime video' })
    } else if (low.includes('paramount')) {
      subTargets.push({ displayGroup: 'Paramount+', searchTarget: 'paramount+' })
    } else if (low.includes('goat')) {
      subTargets.push({ displayGroup: 'Canal GOAT', searchTarget: 'goat' })
    } else if (low.includes('disney') || low.includes('star+')) {
      subTargets.push({ displayGroup: 'Disney+', searchTarget: 'disney+' })
    } else {
      subTargets.push({ displayGroup: raw, searchTarget: low })
    }
  }

  const results: MatchedChannelOption[] = []
  const seenIds = new Set<number>()

  for (const { displayGroup, searchTarget } of subTargets) {
    const best = findBestLiveChannel(liveList, searchTarget)
    if (best && !seenIds.has(best.id)) {
      seenIds.add(best.id)

      let quality = 'HD'
      const lower = best.name.toLowerCase()
      if (lower.includes('4k') || lower.includes('uhd')) quality = '4K'
      else if (lower.includes('fhd') || lower.includes('1080')) quality = 'FHD'
      else if (lower.includes('sd') || lower.includes('480')) quality = 'SD'
      else if (lower.includes('hd') || lower.includes('720')) quality = 'HD'

      results.push({
        targetName: displayGroup,
        channel: best,
        quality,
      })
    }
  }

  return results
}
