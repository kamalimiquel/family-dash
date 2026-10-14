import { timingSafeEqual } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { Router, type Request } from 'express'
import { type AgentState, type Room, stateForEvent } from '../agents/index.js'
import { DB_PATH } from '../config.js'
import type { Db } from '../db.js'
import { isLocalRequest } from '../local.js'

const ESTADOS: AgentState[] = ['working', 'waiting', 'sleeping']

/**
 * El token del cuarto, si está puesto: `data/agents-token` (600, fuera de git). Sirve
 * para que los hooks de Hermes puedan avisar desde **otro** ordenador de la casa; sin
 * el fichero, este endpoint solo acepta peticiones de la propia máquina.
 */
const RUTA_TOKEN = path.join(path.dirname(DB_PATH), 'agents-token')
let tokenCache: { valor: string | null; leido: number } | null = null

function tokenEsperado(): string | null {
  const ahora = Date.now()
  if (tokenCache && ahora - tokenCache.leido < 30_000) return tokenCache.valor

  let valor: string | null = null
  try {
    valor = fs.readFileSync(RUTA_TOKEN, 'utf8').trim() || null
  } catch {
    valor = null // sin fichero: solo local
  }

  tokenCache = { valor, leido: ahora }
  return valor
}

function tokenAceptado(req: Request): boolean {
  const esperado = tokenEsperado()
  if (!esperado) return false

  const recibido = req.get('x-room-token')
  if (typeof recibido !== 'string' || recibido.length !== esperado.length) return false

  return timingSafeEqual(Buffer.from(recibido), Buffer.from(esperado))
}

export function createAgentsRouter(db: Db, room: Room): Router {
  const router = Router()

  // El estado ahora mismo: lo pide el navegador al arrancar y al volver a estar visible.
  router.get('/agents', (_req, res) => {
    res.set('Cache-Control', 'no-store')
    res.json({ agents: room.agents(), listeners: room.listeners })
  })

  /**
   * Server-Sent Events: una conexión abierta por la que solo salen **cambios de
   * estado**. Es lo único que hace falta, porque dónde está cada robot, cómo anda
   * hasta su mesa y qué fotograma enseña lo decide el navegador.
   */
  router.get('/agents/events', (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.flushHeaders()

    const enviar = (evento: string, datos: unknown) => {
      res.write(`event: ${evento}\ndata: ${JSON.stringify(datos)}\n\n`)
    }

    // Al conectar, el estado completo: así el cuarto se pinta bien aunque el
    // navegador acabe de arrancar.
    enviar('snapshot', { agents: room.agents() })

    const dejarDeEscuchar = room.subscribe((agente) => enviar('agent', agente))

    // Latido cada 20 s: si el navegador no ve nada en un rato, sabe que sigue vivo.
    const latido = setInterval(() => res.write(': latido\n\n'), 20_000)

    req.on('close', () => {
      clearInterval(latido)
      dejarDeEscuchar()
      res.end()
    })
  })

  /**
   * Aquí avisan los hooks de Hermes (y cualquier script de casa). Se admite o bien
   * un estado ya masticado (`state`) o bien el nombre del evento de Hermes
   * (`event`), que se traduce aquí: así el hook es una línea y la tabla de
   * traducción vive en un solo sitio.
   */
  router.post('/agents/state', (req, res) => {
    // De la propia máquina, sin más. De la red de casa (los hooks de Hermes pueden
    // correr en otro ordenador), hace falta el token.
    if (!isLocalRequest(req) && !tokenAceptado(req)) {
      res.status(403).json({ error: 'solo_desde_local_o_con_token' })
      return
    }

    const cuerpo = (req.body ?? {}) as {
      agentId?: unknown
      displayName?: unknown
      sessionId?: unknown
      state?: unknown
      event?: unknown
      detail?: unknown
    }

    const agentId = typeof cuerpo.agentId === 'string' ? cuerpo.agentId.trim() : ''
    if (!agentId) {
      res.status(400).json({ error: 'falta_agentId' })
      return
    }

    let estado: AgentState | null = null

    if (typeof cuerpo.state === 'string' && ESTADOS.includes(cuerpo.state as AgentState)) {
      estado = cuerpo.state as AgentState
    } else if (typeof cuerpo.event === 'string') {
      estado = stateForEvent(cuerpo.event)
    }

    if (!estado) {
      res.status(400).json({
        error: 'estado_desconocido',
        message: `ni state (${ESTADOS.join(', ')}) ni event de Hermes que se entienda`,
      })
      return
    }

    const agente = room.setState({
      agentId,
      displayName: typeof cuerpo.displayName === 'string' ? cuerpo.displayName : null,
      sessionId: typeof cuerpo.sessionId === 'string' ? cuerpo.sessionId : null,
      state: estado,
      detail: typeof cuerpo.detail === 'string' ? cuerpo.detail : null,
    })

    res.json({ ok: true, agent: agente })
  })

  return router
}
