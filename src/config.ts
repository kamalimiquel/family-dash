/**
 * Static configuration for the dashboard.
 * Future modules (calendar, weather, tasks, news, menu) will read their
 * per-Pi settings from a Node backend; visual constants live here.
 */

export const APP_NAME = 'Family Dashboard'

/** UI language used for dates and (later) the rest of the dashboard. */
export const LOCALE = 'es-ES'

/** Cada cuánto se le vuelve a pedir el tiempo al backend (el backend cachea 10 min). */
export const WEATHER_REFRESH_MS = 10 * 60 * 1000

/** Background photo — La Sagrada Família, Barcelona. */
export const PHOTO = {
  src: '/sagrada-familia.jpg',
  caption: 'La Sagrada Família, façana de la Nativitat (Plaça de Gaudí)',
  author: 'Txllxt TxllxT',
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  sourceUrl:
    'https://commons.wikimedia.org/wiki/File:Barcelona_-_Pla%C3%A7a_de_Gaud%C3%AD_-_View_SW_on_La_Sagrada_Fam%C3%ADlia_-_Nativity_fa%C3%A7ade_I.jpg',
} as const
