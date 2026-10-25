import type { MediaItem } from '../types'
import { canonicalTeamName } from '../services/sportsService'

/**
 * Verifica se um canal IPTV é estritamente um canal de esporte.
 * Elimina falsos positivos de notícias (GloboNews, Record News, BandNews)
 * e canais abertos regionais generalistas.
 */
export function isSportsChannel(ch: MediaItem): boolean {
  if (!ch || !ch.name) return false
  const name = ch.name.toLowerCase()
  const group = ((ch as any).group || (ch as any).category_id || '').toLowerCase()

  // 1. Exclusões estritas (Notícias, Novelas, Filmes, Infantis, Religiosos)
  if (
    name.includes('news') ||
    name.includes('noticia') ||
    name.includes('globonews') ||
    name.includes('globo news') ||
    name.includes('record news') ||
    name.includes('bandnews') ||
    name.includes('band news') ||
    name.includes('jovem pan') ||
    name.includes('cnn') ||
    name.includes('novela') ||
    name.includes('filme') ||
    name.includes('serie') ||
    name.includes('infantil') ||
    name.includes('kids') ||
    name.includes('desenho') ||
    name.includes('musica') ||
    name.includes('gospel') ||
    name.includes('relig') ||
    name.includes('culto') ||
    name.includes('polishop') ||
    name.includes('shopping')
  ) {
    return false
  }

  // 2. Se o grupo/categoria é expressamente de esportes
  const isSportsGroup =
    group.includes('esport') ||
    group.includes('sport') ||
    group.includes('futebol') ||
    group.includes('premiere') ||
    group.includes('espn') ||
    group.includes('combate') ||
    group.includes('dazn') ||
    group.includes('ppv') ||
    group.includes('jogos')

  // 3. Marcas e termos esportivos consagrados no nome do canal
  const hasSportsBrand =
    name.includes('sportv') ||
    name.includes('spor tv') ||
    name.includes('sport tv') ||
    name.includes('premiere') ||
    name.includes('espn') ||
    name.includes('caze') ||
    name.includes('cazé') ||
    name.includes('goat') ||
    name.includes('bandsports') ||
    name.includes('band sports') ||
    name.includes('combate') ||
    name.includes('dazn') ||
    name.includes('tnt sports') ||
    name.includes('nba') ||
    name.includes('nfl') ||
    name.includes('ufc') ||
    name.includes('fifa') ||
    name.includes('conmebol') ||
    name.includes('futebol') ||
    name.includes('campeonato') ||
    name.includes('disney+') ||
    name.includes('disney plus') ||
    name.includes('copa') ||
    name.includes('libertadores')

  if (hasSportsBrand) return true
  if (isSportsGroup) return true

  return false
}

/**
 * Cria a playlist de esportes otimizada para o player da TV e do app,
 * garantindo que apenas canais reais de esporte apareçam na gaveta "Canais",
 * ordenados por importância (SporTV, Premiere, ESPN, etc.) e colocando
 * o canal que está sendo reproduzido no topo.
 */
export function buildSportsPlaylist(liveList: MediaItem[], activeChannel?: MediaItem): MediaItem[] {
  if (!liveList || liveList.length === 0) return []

  const sports = liveList.filter(isSportsChannel)

  // Priorização para a gaveta rápida de canais de esporte
  const getSortScore = (ch: MediaItem): number => {
    if (activeChannel && ch.id === activeChannel.id) return 10000

    const name = ch.name.toLowerCase()
    if (name.includes('sportv') || name.includes('spor tv')) return 900
    if (name.includes('premiere')) return 800
    if (name.includes('espn')) return 700
    if (name.includes('caze') || name.includes('cazé')) return 650
    if (name.includes('goat')) return 600
    if (name.includes('bandsports')) return 550
    if (name.includes('tnt sports')) return 500
    if (name.includes('space')) return 450
    if (name.includes('combate')) return 400
    if (name.includes('dazn')) return 350
    if (name.includes('disney')) return 300
    return 100
  }

  sports.sort((a, b) => getSortScore(b) - getSortScore(a))

  // Se o canal ativo for um canal aberto onde o jogo está passando (ex: TV Globo SP ou Record),
  // e ele não caiu no filtro de esportes puros, insere ele obrigatoriamente no topo da lista
  if (activeChannel && !sports.some((s) => s.id === activeChannel.id)) {
    sports.unshift(activeChannel)
  }

  return sports.length > 0 ? sports : liveList.slice(0, 80)
}

/**
 * Procura se existe algum canal específico de evento ao vivo na lista IPTV
 * que contenha o nome dos dois times no título (ex: "PREMIERE 2 - CRUZEIRO X REMO").
 */
export function findChannelByMatchTeams(
  liveList: MediaItem[],
  home: string,
  away: string
): MediaItem | null {
  if (!liveList || liveList.length === 0 || !home || !away) return null

  const cHome = canonicalTeamName(home)
  const cAway = canonicalTeamName(away)
  if (!cHome || !cAway || cHome.length < 3 || cAway.length < 3) return null

  // 1. Procura canal que contenha AMBOS os times no nome
  for (const item of liveList) {
    const name = item.name.toLowerCase()
    if (name.includes(cHome) && name.includes(cAway)) {
      return item
    }
  }

  return null
}
