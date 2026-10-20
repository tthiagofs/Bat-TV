import { Home, Tv, Film, Clapperboard, Trophy } from 'lucide-react'
import { useProfiles } from '../../context/ProfileContext'
import { Avatar, DEFAULT_AVATAR } from '../../data/avatars'
import type { Section } from '../../types'

interface Props {
  activeSection: Section | 'my-netflix'
  onSelectSection: (s: Section | 'my-netflix') => void
}

export default function MobileNavBar({ activeSection, onSelectSection }: Props) {
  const { active: profile } = useProfiles()

  const navItems = [
    {
      id: 'home' as const,
      label: 'Início',
      icon: Home,
    },
    {
      id: 'live' as const,
      label: 'TV Ao Vivo',
      icon: Tv,
    },
    {
      id: 'movies' as const,
      label: 'Filmes',
      icon: Film,
    },
    {
      id: 'series' as const,
      label: 'Séries',
      icon: Clapperboard,
    },
    {
      id: 'sports' as const,
      label: 'Esportes',
      icon: Trophy,
    },
    {
      id: 'my-netflix' as const,
      label: profile?.name ? profile.name.slice(0, 8) : 'Perfil',
      isProfile: true,
    },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/95 backdrop-blur-lg border-t border-white/10 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 px-1 sm:px-2">
      <div className="flex items-center justify-between max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = activeSection === item.id
          const Icon = item.icon

          if (item.isProfile) {
            return (
              <button
                key={item.id}
                onClick={() => onSelectSection(item.id)}
                className="flex-1 flex flex-col items-center gap-0.5 sm:gap-1 py-1 px-0.5 sm:px-1 transition active:scale-95 focus:outline-none cursor-pointer touch-manipulation"
              >
                <div
                  className={`w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-md overflow-hidden transition-all flex items-center justify-center ${
                    isActive ? 'ring-2 ring-rose-500 scale-105 shadow-md' : 'opacity-75'
                  }`}
                >
                  <Avatar id={profile?.avatar || DEFAULT_AVATAR} size={22} className="w-full h-full rounded-md" />
                </div>
                <span
                  className={`text-[9px] sm:text-[10px] font-medium tracking-tight truncate max-w-[54px] ${
                    isActive ? 'text-white font-bold' : 'text-zinc-400'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            )
          }

          return (
            <button
              key={item.id}
              onClick={() => onSelectSection(item.id)}
              className="flex-1 flex flex-col items-center gap-0.5 sm:gap-1 py-1 px-0.5 sm:px-1 transition active:scale-95 focus:outline-none cursor-pointer touch-manipulation"
            >
              {Icon && (
                <Icon
                  size={19}
                  className={`transition-colors shrink-0 ${
                    isActive ? 'text-rose-500 scale-105' : 'text-zinc-400'
                  }`}
                />
              )}
              <span
                className={`text-[9px] sm:text-[10px] font-medium tracking-tight truncate max-w-[54px] ${
                  isActive ? 'text-white font-bold' : 'text-zinc-400'
                }`}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
