import type { Db } from '../db.js'
import { isMock } from './auth.js'
import { googleFetch } from './api.js'
import { mockEvents } from './mock.js'
import { AgendaTargetError, normalizeName } from './target.js'

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

/** `primary` es el calendario principal de la cuenta. */
export const DEFAULT_CALENDAR_ID = 'primary'

export interface CalendarEvent {
  id: string
  title: string
  /** ISO con desfase horario, o fecha `YYYY-MM-DD` si es de día entero. */
  start: string
  end: string | null
  allDay: boolean
  /** `YYYY-MM-DD` local del evento: es lo que usa la UI para agrupar por día. */
  day: string
  location: string | null
  calendar: string | null
}

interface GoogleEventDateTime {
  date?: string
  dateTime?: string
}

interface GoogleEvent {
  id?: string
  summary?: string
  location?: string
  status?: string
  start?: GoogleEventDateTime
  end?: GoogleEventDateTime
}

interface GoogleEventList {
  items?: GoogleEvent[]
}

export interface FetchEventsOptions {
  /** Cuántos días hacia adelante se piden (por defecto 7). */
  days?: number
  /** Cuántos eventos como máximo (por defecto 60). */
  max?: number
  calendarId?: string
  /** Nombre visible del calendario («Familiar»); se resuelve a su id. */
  calendarName?: string
  /** Cuántas horas hacia atrás se miran, para ver lo que está en curso. */
  lookBackHours?: number
}

interface GoogleCalendarList {
  items?: { id?: string; summary?: string; primary?: boolean }[]
}

/**
 * Traduce el nombre visible de un calendario («Familiar») al id que usa la API.
 * `primary` (o vacío) es el calendario principal de la cuenta; si el nombre no
 * aparece en la lista de calendarios, se avisa con `calendar_not_found` en vez de
 * enseñar una agenda vacía sin explicación.
 */
export async function resolveCalendarId(db: Db, name?: string): Promise<string> {
  const wanted = (name ?? '').trim()
  if (!wanted || normalizeName(wanted) === 'primary') return DEFAULT_CALENDAR_ID

  const url = new URL(`${CALENDAR_API}/users/me/calendarList`)
  url.searchParams.set('minAccessRole', 'reader')
  url.searchParams.set('fields', 'items(id,summary,primary)')

  const data = await googleFetch<GoogleCalendarList>(db, url.toString())
  const wantedKey = normalizeName(wanted)
  const hit = (data.items ?? []).find((item) => item.summary && normalizeName(item.summary) === wantedKey)

  if (!hit?.id) {
    throw new AgendaTargetError('calendar_not_found', `No encuentro el calendario «${wanted}» en esta cuenta`)
  }
  return hit.id
}

const dayOf = (value: string | undefined): string | null => {
  if (!value) return null
  const day = value.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null
}

export function normalizeEvent(event: GoogleEvent, calendar: string | null): CalendarEvent | null {
  const startRaw = event.start?.dateTime ?? event.start?.date
  if (!startRaw) return null

  const allDay = Boolean(event.start?.date) && !event.start?.dateTime
  const day = dayOf(startRaw)
  if (!day) return null

  return {
    id: event.id ?? `${startRaw}-${event.summary ?? ''}`,
    title: event.summary?.trim() || '(sin título)',
    start: startRaw,
    end: event.end?.dateTime ?? event.end?.date ?? null,
    allDay,
    day,
    location: event.location?.trim() || null,
    calendar,
  }
}

/** Próximos eventos, ordenados por hora de inicio. */
export async function fetchEvents(db: Db, options: FetchEventsOptions = {}): Promise<CalendarEvent[]> {
  const { days = 7, max = 60, calendarId, calendarName, lookBackHours = 2 } = options

  if (isMock()) return mockEvents(days)

  // Un id explícito manda; si no, el nombre configurado; si no, el principal.
  const target = calendarId ?? (await resolveCalendarId(db, calendarName))

  const now = new Date()
  const timeMin = new Date(now.getTime() - lookBackHours * 3_600_000)
  const timeMax = new Date(now.getTime() + days * 86_400_000)

  const url = new URL(`${CALENDAR_API}/calendars/${encodeURIComponent(target)}/events`)
  url.searchParams.set('timeMin', timeMin.toISOString())
  url.searchParams.set('timeMax', timeMax.toISOString())
  url.searchParams.set('singleEvents', 'true') // expande los recurrentes
  url.searchParams.set('orderBy', 'startTime')
  url.searchParams.set('maxResults', String(max))
  url.searchParams.set('fields', 'items(id,summary,location,status,start,end)')

  const data = await googleFetch<GoogleEventList>(db, url.toString())

  return (data.items ?? [])
    .filter((event) => event.status !== 'cancelled')
    .map((event) => normalizeEvent(event, target))
    .filter((event): event is CalendarEvent => event !== null)
    .slice(0, max)
}
