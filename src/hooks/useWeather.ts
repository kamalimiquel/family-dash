import { useCallback, useEffect, useRef, useState } from 'react'
import { WEATHER_REFRESH_MS } from '../config'
import { fetchWeather } from '../lib/api'
import type { WeatherSnapshot } from '../lib/types'

export interface WeatherState {
  data: WeatherSnapshot | null
  loading: boolean
  error: string | null
  /** Cuándo se recibió la última respuesta buena del backend. */
  receivedAt: Date | null
  refresh: () => void
}

/**
 * Pide el tiempo al backend cada WEATHER_REFRESH_MS y, además, cuando el
 * navegador recupera la conexión o la pestaña vuelve a estar visible (la Pi
 * kiosco está siempre visible, pero así también funciona en un móvil).
 */
export function useWeather(): WeatherState {
  const [data, setData] = useState<WeatherSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [receivedAt, setReceivedAt] = useState<Date | null>(null)
  const inFlight = useRef<AbortController | null>(null)
  const mounted = useRef(true)

  const load = useCallback(async () => {
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller

    try {
      const snapshot = await fetchWeather(controller.signal)
      if (!mounted.current) return
      setData(snapshot)
      setReceivedAt(new Date())
      setError(null)
    } catch (err) {
      if (controller.signal.aborted || !mounted.current) return
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    // oxlint: carga inicial de la API; el estado solo se toca tras el await.
    // eslint-disable-next-line react/set-state-in-effect
    void load()

    const timer = window.setInterval(() => void load(), WEATHER_REFRESH_MS)
    const onOnline = () => void load()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }

    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      mounted.current = false
      window.clearInterval(timer)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
      inFlight.current?.abort()
    }
  }, [load])

  return { data, loading, error, receivedAt, refresh: () => void load() }
}
