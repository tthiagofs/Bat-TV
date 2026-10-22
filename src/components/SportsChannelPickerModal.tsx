import { useEffect, useRef } from 'react'
import { X, Tv, Play, Radio } from 'lucide-react'
import type { Match } from '../services/sportsService'
import type { MatchedChannelOption } from '../utils/channelMatcher'
import type { MediaItem } from '../types'

interface Props {
  match: Match
  options: MatchedChannelOption[]
  onSelectChannel: (channel: MediaItem) => void
  onClose: () => void
}

export default function SportsChannelPickerModal({
  match,
  options,
  onSelectChannel,
  onClose,
}: Props) {
  const modalRef = useRef<HTMLDivElement>(null)
  const firstButtonRef = useRef<HTMLButtonElement>(null)

  // Foco automático no primeiro canal para controle remoto de TV (D-pad) e acessibilidade
  useEffect(() => {
    const timer = setTimeout(() => {
      firstButtonRef.current?.focus()
    }, 60)
    return () => clearTimeout(timer)
  }, [])

  // Gerenciamento de teclado (TV D-pad, Escape para fechar, setas cima/baixo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isBackKey =
        e.key === 'Escape' ||
        e.key === 'Back' ||
        e.key === 'BrowserBack' ||
        e.key === 'GoBack' ||
        e.keyCode === 27 ||
        e.keyCode === 4 ||
        e.keyCode === 10009

      if (isBackKey) {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        return
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const buttons = modalRef.current?.querySelectorAll<HTMLButtonElement>('button')
        if (!buttons || buttons.length === 0) return

        const btnArray = Array.from(buttons)
        const currentIdx = btnArray.indexOf(document.activeElement as HTMLButtonElement)

        if (e.key === 'ArrowDown') {
          e.preventDefault()
          const nextIdx = currentIdx < btnArray.length - 1 ? currentIdx + 1 : 0
          btnArray[nextIdx]?.focus()
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          const prevIdx = currentIdx > 0 ? currentIdx - 1 : btnArray.length - 1
          btnArray[prevIdx]?.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [onClose])

  const isLive = match.status === '1H' || match.status === '2H' || match.status === 'LIVE' || match.status === 'HT'

  return (
    <div
      role="dialog"
      data-tv-modal="true"
      aria-modal="true"
      aria-labelledby="channel-picker-title"
      onClick={onClose}
      className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 fade-up select-none touch-manipulation"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md sm:max-w-lg bg-zinc-950 border border-white/20 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Cabeçalho do Confronto */}
        <div className="relative p-5 sm:p-6 bg-gradient-to-b from-zinc-900 to-zinc-950 border-b border-white/10">
          {/* Botão Fechar Acessível (Touch, Mouse, Controle Remoto) */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar seleção de canal"
            tabIndex={0}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition cursor-pointer focus:outline-none focus:ring-4 focus:ring-rose-500 active:scale-90 touch-manipulation"
          >
            <X size={20} />
          </button>

          {/* Badge de Competição e Status */}
          <div className="flex items-center gap-2 mb-3">
            {match.leagueBadge && (
              <img src={match.leagueBadge} alt="" className="w-5 h-5 object-contain" />
            )}
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-zinc-400">
              {match.league}
            </span>
            {isLive && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-600 text-white font-black text-[10px] uppercase ml-auto mr-10 animate-pulse">
                <Radio size={10} /> AO VIVO
              </span>
            )}
          </div>

          {/* Confronto com Escudos */}
          <div className="flex items-center justify-between gap-3 pr-8">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 flex items-center justify-center bg-black/50 rounded-xl p-1 border border-white/10">
                {match.homeBadge ? (
                  <img src={match.homeBadge} alt={match.home} className="w-full h-full object-contain" />
                ) : (
                  <span className="font-bold text-xs">{match.home.slice(0, 3)}</span>
                )}
              </div>
              <span className="font-extrabold text-sm sm:text-base text-white truncate max-w-[120px] sm:max-w-[150px]">
                {match.home}
              </span>
            </div>

            <span className="text-zinc-500 font-black text-xs sm:text-sm">vs</span>

            <div className="flex items-center gap-3 justify-end min-w-0">
              <span className="font-extrabold text-sm sm:text-base text-white truncate max-w-[120px] sm:max-w-[150px] text-right">
                {match.away}
              </span>
              <div className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 flex items-center justify-center bg-black/50 rounded-xl p-1 border border-white/10">
                {match.awayBadge ? (
                  <img src={match.awayBadge} alt={match.away} className="w-full h-full object-contain" />
                ) : (
                  <span className="font-bold text-xs">{match.away.slice(0, 3)}</span>
                )}
              </div>
            </div>
          </div>

          <h2 id="channel-picker-title" className="mt-4 text-xs sm:text-sm font-semibold text-zinc-300">
            Esta partida possui <span className="text-white font-bold">{options.length} canais</span> na sua lista. Escolha onde deseja assistir:
          </h2>
        </div>

        {/* Lista de Canais Disponíveis */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-2.5 max-h-[50vh] no-scrollbar">
          {options.map((opt, idx) => {
            const isFhd = opt.quality === 'FHD' || opt.quality === '4K'
            return (
              <button
                key={opt.channel.id}
                ref={idx === 0 ? firstButtonRef : undefined}
                type="button"
                tabIndex={0}
                onClick={() => onSelectChannel(opt.channel)}
                className="w-full group flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-zinc-900/90 hover:bg-rose-600/20 active:bg-rose-600/30 border border-white/10 hover:border-rose-500/80 transition-all cursor-pointer text-left focus:outline-none focus:ring-4 focus:ring-rose-500 active:scale-[0.98] touch-manipulation"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:border-rose-500/50 transition">
                    <Tv size={20} className="text-rose-400 group-hover:text-white transition" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm sm:text-base text-white truncate group-hover:text-rose-200 transition">
                      {opt.channel.name}
                    </p>
                    <p className="text-[11px] text-zinc-400 truncate">
                      Transmitido via <span className="text-zinc-200 font-semibold">{opt.targetName}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-black uppercase tracking-wider ${
                      isFhd
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-zinc-800 text-zinc-300 border border-white/10'
                    }`}
                  >
                    {opt.quality}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-white/10 group-hover:bg-rose-600 flex items-center justify-center text-white transition">
                    <Play size={14} className="fill-white ml-0.5" />
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Rodapé com Dica de Acessibilidade */}
        <div className="p-3 bg-zinc-900/50 border-t border-white/5 text-center">
          <p className="text-[11px] text-zinc-500">
            Dica: Use as setas do controle ou toque na tela para selecionar o canal desejado.
          </p>
        </div>
      </div>
    </div>
  )
}
