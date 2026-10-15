import { useCallback, useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { LocationsState } from '../hooks/useLocations'
import { distanceMeters, formatDistance } from '../lib/geo'

/**
 * Widget del mapa: dónde está la familia que comparte su ubicación con Google Maps.
 *
 * Se pinta con Leaflet sobre las teselas de OpenStreetMap: no necesita clave de API
 * y, a diferencia del *embed* de Google (que solo sabe marcar un punto), puede
 * enseñar **casa y todos a la vez** y encuadrar el mapa para que quepan, que es lo
 * que hace falta para leer una posición «respecto a casa».
 *
 * El mapa no recibe toques (`pointer-events: none`): en un kiosco, un dedo encima
 * te dejaría moviendo el mapa y no volverías solo (la misma razón por la que los
 * titulares de prensa no son enlaces).
 */
export function MapWidget({ state }: { state: LocationsState }) {
  // `state.data` cambia entero en cada respuesta: memorizar evita rehacer los
  // marcadores en cada render (y que la cámara del mapa dé tirones).
  const people = useMemo(() => state.data?.people ?? [], [state.data])
  const home = state.data?.home ?? null

  const mapa = useRef<L.Map | null>(null)
  const capa = useRef<L.LayerGroup | null>(null)
  const observador = useRef<ResizeObserver | null>(null)

  /*
   * El contenedor del mapa NO existe en el primer render: esta tarjeta empieza
   * enseñando «Buscando…» y el hueco del mapa aparece cuando ya hay gente. Por eso
   * el mapa se crea con una *callback ref* (se llama cuando el nodo entra o sale
   * del DOM) y no con un `useEffect` de dependencias vacías: ese se ejecutaba una
   * sola vez, con el nodo todavía a `null`, y Leaflet no llegaba a inicializarse
   * nunca (el hueco se quedaba negro).
   */
  const montarMapa = useCallback((nodo: HTMLDivElement | null) => {
    observador.current?.disconnect()
    observador.current = null

    mapa.current?.remove()
    mapa.current = null
    capa.current = null

    if (!nodo) return

    const instancia = L.map(nodo, {
      zoomControl: false,
      attributionControl: true,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      zoomSnap: 0.25,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(instancia)

    capa.current = L.layerGroup().addTo(instancia)
    mapa.current = instancia

    // La tarjeta crece cuando llegan los datos: sin esto, Leaflet mide el hueco
    // cuando aún no tiene tamaño y las teselas salen a medias.
    const vigilante = new ResizeObserver(() => instancia.invalidateSize())
    vigilante.observe(nodo)
    observador.current = vigilante
  }, [])

  useEffect(() => {
    const instancia = mapa.current
    const grupo = capa.current
    if (!instancia || !grupo) return

    grupo.clearLayers()

    const puntos: L.LatLngExpression[] = []

    if (home) {
      const punto: L.LatLngExpression = [home.latitude, home.longitude]
      puntos.push(punto)
      L.marker(punto, {
        icon: L.divIcon({
          className: 'map__pin map__pin--home',
          html: casaSvg(),
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
        title: home.label,
      }).addTo(grupo)
    }

    for (const persona of people) {
      const punto: L.LatLngExpression = [persona.latitude, persona.longitude]
      puntos.push(punto)

      if (home) {
        // La línea deja claro «desde casa», que es lo que se mira de un vistazo.
        L.polyline([[home.latitude, home.longitude], punto], {
          color: '#7dd3fc',
          weight: 2,
          opacity: 0.5,
          dashArray: '4 6',
        }).addTo(grupo)
      }

      L.marker(punto, {
        icon: L.divIcon({
          className: 'map__pin map__pin--person',
          html: `<span>${inicial(persona.name)}</span>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
        title: persona.name,
      }).addTo(grupo)
    }

    if (puntos.length === 1) instancia.setView(puntos[0] as L.LatLng, 15)
    else if (puntos.length > 1) instancia.fitBounds(L.latLngBounds(puntos), { padding: [26, 26] })
  }, [people, home])

  const motivo = state.error ?? state.data?.reason?.message ?? 'Todavía no hay ubicaciones que enseñar.'

  return (
    <section className="widget widget--map" aria-label="Dónde está la familia">
      <header className="map__head">
        <h2 className="map__title">Dónde están</h2>
        {home && <span className="map__count">{home.label}</span>}
      </header>

      {people.length > 0 ? (
        <>
          <div className="map__frame">
            <div className="map__map" ref={montarMapa} />

            <div className="map__placard">
              {people.map((persona) => (
                <div className="map__row" key={persona.name}>
                  <span className="map__name">{persona.name}</span>
                  {home && (
                    <span className="map__dist">
                      {formatDistance(
                        distanceMeters(home, { latitude: persona.latitude, longitude: persona.longitude }),
                      )}
                    </span>
                  )}
                  <span className="map__when">{haceCuanto(persona.updatedAt)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <p className="map__empty">{state.loading ? 'Buscando…' : motivo}</p>
      )}

      <footer className="map__foot">
        <span className="map__hint">
          {home
            ? 'Ubicaciones compartidas en Google Maps · distancia en línea recta desde casa'
            : 'Ubicaciones compartidas en Google Maps · falta configurar dónde está casa'}
        </span>
      </footer>
    </section>
  )
}

/** La primera letra del nombre, para el pin (mayúscula y sin emojis de más). */
function inicial(nombre: string): string {
  return (nombre.trim()[0] ?? '?').toUpperCase()
}

/** Una casa pequeña, dibujada a mano para no depender de imágenes del paquete. */
function casaSvg(): string {
  return (
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
    '<path fill="currentColor" d="M12 3.2 2.8 10.6a1 1 0 0 0 .62 1.78H5v7.4a1 1 0 0 0 1 1h3.6v-5.2h4.8v5.2H18a1 1 0 0 0 1-1v-7.4h1.58a1 1 0 0 0 .62-1.78z"/>' +
    '</svg>'
  )
}

/** «ahora mismo», «hace 3 min», «hace 2 h». */
function haceCuanto(iso: string): string {
  const minutos = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (minutos < 1) return 'ahora mismo'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.round(minutos / 60)
  return horas < 24 ? `hace ${horas} h` : `hace ${Math.round(horas / 24)} días`
}
