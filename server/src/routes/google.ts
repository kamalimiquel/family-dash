import crypto from 'node:crypto'
import { Router, type NextFunction, type Request, type Response } from 'express'
import type { Db } from '../db.js'
import {
  buildAuthUrl,
  exchangeCode,
  fetchAccountEmail,
  getApp,
  getAccount,
  googleStatus,
  revokeAccount,
  saveTokens,
  setApp,
} from '../google/auth.js'

/** Solo desde la propia máquina: aquí se manejan secretos y tokens. */
export function requireLoopback(req: Request, res: Response, next: NextFunction): void {
  const address = req.socket.remoteAddress ?? ''
  const local =
    address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1' || address === ''
  if (!local) {
    res.status(403).json({
      error: 'local_only',
      message: 'Este endpoint solo se puede usar desde la propia máquina (por SSH, con curl a localhost)',
    })
    return
  }
  next()
}

/** El redirect tiene que ser de loopback: es el flujo de app instalada de Google. */
function validRedirect(uri: string): boolean {
  try {
    const url = new URL(uri)
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      (url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]')
    )
  } catch {
    return false
  }
}

export function createGoogleRouter(db: Db): Router {
  const router = Router()

  /** Estado pendiente del consentimiento (un solo usuario, un solo flujo). */
  let pendingState: string | null = null

  router.get('/google/status', (_req, res) => {
    res.set('Cache-Control', 'no-store')
    res.json(googleStatus(db))
  })

  router.post('/google/app', requireLoopback, (req, res) => {
    const body = req.body as { client_id?: unknown; client_secret?: unknown } | undefined
    const clientId = typeof body?.client_id === 'string' ? body.client_id.trim() : ''
    const clientSecret = typeof body?.client_secret === 'string' ? body.client_secret.trim() : ''

    if (!clientId || !clientSecret) {
      res.status(400).json({ error: 'bad_request', message: 'Faltan client_id o client_secret' })
      return
    }
    if (!clientId.endsWith('.apps.googleusercontent.com')) {
      res.status(400).json({
        error: 'invalid_client_id',
        message: 'Un client_id de Google termina en .apps.googleusercontent.com',
      })
      return
    }

    setApp(db, { clientId, clientSecret })
    res.json(googleStatus(db))
  })

  router.get('/google/auth-url', requireLoopback, (req, res) => {
    const app = getApp(db)
    if (!app) {
      res.status(409).json({
        error: 'google_not_configured',
        message: 'Primero manda el client_id y el client_secret a POST /api/google/app',
      })
      return
    }

    const redirectUri = typeof req.query.redirect_uri === 'string' ? req.query.redirect_uri : ''
    if (!validRedirect(redirectUri)) {
      res.status(400).json({
        error: 'invalid_redirect_uri',
        message: 'redirect_uri tiene que apuntar a localhost o 127.0.0.1 (flujo de app instalada)',
      })
      return
    }

    pendingState = crypto.randomBytes(16).toString('hex')
    res.json({ url: buildAuthUrl(app, redirectUri, pendingState), state: pendingState, redirect_uri: redirectUri })
  })

  router.post('/google/exchange', requireLoopback, async (req, res, next) => {
    try {
      const app = getApp(db)
      if (!app) {
        res.status(409).json({ error: 'google_not_configured', message: 'Faltan las credenciales de la app' })
        return
      }

      const body = req.body as { code?: unknown; redirect_uri?: unknown; state?: unknown } | undefined
      const code = typeof body?.code === 'string' ? body.code.trim() : ''
      const redirectUri = typeof body?.redirect_uri === 'string' ? body.redirect_uri.trim() : ''
      const state = typeof body?.state === 'string' ? body.state : ''

      if (!code || !validRedirect(redirectUri)) {
        res.status(400).json({ error: 'bad_request', message: 'Faltan code o redirect_uri válidos' })
        return
      }
      if (pendingState && state && state !== pendingState) {
        res.status(400).json({ error: 'state_mismatch', message: 'El state no coincide: vuelve a empezar el flujo' })
        return
      }

      const tokens = await exchangeCode(app, code, redirectUri)
      if (!tokens.refresh_token) {
        res.status(502).json({
          error: 'no_refresh_token',
          message: 'Google no devolvió refresh_token. Revoca el acceso de la app y vuelve a autorizar (o quita access_type/prompt).',
        })
        return
      }

      const email = await fetchAccountEmail(tokens.access_token)
      saveTokens(db, tokens, email)
      pendingState = null

      res.json({ ...googleStatus(db), scope: tokens.scope ?? getAccount(db)?.scope ?? null })
    } catch (error) {
      next(error)
    }
  })

  router.post('/google/disconnect', requireLoopback, async (_req, res) => {
    await revokeAccount(db)
    res.json(googleStatus(db))
  })

  return router
}
