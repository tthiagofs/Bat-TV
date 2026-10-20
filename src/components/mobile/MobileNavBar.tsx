import { Home, Film, Tv, Trophy, User } from 'lucide-react'
import { useProfiles } from '../../context/ProfileContext'
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
      id: 'movies' as const,
      label: 'Filmes',
      icon: Film,
    },
    {
      id: 'series' as const,
      label: 'Séries',
      icon: Tv,
    },
    {
      id: 'sports' as const,
      label: 'Esportes',
      icon: Trophy,
    },
    {
      id: 'my-netflix' as const,
      label: profile?.name ? profile.name.slice(0, 8) : 'Meu Perfil',
      isProfile: true,
    },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/95 backdrop-blur-lg border-t border-white/10 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 px-2">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = activeSection === item.id
          const Icon = item.icon

          if (item.isProfile) {
            return (
              <button
                key={item.id}
                onClick={() => onSelectSection(item.id)}
                className="flex flex-col items-center gap-1 py-1 px-2 transition active:scale-95 focus:outline-none cursor-pointer"
              >
                <div
                  className={`w-6 h-6 rounded-md overflow-hidden transition-all flex items-center justify-center ${
                    isActive ? 'ring-2 ring-rose-500 scale-105' : 'opacity-70'
                  }`}
                >
                  {profile?.avatar ? (
                    <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-sky-500 flex items-center justify-center text-[10px] font-bold text-white">
                      😊
                    </div>
                  )}
                </div>
                <span
                  className={`text-[10px] font-medium tracking-tight ${
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
              className="flex flex-col items-center gap-1 py-1 px-2 transition active:scale-95 focus:outline-none cursor-pointer"
            >
              {Icon && (
                <Icon
                  size={20}
                  className={`transition-colors ${
                    isActive ? 'text-rose-500' : 'text-zinc-400'
                  }`}
                />
              )}
              <span
                className={`text-[10px] font-medium tracking-tight ${
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
