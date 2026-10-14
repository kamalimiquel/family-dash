/**
 * Los agentes de Hermes y en qué están.
 *
 * El reparto de responsabilidades es a propósito:
 *  - Aquí solo se guarda **el estado** (trabajando, esperando, durmiendo) y quién es
 *    cada agente. Nada de posiciones ni de fotogramas: dónde está cada robot, cómo
 *    anda hasta su mesa y qué fotograma enseña lo decide el navegador.
 *  - El estado llega de dos sitios: los **hooks de Hermes** (que avisan en cuanto
 *    pasa algo, vía `POST /api/agents/state`) y un **vigía** que, si una sesión se
 *    queda sin noticias, la baja de marcha. Un agente que se quedó colgado no debe
 *    parecer ocupado para siempre.
 *
 * **Un robot es una máquina, no una sesión.** Cada máquina tiene su Hermes, y ese
 * Hermes puede tener varias sesiones abiertas a la vez; el robot enseña la más
 * despierta (trabajando > esperando > dormido). Un `sessionId` es opcional: sin él,
 * el aviso vale para el robot entero.
 */
import type { Db } from '../db.js'

/** Lo que puede estar haciendo un robot dentro del cuarto. */
export type AgentState = 'working' | 'waiting' | 'sleeping'

export interface Agent {
  agentId: string
  displayName: string
  /** Color que lo identifica en el cuarto (peana y etiqueta). */
  color: string
  state: AgentState
  /** ISO 8601 del último cambio de estado. */
  since: string
  /** Detalle libre (la herramienta que está usando, por ejemplo). */
  detail: string | null
  /** Cuántas sesiones de Hermes tiene despiertas esta máquina. */
  sessions: number
}

interface Registro {
  agentId: string
  displayName: string
  color: string
}

interface Sesion {
  state: AgentState
  since: number
  detail: string | null
}

interface Guardado {
  agentId: string
  state: AgentState
  since: number
  detail: string | null
}

/** Paleta de distintivos: los colores con los que se pinta cada robot. */
const COLORES = [
  '#7dd3fc', // azul
  '#f9a8d4', // rosa
  '#a7f3d0', // verde agua
  '#fcd34d', // ámbar
  '#c4b5fd', // violeta
  '#fdba74', // naranja
]

/** Sin noticias en este rato, una sesión que trabajaba pasa a esperar. */
const SIN_NOTICIAS_MS = 3 * 60 * 1000

/** Y si sigue sin noticias, se echa a dormir. */
const PARA_DORMIR_MS = 25 * 60 * 1000

const CLAVE_REGISTRO = 'agents.roster'

/** Quién manda cuando una máquina tiene varias sesiones a la vez. */
const PRIORIDAD: Record<AgentState, number> = { working: 3, waiting: 2, sleeping: 1 }

/** Cómo se cuenta cada evento de Hermes en el cuarto. */
const POR_EVENTO: Record<string, AgentState> = {
  pre_tool_call: 'working',
  pre_llm_call: 'working',
  post_tool_call: 'working',
  on_stream_start: 'working',
  on_stream_end: 'waiting',
  post_llm_call: 'waiting',
  on_interim_message: 'waiting',
  on_session_start: 'waiting',
  subagent_start: 'working',
  subagent_stop: 'waiting',
  pre_command: 'working',
  on_session_end: 'sleeping',
  on_session_finalize: 'sleeping',
}

/** Traduce el nombre de un hook de Hermes a un estado del cuarto. */
export function stateForEvent(evento: string): AgentState | null {
  return POR_EVENTO[evento] ?? null
}

export class Room {
  private readonly db: Db
  /** El estado agregado de cada robot (lo que enseña el cuarto). */
  private readonly estados = new Map<string, Guardado>()
  /** Y el de cada una de sus sesiones, para poder agregar. */
  private readonly sesiones = new Map<string, Map<string, Sesion>>()
  private readonly oyentes = new Set<(agente: Agent) => void>()
  private vigia: NodeJS.Timeout | null = null

  constructor(db: Db) {
    this.db = db
    this.vigia = setInterval(() => this.revisar(), 30_000)
    this.vigia.unref?.()
  }

  /** Los agentes que hay, con su estado ahora mismo. */
  agents(): Agent[] {
    const registro = this.roster()
    return registro.map((ficha) => {
      const guardado = this.estados.get(ficha.agentId)
      return {
        agentId: ficha.agentId,
        displayName: ficha.displayName,
        color: ficha.color,
        state: guardado?.state ?? 'sleeping',
        since: new Date(guardado?.since ?? Date.now()).toISOString(),
        detail: guardado?.detail ?? null,
        sessions: this.despiertas(ficha.agentId),
      }
    })
  }

  /**
   * Apunta un estado nuevo de una sesión (o del robot entero, si no se le pasa
   * `sessionId`). Si el robot no estaba en la lista, se le da nombre y color solos (y
   * se guarda en la base de datos del dispositivo, para que no cambie de color en cada
   * reinicio).
   */
  setState(cambio: {
    agentId: string
    displayName?: string | null
    sessionId?: string | null
    state: AgentState
    detail?: string | null
  }): Agent {
    const ficha = this.fichaDe(cambio.agentId, cambio.displayName ?? null)

    let deSesion = this.sesiones.get(cambio.agentId)
    if (!deSesion) {
      deSesion = new Map<string, Sesion>()
      this.sesiones.set(cambio.agentId, deSesion)
    }

    // Sin sesión identificada, el aviso es del robot entero.
    const clave = cambio.sessionId ?? '·'
    const anterior = deSesion.get(clave)

    deSesion.set(clave, {
      state: cambio.state,
      since: anterior && anterior.state === cambio.state ? anterior.since : Date.now(),
      detail: cambio.detail ?? null,
    })

    return this.recalcular(cambio.agentId, ficha)
  }

  /** Un oyente por cada navegador conectado (los que van por SSE). */
  subscribe(oyente: (agente: Agent) => void): () => void {
    this.oyentes.add(oyente)
    return () => this.oyentes.delete(oyente)
  }

  /** Cuántos navegadores están escuchando (para el estado de la conexión). */
  get listeners(): number {
    return this.oyentes.size
  }

  /** Sesiones que no están dormidas: las que de verdad cuentan. */
  private despiertas(agentId: string): number {
    let cuenta = 0
    for (const sesion of this.sesiones.get(agentId)?.values() ?? []) {
      if (sesion.state !== 'sleeping') cuenta += 1
    }
    return cuenta
  }

  /** El robot enseña su sesión más despierta, y avisa si eso ha cambiado. */
  private recalcular(agentId: string, ficha: Registro): Agent {
    let estado: AgentState = 'sleeping'
    let detalle: string | null = null

    for (const sesion of this.sesiones.get(agentId)?.values() ?? []) {
      if (PRIORIDAD[sesion.state] > PRIORIDAD[estado]) {
        estado = sesion.state
        detalle = sesion.detail
      } else if (sesion.state === estado && !detalle) {
        detalle = sesion.detail
      }
    }

    const anterior = this.estados.get(agentId)
    const guardado: Guardado = {
      agentId,
      state: estado,
      since: anterior && anterior.state === estado ? anterior.since : Date.now(),
      detail: detalle,
    }
    this.estados.set(agentId, guardado)

    const agente: Agent = {
      agentId,
      displayName: ficha.displayName,
      color: ficha.color,
      state: guardado.state,
      since: new Date(guardado.since).toISOString(),
      detail: guardado.detail,
      sessions: this.despiertas(agentId),
    }

    // Solo se avisa si de verdad ha cambiado algo (el navegador no necesita ruido).
    if (
      !anterior ||
      anterior.state !== guardado.state ||
      anterior.detail !== guardado.detail
    ) {
      for (const oyente of this.oyentes) {
        try {
          oyente(agente)
        } catch {
          /* un oyente roto no puede tumbar a los demás */
        }
      }
    }

    return agente
  }

  /** El vigía: sin noticias, cada sesión baja de marcha en vez de mentir. */
  private revisar(): void {
    const ahora = Date.now()

    for (const [agentId, deSesion] of this.sesiones) {
      let algoCambio = false

      for (const [clave, sesion] of deSesion) {
        const silencio = ahora - sesion.since

        if (sesion.state === 'working' && silencio > SIN_NOTICIAS_MS) {
          deSesion.set(clave, { state: 'waiting', since: ahora, detail: null })
          algoCambio = true
        } else if (sesion.state === 'waiting' && silencio > PARA_DORMIR_MS) {
          deSesion.set(clave, { state: 'sleeping', since: ahora, detail: null })
          algoCambio = true
        }
      }

      if (algoCambio) this.recalcular(agentId, this.fichaDe(agentId, null))
    }
  }

  /** La lista guardada en el dispositivo, o la vacía. */
  private roster(): Registro[] {
    const fila = this.db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get(CLAVE_REGISTRO) as { value: string } | undefined

    if (!fila) return []

    try {
      const lista = JSON.parse(fila.value)
      return Array.isArray(lista) ? (lista as Registro[]) : []
    } catch {
      return []
    }
  }

  /** La ficha de un agente, creándola si es la primera vez que se le ve. */
  private fichaDe(agentId: string, displayName: string | null): Registro {
    const lista = this.roster()
    const existente = lista.find((ficha) => ficha.agentId === agentId)

    if (existente) {
      if (displayName && displayName !== existente.displayName) {
        existente.displayName = displayName
        this.guardar(lista)
      }
      return existente
    }

    const nueva: Registro = {
      agentId,
      displayName: displayName || `Agente ${lista.length + 1}`,
      color: COLORES[lista.length % COLORES.length] ?? COLORES[0] ?? '#7dd3fc',
    }
    lista.push(nueva)
    this.guardar(lista)
    return nueva
  }

  private guardar(lista: Registro[]): void {
    this.db
      .prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(CLAVE_REGISTRO, JSON.stringify(lista), Date.now())
  }
}
