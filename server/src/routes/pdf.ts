import { Router } from 'express'
import type { Db } from '../db.js'
import { PDF_MAX_PAGES } from '../config.js'
import { describePdf, PdfUnavailable, renderedPage } from '../pdf/index.js'

export function createPdfRouter(db: Db): Router {
  const router = Router()

  /** Qué PDF hay ahora mismo (nombre, páginas, cuándo cambió). */
  router.get('/pdf', async (_req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store')
      res.json(await describePdf(db))
    } catch (error) {
      next(error)
    }
  })

  /** Una página ya rasterizada. */
  router.get('/pdf/page/:page', async (req, res, next) => {
    const page = Number(req.params.page)

    if (!Number.isInteger(page) || page < 1 || page > PDF_MAX_PAGES) {
      res.status(400).json({ error: 'bad_page', message: 'página fuera de rango' })
      return
    }

    try {
      const file = await renderedPage(db, page)

      if (!file) {
        res.status(404).json({ error: 'pdf_not_ready', message: 'esa página no está' })
        return
      }

      // El nombre lleva la versión del fichero en la query: se puede cachear fuerte.
      res.set('Cache-Control', 'public, max-age=31536000, immutable')
      res.sendFile(file)
    } catch (error) {
      if (error instanceof PdfUnavailable) {
        res.status(404).json({ error: error.code, message: error.message })
        return
      }
      next(error)
    }
  })

  return router
}
