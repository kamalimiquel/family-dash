import { useCallback, useEffect, useRef, useState } from 'react'
import { AGENDA_DAYS, AGENDA_REFRESH_MS } from '../config'
import { completeTask as marcarEnGoogle, fetchCalendar, fetchTasks } from '../lib/api'
import type { AgendaReason, CalendarEvent, GoogleStatus, TaskItem } from '../lib/types'

/** Hasta dónde se puede mover la agenda de semana, para no perderse sin querer. */
const SEMANAS_ATRAS = 4
const SEMANAS_ADELANTE = 12

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
  /** Semanas movidas: 0 = la que empieza hoy, 1 = la siguiente, -1 = la anterior. */
  weekOffset: number
  /** Mueve la agenda de semana. Con el dedo: a la izquierda, la siguiente. */
  moveWeek: (paso: number) => void
  /** Vuelve a la semana de hoy. */
  goToday: () => void
  /** Marca una tarea como hecha en Google. Desaparece de la lista (las hechas no se piden). */
  completeTask: (task: TaskItem) => void
}

const empty: Omit<AgendaState, 'refresh' | 'moveWeek' | 'goToday' | 'completeTask' | 'weekOffset'> = {
  events: [],
  tasks: [],
  status: null,
  reason: null,
  loading: true,
  error: null,
  receivedAt: null,
}

/**
 * El día en que empieza la semana que toca, como `YYYY-MM-DD` **local**: con
 * `toISOString` la fecha iría en UTC y de madrugada cambiaría de día.
 */
function diaDeLaSemana(offsetSemanas: number): string {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + offsetSemanas * 7)
  const dosDigitos = (valor: number): string => String(valor).padStart(2, '0')
  return `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`
}

/**
 * Calendario y tareas en una sola pasada. Van con `allSettled`: si una de las
 * dos falla, la otra se sigue enseñando.
 *
 * La agenda se puede mover de semana (`weekOffset`): se le pide al servidor desde qué día
 * empezar, y las etiquetas de cada día (hoy, mañana, jue 16…) salen solas porque se
 * calculan a partir de la fecha del evento.
 */
export function useAgenda(): AgendaState {
  const [state, setState] = useState(empty)
  const [weekOffset, setWeekOffset] = useState(0)
  const inFlight = useRef<AbortController | null>(null)
  const mounted = useRef(true)

  const load = useCallback(async () => {
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller

    const [calendar, tasks] = await Promise.allSettled([
      fetchCalendar(AGENDA_DAYS, diaDeLaSemana(weekOffset), controller.signal),
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
  }, [weekOffset])

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

  const moveWeek = useCallback((paso: number) => {
    setWeekOffset((actual) => Math.min(Math.max(actual + paso, -SEMANAS_ATRAS), SEMANAS_ADELANTE))
  }, [])

  const goToday = useCallback(() => setWeekOffset(0), [])

  const completeTask = useCallback(
    (task: TaskItem) => {
      // Se quita de la lista en el momento, para que el dedo note que ha hecho algo.
      setState((actual) => ({ ...actual, tasks: actual.tasks.filter((t) => t.id !== task.id) }))

      void marcarEnGoogle(task.listId, task.id).catch((error: unknown) => {
        // Y si Google dice que no (por ejemplo, si la cuenta solo tiene permiso de
        // lectura), se avisa y se vuelve a pedir la lista: aquí no se finge que se ha hecho.
        setState((actual) => ({
          ...actual,
          error: error instanceof Error ? error.message : 'no se pudo marcar la tarea',
        }))
        void load()
      })
    },
    [load],
  )

  return { ...state, weekOffset, moveWeek, goToday, completeTask, refresh: () => void load() }
}
