import { Router } from 'express'
import type { Db } from '../db.js'
import { getPlace } from '../settings.js'
import { getOrFetch } from '../cache.js'
import { fetchWeather, type WeatherSnapshot } from '../weather/openMeteo.js'
import { WEATHER_TTL_MS } from '../config.js'

/** Clave de caché por coordenadas redondeadas (~11 m), estable entre llamadas. */
export function weatherCacheKey(latitude: number, longitude: number): string {
  return `weather:${latitude.toFixed(4)}:${longitude.toFixed(4)}`
}

export function createWeatherRouter(db: Db): Router {
  const router = Router()

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
