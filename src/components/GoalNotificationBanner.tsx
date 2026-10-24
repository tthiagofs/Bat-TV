import { useEffect, useRef, useState, memo } from 'react'
import { getLeagueLiveMatches, type Match } from '../services/sportsService'

interface Props {
  matchContext?: {
    leagueId?: string
    matchId?: string
    leagueName?: string
  }
}

interface GoalAlert {
  id: string
  scoringTeam: string
  badge: string
  home: string
  away: string
  homeScore: number
  awayScore: number
  statusDetail?: string
  leagueName: string
}

function GoalNotificationBannerBase({ matchContext }: Props) {
  const [activeAlert, setActiveAlert] = useState<GoalAlert | null>(null)
  const scoresMapRef = useRef<Map<string, { home: number; away: number }>>(new Map())
  const isInitialRef = useRef<boolean>(true)
  const alertTimerRef = useRef<number | undefined>(undefined)

  const leagueId = matchContext?.leagueId
  const currentMatchId = matchContext?.matchId
  const leagueName = matchContext?.leagueName || 'Campeonato'

  useEffect(() => {
    if (!leagueId) return

    let cancelled = false
    scoresMapRef.current.clear()
    isInitialRef.current = true

    const checkGoals = async () => {
      try {
        const matches = await getLeagueLiveMatches(leagueId)
        if (cancelled) return

        const liveMatches = matches.filter(
          (m) => m.status === 'LIVE' || m.status === '1H' || m.status === '2H' || m.status === 'HT'
        )

        for (const m of liveMatches) {
          if (m.homeScore === null || m.awayScore === null) continue

          const prev = scoresMapRef.current.get(m.id)

          // Só dispara notificação se NÃO for a primeira carga e NÃO for o jogo que o usuário já está assistindo
          if (!isInitialRef.current && prev && m.id !== currentMatchId) {
            let scoringTeam = ''
            let badge = ''

            if (m.homeScore > prev.home) {
              scoringTeam = m.home
              badge = m.homeBadge
            } else if (m.awayScore > prev.away) {
              scoringTeam = m.away
              badge = m.awayBadge
            }

            if (scoringTeam) {
              const newAlert: GoalAlert = {
                id: `${m.id}-${Date.now()}`,
                scoringTeam,
                badge,
                home: m.home,
                away: m.away,
                homeScore: m.homeScore,
                awayScore: m.awayScore,
                statusDetail: m.statusDetail || 'Ao Vivo',
                leagueName,
              }

              setActiveAlert(newAlert)
              window.clearTimeout(alertTimerRef.current)
              // Desaparece automaticamente após 5 segundos
              alertTimerRef.current = window.setTimeout(() => {
                setActiveAlert(null)
              }, 5000)
            }
          }

          scoresMapRef.current.set(m.id, { home: m.homeScore, away: m.awayScore })
        }

        isInitialRef.current = false
      } catch {
        // Silencioso em caso de falha de rede
      }
    }

    // Primeira checagem imediata
    checkGoals()

    // Checagem a cada 45 segundos (ultra otimizado para TV / Fire Stick)
    const interval = setInterval(checkGoals, 45_000)

    return () => {
      cancelled = true
      clearInterval(interval)
      window.clearTimeout(alertTimerRef.current)
    }
  }, [leagueId, currentMatchId, leagueName])

  if (!activeAlert) return null

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-6 right-6 z-[80] pointer-events-none select-none transition-all duration-500 ease-out animate-bounce-short"
    >
      <div className="bg-zinc-950/95 border-2 border-emerald-500/80 rounded-2xl p-4 shadow-[0_12px_45px_rgba(0,0,0,0.9)] backdrop-blur-xl flex items-center gap-3.5 max-w-sm sm:max-w-md ring-4 ring-emerald-500/20">
        {/* Ícone de Bola de Futebol pulsante */}
        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
          <span className="text-2xl animate-pulse">⚽</span>
        </div>

        {/* Conteúdo do Gol */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
              GOL NO {activeAlert.leagueName.toUpperCase()}!
            </span>
            {activeAlert.statusDetail && (
              <span className="text-[10px] font-bold text-zinc-400 ml-auto">
                {activeAlert.statusDetail}
              </span>
            )}
          </div>

          <p className="text-xs font-black text-white truncate mb-1">
            GOL DO <span className="text-emerald-400">{activeAlert.scoringTeam.toUpperCase()}</span>!
          </p>

          <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-zinc-200">
            <span className="truncate">{activeAlert.home}</span>
            <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-emerald-400 font-mono text-sm font-black">
              {activeAlert.homeScore} x {activeAlert.awayScore}
            </span>
            <span className="truncate">{activeAlert.away}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default memo(GoalNotificationBannerBase)
