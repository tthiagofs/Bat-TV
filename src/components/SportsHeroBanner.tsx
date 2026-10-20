import { useState, useEffect, memo } from 'react'
import { Play, Radio, Plus, Info, ChevronLeft, ChevronRight, Check, X, Calendar, Trophy, Tv, Bell, BellCheck } from 'lucide-react'
import type { Match } from '../services/sportsService'
import { usePlayback } from '../context/PlaybackContext'
import { useAuth } from '../context/AuthContext'
import { getItems } from '../services/catalog'

import { findBestLiveChannel } from '../utils/channelMatcher'
import stadium1 from '../assets/stadiums/stadium1.jpg'
import stadium2 from '../assets/stadiums/stadium2.jpg'
import stadium3 from '../assets/stadiums/stadium3.jpg'

const STADIUM_VARIATIONS = [stadium2, stadium1, stadium3]

interface Props {
  matches: Match[]
}

function SportsHeroBannerBase({ matches }: Props) {
  const { service } = useAuth()
  const { play } = usePlayback()
  const [index, setIndex] = useState(0)
  const [reminded, setReminded] = useState<Record<string, boolean>>({})
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [isBannerFocused, setIsBannerFocused] = useState(false)

  const activeMatches = matches.slice(0, 8)
  const current = activeMatches[index] || activeMatches[0]

  // Rotação suave automática a cada 8 segundos
  useEffect(() => {
    if (activeMatches.length <= 1) return
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % activeMatches.length)
    }, 8000)
    return () => clearInterval(timer)
  }, [activeMatches.length])

  // Atualização em tempo real do relógio a cada 10 segundos para contagem regressiva precisa
  const [nowTs, setNowTs] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 10_000)
    return () => clearInterval(t)
  }, [])

  if (!current) {
    return (
      <div className="relative w-full h-[480px] sm:h-[540px] lg:h-[580px] bg-zinc-950 overflow-hidden border-b border-white/10 flex items-center justify-center">
        <img
          src={stadium2}
          alt="Estádio"
          className="absolute inset-0 w-full h-full object-cover filter brightness-30 blur-xs"
        />
        <div className="relative z-10 flex flex-col items-center gap-3">
          <div className="h-9 w-9 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
          <span className="text-xs font-semibold text-zinc-400">Carregando transmissões ao vivo e confrontos...</span>
        </div>
      </div>
    )
  }

  const channel = current.channels?.[0] || 'SporTV'
  const currentBg = STADIUM_VARIATIONS[index % STADIUM_VARIATIONS.length]

  // Um jogo de futebol dura em média 2h a 2h30 (150 minutos)
  const diffMinutes = Math.round((current.time - nowTs) / 60_000)
  const elapsedMinutes = Math.round((nowTs - current.time) / 60_000)

  const isFinished = current.status === 'FT' || current.status === 'AOT' || elapsedMinutes > 150
  const isLive = !isFinished && (current.status === '1H' || current.status === '2H' || current.status === 'LIVE' || current.status === 'HT' || (elapsedMinutes >= 0 && elapsedMinutes <= 150))

  const countdownText = (() => {
    if (isFinished) return 'ENCERRADO'
    if (isLive) {
      if (current.statusDetail) return `AO VIVO · ${current.statusDetail}`
      if (elapsedMinutes >= 0 && elapsedMinutes <= 150) {
        if (elapsedMinutes <= 48) return `AO VIVO · ${elapsedMinutes}' 1ºT`
        if (elapsedMinutes <= 63) return 'AO VIVO · INTERVALO'
        if (elapsedMinutes <= 110) return `AO VIVO · ${elapsedMinutes - 15}' 2ºT`
        return 'AO VIVO · ACRÉSCIMOS'
      }
      return 'AO VIVO AGORA'
    }
    // Ainda não começou (diffMinutes > 0)
    if (diffMinutes <= 60 && diffMinutes > 0) {
      return `INICIA EM ${diffMinutes} MINUTOS`
    }
    if (diffMinutes <= 120 && diffMinutes > 60) {
      const h = Math.floor(diffMinutes / 60)
      const m = diffMinutes % 60
      return `INICIA EM ${h}H ${m}MIN`
    }
    return null
  })()

  const handlePlay = async () => {
    if (!service) return
    try {
      const liveList = await getItems(service, 'live', 'all')
      const target = channel || current.channels?.[0] || 'SporTV'
      const found = findBestLiveChannel(liveList, target)
      if (found) play(found, { playlist: liveList })
    } catch {
      // ignore
    }
  }

  const toggleReminder = () => {
    setReminded((prev) => ({ ...prev, [current.id]: !prev[current.id] }))
  }

  const formatHours = (ts: number) => {
    const d = new Date(ts)
    const h = String(d.getHours()).padStart(2, '0')
    const m = String(d.getMinutes()).padStart(2, '0')
    const day = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
    return `${day} às ${h}:${m} BRT`
  }

  return (
    <div
      tabIndex={0}
      data-tv-banner="true"
      role="region"
      aria-label={`${current.home} contra ${current.away}. Use as setas esquerda e direita para mudar de partida.`}
      onFocus={(e) => {
        if (e.target === e.currentTarget) {
          setIsBannerFocused(true)
        }
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsBannerFocused(false)
        }
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          e.stopPropagation()
          setIndex((prev) => (prev - 1 + activeMatches.length) % activeMatches.length)
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          e.stopPropagation()
          setIndex((prev) => (prev + 1) % activeMatches.length)
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handlePlay()
        }
      }}
      className={`relative w-full shrink-0 h-[480px] sm:h-[540px] lg:h-[580px] bg-zinc-950 overflow-hidden select-none border-b border-white/10 group focus:outline-none transition-all duration-300 ${
        isBannerFocused ? 'ring-4 ring-inset ring-rose-500 shadow-[inset_0_0_80px_rgba(244,63,94,0.45)]' : ''
      }`}
    >
      {/* Indicador de Atalho D-pad quando o Banner está focado */}
      {isBannerFocused && (
        <div className="absolute top-20 right-8 z-40 flex items-center gap-3 bg-black/85 backdrop-blur-md border border-rose-500/60 px-4 py-2 rounded-xl shadow-2xl fade-up">
          <span className="text-xs font-black text-white flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono">◀</span>
            <span className="px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono">▶</span>
            <span>Mudar Partida</span>
          </span>
          <span className="w-px h-3.5 bg-white/20" />
          <span className="text-xs font-black text-rose-400 flex items-center gap-1">
            <span className="px-1.5 py-0.5 rounded bg-rose-600/30 border border-rose-500/40 text-[10px] font-mono text-white">OK</span>
            <span>Assistir Canal</span>
          </span>
          <span className="w-px h-3.5 bg-white/20" />
          <span className="text-xs font-black text-zinc-300 flex items-center gap-1">
            <span className="px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono">▼</span>
            <span>Opções</span>
          </span>
        </div>
      )}

      {/* 1. Imagem de Fundo de Estádio Real Cinematográfico com Iluminação Épica */}
      <img
        key={index}
        src={currentBg}
        alt="Estádio de Futebol"
        className="absolute inset-0 w-full h-full object-cover object-center filter brightness-75 contrast-110 transition-all duration-1000 scale-[1.02]"
      />

      {/* 2. Gradientes Profundos Multi-Camadas (estilo Print 3 do Paramount+ / Prime) */}
      {/* Gradiente Lateral Esquerdo Escuro para legibilidade perfeita do texto */}
      <div className="absolute inset-y-0 left-0 w-full sm:w-[70%] lg:w-[55%] bg-gradient-to-r from-black via-black/85 via-50% to-transparent z-10 pointer-events-none" />
      {/* Gradiente Inferior suave para mesclar com o corpo da página */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent z-10 pointer-events-none" />
      {/* Gradiente Superior para o header fixo */}
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/80 to-transparent z-10 pointer-events-none" />
      {/* Vinheta atmosférica */}
      <div className="absolute inset-0 bg-radial-gradient from-transparent via-black/20 to-black/60 z-10 pointer-events-none" />

      {/* 3. Conteúdo Principal do Banner Ocupando 100% da Largura da Tela */}
      <div className="relative z-20 h-full w-full px-8 sm:px-14 lg:px-16 flex flex-col justify-end pb-12 sm:pb-16">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          {/* Lado Esquerdo: Metadados da Partida */}
          <div className="max-w-xl space-y-3.5 sm:space-y-4">
            {/* Linha Superior: Logo da Transmissão e Competição */}
            <div className="flex items-center gap-3">
              {current.leagueBadge && (
                <img
                  src={current.leagueBadge}
                  alt={current.league}
                  className="w-8 h-8 object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                />
              )}
              <div className="flex flex-col">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-zinc-400">
                  {current.league.includes('Copa') ? 'Fase Eliminatória' : 'Ao vivo & Exclusivo'}
                </span>
                <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-white drop-shadow">
                  {current.league}
                </span>
              </div>
            </div>

            {/* Título Principal */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight drop-shadow-2xl">
              {current.home} <span className="text-zinc-400 font-light text-2xl sm:text-3xl">x</span> {current.away}
            </h1>

            {/* Badges de Horário / Status */}
            <div className="flex flex-wrap items-center gap-3 pt-0.5">
              {isLive ? (
                <span className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-rose-600 text-white font-black text-xs uppercase animate-pulse shadow-lg shadow-rose-950/60">
                  <Radio size={13} /> {countdownText || 'AO VIVO AGORA'}
                </span>
              ) : countdownText ? (
                <span className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-500 text-zinc-950 font-black text-xs uppercase shadow-md shadow-amber-500/30">
                  ⏱️ {countdownText}
                </span>
              ) : (
                <span className="px-3.5 py-1 rounded-full bg-black/60 border border-white/20 text-zinc-200 font-bold text-xs uppercase backdrop-blur-md">
                  EM BREVE · {formatHours(current.time)}
                </span>
              )}
              <span className="text-xs text-zinc-300 font-semibold bg-white/10 px-2.5 py-1 rounded-full backdrop-blur-md border border-white/10">
                Canal: {current.channels?.join(', ') || channel}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-zinc-300 line-clamp-2 max-w-lg leading-relaxed drop-shadow">
              Alô, torcedores! Confronto decisivo entre {current.home} e {current.away} pela {current.league} com transmissão oficial nos canais da sua lista IPTV.
            </p>

            {/* Ações Estilo Prime Video / Paramount+ */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handlePlay()
                }}
                className="flex items-center gap-2.5 px-7 py-3 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 font-black text-sm shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-4 focus:ring-rose-500"
              >
                <Play size={18} className="fill-zinc-950" />
                <span>{isLive ? 'Assistir Agora' : `Assistir na ${channel}`}</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleReminder()
                }}
                className={`p-3 rounded-full border transition hover:scale-105 cursor-pointer backdrop-blur-md focus:outline-none focus:ring-4 focus:ring-rose-500 ${
                  reminded[current.id]
                    ? 'bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-950/50'
                    : 'bg-black/60 hover:bg-white/15 border-white/20 text-white'
                }`}
                title={reminded[current.id] ? 'Lembrete ativado' : 'Adicionar aos Lembretes'}
              >
                {reminded[current.id] ? <Check size={18} /> : <Plus size={18} />}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowDetailsModal(true)
                }}
                className="p-3 rounded-full bg-black/60 hover:bg-white/15 border border-white/20 text-white transition hover:scale-105 cursor-pointer backdrop-blur-md focus:outline-none focus:ring-4 focus:ring-rose-500"
                title="Mais Informações da Partida"
              >
                <Info size={18} />
              </button>
            </div>
          </div>

          {/* Lado Direito: Escudos Gigantes dos Times com 'X' Estilo Print 3 */}
          <div className="hidden lg:flex items-center justify-center gap-6 pr-6 pb-2">
            {/* Escudo Mandante */}
            <div className="relative flex flex-col items-center">
              <div className="w-32 h-32 flex items-center justify-center p-3 filter drop-shadow-[0_15px_30px_rgba(0,0,0,0.9)] hover:scale-105 transition-transform duration-300">
                {current.homeBadge ? (
                  <img
                    src={current.homeBadge}
                    alt={current.home}
                    className="w-full h-full object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.7)]"
                  />
                ) : (
                  <span className="text-3xl font-black text-white">{current.home.slice(0, 3)}</span>
                )}
              </div>
              <span className="text-xs font-bold text-white uppercase tracking-wider text-center mt-1 drop-shadow">
                {current.home}
              </span>
            </div>

            {/* X Central Estilizado ou Placar Ao Vivo */}
            <div className="flex flex-col items-center justify-center px-2">
              {isLive && current.homeScore !== null && current.awayScore !== null ? (
                <div className="flex items-center gap-2 px-3.5 py-1.5 bg-black/80 border border-rose-500/60 rounded-xl shadow-xl backdrop-blur-md">
                  <span className="text-3xl sm:text-4xl font-black text-rose-500">{current.homeScore}</span>
                  <span className="text-xl font-bold text-zinc-400">-</span>
                  <span className="text-3xl sm:text-4xl font-black text-rose-500">{current.awayScore}</span>
                </div>
              ) : (
                <span className="text-4xl font-black text-white/90 drop-shadow-[0_0_20px_rgba(255,255,255,0.4)] tracking-wider">
                  X
                </span>
              )}
            </div>

            {/* Escudo Visitante */}
            <div className="relative flex flex-col items-center">
              <div className="w-32 h-32 flex items-center justify-center p-3 filter drop-shadow-[0_15px_30px_rgba(0,0,0,0.9)] hover:scale-105 transition-transform duration-300">
                {current.awayBadge ? (
                  <img
                    src={current.awayBadge}
                    alt={current.away}
                    className="w-full h-full object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.7)]"
                  />
                ) : (
                  <span className="text-3xl font-black text-white">{current.away.slice(0, 3)}</span>
                )}
              </div>
              <span className="text-xs font-bold text-white uppercase tracking-wider text-center mt-1 drop-shadow">
                {current.away}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Setas de navegação lateral (Apenas Mouse / Desktop) */}
      <button
        type="button"
        tabIndex={-1}
        data-tv-ignore="true"
        aria-hidden="true"
        onClick={() => setIndex((prev) => (prev - 1 + activeMatches.length) % activeMatches.length)}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-full bg-black/60 hover:bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition shadow-2xl backdrop-blur-md border border-white/10 cursor-pointer"
        aria-label="Anterior"
      >
        <ChevronLeft size={24} />
      </button>
      <button
        type="button"
        tabIndex={-1}
        data-tv-ignore="true"
        aria-hidden="true"
        onClick={() => setIndex((prev) => (prev + 1) % activeMatches.length)}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-full bg-black/60 hover:bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition shadow-2xl backdrop-blur-md border border-white/10 cursor-pointer"
        aria-label="Próximo"
      >
        <ChevronRight size={24} />
      </button>

      {/* Indicadores de Slides em Cápsula Glassmorphic */}
      {activeMatches.length > 1 && (
        <div className="absolute bottom-6 right-6 sm:right-12 z-30 flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
          {activeMatches.map((_, i) => (
            <button
              type="button"
              tabIndex={-1}
              data-tv-ignore="true"
              aria-hidden="true"
              key={i}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                index === i ? 'w-6 bg-rose-600 shadow-md shadow-rose-600/50' : 'w-1.5 bg-white/40 hover:bg-white/70'
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Modal 'Mais Informações' do Confronto Esportivo */}
      {showDetailsModal && (
        <div className="fixed inset-0 z-[150] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 fade-up">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative select-none">
            <button
              onClick={() => setShowDetailsModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition"
              title="Fechar"
            >
              <X size={20} />
            </button>

            {/* Cabeçalho do Confronto */}
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2.5 py-1 rounded-md bg-rose-600/20 text-rose-400 border border-rose-500/30 text-xs font-bold uppercase tracking-wider">
                Futebol Ao Vivo & Exclusivo
              </span>
            </div>

            {/* Placar e Escudos */}
            <div className="flex items-center justify-around py-4 bg-zinc-950/60 rounded-2xl border border-zinc-800/80 mb-5">
              <div className="flex flex-col items-center gap-2 text-center w-32">
                {current.homeBadge ? (
                  <img src={current.homeBadge} alt={current.home} className="w-14 h-14 object-contain filter drop-shadow" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center font-bold text-white text-sm">
                    {current.home.slice(0, 3)}
                  </div>
                )}
                <span className="text-xs font-bold text-white truncate max-w-[120px]">{current.home}</span>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-xl font-black text-rose-500">VS</span>
                <span className="text-[10px] text-zinc-400 font-semibold uppercase mt-1">
                  {isLive ? 'Ao Vivo Agora' : 'Em Breve'}
                </span>
              </div>

              <div className="flex flex-col items-center gap-2 text-center w-32">
                {current.awayBadge ? (
                  <img src={current.awayBadge} alt={current.away} className="w-14 h-14 object-contain filter drop-shadow" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center font-bold text-white text-sm">
                    {current.away.slice(0, 3)}
                  </div>
                )}
                <span className="text-xs font-bold text-white truncate max-w-[120px]">{current.away}</span>
              </div>
            </div>

            {/* Detalhes da Partida */}
            <div className="space-y-3 text-xs text-zinc-300">
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-zinc-800/40 border border-zinc-800">
                <Trophy size={16} className="text-amber-400 shrink-0" />
                <div>
                  <span className="text-zinc-400 block text-[11px]">Competição</span>
                  <span className="font-bold text-white">{current.league}</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-zinc-800/40 border border-zinc-800">
                <Calendar size={16} className="text-rose-400 shrink-0" />
                <div>
                  <span className="text-zinc-400 block text-[11px]">Data e Horário (Brasília)</span>
                  <span className="font-bold text-white">{formatHours(current.time)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-zinc-800/40 border border-zinc-800">
                <Tv size={16} className="text-sky-400 shrink-0" />
                <div>
                  <span className="text-zinc-400 block text-[11px]">Transmissão Oficial</span>
                  <span className="font-bold text-white">
                    {current.channels?.join(', ') || channel} (Disponível na sua lista)
                  </span>
                </div>
              </div>
            </div>

            {/* Botões do Modal */}
            <div className="mt-6 flex items-center justify-between gap-3 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={toggleReminder}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition ${
                  reminded[current.id]
                    ? 'bg-amber-400 text-zinc-950 border-amber-400'
                    : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:text-white'
                }`}
              >
                {reminded[current.id] ? <BellCheck size={15} /> : <Bell size={15} />}
                <span>{reminded[current.id] ? 'Lembrete Ativado' : 'Definir Lembrete'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowDetailsModal(false)
                  handlePlay()
                }}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-950/50 transition cursor-pointer"
              >
                <Play size={14} className="fill-white" />
                <span>Assistir Canal</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(SportsHeroBannerBase)
