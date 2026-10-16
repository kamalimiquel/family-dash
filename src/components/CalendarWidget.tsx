import { useRef } from 'react'
import type { AgendaState } from '../hooks/useAgenda'
import { LOCALE } from '../config'
import type { CalendarEvent } from '../lib/types'
import { formatDayLabel, formatTimeShort } from '../lib/time'

/** Cuántos eventos se enseñan de golpe: el resto no cabe en la pantalla. */
const MAX_EVENTS = 8

/** Cuánto tiene que moverse el dedo para que cuente como gesto y no como un roce. */
const DESLIZAMIENTO_MINIMO = 36

/** Motivos de "todavía no hay datos" explicados para la familia. */
const REASON_TEXT: Record<string, string> = {
  google_not_configured: 'Falta conectar la app de Google',
  google_not_connected: 'Conecta tu cuenta de Google para ver la agenda',
  invalid_grant: 'La autorización caducó: hay que volver a conectar la cuenta',
}

const eventTime = (event: CalendarEvent): string =>
  event.allDay ? 'Todo el día' : event.start.slice(11, 16)

/** «20 oct – 26 oct», para saber qué semana se está viendo cuando no es la de hoy. */
function rangoDeLaSemana(offset: number): string {
  const desde = new Date()
  desde.setDate(desde.getDate() + offset * 7)
  const hasta = new Date(desde)
  hasta.setDate(hasta.getDate() + 6)

  const formato = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' })
  return `${formato.format(desde)} – ${formato.format(hasta)}`
}

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

/**
 * Widget 3: los próximos eventos del calendario.
 *
 * La agenda se pasa de semana deslizando el dedo por encima: **a la izquierda, la semana
 * siguiente; a la derecha, la anterior** (el mismo sentido que los titulares). Mientras no
 * sea la semana de hoy, la cabecera lo dice y aparece un botón para volver.
 *
 * El gesto se queda con el puntero (`setPointerCapture`), así que sigue contando aunque el
 * dedo acabe fuera de la tarjeta, que es lo normal al deslizar hasta el borde. Y con
 * `touch-action: pan-y` el desplazamiento de dentro de la agenda (vertical) se sigue
 * llevando el navegador: nosotros solo nos quedamos el horizontal.
 */
export function CalendarWidget({ state }: { state: AgendaState }) {
  const { events, status, reason, loading, error, receivedAt, refresh, weekOffset, moveWeek, goToday } = state

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

  // Última posición del dedo al empezar: el gesto se decide al soltar. Va en un `ref` y no
  // en una variable normal porque cualquier repintado (la agenda se refresca sola cada dos
  // minutos) la borraría y el deslizamiento se perdería a medias.
  const desde = useRef<{ x: number; y: number } | null>(null)

  return (
    <section
      className="widget widget--calendar"
      aria-label="Agenda familiar"
      onPointerDown={(evento) => {
        desde.current = { x: evento.clientX, y: evento.clientY }
        evento.currentTarget.setPointerCapture?.(evento.pointerId)
      }}
      onPointerUp={(evento) => {
        const inicio = desde.current
        desde.current = null
        if (!inicio) return

        const dx = evento.clientX - inicio.x
        const dy = evento.clientY - inicio.y
        // Solo cuenta si el dedo va claramente en horizontal: un roce al pasar la mano por
        // delante no debe cambiar de semana.
        if (Math.abs(dx) < DESLIZAMIENTO_MINIMO || Math.abs(dx) < Math.abs(dy)) return

        // Como se pidió: a la izquierda, la semana siguiente; a la derecha, la anterior.
        moveWeek(dx < 0 ? 1 : -1)
      }}
      onPointerCancel={() => {
        desde.current = null
      }}
    >
      <header className="calendar__head card-head">
        <h2 className="calendar__title card-title">Agenda</h2>
        <div className="calendar__actions">
          {weekOffset !== 0 && (
            <>
              <span className="calendar__week card-meta">{rangoDeLaSemana(weekOffset)}</span>
              <button type="button" className="calendar__today" onClick={goToday}>
                Hoy
              </button>
            </>
          )}
          {status?.email && (
            <span className="calendar__account card-meta" title={status.email}>
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

      {hint && <p className="calendar__hint card-hint">{hint}</p>}

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

      {groups.length === 0 && !hint && (
        <p className="calendar__empty card-empty">
          {weekOffset === 0 ? 'Nada apuntado estos días' : 'Nada apuntado esa semana'}
        </p>
      )}

      {hidden > 0 && (
        <p className="calendar__more card-more">
          y {hidden} evento{hidden === 1 ? '' : 's'} más
        </p>
      )}

      <footer className={`calendar__foot card-foot${stale ? ' card-foot--warn' : ''}`}>
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
