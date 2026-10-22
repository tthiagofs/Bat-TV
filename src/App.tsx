import { lazy, Suspense, useDeferredValue, useState, useEffect } from 'react'
import { trailerCoordinator } from './services/trailerCoordinator'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ProfileProvider, useProfiles } from './context/ProfileContext'
import { PlaybackProvider } from './context/PlaybackContext'
import Login from './pages/Login'
import ProfilesScreen from './pages/ProfilesScreen'
import Home from './pages/Home'
import PrimeHeader from './components/PrimeHeader'
import ErrorBoundary from './components/ErrorBoundary'
import { useDpadNavigation } from './hooks/useDpadNavigation'
import type { Section } from './types'

import Browse from './pages/Browse'
import SportsHub from './pages/SportsHub'
import Downloads from './pages/Downloads'
import { useIsMobile } from './hooks/useIsMobile'
import MobileShell from './components/mobile/MobileShell'

const ProfileEditModal = lazy(() => import('./components/ProfileEditModal'))

const ScreenFallback = () => (
  <div className="flex-1 flex items-center justify-center">
    <div className="h-8 w-8 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
  </div>
)

function Shell() {
  const { active: activeServer, managerOpen } = useAuth()
  const { active: activeProfile } = useProfiles()
  const isMobile = useIsMobile(768)

  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine)
  const [section, setSection] = useState<Section>(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return 'downloads'
    return 'home'
  })
  const [search, setSearch] = useState('')
  const [showEditProfileModal, setShowEditProfileModal] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  const [visitedSections, setVisitedSections] = useState<Set<Section>>(
    () => new Set([typeof navigator !== 'undefined' && !navigator.onLine ? 'downloads' : 'home'])
  )

  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true)
      setSection('downloads')
    }
    const handleOnline = () => {
      setIsOffline(false)
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOffline(true)
      setSection('downloads')
    }

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  const handleSelectSection = (s: Section) => {
    trailerCoordinator.stopAll()
    setVisitedSections((prev) => {
      if (prev.has(s)) return prev
      const next = new Set(prev)
      next.add(s)
      return next
    })
    setSection(s)
    setSearch('')
    setIsScrolled(false)
  }

  // Interrompe imediatamente qualquer trailer ao trocar de aba no app
  useEffect(() => {
    trailerCoordinator.stopAll()
  }, [section])

  // Habilita navegação espacial D-Pad (setas do controle remoto / teclado) em toda a interface
  useDpadNavigation({
    onBack: () => {
      if (showEditProfileModal) setShowEditProfileModal(false)
      else if (search) setSearch('')
      else if (section !== 'home') handleSelectSection('home')
    },
  })

  // Trata o botão Voltar do controle remoto de TVs (Fire TV, Android TV)
  useEffect(() => {
    const handleTvBack = (e: Event) => {
      if (search) {
        e.preventDefault()
        setSearch('')
        return
      }
      if (showEditProfileModal) {
        e.preventDefault()
        setShowEditProfileModal(false)
        return
      }
      if (section !== 'home') {
        e.preventDefault()
        handleSelectSection('home')
        return
      }
    }

    window.addEventListener('tvHardwareBack', handleTvBack)
    return () => window.removeEventListener('tvHardwareBack', handleTvBack)
  }, [search, showEditProfileModal, section])

  const query = useDeferredValue(search)

  // 1. Se estiver offline, prioriza abrir direto a tela de downloads no Mobile ou Desktop
  if (isOffline) {
    if (isMobile) {
      return <MobileShell />
    }
    return (
      <div className="h-full w-full flex flex-col bg-zinc-950 overflow-hidden text-zinc-100">
        <Downloads />
      </div>
    )
  }

  // 2. Se nenhuma lista Xtream estiver conectada, mostra Gerenciador de Listas
  if (!activeServer || managerOpen) {
    return <Login />
  }

  // 3. Se nenhum perfil foi selecionado para a sessão, mostra a tela "Quem está assistindo?"
  if (!activeProfile) {
    return <ProfilesScreen />
  }

  // 3. Em celulares e visualização vertical mobile (< 768px), carrega a casca estilo Netflix Mobile
  if (isMobile) {
    return <MobileShell />
  }

  return (
    <div className="h-full w-full flex flex-col bg-zinc-950 overflow-hidden relative text-zinc-100">
      {/* 1. Cabeçalho Superior Fixo no Padrão Amazon Prime Video */}
      <PrimeHeader
        activeSection={section}
        onSelectSection={handleSelectSection}
        search={search}
        onSearchChange={setSearch}
        isScrolled={isScrolled}
        onOpenEditProfile={() => setShowEditProfileModal(true)}
      />

      {/* 2. Área de Conteúdo Principal (100% Widescreen com Keep-Alive) */}
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col relative">
        <ErrorBoundary>
          <Suspense fallback={<ScreenFallback />}>
            {search ? (
              <div className="flex-1 min-h-0 pt-16 flex flex-col">
                <Browse
                  section={
                    section === 'home' || section === 'sports' || section === 'downloads'
                      ? 'movies'
                      : section
                  }
                  query={query}
                />
              </div>
            ) : (
              <>
                {visitedSections.has('home') && (
                  <div
                    style={{ display: section === 'home' ? 'flex' : 'none' }}
                    className={`flex-1 min-h-0 flex-col ${section === 'home' ? 'flex' : 'hidden'}`}
                  >
                    <Home onNavigate={handleSelectSection} onScrollChange={setIsScrolled} isActive={section === 'home'} />
                  </div>
                )}
                {visitedSections.has('movies') && (
                  <div
                    style={{ display: section === 'movies' ? 'flex' : 'none' }}
                    className={`flex-1 min-h-0 flex-col ${section === 'movies' ? 'flex' : 'hidden'}`}
                  >
                    <Browse
                      section="movies"
                      query=""
                      isActive={section === 'movies'}
                      onScrollChange={setIsScrolled}
                    />
                  </div>
                )}
                {visitedSections.has('series') && (
                  <div
                    style={{ display: section === 'series' ? 'flex' : 'none' }}
                    className={`flex-1 min-h-0 flex-col ${section === 'series' ? 'flex' : 'hidden'}`}
                  >
                    <Browse
                      section="series"
                      query=""
                      isActive={section === 'series'}
                      onScrollChange={setIsScrolled}
                    />
                  </div>
                )}
                {visitedSections.has('sports') && (
                  <div
                    style={{ display: section === 'sports' ? 'flex' : 'none' }}
                    className={`flex-1 min-h-0 flex-col ${section === 'sports' ? 'flex' : 'hidden'}`}
                  >
                    <SportsHub onNavigate={handleSelectSection} />
                  </div>
                )}
                {visitedSections.has('live') && (
                  <div
                    style={{ display: section === 'live' ? 'flex' : 'none' }}
                    className={`flex-1 min-h-0 flex-col pt-16 ${section === 'live' ? 'flex' : 'hidden'}`}
                  >
                    <Browse section="live" query="" />
                  </div>
                )}
                {visitedSections.has('favorites') && (
                  <div
                    style={{ display: section === 'favorites' ? 'flex' : 'none' }}
                    className={`flex-1 min-h-0 flex-col pt-16 ${section === 'favorites' ? 'flex' : 'hidden'}`}
                  >
                    <Browse section="favorites" query="" />
                  </div>
                )}
                {visitedSections.has('downloads') && (
                  <div
                    style={{ display: section === 'downloads' ? 'flex' : 'none' }}
                    className={`flex-1 min-h-0 flex-col pt-16 ${section === 'downloads' ? 'flex' : 'hidden'}`}
                  >
                    <Downloads onNavigate={handleSelectSection} />
                  </div>
                )}
              </>
            )}
          </Suspense>
        </ErrorBoundary>
      </main>

      {/* Modal de Configuração do Perfil */}
      {showEditProfileModal && (
        <Suspense fallback={null}>
          <ProfileEditModal
            profile={activeProfile}
            onClose={() => setShowEditProfileModal(false)}
          />
        </Suspense>
      )}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <PlaybackProvider>
          <Shell />
        </PlaybackProvider>
      </ProfileProvider>
    </AuthProvider>
  )
}
