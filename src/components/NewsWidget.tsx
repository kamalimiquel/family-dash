import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { NEWS_ROTATE_MS } from '../config'
import type { NewsFeed } from '../lib/types'

interface NewsWidgetProps {
  feed: NewsFeed
  /** Posición de la tarjeta en la franja: escalona el cambio de titular. */
  index: number
}

/** Cuánto tiene que moverse el dedo para que cuente como gesto y no como un roce. */
const DESLIZAMIENTO_MINIMO = 36

/**
 * Una fuente de prensa: enseña un titular cada vez y va rotando sola. El arranque
 * va escalonado para que las tarjetas no cambien a la vez, y el titular entra con
 * un fundido (la `key` fuerza la animación en cada cambio).
 *
 * Se puede pasar de titular deslizando el dedo por encima: hacia la izquierda, el
 * siguiente; hacia la derecha, el anterior. Al hacerlo a mano, el temporizador
 * vuelve a empezar, así que el titular que has elegido se queda el tiempo entero en
 * pantalla en vez de cambiarse a los dos segundos.
 *
 * Los titulares no son enlaces a propósito: en el kiosco, un toque dejaría el panel
 * metido en una noticia y ya no volvería solo.
 */
export function NewsWidget({ feed, index }: NewsWidgetProps) {
  const [cursor, setCursor] = useState(0)
  // Cambiar esto reinicia el temporizador (ver el efecto).
  const [vuelta, setVuelta] = useState(0)
  const desde = useRef<{ x: number; y: number } | null>(null)
  const total = feed.items.length

  useEffect(() => {
    if (total < 2) return

    let interval = 0
    // El desfase inicial es para que las tarjetas no cambien todas a la vez; tras un
    // deslizamiento ya no hace falta, porque el titular lo has pedido tú.
    const start = window.setTimeout(
      () => {
        interval = window.setInterval(() => setCursor((value) => value + 1), NEWS_ROTATE_MS)
      },
      NEWS_ROTATE_MS + (vuelta === 0 ? index * 1600 : 0),
    )

    return () => {
      window.clearTimeout(start)
      window.clearInterval(interval)
    }
  }, [total, index, vuelta])

  // El cursor puede ir hacia atrás (deslizando a la derecha), así que el módulo tiene
  // que dar siempre positivo: con un negativo, `items[-1]` sería `undefined`.
  const indice = total > 0 ? ((cursor % total) + total) % total : 0
  const position = total > 0 ? indice + 1 : 0
  const item = total > 0 ? feed.items[indice] : null

  const empezar = (evento: ReactPointerEvent<HTMLLIElement>) => {
    desde.current = { x: evento.clientX, y: evento.clientY }
    // Se queda con el puntero: así el gesto sigue contando aunque el dedo acabe fuera
    // de la tarjeta (que es lo normal al deslizar hasta el borde de la pantalla).
    evento.currentTarget.setPointerCapture?.(evento.pointerId)
  }

  const soltar = (evento: ReactPointerEvent<HTMLLIElement>) => {
    const inicio = desde.current
    desde.current = null
    if (!inicio || total < 2) return

    const dx = evento.clientX - inicio.x
    const dy = evento.clientY - inicio.y

    // Solo cuenta si el dedo va claramente en horizontal: un roce al pasar la mano por
    // delante no debe cambiar el titular.
    if (Math.abs(dx) < DESLIZAMIENTO_MINIMO || Math.abs(dx) < Math.abs(dy)) return

    setCursor((value) => value + (dx < 0 ? 1 : -1))
    setVuelta((value) => value + 1)
  }

  return (
    <li
      className="news"
      data-error={feed.error ? 'true' : undefined}
      onPointerDown={empezar}
      onPointerUp={soltar}
      onPointerCancel={() => {
        desde.current = null
      }}
    >
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
