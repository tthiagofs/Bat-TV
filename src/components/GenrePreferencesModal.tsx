import { useState } from 'react'
import { Heart, Sparkles, Check, ArrowRight, X } from 'lucide-react'

export interface GenreOption {
  id: string
  label: string
  icon: string
  badge?: string
}

export const AVAILABLE_GENRES: GenreOption[] = [
  { id: 'dorama', label: 'Doramas / K-Dramas', icon: '🌸', badge: 'Populares' },
  { id: 'anime', label: 'Animes & Desenhos', icon: '⚡' },
  { id: 'acao', label: 'Ação & Aventura', icon: '💥' },
  { id: 'comedia', label: 'Comédia', icon: '😂' },
  { id: 'suspense', label: 'Suspense & Terror', icon: '👻' },
  { id: 'romance', label: 'Romance', icon: '💖' },
  { id: 'ficcao', label: 'Ficção Científica', icon: '🚀' },
  { id: 'documentario', label: 'Documentários', icon: '🌍' },
  { id: 'infantil', label: 'Kids & Família', icon: '🎈' },
  { id: 'futebol', label: 'Futebol & Esportes', icon: '⚽' },
]

interface Props {
  initialSelected?: string[]
  profileName: string
  onSave: (genres: string[]) => void
  onClose: () => void
}

export default function GenrePreferencesModal({
  initialSelected = [],
  profileName,
  onSave,
  onClose,
}: Props) {
  const [selected, setSelected] = useState<string[]>(initialSelected)

  const toggleGenre = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    )
  }

  const handleConfirm = () => {
    onSave(selected)
    onClose()
  }

  return (
    <div data-tv-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 fade-up select-none">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-lg p-6 flex flex-col shadow-2xl relative">
        <button
          type="button"
          tabIndex={0}
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 focus:ring-4 focus:ring-rose-500 focus:outline-none transition cursor-pointer"
        >
          <X size={20} />
        </button>


        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-2xl bg-rose-600/20 text-rose-500 border border-rose-500/30">
            <Sparkles size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-100">
              O que {profileName} mais gosta de assistir?
            </h2>
            <p className="text-xs text-zinc-400">
              Escolha seus gêneros prediletos para recebermos recomendações sob medida
            </p>
          </div>
        </div>

        {/* Grade de Gêneros */}
        <div className="grid grid-cols-2 gap-2.5 my-4 max-h-[55vh] overflow-y-auto pr-1">
          {AVAILABLE_GENRES.map((g) => {
            const isSelected = selected.includes(g.id)
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => toggleGenre(g.id)}
                className={`relative flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${
                  isSelected
                    ? 'bg-rose-950/40 border-rose-500 text-white shadow-md shadow-rose-950/30'
                    : 'bg-zinc-950/40 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/40'
                }`}
              >
                <span className="text-2xl">{g.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold truncate block">{g.label}</span>
                  </div>
                  {g.badge && (
                    <span className="text-[9px] font-extrabold uppercase text-rose-400 tracking-wider">
                      {g.badge}
                    </span>
                  )}
                </div>
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition ${
                    isSelected
                      ? 'bg-rose-600 border-rose-500 text-white'
                      : 'border-zinc-700 bg-zinc-900 text-transparent'
                  }`}
                >
                  <Check size={12} className={isSelected ? 'block' : 'hidden'} />
                </div>
              </button>
            )
          })}
        </div>

        {/* Rodapé com Botão Salvar */}
        <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            {selected.length} selecionado{selected.length !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200"
            >
              Pular
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow-lg shadow-rose-950/40 flex items-center gap-1.5"
            >
              <span>Salvar Preferências</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
