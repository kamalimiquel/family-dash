import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { RadarState } from '../hooks/useRadar'
import type { RadarFrame } from '../lib/types'
import { formatTimeShort } from '../lib/time'

/** En reposo se enseña la ciudad (la tarjeta es estrecha); desplegada, Cataluña entera. */
export type ModoRadar = 'ciudad' | 'cataluna'

/**
 * El radar de precipitación de Meteocat, sobre un mapa de Leaflet.
 *
 * Se usa en los dos estados de la tarjeta del tiempo: pequeño y encuadrado en la
 * localidad (`modo="ciudad"`) cuando la tarjeta está en reposo, y con Cataluña entera
 * (`modo="cataluna"`) cuando está desplegada. El mapa se monta una sola vez y al cambiar
 * de modo solo se reencuadra, así que pasar de uno a otro es instantáneo.
 *
 * Las teselas de Meteocat llevan una ruta con el relleno a mano
 * (`{z:02}/000/000/{x:03}/000/000/{y:03}.png`) y la `y` invertida (TMS), así que la
 * dirección de cada tesela se compone aquí. Y como el radar solo se publica al zoom 7,
 * la vista de la ciudad va con esas teselas estiradas: el producto de Meteocat tiene un
 * kilómetro por píxel, así que no se pierde nada. El mapa no recibe toques: en un kiosco,
 * un dedo encima te dejaría moviéndolo y no volverías solo.
 */
export function WeatherRadar({ state, modo = 'cataluna' }: { state: RadarState; modo?: ModoRadar }) {
  const nodo = useRef<HTMLDivElement | null>(null)
  const mapa = useRef<L.Map | null>(null)
  const capaRadar = useRef<L.TileLayer | null>(null)

  const frame = state.data
  const vista = modo === 'ciudad' ? state.data?.viewCiudad : state.data?.view
  const hayVista = Boolean(vista)

  // La vista y el zoom vigentes, para que el observador de tamaño sepa qué reencuadrar
  // aunque el modo haya cambiado desde que se montó el mapa.
  const vistaRef = useRef(vista)
  const zoomRef = useRef(ZOOM_RADAR)

  useEffect(() => {
    vistaRef.current = vista
    zoomRef.current = modo === 'ciudad' ? ZOOM_CIUDAD : ZOOM_RADAR
  }, [vista, modo])

  // El mapa se monta una vez, en cuanto se sabe qué rectángulo enseñar (los datos
  // pueden tardar, por eso el efecto depende de que haya vista).
  useEffect(() => {
    if (!nodo.current || mapa.current || !vistaRef.current) return

    const instancia = L.map(nodo.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      zoomSnap: 0,
      zoomDelta: 0.25,
      minZoom: ZOOM_MIN,
      maxZoom: ZOOM_CIUDAD + 1,
    })

    // El fondo va en su propio *pane* para poder girarlo a oscuro sin girar el radar.
    // El pane se crea el último, así que hay que bajarle el z-index a mano: si no,
    // taparía al radar (Leaflet deja el de las teselas en 200).
    const paneFondo = instancia.createPane('fondo')
    paneFondo.style.zIndex = '150'
    paneFondo.classList.add('radar__fondo')

    // Fondo: OpenStreetMap, como en el mapa de «Dónde están» (y con el mismo filtro a
    // oscuro). Las teselas del fondo de Meteocat dejan un parche gris al este.
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      pane: 'fondo',
      noWrap: true,
      minNativeZoom: ZOOM_MIN,
      maxNativeZoom: 10,
    }).addTo(instancia)

    L.control
      .attribution({ prefix: false, position: 'bottomright' })
      .addAttribution('Radar: Meteocat (SMC) · fons: © OpenStreetMap')
      .addTo(instancia)

    mapa.current = instancia

    const encuadrar = () => {
      const caja = vistaRef.current
      if (!caja) return
      instancia.invalidateSize()
      instancia.fitBounds(cuadro(caja), { padding: [4, 4], animate: false, maxZoom: zoomRef.current })
    }

    const observador = new ResizeObserver(encuadrar)
    observador.observe(nodo.current)
    encuadrar()
    // Leaflet mide el hueco al montar; si aún no ha crecido, hay que repetirlo.
    const aplazado = window.setTimeout(encuadrar, 80)

    return () => {
      window.clearTimeout(aplazado)
      observador.disconnect()
      instancia.remove()
      mapa.current = null
      capaRadar.current = null
    }
  }, [hayVista])

  // Al cambiar de estado la tarjeta (en reposo / desplegada) solo hay que reencuadrar.
  useEffect(() => {
    const instancia = mapa.current
    if (!instancia || !vista) return
    instancia.invalidateSize()
    instancia.fitBounds(cuadro(vista), { padding: [4, 4], animate: false, maxZoom: zoomRef.current })
  }, [vista, modo])

  // El radar sí cambia: cada pocos minutos hay imagen nueva.
  useEffect(() => {
    const instancia = mapa.current
    if (!instancia || !frame?.tiles?.radar) return

    capaRadar.current?.remove()
    capaRadar.current = capaTeselas(frame.tiles.radar, {
      tms: true,
      noWrap: true,
      opacity: 0.85,
      // El radar se publica **solo** a z=7 y en un rectángulo concreto (x 62-67,
      // y 78-83). Por debajo se encogen sus teselas y por encima se estiran: nunca
      // se piden teselas de otros zooms, que darían 404.
      minNativeZoom: ZOOM_RADAR,
      maxNativeZoom: ZOOM_RADAR,
    }).addTo(instancia)
  }, [frame])

  const motivo = state.error ?? state.data?.reason?.message ?? null
  // La hora del radar llega en UTC (`...Z`); se enseña en la hora de casa.
  const cuando = frame?.imageAt ? horaLocal(frame.imageAt) : null

  return (
    <div className="radar">
      <div className="radar__map" ref={nodo} />

      {motivo && <p className="radar__aviso">{state.loading ? 'cargando el radar…' : motivo}</p>}
      {!motivo && (
        <p className="radar__pie">{cuando ? `Radar de Meteocat · ${cuando}` : 'Radar de Meteocat'}</p>
      )}
    </div>
  )
}

/** El radar de Meteocat se publica a un único zoom (7). */
const ZOOM_RADAR = 7

/** El mapa nunca sale de aquí: debajo de 5 las teselas del fondo no existen. */
const ZOOM_MIN = 5

/** La ciudad, estirada desde el zoom del radar (su resolución nativa es de 1 km/px). */
const ZOOM_CIUDAD = 10

/** «2026-10-15T12:42:00Z» → «14:42» en la hora del navegador (o null si no hay fecha). */
function horaLocal(iso: string): string | null {
  const fecha = new Date(iso)
  return Number.isNaN(fecha.getTime()) ? null : formatTimeShort(fecha)
}

/** Una capa de teselas cuya dirección se compone a mano (Meteocat no usa el patrón normal). */
function capaTeselas(prefix: string, opciones: L.TileLayerOptions): L.TileLayer {
  const capa = L.tileLayer('', opciones)
  // `coords.y` viene contada desde arriba; Meteocat la cuenta desde abajo (TMS), y al
  // componer la dirección a mano no vale con `tms: true`: hay que darle la vuelta.
  capa.getTileUrl = (coords) => tesela(prefix, coords.z, coords.x, (1 << coords.z) - 1 - coords.y)
  return capa
}

/** La dirección de una tesela de Meteocat (relleno a 2 y 3 dígitos, `y` invertida con `tms`). */
function tesela(prefix: string, z: number, x: number, y: number): string {
  const relleno = (valor: number, ancho: number) => String(Math.round(valor)).padStart(ancho, '0')
  return `${prefix}/${relleno(z, 2)}/000/000/${relleno(x, 3)}/000/000/${relleno(y, 3)}.png`
}

/** El rectángulo de la vista, como `LatLngBounds` de Leaflet. */
function cuadro(view: RadarFrame['view']): L.LatLngBounds {
  return L.latLngBounds([view.south, view.west], [view.north, view.east])
}
