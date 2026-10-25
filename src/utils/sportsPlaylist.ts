import type { MediaItem } from '../types'
import { canonicalTeamName, norm } from '../services/sportsService'

/**
 * Extrai palavras-chave e apelidos de busca inteligentes para um clube/seleção,
 * permitindo identificar canais de eventos ao vivo na lista IPTV (ex: "ATHLETIC X GETAFE", "CRUZEIRO X REMO").
 */
export function getTeamSearchKeywords(teamName: string): string[] {
  if (!teamName) return []
  const normStr = norm(teamName)
  const cleanStr = teamName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  const keywords = new Set<string>()

  // Apelidos e nomes alternativos comuns no futebol nacional e internacional
  if (normStr.includes('athletic') || normStr.includes('bilbao')) {
    keywords.add('athletic')
    keywords.add('bilbao')
  }
  if (normStr.includes('getafe')) {
    keywords.add('getafe')
  }
  if (normStr.includes('atleticomg') || normStr.includes('galo')) {
    keywords.add('atletico mg')
    keywords.add('atleticomg')
    keywords.add('galo')
  }
  if (normStr.includes('athleticopr') || normStr.includes('furacao')) {
    keywords.add('athletico')
    keywords.add('athleticopr')
    keywords.add('furacao')
  }
  if (normStr.includes('cruzeiro')) {
    keywords.add('cruzeiro')
  }
  if (normStr.includes('flamengo') || normStr.includes('mengo')) {
    keywords.add('flamengo')
    keywords.add('mengo')
  }
  if (normStr.includes('corinthians') || normStr.includes('timao')) {
    keywords.add('corinthians')
    keywords.add('timao')
  }
  if (normStr.includes('palmeiras') || normStr.includes('verdao')) {
    keywords.add('palmeiras')
    keywords.add('verdao')
  }
  if (normStr.includes('saopaulo') || normStr.includes('tricolor')) {
    keywords.add('sao paulo')
    keywords.add('saopaulo')
  }
  if (normStr.includes('santos') || normStr.includes('peixe')) {
    keywords.add('santos')
  }
  if (normStr.includes('gremio')) {
    keywords.add('gremio')
  }
  if (normStr.includes('internacional') || normStr.includes('colorado')) {
    keywords.add('internacional')
    keywords.add('inter rs')
  }
  if (normStr.includes('vasco')) {
    keywords.add('vasco')
  }
  if (normStr.includes('botafogo')) {
    keywords.add('botafogo')
    keywords.add('fogao')
  }
  if (normStr.includes('fluminense')) {
    keywords.add('fluminense')
    keywords.add('flu')
  }
  if (normStr.includes('sportrecife') || (normStr.includes('sport') && !normStr.includes('sportv'))) {
    keywords.add('sport')
    keywords.add('sport recife')
  }
  if (normStr.includes('bragantino')) {
    keywords.add('bragantino')
  }
  if (normStr.includes('realmadrid')) {
    keywords.add('real madrid')
  }
  if (normStr.includes('barcelona') || normStr.includes('barca')) {
    keywords.add('barcelona')
    keywords.add('barca')
  }
  if (normStr.includes('mancity') || normStr.includes('manchestercity')) {
    keywords.add('man city')
    keywords.add('mancity')
    keywords.add('manchester city')
  }
  if (normStr.includes('manunited') || normStr.includes('manchesterunited') || normStr.includes('manutd')) {
    keywords.add('man united')
    keywords.add('manutd')
    keywords.add('manchester united')
  }
  if (normStr.includes('liverpool')) {
    keywords.add('liverpool')
  }
  if (normStr.includes('arsenal')) {
    keywords.add('arsenal')
  }
  if (normStr.includes('chelsea')) {
    keywords.add('chelsea')
  }
  if (normStr.includes('bayern')) {
    keywords.add('bayern')
  }
  if (normStr.includes('dortmund') || normStr.includes('bvb')) {
    keywords.add('dortmund')
    keywords.add('bvb')
  }
  if (normStr.includes('psg') || normStr.includes('parissaintgermain')) {
    keywords.add('psg')
    keywords.add('paris')
  }
  if (normStr.includes('intermilan') || normStr.includes('internazionale')) {
    keywords.add('inter')
  }
  if (normStr.includes('juventus') || normStr.includes('juve')) {
    keywords.add('juventus')
    keywords.add('juve')
  }

  // Quebra palavras ignorando stop-words de futebol
  const words = cleanStr
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(
      (w) =>
        w.length >= 3 &&
        ![
          'club',
          'clube',
          'futebol',
          'futbol',
          'football',
          'soccer',
          'balompie',
          'regatas',
          'esporte',
          'sport',
          'saf',
          'associacao',
          'sociedade',
          'uniao',
          'de',
          'da',
          'do',
        ].includes(w)
    )

  for (const w of words) {
    if (w.length >= 4) {
      keywords.add(w)
    }
  }

  const canonical = canonicalTeamName(teamName)
  if (canonical && canonical.length >= 4) {
    keywords.add(canonical)
  }

  return Array.from(keywords)
}

/**
 * Verifica se um canal IPTV é estritamente um canal de esporte.
 * Inclui transmissões esportivas da Disney+ / Star+ e elimina notícias (GloboNews, Record News, BandNews)
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
    name.includes('disney junior') ||
    name.includes('disney channel') ||
    name.includes('disney xd') ||
    name.includes('junior') ||
    name.includes('musica') ||
    name.includes('gospel') ||
    name.includes('relig') ||
    name.includes('culto') ||
    name.includes('polishop') ||
    name.includes('shopping')
  ) {
    return false
  }

  // 2. Canais dedicados de transmissão de esporte Disney+ / Star+
  const isDisneyOrStarSports =
    (name.includes('disney') &&
      (name.includes('+') ||
        name.includes('plus') ||
        name.includes('ppv') ||
        name.includes('evento') ||
        name.includes('live') ||
        name.includes('futebol') ||
        name.includes('sport') ||
        /\b(0?[1-9]|[1-9][0-9])\b/.test(name) ||
        group.includes('disney') ||
        group.includes('esport') ||
        group.includes('sport'))) ||
    name.includes('star+') ||
    name.includes('star +') ||
    name.includes('star plus') ||
    (name.includes('star') &&
      (name.includes('esport') ||
        name.includes('sport') ||
        name.includes('ppv') ||
        name.includes('evento') ||
        /\b(0?[1-9]|[1-9][0-9])\b/.test(name))) ||
    group.includes('disney') ||
    group.includes('star+') ||
    group.includes('star plus')

  if (isDisneyOrStarSports) return true

  // 3. Se o grupo/categoria é expressamente de esportes
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

  // 4. Marcas e termos esportivos consagrados no nome do canal
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
    name.includes('copa') ||
    name.includes('libertadores') ||
    name.includes('sudamericana')

  if (hasSportsBrand) return true
  if (isSportsGroup) return true

  return false
}

type ChannelFamily = 'espn' | 'disney' | 'premiere' | 'sportv' | 'caze' | 'bandsports' | 'tnt' | 'other'

function getChannelFamily(name: string): ChannelFamily {
  const low = (name || '').toLowerCase()
  if (low.includes('premiere')) return 'premiere'
  if (low.includes('espn')) return 'espn'
  if (low.includes('disney') || low.includes('star+') || low.includes('star plus') || low.includes('star +')) return 'disney'
  if (low.includes('sportv') || low.includes('spor tv') || low.includes('sport tv')) return 'sportv'
  if (low.includes('caze') || low.includes('cazé')) return 'caze'
  if (low.includes('bandsports') || low.includes('band sports')) return 'bandsports'
  if (low.includes('tnt') || low.includes('space')) return 'tnt'
  return 'other'
}

/**
 * Cria a playlist de esportes otimizada para o player da TV e do app.
 *
 * REGRA CRÍTICA DE USABILIDADE:
 * - O canal ativo fica sempre no topo (index 0).
 * - Se o canal ativo for da família ESPN, os canais que aparecem logo abaixo são os outros ESPN (1 a 6, Extra) e Disney+!
 * - Se for Premiere, os próximos são todos os outros Premiere (2 a 9, Clubes)!
 * - Se for SporTV, os próximos são os outros SporTV (2, 3)!
 * - Em seguida, os demais canais de esportes são exibidos de forma limpa e organizada.
 */
export function buildSportsPlaylist(liveList: MediaItem[], activeChannel?: MediaItem): MediaItem[] {
  if (!liveList || liveList.length === 0) return []

  const sports = liveList.filter(isSportsChannel)
  const activeFamily = activeChannel ? getChannelFamily(activeChannel.name) : 'other'

  const getSortScore = (ch: MediaItem): number => {
    // 1. Canal ativo sempre é o Primeiríssimo
    if (activeChannel && ch.id === activeChannel.id) return 1_000_000

    const name = ch.name.toLowerCase()
    const family = getChannelFamily(name)

    // 2. Priorização da mesma família do canal atual
    if (activeFamily === 'espn') {
      if (family === 'espn') return 90_000
      if (family === 'disney') return 80_000
    } else if (activeFamily === 'disney') {
      if (family === 'disney') return 90_000
      if (family === 'espn') return 80_000
    } else if (activeFamily === 'premiere') {
      if (family === 'premiere') return 90_000
    } else if (activeFamily === 'sportv') {
      if (family === 'sportv') return 90_000
    } else if (activeFamily === 'caze') {
      if (family === 'caze') return 90_000
    } else if (activeFamily === 'bandsports') {
      if (family === 'bandsports') return 90_000
    } else if (activeFamily === 'tnt') {
      if (family === 'tnt') return 90_000
    }

    // 3. Hierarquia esportiva padrão para os demais
    if (family === 'sportv') return 900
    if (family === 'premiere') return 850
    if (family === 'espn') return 800
    if (family === 'disney') return 750
    if (family === 'caze') return 700
    if (name.includes('goat')) return 650
    if (family === 'bandsports') return 600
    if (family === 'tnt') return 550
    if (name.includes('combate')) return 400
    if (name.includes('dazn')) return 350

    return 100
  }

  sports.sort((a, b) => getSortScore(b) - getSortScore(a))

  // Se o canal ativo for um canal aberto ou não caiu no filtro de esportes puros,
  // força a presença dele como o primeiro item da gaveta
  if (activeChannel && !sports.some((s) => s.id === activeChannel.id)) {
    sports.unshift(activeChannel)
  }

  return sports.length > 0 ? sports : liveList.slice(0, 80)
}

/**
 * Procura com inteligência se existe algum canal de evento ao vivo na lista IPTV
 * que contenha o nome ou apelido dos dois times no título (ex: "PREMIERE 2 - CRUZEIRO X REMO", "DISNEY+ 03: ATHLETIC X GETAFE").
 */
export function findChannelByMatchTeams(
  liveList: MediaItem[],
  home: string,
  away: string
): MediaItem | null {
  if (!liveList || liveList.length === 0 || !home || !away) return null

  const homeKeywords = getTeamSearchKeywords(home)
  const awayKeywords = getTeamSearchKeywords(away)

  if (homeKeywords.length === 0 || awayKeywords.length === 0) return null

  for (const item of liveList) {
    const name = item.name.toLowerCase()

    // Verifica se o canal contém ao menos uma palavra-chave do time da casa
    // E ao menos uma palavra-chave do time visitante
    const hasHome = homeKeywords.some((kw) => name.includes(kw))
    if (!hasHome) continue

    const hasAway = awayKeywords.some((kw) => name.includes(kw))
    if (hasAway) {
      return item
    }
  }

  return null
}
