import type { Db } from '../db.js'
import { getAccessToken, GoogleAuthError } from './auth.js'

/**
 * Llamada autenticada contra una API de Google, con token refrescado si hace falta.
 * Sin `init` es un GET; con `init` (método y cuerpo) sirve para escribir, que es lo que
 * necesita marcar una tarea como hecha.
 * Los errores llevan el código en `code` para que la UI sepa si es "hay que
 * volver a conectar" (invalid_grant) o algo pasajero.
 */
export async function googleFetch<T>(
  db: Db,
  url: string,
  init: RequestInit = {},
  timeoutMs = 12_000,
): Promise<T> {
  const token = await getAccessToken(db)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/json',
        // El cuerpo va en JSON y con su `content-type`, o Google ignora lo que se manda.
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...((init.headers as Record<string, string> | undefined) ?? {}),
      },
    })

    // Un PATCH puede contestar sin cuerpo; el que llama sabe si le hacía falta.
    if (response.status === 204) return {} as T

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
