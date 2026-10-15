import type { Db } from '../db.js'
import { getOrFetch } from '../cache.js'
import { RADAR_TTL_MS, RADAR_VIEW } from '../config.js'

/**
 * El radar de precipitación de Meteocat (Servei Meteorològic de Catalunya).
 *
 * Meteocat no tiene API pública, pero sí publica las **teselas** de su radar y un
 * fichero con la hora de la última imagen, que es lo que usa su propio giny
 * (`static-m.meteo.cat/ginys/mapaRadar`). Aquí se leen esos dos datos y el navegador
 * monta un mapa de Leaflet con las teselas encima. Cero claves y cero facturas, y a
 * cambio hay que respetarles el invento: se cachea y se les acredita en pantalla.
 *
 * El radar se publica **a un solo zoom (7)** y en un rectángulo concreto (las teselas
 * x 62-67, y 78-83), así que la capa lo dice y no se piden teselas de otros zooms.
 * El fondo es de OpenStreetMap, no el suyo: sus teselas de mar salen de un gris plano
 * que, girado a oscuro, deja un parche feo al este de Cataluña.
 *
 * La ruta de una tesela es peculiar (GeoWebCache con el relleno a mano):
 *
 *   {base}/{z:02}/000/000/{x:03}/000/000/{y:03}.png
 *   {radar}/{año}/{mes}/{día}/{hora}/{minuto}/{z:02}/000/000/{x:03}/000/000/{y:03}.png
 *
 * y la `y` va **invertida** (TMS), que en Leaflet es `tms: true`.
 */
const BASE = 'https://static-m.meteo.cat'
const ULTIMA_IMAGEN = `${BASE}/ginys/referencia/tiles/dates-tiles-CAPPI_0m.json`
const CLAVE = 'radar:meteocat'

export interface RadarFrame {
  /** ISO 8601 (UTC) de la imagen de radar. */
  imageAt: string
  /** ISO 8601 (UTC) de la última vez que Meteocat dijo cuál era. */
  systemAt: string
  /** Trozos de la ruta de las teselas del radar de esta imagen. */
  path: { year: string; month: string; day: string; hour: string; minute: string }
  /** Prefijo de las teselas del radar: el navegador añade /{z}/000/000/{x}/000/000/{y}.png */
  tiles: { radar: string }
  /** Rectángulo que hay que enseñar (Cataluña). */
  view: { south: number; west: number; north: number; east: number }
  /** A quién hay que acreditar. */
  credit: string
}

interface Respuesta {
  dataUltimaImatge?: string
  dataSistema?: string
}

/** «10/15/2026 12:42Z» → { year, month, day, hour, minute } */
export function parseStamp(value: string): RadarFrame['path'] | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})Z?$/.exec(value.trim())
  if (!m) return null
  const [, month, day, year, hour, minute] = m
  return { year: year as string, month: month as string, day: day as string, hour: hour as string, minute: minute as string }
}

/** «10/15/2026 12:42Z» → ISO 8601 en UTC. */
export function parseIso(value: string): string | null {
  const partes = parseStamp(value)
  if (!partes) return null
  return `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}:00Z`
}

async function pedirUltimaImagen(): Promise<string> {
  const respuesta = await fetch(ULTIMA_IMAGEN, {
    headers: { accept: 'application/json', 'user-agent': 'family-dash/1.0 (+panel familiar)' },
    signal: AbortSignal.timeout(10_000),
  })

  if (!respuesta.ok) throw new Error(`Meteocat respondió ${respuesta.status}`)
  const datos = (await respuesta.json()) as Respuesta
  if (!datos.dataUltimaImatge) throw new Error('Meteocat no dice cuál es la última imagen')
  return datos.dataUltimaImatge
}

/** El marco de radar más reciente que publica Meteocat (cacheado 5 min). */
export async function getRadar(db: Db): Promise<RadarFrame> {
  const cache = await getOrFetch<RadarFrame>(db, CLAVE, RADAR_TTL_MS, async () => {
    const última = await pedirUltimaImagen()
    const path = parseStamp(última)
    const iso = parseIso(última)

    if (!path || !iso) throw new Error('Meteocat cambió el formato de la fecha')

    return {
      imageAt: iso,
      systemAt: iso,
      path,
      tiles: {
        radar: `${BASE}/tiles/radar/${path.year}/${path.month}/${path.day}/${path.hour}/${path.minute}`,
      },
      view: RADAR_VIEW,
      credit: 'Radar: Meteocat (SMC)',
    } satisfies RadarFrame
  }, 'meteocat-radar')

  return cache.value
}
