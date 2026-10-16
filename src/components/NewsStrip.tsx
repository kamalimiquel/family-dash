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

  // Una columna por fuente, siempre: es la única forma de que las tarjetas queden en
  // UNA fila. Con dos columnas y cuatro fuentes salen dos filas de tarjetas dentro de
  // una franja que solo tiene alto para una, y la de abajo se sale por debajo del
  // margen de la pantalla (medido: el borde de abajo quedaba a -39 px en vez de a 20).
  const columns = feeds.length

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
