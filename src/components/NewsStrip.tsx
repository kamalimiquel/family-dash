import type { CSSProperties } from 'react'
import type { NewsState } from '../hooks/useNews'
import { NewsWidget } from './NewsWidget'

/**
 * Franja de titulares, abajo del todo: una tarjeta por fuente configurada, cada
 * una rotando sus propios titulares. Si el backend aún no ha contestado (o no hay
 * fuentes), no se enseña nada en vez de dejar un hueco vacío.
 */
export function NewsStrip({ state }: { state: NewsState }) {
  const feeds = state.data?.feeds ?? []
  if (feeds.length === 0) return null

  // Con dos fuentes o menos, una columna; con tres o cuatro, dos; con más, tres.
  const columns = feeds.length <= 2 ? 1 : feeds.length <= 4 ? 2 : 3

  return (
    <ul
      className="news-strip"
      style={{ '--news-cols': columns } as CSSProperties}
      aria-label="Titulares de prensa"
    >
      {feeds.map((feed, index) => (
        <NewsWidget key={feed.url} feed={feed} index={index} />
      ))}
    </ul>
  )
}
