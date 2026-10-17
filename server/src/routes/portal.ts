import { Router } from 'express'
import type { DatabaseSync } from 'node:sqlite'
import { portalConfigured, portalUsage } from '../portal.js'

/**
 * El saldo de la suscripción de Nous Portal.
 *
 *   GET /api/portal           → el saldo (de la caché si es reciente)
 *   GET /api/portal?force=1   → pregunta al portal sí o sí (para el botón de refrescar)
 *
 * Nunca devuelve la autorización ni nada que la permita reconstruir: solo el plan y los
 * créditos. Si no hay autorización guardada, lo dice (`sin_autorizacion`) y el panel no
 * enseña nada junto a «Agentes».
 */
export function createPortalRouter(db: DatabaseSync): Router {
  const router = Router()

  router.get('/portal', async (req, res) => {
    const force = req.query.force === '1' || req.query.force === 'true'
    try {
      const uso = await portalUsage(db, { force })
      res.json({ ...uso, configured: portalConfigured() })
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        configured: portalConfigured(),
      })
    }
  })

  return router
}
