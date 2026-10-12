import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** server/dist (fichero compilado) → sube hasta la raíz del proyecto. */
const here = path.dirname(fileURLToPath(import.meta.url))
export const SERVER_ROOT = path.resolve(here, '..')
export const PROJECT_ROOT = path.resolve(SERVER_ROOT, '..')

/** Build de Vite que sirve Express (HTML + assets). */
export const DIST_DIR = path.join(PROJECT_ROOT, 'dist')

export const PORT = Number(process.env.PORT ?? 4173)
export const HOST = process.env.HOST ?? '0.0.0.0'

/** SQLite local: caché del tiempo, ajustes y (fase 3) tokens de Google. */
export const DB_PATH =
  process.env.DASH_DB ?? path.join(PROJECT_ROOT, 'data', 'dashboard.sqlite')

/** Cuánto vale una respuesta de Open-Meteo antes de volver a pedirla. */
export const WEATHER_TTL_MS = Number(process.env.WEATHER_TTL_MS ?? 10 * 60 * 1000)

/** Cuántos días de calendario se piden. */
export const CALENDAR_DAYS = Number(process.env.CALENDAR_DAYS ?? 7)

/** Caché de calendario y tareas (Google aguanta bien, pero no hace falta ir cada vez). */
export const CALENDAR_TTL_MS = Number(process.env.CALENDAR_TTL_MS ?? 5 * 60 * 1000)
export const TASKS_TTL_MS = Number(process.env.TASKS_TTL_MS ?? 5 * 60 * 1000)

export interface Place {
  name: string
  country?: string
  latitude: number
  longitude: number
  timezone: string
}

/**
 * Ciudad de ejemplo (Barcelona, las coordenadas del geocoder de Open-Meteo).
 * El panel de casa usa la que tenga guardada en la tabla `settings`, que se
 * cambia con `PUT /api/settings` sin tocar código.
 */
export const DEFAULT_PLACE: Place = {
  name: 'Barcelona',
  country: 'ES',
  latitude: 41.3874,
  longitude: 2.1686,
  timezone: 'Europe/Madrid',
}
