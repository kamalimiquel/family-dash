import type { ReactNode } from 'react'
import type { IconKey } from '../lib/types'

interface WeatherIconProps {
  icon: IconKey
  size?: number
  className?: string
  title?: string
}

/* --- piezas reutilizables (lienzo 24×24, trazo) ------------------------- */

const Sun = ({ cx = 12, cy = 12, r = 4.2, ray = 3.1 }) => (
  <>
    <circle cx={cx} cy={cy} r={r} />
    <path
      d={`M${cx} ${cy - r - ray}v${-1.6} M${cx} ${cy + r + ray}v1.6 M${cx - r - ray} ${cy}h-1.6 M${cx + r + ray} ${cy}h1.6
          M${cx - (r + ray) * 0.7} ${cy - (r + ray) * 0.7}l-1.1-1.1 M${cx + (r + ray) * 0.7} ${cy + (r + ray) * 0.7}l1.1 1.1
          M${cx + (r + ray) * 0.7} ${cy - (r + ray) * 0.7}l1.1-1.1 M${cx - (r + ray) * 0.7} ${cy + (r + ray) * 0.7}l-1.1 1.1`}
    />
  </>
)

const Moon = ({ scale = 1, dx = 0, dy = 0 }) => (
  <g transform={`translate(${dx} ${dy}) scale(${scale})`}>
    <path d="M16.6 13.2A7 7 0 1 1 8.9 3.4a5.6 5.6 0 0 0 7.7 9.8Z" />
  </g>
)

const Cloud = ({ dx = 0, dy = 0, scale = 1 }) => (
  <g transform={`translate(${dx} ${dy}) scale(${scale})`}>
    <path d="M7.4 18.4h9a3.5 3.5 0 0 0 .3-6.98 5 5 0 0 0-9.55-1.34A3.75 3.75 0 0 0 7.4 18.4Z" />
  </g>
)

const Drops = () => (
  <path d="M9 19.6l-.9 2.2M12.6 19.6l-.9 2.2M16.2 19.6l-.9 2.2" />
)

const Showers = () => (
  <path d="M9.2 19.4l-1.4 2.6M12.8 19.4l-1.4 2.6M16.4 19.4l-1.4 2.6" />
)

const Flakes = () => (
  <path d="M8.6 19v4.2M6.8 20l3.6 2.2M10.4 20l-3.6 2.2M15.6 19v4.2M13.8 20l3.6 2.2M17.4 20l-3.6 2.2" />
)

const Bolt = () => <path d="M12.8 18.2 8.6 24h2.9l-.7 4h.1l4.3-5.8h-2.9l.5-4Z" />

const Fog = () => <path d="M5.6 19.6h12.8M7.4 21.8h9.2M6.4 24h11.2" />

const Question = () => (
  <path d="M10.6 19.8a2.9 2.9 0 1 1 4.4 2.5c-.9.6-1.4 1.1-1.4 2.1M13.5 26.4h.01" />
)

/* --- catálogo ----------------------------------------------------------- */

const ICONS: Record<IconKey, ReactNode> = {
  clear: <Sun />,
  'clear-night': <Moon scale={1.15} dx={-1.2} dy={-0.6} />,
  'mostly-clear': (
    <>
      <Sun cx={9.6} cy={8.4} r={3.3} ray={2.6} />
      <Cloud dx={3.2} dy={4.6} scale={0.82} />
    </>
  ),
  'mostly-clear-night': (
    <>
      <Moon scale={0.9} dx={-5.4} dy={-5.6} />
      <Cloud dx={3.2} dy={4.6} scale={0.82} />
    </>
  ),
  'partly-cloudy': (
    <>
      <Sun cx={15.4} cy={8} r={3.2} ray={2.5} />
      <Cloud dx={-1.4} dy={5.2} scale={0.86} />
    </>
  ),
  'partly-cloudy-night': (
    <>
      <Moon scale={0.75} dx={3.2} dy={-5.4} />
      <Cloud dx={-1.4} dy={5.2} scale={0.86} />
    </>
  ),
  overcast: (
    <>
      <Cloud dx={-2.6} dy={-0.4} scale={0.72} />
      <Cloud dx={1.4} dy={4.4} scale={0.92} />
    </>
  ),
  fog: (
    <>
      <Cloud dx={-1.2} dy={-0.6} scale={0.86} />
      <Fog />
    </>
  ),
  drizzle: (
    <>
      <Cloud dx={-1.2} dy={-0.8} scale={0.88} />
      <path d="M9.4 19.8l-.7 1.9M13 19.8l-.7 1.9" />
    </>
  ),
  'freezing-drizzle': (
    <>
      <Cloud dx={-1.2} dy={-0.8} scale={0.88} />
      <path d="M9.4 19.8l-.7 1.9M15.4 19.4v3M13.9 20.1l3 1.8M16.9 20.1l-3 1.8" />
    </>
  ),
  rain: (
    <>
      <Cloud dx={-1.2} dy={-0.8} scale={0.9} />
      <Drops />
    </>
  ),
  'freezing-rain': (
    <>
      <Cloud dx={-1.2} dy={-0.8} scale={0.9} />
      <path d="M8.6 19.8l-.8 2M12.2 19.8l-.8 2M16.6 19v3.4M15.1 19.7l3 1.8M18.1 19.7l-3 1.8" />
    </>
  ),
  snow: (
    <>
      <Cloud dx={-1.4} dy={-1} scale={0.9} />
      <Flakes />
    </>
  ),
  'snow-grains': (
    <>
      <Cloud dx={-1.4} dy={-1} scale={0.9} />
      <path d="M9 20.6h.01M12.6 22.2h.01M16.2 20.6h.01M10.8 23.4h.01M14.4 23.4h.01" strokeWidth="2.4" strokeLinecap="round" />
    </>
  ),
  showers: (
    <>
      <Cloud dx={-1.4} dy={-1} scale={0.9} />
      <Showers />
    </>
  ),
  'snow-showers': (
    <>
      <Cloud dx={-1.4} dy={-1.2} scale={0.86} />
      <Flakes />
    </>
  ),
  thunderstorm: (
    <>
      <Cloud dx={-1.6} dy={-1.4} scale={0.9} />
      <Bolt />
    </>
  ),
  'thunderstorm-hail': (
    <>
      <Cloud dx={-1.6} dy={-1.6} scale={0.86} />
      <path d="M10 19.2 7.6 22.4h2.2l-.8 2.6 3-4h-2.1l.1-1.8Z" />
      <path d="M16 20.4h.01M18.2 22.6h.01M15 23.2h.01" strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  unknown: (
    <>
      <Cloud dx={-1.6} dy={-1.6} scale={0.88} />
      <Question />
    </>
  ),
}

export function WeatherIcon({ icon, size = 40, className, title }: WeatherIconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {ICONS[icon] ?? ICONS.unknown}
    </svg>
  )
}
