import { useState, useRef, useEffect, memo } from 'react'
import { Search, X, Star, ListVideo, LogOut, Users, Settings, Clock, Trash2, Tv } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useProfiles } from '../context/ProfileContext'
import { Avatar } from '../data/avatars'
import type { Section } from '../types'
import batLogo from '../assets/logo.png'

interface Props {
  activeSection: Section
  onSelectSection: (section: Section) => void
  search: string
  onSearchChange: (val: string) => void
  isScrolled: boolean
  onOpenEditProfile: () => void
}

const NAV_ITEMS: { id: Section; label: string }[] = [
  { id: 'home', label: 'Página inicial' },
  { id: 'movies', label: 'Filmes' },
  { id: 'series', label: 'Séries' },
  { id: 'sports', label: 'Esportes' },
  { id: 'live', label: 'TV ao vivo' },
  { id: 'downloads', label: 'Baixados' },
]

function PrimeHeaderBase({
  activeSection,
  onSelectSection,
  search,
  onSearchChange,
  isScrolled,
  onOpenEditProfile,
}: Props) {
  const { active: activeServer, openManager, logout } = useAuth()
  const { active: activeProfile, leave: leaveProfile, removeSearch } = useProfiles()

  const [showSearchInput, setShowSearchInput] = useState(false)
  const [showSearchHistory, setShowSearchHistory] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  const searchHistory = activeProfile?.searchHistory || []

  // Fecha menus ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Foco automático no input de busca ao abrir
  useEffect(() => {
    if (showSearchInput) {
      searchInputRef.current?.focus()
    }
  }, [showSearchInput])

  // Foco automático no primeiro item do menu de perfil ao abrir
  useEffect(() => {
    if (showProfileMenu) {
      const timer = setTimeout(() => {
        document.getElementById('profile-menu-first-item')?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [showProfileMenu])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-6 sm:px-10 py-3.5 flex items-center justify-between gap-4 ${
        isScrolled || !!search
          ? 'bg-zinc-950 border-b border-white/10 shadow-2xl'
          : 'bg-gradient-to-b from-zinc-950/95 via-zinc-950/60 to-transparent'
      }`}
    >
      {/* Esquerda: Logo Oficial BAT TV e Navegação Principal estilo Prime Video */}
      <div className="flex items-center gap-6 sm:gap-8">
        {/* Logo Oficial BAT TV */}
        <button
          type="button"
          tabIndex={0}
          onClick={() => {
            onSelectSection('home')
            onSearchChange('')
          }}
          className="flex items-center gap-2.5 group text-left cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-500 rounded-xl p-1"
          title="BAT TV - Início"
        >
          <img
            src={batLogo}
            alt="BAT TV Logo"
            className="h-9 w-auto max-w-[130px] object-contain drop-shadow-md group-hover:scale-105 transition-transform"
          />
        </button>

        {/* 5 Pilares de Navegação com Efeito Glassmorphism */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id && !search
            return (
              <button
                type="button"
                tabIndex={0}
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => {
                  onSelectSection(item.id)
                  onSearchChange('')
                }}
                className={`text-xs sm:text-sm font-semibold transition-all duration-200 px-3.5 py-1.5 rounded-full cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-500 focus-visible:bg-white/25 focus-visible:text-white focus-visible:scale-105 ${
                  isActive
                    ? 'bg-white/20 text-white backdrop-blur-md border border-white/20 shadow-sm font-bold scale-[1.02]'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </nav>
      </div>


      {/* Direita: Busca Global, Favoritos, Lista Ativa & Perfil */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Barra de Busca Dinâmica */}
        <div className="relative">
          {showSearchInput || search ? (
            <div className="relative flex items-center">
              <Search size={15} className="absolute left-3 text-zinc-400" />
              <input
                ref={searchInputRef}
                id="global-search"
                value={search}
                onFocus={() => setShowSearchHistory(true)}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  const input = e.currentTarget
                  if (e.key === 'ArrowRight' && (input.selectionStart === input.value.length || !input.value)) {
                    e.preventDefault()
                    e.stopPropagation()
                    document.getElementById('header-favs-btn')?.focus()
                  } else if (e.key === 'ArrowLeft' && (input.selectionStart === 0 || !input.value)) {
                    e.preventDefault()
                    e.stopPropagation()
                    const navTarget = document.getElementById(`nav-${activeSection}`) || document.getElementById('nav-live')
                    navTarget?.focus()
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    e.stopPropagation()
                    const firstHist = document.querySelector<HTMLElement>('[data-search-history-item="true"]')
                    if (firstHist && showSearchHistory) {
                      firstHist.focus()
                    } else {
                      const mainTarget = document.querySelector<HTMLElement>('main [tabindex="0"], main button, [data-tv-banner="true"]')
                      mainTarget?.focus()
                    }
                  } else if (e.key === 'Escape' || e.keyCode === 27 || e.keyCode === 4) {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowSearchInput(false)
                    setShowSearchHistory(false)
                    onSearchChange('')
                    document.getElementById('header-search-btn')?.focus()
                  }
                }}
                placeholder="Buscar filmes, séries, canais..."
                className="w-48 sm:w-64 rounded-full bg-zinc-900/90 border border-white/20 pl-9 pr-8 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/50 transition"
              />
              <button
                onClick={() => {
                  onSearchChange('')
                  setShowSearchInput(false)
                }}
                className="absolute right-2.5 p-1 text-zinc-400 hover:text-zinc-200"
                title="Fechar busca"
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              id="header-search-btn"
              tabIndex={0}
              onClick={() => setShowSearchInput(true)}
              className="p-2 rounded-full text-zinc-300 hover:text-white hover:bg-white/10 transition focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-500 cursor-pointer"
              title="Buscar"
            >
              <Search size={18} />
            </button>
          )}

          {/* Dropdown de Histórico de Pesquisas */}
          {showSearchHistory && !search && searchHistory.length > 0 && (
            <div
              onMouseLeave={() => setShowSearchHistory(false)}
              className="absolute top-full right-0 mt-2 w-64 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-2xl p-2 shadow-2xl z-50 fade-up"
            >
              <div className="flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                <span>Pesquisas Recentes</span>
              </div>
              <div className="space-y-0.5">
                {searchHistory.map((queryText) => (
                  <div
                    key={queryText}
                    className="flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-zinc-800 group cursor-pointer transition text-xs text-zinc-300"
                  >
                    <button
                      type="button"
                      tabIndex={0}
                      data-search-history-item="true"
                      onClick={() => {
                        onSearchChange(queryText)
                        setShowSearchHistory(false)
                      }}
                      className="flex items-center gap-2 flex-1 text-left truncate focus:outline-none focus-visible:text-rose-400"
                    >
                      <Clock size={12} className="text-zinc-500 group-hover:text-rose-400" />
                      <span className="truncate">{queryText}</span>
                    </button>
                    <button
                      type="button"
                      tabIndex={-1}
                      data-tv-ignore="true"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeSearch(queryText)
                      }}
                      className="text-zinc-600 hover:text-rose-400 p-1 transition cursor-pointer"
                      title="Remover"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Favoritos Rápidos */}
        <button
          type="button"
          id="header-favs-btn"
          tabIndex={0}
          onClick={() => onSelectSection('favorites')}
          className={`p-2 rounded-full transition focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-400 cursor-pointer ${
            activeSection === 'favorites' && !search
              ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30'
              : 'text-zinc-300 hover:text-amber-400 hover:bg-white/10'
          }`}
          title="Meus Favoritos"
        >
          <Star size={18} />
        </button>

        {/* Menu do Perfil Ativo */}
        {activeProfile && (
          <div ref={profileMenuRef} className="relative">
            <button
              type="button"
              id="header-profile-btn"
              tabIndex={0}
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 p-1 rounded-full hover:bg-white/10 transition focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-500 cursor-pointer"
              title="Menu do Perfil"
            >
              <Avatar id={activeProfile.avatar} size={30} className="shadow" />
            </button>


            {/* Dropdown do Perfil */}
            {showProfileMenu && (
              <div
                data-tv-modal="true"
                tabIndex={-1}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' || e.keyCode === 27 || e.keyCode === 4 || e.keyCode === 10009) {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowProfileMenu(false)
                    document.getElementById('header-profile-btn')?.focus()
                  }
                }}
                className="absolute right-0 mt-2 w-56 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-2xl p-2 shadow-2xl z-50 fade-up space-y-1 outline-none"
              >
                <div className="px-3 py-2 border-b border-zinc-800 flex items-center gap-2.5">
                  <Avatar id={activeProfile.avatar} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-zinc-100 truncate">{activeProfile.name}</p>
                    <p className="text-[10px] text-zinc-500 truncate">{activeServer?.name}</p>
                  </div>
                </div>

                <button
                  id="profile-menu-first-item"
                  tabIndex={0}
                  onClick={() => {
                    setShowProfileMenu(false)
                    leaveProfile()
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 focus:bg-zinc-800 focus:text-white focus:ring-2 focus:ring-rose-500 focus:outline-none transition"
                >
                  <Users size={15} className="text-rose-400" />
                  <span>Trocar Perfil</span>
                </button>

                <button
                  tabIndex={0}
                  onClick={() => {
                    setShowProfileMenu(false)
                    onOpenEditProfile()
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 focus:bg-zinc-800 focus:text-white focus:ring-2 focus:ring-rose-500 focus:outline-none transition"
                >
                  <Settings size={15} className="text-zinc-400" />
                  <span>Configurações</span>
                </button>

                <div className="border-t border-zinc-800/80 my-1 pt-1" />

                <button
                  tabIndex={0}
                  onClick={() => {
                    setShowProfileMenu(false)
                    openManager()
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 focus:bg-zinc-800 focus:text-white focus:ring-2 focus:ring-rose-500 focus:outline-none transition"
                >
                  <ListVideo size={15} className="text-zinc-400" />
                  <span>Gerenciar Listas IPTV</span>
                </button>

                <button
                  tabIndex={0}
                  onClick={() => {
                    setShowProfileMenu(false)
                    logout()
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-rose-400 focus:bg-zinc-800 focus:text-rose-400 focus:ring-2 focus:ring-rose-500 focus:outline-none transition"
                >
                  <LogOut size={15} className="text-rose-400" />
                  <span>Sair da Lista</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}

export default memo(PrimeHeaderBase)
