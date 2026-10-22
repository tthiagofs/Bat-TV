import { useState, useEffect, useDeferredValue, Suspense, lazy } from 'react'
import type { Section } from '../../types'
import { useProfiles } from '../../context/ProfileContext'
import { trailerCoordinator } from '../../services/trailerCoordinator'
import MobileTopBar from './MobileTopBar'
import MobileNavBar from './MobileNavBar'
import MobileHome from './MobileHome'
import MobileMyProfile from './MobileMyProfile'
import Browse from '../../pages/Browse'
import SportsHub from '../../pages/SportsHub'
import Downloads from '../../pages/Downloads'
import ErrorBoundary from '../ErrorBoundary'

const ProfileEditModal = lazy(() => import('../ProfileEditModal'))

export default function MobileShell() {
  const { active: profile } = useProfiles()
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine)

  const [section, setSection] = useState<Section | 'my-netflix'>(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return 'downloads'
    return 'home'
  })
  const [search, setSearch] = useState('')
  const [showEditProfileModal, setShowEditProfileModal] = useState(false)

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

  const handleSelectSection = (s: Section | 'my-netflix') => {
    trailerCoordinator.stopAll()
    setSection(s)
    setSearch('')
  }

  const query = useDeferredValue(search)

  return (
    <div className="h-full w-full flex flex-col bg-black text-white overflow-hidden relative select-none">
      {/* 1. Barra Superior estilo Netflix Mobile */}
      <MobileTopBar
        activeSection={section === 'my-netflix' ? 'home' : section}
        onSelectSection={handleSelectSection}
        search={search}
        onSearchChange={setSearch}
        onOpenProfile={() => setSection('my-netflix')}
      />

      {/* 2. Conteúdo Principal */}
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col relative">
        <ErrorBoundary>
          {search ? (
            <div className="flex-1 min-h-0 flex flex-col pb-20 pt-[max(env(safe-area-inset-top),4rem)]">
              <Browse
                section={
                  section === 'home' || section === 'sports' || section === 'downloads' || section === 'my-netflix'
                    ? 'movies'
                    : section
                }
                query={query}
              />
            </div>
          ) : (
            <>
              {section === 'home' && <MobileHome onNavigate={handleSelectSection} />}

              {section === 'movies' && (
                <div className="flex-1 min-h-0 flex flex-col pb-20">
                  <Browse section="movies" query="" />
                </div>
              )}

              {section === 'series' && (
                <div className="flex-1 min-h-0 flex flex-col pb-20">
                  <Browse section="series" query="" />
                </div>
              )}

              {section === 'sports' && (
                <div className="flex-1 min-h-0 flex flex-col pb-20">
                  <SportsHub onNavigate={handleSelectSection} />
                </div>
              )}

              {section === 'live' && (
                <div className="flex-1 min-h-0 flex flex-col pb-20 pt-[max(env(safe-area-inset-top),3.5rem)]">
                  <Browse section="live" query="" />
                </div>
              )}

              {section === 'favorites' && (
                <div className="flex-1 min-h-0 flex flex-col pb-20">
                  <Browse section="favorites" query="" />
                </div>
              )}

              {section === 'downloads' && (
                <div className="flex-1 min-h-0 flex flex-col pb-20 pt-[max(env(safe-area-inset-top),4rem)]">
                  <Downloads onNavigate={handleSelectSection} />
                </div>
              )}

              {section === 'my-netflix' && (
                <div className="flex-1 min-h-0 flex flex-col pb-20 pt-[max(env(safe-area-inset-top),4rem)]">
                  <MobileMyProfile
                    onNavigate={handleSelectSection}
                    onOpenEditProfile={() => setShowEditProfileModal(true)}
                  />
                </div>
              )}
            </>
          )}
        </ErrorBoundary>
      </main>

      {/* 3. Barra Inferior Fixa estilo Netflix Mobile */}
      <MobileNavBar
        activeSection={section}
        onSelectSection={handleSelectSection}
      />

      {/* 4. Modal de Configuração do Perfil */}
      {showEditProfileModal && profile && (
        <Suspense fallback={null}>
          <ProfileEditModal
            profile={profile}
            onClose={() => setShowEditProfileModal(false)}
          />
        </Suspense>
      )}
    </div>
  )
}
