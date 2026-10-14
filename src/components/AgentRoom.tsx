import { useEffect, useRef, useState } from 'react'
import type { AgentsState } from '../hooks/useAgents'
import type { AgentState } from '../lib/types'
import { RoomEngine } from '../lib/room/engine'

/** Cómo se cuenta cada estado en palabras. */
const EN_PALABRAS: Record<AgentState, string> = {
  working: 'trabajando',
  waiting: 'esperando',
  sleeping: 'dormido',
}

/**
 * La tarjeta del cuarto de los agentes.
 *
 * Reparto de trabajo: React pone el marco (título, lista, estado de la conexión) y
 * le pasa al motor los agentes y sus estados. **El motor hace todo lo demás** en un
 * canvas: pintar el cuarto, mover a los robots, andar como transición y elegir el
 * fotograma. El bucle de animación vive fuera del ciclo de render de React a
 * propósito: si estuviera dentro, cada fotograma provocaría un render.
 */
export function AgentRoom({ state }: { state: AgentsState }) {
  const lienzo = useRef<HTMLCanvasElement | null>(null)
  const motor = useRef<RoomEngine | null>(null)
  const [elegido, setElegido] = useState<string | null>(null)

  // El motor se monta una vez y se apaga al desmontar la tarjeta.
  useEffect(() => {
    if (!lienzo.current) return
    const engine = new RoomEngine(lienzo.current)
    motor.current = engine
    return () => {
      engine.destroy()
      motor.current = null
    }
  }, [])

  useEffect(() => {
    motor.current?.setAgents(state.agents)
  }, [state.agents])

  useEffect(() => {
    motor.current?.setConnected(state.connected)
  }, [state.connected])

  /** Un toque en el cuarto selecciona al robot que haya debajo. */
  const tocar = (evento: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = lienzo.current
    const engine = motor.current
    if (!canvas || !engine) return

    const caja = canvas.getBoundingClientRect()
    const x = ((evento.clientX - caja.left) / caja.width) * canvas.width
    const y = ((evento.clientY - caja.top) / caja.height) * canvas.height
    setElegido(engine.agentAt(x, y))
  }

  const sinConexion = !state.connected

  return (
    <section className="widget widget--agents" aria-label="Los agentes de Hermes">
      <header className="agents__head">
        <h2 className="agents__title">Agentes</h2>
        <span className={`agents__link${sinConexion ? '' : ' agents__link--on'}`}>
          {sinConexion ? 'sin conexión' : 'en directo'}
        </span>
      </header>

      <div className="agents__room">
        <canvas
          ref={lienzo}
          className="agents__canvas"
          width={320}
          height={180}
          onPointerDown={tocar}
        />
      </div>

      {state.agents.length > 0 && (
        <ul className="agents__list">
          {state.agents.map((agente) => (
            <li
              className={`agents__item${elegido === agente.agentId ? ' agents__item--on' : ''}`}
              key={agente.agentId}
              style={elegido === agente.agentId ? { color: agente.color } : undefined}
            >
              <span className="agents__chip" style={{ background: agente.color }} />
              <span className="agents__name">{agente.displayName}</span>
              {agente.sessions > 1 && (
                <span className="agents__sesiones">{agente.sessions} sesiones</span>
              )}
              <span className="agents__state">{EN_PALABRAS[agente.state]}</span>
            </li>
          ))}
        </ul>
      )}

      <footer className="agents__foot">
        <span className="agents__hint">
          {state.agents.length === 0
            ? 'Ningún agente ha dado señales todavía'
            : sinConexion
              ? 'Última noticia conocida de cada agente'
              : 'Malabares: esperando · sentado: trabajando'}
        </span>
      </footer>
    </section>
  )
}
