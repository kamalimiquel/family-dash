import { useEffect, useState } from 'react'

/**
 * Si el panel no dice otra cosa, cinco minutos. Es el mismo valor que usa el servidor
 * cuando el dispositivo todavía no tiene el suyo guardado.
 */
export const SCREEN_IDLE_FALLBACK_MINUTES = 5

/** Cada cuánto se vuelve a preguntar por el ajuste: cambiarlo no obliga a reiniciar el panel. */
const RELOAD_MS = 10 * 60 * 1000

type Ajustes = {
  screen?: { idleMinutes?: number }
  defaults?: { screen?: { idleMinutes?: number } }
}

/**
 * Los minutos que tarda la pantalla en quedarse en negro, tal y como los tenga este
 * dispositivo (0 = nunca). Vive en la base de datos del panel, así que el repositorio no
 * decide cuándo se duerme la pantalla de ninguna casa.
 */
export function useScreenIdleMinutes(): number {
  const [minutos, setMinutos] = useState(SCREEN_IDLE_FALLBACK_MINUTES)

  useEffect(() => {
    let vivo = true

    const mirar = () => {
      fetch('/api/settings')
        .then((respuesta) => (respuesta.ok ? respuesta.json() : null))
        .then((datos: Ajustes | null) => {
          if (!vivo || !datos) return
          const valor = datos.screen?.idleMinutes ?? datos.defaults?.screen?.idleMinutes
          if (typeof valor === 'number' && valor >= 0) setMinutos(valor)
        })
        .catch(() => {
          // Si el servidor no contesta, se queda con lo que ya tenía: aquí no se puede
          // hacer nada mejor, y quedarse sin dormir es peor que dormirse de más.
        })
    }

    mirar()
    const reloj = window.setInterval(mirar, RELOAD_MS)

    return () => {
      vivo = false
      window.clearInterval(reloj)
    }
  }, [])

  return minutos
}
