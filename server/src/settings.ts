import type { Db } from './db.js'
import { DEFAULT_PLACE, type Place } from './config.js'

const PLACE_KEY = 'weather.place'

export function getPlace(db: Db): Place {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(PLACE_KEY) as
    | { value: string }
    | undefined

  if (!row) return DEFAULT_PLACE

  try {
    return parsePlace(JSON.parse(row.value))
  } catch {
    return DEFAULT_PLACE
  }
}

export function setPlace(db: Db, place: Place): Place {
  const valid = parsePlace(place)
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(PLACE_KEY, JSON.stringify(valid), Date.now())
  return valid
}

/** Valida lo que llega por la API antes de guardarlo o usarlo. */
export function parsePlace(input: unknown): Place {
  if (typeof input !== 'object' || input === null) {
    throw new Error('place debe ser un objeto')
  }
  const raw = input as Record<string, unknown>

  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (!name) throw new Error('place.name es obligatorio')

  const latitude = Number(raw.latitude)
  const longitude = Number(raw.longitude)
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('place.latitude fuera de rango')
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('place.longitude fuera de rango')
  }

  const timezone = typeof raw.timezone === 'string' && raw.timezone.trim() ? raw.timezone.trim() : 'auto'
  const country = typeof raw.country === 'string' && raw.country.trim() ? raw.country.trim() : undefined

  return { name, country, latitude, longitude, timezone }
}
