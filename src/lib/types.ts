/**
 * Tipos de la API del panel. Espejo de lo que devuelve `server/src`
 * (no se importan directamente: el backend es otro proyecto TS con NodeNext).
 */

export type IconKey =
  | 'clear'
  | 'clear-night'
  | 'mostly-clear'
  | 'mostly-clear-night'
  | 'partly-cloudy'
  | 'partly-cloudy-night'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'freezing-drizzle'
  | 'rain'
  | 'freezing-rain'
  | 'snow'
  | 'snow-grains'
  | 'showers'
  | 'snow-showers'
  | 'thunderstorm'
  | 'thunderstorm-hail'
  | 'unknown'

export interface Condition {
  code: number
  label: string
  icon: IconKey
}

export interface DailyForecast {
  date: string
  min: number | null
  max: number | null
  precipitationProbability: number | null
  condition: Condition
}

export interface WeatherSnapshot {
  place: { name: string; country?: string; latitude: number; longitude: number }
  timezone: string
  attribution: string
  current: {
    time: string
    temperature: number | null
    apparent: number | null
    humidity: number | null
    precipitation: number | null
    cloudCover: number | null
    pressure: number | null
    windSpeed: number | null
    windGusts: number | null
    windDirection: number | null
    windDirectionLabel: string | null
    isDay: boolean
    condition: Condition
  }
  today: {
    date: string
    min: number | null
    max: number | null
    sunrise: string | null
    sunset: string | null
    precipitationProbability: number | null
    windSpeedMax: number | null
    condition: Condition
  }
  daily: DailyForecast[]
  meta: {
    source: string
    cached: boolean
    stale: boolean
    fetchedAt: string
    expiresAt: string
    ttlSeconds: number
  }
}

/* --- agenda (Google Calendar y Tasks) ------------------------------------ */

export interface GoogleStatus {
  configured: boolean
  connected: boolean
  email: string | null
  scope: string | null
  mock: boolean
}

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string | null
  allDay: boolean
  /** `YYYY-MM-DD` del día al que pertenece el evento. */
  day: string
  location: string | null
  calendar: string | null
}

export interface TaskItem {
  id: string
  title: string
  due: string | null
  list: string
  notes: string | null
}

export interface CacheMeta {
  source: string
  cached: boolean
  stale: boolean
  fetchedAt: string
  expiresAt: string
  ttlSeconds: number
}

/** Motivo por el que no hay datos (falta configurar o autorizar Google). */
export interface AgendaReason {
  error: string
  message: string
}

export interface CalendarResponse {
  events: CalendarEvent[]
  status: GoogleStatus
  reason: AgendaReason | null
  meta: CacheMeta | null
}

export interface TasksResponse {
  tasks: TaskItem[]
  lists: string[]
  status: GoogleStatus
  reason: AgendaReason | null
  meta: CacheMeta | null
}

/* --- noticias (RSS) ------------------------------------------------------ */

export interface NewsItem {
  title: string
  link: string | null
  /** ISO 8601, o `null` si el feed no traía fecha. */
  date: string | null
}

export interface NewsFeed {
  name: string
  url: string
  items: NewsItem[]
  /** Motivo por el que esta fuente no trajo nada (las demás siguen). */
  error: string | null
  stale: boolean
  cached: boolean
}

export interface NewsResponse {
  feeds: NewsFeed[]
  meta: CacheMeta
}

/* --- PDF (el menú que se deja en la carpeta compartida) ------------------ */

export interface PdfDocument {
  file: string
  pages: number
  bytes: number
  modifiedAt: string
  version: string
  /** Ancho/alto de la página: la miniatura se coloca sin deformarla. */
  aspect: number
}

export interface PdfResponse {
  document: PdfDocument | null
  /** Por qué no hay PDF (carpeta sin montar, sin ficheros…). */
  reason: AgendaReason | null
  meta: { source: string; fetchedAt: string; ttlSeconds: number }
}
