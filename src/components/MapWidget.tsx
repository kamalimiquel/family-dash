/**
 * Widget del mapa: dónde está la familia que comparte su ubicación con Google Maps.
 *
 * Ojo con lo que hay detrás: Google **no** tiene API para leer las ubicaciones
 * compartidas de otros usuarios. La única vía que existe (la que usan Home
 * Assistant y las librerías tipo `locationsharinglib`) es reutilizar la sesión del
 * navegador con tu cuenta de Google, y esa cookie caduca cada cierto tiempo. Hasta
 * que eso no esté decidido y configurado, esta tarjeta lo dice tal cual: un mapa
 * vacío sin explicación parece una avería, y no lo es.
 */
export function MapWidget() {
  return (
    <section className="widget widget--map" aria-label="Dónde está la familia">
      <header className="map__head">
        <h2 className="map__title">Dónde están</h2>
      </header>

      <p className="map__empty">Todavía no hay ubicaciones que enseñar.</p>

      <footer className="map__foot">
        <span className="map__hint">Falta conectar Google Maps</span>
      </footer>
    </section>
  )
}
