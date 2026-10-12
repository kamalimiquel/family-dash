/**
 * Fondo del panel: degradado violeta/azul con manchas que se mueven despacio y
 * unas olas en la esquina inferior derecha. Todo con CSS y SVG (transform y
 * opacidad, que es lo que la GPU de la Pi mueve sin despeinarse); nada de filtros
 * animados, que en una Raspberry se notan.
 */

/** Ola periódica (el periodo es la mitad del ancho, así el bucle no tiene costura). */
function wave(options: { amplitude: number; baseline: number; period: number; width: number }): string {
  const { amplitude, baseline, period, width } = options
  const steps = 12
  const step = width / steps
  let path = `M0 ${baseline}`

  for (let index = 1; index <= steps; index += 1) {
    const from = (index - 1) * step
    const to = index * step
    const middle = from + step / 2
    const control =
      baseline + Math.sin((middle / period) * Math.PI * 2) * amplitude * 1.6
    const end = baseline + Math.sin((to / period) * Math.PI * 2) * amplitude
    path += ` Q ${middle} ${control} ${to} ${end}`
  }

  return `${path} L ${width} 600 L 0 600 Z`
}

const WAVES = [
  {
    className: 'backdrop__wave--1',
    d: wave({ amplitude: 26, baseline: 150, period: 600, width: 2400 }),
  },
  {
    className: 'backdrop__wave--2',
    d: wave({ amplitude: 34, baseline: 230, period: 600, width: 2400 }),
  },
  {
    className: 'backdrop__wave--3',
    d: wave({ amplitude: 20, baseline: 320, period: 600, width: 2400 }),
  },
]

export function Background() {
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="backdrop__base" />
      <span className="backdrop__glow backdrop__glow--a" />
      <span className="backdrop__glow backdrop__glow--b" />
      <span className="backdrop__glow backdrop__glow--c" />

      <svg className="backdrop__waves" viewBox="0 0 1200 420" preserveAspectRatio="none">
        {WAVES.map((item) => (
          <g className={`backdrop__wave ${item.className}`} key={item.className}>
            <path d={item.d} />
          </g>
        ))}
      </svg>
    </div>
  )
}
