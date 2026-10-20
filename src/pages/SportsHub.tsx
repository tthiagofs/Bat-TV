import { useEffect, useState, useMemo, memo } from 'react'
import { Trophy, Loader2, Radio } from 'lucide-react'
import SectionHeader from '../components/SectionHeader'
import {
  getTodayMainLeaguesGames,
  getCachedSportsHubMatches,
  dedupeMatchList,
  type Match,
} from '../services/sportsService'
import SportsHeroBanner from '../components/SportsHeroBanner'
import SportsMatchCard from '../components/SportsMatchCard'
import TeamSection from '../components/TeamSection'
import TeamSelectorModal from '../components/TeamSelectorModal'
import CarouselContainer from '../components/CarouselContainer'
import { useProfiles } from '../context/ProfileContext'
import type { Section } from '../types'

interface SportsHubProps {
  onNavigate?: (s: Section) => void
}

function SportsHubBase({ onNavigate }: SportsHubProps) {
  const { active, update } = useProfiles()
  const [allMatches, setAllMatches] = useState<Match[]>(() => getCachedSportsHubMatches())
  const [loading, setLoading] = useState(() => allMatches.length === 0)
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [leagueFilter, setLeagueFilter] = useState<string | null>(null)

  useEffect(() => {
    let isCurrent = true

    const load = (silent = false) => {
      // Se não temos jogos em cache, mostra o loading. Se já temos, atualiza de forma silenciosa e rápida
      if (!silent && allMatches.length === 0) setLoading(true)

      getTodayMainLeaguesGames()
        .then((todayGames) => {
          if (!isCurrent) return

          const now = Date.now()
          const isLiveMatch = (m: Match) =>
            m.status === 'LIVE' ||
            m.status === '1H' ||
            m.status === '2H' ||
            m.status === 'HT' ||
            (now >= m.time && now <= m.time + 150 * 60_000 && m.status !== 'FT')

          // Deduplica fontes por fixture_id e confronto
          const merged = dedupeMatchList(todayGames)
            // Filtra para manter partidas ao vivo ou futuras (exclui finalizadas passadas)
            .filter((m) => {
              if (m.status === 'FT' || m.status === 'AOT') return false
              return m.time > now - 2.5 * 3600_000 || isLiveMatch(m)
            })
            // Ao vivo SEMPRE em primeiro lugar (index 0 no Hero Banner), depois por data crescente
            .sort((a, b) => {
              const liveA = isLiveMatch(a) ? 1 : 0
              const liveB = isLiveMatch(b) ? 1 : 0
              if (liveA !== liveB) return liveB - liveA
              return a.time - b.time
            })

          setAllMatches(merged)
        })
        .catch(() => {})
        .finally(() => {
          if (isCurrent) setLoading(false)
        })
    }

    load(false)

    // Auto-refresh a cada 60s para atualizar placares e minutos ao vivo sem travar a interface
    const refreshTimer = setInterval(() => {
      load(true)
    }, 60_000)

    return () => {
      isCurrent = false
      clearInterval(refreshTimer)
    }
  }, [])

  // Jogos Rolando Agora (Ao Vivo)
  const liveMatches = useMemo(() => {
    return allMatches.filter(
      (m) => m.status === '1H' || m.status === '2H' || m.status === 'LIVE' || m.status === 'HT'
    )
  }, [allMatches])

  // Filtro de jogos dentro da janela dos próximos 10 dias no Horário de Brasília
  const now = Date.now()
  const tenDaysMs = 10 * 24 * 3600_000

  // 1. Brasileirão Série A & B
  const brasileiraoMatches = useMemo(() => {
    return allMatches.filter(
      (m) =>
        m.league.toLowerCase().includes('brasileir') &&
        (m.time <= now + tenDaysMs || m.status === 'LIVE' || m.status === '1H' || m.status === '2H')
    )
  }, [allMatches, now, tenDaysMs])

  // 2. Copa do Brasil
  const copaDoBrasilMatches = useMemo(() => {
    return allMatches.filter(
      (m) =>
        m.league.toLowerCase().includes('copa do brasil') &&
        (m.time <= now + tenDaysMs || m.status === 'LIVE' || m.status === '1H' || m.status === '2H')
    )
  }, [allMatches, now, tenDaysMs])

  // 3. Copa Libertadores & Copa Sul-Americana (CONMEBOL)
  const libertadoresSulAmericanaMatches = useMemo(() => {
    return allMatches.filter(
      (m) =>
        (m.league.toLowerCase().includes('libertadores') ||
          m.league.toLowerCase().includes('sudamericana') ||
          m.league.toLowerCase().includes('sul-americana')) &&
        (m.time <= now + tenDaysMs || m.status === 'LIVE' || m.status === '1H' || m.status === '2H')
    )
  }, [allMatches, now, tenDaysMs])

  // 4. UEFA Champions League & UEFA Europa League
  const championsEuropaMatches = useMemo(() => {
    return allMatches.filter(
      (m) =>
        (m.league.toLowerCase().includes('champions') ||
          m.league.toLowerCase().includes('europa league')) &&
        (m.time <= now + tenDaysMs || m.status === 'LIVE' || m.status === '1H' || m.status === '2H')
    )
  }, [allMatches, now, tenDaysMs])

  // 5. Outras Ligas Internacionais (Premier League, La Liga, etc.)
  const otherLeaguesMatches = useMemo(() => {
    return allMatches.filter(
      (m) =>
        !m.league.toLowerCase().includes('brasileir') &&
        !m.league.toLowerCase().includes('copa do brasil') &&
        !m.league.toLowerCase().includes('champions') &&
        !m.league.toLowerCase().includes('europa league') &&
        !m.league.toLowerCase().includes('libertadores') &&
        !m.league.toLowerCase().includes('sudamericana') &&
        !m.league.toLowerCase().includes('sul-americana') &&
        (m.time <= now + tenDaysMs || m.status === 'LIVE' || m.status === '1H' || m.status === '2H')
    )
  }, [allMatches, now, tenDaysMs])

  const filteredMatches = useMemo(() => {
    if (!leagueFilter) return null
    if (leagueFilter === 'brasileirao') return { title: 'Brasileirão – Jogos dos Próximos 10 Dias', list: brasileiraoMatches }
    if (leagueFilter === 'copa') return { title: 'Copa do Brasil – Jogos dos Próximos 10 Dias', list: copaDoBrasilMatches }
    if (leagueFilter === 'libertadores') return { title: 'Libertadores & Sul-Americana – Próximos 10 Dias', list: libertadoresSulAmericanaMatches }
    if (leagueFilter === 'champions') return { title: 'Champions League & Europa League – Próximos 10 Dias', list: championsEuropaMatches }
    if (leagueFilter === 'outras') return { title: 'Ligas Internacionais – Próximos 10 Dias', list: otherLeaguesMatches }
    return null
  }, [leagueFilter, brasileiraoMatches, copaDoBrasilMatches, libertadoresSulAmericanaMatches, championsEuropaMatches, otherLeaguesMatches])

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar bg-zinc-950 pb-24">
      {/* 1. Hero Banner no Topo (Partidas em Destaque com Estádio de Futebol) */}
      <SportsHeroBanner matches={allMatches} />

      <div className="px-6 sm:px-10 lg:px-14 space-y-12 pt-8 sm:pt-10">
        {/* 2. Central do Time de Coração do Perfil */}
        <TeamSection
          teamKey={active?.teamKey}
          onPickTeam={() => setShowTeamModal(true)}
        />

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <Loader2 className="animate-spin text-rose-500 mb-3" size={32} />
            <p className="text-sm">Carregando confrontos oficiais e transmissões...</p>
          </div>
        ) : filteredMatches ? (
          /* Visão Detalhada "Veja mais" de uma Competição */
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <Trophy size={22} className="text-rose-500" />
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {filteredMatches.title}
                </h2>
              </div>
              <button
                onClick={() => setLeagueFilter(null)}
                className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold text-zinc-200 border border-white/10 transition cursor-pointer"
              >
                ← Voltar para todos os jogos
              </button>
            </div>

            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredMatches.list.map((match) => (
                <SportsMatchCard key={match.id} match={match} />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* 2.5 Fileira: Partidas Ao Vivo Agora (Transmissão em Andamento) */}
            {liveMatches.length > 0 && (
              <section className="space-y-4">
                <SectionHeader
                  title="Partidas Ao Vivo Agora"
                  icon={<Radio size={20} className="text-rose-500 animate-pulse" />}
                />
                <CarouselContainer className="gap-4 pb-2">
                  {liveMatches.map((match) => (
                    <SportsMatchCard key={match.id} match={match} />
                  ))}
                </CarouselContainer>
              </section>
            )}

            {/* 3. Fileira: Brasileirão – Ao vivo e em breve */}
            {brasileiraoMatches.length > 0 && (
              <section className="space-y-4">
                <SectionHeader
                  title="Brasileirão – Ao vivo e próximos 10 dias"
                  icon={<Trophy size={18} className="text-emerald-500" />}
                  onAction={() => setLeagueFilter('brasileirao')}
                />

                <CarouselContainer className="gap-4 pb-2">
                  {brasileiraoMatches.map((match) => (
                    <SportsMatchCard key={match.id} match={match} />
                  ))}
                </CarouselContainer>
              </section>
            )}

            {/* 4. Fileira: Copa do Brasil – Próximos jogos decisivos */}
            {copaDoBrasilMatches.length > 0 && (
              <section className="space-y-4">
                <SectionHeader
                  title="Copa do Brasil – Próximos 10 dias"
                  icon={<Trophy size={18} className="text-amber-500" />}
                  onAction={() => setLeagueFilter('copa')}
                />

                <CarouselContainer className="gap-4 pb-2">
                  {copaDoBrasilMatches.map((match) => (
                    <SportsMatchCard key={match.id} match={match} />
                  ))}
                </CarouselContainer>
              </section>
            )}

            {/* 5. Fileira: Conmebol Libertadores & Copa Sul-Americana */}
            {libertadoresSulAmericanaMatches.length > 0 && (
              <section className="space-y-4">
                <SectionHeader
                  title="Copa Libertadores & Sul-Americana – Próximos 10 dias"
                  icon={<Trophy size={18} className="text-amber-400" />}
                  onAction={() => setLeagueFilter('libertadores')}
                />

                <CarouselContainer className="gap-4 pb-2">
                  {libertadoresSulAmericanaMatches.map((match) => (
                    <SportsMatchCard key={match.id} match={match} />
                  ))}
                </CarouselContainer>
              </section>
            )}

            {/* 6. Fileira: UEFA Champions League & UEFA Europa League */}
            {championsEuropaMatches.length > 0 && (
              <section className="space-y-4">
                <SectionHeader
                  title="UEFA Champions League & Europa League – Próximos 10 dias"
                  icon={<Trophy size={18} className="text-blue-500" />}
                  onAction={() => setLeagueFilter('champions')}
                />

                <CarouselContainer className="gap-4 pb-2">
                  {championsEuropaMatches.map((match) => (
                    <SportsMatchCard key={match.id} match={match} />
                  ))}
                </CarouselContainer>
              </section>
            )}

            {/* 7. Fileira: Outras Ligas & Competições Internacionais */}
            {otherLeaguesMatches.length > 0 && (
              <section className="space-y-4">
                <SectionHeader
                  title="Ligas Internacionais (Premier League, La Liga...)"
                  icon={<Trophy size={18} className="text-rose-500" />}
                  onAction={() => setLeagueFilter('outras')}
                />

                <CarouselContainer className="gap-4 pb-2">
                  {otherLeaguesMatches.map((match) => (
                    <SportsMatchCard key={match.id} match={match} />
                  ))}
                </CarouselContainer>
              </section>
            )}
          </>
        )}
      </div>

      {/* Modal de Escolha do Time */}
      {showTeamModal && (
        <TeamSelectorModal
          selected={active?.teamKey}
          onSelect={(key) => {
            if (active) update(active.id, { teamKey: key || undefined })
            setShowTeamModal(false)
          }}
          onClose={() => setShowTeamModal(false)}
        />
      )}
    </div>
  )
}

export default memo(SportsHubBase)
