import type { AgendaState } from '../hooks/useAgenda'
import type { CalendarEvent } from '../lib/types'
import { formatDayLabel, formatDueLabel, formatTimeShort } from '../lib/time'

/** Cuánto se enseña de golpe: el resto no cabe (ni hace falta) en la pantalla. */
const MAX_EVENTS = 4
const MAX_TASKS = 2

/** Motivos de "todavía no hay datos" explicados para la familia. */
const REASON_TEXT: Record<string, string> = {
  google_not_configured: 'Falta conectar la app de Google',
  google_not_connected: 'Conecta tu cuenta de Google para ver la agenda',
  invalid_grant: 'La autorización caducó: hay que volver a conectar la cuenta',
}

const eventTime = (event: CalendarEvent): string =>
  event.allDay ? 'Todo el día' : event.start.slice(11, 16)

interface DayGroup {
  day: string
  events: CalendarEvent[]
}

function groupByDay(events: CalendarEvent[]): DayGroup[] {
  const groups: DayGroup[] = []
  for (const event of events) {
    const last = groups[groups.length - 1]
    if (last && last.day === event.day) last.events.push(event)
    else groups.push({ day: event.day, events: [event] })
  }
  return groups
}

/** Widget 3: próximos eventos del calendario y tareas pendientes. */
export function AgendaWidget({ state }: { state: AgendaState }) {
  const { events, tasks, status, reason, loading, error, receivedAt, refresh } = state

  const groups = groupByDay(events.slice(0, MAX_EVENTS))
  const visibleTasks = tasks.slice(0, MAX_TASKS)
  const hiddenEvents = Math.max(events.length - MAX_EVENTS, 0)
  const hiddenTasks = Math.max(tasks.length - MAX_TASKS, 0)

  const hint = reason
    ? (REASON_TEXT[reason.error] ?? reason.message)
    : error
      ? 'sin conexión con el servidor'
      : loading && events.length === 0
        ? 'consultando…'
        : null

  const stale = [reason?.error, error].some(Boolean)

  return (
    <section className="widget widget--agenda" aria-label="Agenda familiar">
      <header className="agenda__head">
        <h2 className="agenda__title">Agenda</h2>
        <div className="agenda__actions">
          {status?.email && (
            <span className="agenda__account" title={status.email}>
              {status.email.split('@')[0]}
            </span>
          )}
          <button
            type="button"
            className="agenda__refresh"
            onClick={refresh}
            aria-label="Actualizar la agenda"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M20 11a8 8 0 1 0-2.6 5.9M20 5.5V11h-5.5" />
            </svg>
          </button>
        </div>
      </header>

      {hint && <p className="agenda__hint">{hint}</p>}

      {groups.length > 0 && (
        <ul className="agenda__days">
          {groups.map((group) => (
            <li className="agenda__day-group" key={group.day}>
              <span className="agenda__day">{formatDayLabel(group.day)}</span>
              <ul className="agenda__events">
                {group.events.map((event) => (
                  <li className="agenda__event" key={event.id}>
                    <span className="agenda__time">{eventTime(event)}</span>
                    <span className="agenda__what">
                      {event.title}
                      {event.location && <span className="agenda__where">{event.location}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {groups.length === 0 && !hint && <p className="agenda__empty">Nada apuntado estos días</p>}

      {hiddenEvents > 0 && (
        <p className="agenda__more">y {hiddenEvents} evento{hiddenEvents === 1 ? '' : 's'} más</p>
      )}

      {visibleTasks.length > 0 && (
        <div className="agenda__tasks">
          <h3 className="agenda__subtitle">Tareas</h3>
          <ul className="agenda__task-list">
            {visibleTasks.map((task) => {
              const due = formatDueLabel(task.due)
              return (
                <li className="agenda__task" key={task.id}>
                  <span className="agenda__bullet" aria-hidden="true" />
                  <span className="agenda__task-title">{task.title}</span>
                  {due && (
                    <span className="agenda__due" data-late={due === 'vencida' ? 'true' : undefined}>
                      {due}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
          {hiddenTasks > 0 && (
            <p className="agenda__more">
              y {hiddenTasks} tarea{hiddenTasks === 1 ? '' : 's'} más
            </p>
          )}
        </div>
      )}

      <footer className={`agenda__foot${stale ? ' agenda__foot--warn' : ''}`}>
        <span className="agenda__status">
          {receivedAt ? `actualizado a las ${formatTimeShort(receivedAt)}` : '—'}
        </span>
        {(events.length > 0 || tasks.length > 0) && (
          <span className="agenda__counts">
            {events.length} evento{events.length === 1 ? '' : 's'} · {tasks.length} tarea
            {tasks.length === 1 ? '' : 's'}
          </span>
        )}
      </footer>
    </section>
  )
}
