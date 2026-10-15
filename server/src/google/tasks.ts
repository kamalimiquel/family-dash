import type { Db } from '../db.js'
import { isMock } from './auth.js'
import { googleFetch } from './api.js'
import { mockTasks } from './mock.js'
import { AgendaTargetError, normalizeName } from './target.js'

const TASKS_API = 'https://tasks.googleapis.com/tasks/v1'

export interface TaskItem {
  id: string
  title: string
  /** `YYYY-MM-DD` o null si no tiene fecha. */
  due: string | null
  list: string
  notes: string | null
}

export interface TasksResult {
  tasks: TaskItem[]
  lists: string[]
}

interface GoogleTaskList {
  items?: { id?: string; title?: string }[]
}

interface GoogleTask {
  id?: string
  title?: string
  due?: string
  notes?: string
  status?: string
  deleted?: boolean
}

interface GoogleTasksPage {
  items?: GoogleTask[]
}

export interface FetchTasksOptions {
  /** Nombre visible de la lista que se enseña («Familia»); vacío = todas. */
  listName?: string
  /** Cuántas listas se miran cuando no se ha elegido ninguna (por defecto 5). */
  maxLists?: number
}

/**
 * Tareas pendientes de una lista concreta (o de todas), primero las que tienen
 * fecha. Si se pide una lista que no existe, se avisa con `tasklist_not_found`
 * en vez de enseñar una tarjeta vacía sin explicación.
 */
export async function fetchTasks(db: Db, options: FetchTasksOptions = {}): Promise<TasksResult> {
  if (isMock()) return mockTasks()

  const { listName = '', maxLists = 5 } = options

  const listsData = await googleFetch<GoogleTaskList>(
    db,
    `${TASKS_API}/users/@me/lists?maxResults=100&fields=items(id,title)`,
  )
  const all = (listsData.items ?? []).filter((list) => list.id)

  const wanted = listName.trim()
  let lists = all.slice(0, maxLists)
  if (wanted) {
    const wantedKey = normalizeName(wanted)
    lists = all.filter((list) => normalizeName(list.title ?? '') === wantedKey)
    if (lists.length === 0) {
      throw new AgendaTargetError('tasklist_not_found', `No encuentro la lista de tareas «${wanted}»`)
    }
  }

  const collected: TaskItem[] = []
  const listTitles: string[] = []

  for (const list of lists) {
    const title = list.title?.trim() || 'Tareas'
    listTitles.push(title)

    const url = new URL(`${TASKS_API}/lists/${encodeURIComponent(list.id ?? '')}/tasks`)
    url.searchParams.set('showCompleted', 'false')
    url.searchParams.set('showHidden', 'false')
    url.searchParams.set('maxResults', '100')
    url.searchParams.set('fields', 'items(id,title,due,notes,status,deleted)')

    const page = await googleFetch<GoogleTasksPage>(db, url.toString())

    for (const task of page.items ?? []) {
      if (!task.id || task.deleted || task.status === 'completed') continue
      collected.push({
        id: task.id,
        title: task.title?.trim() || '(sin título)',
        due: task.due?.slice(0, 10) ?? null,
        list: title,
        notes: task.notes?.trim() || null,
      })
    }
  }

  // Con fecha primero (y por fecha); las que no tienen fecha, al final.
  collected.sort((a, b) => {
    if (a.due && b.due) return a.due.localeCompare(b.due)
    if (a.due) return -1
    if (b.due) return 1
    return a.title.localeCompare(b.title)
  })

  return { tasks: collected, lists: listTitles }
}
