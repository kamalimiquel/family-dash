import type {
  CalendarResponse,
  LocationsResponse,
  NewsResponse,
  PdfResponse,
  RadarFrame,
  TasksResponse,
  WeatherSnapshot,
} from './types'

/** Error con la información que necesita la UI para decidir qué enseñar. */
export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    signal,
    headers: { accept: 'application/json' },
  })

  if (!response.ok) {
    let detail = `${response.status}`
    try {
      const body = (await response.json()) as { message?: string; error?: string }
      detail = body.message ?? body.error ?? detail
    } catch {
      /* respuesta sin JSON */
    }
    throw new ApiError(detail, response.status)
  }

  return (await response.json()) as T
}

/** Igual que `getJson`, pero mandando cuerpo: para lo que escribe en Google. */
async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    let detail = `${response.status}`
    try {
      const datos = (await response.json()) as { message?: string; error?: string }
      detail = datos.message ?? datos.error ?? detail
    } catch {
      /* respuesta sin JSON */
    }
    throw new ApiError(detail, response.status)
  }

  return (await response.json()) as T
}

export function fetchWeather(signal?: AbortSignal): Promise<WeatherSnapshot> {
  return getJson<WeatherSnapshot>('/api/weather', signal)
}

export function fetchCalendar(days: number, from: string, signal?: AbortSignal): Promise<CalendarResponse> {
  // `from` es el día en que empieza la semana que se enseña (la agenda se pasa con el dedo).
  const query = new URLSearchParams({ days: String(days), from })
  return getJson<CalendarResponse>(`/api/calendar?${query.toString()}`, signal)
}

/** Marca una tarea como hecha en Google. Devuelve error si la cuenta solo tiene lectura. */
export function completeTask(listId: string, taskId: string, signal?: AbortSignal): Promise<{ ok: boolean }> {
  return postJson<{ ok: boolean }>(`/api/tasks/${encodeURIComponent(taskId)}/complete`, { listId }, signal)
}

export function fetchTasks(signal?: AbortSignal): Promise<TasksResponse> {
  return getJson<TasksResponse>('/api/tasks', signal)
}

export function fetchRadar(signal?: AbortSignal): Promise<RadarFrame> {
  return getJson<RadarFrame>('/api/radar', signal)
}

export function fetchNews(signal?: AbortSignal): Promise<NewsResponse> {
  return getJson<NewsResponse>('/api/news', signal)
}

export function fetchLocations(signal?: AbortSignal): Promise<LocationsResponse> {
  return getJson<LocationsResponse>('/api/locations', signal)
}

export function fetchPdf(signal?: AbortSignal): Promise<PdfResponse> {
  return getJson<PdfResponse>('/api/pdf', signal)
}
