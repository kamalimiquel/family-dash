import type { AgendaState } from '../hooks/useAgenda'
import type { CalendarEvent } from '../lib/types'
import { formatDayLabel, formatTimeShort } from '../lib/time'

/** Cuántos eventos se enseñan de golpe: el resto no cabe en la pantalla. */
const MAX_EVENTS = 8

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

/** Widget 3: los próximos eventos del calendario. */
export function CalendarWidget({ state }: { state: AgendaState }) {
  const { events, status, reason, loading, error, receivedAt, refresh } = state

  const groups = groupByDay(events.slice(0, MAX_EVENTS))
  const hidden = Math.max(events.length - MAX_EVENTS, 0)

  const hint = reason
    ? (REASON_TEXT[reason.error] ?? reason.message)
    : error
      ? 'sin conexión con el servidor'
      : loading && events.length === 0
        ? 'consultando…'
        : null

  const stale = [reason?.error, error].some(Boolean)

  return (
    <section className="widget widget--calendar" aria-label="Agenda familiar">
      <header className="calendar__head">
        <h2 className="calendar__title">Agenda</h2>
        <div className="calendar__actions">
          {status?.email && (
            <span className="calendar__account" title={status.email}>
              {status.email.split('@')[0]}
            </span>
          )}
          <button
            type="button"
            className="calendar__refresh"
            onClick={refresh}
            aria-label="Actualizar el calendario y las tareas"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M20 11a8 8 0 1 0-2.6 5.9M20 5.5V11h-5.5" />
            </svg>
          </button>
        </div>
      </header>

      {hint && <p className="calendar__hint">{hint}</p>}

      {groups.length > 0 && (
        <ul className="calendar__days">
          {groups.map((group) => (
            <li className="calendar__day-group" key={group.day}>
              <span className="calendar__day">{formatDayLabel(group.day)}</span>
              <ul className="calendar__events">
                {group.events.map((event) => (
                  <li className="calendar__event" key={event.id}>
                    <span className="calendar__time">{eventTime(event)}</span>
                    <span className="calendar__what">
                      {event.title}
                      {event.location && <span className="calendar__where">{event.location}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {groups.length === 0 && !hint && <p className="calendar__empty">Nada apuntado estos días</p>}

      {hidden > 0 && (
        <p className="calendar__more">y {hidden} evento{hidden === 1 ? '' : 's'} más</p>
      )}

      <footer className={`calendar__foot${stale ? ' calendar__foot--warn' : ''}`}>
        <span className="calendar__status">
          {receivedAt ? `actualizado a las ${formatTimeShort(receivedAt)}` : '—'}
        </span>
        {events.length > 0 && (
          <span className="calendar__counts">
            {events.length} evento{events.length === 1 ? '' : 's'}
          </span>
        )}
      </footer>
    </section>
  )
}
