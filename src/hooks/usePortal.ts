import { useEffect, useRef, useState } from 'react'

/** Lo que devuelve `GET /api/portal`. */
export interface PortalUsage {
  ok: boolean
  plan: string | null
  creditsRemaining: number | null
  monthlyCredits: number | null
  cycleEndsAt: string | null
  fetchedAt: number | null
  /** `true` si es la última respuesta buena, porque el portal no contesta ahora. */
  stale: boolean
  error: string | null
  configured?: boolean
}

/** Cada cuánto se vuelve a preguntar. El saldo cambia poco; la caché del servidor manda. */
const CADA_MS = 10 * 60 * 1000

/**
 * El saldo de la suscripción de Nous Portal, para enseñarlo junto a «Agentes».
 *
 * Se pide al servidor del panel (que es el que habla con el portal y guarda la
 * autorización) y se refresca cada diez minutos. Si la primera respuesta tarda o falla,
 * el hueco se queda vacío: el cuarto se usa igual.
 */
export function usePortal(): PortalUsage | null {
  const [uso, setUso] = useState<PortalUsage | null>(null)
  const montado = useRef(true)

  useEffect(() => {
    montado.current = true
    let control: AbortController | null = null

    const pedir = async () => {
      control?.abort()
      control = new AbortController()
      try {
        const respuesta = await fetch('/api/portal', { signal: control.signal })
        if (!respuesta.ok) return
        const datos = (await respuesta.json()) as PortalUsage
        if (montado.current) setUso(datos)
      } catch {
        // Sin red o abortado: se queda lo que hubiera (o nada). No es un error que enseñar.
      }
    }

    void pedir()
    const temporizador = window.setInterval(pedir, CADA_MS)

    return () => {
      montado.current = false
      window.clearInterval(temporizador)
      control?.abort()
    }
  }, [])

  return uso
}

/** «21,5 / 22» — con coma decimal, que es como se escribe aquí. */
export function textoCreditos(uso: PortalUsage): string | null {
  if (!uso.ok || uso.creditsRemaining === null || uso.monthlyCredits === null) return null
  const queda = uso.creditsRemaining.toLocaleString('es-ES', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  const total = uso.monthlyCredits.toLocaleString('es-ES', { maximumFractionDigits: 0 })
  return `${queda}$ / ${total}$`
}
