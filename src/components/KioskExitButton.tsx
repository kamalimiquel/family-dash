import { useState } from 'react'

/**
 * Pulsador para salir del modo quiosco: deja el navegador de la pantalla en una ventana
 * normal.
 *
 * La página no puede quitarse el `--kiosk` por sí sola — eso no es la pantalla completa
 * de la API del navegador, así que no hay nada que salir desde aquí —, de modo que se lo
 * pide al servidor del panel, que es quien relanza el navegador. Redondo y translúcido
 * para no tapar nada, y con una casa: el dibujo del panel.
 */
export function KioskExitButton() {
  const [saliendo, setSaliendo] = useState(false)

  const salir = () => {
    setSaliendo(true)

    // Si sale bien, el navegador se cierra y esta página se va con él: la respuesta da
    // igual, y si falla tampoco hay nada que contar en pantalla.
    fetch('/api/kiosk/normal', { method: 'POST' }).catch(() => {})
    setTimeout(() => setSaliendo(false), 4000)
  }

  return (
    <button
      type="button"
      className="kiosk-exit"
      onClick={salir}
      disabled={saliendo}
      title="Salir del modo quiosco"
      aria-label="Salir del modo quiosco"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M12 2.6 1.9 11.4l1.3 1.5 2.1-1.8V21h5.1v-5.4h3.2V21h5.1v-9.9l2.1 1.8 1.3-1.5z"
          fill="currentColor"
        />
      </svg>
    </button>
  )
}
