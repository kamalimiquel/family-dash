import { useCallback, useEffect, useRef, useState } from 'react'
import { LOCATIONS_REFRESH_MS } from '../config'
import { fetchLocations } from '../lib/api'
import type { LocationsResponse } from '../lib/types'

export interface LocationsState {
  data: LocationsResponse | null
  loading: boolean
  error: string | null
  receivedAt: Date | null
  refresh: () => void
}

/**
 * Dónde está la familia. Igual que el tiempo o los titulares: se refresca sola
 * cada LOCATIONS_REFRESH_MS y cuando el navegador vuelve a estar en línea o
 * visible.
 */
export function useLocations(): LocationsState {
  const [data, setData] = useState<LocationsResponse | null>(null)
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
      const snapshot = await fetchLocations(controller.signal)
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

    const timer = window.setInterval(() => void load(), LOCATIONS_REFRESH_MS)
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
