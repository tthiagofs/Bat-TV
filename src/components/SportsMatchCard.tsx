import { memo, useState } from 'react'
import { Play, Radio, Bell, BellCheck } from 'lucide-react'
import type { Match } from '../services/sportsService'
import { usePlayback } from '../context/PlaybackContext'
import { useAuth } from '../context/AuthContext'
import { getItems } from '../services/catalog'
import { findBestLiveChannel, findAllMatchingLiveChannels, type MatchedChannelOption } from '../utils/channelMatcher'
import SportsChannelPickerModal from './SportsChannelPickerModal'
import type { MediaItem } from '../types'

interface Props {
  match: Match
  onSelect?: (match: Match) => void
}

// Mapeamento de cores predominantes dos principais times para criar os gradientes divididos do card
const TEAM_COLORS: Record<string, string> = {
  cruzeiro: 'from-blue-700 to-blue-900',
  gremio: 'from-sky-600 to-blue-800',
  flamengo: 'from-red-700 to-zinc-900',
  palmeiras: 'from-emerald-700 to-green-900',
  atleticomg: 'from-zinc-800 to-zinc-950',
  saopaulo: 'from-red-600 to-zinc-800',
  corinthians: 'from-zinc-900 to-black',
  botafogo: 'from-zinc-900 to-black',
  fluminense: 'from-red-800 to-emerald-900',
  vasco: 'from-zinc-900 to-black',
  bahia: 'from-blue-600 to-red-700',
  fortaleza: 'from-blue-700 to-red-700',
  internacional: 'from-red-600 to-red-800',
  athleticopr: 'from-red-700 to-black',
  bragantino: 'from-zinc-800 to-red-800',
  vitoria: 'from-red-700 to-black',
  remo: 'from-sky-950 to-blue-900',
  realmadrid: 'from-zinc-100/10 to-indigo-900',
  barcelona: 'from-blue-800 to-rose-900',
  bayern: 'from-red-700 to-red-900',
  manutd: 'from-red-700 to-red-950',
  atleticomadrid: 'from-red-700 to-blue-900',
  liverpool: 'from-red-700 to-red-900',
  mancity: 'from-sky-500 to-blue-700',
}

function getTeamGradient(teamName: string, side: 'left' | 'right'): string {
  const norm = teamName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
  for (const [key, grad] of Object.entries(TEAM_COLORS)) {
    if (norm.includes(key)) {
      return grad
    }
  }
  return side === 'left' ? 'from-zinc-800 to-zinc-900' : 'from-zinc-900 to-zinc-950'
}

function formatMatchTime(ts: number): string {
  const d = new Date(ts)
  const days = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.']
  const dayName = days[d.getDay()]
  const dayNum = String(d.getDate()).padStart(2, '0')
  const months = ['jan.', 'fev.', 'mar.', 'abr.', 'maio', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.']
  const monthName = months[d.getMonth()]
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')

  return `${dayName}, ${dayNum} de ${monthName} ${hours}:${minutes} BRT`
}

function SportsMatchCardBase({ match, onSelect }: Props) {
  const { service } = useAuth()
  const { play } = usePlayback()
  const [pickerData, setPickerData] = useState<{
    match: Match
    options: MatchedChannelOption[]
    liveList: MediaItem[]
  } | null>(null)

  const channel = match.channels?.[0] || 'SporTV'
  const leftGradient = getTeamGradient(match.home, 'left')
  const rightGradient = getTeamGradient(match.away, 'right')

  // Tempo decorrido / contagem regressiva
  const nowTs = Date.now()
  const diffMinutes = Math.round((match.time - nowTs) / 60_000)
  const elapsedMinutes = Math.round((nowTs - match.time) / 60_000)

  const isFinished = match.status === 'FT' || match.status === 'AOT' || elapsedMinutes > 150
  const isLive = !isFinished && (match.status === '1H' || match.status === '2H' || match.status === 'LIVE' || match.status === 'HT' || (elapsedMinutes >= 0 && elapsedMinutes <= 150))

  const countdownLabel = (() => {
    if (isFinished) return 'ENCERRADO'
    if (isLive) {
      if (match.statusDetail) return match.statusDetail
      if (elapsedMinutes >= 0 && elapsedMinutes <= 150) {
        if (elapsedMinutes <= 48) return `${elapsedMinutes}'`
        if (elapsedMinutes <= 63) return 'INT'
        if (elapsedMinutes <= 110) return `${elapsedMinutes - 15}'`
        return 'AO VIVO'
      }
      return 'AO VIVO'
    }
    if (diffMinutes <= 60 && diffMinutes > 0) {
      return `EM ${diffMinutes} MIN`
    }
    if (diffMinutes <= 120 && diffMinutes > 60) {
      return `EM ${Math.floor(diffMinutes / 60)}H ${diffMinutes % 60}M`
    }
    return 'EM BREVE'
  })()

  const reminderKey = `iptv_reminder_${match.id}`
  const [hasReminder, setHasReminder] = useState(() => localStorage.getItem(reminderKey) === '1')

  const toggleReminder = (e: React.MouseEvent) => {
    e.stopPropagation()
    const next = !hasReminder
    setHasReminder(next)
    if (next) {
      localStorage.setItem(reminderKey, '1')
    } else {
      localStorage.removeItem(reminderKey)
    }
  }

  const handlePlayChannel = async () => {
    if (onSelect) {
      onSelect(match)
      return
    }
    if (!service) return

    try {
      const liveList = await getItems(service, 'live', 'all')
      const targets = match.channels && match.channels.length > 0 ? match.channels : [channel, 'SporTV']
      const matched = findAllMatchingLiveChannels(liveList, targets)
      if (matched.length > 1 || (targets.length > 1 && matched.length >= 1)) {
        setPickerData({
          match,
          options: matched,
          liveList,
        })
        return
      }
      if (matched.length === 1) {
        play(matched[0].channel, { playlist: liveList })
        return
      }
      const found = findBestLiveChannel(liveList, targets)
      if (found) {
        play(found, { playlist: liveList })
      } else {
        alert(`Nenhum dos canais de transmissão (${targets.join(', ')}) foi encontrado na sua lista IPTV ativa.`)
      }
    } catch {
      // Ignora erro
    }
  }

  return (
    <div className="group relative shrink-0 w-[240px] sm:w-[280px] lg:w-[300px] text-left cursor-pointer">
      <div
        role="button"
        onClick={handlePlayChannel}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.target === e.currentTarget) {
            e.preventDefault()
            handlePlayChannel()
          }
        }}
        className="w-full block text-left rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-500/70"
        aria-label={`Assistir ${match.home} contra ${match.away}`}
        tabIndex={0}
      >
        {/* Card 16:9 com gradiente dividido estilo Amazon Prime Video Sports */}
        <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/10 group-hover:border-rose-500/80 group-hover:scale-[1.03] group-focus-within:border-rose-500/80 group-focus-within:scale-[1.03] transition-all duration-300">
          {/* Lado Esquerdo (Mandante) */}
          <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-br overflow-hidden flex items-center justify-center p-3" style={{ clipPath: 'polygon(0 0, 100% 0, 80% 100%, 0 100%)' }}>
            <div className={`absolute inset-0 bg-gradient-to-r ${leftGradient} opacity-90`} />
            {match.homeBadge ? (
              <img
                src={match.homeBadge}
                alt={match.home}
                className="relative z-10 w-14 sm:w-16 h-14 sm:h-16 object-contain filter drop-shadow-lg transform group-hover:scale-110 transition-transform"
                loading="lazy"
              />
            ) : (
              <div className="relative z-10 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white">
                {match.home.slice(0, 3)}
              </div>
            )}
          </div>

          {/* Lado Direito (Visitante) */}
          <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-bl overflow-hidden flex items-center justify-center p-3" style={{ clipPath: 'polygon(20% 0, 100% 0, 100% 100%, 0 100%)' }}>
            <div className={`absolute inset-0 bg-gradient-to-l ${rightGradient} opacity-90`} />
            {match.awayBadge ? (
              <img
                src={match.awayBadge}
                alt={match.away}
                className="relative z-10 w-14 sm:w-16 h-14 sm:h-16 object-contain filter drop-shadow-lg transform group-hover:scale-110 transition-transform"
                loading="lazy"
              />
            ) : (
              <div className="relative z-10 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white">
                {match.away.slice(0, 3)}
              </div>
            )}
          </div>

          {/* Divisor Central Sutil ou Placar Ao Vivo */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {isLive && match.homeScore !== null && match.awayScore !== null ? (
              <span className="font-black text-xs text-white tracking-widest bg-black/70 backdrop-blur-sm px-2.5 py-0.5 rounded-full border border-rose-500/60 shadow-lg">
                {match.homeScore} - {match.awayScore}
              </span>
            ) : (
              <span className="font-black text-xs text-white/50 tracking-widest bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded-full border border-white/10">
                VS
              </span>
            )}
          </div>

          {/* Badge de Status no Canto Superior Direito */}
          <div className="absolute top-2.5 right-2.5 z-20">
            {isLive ? (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-600/90 text-white font-extrabold text-[10px] uppercase shadow-lg animate-pulse">
                <Radio size={10} /> {countdownLabel}
              </span>
            ) : countdownLabel.startsWith('EM ') && countdownLabel !== 'EM BREVE' ? (
              <span className="px-2 py-0.5 rounded-md bg-amber-500 text-zinc-950 font-black text-[10px] uppercase shadow-md">
                ⏱️ {countdownLabel}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-zinc-200 border border-white/10 font-bold text-[10px] uppercase tracking-wide">
                {countdownLabel}
              </span>
            )}
          </div>

          {/* Badge da Liga no Canto Superior Esquerdo */}
          {match.leagueBadge && (
            <div className="absolute top-2.5 left-2.5 z-20">
              <img
                src={match.leagueBadge}
                alt={match.league}
                className="w-5 h-5 object-contain filter drop-shadow"
              />
            </div>
          )}

          {/* Selo do Canal / Transmissão no Canto Inferior Direito */}
          <div className="absolute bottom-2.5 right-2.5 z-20">
            <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-bold text-zinc-300 border border-white/10 flex items-center gap-1">
              <Play size={8} className="fill-rose-500 text-rose-500" />
              {channel}
            </span>
          </div>

          {/* Hover Play Overlay */}
          <div className="absolute inset-0 z-30 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="p-3 rounded-full bg-rose-600 text-white shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
              <Play size={20} className="fill-white translate-x-0.5" />
            </div>
          </div>
        </div>

        {/* Informações da Partida */}
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-sm font-bold text-zinc-100 truncate group-hover:text-rose-400 transition">
              {match.home} x {match.away}
            </p>
            <p className="text-xs text-zinc-400 font-medium truncate">
              {formatMatchTime(match.time)}
            </p>
          </div>

          {!isLive && (
            <button
              type="button"
              onClick={toggleReminder}
              className={`p-1.5 rounded-full border transition shrink-0 ${
                hasReminder
                  ? 'bg-amber-400 text-zinc-950 border-amber-400 shadow-md shadow-amber-400/30'
                  : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white border-zinc-700'
              }`}
              title={hasReminder ? 'Lembrete ativado!' : 'Ativar lembrete da partida'}
            >
              {hasReminder ? <BellCheck size={14} /> : <Bell size={14} />}
            </button>
          )}
        </div>
      </div>

      {pickerData && (
        <SportsChannelPickerModal
          match={pickerData.match}
          options={pickerData.options}
          onSelectChannel={(ch) => {
            const list = pickerData.liveList
            setPickerData(null)
            play(ch, { playlist: list })
          }}
          onClose={() => setPickerData(null)}
        />
      )}
    </div>
  )
}

export default memo(SportsMatchCardBase)
