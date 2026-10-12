import { createHash } from 'node:crypto'
import { getOrFetch } from '../cache.js'
import {
  NEWS_ITEMS_PER_SOURCE,
  NEWS_MAX_BYTES,
  NEWS_TIMEOUT_MS,
  NEWS_TTL_MS,
  type NewsSource,
} from '../config.js'
import type { Db } from '../db.js'
import { isMock } from '../mock.js'
import { mockNews } from './mock.js'
import { parseFeed, type FeedItem } from './rss.js'
import { getNewsSources } from './sources.js'

export interface NewsFeed extends NewsSource {
  items: FeedItem[]
  /** Motivo por el que esta fuente no trajo nada, si es que falló. */
  error: string | null
  /** true = la red falló y esto es lo último bueno que teníamos. */
  stale: boolean
  cached: boolean
}

export interface NewsSnapshot {
  feeds: NewsFeed[]
  meta: {
    source: string
    cached: boolean
    stale: boolean
    fetchedAt: string
    expiresAt: string
    ttlSeconds: number
  }
}

/** Una entrada de caché por fuente: si una cae, las demás no se enteran. */
const cacheKey = (url: string): string =>
  `news:${createHash('sha1').update(url).digest('hex').slice(0, 12)}`

async function download(url: string): Promise<FeedItem[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), NEWS_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': 'FamilyDashboard/1.0 (panel familiar)',
        accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5',
      },
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const xml = (await response.text()).slice(0, NEWS_MAX_BYTES)
    const items = parseFeed(xml, NEWS_ITEMS_PER_SOURCE)
    if (items.length === 0) throw new Error('el feed no traía titulares')

    return items
  } finally {
    clearTimeout(timer)
  }
}

async function loadFeed(db: Db, source: NewsSource, index: number): Promise<NewsFeed> {
  if (isMock()) {
    return { ...source, items: mockNews(source, index), error: null, stale: false, cached: false }
  }

  try {
    const result = await getOrFetch<FeedItem[]>(
      db,
      cacheKey(source.url),
      NEWS_TTL_MS,
      () => download(source.url),
      'rss',
    )
    return { ...source, items: result.value, error: null, stale: result.stale, cached: result.cached }
  } catch (error) {
    return {
      ...source,
      items: [],
      error: error instanceof Error ? error.message : String(error),
      stale: false,
      cached: false,
    }
  }
}

/**
 * Todas las fuentes en paralelo. Cada una va con su propia caché y su propio
 * error: una que se caiga no deja sin titulares a las demás.
 */
export async function getNews(db: Db, options: { refresh?: boolean } = {}): Promise<NewsSnapshot> {
  if (options.refresh) {
    db.prepare("DELETE FROM cache WHERE key LIKE 'news:%'").run()
  }

  const feeds = await Promise.all(getNewsSources(db).map((source, index) => loadFeed(db, source, index)))
  const mock = isMock()

  return {
    feeds,
    meta: {
      source: mock ? 'mock' : 'rss',
      cached: !mock && feeds.every((feed) => feed.cached),
      stale: feeds.some((feed) => feed.stale),
      fetchedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + NEWS_TTL_MS).toISOString(),
      ttlSeconds: Math.round(NEWS_TTL_MS / 1000),
    },
  }
}
