/**
 * Tipos de la API del panel. Espejo de lo que devuelve `server/src`
 * (no se importan directamente: el backend es otro proyecto TS con NodeNext).
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

export interface DailyForecast {
  date: string
  min: number | null
  max: number | null
  precipitationProbability: number | null
  condition: Condition
}

export interface WeatherSnapshot {
  place: { name: string; country?: string; latitude: number; longitude: number }
  timezone: string
  attribution: string
  current: {
    time: string
    temperature: number | null
    apparent: number | null
    humidity: number | null
    precipitation: number | null
    cloudCover: number | null
    pressure: number | null
    windSpeed: number | null
    windGusts: number | null
    windDirection: number | null
    windDirectionLabel: string | null
    isDay: boolean
    condition: Condition
  }
  today: {
    date: string
    min: number | null
    max: number | null
    sunrise: string | null
    sunset: string | null
    precipitationProbability: number | null
    windSpeedMax: number | null
    condition: Condition
  }
  daily: DailyForecast[]
  meta: {
    source: string
    cached: boolean
    stale: boolean
    fetchedAt: string
    expiresAt: string
    ttlSeconds: number
  }
}
