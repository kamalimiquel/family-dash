/**
 * Los agentes de Hermes y en qué están.
 *
 * El reparto de responsabilidades es a propósito:
 *  - Aquí solo se guarda **el estado** (trabajando, esperando, durmiendo) y quién es
 *    cada agente. Nada de posiciones ni de fotogramas: dónde está cada robot, cómo
 *    anda hasta su mesa y qué fotograma enseña lo decide el navegador.
 *  - El estado llega de dos sitios: los **hooks de Hermes** (que avisan en cuanto
 *    pasa algo, vía `POST /api/agents/state`) y un **vigía** que, si un agente se
 *    queda sin noticias, lo pasa a esperando y luego a dormido. Un agente que se
 *    quedó colgado no debe parecer ocupado para siempre.
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
}

interface Registro {
  agentId: string
  displayName: string
  color: string
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

/** Sin noticias en este rato, un agente que trabajaba pasa a esperar. */
const SIN_NOTICIAS_MS = 3 * 60 * 1000

/** Y si sigue sin noticias, se echa a dormir. */
const PARA_DORMIR_MS = 25 * 60 * 1000

const CLAVE_REGISTRO = 'agents.roster'

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
  private readonly estados = new Map<string, Guardado>()
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
      }
    })
  }

  /**
   * Apunta un estado nuevo. Si el agente no estaba en la lista, se le da nombre y
   * color solos (y se guarda en la base de datos del dispositivo, para que no
   * cambie de color en cada reinicio).
   */
  setState(cambio: {
    agentId: string
    displayName?: string | null
    state: AgentState
    detail?: string | null
  }): Agent {
    const ficha = this.fichaDe(cambio.agentId, cambio.displayName ?? null)
    const anterior = this.estados.get(cambio.agentId)

    const guardado: Guardado = {
      agentId: cambio.agentId,
      state: cambio.state,
      since: anterior && anterior.state === cambio.state ? anterior.since : Date.now(),
      detail: cambio.detail ?? null,
    }
    this.estados.set(cambio.agentId, guardado)

    const agente: Agent = {
      agentId: ficha.agentId,
      displayName: ficha.displayName,
      color: ficha.color,
      state: guardado.state,
      since: new Date(guardado.since).toISOString(),
      detail: guardado.detail,
    }

    // Solo se avisa si de verdad ha cambiado algo (el navegador no necesita ruido).
    if (!anterior || anterior.state !== guardado.state || anterior.detail !== guardado.detail) {
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

  /** Un oyente por cada navegador conectado (los que van por SSE). */
  subscribe(oyente: (agente: Agent) => void): () => void {
    this.oyentes.add(oyente)
    return () => this.oyentes.delete(oyente)
  }

  /** Cuántos navegadores están escuchando (para el estado de la conexión). */
  get listeners(): number {
    return this.oyentes.size
  }

  /** El vigía: sin noticias, un agente baja de marcha en vez de mentir. */
  private revisar(): void {
    const ahora = Date.now()
    for (const [agentId, guardado] of this.estados) {
      const silencio = ahora - guardado.since

      if (guardado.state === 'working' && silencio > SIN_NOTICIAS_MS) {
        this.setState({ agentId, state: 'waiting', detail: null })
      } else if (guardado.state === 'waiting' && silencio > PARA_DORMIR_MS) {
        this.setState({ agentId, state: 'sleeping', detail: null })
      }
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
