import { useState, type ChangeEvent } from 'react'
import { X, Upload, Check } from 'lucide-react'
import { AVATAR_CATEGORIES, Avatar, type AvatarDef } from '../data/avatars'

interface Props {
  selected: string
  onSelect: (avatarId: string) => void
  onClose: () => void
}

export default function AvatarPickerModal({ selected, onSelect, onClose }: Props) {
  const [activeTab, setActiveTab] = useState(AVATAR_CATEGORIES[1].id) // inicia em Naruto
  const [customAvatar, setCustomAvatar] = useState(selected.startsWith('data:') ? selected : '')

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      if (dataUrl) {
        setCustomAvatar(dataUrl)
        onSelect(dataUrl)
      }
    }
    reader.readAsDataURL(file)
  }

  const currentCategory = AVATAR_CATEGORIES.find((c) => c.id === activeTab)

  return (
    <div data-tv-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 fade-up select-none">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-bold text-zinc-100">Escolha seu Avatar de Perfil</h2>
            <p className="text-xs text-zinc-400">Escolha entre personagens favoritos, clubes ou faça upload de uma foto sua.</p>
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


        {/* Abas */}
        <div className="flex overflow-x-auto p-3 gap-2 border-b border-zinc-800 no-scrollbar bg-zinc-950/40">
          <button
            onClick={() => setActiveTab('custom')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'custom' ? 'bg-rose-600 text-white shadow-md shadow-rose-900/30' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            <Upload size={13} /> Foto Própria
          </button>
          {AVATAR_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                activeTab === cat.id ? 'bg-rose-600 text-white shadow-md shadow-rose-900/30' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'custom' ? (
            <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
              <div className="relative group">
                {customAvatar ? (
                  <img src={customAvatar} alt="Avatar personalizado" className="w-28 h-28 rounded-2xl object-cover border-2 border-rose-500 shadow-xl" />
                ) : (
                  <div className="w-28 h-28 rounded-2xl bg-zinc-800 border-2 border-dashed border-zinc-700 flex flex-col items-center justify-center text-zinc-500">
                    <Upload size={32} />
                    <span className="text-[10px] mt-1">Carregar imagem</span>
                  </div>
                )}
              </div>

              <div>
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 font-semibold text-xs text-white transition shadow-lg shadow-rose-950/40">
                  <Upload size={14} /> Selecionar Foto do Computador
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
                <p className="text-[11px] text-zinc-500 mt-2">Suporta PNG, JPG e WebP.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
              {currentCategory?.avatars.map((av: AvatarDef) => {
                const isSel = selected === av.id
                return (
                  <button
                    key={av.id}
                    onClick={() => { onSelect(av.id); onClose() }}
                    className={`group flex flex-col items-center gap-2 p-2.5 rounded-2xl border transition relative ${
                      isSel ? 'border-rose-500 bg-rose-500/10 shadow-lg shadow-rose-950/40' : 'border-zinc-800/80 bg-zinc-950/30 hover:border-zinc-700 hover:bg-zinc-800/40'
                    }`}
                  >
                    <Avatar id={av.id} size={64} className="group-hover:scale-105 transition-transform" />
                    <span className="text-xs font-medium text-zinc-300 text-center truncate w-full group-hover:text-rose-400">
                      {av.label}
                    </span>
                    {isSel && (
                      <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-rose-600 flex items-center justify-center text-white shadow">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
