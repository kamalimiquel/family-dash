import type { Request } from 'express'

/**
 * ¿La petición viene de la propia máquina? Los endpoints que tocan secretos o que
 * cambian el estado del panel (el flujo de Google, los avisos de los agentes) solo
 * se pueden llamar desde dentro: si el panel está en la red de casa, nadie de fuera
 * puede mover nada.
 */
export function isLocalRequest(req: Request): boolean {
  const direccion = req.socket.remoteAddress ?? ''
  return (
    direccion === '127.0.0.1' ||
    direccion === '::1' ||
    direccion === '::ffff:127.0.0.1' ||
    direccion === ''
  )
}
