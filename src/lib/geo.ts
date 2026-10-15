/**
 * Cuentas de mapa que necesita el widget de ubicaciones: a qué distancia está
 * alguien de casa. Sin librerías: la Tierra es una esfera y con Haversine sobra
 * para distancias de barrio.
 */

export interface Point {
  latitude: number
  longitude: number
}

const RADIO_TIERRA_M = 6_371_000

/** Distancia en metros entre dos puntos (Haversine). */
export function distanceMeters(a: Point, b: Point): number {
  const rad = (grados: number) => (grados * Math.PI) / 180

  const dLat = rad(b.latitude - a.latitude)
  const dLon = rad(b.longitude - a.longitude)
  const lat1 = rad(a.latitude)
  const lat2 = rad(b.latitude)

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)

  return 2 * RADIO_TIERRA_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** «120 m», «1,2 km», «12 km». Con coma, que esto es para leerlo en casa. */
export function formatDistance(metros: number): string {
  if (!Number.isFinite(metros)) return '—'
  if (metros < 950) return `${Math.round(metros / 10) * 10} m`
  if (metros < 10_000) return `${(metros / 1000).toFixed(1).replace('.', ',')} km`
  return `${Math.round(metros / 1000)} km`
}
