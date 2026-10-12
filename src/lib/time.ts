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
