/**
 * Códigos WMO que devuelve Open-Meteo → texto en español + clave de icono.
 * El frontend solo conoce las claves (ver src/components/WeatherIcon.tsx).
 */

export type IconKey =
  | 'clear'
  | 'clear-night'
  | 'mostly-clear'
  | 'mostly-clear-night'
  | 'partly-cloudy'
  | 'partly-cloudy-night'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'freezing-drizzle'
  | 'rain'
  | 'freezing-rain'
  | 'snow'
  | 'snow-grains'
  | 'showers'
  | 'snow-showers'
  | 'thunderstorm'
  | 'thunderstorm-hail'
  | 'unknown'

export interface Condition {
  code: number
  label: string
  icon: IconKey
}

interface WmoEntry {
  label: string
  icon: IconKey
}

const WMO: Record<number, WmoEntry> = {
  0: { label: 'Despejado', icon: 'clear' },
  1: { label: 'Mayormente despejado', icon: 'mostly-clear' },
  2: { label: 'Parcialmente nublado', icon: 'partly-cloudy' },
  3: { label: 'Nublado', icon: 'overcast' },
  45: { label: 'Niebla', icon: 'fog' },
  48: { label: 'Niebla helada', icon: 'fog' },
  51: { label: 'Llovizna débil', icon: 'drizzle' },
  53: { label: 'Llovizna', icon: 'drizzle' },
  55: { label: 'Llovizna intensa', icon: 'drizzle' },
  56: { label: 'Llovizna helada', icon: 'freezing-drizzle' },
  57: { label: 'Llovizna helada fuerte', icon: 'freezing-drizzle' },
  61: { label: 'Lluvia débil', icon: 'rain' },
  63: { label: 'Lluvia', icon: 'rain' },
  65: { label: 'Lluvia fuerte', icon: 'rain' },
  66: { label: 'Lluvia helada', icon: 'freezing-rain' },
  67: { label: 'Lluvia helada fuerte', icon: 'freezing-rain' },
  71: { label: 'Nieve débil', icon: 'snow' },
  73: { label: 'Nieve', icon: 'snow' },
  75: { label: 'Nieve fuerte', icon: 'snow' },
  77: { label: 'Granos de nieve', icon: 'snow-grains' },
  80: { label: 'Chubascos débiles', icon: 'showers' },
  81: { label: 'Chubascos', icon: 'showers' },
  82: { label: 'Chubascos fuertes', icon: 'showers' },
  85: { label: 'Chubascos de nieve', icon: 'snow-showers' },
  86: { label: 'Chubascos de nieve fuertes', icon: 'snow-showers' },
  95: { label: 'Tormenta', icon: 'thunderstorm' },
  96: { label: 'Tormenta con granizo', icon: 'thunderstorm-hail' },
  99: { label: 'Tormenta fuerte con granizo', icon: 'thunderstorm-hail' },
}

export function describeWeather(code: number, isDay = true): Condition {
  const entry = WMO[code]
  if (!entry) return { code, label: 'Sin datos', icon: 'unknown' }

  // El sol y la luna llevan iconos distintos según sea de día o de noche.
  if (!isDay) {
    if (entry.icon === 'clear' || entry.icon === 'mostly-clear') {
      return { code, label: entry.label, icon: `${entry.icon}-night` as IconKey }
    }
    if (entry.icon === 'partly-cloudy') {
      return { code, label: entry.label, icon: 'partly-cloudy-night' }
    }
  }

  return { code, label: entry.label, icon: entry.icon }
}

/** Dirección del viento en texto (16 rumbos, en español). */
export function windDirectionLabel(degrees: number): string {
  const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO']
  const index = Math.round(((degrees % 360) + 360) % 360 / 22.5) % 16
  return points[index] ?? 'N'
}
