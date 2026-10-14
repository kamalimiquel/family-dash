/**
 * Static configuration for the dashboard.
 * Future modules (calendar, weather, tasks, news, menu) will read their
 * per-Pi settings from a Node backend; visual constants live here.
 */

export const APP_NAME = 'Family Dashboard'

/** UI language used for dates and (later) the rest of the dashboard. */
export const LOCALE = 'es-ES'

/** Cada cuánto se le vuelve a pedir el tiempo al backend (que cachea 15 min). */
export const WEATHER_REFRESH_MS = 15 * 60 * 1000

/** Cada cuánto se refresca la agenda —calendario y tareas— (cachea 2 min). */
export const AGENDA_REFRESH_MS = 2 * 60 * 1000

/** Cuántos días de calendario pide el panel. */
export const AGENDA_DAYS = 7

/** Cada cuánto se le vuelven a pedir los titulares al backend (que cachea 15 min). */
export const NEWS_REFRESH_MS = 15 * 60 * 1000

/** Cada cuánto cambia el titular que enseña cada fuente de la franja de noticias. */
export const NEWS_ROTATE_MS = 10 * 1000

/** Cada cuánto se le vuelven a pedir las ubicaciones al backend (cachea 2 min). */
export const LOCATIONS_REFRESH_MS = 2 * 60 * 1000

/** Cada cuánto pasa el mapa a la siguiente persona que comparte su ubicación. */
export const LOCATIONS_ROTATE_MS = 45 * 1000

/** Cada cuánto se vuelve a mirar si ha cambiado el PDF de la carpeta compartida. */
export const PDF_REFRESH_MS = 5 * 60 * 1000

/* Los colores del fondo animado (violeta/azul) viven en `App.css`: son estilo,
   no configuración. */
