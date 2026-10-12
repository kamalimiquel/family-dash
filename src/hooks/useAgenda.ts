import { useCallback, useEffect, useRef, useState } from 'react'
import { AGENDA_DAYS, AGENDA_REFRESH_MS } from '../config'
import { fetchCalendar, fetchTasks } from '../lib/api'
import type { AgendaReason, CalendarEvent, GoogleStatus, TaskItem } from '../lib/types'

export interface AgendaState {
  events: CalendarEvent[]
  tasks: TaskItem[]
  status: GoogleStatus | null
  /** Por qué no hay datos (falta configurar/autorizar Google), si aplica. */
  reason: AgendaReason | null
  loading: boolean
  error: string | null
  receivedAt: Date | null
  refresh: () => void
}

const empty: Omit<AgendaState, 'refresh'> = {
  events: [],
  tasks: [],
  status: null,
  reason: null,
  loading: true,
  error: null,
  receivedAt: null,
}

/**
 * Calendario y tareas en una sola pasada. Van con `allSettled`: si una de las
 * dos falla, la otra se sigue enseñando.
 */
export function useAgenda(): AgendaState {
  const [state, setState] = useState(empty)
  const inFlight = useRef<AbortController | null>(null)
  const mounted = useRef(true)

  const load = useCallback(async () => {
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller

    const [calendar, tasks] = await Promise.allSettled([
      fetchCalendar(AGENDA_DAYS, controller.signal),
      fetchTasks(controller.signal),
    ])

    if (controller.signal.aborted || !mounted.current) return

    const calendarOk = calendar.status === 'fulfilled' ? calendar.value : null
    const tasksOk = tasks.status === 'fulfilled' ? tasks.value : null
    const failure = calendar.status === 'rejected' ? calendar.reason : tasks.status === 'rejected' ? tasks.reason : null

    setState({
      events: calendarOk?.events ?? [],
      tasks: tasksOk?.tasks ?? [],
      status: calendarOk?.status ?? tasksOk?.status ?? null,
      reason: calendarOk?.reason ?? tasksOk?.reason ?? null,
      loading: false,
      error: failure ? (failure instanceof Error ? failure.message : 'Error desconocido') : null,
      receivedAt: new Date(),
    })
  }, [])

  useEffect(() => {
    mounted.current = true
    // oxlint: carga inicial de la API; el estado solo se toca tras los await.
    // eslint-disable-next-line react/set-state-in-effect
    void load()

    const timer = window.setInterval(() => void load(), AGENDA_REFRESH_MS)
    const onOnline = () => void load()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }

    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      mounted.current = false
      window.clearInterval(timer)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
      inFlight.current?.abort()
    }
  }, [load])

  return { ...state, refresh: () => void load() }
}
