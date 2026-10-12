import type { Db } from '../db.js'
import { DEFAULT_PDF_SOURCE, type PdfSource } from '../config.js'

const SOURCE_KEY = 'pdf.source'

/**
 * De dónde se lee el PDF vive en la base de datos del dispositivo: la ruta del
 * recurso compartido del NAS solo tiene sentido en la máquina que lo tiene
 * montado, y el repositorio no lleva rutas de ninguna casa.
 */
export function getPdfSource(db: Db): PdfSource {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(SOURCE_KEY) as
    | { value: string }
    | undefined

  if (!row) return DEFAULT_PDF_SOURCE

  try {
    return parsePdfSource(JSON.parse(row.value))
  } catch {
    return DEFAULT_PDF_SOURCE
  }
}

export function setPdfSource(db: Db, input: unknown): PdfSource {
  const valid = parsePdfSource(input)
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(SOURCE_KEY, JSON.stringify(valid), Date.now())
  return valid
}

/** Valida lo que llega por la API antes de guardarlo o usarlo. */
export function parsePdfSource(input: unknown): PdfSource {
  if (typeof input !== 'object' || input === null) {
    throw new Error('pdf debe ser un objeto con dir y/o file')
  }

  const raw = input as Record<string, unknown>
  const dir = typeof raw.dir === 'string' ? raw.dir.trim() : ''
  const file = typeof raw.file === 'string' ? raw.file.trim() : ''

  if (!dir && !file) throw new Error('pdf necesita dir o file')
  if (dir && !dir.startsWith('/')) throw new Error('pdf.dir debe ser una ruta absoluta')
  if (file && !file.startsWith('/') && !dir) {
    throw new Error('pdf.file debe ser una ruta absoluta si no hay pdf.dir')
  }

  return { ...(dir ? { dir } : {}), ...(file ? { file } : {}) }
}
