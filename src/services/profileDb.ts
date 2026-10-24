import type { MediaItem } from '../types'

/**
 * Banco local de perfis — INDEPENDENTE das listas IPTV.
 * Fica em uma chave própria do localStorage (persistido na pasta de dados do Electron).
 * Trocar de lista ou alterar a URL nunca toca nestes dados.
 */
const DB_KEY = 'iptv-rea:profile-db:v1'
const LEGACY_FAVORITES_KEY = 'iptv-rea:favorites'

export const MAX_PROFILES = 6
const MAX_HISTORY = 60
const MAX_SEARCHES = 10

export interface HistoryEntry extends MediaItem {
  position: number // segundos
  duration: number // segundos (0 para ao vivo)
  updatedAt: number
  episode?: { id: string; ext: string; title: string }
}

export interface Profile {
  id: string
  name: string
  avatar: string
  pinHash?: string
  pinSalt?: string
  teamKey?: string // time de coração
  preferredGenres?: string[] // preferências do onboarding (doramas, animes, ação, etc.)
  liteMode?: boolean // Versão Lite (desativa reprodução automática de trailers e otimiza fluidez)
  favorites: MediaItem[]
  history: HistoryEntry[]
  searchHistory: string[]
  settings: Record<string, unknown>
  createdAt: number
}

export interface ProfileDb {
  version: 1
  profiles: Profile[]
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

export function loadDb(): ProfileDb {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) {
      const db = JSON.parse(raw) as ProfileDb
      if (Array.isArray(db.profiles)) return db
    }
  } catch { /* ignora */ }
  return { version: 1, profiles: [] }
}

export function saveDb(db: ProfileDb) {
  try {
    // Sanitiza todos os históricos para garantir que nenhuma imagem base64 exceda o limite de 5MB do localStorage
    const cleanDb: ProfileDb = {
      ...db,
      profiles: (db.profiles || []).map((p) => ({
        ...p,
        history: (p.history || []).map((h) => ({
          ...h,
          image: h.image?.startsWith('data:') ? '' : (h.image || ''),
        })),
        favorites: (p.favorites || []).map((f) => ({
          ...f,
          image: f.image?.startsWith('data:') ? '' : (f.image || ''),
        })),
      })),
    }
    localStorage.setItem(DB_KEY, JSON.stringify(cleanDb))
  } catch (err) {
    console.warn('Erro ao salvar profileDb no localStorage (cota excedida ou restrição de armazenamento):', err)
  }
}

/** Favoritos globais da versão anterior (usados só para o primeiro perfil criado). */
export function takeLegacyFavorites(): MediaItem[] {
  try {
    const raw = localStorage.getItem(LEGACY_FAVORITES_KEY)
    if (!raw) return []
    localStorage.removeItem(LEGACY_FAVORITES_KEY)
    return JSON.parse(raw) as MediaItem[]
  } catch {
    return []
  }
}

export function emptyProfile(name: string, avatar: string, teamKey?: string): Profile {
  return {
    id: newId(), name, avatar, teamKey,
    favorites: [], history: [], searchHistory: [], settings: {},
    createdAt: Date.now(),
  }
}

export function pushHistory(list: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  // Impede que strings base64 gigantescas (posters offline) poluam o profileDb e excedam a cota do localStorage
  const cleanEntry: HistoryEntry = {
    ...entry,
    image: entry.image?.startsWith('data:') ? '' : (entry.image || ''),
  }
  return [cleanEntry, ...list.filter((h) => h.key !== cleanEntry.key)].slice(0, MAX_HISTORY)
}

export function pushSearch(list: string[], q: string): string[] {
  const t = q.trim()
  if (t.length < 2) return list
  return [t, ...list.filter((s) => s.toLowerCase() !== t.toLowerCase())].slice(0, MAX_SEARCHES)
}

// ---- PIN (hash com salt; o PIN nunca é salvo em texto puro) ----
async function sha(text: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return String(h)
}

export async function hashPin(pin: string): Promise<{ pinHash: string; pinSalt: string }> {
  const pinSalt = newId()
  return { pinSalt, pinHash: await sha(pinSalt + pin) }
}

export async function checkPin(p: Profile, pin: string): Promise<boolean> {
  if (!p.pinHash || !p.pinSalt) return true
  return (await sha(p.pinSalt + pin)) === p.pinHash
}
