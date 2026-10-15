import { Router } from 'express'
import type { Db } from '../db.js'
import { getPlace } from '../settings.js'
import { getOrFetch } from '../cache.js'
import { fetchWeather, type WeatherSnapshot } from '../weather/openMeteo.js'
import { getRadar } from '../weather/radar.js'
import { RADAR_VIEW, RADAR_TTL_MS, WEATHER_TTL_MS } from '../config.js'

/** Clave de caché por coordenadas redondeadas (~11 m), estable entre llamadas. */
export function weatherCacheKey(latitude: number, longitude: number): string {
  return `weather:${latitude.toFixed(4)}:${longitude.toFixed(4)}`
}

export function createWeatherRouter(db: Db): Router {
  const router = Router()

  /**
   * El radar de precipitación de Meteocat, para el desplegable del tiempo.
   *
   * Si Meteocat no contesta, se responde 200 con `reason` y la vista (para que el
   * mapa salga igualmente, sin radar): un desplegable vacío no explica nada.
   */
  router.get('/radar', async (_req, res) => {
    try {
      const frame = await getRadar(db)
      res.set('Cache-Control', 'no-store')
      res.json({ ...frame, reason: null, meta: { source: 'meteocat-radar', ttlSeconds: RADAR_TTL_MS / 1000 } })
    } catch (error) {
      res.set('Cache-Control', 'no-store')
      res.json({
        view: RADAR_VIEW,
        tiles: null,
        path: null,
        imageAt: null,
        credit: 'Radar: Meteocat (SMC)',
        reason: {
          error: 'radar_no_disponible',
          message: error instanceof Error ? error.message : 'Meteocat no contesta',
        },
        meta: null,
      })
    }
  })

  router.get('/weather', async (req, res, next) => {
    const place = getPlace(db)
    const key = weatherCacheKey(place.latitude, place.longitude)
    const force = req.query.refresh === '1' || req.query.refresh === 'true'

    try {
      if (force) {
        db.prepare('DELETE FROM cache WHERE key = ?').run(key)
      }

      const result = await getOrFetch<WeatherSnapshot>(
        db,
        key,
        WEATHER_TTL_MS,
        () => fetchWeather(place),
        'open-meteo',
      )

      res.set('Cache-Control', 'no-store')
      res.json({
        ...result.value,
        meta: {
          source: 'open-meteo',
          cached: result.cached,
          stale: result.stale,
          fetchedAt: new Date(result.fetchedAt).toISOString(),
          expiresAt: new Date(result.expiresAt).toISOString(),
          ttlSeconds: Math.round(WEATHER_TTL_MS / 1000),
        },
      })
    } catch (error) {
      next(error)
    }
  })

  return router
}
