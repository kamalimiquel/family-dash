import { Router, type NextFunction, type Request, type Response } from 'express'
import type { Db } from '../db.js'
import { getOrFetch } from '../cache.js'
import { CALENDAR_DAYS, CALENDAR_TTL_MS, TASKS_TTL_MS } from '../config.js'
import { googleStatus } from '../google/auth.js'
import { isLocalRequest } from '../local.js'
import { fetchEvents, type CalendarEvent } from '../google/calendar.js'
import { completeTask, fetchTasks, type TasksResult } from '../google/tasks.js'
import { getAgendaTarget } from '../google/target.js'

/**
 * Si el problema es que falta configurar o autorizar Google, no es un error del
 * servidor: se responde 200 con la lista vacía y `reason`, para que el widget
 * pueda explicarlo en pantalla en vez de quedarse en blanco.
 */
const SETUP_CODES = new Set([
  'google_not_configured',
  'google_not_connected',
  'invalid_grant',
  'calendar_not_found',
  'tasklist_not_found',
])

function setupReason(error: unknown): { error: string; message: string } | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String((error as { code: unknown }).code)
    if (SETUP_CODES.has(code)) {
      const message = error instanceof Error ? error.message : 'Google necesita atención'
      return { error: code, message }
    }
  }
  return null
}

const clampDays = (value: unknown, fallback: number): number => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.trunc(parsed), 1), 30)
}

const wantsRefresh = (value: unknown): boolean => value === '1' || value === 'true'

function cacheMeta(fetchedAt: number, expiresAt: number, cached: boolean, stale: boolean, source: string) {
  return {
    source,
    cached,
    stale,
    fetchedAt: new Date(fetchedAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    ttlSeconds: Math.round((expiresAt - fetchedAt) / 1000),
  }
}

/** Una fecha `YYYY-MM-DD` de la query, o cadena vacía si no es una fecha. */
function queryDate(value: unknown): string {
  const texto = String(value ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(texto) ? texto : ''
}

export function createAgendaRouter(db: Db): Router {
  const router = Router()

  router.get('/calendar', async (req: Request, res: Response, next: NextFunction) => {
    const days = clampDays(req.query.days, CALENDAR_DAYS)
    // `from` es el día desde el que empieza la semana que se enseña: la agenda se pasa con
    // el dedo, y sin esto solo se podría ver la que empieza hoy.
    const from = queryDate(req.query.from)
    const target = getAgendaTarget(db)
    // El calendario y la semana elegidos van en la clave: cambiarlos no reutiliza la caché.
    const key = `calendar:${from || 'ahora'}:${days}:${target.calendar}`
    const status = googleStatus(db)
    const source = status.mock ? 'mock' : 'google-calendar'

    try {
      if (wantsRefresh(req.query.refresh)) db.prepare('DELETE FROM cache WHERE key = ?').run(key)

      const result = await getOrFetch<CalendarEvent[]>(
        db,
        key,
        CALENDAR_TTL_MS,
        () => fetchEvents(db, { days, calendarName: target.calendar, from: from || undefined }),
        source,
      )

      res.set('Cache-Control', 'no-store')
      res.json({
        events: result.value,
        selection: { calendar: target.calendar },
        status,
        reason: null,
        meta: cacheMeta(result.fetchedAt, result.expiresAt, result.cached, result.stale, source),
      })
    } catch (error) {
      const reason = setupReason(error)
      if (!reason) return next(error)
      res.set('Cache-Control', 'no-store')
      res.json({ events: [], status, reason, meta: null })
    }
  })

  router.get('/tasks', async (req: Request, res: Response, next: NextFunction) => {
    const target = getAgendaTarget(db)
    const key = `tasks:${target.taskList}`
    const status = googleStatus(db)
    const source = status.mock ? 'mock' : 'google-tasks'

    try {
      if (wantsRefresh(req.query.refresh)) db.prepare('DELETE FROM cache WHERE key = ?').run(key)

      const result = await getOrFetch<TasksResult>(
        db,
        key,
        TASKS_TTL_MS,
        () => fetchTasks(db, { listName: target.taskList }),
        source,
      )

      res.set('Cache-Control', 'no-store')
      res.json({
        tasks: result.value.tasks,
        lists: result.value.lists,
        selection: { taskList: target.taskList },
        status,
        reason: null,
        meta: cacheMeta(result.fetchedAt, result.expiresAt, result.cached, result.stale, source),
      })
    } catch (error) {
      const reason = setupReason(error)
      if (!reason) return next(error)
      res.set('Cache-Control', 'no-store')
      res.json({ tasks: [], lists: [], status, reason, meta: null })
    }
  })

  /**
   * Marca una tarea como hecha en la cuenta de Google. Solo desde la propia máquina:
   * escribir en la cuenta de casa no es cosa de la red.
   */
  router.post('/tasks/:taskId/complete', async (req: Request, res: Response, next: NextFunction) => {
    if (!isLocalRequest(req)) {
      res.status(403).json({ error: 'solo_local', message: 'esta ruta solo se usa desde la máquina del panel' })
      return
    }

    const cuerpo = (req.body ?? {}) as { listId?: unknown }
    const listId = typeof cuerpo.listId === 'string' ? cuerpo.listId.trim() : ''
    const taskId = String(req.params.taskId ?? '').trim()

    if (!listId || !taskId) {
      res.status(400).json({ error: 'falta_lista_o_tarea', message: 'Falta listId o el id de la tarea' })
      return
    }

    try {
      await completeTask(db, listId, taskId)
      // La lista que se enseña está cacheada: sin tirarla, la tarea seguiría saliendo.
      db.prepare('DELETE FROM cache WHERE key LIKE ?').run('tasks:%')
      res.json({ ok: true })
    } catch (error) {
      const code = (error as { code?: string }).code ?? ''
      // El caso que se va a ver hasta que se vuelva a autorizar la cuenta: el permiso
      // guardado es de solo lectura y Google no deja escribir.
      if (code === 'http_403' || code === 'http_401') {
        res.status(409).json({
          error: 'sin_permiso_escritura',
          message: 'La cuenta está autorizada solo para leer: hay que volver a conectarla con permiso de escritura',
        })
        return
      }
      const reason = setupReason(error)
      if (!reason) return next(error)
      res.status(409).json({ error: reason.error, message: reason.message })
    }
  })

  return router
}
