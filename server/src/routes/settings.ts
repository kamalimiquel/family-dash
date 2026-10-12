import { Router } from 'express'
import type { Db } from '../db.js'
import { getPlace, setPlace } from '../settings.js'
import { DEFAULT_PLACE } from '../config.js'

export function createSettingsRouter(db: Db): Router {
  const router = Router()

  router.get('/settings', (_req, res) => {
    res.json({ place: getPlace(db), defaults: { place: DEFAULT_PLACE } })
  })

  router.put('/settings', (req, res) => {
    const body = req.body as { place?: unknown } | undefined
    if (!body || body.place === undefined) {
      res.status(400).json({ error: 'bad_request', message: 'Falta el campo place' })
      return
    }

    try {
      const place = setPlace(db, body.place as never)
      res.json({ place })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      res.status(400).json({ error: 'invalid_place', message })
    }
  })

  return router
}
