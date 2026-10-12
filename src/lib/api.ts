import type { CalendarResponse, TasksResponse, WeatherSnapshot } from './types'

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

export function fetchWeather(signal?: AbortSignal): Promise<WeatherSnapshot> {
  return getJson<WeatherSnapshot>('/api/weather', signal)
}

export function fetchCalendar(days: number, signal?: AbortSignal): Promise<CalendarResponse> {
  return getJson<CalendarResponse>(`/api/calendar?days=${days}`, signal)
}

export function fetchTasks(signal?: AbortSignal): Promise<TasksResponse> {
  return getJson<TasksResponse>('/api/tasks', signal)
}
