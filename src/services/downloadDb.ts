export interface DownloadedMedia {
  id: string
  mediaType: 'movie' | 'series'
  title: string
  subtitle?: string
  seriesName?: string
  seasonNumber?: number
  episodeNumber?: number
  posterUrl: string
  localPath?: string
  playUrl?: string
  remoteUrl: string
  status: 'queued' | 'downloading' | 'completed' | 'error' | 'paused'
  progress: number
  downloadedBytes: number
  totalBytes: number
  duration: number
  createdAt: number
  completedAt?: number
  error?: string
}

const DB_NAME = 'bat-tv-downloads-db'
const DB_VERSION = 2
const STORE_NAME = 'downloads'
const BLOB_STORE_NAME = 'media_blobs'

let dbPromise: Promise<IDBDatabase> | null = null

function getDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB não suportado neste ambiente'))
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('status', 'status', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
      if (!db.objectStoreNames.contains(BLOB_STORE_NAME)) {
        db.createObjectStore(BLOB_STORE_NAME, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

export async function getAllDownloads(): Promise<DownloadedMedia[]> {
  try {
    const db = await getDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.getAll()
      req.onsuccess = () => {
        const list = (req.result || []) as DownloadedMedia[]
        list.sort((a, b) => (b.completedAt || b.createdAt) - (a.completedAt || a.createdAt))
        resolve(list)
      }
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.error('Erro ao ler downloads do IndexedDB:', err)
    return []
  }
}

export async function getDownload(id: string): Promise<DownloadedMedia | null> {
  try {
    const db = await getDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(id)
      req.onsuccess = () => resolve((req.result as DownloadedMedia) || null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

export async function upsertDownload(item: DownloadedMedia): Promise<void> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.put(item)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function updateDownloadProgress(
  id: string,
  progress: number,
  downloadedBytes: number,
  totalBytes: number
): Promise<void> {
  const item = await getDownload(id)
  if (!item) return
  item.progress = progress
  item.downloadedBytes = downloadedBytes
  if (totalBytes > 0) item.totalBytes = totalBytes
  item.status = 'downloading'
  await upsertDownload(item)
}

export async function markDownloadCompleted(
  id: string,
  localPath: string,
  playUrl: string,
  totalBytes: number
): Promise<void> {
  const item = await getDownload(id)
  if (!item) return
  item.status = 'completed'
  item.progress = 100
  item.localPath = localPath
  item.playUrl = playUrl
  if (totalBytes > 0) item.totalBytes = totalBytes
  item.completedAt = Date.now()
  await upsertDownload(item)
}

export async function markDownloadError(id: string, error: string): Promise<void> {
  const item = await getDownload(id)
  if (!item) return
  item.status = 'error'
  item.error = error
  await upsertDownload(item)
}

export async function saveMediaBlob(id: string, blob: Blob): Promise<void> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE_NAME, 'readwrite')
    const store = tx.objectStore(BLOB_STORE_NAME)
    const req = store.put({ id, blob, size: blob.size, updatedAt: Date.now() })
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function getMediaBlob(id: string): Promise<Blob | null> {
  try {
    const db = await getDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BLOB_STORE_NAME, 'readonly')
      const store = tx.objectStore(BLOB_STORE_NAME)
      const req = store.get(id)
      req.onsuccess = () => {
        const record = req.result
        if (record && record.blob) {
          resolve(record.blob)
        } else {
          resolve(null)
        }
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

export async function deleteMediaBlob(id: string): Promise<void> {
  try {
    const db = await getDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BLOB_STORE_NAME, 'readwrite')
      const store = tx.objectStore(BLOB_STORE_NAME)
      const req = store.delete(id)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch {}
}

export async function deleteDownloadRecord(id: string): Promise<void> {
  await deleteMediaBlob(id).catch(() => {})
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}
