import { useCallback, useEffect, useRef, useState } from 'react'
import { NEWS_REFRESH_MS } from '../config'
import { fetchNews } from '../lib/api'
import type { NewsResponse } from '../lib/types'

export interface NewsState {
  data: NewsResponse | null
  loading: boolean
  error: string | null
  receivedAt: Date | null
  refresh: () => void
}

/**
 * Titulares de las fuentes configuradas. Igual que el tiempo: se refresca solo
 * cada NEWS_REFRESH_MS y cuando el navegador vuelve a estar en línea o visible.
 */
export function useNews(): NewsState {
  const [data, setData] = useState<NewsResponse | null>(null)
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
      const snapshot = await fetchNews(controller.signal)
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

    const timer = window.setInterval(() => void load(), NEWS_REFRESH_MS)
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
