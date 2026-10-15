import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Router } from 'express'
import { isLocalRequest } from '../local.js'

const SCRIPT = fileURLToPath(new URL('../../../scripts/kiosk-normal.sh', import.meta.url))

export function createKioskRouter(): Router {
  const router = Router()

  /**
   * Saca el panel del modo quiosco: el navegador de la pantalla pasa a una ventana
   * normal, maximizada.
   *
   * Lo llama el pulsador redondo. Solo desde la propia máquina: no es cosa de la red
   * reiniciar el navegador de la pantalla del salón.
   */
  router.post('/kiosk/normal', (req, res) => {
    if (!isLocalRequest(req)) {
      res.status(403).json({ error: 'solo_local', message: 'esta ruta solo se usa desde la máquina del panel' })
      return
    }

    if (!fs.existsSync(SCRIPT)) {
      res.status(500).json({ error: 'sin_script', message: 'falta scripts/kiosk-normal.sh' })
      return
    }

    // Se contesta antes de tocar nada: el script cierra el navegador que ha hecho la
    // petición, así que si se esperase a que termine, la respuesta no llegaría.
    res.json({ ok: true })

    setTimeout(() => {
      const hijo = spawn('bash', [SCRIPT], { detached: true, stdio: 'ignore' })
      hijo.on('error', (error) => console.error('[kiosco] no se pudo salir:', error.message))
      hijo.unref()
    }, 400)
  })

  return router
}
