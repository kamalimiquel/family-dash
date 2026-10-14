import { Router } from 'express'
import type { Db } from '../db.js'
import { getLocations } from '../locations/index.js'

export function createLocationsRouter(db: Db): Router {
  const router = Router()

  router.get('/locations', async (req, res, next) => {
    const refresh = req.query.refresh === '1' || req.query.refresh === 'true'

    try {
      const snapshot = await getLocations(db, { refresh })
      res.set('Cache-Control', 'no-store')
      res.json(snapshot)
    } catch (error) {
      next(error)
    }
  })

  return router
}
