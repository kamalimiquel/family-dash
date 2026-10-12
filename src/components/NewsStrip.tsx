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

  return (
    <ul className="news-strip" aria-label="Titulares de prensa">
      {feeds.map((feed, index) => (
        <NewsWidget key={feed.url} feed={feed} index={index} />
      ))}
    </ul>
  )
}
