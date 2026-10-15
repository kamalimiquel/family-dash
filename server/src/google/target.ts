import type { Db } from '../db.js'
import { DEFAULT_AGENDA_TARGET, type AgendaTarget } from '../config.js'

const TARGET_KEY = 'agenda.target'
const MAX_NAME = 120

/**
 * El calendario o la lista de tareas configurados no existen en la cuenta. No es
 * un fallo del servidor: la UI lo enseña como motivo, igual que falta de conexión.
 */
export class AgendaTargetError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'AgendaTargetError'
    this.code = code
  }
}

/**
 * Qué calendario y qué lista de tareas se enseñan. Vive en la base de datos del
 * dispositivo (clave `agenda.target`), no en el código: cada casa pone los suyos
 * con `PUT /api/settings` y el repositorio no lleva nombres de nadie.
 */
export function getAgendaTarget(db: Db): AgendaTarget {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(TARGET_KEY) as
    | { value: string }
    | undefined

  if (!row) return DEFAULT_AGENDA_TARGET

  try {
    return parseAgendaTarget(JSON.parse(row.value))
  } catch {
    return DEFAULT_AGENDA_TARGET
  }
}

export function setAgendaTarget(db: Db, input: unknown): AgendaTarget {
  const valid = parseAgendaTarget(input)
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(TARGET_KEY, JSON.stringify(valid), Date.now())
  return valid
}

/** Valida lo que llega por la API antes de guardarlo o usarlo. */
export function parseAgendaTarget(input: unknown): AgendaTarget {
  if (typeof input !== 'object' || input === null) throw new Error('agenda debe ser un objeto')
  const raw = input as Record<string, unknown>

  const read = (key: 'calendar' | 'taskList'): string => {
    const value = raw[key]
    if (value === undefined || value === null) return ''
    if (typeof value !== 'string') throw new Error(`agenda.${key} debe ser texto`)
    const text = value.trim()
    if (text.length > MAX_NAME) throw new Error(`agenda.${key} es demasiado largo`)
    return text
  }

  return {
    calendar: read('calendar') || DEFAULT_AGENDA_TARGET.calendar,
    taskList: read('taskList'),
  }
}

/**
 * Compara nombres de calendario o de lista sin acentos, sin mayúsculas y con los
 * espacios normalizados: «Familia» y « familia » son el mismo nombre.
 */
export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}
