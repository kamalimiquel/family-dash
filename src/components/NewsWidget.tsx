import { useEffect, useState } from 'react'
import { NEWS_ROTATE_MS } from '../config'
import type { NewsFeed } from '../lib/types'

interface NewsWidgetProps {
  feed: NewsFeed
  /** Posición de la tarjeta en la franja: escalona el cambio de titular. */
  index: number
}

/**
 * Una fuente de prensa: enseña un titular cada vez y va rotando sola. El arranque
 * va escalonado para que las cinco tarjetas no cambien a la vez, y el titular
 * entra con un fundido (la `key` fuerza la animación en cada cambio).
 *
 * Los titulares no son enlaces a propósito: en el kiosco, un toque dejaría el
 * panel metido en una noticia y ya no volvería solo.
 */
export function NewsWidget({ feed, index }: NewsWidgetProps) {
  const [cursor, setCursor] = useState(0)
  const total = feed.items.length

  useEffect(() => {
    if (total < 2) return

    let interval = 0
    const start = window.setTimeout(() => {
      interval = window.setInterval(() => setCursor((value) => value + 1), NEWS_ROTATE_MS)
    }, NEWS_ROTATE_MS + index * 1600)

    return () => {
      window.clearTimeout(start)
      window.clearInterval(interval)
    }
  }, [total, index])

  const position = total > 0 ? (cursor % total) + 1 : 0
  const item = total > 0 ? feed.items[cursor % total] : null

  return (
    <li className="news" data-error={feed.error ? 'true' : undefined}>
      <span className="news__source" title={feed.url}>
        {feed.name}
      </span>

      {item ? (
        <span className="news__title" key={item.title}>
          {item.title}
        </span>
      ) : (
        <span className="news__title news__title--off">
          {feed.error ? 'sin datos ahora mismo' : 'cargando…'}
        </span>
      )}

      {total > 1 && (
        <span className="news__dots" aria-hidden="true">
          {Array.from({ length: total }, (_, dot) => (
            <span className="news__dot" key={dot} data-on={dot + 1 === position ? 'true' : undefined} />
          ))}
        </span>
      )}
    </li>
  )
}
