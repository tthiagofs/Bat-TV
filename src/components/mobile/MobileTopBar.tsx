import { Search, Cast, User } from 'lucide-react'
import { useProfiles } from '../../context/ProfileContext'
import type { Section } from '../../types'

interface Props {
  activeSection: Section
  onSelectSection: (s: Section) => void
  search: string
  onSearchChange: (val: string) => void
  onOpenProfile: () => void
}

export default function MobileTopBar({
  activeSection,
  onSelectSection,
  search,
  onSearchChange,
  onOpenProfile,
}: Props) {
  const { active: profile } = useProfiles()

  return (
    <header className="sticky top-0 z-40 w-full bg-gradient-to-b from-black/90 via-black/60 to-transparent pt-[max(env(safe-area-inset-top),0.5rem)] pb-2 px-4 transition-all">
      {/* Linha Superior: Logo + Ações */}
      <div className="flex items-center justify-between h-12">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSelectSection('home')}
            className="flex items-center gap-1.5 focus:outline-none"
          >
            <span className="text-rose-600 font-black text-2xl tracking-tighter">BAT</span>
            <span className="text-white font-extrabold text-lg tracking-wider">TV</span>
          </button>
        </div>

        <div className="flex items-center gap-4">
          {/* Botão de Busca */}
          <div className="relative flex items-center">
            {search ? (
              <input
                type="text"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Buscar filmes, séries..."
                autoFocus
                className="w-48 bg-zinc-900/90 text-white text-xs rounded-full pl-8 pr-3 py-1.5 border border-white/20 focus:outline-none focus:border-rose-500"
              />
            ) : null}
            <button
              onClick={() => onSearchChange(search ? '' : ' ')}
              className="p-1.5 rounded-full text-zinc-300 hover:text-white transition cursor-pointer"
              aria-label="Buscar"
            >
              <Search size={20} />
            </button>
          </div>

          {/* Avatar do Perfil */}
          <button
            onClick={onOpenProfile}
            className="relative w-8 h-8 rounded-md overflow-hidden ring-1 ring-white/20 active:scale-95 transition cursor-pointer flex items-center justify-center bg-zinc-800"
          >
            {profile?.avatar ? (
              <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
            ) : (
              <User size={16} className="text-zinc-300" />
            )}
          </button>
        </div>
      </div>

      {/* Chips de Categorias estilo Netflix */}
      {!search && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => onSelectSection('series')}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              activeSection === 'series'
                ? 'bg-white text-zinc-950 font-bold'
                : 'bg-zinc-900/80 text-zinc-300 border border-white/10'
            }`}
          >
            Séries
          </button>
          <button
            onClick={() => onSelectSection('movies')}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              activeSection === 'movies'
                ? 'bg-white text-zinc-950 font-bold'
                : 'bg-zinc-900/80 text-zinc-300 border border-white/10'
            }`}
          >
            Filmes
          </button>
          <button
            onClick={() => onSelectSection('sports')}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              activeSection === 'sports'
                ? 'bg-white text-zinc-950 font-bold'
                : 'bg-zinc-900/80 text-zinc-300 border border-white/10'
            }`}
          >
            ⚽ Esportes
          </button>
          <button
            onClick={() => onSelectSection('live')}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              activeSection === 'live'
                ? 'bg-white text-zinc-950 font-bold'
                : 'bg-zinc-900/80 text-zinc-300 border border-white/10'
            }`}
          >
            Ao Vivo
          </button>
        </div>
      )}
    </header>
  )
}
