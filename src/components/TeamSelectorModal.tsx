import { useState } from 'react'
import { X, Search } from 'lucide-react'
import { CLUBS, type Club } from '../data/teams'

interface Props {
  selected?: string
  onSelect: (clubKey: string | null) => void
  onClose: () => void
}

export default function TeamSelectorModal({ selected, onSelect, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'all' | 'br' | 'eu'>('all')

  const filtered = CLUBS.filter((c) => {
    if (tab !== 'all' && c.country !== tab) return false
    if (!search) return true
    return c.name.toLowerCase().includes(search.toLowerCase()) || c.short.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div data-tv-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 fade-up select-none">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-bold text-zinc-100">Selecione seu Time de Coração</h2>
            <p className="text-xs text-zinc-400">O app mostrará os próximos jogos, canais de transmissão e calendário na Home.</p>
          </div>
          <button
            type="button"
            tabIndex={0}
            onClick={onClose}
            className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 focus:ring-4 focus:ring-rose-500 focus:outline-none transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>


        <div className="p-4 border-b border-zinc-800 flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar clube (ex: Flamengo, Real Madrid)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-rose-500"
            />
          </div>
          <div className="flex gap-1 bg-zinc-800 p-1 rounded-xl">
            <button
              onClick={() => setTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${tab === 'all' ? 'bg-rose-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Todos
            </button>
            <button
              onClick={() => setTab('br')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${tab === 'br' ? 'bg-rose-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Brasileirão
            </button>
            <button
              onClick={() => setTab('eu')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${tab === 'eu' ? 'bg-rose-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Europa
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <button
            onClick={() => { onSelect(null); onClose() }}
            className={`p-3 rounded-xl border text-left transition flex flex-col items-center justify-center text-center gap-2 ${
              !selected ? 'border-rose-500 bg-rose-500/10' : 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-700'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400 text-xs font-bold">
              SEM
            </div>
            <span className="text-xs font-medium text-zinc-300">Nenhum Clube</span>
          </button>

          {filtered.map((c: Club) => {
            const isSel = selected === c.key
            return (
              <button
                key={c.key}
                onClick={() => { onSelect(c.key); onClose() }}
                className={`p-3 rounded-xl border text-left transition flex flex-col items-center justify-center text-center gap-2 group ${
                  isSel ? 'border-rose-500 bg-rose-500/10 shadow-lg shadow-rose-950/30' : 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-700 hover:bg-zinc-800/40'
                }`}
              >
                <div className="w-14 h-14 p-1.5 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-center shadow">
                  <img src={c.badge} alt={c.name} className="w-full h-full object-contain filter drop-shadow" />
                </div>
                <span className="text-xs font-semibold text-zinc-200 group-hover:text-rose-400 transition truncate max-w-full">
                  {c.name}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
