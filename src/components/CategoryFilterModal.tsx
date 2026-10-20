import { useState, memo } from 'react'
import { createPortal } from 'react-dom'
import { X, Check, Eye, EyeOff, RotateCcw } from 'lucide-react'
import type { Category } from '../services/xtreamService'

interface Props {
  categories: Category[]
  hiddenIds: string[]
  onToggleCategory: (id: string) => void
  onReset: () => void
  onClose: () => void
}

function CategoryFilterModalBase({
  categories,
  hiddenIds,
  onToggleCategory,
  onReset,
  onClose,
}: Props) {
  const [search, setSearch] = useState('')

  const filtered = categories.filter((c) =>
    c.category_name.toLowerCase().includes(search.toLowerCase())
  )

  return createPortal(
    <div
      data-tv-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 fade-up select-none text-zinc-100"
    >
      <div className="bg-zinc-950 border border-white/10 rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h2 className="text-base font-bold text-white">Gerenciar Categorias</h2>
            <p className="text-xs text-zinc-400">
              Oculte categorias indesejadas do catálogo
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Campo de Busca Rápida */}
        <div className="p-4 border-b border-white/10 flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar categorias por nome..."
            className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-rose-500"
          />
          {hiddenIds.length > 0 && (
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-300 transition"
              title="Exibir todas as categorias"
            >
              <RotateCcw size={12} />
              <span>Restaurar</span>
            </button>
          )}
        </div>

        {/* Lista de Categorias com Checkbox / Toggle */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5 no-scrollbar">
          {filtered.length === 0 ? (
            <p className="text-center text-xs text-zinc-500 py-8">
              Nenhuma categoria encontrada.
            </p>
          ) : (
            filtered.map((cat) => {
              const isHidden = hiddenIds.includes(cat.category_id)
              return (
                <button
                  key={cat.category_id}
                  onClick={() => onToggleCategory(cat.category_id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left transition cursor-pointer ${
                    isHidden
                      ? 'bg-zinc-900/50 text-zinc-500 line-through'
                      : 'bg-white/5 text-zinc-200 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="text-xs font-medium truncate flex-1 pr-2">
                    {cat.category_name}
                  </span>
                  <div className="shrink-0 flex items-center gap-1.5">
                    {isHidden ? (
                      <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                        <EyeOff size={14} /> Oculta
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                        <Eye size={14} /> Visível
                      </span>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Rodapé */}
        <div className="p-4 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition cursor-pointer"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default memo(CategoryFilterModalBase)
