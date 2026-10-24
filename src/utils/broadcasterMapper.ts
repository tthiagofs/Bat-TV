import type { MediaItem } from '../types'
import { findBestLiveChannel } from './channelMatcher'

export interface BroadcasterMapping {
  /** Identificador canônico do canal (ex: 'iptv_premiere_2', 'iptv_espn_br') */
  canonicalId: string
  /** Nome amigável de exibição da emissora */
  displayName: string
  /** Termos de busca e variações do canal na lista IPTV */
  aliases: string[]
  /** Termos proibidos para evitar falsos positivos (ex: Premiere 3 não pode bater em Premiere 2) */
  excludeTokens?: string[]
}

/**
 * Tabela De-Para oficial: Mapeia o nome da emissora/streaming transmitindo a partida
 * para as regras de correspondência exata do canal na lista de IPTV.
 */
export const BROADCASTER_MAPPING_TABLE: Record<string, BroadcasterMapping> = {
  // PREMIERE
  'Premiere': {
    canonicalId: 'iptv_premiere_clubes',
    displayName: 'Premiere Clubes',
    aliases: ['premiere clubes', 'premiere club', 'premiere hd', 'premiere fhd', 'premiere 4k', 'premiere'],
    excludeTokens: [
      'premiere 2', 'premiere 3', 'premiere 4', 'premiere 5', 'premiere 6', 'premiere 7', 'premiere 8', 'premiere 9',
      'premiere2', 'premiere3', 'premiere4', 'premiere5', 'premiere6', 'premiere7', 'premiere8', 'premiere9',
      'pfc 2', 'pfc 3', 'pfc 4', 'pfc 5', 'pfc 6',
    ],
  },
  'Premiere 2': {
    canonicalId: 'iptv_premiere_2',
    displayName: 'Premiere 2',
    aliases: ['premiere 2', 'premiere2', 'pfc 2', 'premiere club 2'],
    excludeTokens: ['premiere 20', 'premiere 21'],
  },
  'Premiere 3': {
    canonicalId: 'iptv_premiere_3',
    displayName: 'Premiere 3',
    aliases: ['premiere 3', 'premiere3', 'pfc 3'],
  },
  'Premiere 4': {
    canonicalId: 'iptv_premiere_4',
    displayName: 'Premiere 4',
    aliases: ['premiere 4', 'premiere4', 'pfc 4'],
  },
  'Premiere 5': {
    canonicalId: 'iptv_premiere_5',
    displayName: 'Premiere 5',
    aliases: ['premiere 5', 'premiere5', 'pfc 5'],
  },
  'Premiere 6': {
    canonicalId: 'iptv_premiere_6',
    displayName: 'Premiere 6',
    aliases: ['premiere 6', 'premiere6', 'pfc 6'],
  },
  'Premiere 7': {
    canonicalId: 'iptv_premiere_7',
    displayName: 'Premiere 7',
    aliases: ['premiere 7', 'premiere7', 'pfc 7'],
  },

  // ESPN
  'ESPN': {
    canonicalId: 'iptv_espn_br',
    displayName: 'ESPN',
    aliases: ['espn brasil', 'espn 1', 'espn hd', 'espn fhd', 'espn 4k', 'espn'],
    excludeTokens: ['espn 2', 'espn 3', 'espn 4', 'espn 5', 'espn 6', 'espn extra', 'espn deportes', 'espn+'],
  },
  'ESPN 2': {
    canonicalId: 'iptv_espn_2',
    displayName: 'ESPN 2',
    aliases: ['espn 2', 'espn2'],
  },
  'ESPN 3': {
    canonicalId: 'iptv_espn_3',
    displayName: 'ESPN 3',
    aliases: ['espn 3', 'espn3'],
  },
  'ESPN 4': {
    canonicalId: 'iptv_espn_4',
    displayName: 'ESPN 4',
    aliases: ['espn 4', 'espn4'],
  },
  'ESPN 5': {
    canonicalId: 'iptv_espn_5',
    displayName: 'ESPN 5',
    aliases: ['espn 5', 'espn5'],
  },
  'ESPN 6': {
    canonicalId: 'iptv_espn_6',
    displayName: 'ESPN 6',
    aliases: ['espn 6', 'espn6'],
  },
  'ESPN Extra': {
    canonicalId: 'iptv_espn_extra',
    displayName: 'ESPN Extra',
    aliases: ['espn extra'],
  },

  // SPORTV
  'SporTV': {
    canonicalId: 'iptv_sportv_1',
    displayName: 'SporTV',
    aliases: ['sportv 1', 'spor tv 1', 'sportv hd', 'sportv fhd', 'sportv 4k', 'sportv', 'spor tv'],
    excludeTokens: ['sportv 2', 'spor tv 2', 'sportv2', 'sportv 3', 'spor tv 3', 'sportv3', 'sportv 4', 'spor tv 4', 'sportv4'],
  },
  'SporTV 2': {
    canonicalId: 'iptv_sportv_2',
    displayName: 'SporTV 2',
    aliases: ['sportv 2', 'spor tv 2', 'sportv2'],
  },
  'SporTV 3': {
    canonicalId: 'iptv_sportv_3',
    displayName: 'SporTV 3',
    aliases: ['sportv 3', 'spor tv 3', 'sportv3'],
  },

  // TV ABERTA
  'Globo': {
    canonicalId: 'iptv_globo',
    displayName: 'TV Globo',
    aliases: ['tv globo', 'globo sp', 'globo rj', 'rede globo', 'globo minas', 'globo'],
    excludeTokens: ['globonews', 'globo news', 'globo rural'],
  },
  'Record TV': {
    canonicalId: 'iptv_record',
    displayName: 'Record TV',
    aliases: ['record tv', 'rede record', 'tv record', 'record sp', 'record rj', 'record'],
    excludeTokens: ['record news'],
  },
  'SBT': {
    canonicalId: 'iptv_sbt',
    displayName: 'SBT',
    aliases: ['tv sbt', 'sbt sp', 'sbt rj', 'rede sbt', 'sbt'],
    excludeTokens: ['sbt news'],
  },
  'Band': {
    canonicalId: 'iptv_band',
    displayName: 'Band',
    aliases: ['tv band', 'band sp', 'rede bandeirantes', 'band'],
    excludeTokens: ['bandnews', 'band news', 'bandsports', 'band sports'],
  },
  'BandSports': {
    canonicalId: 'iptv_bandsports',
    displayName: 'BandSports',
    aliases: ['bandsports', 'band sports'],
  },

  // STREAMINGS & CANAIS POR ASSINATURA
  'CazéTV': {
    canonicalId: 'iptv_cazetv',
    displayName: 'CazéTV',
    aliases: ['cazetv', 'caze tv', 'cazé tv', 'caze tv hd', 'cazetv hd', 'caze tv fhd', 'canal caze', 'caze', 'cazé'],
  },
  'Canal GOAT': {
    canonicalId: 'iptv_goat',
    displayName: 'Canal GOAT',
    aliases: ['canal goat', 'goat'],
  },
  'TNT': {
    canonicalId: 'iptv_tnt',
    displayName: 'TNT Sports',
    aliases: ['tnt sports', 'tnt hd', 'tnt fhd', 'tnt'],
    excludeTokens: ['tnt novelas'],
  },
  'Space': {
    canonicalId: 'iptv_space',
    displayName: 'Space',
    aliases: ['space hd', 'space fhd', 'space'],
  },
  'Disney+': {
    canonicalId: 'iptv_disney_plus',
    displayName: 'Disney+',
    aliases: ['disney+', 'disney plus', 'disney', 'star+', 'star plus'],
  },
  'Max': {
    canonicalId: 'iptv_max',
    displayName: 'Max',
    aliases: ['hbo max', 'max hd', 'max fhd', 'max 4k', 'max'],
  },
  'Prime Video': {
    canonicalId: 'iptv_prime_video',
    displayName: 'Prime Video',
    aliases: ['prime video', 'amazon prime', 'prime'],
  },
  'Paramount+': {
    canonicalId: 'iptv_paramount_plus',
    displayName: 'Paramount+',
    aliases: ['paramount+', 'paramount'],
  },
}

/**
 * Normaliza qualquer chave ou texto de emissora para encontrar a regra correspondente
 */
export function getCanonicalBroadcasterKey(broadcasterName: string): string {
  if (!broadcasterName) return ''
  const trimmed = broadcasterName.trim()

  if (BROADCASTER_MAPPING_TABLE[trimmed]) return trimmed

  const low = trimmed.toLowerCase()

  if (low.includes('disney') || low.includes('star+')) return 'Disney+'
  if (low.includes('caze') || low.includes('cazé')) return 'CazéTV'
  if (low.includes('goat')) return 'Canal GOAT'
  if (low.includes('paramount')) return 'Paramount+'
  if (low.includes('prime')) return 'Prime Video'
  if (low.includes('max') || low.includes('hbo')) return 'Max'
  if (low.includes('tnt')) return 'TNT'
  if (low.includes('space')) return 'Space'

  if (low.includes('premiere')) {
    const numMatch = low.match(/\b([2-9])\b/)
    return numMatch ? `Premiere ${numMatch[1]}` : 'Premiere'
  }
  if (low.includes('sportv') || low.includes('spor tv')) {
    const numMatch = low.match(/\b([2-4])\b/)
    return numMatch ? `SporTV ${numMatch[1]}` : 'SporTV'
  }
  if (low.includes('espn')) {
    if (low.includes('extra')) return 'ESPN Extra'
    const numMatch = low.match(/\b([2-6])\b/)
    return numMatch ? `ESPN ${numMatch[1]}` : 'ESPN'
  }
  if (low.includes('globo')) return 'Globo'
  if (low.includes('record')) return 'Record TV'
  if (low.includes('sbt')) return 'SBT'
  if (low.includes('bandsports')) return 'BandSports'
  if (low.includes('band')) return 'Band'

  return trimmed
}

/**
 * Encontra com precisão cirúrgica o canal exato da lista IPTV para a emissora informada,
 * utilizando a tabela De-Para (Aliases e ExcludeTokens).
 */
export function findExactChannelForBroadcaster(
  liveList: MediaItem[],
  broadcasterName: string
): MediaItem | null {
  if (!liveList || liveList.length === 0 || !broadcasterName) return null

  const canonicalKey = getCanonicalBroadcasterKey(broadcasterName)
  const rule = BROADCASTER_MAPPING_TABLE[canonicalKey] || BROADCASTER_MAPPING_TABLE[broadcasterName]

  if (rule) {
    let bestItem: MediaItem | null = null
    let highestScore = -Infinity

    for (const item of liveList) {
      const name = item.name.toLowerCase()

      // 1. Descarta se contiver qualquer token expressamente proibido
      if (rule.excludeTokens && rule.excludeTokens.some((tok) => name.includes(tok))) {
        continue
      }

      // 2. Verifica se o canal contém algum dos termos de busca válidos
      const matchedAlias = rule.aliases.find((alias) => name.includes(alias))
      if (!matchedAlias) continue

      let score = 100

      // Bônus se houver correspondência de palavra inteira (Word boundary)
      const wordPattern = matchedAlias.replace('+', '\\+')
      const wordRegex = new RegExp(`(^|\\W)${wordPattern}(\\W|$)`, 'i')
      if (wordRegex.test(name)) {
        score += 60
      }

      // Bônus de qualidade de vídeo
      if (name.includes('4k') || name.includes('uhd')) score += 35
      else if (name.includes('fhd') || name.includes('1080')) score += 30
      else if (name.includes('hd') || name.includes('720')) score += 20

      // Bônus para praças principais ou rede
      if (name.includes('sp') || name.includes('rj') || name.includes('nacional') || name.includes('rede')) {
        score += 10
      }

      // Penalidade proporcional para nomes excessivamente longos
      score -= Math.min(25, name.length * 0.4)

      if (score > highestScore) {
        highestScore = score
        bestItem = item
      }
    }

    if (bestItem) return bestItem
  }

  // Fallback para findBestLiveChannel tradicional
  return findBestLiveChannel(liveList, broadcasterName)
}
