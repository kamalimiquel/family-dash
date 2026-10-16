import { useEffect, useState } from 'react'

/** Lo que cuenta como «alguien está usando la pantalla». */
const EVENTOS = ['pointerdown', 'pointermove', 'wheel', 'keydown'] as const

/**
 * Deja la pantalla en negro cuando nadie la toca, y la devuelve al primer toque.
 *
 * No es un salvapantallas al uso: la pantalla **sigue encendida** —lo que se pidió—, pero
 * en negro deja de emitir luz. No se toca la salida de vídeo de la máquina: apagarla de
 * verdad (con `wlopm`) la dejaría a oscuras con el cartel de «sin señal» de muchos
 * monitores, que da más luz que la pantalla en negro.
 *
 * El truco de que el primer toque solo despierte, sin pulsar lo que hubiera debajo, es que
 * esta capa **es** el elemento de arriba: mientras está puesta se lleva ella todos los
 * toques, así que un dedo sobre el pulsador de salir del quiosco despierta la pantalla y no
 * saca el navegador del quiosco.
 *
 * Los minutos salen del ajuste `screen.idleMinutes` del dispositivo (0 = nunca).
 */
export function ScreenIdle({ idleMinutes }: { idleMinutes: number }) {
  const [dormida, setDormida] = useState(false)

  useEffect(() => {
    // 0 o menos: la pantalla nunca se duerme. Ni se arranca el reloj.
    if (!(idleMinutes > 0)) return

    let reloj: ReturnType<typeof setTimeout>

    const reiniciar = () => {
      window.clearTimeout(reloj)
      reloj = setTimeout(() => setDormida(true), idleMinutes * 60_000)
    }

    // Al usarla se despierta y empieza a contar de nuevo. Esto sí cambia el estado, pero
    // desde un evento de verdad, no al montar.
    const alUsarla = () => {
      setDormida(false)
      reiniciar()
    }

    reiniciar()
    for (const nombre of EVENTOS) {
      // En fase de captura, para que el primer evento cuente aunque caiga sobre un widget.
      window.addEventListener(nombre, alUsarla, { capture: true, passive: true })
    }

    return () => {
      window.clearTimeout(reloj)
      for (const nombre of EVENTOS) {
        window.removeEventListener(nombre, alUsarla, { capture: true })
      }
    }
  }, [idleMinutes])

  // Con 0 minutos nunca está dormida, aunque venga de un ajuste anterior que sí dormía.
  const puesta = idleMinutes > 0 && dormida

  return <div className={puesta ? 'screen-idle dormida' : 'screen-idle'} aria-hidden="true" />
}
