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

function dayAt(offsetDays: number, hour = 0, minute = 0): Date {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  date.setHours(hour, minute, 0, 0)
  return date
}

export function mockEvents(_days = 7): CalendarEvent[] {
  const allDayTomorrow = dayAt(1)

  const timed = (
    offsetDays: number,
    startHour: number,
    startMinute: number,
    endHour: number,
    endMinute: number,
    title: string,
    location: string | null = null,
  ): CalendarEvent => {
    const start = dayAt(offsetDays, startHour, startMinute)
    const end = dayAt(offsetDays, endHour, endMinute)
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

export function mockTasks(): TasksResult {
  const tasks: TaskItem[] = [
    { id: 'mock-t1', title: 'Comprar pan y leche', due: dayIso(dayAt(0)), list: 'Casa', notes: null },
    { id: 'mock-t2', title: 'Pagar la luz', due: dayIso(dayAt(1)), list: 'Casa', notes: null },
    { id: 'mock-t3', title: 'Firmar la autorización del colegio', due: dayIso(dayAt(2)), list: 'Familia', notes: null },
    { id: 'mock-t4', title: 'Reservar la revisión del coche', due: null, list: 'Casa', notes: null },
  ]
  return { tasks, lists: ['Casa', 'Familia'] }
}
