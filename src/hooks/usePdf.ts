import { useCallback, useEffect, useRef, useState } from 'react'
import { PDF_REFRESH_MS } from '../config'
import { fetchPdf } from '../lib/api'
import type { PdfResponse } from '../lib/types'

export interface PdfState {
  data: PdfResponse | null
  loading: boolean
  error: string | null
  receivedAt: Date | null
  refresh: () => void
}

/**
 * El PDF de la carpeta compartida. Se vuelve a preguntar cada PDF_REFRESH_MS: si
 * alguien deja el menú nuevo en el NAS, el panel lo coge solo (y la respuesta trae
 * la versión del fichero, así que el navegador no enseña la página vieja).
 */
export function usePdf(): PdfState {
  const [data, setData] = useState<PdfResponse | null>(null)
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
      const snapshot = await fetchPdf(controller.signal)
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

    const timer = window.setInterval(() => void load(), PDF_REFRESH_MS)
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
