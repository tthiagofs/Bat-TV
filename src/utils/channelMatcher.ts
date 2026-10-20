import type { MediaItem } from '../types'

/**
 * Encontra com inteligência o melhor canal ao vivo da lista do usuário para uma emissora/canal desejado.
 * Evita bugs clássicos como abrir "SBT News" em vez do "SBT", ou "GloboNews" em vez da "TV Globo".
 */
export function findBestLiveChannel(liveList: MediaItem[], targetName: string): MediaItem | null {
  if (!liveList || liveList.length === 0 || !targetName) return null

  const target = targetName.trim().toLowerCase()
  let bestItem: MediaItem | null = null
  let highestScore = -Infinity

  for (const item of liveList) {
    const name = item.name.toLowerCase()

    // O canal deve conter o termo base (ex: 'sbt', 'sportv', 'globo', 'espn', 'premiere', 'cazetv', 'paramount')
    if (!name.includes(target)) continue

    let score = 100

    // 1. Penalidades Severas para canais de notícias e secundários quando a busca é pelo canal principal
    const isTargetNews = target.includes('news')
    const itemHasNews = name.includes('news')
    if (!isTargetNews && itemHasNews) {
      score -= 200 // Ex: 'SBT News' perde 200 pontos se o alvo for apenas 'SBT'
    }

    // 2. Diferenciação de canais numerados (ex: 'SporTV' vs 'SporTV 2'/'SporTV 3', 'ESPN' vs 'ESPN 2'/'ESPN 4')
    if (target === 'sportv') {
      if (name.includes('sportv 2') || name.includes('sportv2') || name.includes('sportv 3') || name.includes('sportv3') || name.includes('sportv 4')) {
        score -= 80 // Prefere o SporTV 1 / SporTV principal
      }
    } else if (target === 'espn') {
      if (name.includes('espn 2') || name.includes('espn2') || name.includes('espn 3') || name.includes('espn 4') || name.includes('extra')) {
        score -= 80 // Prefere o ESPN principal
      }
    } else if (target === 'globo') {
      if (name.includes('globonews') || name.includes('globo news') || name.includes('rural')) {
        score -= 200 // Prefere TV Globo aberta, nunca GloboNews para jogos de futebol
      }
    } else if (target === 'band') {
      if (name.includes('bandnews') || name.includes('band sports') || name.includes('bandsports')) {
        score -= 150
      }
    }

    // 3. Correspondência exata da palavra (Word boundary)
    // Ex: "SBT HD" ou "TV GLOBO HD"
    const wordRegex = new RegExp(`\\b${target}\\b`, 'i')
    if (wordRegex.test(name)) {
      score += 60
    }

    // 4. Bônus por Qualidade de Imagem HD / Full HD / 4K
    if (name.includes('fhd') || name.includes('1080')) score += 30
    else if (name.includes('4k') || name.includes('uhd')) score += 25
    else if (name.includes('hd') || name.includes('720')) score += 20

    // 5. Bônus para praças principais ou feed nacional
    if (name.includes('sp') || name.includes('são paulo') || name.includes('rj') || name.includes('nacional') || name.includes('rede')) {
      score += 15
    }

    // 6. Preferência por nomes mais limpos e curtos (menos ruído de afiliados distantes)
    score -= Math.min(30, name.length * 0.5)

    if (score > highestScore) {
      highestScore = score
      bestItem = item
    }
  }

  return bestItem || liveList.find((ch) => ch.name.toLowerCase().includes(target)) || liveList[0] || null
}
