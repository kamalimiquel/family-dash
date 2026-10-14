import { useEffect, useRef, useState } from 'react'
import type { AgentInfo } from '../lib/types'

export interface AgentsState {
  agents: AgentInfo[]
  connected: boolean
  error: string | null
}

/**
 * Los agentes, por Server-Sent Events: una conexión abierta por la que el backend
 * solo manda **cambios de estado**. El resto —dónde está cada robot, cómo anda, qué
 * fotograma enseña— lo lleva el motor del cuarto.
 *
 * Si la conexión se cae, `connected` pasa a falso y el cuarto lo dice con todas las
 * letras: un agente del que no sabemos nada no debe parecer que está durmiendo.
 */
export function useAgents(): AgentsState {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reintento = useRef<number | null>(null)

  useEffect(() => {
    let fuente: EventSource | null = null
    let cerrado = false

    const conectar = () => {
      if (cerrado) return

      fuente = new EventSource('/api/agents/events')

      fuente.addEventListener('open', () => {
        setConnected(true)
        setError(null)
      })

      fuente.addEventListener('snapshot', (evento) => {
        const datos = JSON.parse((evento as MessageEvent).data) as { agents: AgentInfo[] }
        setAgents(datos.agents)
      })

      fuente.addEventListener('agent', (evento) => {
        const agente = JSON.parse((evento as MessageEvent).data) as AgentInfo
        setAgents((actuales) => {
          // Se sustituye en su sitio, no se añade al final: así el orden no baila y
          // cada robot sigue con su mesa.
          const indice = actuales.findIndex((otro) => otro.agentId === agente.agentId)
          if (indice < 0) return [...actuales, agente]
          const copia = [...actuales]
          copia[indice] = agente
          return copia
        })
      })

      fuente.addEventListener('error', () => {
        setConnected(false)
        setError('sin conexión con el panel')
        fuente?.close()
        fuente = null

        // EventSource reintenta por su cuenta, pero cuando el servidor ha cerrado de
        // verdad se queda en CLOSED: en ese caso se vuelve a intentar a mano.
        if (!cerrado) {
          reintento.current = window.setTimeout(conectar, 4000)
        }
      })
    }

    conectar()

    return () => {
      cerrado = true
      if (reintento.current !== null) window.clearTimeout(reintento.current)
      fuente?.close()
    }
  }, [])

  return { agents, connected, error }
}
