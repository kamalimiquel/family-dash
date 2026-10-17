/**
 * El saldo de la suscripción de Nous Portal.
 *
 * El portal **no tiene API pública de balance** (está pedida en el repositorio de Hermes y
 * todavía no existe), pero el propio Hermes lee la suscripción con el token de OAuth de la
 * cuenta: `GET /api/billing/subscription`. Aquí se hace lo mismo, con una autorización
 * **propia del panel**: los refresh tokens de Nous son de **un solo uso**, así que compartir
 * el del portátil dejaría fuera a uno de los dos en el primer refresco.
 *
 * La autorización vive en `data/portal-auth.json` (600, fuera del repositorio y del despliegue).
 * Cuando caduca se refresca y se guarda el token nuevo —el anterior queda quemado, de ahí la
 * escritura atómica—. Si el portal no contesta, el panel sigue enseñando la última respuesta
 * buena: un panel de pared no puede quedarse en blanco por un 500 ajeno.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { DATA_DIR, PORTAL_TTL_MS } from './config.js'

const PORTAL_BASE = process.env.PORTAL_BASE ?? 'https://portal.nousresearch.com'
const AUTH_FILE = process.env.PORTAL_AUTH ?? path.join(DATA_DIR, 'portal-auth.json')
const CLIENT_ID = process.env.PORTAL_CLIENT_ID ?? 'hermes-cli'
const CACHE_KEY = 'portal:usage'
const TIMEOUT_MS = 15_000

export interface PortalAuth {
  client_id: string
  access_token: string
  refresh_token: string
  /** Milisegundos (Date.now()) en que caduca el token de acceso. */
  expires_at: number
}

export interface PortalUsage {
  /** ¿Se pudo hablar con el portal en esta pasada? */
  ok: boolean
  plan: string | null
  creditsRemaining: number | null
  monthlyCredits: number | null
  cycleEndsAt: string | null
  fetchedAt: number | null
  /** `true` si lo que se enseña es la última respuesta buena, no una recién pedida. */
  stale: boolean
  error: string | null
}

const vacio = (error: string | null): PortalUsage => ({
  ok: false,
  plan: null,
  creditsRemaining: null,
  monthlyCredits: null,
  cycleEndsAt: null,
  fetchedAt: null,
  stale: false,
  error,
})

/** ¿Hay autorización guardada? (Sin leer el contenido: para el arranque y el health.) */
export function portalConfigured(): boolean {
  try {
    return fs.statSync(AUTH_FILE).size > 0
  } catch {
    return false
  }
}

function readAuth(): PortalAuth | null {
  try {
    const crudo = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8')) as Partial<PortalAuth>
    if (!crudo.access_token || !crudo.refresh_token) return null
    return {
      client_id: crudo.client_id || CLIENT_ID,
      access_token: crudo.access_token,
      refresh_token: crudo.refresh_token,
      expires_at: Number(crudo.expires_at ?? 0),
    }
  } catch {
    return null
  }
}

/**
 * Guarda la autorización. Escribe a un temporal con permisos 600 y lo renombra: si el
 * proceso muere a mitad, no queda un fichero a medias con el único token de refresco.
 */
function writeAuth(auth: PortalAuth): void {
  const temporal = `${AUTH_FILE}.tmp`
  fs.writeFileSync(temporal, JSON.stringify(auth, null, 2), { mode: 0o600 })
  fs.renameSync(temporal, AUTH_FILE)
}

/** Refresca el token. El de refresco es de un solo uso: el que llega sustituye al anterior. */
async function refresh(auth: PortalAuth): Promise<PortalAuth> {
  const cuerpo = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: auth.refresh_token,
    client_id: auth.client_id,
  })

  const respuesta = await fetch(`${PORTAL_BASE}/api/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: cuerpo,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  if (!respuesta.ok) {
    throw new Error(`El portal no quiso refrescar la autorización (HTTP ${respuesta.status})`)
  }

  const datos = (await respuesta.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
  }
  if (!datos.access_token) throw new Error('El portal no devolvió token de acceso')

  const nuevo: PortalAuth = {
    client_id: auth.client_id,
    access_token: datos.access_token,
    // Si no manda uno nuevo, vale el de antes (algunos servidores no rotan siempre).
    refresh_token: datos.refresh_token || auth.refresh_token,
    expires_at: Date.now() + Number(datos.expires_in ?? 3600) * 1000,
  }
  writeAuth(nuevo)
  return nuevo
}

/** Pide la suscripción y se queda con lo que enseña el panel. */
async function fetchSubscription(auth: PortalAuth): Promise<PortalUsage> {
  const respuesta = await fetch(`${PORTAL_BASE}/api/billing/subscription`, {
    headers: { authorization: `Bearer ${auth.access_token}`, accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  if (respuesta.status === 401) {
    // El token murió antes de tiempo: se refresca y se reintenta una vez.
    const renovada = await refresh(auth)
    return fetchSubscription(renovada)
  }
  if (!respuesta.ok) {
    throw new Error(`El portal contestó HTTP ${respuesta.status}`)
  }

  const datos = (await respuesta.json()) as {
    current?: {
      tierName?: string | null
      monthlyCredits?: string | number | null
      creditsRemaining?: string | number | null
      cycleEndsAt?: string | null
    }
  }
  const actual = datos.current ?? {}
  const numero = (valor: string | number | null | undefined): number | null => {
    if (valor === null || valor === undefined || valor === '') return null
    const n = Number(valor)
    return Number.isFinite(n) ? n : null
  }

  return {
    ok: true,
    plan: actual.tierName ?? null,
    creditsRemaining: numero(actual.creditsRemaining),
    monthlyCredits: numero(actual.monthlyCredits),
    cycleEndsAt: actual.cycleEndsAt ?? null,
    fetchedAt: Date.now(),
    stale: false,
    error: null,
  }
}

/** Saldo simulado, para las capturas y las pruebas sin cuenta (nunca activo por defecto). */
function usoSimulado(): PortalUsage {
  return {
    ok: true,
    plan: 'Plus',
    creditsRemaining: 21.49,
    monthlyCredits: 22,
    cycleEndsAt: '2026-11-14T16:17:41.000Z',
    fetchedAt: Date.now(),
    stale: false,
    error: null,
  }
}

/** Lo último bueno que se guardó, aunque esté caducado: es lo que se enseña si falla el portal. */
function leerCache(db: DatabaseSync): PortalUsage | null {
  try {
    const fila = db.prepare('SELECT payload FROM cache WHERE key = ?').get(CACHE_KEY) as
      | { payload: string }
      | undefined
    if (!fila) return null
    const guardado = JSON.parse(fila.payload) as PortalUsage
    return { ...guardado, stale: true, error: 'No se pudo preguntar al portal ahora mismo' }
  } catch {
    return null
  }
}

function guardarCache(db: DatabaseSync, uso: PortalUsage): void {
  const ahora = Date.now()
  try {
    db.prepare(
      `INSERT INTO cache (key, payload, source, fetched_at, expires_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, source = excluded.source,
         fetched_at = excluded.fetched_at, expires_at = excluded.expires_at`,
    ).run(CACHE_KEY, JSON.stringify(uso), 'nous-portal', ahora, ahora + PORTAL_TTL_MS)
  } catch {
    // La caché es una comodidad: si falla, se sirve lo que se acaba de pedir.
  }
}

/** Una sola petición en vuelo a la vez: el panel puede preguntar desde varios sitios. */
let enVuelo: Promise<PortalUsage> | null = null

/**
 * El saldo de la suscripción. Si hay una respuesta reciente en la caché se devuelve esa;
 * si no, se pregunta al portal. Con `force` se pregunta siempre (botón de refrescar).
 */
export function portalUsage(db: DatabaseSync, opciones: { force?: boolean } = {}): Promise<PortalUsage> {
  if (process.env.DASH_MOCK === '1') return Promise.resolve(usoSimulado())
  if (enVuelo) return enVuelo

  const auth = readAuth()
  if (!auth) return Promise.resolve(vacio('sin_autorizacion'))

  const tarea = (async (): Promise<PortalUsage> => {
    try {
      if (!opciones.force) {
        const fila = db
          .prepare('SELECT payload, expires_at FROM cache WHERE key = ?')
          .get(CACHE_KEY) as { payload: string; expires_at: number } | undefined
        if (fila && Number(fila.expires_at) > Date.now()) {
          const guardado = JSON.parse(fila.payload) as PortalUsage
          return { ...guardado, stale: false }
        }
      }

      // Refrescar por adelantado si ya caducó (o caduca en el próximo minuto).
      const vigente = auth.expires_at && auth.expires_at - 60_000 > Date.now() ? auth : await refresh(auth)
      const uso = await fetchSubscription(vigente)
      guardarCache(db, uso)
      return uso
    } catch (error) {
      const ultimo = leerCache(db)
      if (ultimo) return { ...ultimo, error: error instanceof Error ? error.message : String(error) }
      return vacio(error instanceof Error ? error.message : String(error))
    } finally {
      enVuelo = null
    }
  })()

  enVuelo = tarea
  return tarea
}
