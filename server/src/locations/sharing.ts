/**
 * Lector de las ubicaciones compartidas de Google Maps.
 *
 * Google **no tiene API** para esto, así que se reutiliza la sesión del navegador
 * (las cookies) contra su servicio interno. La petición y el mapeo de campos salen
 * de `locationsharinglib` (https://github.com/costastf/locationsharinglib), que es
 * la librería que usa Home Assistant; de ahí también la heurística de la sesión
 * caducada (`data[6] === 'GgA='`).
 *
 * Todo esto es frágil por definición: si Google cambia su servicio interno, esto
 * deja de funcionar y habrá que volver a mirarlo. Por eso el error se cuenta en la
 * pantalla en vez de disimularse.
 */
import type { LocationPerson } from './index.js'

const URL_LECTURA = 'https://www.google.com/maps/rpc/locationsharing/read'

/**
 * Los parámetros que manda la app de Maps. El `pb` solo describe cómo se encuadra
 * el mapa y a Google le da igual su contenido: estos valores son los de la librería
 * (que apuntan al centro de las oficinas de Google) y funcionan igual.
 */
const PARAMETROS = new URLSearchParams({
  authuser: '2',
  hl: 'en',
  gl: 'us',
  pb:
    '!1m7!8m6!1m3!1i14!2i8413!3i5385!2i6!3x4095!2m3!1e0!2sm!3i407105169!3m7' +
    '!2sen!5e1105!12m4!1e68!2m2!1sset!2sRoadmap!4e1!5m4!1e4!8m2!1e0!1e1!6m9' +
    '!1e12!2i2!26m1!4b1!30m1!1f1.3953487873077393!39b1!44e1!50e0!23i4111425',
})

const AGENTE =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'

export type SharingKind = 'cookies' | 'sesion' | 'respuesta'

export class SharingError extends Error {
  readonly kind: SharingKind

  constructor(message: string, kind: SharingKind) {
    super(message)
    this.name = 'SharingError'
    this.kind = kind
  }
}

/**
 * Lee un fichero de cookies en formato Netscape (el que exporta el navegador) y
 * devuelve la cabecera `Cookie`, quedándose solo con las de google.com.
 */
export function cookieHeader(contents: string): string {
  const partes: string[] = []

  for (const linea of contents.split('\n')) {
    const limpia = linea.trim()
    if (!limpia || limpia.startsWith('#')) continue

    const campos = limpia.includes('\t') ? limpia.split('\t') : limpia.split(/\s+/)
    if (campos.length < 7) continue

    const dominio = campos[0] ?? ''
    if (!dominio.endsWith('google.com')) continue

    partes.push(`${campos[5]}=${campos[6]}`)
  }

  const nombres = new Set(partes.map((parte) => parte.slice(0, parte.indexOf('='))))
  if (!nombres.has('__Secure-1PSID') && !nombres.has('__Secure-3PSID')) {
    throw new SharingError(
      'Al fichero de cookies le falta __Secure-1PSID o __Secure-3PSID',
      'cookies',
    )
  }

  return partes.join('; ')
}

/** Pide a Google las ubicaciones que otras personas comparten con esta cuenta. */
export async function fetchSharedLocations(cookie: string): Promise<LocationPerson[]> {
  let respuesta: Response
  try {
    respuesta = await fetch(`${URL_LECTURA}?${PARAMETROS}`, {
      headers: {
        cookie,
        'user-agent': AGENTE,
        accept: '*/*',
        'accept-language': 'es-ES,es;q=0.9,en;q=0.8',
        referer: 'https://www.google.com/maps',
      },
      signal: AbortSignal.timeout(20_000),
    })
  } catch (error) {
    throw new SharingError(
      `No se ha podido hablar con Google: ${error instanceof Error ? error.message : 'error'}`,
      'respuesta',
    )
  }

  if (!respuesta.ok) {
    throw new SharingError(`Google respondió ${respuesta.status}`, 'sesion')
  }

  const texto = await respuesta.text()
  const corte = texto.indexOf("'")
  if (corte < 0) {
    throw new SharingError('La respuesta no tiene el formato esperado', 'respuesta')
  }

  let datos: unknown
  try {
    datos = JSON.parse(texto.slice(corte + 1))
  } catch {
    throw new SharingError('La respuesta de Google no es JSON válido', 'respuesta')
  }

  if (!Array.isArray(datos)) {
    throw new SharingError('La respuesta de Google no es una lista', 'respuesta')
  }

  // Su heurística: cuando la sesión ya no vale, el sexto campo es esto.
  if (datos[6] === 'GgA=') {
    throw new SharingError('La sesión de Google ya no vale', 'sesion')
  }

  const entradas = Array.isArray(datos[0]) ? (datos[0] as unknown[]) : []
  const personas: LocationPerson[] = []

  for (const entrada of entradas) {
    const persona = toPerson(entrada)
    if (persona) personas.push(persona)
  }

  return personas
}

/** Traduce una entrada de Google a nuestro tipo. `null` si le falta lo esencial. */
function toPerson(entrada: unknown): LocationPerson | null {
  if (!Array.isArray(entrada)) return null

  try {
    const posicion = entrada[1] as unknown[]
    const coordenadas = posicion[1] as unknown[]
    const quien = entrada[6] as unknown[]

    const latitude = Number(coordenadas[2])
    const longitude = Number(coordenadas[1])
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

    // El sello de tiempo llega en segundos o en milisegundos según el día.
    const sello = Number(posicion[2])
    const milisegundos = sello > 1e11 ? sello : sello * 1000

    const bateria = Array.isArray(entrada[13]) ? (entrada[13] as unknown[]) : null
    const nickname = quien[3] ? String(quien[3]) : null
    const fullName = quien[2] ? String(quien[2]) : null

    return {
      name: nickname ?? fullName ?? 'Sin nombre',
      address: posicion[4] ? String(posicion[4]) : null,
      latitude,
      longitude,
      updatedAt:
        Number.isFinite(milisegundos) && milisegundos > 0
          ? new Date(milisegundos).toISOString()
          : new Date().toISOString(),
      accuracy: Number.isFinite(Number(posicion[3])) ? Number(posicion[3]) : null,
      battery:
        bateria && Number.isFinite(Number(bateria[1])) && Number(bateria[1]) > 0
          ? Number(bateria[1])
          : null,
      charging: bateria && typeof bateria[0] === 'boolean' ? (bateria[0] as boolean) : null,
    }
  } catch {
    return null
  }
}
