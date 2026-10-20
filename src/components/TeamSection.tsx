import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Loader2, Play, Radio, Trophy } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { usePlayback } from '../context/PlaybackContext'
import LazyImage from './LazyImage'
import { clubByKey } from '../data/teams'
import { SPORTS_FALLBACK, getTeamData, matchChannels, type Match, type TeamData } from '../services/sportsService'
import { getItems } from '../services/catalog'
import type { MediaItem } from '../types'

const dateFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

function when(t: number): string {
  const diff = t - Date.now()
  if (diff < 0 && diff > -3 * 3600_000) return 'AO VIVO / EM ANDAMENTO'
  const days = Math.floor(diff / 86400_000)
  if (days <= 0) {
    const h = Math.max(0, Math.floor(diff / 3600_000))
    return h > 0 ? `Hoje, em ${h}h` : 'Começa em breve'
  }
  return days === 1 ? 'Amanhã' : `Em ${days} dias`
}

function Crest({ src, name, size = 40, fallbackSrc }: { src?: string; name: string; size?: number; fallbackSrc?: string }) {
  const imgSrc = src || fallbackSrc || ''
  return (
    <div style={{ width: size, height: size }} className="shrink-0 flex items-center justify-center">
      {imgSrc ? (
        <img
          src={imgSrc}
          alt={name}
          className="w-full h-full object-contain filter drop-shadow"
          loading="lazy"
          onError={(e) => {
            if (fallbackSrc && e.currentTarget.src !== fallbackSrc) {
              e.currentTarget.src = fallbackSrc
            }
          }}
        />
      ) : (
        <div className="w-full h-full rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-white">
          {name.slice(0, 3)}
        </div>
      )}
    </div>
  )
}

function result(m: Match, teamName: string): 'V' | 'E' | 'D' {
  const home = m.home === teamName
  const mine = (home ? m.homeScore : m.awayScore) ?? 0
  const other = (home ? m.awayScore : m.homeScore) ?? 0
  return mine > other ? 'V' : mine < other ? 'D' : 'E'
}

const RES_STYLE = { V: 'bg-emerald-600', E: 'bg-zinc-600', D: 'bg-rose-700' } as const

export default function TeamSection({ teamKey, onPickTeam }: { teamKey?: string; onPickTeam: () => void }) {
  const { service } = useAuth()
  const { play } = usePlayback()
  const club = clubByKey(teamKey)
  const [data, setData] = useState<TeamData | null>(null)
  const [live, setLive] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setData(null); setFailed(false)
    if (!club) return
    let cancelled = false
    setLoading(true)
    getTeamData(club)
      .then((d) => { if (!cancelled) { setData(d); setFailed(!d) } })
      .catch(() => { if (!cancelled) setFailed(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [club])

  // Canais ao vivo da lista (para ligar o jogo ao canal que transmite)
  useEffect(() => {
    if (!service || !data) return
    getItems(service, 'live', 'all').then(setLive).catch(() => {})
  }, [service, data])

  const next = data?.next[0]
  const channelNames = data?.channels ?? []
  const fromApi = channelNames.length > 0
  const channels = useMemo(
    () => matchChannels(live, fromApi ? channelNames : SPORTS_FALLBACK, 4),
    [live, channelNames, fromApi],
  )

  if (!club) {
    return (
      <section className="rounded-2xl border border-dashed border-zinc-700 p-6 flex items-center gap-4">
        <Trophy className="text-amber-400" />
        <div className="flex-1">
          <p className="font-semibold">Escolha seu time de coração</p>
          <p className="text-sm text-zinc-400">Veja o próximo jogo, o canal da transmissão, o calendário e os resultados recentes aqui na Home.</p>
        </div>
        <button onClick={onPickTeam} className="px-4 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition">Escolher time</button>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 fade-up">
      <div className="flex items-center gap-3 mb-4">
        <Crest src={data?.team.badge} fallbackSrc={club.badge} name={club.name} size={44} />
        <h2 className="text-lg font-bold">{club.name}</h2>
        <button onClick={onPickTeam} className="ml-auto text-xs text-zinc-500 hover:text-zinc-200 transition">Trocar time</button>
      </div>

      {loading && <Loader2 className="animate-spin text-zinc-500" />}
      {failed && !loading && <p className="text-sm text-zinc-400">Não foi possível carregar os jogos agora (verifique a internet).</p>}

      {data && (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          {/* Próximo jogo */}
          <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
            <p className="text-xs font-bold text-rose-400 mb-3">PRÓXIMO JOGO</p>
            {next ? (
              <>
                <p className="text-xs text-zinc-400 mb-3">{next.league} · {dateFmt.format(next.time)}</p>
                <div className="flex items-center justify-around gap-2">
                  <div className="flex flex-col items-center gap-2 w-28 text-center">
                    <Crest src={next.homeBadge} fallbackSrc={next.home === club.name ? club.badge : undefined} name={next.home} size={56} />
                    <span className="text-sm font-medium">{next.home}</span>
                  </div>
                  <span className="text-xl font-bold text-zinc-500">×</span>
                  <div className="flex flex-col items-center gap-2 w-28 text-center">
                    <Crest src={next.awayBadge} fallbackSrc={next.away === club.name ? club.badge : undefined} name={next.away} size={56} />
                    <span className="text-sm font-medium">{next.away}</span>
                  </div>
                </div>
                <p className="mt-3 text-center text-sm font-semibold text-amber-400">{when(next.time)}</p>
                <div className="mt-4">
                  <p className="text-xs text-zinc-500 mb-2">
                    {fromApi ? `Transmissão: ${channelNames.slice(0, 3).join(', ')}` : 'Canais esportivos da sua lista'}
                  </p>
                  {channels.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {channels.map((c) => (
                        <button key={c.key} onClick={() => play(c, { playlist: channels })} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-600 hover:bg-rose-500 text-sm font-medium transition">
                          <Radio size={14} /> {c.name} <Play size={12} className="fill-white" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">Nenhum canal correspondente encontrado na sua lista.</p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-zinc-400">Sem jogos agendados no momento.</p>
            )}
          </div>

          <div className="space-y-5">
            {/* Calendário */}
            <div>
              <p className="flex items-center gap-2 text-xs font-bold text-zinc-400 mb-2"><CalendarDays size={14} /> CALENDÁRIO</p>
              <ul className="space-y-1.5">
                {data.next.slice(1, 5).map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-sm rounded-lg bg-zinc-900 px-3 py-2">
                    <span className="w-28 shrink-0 text-xs text-zinc-400">{dateFmt.format(m.time)}</span>
                    <span className="truncate">{m.home} × {m.away}</span>
                  </li>
                ))}
                {data.next.length <= 1 && <li className="text-sm text-zinc-500">Sem outros jogos agendados.</li>}
              </ul>
            </div>
            {/* Resultados */}
            <div>
              <p className="flex items-center gap-2 text-xs font-bold text-zinc-400 mb-2"><Trophy size={14} /> RESULTADOS RECENTES</p>
              <ul className="space-y-1.5">
                {data.last.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-sm rounded-lg bg-zinc-900 px-3 py-2">
                    <span className={`w-5 h-5 rounded text-[11px] font-bold flex items-center justify-center ${RES_STYLE[result(m, data.team.name)]}`}>{result(m, data.team.name)}</span>
                    <span className="truncate flex-1">{m.home} {m.homeScore} × {m.awayScore} {m.away}</span>
                  </li>
                ))}
                {data.last.length === 0 && <li className="text-sm text-zinc-500">Sem resultados recentes.</li>}
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
