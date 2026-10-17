import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** server/dist (fichero compilado) → sube hasta la raíz del proyecto. */
const here = path.dirname(fileURLToPath(import.meta.url))
export const SERVER_ROOT = path.resolve(here, '..')
export const PROJECT_ROOT = path.resolve(SERVER_ROOT, '..')

/** Build de Vite que sirve Express (HTML + assets). */
export const DIST_DIR = path.join(PROJECT_ROOT, 'dist')

export const PORT = Number(process.env.PORT ?? 4173)
export const HOST = process.env.HOST ?? '0.0.0.0'

/** SQLite local: caché del tiempo, ajustes y (fase 3) tokens de Google. */
export const DB_PATH =
  process.env.DASH_DB ?? path.join(PROJECT_ROOT, 'data', 'dashboard.sqlite')

/** Carpeta de datos del panel (junto a la base de datos: la caché del PDF vive aquí). */
export const DATA_DIR = path.dirname(DB_PATH)

/** Cuánto vale una respuesta de Open-Meteo antes de volver a pedirla. */
export const WEATHER_TTL_MS = Number(process.env.WEATHER_TTL_MS ?? 15 * 60 * 1000)

/**
 * El radar de precipitación (Meteocat). La imagen se regenera cada 6 minutos, así
 * que con 5 de caché va sobrado. La vista es Cataluña entera: el radar es autonómico
 * y lo que se quiere ver de un vistazo es si llueve aquí.
 */
export const RADAR_TTL_MS = Number(process.env.RADAR_TTL_MS ?? 5 * 60 * 1000)

export const RADAR_VIEW = {
  south: 40.4,
  west: 0.05,
  north: 42.95,
  east: 3.45,
}

/** Cuántos días de calendario se piden. */
export const CALENDAR_DAYS = Number(process.env.CALENDAR_DAYS ?? 7)

/** Caché de calendario y tareas (Google aguanta bien, pero no hace falta ir cada vez). */
export const CALENDAR_TTL_MS = Number(process.env.CALENDAR_TTL_MS ?? 2 * 60 * 1000)
export const TASKS_TTL_MS = Number(process.env.TASKS_TTL_MS ?? 2 * 60 * 1000)

/** Los feeds de noticias cambian, pero no tanto: veinte minutos va sobrado. */
export const NEWS_TTL_MS = Number(process.env.NEWS_TTL_MS ?? 15 * 60 * 1000)

/** Titulares que se guardan por fuente (la pantalla enseña uno cada vez). */
export const NEWS_ITEMS_PER_SOURCE = Number(process.env.NEWS_ITEMS_PER_SOURCE ?? 8)

/**
 * El saldo de la suscripción de Nous Portal. Se pregunta cada media hora: el token de
 * acceso dura una hora y los créditos se mueven despacio, así que no hace falta más.
 */
export const PORTAL_TTL_MS = Number(process.env.PORTAL_TTL_MS ?? 30 * 60 * 1000)

/** Dónde está la familia: se pregunta a menudo porque cambia de sitio. */
export const LOCATIONS_TTL_MS = Number(process.env.LOCATIONS_TTL_MS ?? 2 * 60 * 1000)

/**
 * Fichero de cookies de Google (formato Netscape) para leer las ubicaciones
 * compartidas. Vive en `data/`, que no viaja en el despliegue ni al repositorio.
 */
export const LOCATIONS_COOKIES =
  process.env.LOCATIONS_COOKIES ?? path.join(DATA_DIR, 'google-cookies.txt')

/** Tope por feed: una web lenta no puede retrasar a las demás. */
export const NEWS_TIMEOUT_MS = Number(process.env.NEWS_TIMEOUT_MS ?? 10_000)

/** Tope de lectura por feed (un XML de noticias no llega ni de lejos). */
export const NEWS_MAX_BYTES = Number(process.env.NEWS_MAX_BYTES ?? 512 * 1024)

/**
 * Dónde está casa: el punto de referencia del mapa («a 1,2 km de casa»). Se
 * ajusta en el dispositivo como todo lo demás; por defecto no hay ninguno y el
 * mapa se limita a encuadrar a la gente que comparte su ubicación.
 */
export interface HomePlace {
  label: string
  latitude: number
  longitude: number
}

export const DEFAULT_HOME: HomePlace | null = null

/**
 * Qué calendario y qué lista de tareas enseña el panel. Son **nombres visibles**
 * («Familiar», «Familia») y se guardan en la base de datos del dispositivo: el
 * repositorio no lleva los nombres de las agendas de ninguna casa.
 */
export interface AgendaTarget {
  /** Nombre del calendario, o `primary` para el principal de la cuenta. */
  calendar: string
  /** Nombre de la lista de tareas; vacío = todas las listas. */
  taskList: string
}

export const DEFAULT_AGENDA_TARGET: AgendaTarget = { calendar: 'primary', taskList: '' }

/** Fuente de noticias: un nombre para la pantalla y la URL del feed. */
export interface NewsSource {
  name: string
  url: string
}

/**
 * Fuentes de ejemplo: medios generales, ninguna local y ninguna de casa. El panel
 * de cada casa usa las que tenga guardadas en `settings`, que se cambian con
 * `PUT /api/settings` sin tocar código.
 */
export const DEFAULT_NEWS_SOURCES: NewsSource[] = [
  { name: 'Ara', url: 'https://www.ara.cat/rss/latest/' },
  { name: 'Nació Digital', url: 'https://www.naciodigital.cat/rss' },
  { name: 'DIE ZEIT', url: 'https://newsfeed.zeit.de/index' },
  { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'The New York Times', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
]

/* --- PDF (el menú semanal que se deja en una carpeta compartida) ---------- */

/** De dónde sale el PDF: una carpeta (el más reciente) o un fichero concreto. */
export interface PdfSource {
  dir?: string
  file?: string
}

/** Cada cuánto se vuelve a mirar si el PDF ha cambiado. */
export const PDF_TTL_MS = Number(process.env.PDF_TTL_MS ?? 5 * 60 * 1000)

/** Ancho al que se rasterizan las páginas: de sobra para verlas a pantalla completa. */
export const PDF_RENDER_WIDTH = Number(process.env.PDF_RENDER_WIDTH ?? 1500)

/** Tope de páginas que se rasterizan: un menú no tiene cincuenta. */
export const PDF_MAX_PAGES = Number(process.env.PDF_MAX_PAGES ?? 12)

/**
 * PDF de ejemplo del repositorio (`docs/ejemplo/`), inventado a propósito. El
 * panel de casa apunta a su carpeta compartida con `PUT /api/settings`.
 */
export const DEFAULT_PDF_SOURCE: PdfSource = { dir: path.join(PROJECT_ROOT, 'docs', 'ejemplo') }

export interface Place {
  name: string
  country?: string
  latitude: number
  longitude: number
  timezone: string
}

/**
 * Ciudad de ejemplo (Barcelona, las coordenadas del geocoder de Open-Meteo).
 * El panel de casa usa la que tenga guardada en la tabla `settings`, que se
 * cambia con `PUT /api/settings` sin tocar código.
 */
export const DEFAULT_PLACE: Place = {
  name: 'Barcelona',
  country: 'ES',
  latitude: 41.3874,
  longitude: 2.1686,
  timezone: 'Europe/Madrid',
}

/**
 * Cuántos minutos sin que nadie toque la pantalla antes de dejarla en negro (0 = nunca).
 * Se ajusta en el dispositivo con `PUT /api/settings`, como todo lo demás: el
 * repositorio no decide cuándo se duerme la pantalla de ninguna casa, solo el valor
 * de ejemplo que se usa mientras el panel no tenga el suyo guardado.
 */
export const DEFAULT_SCREEN_IDLE_MINUTES = 5
