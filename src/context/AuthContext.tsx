import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { XtreamService, type Credentials } from '../services/xtreamService'

const PROFILES_KEY = 'iptv-rea:profiles'
const ACTIVE_KEY = 'iptv-rea:active-profile'
const LEGACY_KEY = 'iptv-rea:credentials'

export interface Profile extends Credentials {
  id: string
  name: string
}

interface AuthContextValue {
  profiles: Profile[]
  /** Lista ativa (null = nenhuma selecionada) */
  active: Profile | null
  /** Compatibilidade: credenciais da lista ativa */
  credentials: Credentials | null
  service: XtreamService | null
  /** true quando o Gerenciador de Listas deve ser exibido */
  managerOpen: boolean
  openManager: () => void
  closeManager: () => void
  /** Valida a conexão e salva a nova lista (não ativa automaticamente se activate=false) */
  addProfile: (p: Omit<Profile, 'id'>, activate?: boolean) => Promise<void>
  updateProfile: (p: Profile) => Promise<void>
  removeProfile: (id: string) => void
  selectProfile: (id: string) => void
  /** Sai da lista ativa (mantém as listas salvas) */
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

function loadProfiles(): Profile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY)
    if (raw) return JSON.parse(raw) as Profile[]
    // Migra credencial única da versão anterior
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      const c = JSON.parse(legacy) as Credentials
      const p: Profile = { ...c, id: newId(), name: 'Minha Lista' }
      localStorage.setItem(PROFILES_KEY, JSON.stringify([p]))
      localStorage.setItem(ACTIVE_KEY, p.id)
      localStorage.removeItem(LEGACY_KEY)
      return [p]
    }
  } catch { /* ignora */ }
  return []
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>(loadProfiles)
  const [activeId, setActiveId] = useState<string | null>(() => {
    const saved = localStorage.getItem(ACTIVE_KEY)
    if (saved) return saved
    const list = loadProfiles()
    if (list.length > 0) {
      try { localStorage.setItem(ACTIVE_KEY, list[0].id) } catch {}
      return list[0].id
    }
    return null
  })
  const [managerOpen, setManagerOpen] = useState(false)

  const active = useMemo(() => {
    if (profiles.length === 0) return null
    return profiles.find((p) => p.id === activeId) ?? profiles[0]
  }, [profiles, activeId])
  const service = useMemo(() => (active ? new XtreamService(active) : null), [active])

  const persist = (list: Profile[]) => {
    setProfiles(list)
    localStorage.setItem(PROFILES_KEY, JSON.stringify(list))
  }
  const setActive = (id: string | null) => {
    setActiveId(id)
    if (id) localStorage.setItem(ACTIVE_KEY, id)
    else localStorage.removeItem(ACTIVE_KEY)
  }

  const addProfile: AuthContextValue['addProfile'] = async (p, activate = true) => {
    await new XtreamService(p).authenticate() // lança erro se inválido
    const profile: Profile = { ...p, id: newId() }
    persist([...profiles, profile])
    if (activate) {
      setActive(profile.id)
      setManagerOpen(false)
    }
  }

  const updateProfile: AuthContextValue['updateProfile'] = async (p) => {
    await new XtreamService(p).authenticate()
    persist(profiles.map((x) => (x.id === p.id ? p : x)))
  }

  const removeProfile = (id: string) => {
    persist(profiles.filter((p) => p.id !== id))
    if (id === activeId) setActive(null)
  }

  const selectProfile = (id: string) => {
    setActive(id)
    setManagerOpen(false)
  }

  const logout = () => {
    setActive(null)
    setManagerOpen(false)
  }

  return (
    <AuthContext.Provider
      value={{
        profiles, active, credentials: active, service, managerOpen,
        openManager: () => setManagerOpen(true),
        closeManager: () => setManagerOpen(false),
        addProfile, updateProfile, removeProfile, selectProfile, logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fora do AuthProvider')
  return ctx
}
