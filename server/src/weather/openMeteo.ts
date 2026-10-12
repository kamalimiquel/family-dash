import type { Place } from '../config.js'
import { describeWeather, windDirectionLabel, type Condition } from './wmo.js'

const API_URL = 'https://api.open-meteo.com/v1/forecast'

const CURRENT_FIELDS = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'is_day',
  'precipitation',
  'weather_code',
  'cloud_cover',
  'pressure_msl',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
].join(',')

const DAILY_FIELDS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'sunrise',
  'sunset',
  'precipitation_probability_max',
  'wind_speed_10m_max',
].join(',')

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
}

interface OpenMeteoResponse {
  latitude?: number
  longitude?: number
  timezone?: string
  current?: Record<string, number | string>
  daily?: Record<string, (number | string | null)[]>
}

const num = (value: unknown): number | null => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null)

function at<T>(list: T[] | undefined, index: number): T | null {
  if (!list) return null
  const value = list[index]
  return value === undefined ? null : value
}

/** Pide el tiempo actual + 6 días a Open-Meteo y lo deja en forma "de casa". */
export async function fetchWeather(place: Place, timeoutMs = 10_000): Promise<WeatherSnapshot> {
  const url = new URL(API_URL)
  url.searchParams.set('latitude', String(place.latitude))
  url.searchParams.set('longitude', String(place.longitude))
  url.searchParams.set('current', CURRENT_FIELDS)
  url.searchParams.set('daily', DAILY_FIELDS)
  url.searchParams.set('timezone', place.timezone || 'auto')
  url.searchParams.set('forecast_days', '7')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'family-dash/1.0 (panel familiar local)' },
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`No se pudo contactar con Open-Meteo: ${reason}`)
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    throw new Error(`Open-Meteo respondió ${response.status}`)
  }

  const data = (await response.json()) as OpenMeteoResponse
  const current = data.current ?? {}
  const daily = data.daily ?? {}

  const currentCode = num(current['weather_code']) ?? -1
  const isDay = num(current['is_day']) !== 0
  const windDirection = num(current['wind_direction_10m'])

  const dates = (daily['time'] as string[] | undefined) ?? []
  const dailyList: DailyForecast[] = dates.map((date, index) => ({
    date,
    min: num(at(daily['temperature_2m_min'], index)),
    max: num(at(daily['temperature_2m_max'], index)),
    precipitationProbability: num(at(daily['precipitation_probability_max'], index)),
    condition: describeWeather(num(at(daily['weather_code'], index)) ?? -1, true),
  }))

  const today = dailyList[0]

  return {
    place: {
      name: place.name,
      country: place.country,
      latitude: num(data.latitude) ?? place.latitude,
      longitude: num(data.longitude) ?? place.longitude,
    },
    timezone: data.timezone ?? place.timezone,
    attribution: 'Open-Meteo.com',
    current: {
      time: str(current['time']) ?? new Date().toISOString(),
      temperature: num(current['temperature_2m']),
      apparent: num(current['apparent_temperature']),
      humidity: num(current['relative_humidity_2m']),
      precipitation: num(current['precipitation']),
      cloudCover: num(current['cloud_cover']),
      pressure: num(current['pressure_msl']),
      windSpeed: num(current['wind_speed_10m']),
      windGusts: num(current['wind_gusts_10m']),
      windDirection,
      windDirectionLabel: windDirection === null ? null : windDirectionLabel(windDirection),
      isDay,
      condition: describeWeather(currentCode, isDay),
    },
    today: {
      date: today?.date ?? '',
      min: today?.min ?? null,
      max: today?.max ?? null,
      sunrise: str(at(daily['sunrise'], 0)),
      sunset: str(at(daily['sunset'], 0)),
      precipitationProbability: today?.precipitationProbability ?? null,
      windSpeedMax: num(at(daily['wind_speed_10m_max'], 0)),
      condition: today?.condition ?? describeWeather(currentCode, true),
    },
    daily: dailyList,
  }
}
