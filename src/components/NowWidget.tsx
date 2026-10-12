import { getIsoWeek } from '../lib/time'
import type { WeatherState } from '../hooks/useWeather'
import { ClockWidget } from './ClockWidget'
import { WeatherWidget } from './WeatherWidget'

interface NowWidgetProps {
  now: Date
  weather: WeatherState
}

/**
 * Widget 1: la hora, la fecha y el tiempo de la localidad en una sola tarjeta.
 * El reloj y el tiempo son bloques sueltos (`ClockWidget`, `WeatherWidget`); la
 * tarjeta de cristal la pone este componente, para que se lean como una cosa.
 */
export function NowWidget({ now, weather }: NowWidgetProps) {
  return (
    <section className="widget widget--now" aria-label="Hora, fecha y tiempo">
      <header className="now__head">
        <span className="now__label">Hoy</span>
        <span className="now__week">semana {getIsoWeek(now)}</span>
      </header>

      <ClockWidget now={now} />
      <WeatherWidget state={weather} />
    </section>
  )
}
