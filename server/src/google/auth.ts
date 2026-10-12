import type { Db } from '../db.js'
import { isMock } from '../mock.js'

/**
 * OAuth 2.0 con Google, a mano y con `fetch` (sin la librería googleapis):
 * son cuatro llamadas HTTP y así el panel no arrastra dependencias.
 *
 * El modelo es "installed app": el redirect va a un puerto de loopback, así que
 * el consentimiento se puede completar desde el propio dispositivo (o desde el
 * equipo de desarrollo, copiando luego el refresh_token a la Pi).
 */

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo'
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke'

/** Mínimo imprescindible: leer calendario, leer tareas y saber qué cuenta es. */
export const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/tasks.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
]

export class GoogleNotConfiguredError extends Error {
  readonly code = 'google_not_configured'
  constructor() {
    super('Faltan las credenciales de la app de Google (client_id/client_secret)')
    this.name = 'GoogleNotConfiguredError'
  }
}

export class GoogleNotConnectedError extends Error {
  readonly code = 'google_not_connected'
  constructor(message = 'Ninguna cuenta de Google autorizada todavía') {
    super(message)
    this.name = 'GoogleNotConnectedError'
  }
}

export class GoogleAuthError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'GoogleAuthError'
    this.code = code
  }
}

export interface GoogleApp {
  clientId: string
  clientSecret: string
}

export interface GoogleAccount {
  email: string | null
  scope: string | null
  obtainedAt: number
  updatedAt: number
}

export interface TokenSet {
  access_token: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
}

function row<T>(value: unknown): T | undefined {
  return value as T | undefined
}

/** Credenciales de la app: primero el entorno, si no la base de datos local. */
export function getApp(db: Db): GoogleApp | null {
  const envId = process.env.GOOGLE_CLIENT_ID?.trim()
  const envSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  if (envId && envSecret) return { clientId: envId, clientSecret: envSecret }

  const stored = row<{ client_id: string; client_secret: string }>(
    db.prepare('SELECT client_id, client_secret FROM google_app WHERE id = 1').get(),
  )
  if (!stored) return null
  return { clientId: stored.client_id, clientSecret: stored.client_secret }
}

export function setApp(db: Db, app: GoogleApp): void {
  db.prepare(
    `INSERT INTO google_app (id, client_id, client_secret, updated_at) VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       client_id = excluded.client_id,
       client_secret = excluded.client_secret,
       updated_at = excluded.updated_at`,
  ).run(app.clientId.trim(), app.clientSecret.trim(), Date.now())
}

export function getAccount(db: Db): GoogleAccount | null {
  const stored = row<{
    email: string | null
    scope: string | null
    obtained_at: number
    updated_at: number
  }>(db.prepare('SELECT email, scope, obtained_at, updated_at FROM google_account WHERE id = 1').get())

  if (!stored) return null
  return {
    email: stored.email,
    scope: stored.scope,
    obtainedAt: Number(stored.obtained_at),
    updatedAt: Number(stored.updated_at),
  }
}

export function saveTokens(db: Db, tokens: TokenSet, email?: string | null): void {
  const now = Date.now()
  const expiresAt = tokens.expires_in ? now + tokens.expires_in * 1000 : null

  db.prepare(
    `INSERT INTO google_account
       (id, email, refresh_token, access_token, access_expires_at, scope, token_type, obtained_at, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       email             = COALESCE(excluded.email, google_account.email),
       -- solo se pisa el refresh_token si Google manda uno nuevo
       refresh_token     = COALESCE(excluded.refresh_token, google_account.refresh_token),
       access_token      = excluded.access_token,
       access_expires_at = excluded.access_expires_at,
       scope             = COALESCE(excluded.scope, google_account.scope),
       token_type        = COALESCE(excluded.token_type, google_account.token_type),
       updated_at        = excluded.updated_at`,
  ).run(
    email ?? null,
    tokens.refresh_token ?? null,
    tokens.access_token,
    expiresAt,
    tokens.scope ?? null,
    tokens.token_type ?? null,
    now,
    now,
  )
}

export function clearAccount(db: Db): void {
  db.prepare('DELETE FROM google_account WHERE id = 1').run()
}

/** URL de consentimiento. `redirectUri` debe ser de loopback (http://127.0.0.1:puerto/...). */
export function buildAuthUrl(
  app: GoogleApp,
  redirectUri: string,
  state: string,
  scopes: string[] = SCOPES,
): string {
  const url = new URL(AUTH_ENDPOINT)
  url.searchParams.set('client_id', app.clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', scopes.join(' '))
  // offline + consent: sin esto Google no devuelve refresh_token
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('include_granted_scopes', 'true')
  url.searchParams.set('state', state)
  return url.toString()
}

async function postToken(body: Record<string, string>): Promise<TokenSet> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  })

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) {
    const code = typeof data.error === 'string' ? data.error : `http_${response.status}`
    const description =
      typeof data.error_description === 'string' ? data.error_description : 'Error de Google'
    throw new GoogleAuthError(code, `${code}: ${description}`)
  }
  return data as unknown as TokenSet
}

export function exchangeCode(app: GoogleApp, code: string, redirectUri: string): Promise<TokenSet> {
  return postToken({
    client_id: app.clientId,
    client_secret: app.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  })
}

export function refreshAccessToken(app: GoogleApp, refreshToken: string): Promise<TokenSet> {
  return postToken({
    client_id: app.clientId,
    client_secret: app.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })
}

/** email de la cuenta autorizada (para poder enseñarla en el estado del panel). */
export async function fetchAccountEmail(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch(USERINFO_ENDPOINT, {
      headers: { authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return null
    const data = (await response.json()) as { email?: string }
    return data.email ?? null
  } catch {
    return null
  }
}

/**
 * Devuelve un access_token válido, refrescándolo si está a punto de caducar.
 * El refresh_token se guarda en SQLite; aquí no hay intervención humana.
 */
export async function getAccessToken(db: Db): Promise<string> {
  const app = getApp(db)
  if (!app) throw new GoogleNotConfiguredError()

  const stored = row<{
    refresh_token: string
    access_token: string | null
    access_expires_at: number | null
  }>(
    db
      .prepare('SELECT refresh_token, access_token, access_expires_at FROM google_account WHERE id = 1')
      .get(),
  )
  if (!stored) throw new GoogleNotConnectedError()

  const now = Date.now()
  const fresh = stored.access_expires_at !== null && Number(stored.access_expires_at) > now + 60_000
  if (stored.access_token && fresh) return stored.access_token

  let tokens: TokenSet
  try {
    tokens = await refreshAccessToken(app, stored.refresh_token)
  } catch (error) {
    if (error instanceof GoogleAuthError && error.code === 'invalid_grant') {
      throw new GoogleAuthError('invalid_grant', 'La autorización caducó o se revocó: hay que volver a conectar la cuenta')
    }
    throw error
  }

  saveTokens(db, { ...tokens, refresh_token: tokens.refresh_token ?? stored.refresh_token })
  return tokens.access_token
}

export function revokeAccount(db: Db): Promise<Response | null> {
  const stored = row<{ refresh_token: string }>(
    db.prepare('SELECT refresh_token FROM google_account WHERE id = 1').get(),
  )
  clearAccount(db)
  if (!stored) return Promise.resolve(null)
  return fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(stored.refresh_token)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  }).catch(() => null)
}

export interface GoogleStatus {
  configured: boolean
  connected: boolean
  email: string | null
  scope: string | null
  mock: boolean
}

export function googleStatus(db: Db): GoogleStatus {
  const account = getAccount(db)
  return {
    configured: getApp(db) !== null,
    connected: account !== null,
    email: account?.email ?? null,
    scope: account?.scope ?? null,
    mock: isMock(),
  }
}

/** Datos simulados: SOLO si alguien pone DASH_MOCK=1 a propósito. */
export { isMock } from '../mock.js'
