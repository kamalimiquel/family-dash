import type { Db } from './db.js'

export interface CacheHit<T> {
  value: T
  fetchedAt: number
  expiresAt: number
}

export interface CacheResult<T> extends CacheHit<T> {
  /** true = venía de SQLite, no de la red. */
  cached: boolean
  /** true = la red falló y esto es lo último bueno que teníamos. */
  stale: boolean
}

interface CacheRow {
  payload: string
  fetched_at: number
  expires_at: number
}

export function readCache<T>(db: Db, key: string): (CacheHit<T> & { fresh: boolean }) | null {
  const row = db
    .prepare('SELECT payload, fetched_at, expires_at FROM cache WHERE key = ?')
    .get(key) as CacheRow | undefined

  if (!row) return null

  return {
    value: JSON.parse(row.payload) as T,
    fetchedAt: Number(row.fetched_at),
    expiresAt: Number(row.expires_at),
    fresh: Number(row.expires_at) > Date.now(),
  }
}

export function writeCache<T>(
  db: Db,
  key: string,
  value: T,
  ttlMs: number,
  source?: string,
): CacheHit<T> {
  const fetchedAt = Date.now()
  const expiresAt = fetchedAt + ttlMs

  db.prepare(
    `INSERT INTO cache (key, payload, source, fetched_at, expires_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       payload = excluded.payload,
       source = excluded.source,
       fetched_at = excluded.fetched_at,
       expires_at = excluded.expires_at`,
  ).run(key, JSON.stringify(value), source ?? null, fetchedAt, expiresAt)

  return { value, fetchedAt, expiresAt }
}

/**
 * Devuelve el valor cacheado si sigue fresco; si no, llama a `fetcher` y guarda
 * el resultado. Si la red falla pero hay algo cacheado (aunque esté caducado),
 * lo devuelve marcado como `stale` en vez de dejar la pantalla vacía.
 */
export async function getOrFetch<T>(
  db: Db,
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  source?: string,
): Promise<CacheResult<T>> {
  const hit = readCache<T>(db, key)

  if (hit?.fresh) {
    return { value: hit.value, fetchedAt: hit.fetchedAt, expiresAt: hit.expiresAt, cached: true, stale: false }
  }

  try {
    const value = await fetcher()
    const written = writeCache(db, key, value, ttlMs, source)
    return { ...written, cached: false, stale: false }
  } catch (error) {
    if (hit) {
      return { value: hit.value, fetchedAt: hit.fetchedAt, expiresAt: hit.expiresAt, cached: true, stale: true }
    }
    throw error
  }
}
