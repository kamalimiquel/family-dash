import { useEffect, useState } from 'react'
import { getIsoWeek } from '../lib/time'
import type { WeatherState } from '../hooks/useWeather'
import { useRadar } from '../hooks/useRadar'
import { ClockWidget } from './ClockWidget'
import { WeatherWidget } from './WeatherWidget'
import { WeatherRadar } from './WeatherRadar'

interface NowWidgetProps {
  now: Date
  weather: WeatherState
}

/**
 * Widget 1: la hora, la fecha y el tiempo de la localidad en una sola tarjeta.
 * El reloj y el tiempo son bloques sueltos (`ClockWidget`, `WeatherWidget`); la
 * tarjeta de cristal la pone este componente, para que se lean como una cosa.
 *
 * El reloj va arriba y debajo el **radar de Meteocat**: en reposo encuadrado en la
 * localidad (que es lo que cabe de ancho) y, al tocar la tarjeta, esta se despliega
 * hacia la derecha —ocupa toda la fila de arriba— y el radar pasa a enseñar Cataluña
 * entera. La columna de la derecha —temperatura y previsión— no cambia ni de sitio ni
 * de tamaño. Se cierra tocando otra vez la tarjeta, tocando fuera o con Escape.
 */
export function NowWidget({ now, weather }: NowWidgetProps) {
  const [abierto, setAbierto] = useState(false)
  const radar = useRadar()

  useEffect(() => {
    if (!abierto) return

    const cerrar = () => setAbierto(false)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAbierto(false)
    }

    // El clic que abre no cuenta como «fuera»: el oyente entra en el siguiente turno.
    const alta = window.setTimeout(() => document.addEventListener('click', cerrar), 0)
    window.addEventListener('keydown', onKey)

    return () => {
      window.clearTimeout(alta)
      document.removeEventListener('click', cerrar)
      window.removeEventListener('keydown', onKey)
    }
  }, [abierto])

  return (
    <section
      className={`widget widget--now${abierto ? ' widget--now--abierto' : ''}`}
      role="button"
      tabIndex={0}
      aria-expanded={abierto}
      aria-label={
        abierto
          ? 'Hora, tiempo y radar de Cataluña. Toca para cerrar'
          : 'Hora, tiempo y radar de la ciudad. Toca para ver todo Cataluña'
      }
      onClick={() => setAbierto((valor) => !valor)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          setAbierto((valor) => !valor)
        }
      }}
    >
      <header className="now__head card-head">
        <span className="now__label">Hoy</span>
        <span className="now__week">
          {abierto ? 'radar · toca fuera para cerrar' : `semana ${getIsoWeek(now)}`}
        </span>
      </header>

      {/* La tarjeta es ancha (19 cm, y 32 al desplegarse): el reloj a la izquierda y,
          debajo suyo, el radar; el tiempo a la derecha. */}
      <div className="now__body">
        <div className="now__izq">
          <ClockWidget now={now} />
          {/* El radar está siempre: en reposo con la ciudad encuadrada (que es lo que cabe
              en la tarjeta) y desplegada con Cataluña entera. */}
          <WeatherRadar state={radar} modo={abierto ? 'cataluna' : 'ciudad'} />
        </div>

        <div className="now__clima">
          <WeatherWidget state={weather} />
        </div>
      </div>
    </section>
  )
}
