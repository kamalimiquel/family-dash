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
 * El radar de Meteocat, solo mientras el desplegable del tiempo está abierto: el
 * widget lo llama únicamente entonces, así que de cerrado no se pide nada.
 */
export function useRadar(activo: boolean): RadarState {
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
