import { Router } from 'express'
import type { Db } from '../db.js'
import { getNews } from '../news/index.js'

export function createNewsRouter(db: Db): Router {
  const router = Router()

  router.get('/news', async (req, res, next) => {
    const refresh = req.query.refresh === '1' || req.query.refresh === 'true'

    try {
      const snapshot = await getNews(db, { refresh })
      res.set('Cache-Control', 'no-store')
      res.json(snapshot)
    } catch (error) {
      next(error)
    }
  })

  return router
}
