import { Router } from 'express'
import type { Db } from '../db.js'
import { DEFAULT_NEWS_SOURCES, DEFAULT_PLACE } from '../config.js'
import { getNewsSources, setNewsSources } from '../news/sources.js'
import { getPlace, setPlace } from '../settings.js'

/**
 * Ajustes del dispositivo: la localidad del tiempo y las fuentes de noticias.
 * Los dos viven en SQLite, así que el repositorio no lleva ni la ciudad ni los
 * medios de ninguna casa en particular.
 */
export function createSettingsRouter(db: Db): Router {
  const router = Router()

  router.get('/settings', (_req, res) => {
    res.json({
      place: getPlace(db),
      news: getNewsSources(db),
      defaults: { place: DEFAULT_PLACE, news: DEFAULT_NEWS_SOURCES },
    })
  })

  router.put('/settings', (req, res) => {
    const body = req.body as { place?: unknown; news?: unknown } | undefined

    if (!body || (body.place === undefined && body.news === undefined)) {
      res.status(400).json({ error: 'bad_request', message: 'Falta place o news' })
      return
    }

    try {
      const answer: { place?: unknown; news?: unknown } = {}
      if (body.news !== undefined) answer.news = setNewsSources(db, body.news)
      if (body.place !== undefined) answer.place = setPlace(db, body.place as never)
      res.json(answer)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      res.status(400).json({ error: 'invalid_settings', message })
    }
  })

  return router
}
