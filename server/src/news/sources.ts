import type { Db } from '../db.js'
import { DEFAULT_NEWS_SOURCES, type NewsSource } from '../config.js'

const SOURCES_KEY = 'news.sources'
const MAX_SOURCES = 8

/**
 * Las fuentes de noticias viven en la base de datos del dispositivo, no en el
 * código: cada casa pone las suyas con `PUT /api/settings` y el repositorio no
 * lleva nombres de medios locales de nadie.
 */
export function getNewsSources(db: Db): NewsSource[] {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(SOURCES_KEY) as
    | { value: string }
    | undefined

  if (!row) return DEFAULT_NEWS_SOURCES

  try {
    return parseNewsSources(JSON.parse(row.value))
  } catch {
    return DEFAULT_NEWS_SOURCES
  }
}

export function setNewsSources(db: Db, input: unknown): NewsSource[] {
  const valid = parseNewsSources(input)
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(SOURCES_KEY, JSON.stringify(valid), Date.now())
  return valid
}

/** Valida lo que llega por la API antes de guardarlo o usarlo. */
export function parseNewsSources(input: unknown): NewsSource[] {
  if (!Array.isArray(input)) throw new Error('news debe ser una lista de fuentes')
  if (input.length === 0) throw new Error('news necesita al menos una fuente')
  if (input.length > MAX_SOURCES) throw new Error(`como mucho ${MAX_SOURCES} fuentes`)

  return input.map((raw, index) => {
    if (typeof raw !== 'object' || raw === null) throw new Error(`news[${index}] debe ser un objeto`)
    const item = raw as Record<string, unknown>

    const url = typeof item.url === 'string' ? item.url.trim() : ''
    if (!/^https?:\/\//i.test(url)) throw new Error(`news[${index}].url debe empezar por http`)

    const name =
      typeof item.name === 'string' && item.name.trim()
        ? item.name.trim()
        : new URL(url).hostname.replace(/^www\./, '')

    return { name, url }
  })
}
