import { useState, useEffect, useRef } from 'react'
import { X, Tv, Play, Radio, Star } from 'lucide-react'
import type { Match } from '../services/sportsService'
import type { MatchedChannelOption } from '../utils/channelMatcher'
import type { MediaItem } from '../types'

function YouTubeIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

interface Props {
  match: Match
  options: MatchedChannelOption[]
  onSelectChannel: (channel: MediaItem, isVirtual?: boolean) => void
  onClose: () => void
}

export default function SportsChannelPickerModal({
  match,
  options,
  onSelectChannel,
  onClose,
}: Props) {
  const modalRef = useRef<HTMLDivElement>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const selectedIndexRef = useRef(0)
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Foco automático imediato no primeiro canal ao abrir o modal
  useEffect(() => {
    selectedIndexRef.current = 0
    setSelectedIndex(0)

    const timer = setTimeout(() => {
      buttonRefs.current[0]?.focus()
    }, 40)
    return () => clearTimeout(timer)
  }, [options])

  // Navegação estrita 1D para controle remoto de TV (D-pad) e acessibilidade
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Teclas de Voltar / Cancelar (Escape, Back do Fire TV / Android)
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
        e.stopImmediatePropagation()
        onClose()
        return
      }

      // 2. Setas Cima / Baixo (Navegação Linear sem Pulos ou Inversões)
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        if (options.length === 0) return

        const next = Math.min(options.length - 1, selectedIndexRef.current + 1)
        selectedIndexRef.current = next
        setSelectedIndex(next)
        const target = buttonRefs.current[next]
        target?.focus()
        target?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        if (options.length === 0) return

        const prev = Math.max(0, selectedIndexRef.current - 1)
        selectedIndexRef.current = prev
        setSelectedIndex(prev)
        const target = buttonRefs.current[prev]
        target?.focus()
        target?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
        return
      }

      // 3. Confirmar / OK do Controle (DPAD_CENTER = 23, Enter = 13, Espaço = 32)
      if (e.key === 'Enter' || e.key === ' ' || e.keyCode === 13 || e.keyCode === 23) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        const selected = options[selectedIndexRef.current]
        if (selected) {
          onSelectChannel(selected.channel, selected.isVirtual)
        }
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [options, onClose, onSelectChannel])

  const isLive = match.status === '1H' || match.status === '2H' || match.status === 'LIVE' || match.status === 'HT'

  return (
    <div
      role="dialog"
      data-tv-modal="true"
      data-channel-picker-active="true"
      aria-modal="true"
      aria-labelledby="channel-picker-title"
      onClick={onClose}
      className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 fade-up select-none touch-manipulation"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md sm:max-w-lg bg-zinc-950 border border-white/20 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Cabeçalho do Confronto */}
        <div className="relative p-5 sm:p-6 bg-gradient-to-b from-zinc-900 to-zinc-950 border-b border-white/10">
          {/* Botão Fechar */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar seleção de canal"
            tabIndex={-1}
            data-tv-ignore="true"
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
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-600 text-white font-black text-[10px] uppercase ml-auto mr-10 animate-pulse">
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
            {options.length > 1 ? (
              <>Esta partida possui <span className="text-white font-bold">{options.length} opções</span> de transmissão. Escolha onde assistir:</>
            ) : (
              <>Selecione o canal para iniciar a transmissão:</>
            )}
          </h2>
        </div>

        {/* Lista de Canais Disponíveis (Navegação Linear Segura) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-2.5 max-h-[55vh] no-scrollbar">
          {options.map((opt, idx) => {
            const isSelected = selectedIndex === idx
            const isFhd = opt.quality === 'FHD' || opt.quality === '4K'
            const isCaze = opt.isVirtual || opt.channel.id === 999901 || opt.channel.name.toLowerCase().includes('caze')

            return (
              <button
                key={`${opt.channel.id}-${idx}`}
                ref={(el) => {
                  buttonRefs.current[idx] = el
                }}
                type="button"
                data-channel-option="true"
                tabIndex={0}
                onFocus={() => {
                  selectedIndexRef.current = idx
                  setSelectedIndex(idx)
                }}
                onMouseEnter={() => {
                  selectedIndexRef.current = idx
                  setSelectedIndex(idx)
                }}
                onClick={() => onSelectChannel(opt.channel, opt.isVirtual)}
                className={`w-full group flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl transition-all cursor-pointer text-left focus:outline-none touch-manipulation ${
                  isSelected
                    ? 'bg-rose-600/30 border-2 border-rose-500 ring-4 ring-rose-500/80 shadow-[0_0_30px_rgba(244,63,94,0.35)] scale-[1.01]'
                    : 'bg-zinc-900/90 hover:bg-white/10 border border-white/10'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border transition ${
                      isCaze
                        ? 'bg-red-950/60 border-red-500/40'
                        : isSelected
                        ? 'bg-rose-600/40 border-rose-500/60'
                        : 'bg-black/60 border-white/10'
                    }`}
                  >
                    {isCaze ? (
                      <YouTubeIcon className="w-5 h-5 text-red-500" />
                    ) : (
                      <Tv size={20} className={isSelected ? 'text-white' : 'text-rose-400'} />
                    )}
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className={`font-extrabold text-sm sm:text-base truncate ${isSelected ? 'text-white' : 'text-zinc-100'}`}>
                        {opt.channel.name}
                      </p>
                      {opt.recommended && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-black uppercase tracking-wider shrink-0">
                          <Star size={10} className="fill-amber-300" /> Indicado
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate">
                      {isCaze ? (
                        <span className="text-red-400 font-semibold">Transmissão Oficial pelo YouTube</span>
                      ) : (
                        <>Transmitido via <span className="text-zinc-200 font-semibold">{opt.targetName}</span></>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-black uppercase tracking-wider ${
                      isCaze
                        ? 'bg-red-600/30 text-red-200 border border-red-500/50'
                        : isFhd
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-zinc-800 text-zinc-300 border border-white/10'
                    }`}
                  >
                    {opt.quality}
                  </span>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                      isSelected ? 'bg-rose-600 text-white shadow-lg' : 'bg-white/10 text-white'
                    }`}
                  >
                    <Play size={14} className="fill-white ml-0.5" />
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Rodapé com Dica de Acessibilidade */}
        <div className="p-3 bg-zinc-900/50 border-t border-white/5 text-center flex items-center justify-center gap-2">
          <span className="text-[11px] text-zinc-400">
            Use as setas <span className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-zinc-200">▲</span> <span className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-zinc-200">▼</span> do controle e pressione <span className="px-1.5 py-0.5 rounded bg-rose-600/30 border border-rose-500/40 font-mono text-white">OK</span>
          </span>
        </div>
      </div>
    </div>
  )
}
