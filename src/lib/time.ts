import { LOCALE } from '../config'

const pad = (value: number): string => value.toString().padStart(2, '0')

export interface TimeParts {
  hours: string
  minutes: string
  seconds: string
}

/** 24-hour clock digits, zero-padded, ready for tabular display. */
export function getTimeParts(date: Date): TimeParts {
  return {
    hours: pad(date.getHours()),
    minutes: pad(date.getMinutes()),
    seconds: pad(date.getSeconds()),
  }
}

/** e.g. "Lunes, 12 de octubre de 2026" */
export function formatLongDate(date: Date, locale: string = LOCALE): string {
  const formatted = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)

  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

/** Screen-reader / accessibility label for the whole clock, e.g. "12:07, lunes 12 de octubre". */
export function formatSpokenDateTime(date: Date, locale: string = LOCALE): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/** ISO week number, used later for the weekly menu module. */
export function getIsoWeek(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNumber = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber)
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
}

/** "lun." — para la tira de días del tiempo. */
export function formatWeekdayShort(date: Date, locale: string = LOCALE): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date).replace(/\.$/, '')
}

/** "14:38" */
export function formatTimeShort(date: Date, locale: string = LOCALE): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date)
}

/**
 * "2026-10-13" → Date en hora local (no UTC: si no, el nombre del día puede
 * bailar según el huso horario del navegador).
 */
export function parseIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1)
}

/**
 * "2026-10-12T08:05" → "08:05". Open-Meteo devuelve la hora local del lugar, así
 * que basta con cortar: convertirlo con Date lo desplazaría al huso del navegador.
 */
export function formatIsoTimeOfDay(isoDateTime: string | null | undefined): string {
  if (!isoDateTime) return '—'
  const time = isoDateTime.split('T')[1]?.slice(0, 5)
  return time ?? isoDateTime
}

/** Días de diferencia entre dos fechas `YYYY-MM-DD` (b - a). */
function dayDiff(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number)
  const [y2, m2, d2] = to.split('-').map(Number)
  const a = Date.UTC(y1 ?? 1970, (m1 ?? 1) - 1, d1 ?? 1)
  const b = Date.UTC(y2 ?? 1970, (m2 ?? 1) - 1, d2 ?? 1)
  return Math.round((b - a) / 86_400_000)
}

export function toDayId(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** "Hoy", "Mañana", "jue 15"… para los encabezados de la agenda. */
export function formatDayLabel(day: string, today: Date = new Date()): string {
  const diff = dayDiff(toDayId(today), day)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  if (diff === -1) return 'Ayer'
  const date = parseIsoDate(day)
  const short = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: 'numeric' }).format(date)
  return short.replace(/\.$/, '')
}

/** "hoy", "mañana", "jue" o "" si la fecha está lejos, para las tareas. */
export function formatDueLabel(due: string | null, today: Date = new Date()): string {
  if (!due) return ''
  const diff = dayDiff(toDayId(today), due)
  if (diff === 0) return 'hoy'
  if (diff === 1) return 'mañana'
  if (diff < 0) return 'vencida'
  const date = parseIsoDate(due)
  return new Intl.DateTimeFormat(LOCALE, { weekday: 'short' }).format(date).replace(/\.$/, '')
}
