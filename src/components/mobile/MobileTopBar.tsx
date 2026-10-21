import { Search, Star } from 'lucide-react'
import { useProfiles } from '../../context/ProfileContext'
import { Avatar, DEFAULT_AVATAR } from '../../data/avatars'
import batLogo from '../../assets/logo.png'
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
    <header className="absolute top-0 inset-x-0 z-40 w-full bg-gradient-to-b from-black/85 via-black/40 to-transparent pt-[max(env(safe-area-inset-top),0.5rem)] pb-3 px-4 pointer-events-auto transition-all">
      {/* Linha Superior: Logo Oficial + Ações */}
      <div className="flex items-center justify-between h-12">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSelectSection('home')}
            className="flex items-center gap-1.5 focus:outline-none cursor-pointer active:scale-95 transition"
            aria-label="BAT TV Início"
          >
            <img
              src={batLogo}
              alt="BAT TV"
              className="h-8 w-auto max-w-[120px] object-contain drop-shadow-md"
            />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Botão Minha Lista (Mobile) */}
          <button
            onClick={() => {
              onSelectSection('favorites')
              onSearchChange('')
            }}
            className={`p-1.5 rounded-full transition cursor-pointer active:scale-90 ${
              activeSection === 'favorites' && !search
                ? 'bg-rose-600/20 text-rose-400'
                : 'text-zinc-300 hover:text-white'
            }`}
            aria-label="Minha Lista"
            title="Minha Lista"
          >
            <Star size={19} className={activeSection === 'favorites' ? 'fill-rose-500 text-rose-500' : 'text-amber-400 fill-amber-400/40'} />
          </button>

          {/* Botão de Busca */}
          <div className="relative flex items-center">
            {search ? (
              <input
                type="text"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Buscar filmes, séries..."
                autoFocus
                className="w-44 sm:w-52 bg-zinc-900/90 text-white text-xs rounded-full pl-8 pr-3 py-1.5 border border-white/20 focus:outline-none focus:border-rose-500"
              />
            ) : null}
            <button
              onClick={() => onSearchChange(search ? '' : ' ')}
              className="p-1.5 rounded-full text-zinc-300 hover:text-white transition cursor-pointer active:scale-90"
              aria-label="Buscar"
            >
              <Search size={20} />
            </button>
          </div>

          {/* Avatar do Perfil */}
          <button
            onClick={onOpenProfile}
            className="relative w-8 h-8 rounded-lg overflow-hidden ring-1 ring-white/30 active:scale-90 transition cursor-pointer flex items-center justify-center bg-zinc-800 shadow"
            aria-label="Meu Perfil"
          >
            <Avatar id={profile?.avatar || DEFAULT_AVATAR} size={32} className="w-full h-full rounded-lg" />
          </button>
        </div>
      </div>
    </header>
  )
}
