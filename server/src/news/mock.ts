import type { NewsSource } from '../config.js'
import type { FeedItem } from './rss.js'

/**
 * Titulares simulados para poder trabajar en la interfaz sin salir a internet
 * (DASH_MOCK=1). Son genéricos a propósito: los titulares de verdad los pone
 * cada casa en su base de datos.
 */
const EXAMPLES = [
  'El ayuntamiento abre el plazo de las colonias de verano',
  'La biblioteca del barrio amplía el horario de los sábados',
  'Empiezan las obras de la nueva pasarela sobre el río',
  'La feria de artesanos vuelve el primer fin de semana de mes',
  'Sube un 4 % el uso del autobús urbano este trimestre',
  'Una exposición repasa cien años de fotografía local',
  'El mercado municipal estrena recogida de residuos orgánicos',
  'Los huertos comunitarios doblan sus parcelas este año',
]

export function mockNews(source: NewsSource, index = 0): FeedItem[] {
  const now = Date.now()
  // Cada fuente empieza por un titular distinto (si no, las cinco tarjetas
  // enseñarían lo mismo y parecería rota). El paso de 3 sobre 8 titulares
  // reparte sin repetir para las cinco fuentes de ejemplo.
  const offset = (index * 3) % EXAMPLES.length

  return Array.from({ length: 6 }, (_, position) => {
    const title = EXAMPLES[(offset + position) % EXAMPLES.length] ?? EXAMPLES[0] ?? ''
    return {
      title,
      link: source.url,
      date: new Date(now - position * 45 * 60 * 1000).toISOString(),
    }
  })
}
