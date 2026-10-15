import type { AgendaState } from '../hooks/useAgenda'
import { formatDueLabel, formatTimeShort } from '../lib/time'

/** Cuántas tareas se enseñan de golpe; el resto va contado en el pie. */
const MAX_TASKS = 10

/** Motivos de "todavía no hay datos" explicados para la familia. */
const REASON_TEXT: Record<string, string> = {
  google_not_configured: 'Falta conectar la app de Google',
  google_not_connected: 'Conecta tu cuenta de Google para ver las tareas',
  invalid_grant: 'La autorización caducó: hay que volver a conectar la cuenta',
}

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`

/** Widget 4: las tareas pendientes de Google Tasks. */
export function TasksWidget({ state }: { state: AgendaState }) {
  const { tasks, reason, loading, error, receivedAt } = state

  const visible = tasks.slice(0, MAX_TASKS)
  const hidden = Math.max(tasks.length - MAX_TASKS, 0)
  const lists = [...new Set(tasks.map((task) => task.list))]
  // Con una sola lista se enseña su nombre («Familia»); con varias, cuántas hay.
  const listLabel =
    lists.length === 1 ? lists[0] : lists.length > 1 ? plural(lists.length, 'lista', 'listas') : null

  const hint = reason
    ? (REASON_TEXT[reason.error] ?? reason.message)
    : error
      ? 'sin conexión con el servidor'
      : loading && tasks.length === 0
        ? 'consultando…'
        : null

  const stale = [reason?.error, error].some(Boolean)

  return (
    <section className="widget widget--tasks" aria-label="Tareas pendientes">
      <header className="tasks__head">
        <h2 className="tasks__heading">Tareas</h2>
        {tasks.length > 0 && (
          <span className="tasks__count">{plural(tasks.length, 'pendiente', 'pendientes')}</span>
        )}
      </header>

      {hint && <p className="tasks__hint">{hint}</p>}

      {visible.length > 0 && (
        <ul className="tasks__list">
          {visible.map((task) => {
            const due = formatDueLabel(task.due)
            return (
              <li className="tasks__item" key={task.id}>
                <span className="tasks__bullet" aria-hidden="true" />
                <span className="tasks__title">{task.title}</span>
                {due && (
                  <span className="tasks__due" data-late={due === 'vencida' ? 'true' : undefined}>
                    {due}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {visible.length === 0 && !hint && <p className="tasks__empty">Nada pendiente</p>}

      {hidden > 0 && (
        <p className="tasks__more">y {plural(hidden, 'tarea más', 'tareas más')}</p>
      )}

      <footer className={`tasks__foot${stale ? ' tasks__foot--warn' : ''}`}>
        <span className="tasks__status">
          {receivedAt ? `actualizado a las ${formatTimeShort(receivedAt)}` : '—'}
        </span>
        {listLabel && <span className="tasks__lists">{listLabel}</span>}
      </footer>
    </section>
  )
}
