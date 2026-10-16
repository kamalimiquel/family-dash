import { Router } from 'express'
import type { Db } from '../db.js'
import {
  DEFAULT_AGENDA_TARGET,
  DEFAULT_HOME,
  DEFAULT_NEWS_SOURCES,
  DEFAULT_PDF_SOURCE,
  DEFAULT_PLACE,
  DEFAULT_SCREEN_IDLE_MINUTES,
} from '../config.js'
import { getNewsSources, setNewsSources } from '../news/sources.js'
import { getPdfSource, setPdfSource } from '../pdf/source.js'
import { getHome, getPlace, getScreenIdleMinutes, setHome, setPlace, setScreenIdleMinutes } from '../settings.js'
import { getAgendaTarget, setAgendaTarget } from '../google/target.js'

/**
 * Ajustes del dispositivo: la localidad del tiempo, las fuentes de noticias, de
 * dónde se lee el PDF, qué calendario y lista de tareas se enseñan y cuánto tarda
 * la pantalla en quedarse en negro. Los cinco viven en SQLite, así que el
 * repositorio no lleva ni la ciudad, ni los medios, ni las rutas del NAS, ni los
 * nombres de las agendas de ninguna casa, ni cómo usa cada casa su pantalla.
 */
export function createSettingsRouter(db: Db): Router {
  const router = Router()

  router.get('/settings', (_req, res) => {
    res.json({
      place: getPlace(db),
      news: getNewsSources(db),
      pdf: getPdfSource(db),
      agenda: getAgendaTarget(db),
      home: getHome(db),
      screen: { idleMinutes: getScreenIdleMinutes(db) },
      defaults: {
        place: DEFAULT_PLACE,
        news: DEFAULT_NEWS_SOURCES,
        pdf: DEFAULT_PDF_SOURCE,
        agenda: DEFAULT_AGENDA_TARGET,
        home: DEFAULT_HOME,
        screen: { idleMinutes: DEFAULT_SCREEN_IDLE_MINUTES },
      },
    })
  })

  router.put('/settings', (req, res) => {
    const body = req.body as
      | {
          place?: unknown
          news?: unknown
          pdf?: unknown
          agenda?: unknown
          home?: unknown
          screen?: unknown
        }
      | undefined

    if (
      !body ||
      (body.place === undefined &&
        body.news === undefined &&
        body.pdf === undefined &&
        body.agenda === undefined &&
        body.home === undefined &&
        body.screen === undefined)
    ) {
      res.status(400).json({ error: 'bad_request', message: 'Falta place, news, pdf, agenda, home o screen' })
      return
    }

    try {
      const answer: {
        place?: unknown
        news?: unknown
        pdf?: unknown
        agenda?: unknown
        home?: unknown
        screen?: unknown
      } = {}
      if (body.news !== undefined) answer.news = setNewsSources(db, body.news)
      if (body.pdf !== undefined) answer.pdf = setPdfSource(db, body.pdf)
      if (body.agenda !== undefined) answer.agenda = setAgendaTarget(db, body.agenda)
      if (body.home !== undefined) answer.home = setHome(db, body.home)
      if (body.place !== undefined) answer.place = setPlace(db, body.place as never)
      if (body.screen !== undefined) {
        answer.screen = { idleMinutes: setScreenIdleMinutes(db, body.screen) }
      }
      res.json(answer)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      res.status(400).json({ error: 'invalid_settings', message })
    }
  })

  return router
}
