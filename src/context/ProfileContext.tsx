import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  MAX_PROFILES, checkPin, emptyProfile, hashPin, loadDb, pushHistory, pushSearch, saveDb, takeLegacyFavorites,
  type HistoryEntry, type Profile, type ProfileDb,
} from '../services/profileDb'
import type { MediaItem } from '../types'

interface ProfileInput {
  name: string
  avatar: string
  teamKey?: string
  pin?: string
  preferredGenres?: string[]
}

interface Actions {
  select: (id: string) => void
  leave: () => void
  verifyPin: (id: string, pin: string) => Promise<boolean>
  create: (input: ProfileInput) => Promise<Profile | null>
  update: (id: string, patch: { name?: string; avatar?: string; teamKey?: string | null; preferredGenres?: string[]; liteMode?: boolean }) => void
  setPin: (id: string, pin: string | null) => Promise<void>
  remove: (id: string) => void
  toggleFavorite: (item: MediaItem) => void
  upsertHistory: (entry: HistoryEntry) => void
  clearHistory: () => void
  addSearch: (q: string) => void
  removeSearch: (q: string) => void
  clearSearchHistory: () => void
}

interface ProfileContextValue extends Actions {
  profiles: Profile[]
  active: Profile | null
  canCreate: boolean
}

const Ctx = createContext<ProfileContextValue | null>(null)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<ProfileDb>(loadDb)
  // O perfil ativo vale só para a sessão: ao abrir o app aparece "Quem está assistindo?"
  const [activeId, setActiveId] = useState<string | null>(null)

  const dbRef = useRef(db)
  const activeRef = useRef(activeId)
  dbRef.current = db
  activeRef.current = activeId

  useEffect(() => { saveDb(db) }, [db])

  const patchProfile = useCallback((id: string, fn: (p: Profile) => Profile) => {
    setDb((d) => ({ ...d, profiles: d.profiles.map((p) => (p.id === id ? fn(p) : p)) }))
  }, [])

  // Ações com identidade estável (não re-renderizam as grades a cada atualização de histórico)
  const actions = useMemo<Actions>(() => {
    const withActive = (fn: (p: Profile) => Profile) => {
      if (activeRef.current) patchProfile(activeRef.current, fn)
    }
    return {
      select: setActiveId,
      leave: () => setActiveId(null),
      verifyPin: async (id, pin) => {
        const p = dbRef.current.profiles.find((x) => x.id === id)
        return p ? checkPin(p, pin) : false
      },
      create: async ({ name, avatar, teamKey, pin, preferredGenres }) => {
        if (dbRef.current.profiles.length >= MAX_PROFILES) return null
        const p = emptyProfile(name.trim(), avatar, teamKey)
        if (preferredGenres) p.preferredGenres = preferredGenres
        if (dbRef.current.profiles.length === 0) p.favorites = takeLegacyFavorites()
        if (pin) Object.assign(p, await hashPin(pin))
        setDb((d) => ({ ...d, profiles: [...d.profiles, p] }))
        return p
      },
      update: (id, patch) =>
        patchProfile(id, (p) => ({
          ...p,
          ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
          ...(patch.avatar !== undefined ? { avatar: patch.avatar } : {}),
          ...(patch.teamKey !== undefined ? { teamKey: patch.teamKey ?? undefined } : {}),
          ...(patch.preferredGenres !== undefined ? { preferredGenres: patch.preferredGenres } : {}),
          ...(patch.liteMode !== undefined ? { liteMode: patch.liteMode } : {}),
        })),
      setPin: async (id, pin) => {
        if (pin) {
          const h = await hashPin(pin)
          patchProfile(id, (p) => ({ ...p, ...h }))
        } else {
          patchProfile(id, (p) => ({ ...p, pinHash: undefined, pinSalt: undefined }))
        }
      },
      remove: (id) => {
        setDb((d) => ({ ...d, profiles: d.profiles.filter((p) => p.id !== id) }))
        setActiveId((a) => (a === id ? null : a))
      },
      toggleFavorite: (item) =>
        withActive((p) => ({
          ...p,
          favorites: p.favorites.some((f) => f.key === item.key)
            ? p.favorites.filter((f) => f.key !== item.key)
            : [...p.favorites, item],
        })),
      upsertHistory: (entry) => withActive((p) => ({ ...p, history: pushHistory(p.history, entry) })),
      clearHistory: () => withActive((p) => ({ ...p, history: [] })),
      addSearch: (q) => withActive((p) => ({ ...p, searchHistory: pushSearch(p.searchHistory, q) })),
      removeSearch: (q) => withActive((p) => ({ ...p, searchHistory: p.searchHistory.filter((s) => s !== q) })),
      clearSearchHistory: () => withActive((p) => ({ ...p, searchHistory: [] })),
    }
  }, [patchProfile])

  const active = useMemo(() => db.profiles.find((p) => p.id === activeId) ?? null, [db, activeId])

  const value = useMemo<ProfileContextValue>(
    () => ({ ...actions, profiles: db.profiles, active, canCreate: db.profiles.length < MAX_PROFILES }),
    [actions, db.profiles, active],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useProfiles() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useProfiles fora do ProfileProvider')
  return ctx
}
