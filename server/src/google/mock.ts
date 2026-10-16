import type { CalendarEvent } from './calendar.js'
import type { TasksResult, TaskItem } from './tasks.js'

/**
 * Datos simulados para poder trabajar en la interfaz sin credenciales de Google.
 * Solo se usan si alguien arranca el servidor con DASH_MOCK=1; en la Pi no se
 * activa nunca, y las respuestas de la API lo dicen en `meta.source`.
 */

const pad = (value: number): string => String(value).padStart(2, '0')

/** ISO con el desfase local, igual que lo que devuelve Google. */
function localIso(date: Date): string {
  const offset = -date.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const hours = pad(Math.floor(Math.abs(offset) / 60))
  const minutes = pad(Math.abs(offset) % 60)
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00${sign}${hours}:${minutes}`
  )
}

const dayIso = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

function dayAt(offsetDays: number, hour = 0, minute = 0, desde?: Date): Date {
  const date = desde ? new Date(desde) : new Date()
  date.setDate(date.getDate() + offsetDays)
  date.setHours(hour, minute, 0, 0)
  return date
}

/**
 * Eventos de ejemplo. Con `from` (`YYYY-MM-DD`) se desplazan a esa semana, para que pasar
 * de semana con el dedo también se note en el simulador (y en las capturas del repo).
 */
export function mockEvents(_days = 7, from?: string): CalendarEvent[] {
  const base = from ? new Date(`${from}T00:00:00`) : undefined
  const allDayTomorrow = dayAt(1, 0, 0, base)

  const timed = (
    offsetDays: number,
    startHour: number,
    startMinute: number,
    endHour: number,
    endMinute: number,
    title: string,
    location: string | null = null,
  ): CalendarEvent => {
    const start = dayAt(offsetDays, startHour, startMinute, base)
    const end = dayAt(offsetDays, endHour, endMinute, base)
    return {
      id: `mock-${offsetDays}-${startHour}-${title}`,
      title,
      start: localIso(start),
      end: localIso(end),
      allDay: false,
      day: dayIso(start),
      location,
      calendar: 'primary',
    }
  }

  return [
    timed(0, 18, 0, 19, 30, 'Entrenamiento de baloncesto', 'Pabellón municipal'),
    timed(0, 21, 0, 22, 30, 'Cena con los abuelos', null),
    {
      id: 'mock-allday',
      title: 'Día festivo en el colegio',
      start: dayIso(allDayTomorrow),
      end: dayIso(allDayTomorrow),
      allDay: true,
      day: dayIso(allDayTomorrow),
      location: null,
      calendar: 'primary',
    },
    timed(1, 17, 30, 19, 0, 'Cumpleaños de Laia', 'Parque de la canal'),
    timed(2, 9, 15, 10, 0, 'Revisión del coche', 'Taller'),
    timed(4, 19, 0, 20, 0, 'Reunión de tutores', 'Colegio'),
  ]
}

/** Las tareas que se han marcado como hechas en el simulador. Vive solo en memoria. */
const hechasEnElSimulador = new Set<string>()

export function mockTasks(): TasksResult {
  const tasks: TaskItem[] = [
    { id: 'mock-t1', title: 'Comprar pan y leche', due: dayIso(dayAt(0)), list: 'Casa', listId: 'mock-casa', notes: null },
    { id: 'mock-t2', title: 'Pagar la luz', due: dayIso(dayAt(1)), list: 'Casa', listId: 'mock-casa', notes: null },
    { id: 'mock-t3', title: 'Firmar la autorización del colegio', due: dayIso(dayAt(2)), list: 'Familia', listId: 'mock-familia', notes: null },
    { id: 'mock-t4', title: 'Reservar la revisión del coche', due: null, list: 'Casa', listId: 'mock-casa', notes: null },
  ]
  // Al marcar una como hecha desaparece de la lista, igual que pasa con las de verdad
  // (que se piden con `showCompleted=false`).
  return { tasks: tasks.filter((task) => !hechasEnElSimulador.has(task.id)), lists: ['Casa', 'Familia'] }
}

export function mockComplete(_listId: string, taskId: string): void {
  hechasEnElSimulador.add(taskId)
}
