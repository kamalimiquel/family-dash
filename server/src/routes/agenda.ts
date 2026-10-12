import { Router, type NextFunction, type Request, type Response } from 'express'
import type { Db } from '../db.js'
import { getOrFetch } from '../cache.js'
import { CALENDAR_DAYS, CALENDAR_TTL_MS, TASKS_TTL_MS } from '../config.js'
import { googleStatus } from '../google/auth.js'
import { fetchEvents, type CalendarEvent } from '../google/calendar.js'
import { fetchTasks, type TasksResult } from '../google/tasks.js'

/**
 * Si el problema es que falta configurar o autorizar Google, no es un error del
 * servidor: se responde 200 con la lista vacía y `reason`, para que el widget
 * pueda explicarlo en pantalla en vez de quedarse en blanco.
 */
const SETUP_CODES = new Set(['google_not_configured', 'google_not_connected', 'invalid_grant'])

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

export function createAgendaRouter(db: Db): Router {
  const router = Router()

  router.get('/calendar', async (req: Request, res: Response, next: NextFunction) => {
    const days = clampDays(req.query.days, CALENDAR_DAYS)
    const key = `calendar:${days}`
    const status = googleStatus(db)
    const source = status.mock ? 'mock' : 'google-calendar'

    try {
      if (wantsRefresh(req.query.refresh)) db.prepare('DELETE FROM cache WHERE key = ?').run(key)

      const result = await getOrFetch<CalendarEvent[]>(
        db,
        key,
        CALENDAR_TTL_MS,
        () => fetchEvents(db, { days }),
        source,
      )

      res.set('Cache-Control', 'no-store')
      res.json({
        events: result.value,
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
    const key = 'tasks'
    const status = googleStatus(db)
    const source = status.mock ? 'mock' : 'google-tasks'

    try {
      if (wantsRefresh(req.query.refresh)) db.prepare('DELETE FROM cache WHERE key = ?').run(key)

      const result = await getOrFetch<TasksResult>(db, key, TASKS_TTL_MS, () => fetchTasks(db), source)

      res.set('Cache-Control', 'no-store')
      res.json({
        tasks: result.value.tasks,
        lists: result.value.lists,
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

  return router
}
