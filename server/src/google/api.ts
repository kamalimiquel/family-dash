import type { Db } from '../db.js'
import { getAccessToken, GoogleAuthError } from './auth.js'

/**
 * GET autenticado contra una API de Google, con token refrescado si hace falta.
 * Los errores llevan el código en `code` para que la UI sepa si es "hay que
 * volver a conectar" (invalid_grant) o algo pasajero.
 */
export async function googleFetch<T>(db: Db, url: string, timeoutMs = 12_000): Promise<T> {
  const token = await getAccessToken(db)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/json',
      },
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new GoogleAuthError(
        `http_${response.status}`,
        `Google respondió ${response.status}: ${body.slice(0, 300)}`,
      )
    }

    return (await response.json()) as T
  } catch (error) {
    if (error instanceof GoogleAuthError) throw error
    const reason = error instanceof Error ? error.message : String(error)
    throw new GoogleAuthError('network_error', `No se pudo hablar con Google: ${reason}`)
  } finally {
    clearTimeout(timer)
  }
}
