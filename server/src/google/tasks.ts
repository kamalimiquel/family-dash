import type { Db } from '../db.js'
import { isMock } from './auth.js'
import { googleFetch } from './api.js'
import { mockTasks } from './mock.js'

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

/** Tareas pendientes de todas las listas, primero las que tienen fecha. */
export async function fetchTasks(db: Db, maxLists = 5): Promise<TasksResult> {
  if (isMock()) return mockTasks()

  const listsData = await googleFetch<GoogleTaskList>(db, `${TASKS_API}/users/@me/lists?maxResults=100`)
  const lists = (listsData.items ?? []).filter((list) => list.id).slice(0, maxLists)

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
