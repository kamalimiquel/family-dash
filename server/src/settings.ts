import type { Db } from './db.js'
import { DEFAULT_HOME, DEFAULT_PLACE, DEFAULT_SCREEN_IDLE_MINUTES, type HomePlace, type Place } from './config.js'

const PLACE_KEY = 'weather.place'
const HOME_KEY = 'map.home'
const SCREEN_IDLE_KEY = 'screen.idleMinutes'

/**
 * Dónde está casa, para el mapa: la referencia de «a 1,2 km de casa». Vive en la
 * base de datos del dispositivo, así que el repositorio no lleva direcciones de
 * ninguna casa. Sin ajuste, el mapa solo encuadra a la gente.
 */
export function getHome(db: Db): HomePlace | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(HOME_KEY) as
    | { value: string }
    | undefined

  if (!row) return DEFAULT_HOME

  try {
    return parseHome(JSON.parse(row.value))
  } catch {
    return DEFAULT_HOME
  }
}

/** Con `null` (o `{latitude:null}`) se borra el ajuste y el mapa vuelve a no tener casa. */
export function setHome(db: Db, input: unknown): HomePlace | null {
  const valid = parseHome(input)

  if (!valid) {
    db.prepare('DELETE FROM settings WHERE key = ?').run(HOME_KEY)
    return null
  }

  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(HOME_KEY, JSON.stringify(valid), Date.now())
  return valid
}

/** Valida lo que llega por la API antes de guardarlo o usarlo. */
export function parseHome(input: unknown): HomePlace | null {
  if (input === null) return null
  if (typeof input !== 'object') throw new Error('home debe ser un objeto o null')
  const raw = input as Record<string, unknown>

  const latitude = Number(raw.latitude)
  const longitude = Number(raw.longitude)
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('home.latitude fuera de rango')
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('home.longitude fuera de rango')
  }

  const label = typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim() : 'Casa'
  return { label, latitude, longitude }
}

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

/**
 * Cuántos minutos sin que nadie toque la pantalla antes de dejarla en negro (0 = nunca).
 * Es un ajuste del dispositivo: en una casa querrán que se duerma y en otra no.
 */
export function getScreenIdleMinutes(db: Db): number {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(SCREEN_IDLE_KEY) as
    | { value: string }
    | undefined

  if (!row) return DEFAULT_SCREEN_IDLE_MINUTES

  try {
    return parseScreenIdleMinutes(JSON.parse(row.value))
  } catch {
    // Un valor ilegible en la base de datos no puede dejar la pantalla encendida toda la
    // noche ni impedir que arranque el panel: se cae al valor de ejemplo.
    return DEFAULT_SCREEN_IDLE_MINUTES
  }
}

export function setScreenIdleMinutes(db: Db, input: unknown): number {
  const minutos = parseScreenIdleMinutes(input)
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(SCREEN_IDLE_KEY, JSON.stringify(minutos), Date.now())
  return minutos
}

/**
 * Valida lo que llega por la API. Admite el número suelto o el objeto `{idleMinutes}`,
 * porque el ajuste entero es un número y envolverlo solo tiene sentido para dejarlo
 * junto a los demás en `PUT /api/settings`. De 0 (nunca) a 240 minutos.
 */
export function parseScreenIdleMinutes(input: unknown): number {
  const minutos =
    typeof input === 'object' && input !== null
      ? Number((input as Record<string, unknown>).idleMinutes)
      : Number(input)

  if (!Number.isFinite(minutos) || minutos < 0 || minutos > 240) {
    throw new Error('screen.idleMinutes tiene que ser un número entre 0 y 240')
  }

  return minutos
}
