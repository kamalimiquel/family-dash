import type { WeatherState } from '../hooks/useWeather'
import { formatIsoTimeOfDay, formatTimeShort, formatWeekdayShort, parseIsoDate } from '../lib/time'
import { WeatherIcon } from './WeatherIcon'

const rounded = (value: number | null | undefined): number | null =>
  value === null || value === undefined ? null : Math.round(value)

const temp = (value: number | null | undefined): string => {
  const value_ = rounded(value)
  return value_ === null ? '—' : `${value_}°`
}

const percent = (value: number | null | undefined): string =>
  value === null || value === undefined ? '—' : `${Math.round(value)}%`

const speed = (value: number | null | undefined): string => {
  const value_ = rounded(value)
  return value_ === null ? '—' : `${value_} km/h`
}

/** Widget 2: el tiempo de la localidad configurada (cacheado en SQLite en el backend). */
export function WeatherWidget({ state }: { state: WeatherState }) {
  const { data, loading, error, receivedAt, refresh } = state

  const current = data?.current
  const today = data?.today
  const placeName = data?.place.name ?? 'Localidad'
  const conditionLabel = current?.condition.label ?? (loading ? 'Consultando…' : 'Sin datos')
  const days = (data?.daily ?? []).slice(1, 7)

  const offline = Boolean(error)
  const stale = Boolean(data?.meta.stale)
  const status = offline
    ? data && receivedAt
      ? `sin conexión · datos de las ${formatTimeShort(receivedAt)}`
      : 'sin conexión con el servidor'
    : stale && receivedAt
      ? `datos de las ${formatTimeShort(receivedAt)}`
      : receivedAt
        ? `actualizado a las ${formatTimeShort(receivedAt)}`
        : 'cargando…'

  return (
    <section className="widget widget--weather" aria-label={`Tiempo en ${placeName}`}>
      <header className="weather__head">
        <h2 className="weather__place">{placeName}</h2>
        <button
          type="button"
          className="weather__refresh"
          onClick={refresh}
          aria-label="Actualizar el tiempo"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M20 11a8 8 0 1 0-2.6 5.9M20 5.5V11h-5.5" />
          </svg>
        </button>
      </header>

      <div className="weather__hero">
        <WeatherIcon
          icon={current?.condition.icon ?? 'unknown'}
          size={72}
          className="weather__icon"
          title={conditionLabel}
        />

        <div className="weather__reading">
          <p className="weather__temp">
            <span className="weather__value">{temp(current?.temperature)}</span>
            <span className="weather__extreme">
              máx {temp(today?.max)} · mín {temp(today?.min)}
            </span>
          </p>
          <p className="weather__condition">{conditionLabel}</p>
        </div>
      </div>

      <dl className="weather__details">
        <div className="weather__detail">
          <dt>Sensación</dt>
          <dd>{temp(current?.apparent)}</dd>
        </div>
        <div className="weather__detail">
          <dt>Humedad</dt>
          <dd>{percent(current?.humidity)}</dd>
        </div>
        <div className="weather__detail">
          <dt>Viento</dt>
          <dd>
            {speed(current?.windSpeed)}
            {current?.windDirectionLabel ? ` ${current.windDirectionLabel}` : ''}
          </dd>
        </div>
        <div className="weather__detail">
          <dt>Lluvia</dt>
          <dd>{percent(today?.precipitationProbability)}</dd>
        </div>
        {/* En vertical hay sitio para estos dos; en apaisado los oculta el CSS. */}
        <div className="weather__detail weather__detail--extra">
          <dt>Amanece</dt>
          <dd>{formatIsoTimeOfDay(today?.sunrise)}</dd>
        </div>
        <div className="weather__detail weather__detail--extra">
          <dt>Anochece</dt>
          <dd>{formatIsoTimeOfDay(today?.sunset)}</dd>
        </div>
      </dl>

      {days.length > 0 && (
        <ul className="weather__daily">
          {days.map((day) => (
            <li className="weather__day" key={day.date}>
              <span className="weather__day-name">{formatWeekdayShort(parseIsoDate(day.date))}</span>
              <WeatherIcon icon={day.condition.icon} size={26} title={day.condition.label} />
              <span className="weather__day-temps">
                <b>{temp(day.max)}</b>
                <span>{temp(day.min)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <footer className={`weather__foot${offline || stale ? ' weather__foot--warn' : ''}`}>
        <span className="weather__status">{status}</span>
        {data?.attribution && <span className="weather__source">{data.attribution}</span>}
      </footer>
    </section>
  )
}
