import { getOrFetch } from '../cache.js'
import { LOCATIONS_TTL_MS } from '../config.js'
import type { Db } from '../db.js'
import { isMock } from '../mock.js'
import { mockPeople } from './mock.js'

/** Una persona que comparte su ubicación con la cuenta del panel. */
export interface LocationPerson {
  name: string
  /** Dirección legible, si la fuente la da (Google suele darla). */
  address: string | null
  latitude: number
  longitude: number
  /** ISO 8601 de cuándo se supo esa posición (no de cuándo se preguntó). */
  updatedAt: string
  /** Precisión en metros, si la fuente la da. */
  accuracy: number | null
  battery: number | null
  charging: boolean | null
}

/** Por qué no hay ubicaciones que enseñar. */
export interface LocationReason {
  error: string
  message: string
}

export interface LocationsSnapshot {
  people: LocationPerson[]
  reason: LocationReason | null
  meta: {
    source: string
    cached: boolean
    stale: boolean
    fetchedAt: string
    expiresAt: string
    ttlSeconds: number
  } | null
}

const CACHE_KEY = 'locations'

/**
 * Dónde está la familia.
 *
 * Aviso para quien lo toque: **Google no tiene API** para leer las ubicaciones
 * compartidas de otros usuarios. La única vía que existe es reutilizar la sesión
 * del navegador (las cookies `__Secure-1PSID` y compañía) contra su servicio
 * interno, que es lo que hacen Home Assistant y las librerías tipo
 * `locationsharinglib`; la cookie caduca y hay que renovarla de vez en cuando. Las
 * ubicaciones de Family Link son, por debajo, las mismas de Google Maps (Google lo
 * documenta así al explicar la supervisión parental), así que esta vía las cubre
 * todas.
 *
 * Mientras eso no esté probado contra una cuenta de verdad, aquí se contesta con
 * el motivo en vez de con un mapa vacío: un mapa sin nadie encima parece una
 * avería. Con `DASH_MOCK=1` sí devuelve gente (de mentira) para poder probar el
 * widget de punta a punta sin credenciales de nadie.
 */
export async function getLocations(
  db: Db,
  options: { refresh?: boolean } = {},
): Promise<LocationsSnapshot> {
  if (!isMock()) {
    return {
      people: [],
      reason: {
        error: 'sin_conectar',
        message: 'Google no da API para leer las ubicaciones compartidas',
      },
      meta: null,
    }
  }

  if (options.refresh) db.prepare('DELETE FROM cache WHERE key = ?').run(CACHE_KEY)

  const cache = await getOrFetch(db, CACHE_KEY, LOCATIONS_TTL_MS, async () => mockPeople(), 'mock')

  return {
    people: cache.value,
    reason: null,
    meta: {
      source: 'mock',
      cached: cache.cached,
      stale: cache.stale,
      fetchedAt: new Date(cache.fetchedAt).toISOString(),
      expiresAt: new Date(cache.expiresAt).toISOString(),
      ttlSeconds: Math.round((cache.expiresAt - cache.fetchedAt) / 1000),
    },
  }
}
