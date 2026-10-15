import { useCallback, useEffect, useRef, useState } from 'react'
import { RADAR_REFRESH_MS } from '../config'
import { fetchRadar } from '../lib/api'
import type { RadarFrame } from '../lib/types'

export interface RadarState {
  data: RadarFrame | null
  loading: boolean
  error: string | null
  refresh: () => void
}

/**
 * El radar de Meteocat. Se pide siempre (la tarjeta lo enseña también en reposo, con
 * la ciudad encuadrada) y se refresca cada 5 minutos, lo que tarda Meteocat en rehacer
 * la imagen; el servidor lo cachea igual, así que no se machaca a nadie.
 */
export function useRadar(activo = true): RadarState {
  const [data, setData] = useState<RadarFrame | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef<AbortController | null>(null)
  const mounted = useRef(true)

  const load = useCallback(async () => {
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller

    try {
      const frame = await fetchRadar(controller.signal)
      if (!mounted.current) return
      setData(frame)
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
    if (!activo) return () => {
      mounted.current = false
    }

    // oxlint: carga inicial de la API; el estado solo se toca tras el await.
    // eslint-disable-next-line react/set-state-in-effect
    void load()
    const timer = window.setInterval(() => void load(), RADAR_REFRESH_MS)

    return () => {
      mounted.current = false
      window.clearInterval(timer)
      inFlight.current?.abort()
    }
  }, [activo, load])

  return { data, loading, error, refresh: () => void load() }
}
