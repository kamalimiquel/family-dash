import { useEffect, useState } from 'react'
import { LOCATIONS_ROTATE_MS } from '../config'
import type { LocationsState } from '../hooks/useLocations'
import type { LocationPerson } from '../lib/types'

/**
 * Widget del mapa: dónde está la familia que comparte su ubicación con Google Maps.
 *
 * Se pinta con el *embed* de Google, que no necesita clave de API… y por eso solo
 * sabe enseñar **un punto por mapa**. De ahí que la tarjeta vaya rotando de persona
 * en persona cada LOCATIONS_ROTATE_MS, con su nombre, su dirección y de cuándo es la
 * posición.
 *
 * El iframe lleva `pointer-events: none` a propósito: el embed trae enlaces a Google
 * Maps y, en un kiosco, un toque te dejaría fuera del panel y no volverías solo (la
 * misma razón por la que los titulares de prensa no son enlaces).
 */
export function MapWidget({ state }: { state: LocationsState }) {
  const people = state.data?.people ?? []
  const [index, setIndex] = useState(0)

  // Si el número de personas cambia (alguien deja de compartir), no te salgas de rango.
  const actual = people.length > 0 ? index % people.length : 0
  const person = people[actual] ?? null

  useEffect(() => {
    if (people.length < 2) return
    const timer = window.setInterval(
      () => setIndex((value) => (value + 1) % people.length),
      LOCATIONS_ROTATE_MS,
    )
    return () => window.clearInterval(timer)
  }, [people.length])

  const motivo = state.error ?? state.data?.reason?.message ?? 'Todavía no hay ubicaciones que enseñar.'

  return (
    <section className="widget widget--map" aria-label="Dónde está la familia">
      <header className="map__head">
        <h2 className="map__title">Dónde están</h2>
        {people.length > 1 && (
          <span className="map__count">
            {actual + 1}/{people.length}
          </span>
        )}
      </header>

      {person ? (
        <>
          <div className="map__frame">
            <iframe
              key={`${person.name}-${person.latitude}-${person.longitude}`}
              className="map__iframe"
              title={`Mapa de ${person.name}`}
              src={embedUrl(person)}
              referrerPolicy="no-referrer"
            />

            {/* Ojo: el embed dibuja su propio pin, pero tarda en aparecer (llega
                después de los tiles). No concluyas que no marca el punto por una
                captura temprana: espera y vuelve a mirar. */}
            <div className="map__placard">
              <span className="map__name">{person.name}</span>
              {person.address && <span className="map__address">{person.address}</span>}
              <span className="map__when">{haceCuanto(person.updatedAt)}</span>
            </div>
          </div>

          {people.length > 1 && (
            <div className="map__dots" aria-hidden="true">
              {people.map((otra, posicion) => (
                <span
                  className={`map__dot${posicion === actual ? ' map__dot--on' : ''}`}
                  key={otra.name}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="map__empty">{state.loading ? 'Buscando…' : motivo}</p>
      )}

      <footer className="map__foot">
        <span className="map__hint">
          {person ? 'Ubicaciones compartidas en Google Maps' : 'Falta conectar Google Maps'}
        </span>
      </footer>
    </section>
  )
}

/** El embed de Google Maps sin clave de API: un punto por mapa. */
function embedUrl(person: LocationPerson): string {
  const punto = encodeURIComponent(`${person.latitude},${person.longitude}`)
  return `https://maps.google.com/maps?q=${punto}&z=15&hl=es&output=embed`
}

/** «ahora mismo», «hace 3 min», «hace 2 h». */
function haceCuanto(iso: string): string {
  const minutos = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (minutos < 1) return 'ahora mismo'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.round(minutos / 60)
  return horas < 24 ? `hace ${horas} h` : `hace ${Math.round(horas / 24)} días`
}
