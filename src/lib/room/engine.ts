/**
 * El motor del cuarto: sala, robots y animación, todo en canvas y **fuera del ciclo
 * de render de React**. React solo le dice qué agentes hay y en qué estado están; a
 * partir de ahí, quién va a su mesa, cómo anda y qué fotograma enseña se decide aquí.
 *
 * Dos relojes distintos, a propósito:
 *  - El de la escena, como mucho a 30 fps (se puede bajar si la Pi va justa).
 *  - El de cada animación, al ritmo que diga `robot.json` (6-8 fps), avanzando por
 *    tiempo transcurrido y no por fotograma, para que no dependa del rendimiento.
 */

export type AgentState = 'working' | 'waiting' | 'sleeping'

export interface RoomAgent {
  agentId: string
  displayName: string
  color: string
  state: AgentState
  since: string
  detail: string | null
}

interface Fotograma {
  x: number
  y: number
  w: number
  h: number
}

interface Animacion {
  fps: number
  frames: Fotograma[]
}

interface Mapa {
  size: number
  room: { width: number; height: number }
  places: {
    desks: { x: number; y: number }[]
    beds: { x: number; y: number }[]
    juggling: { x: number; y: number }
  }
  animations: Record<string, Animacion>
}

/** Un robot dentro del cuarto. */
interface Bicho {
  agentId: string
  displayName: string
  color: string
  state: AgentState
  /** Posición actual y a dónde va (el destino se recalcula al cambiar de estado). */
  x: number
  y: number
  destino: { x: number; y: number }
  /** -1 mira a la izquierda, 1 a la derecha. */
  mirando: number
  animacion: string
  frame: number
  /** Segundos que lleva el fotograma actual. */
  tiempoFrame: number
  /** Su sitio en el cuarto (mesa, cama…): se fija al aparecer y no cambia nunca. */
  sitio: number
  /** Ya llegó y está haciendo lo suyo (en vez de andar). */
  enSitio: boolean
}

const ANIMACION_POR_ESTADO: Record<AgentState, string> = {
  working: 'type',
  waiting: 'idle',
  sleeping: 'sleep',
}

/** Píxeles por segundo al andar. Despacio: es un cuarto, no una carrera. */
const VELOCIDAD = 22

/** Cuánto se puede alargar un fotograma si la pestaña ha estado parada. */
const DT_MAXIMO = 0.1

/** Lo mínimo que necesita la escena: un robot dormido (2 fps). */
const FPS_MINIMO = 2

export interface RoomEngineOptions {
  /** Tope de fotogramas por segundo de la escena (30 por defecto). */
  fpsEscena?: number
}

export interface ResumenBicho {
  agentId: string
  displayName: string
  state: AgentState
  animacion: string
  x: number
  y: number
  destino: { x: number; y: number }
  enSitio: boolean
}

export class RoomEngine {
  private readonly lienzo: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly fpsEscena: number

  private mapa: Mapa | null = null
  private sala: HTMLImageElement | null = null
  private hoja: HTMLImageElement | null = null

  private bichos = new Map<string, Bicho>()
  private conectado = true
  private raf = 0
  private ultimo = 0
  private acumulado = 0
  private destruido = false

  constructor(lienzo: HTMLCanvasElement, opciones: RoomEngineOptions = {}) {
    this.lienzo = lienzo
    this.fpsEscena = opciones.fpsEscena ?? 30

    const contexto = lienzo.getContext('2d')
    if (!contexto) throw new Error('el navegador no ha dado un contexto 2D')
    this.ctx = contexto
    // Sin suavizado: el pixel-art tiene que verse con los bordes duros.
    this.ctx.imageSmoothingEnabled = false

    void this.cargarArte()
    this.raf = requestAnimationFrame(this.bucle)
    this.ultimo = performance.now()

    // Con ?debug=1, el motor queda accesible desde la consola (y desde las pruebas
    // automáticas) para poder preguntarle dónde está cada robot. En uso normal no
    // se expone nada.
    if (new URLSearchParams(window.location.search).has('debug')) {
      ;(window as unknown as { __cuarto?: RoomEngine }).__cuarto = this
    }
  }

  /** Los agentes que hay ahora mismo. React llama a esto al llegar datos nuevos. */
  setAgents(agentes: RoomAgent[]): void {
    const vistos = new Set<string>()

    agentes.forEach((agente, indice) => {
      vistos.add(agente.agentId)
      const bicho = this.bichos.get(agente.agentId)

      if (!bicho) {
        const destino = this.sitioPara(agente.state, indice)
        this.bichos.set(agente.agentId, {
          agentId: agente.agentId,
          displayName: agente.displayName,
          color: agente.color,
          state: agente.state,
          // Los que llegan nuevos aparecen junto a la puerta (abajo a la derecha).
          x: this.mapa?.room.width ? this.mapa.room.width - 14 : 300,
          y: this.mapa?.room.height ? this.mapa.room.height - 10 : 170,
          destino,
          mirando: -1,
          animacion: 'walk',
          frame: 0,
          tiempoFrame: 0,
          // El sitio se fija aquí y no se toca: si luego cambia el orden de la
          // lista, cada robot sigue con su mesa y su cama.
          sitio: indice,
          enSitio: false,
        })
        return
      }

      bicho.displayName = agente.displayName
      bicho.color = agente.color
      if (bicho.state !== agente.state) {
        bicho.state = agente.state
        bicho.destino = this.sitioPara(agente.state, bicho.sitio)
        bicho.enSitio = false
        // Cambiar de estado siempre empieza andando: andar es la transición, no un
        // estado más.
        bicho.animacion = 'walk'
      }
    })

    for (const agentId of [...this.bichos.keys()]) {
      if (!vistos.has(agentId)) this.bichos.delete(agentId)
    }
  }

  /** Si el SSE se cae, el cuarto lo dice en vez de fingir que todos duermen. */
  setConnected(conectado: boolean): void {
    this.conectado = conectado
  }

  /**
   * Qué agente hay más cerca de un punto del cuarto (para los toques: el navegador
   * manda coordenadas de pantalla y aquí se traducen a las del cuarto).
   */
  agentAt(x: number, y: number): string | null {
    let mejor: string | null = null
    let distancia = 16

    for (const bicho of this.bichos.values()) {
      const d = Math.hypot(bicho.x - x, (bicho.y - 14 - y) * 0.8)
      if (d < distancia) {
        distancia = d
        mejor = bicho.agentId
      }
    }

    return mejor
  }

  /** Fuerza un repintado (por ejemplo al cambiar el tamaño del elemento). */
  redibujar(): void {
    this.pintar()
  }

  /**
   * Foto de lo que hay ahora mismo en el cuarto. Es para depurar y para las
   * comprobaciones automáticas: en la consola, `location.search = '?debug=1'` deja
   * este motor en `window.__cuarto`.
   */
  resumen(): { conectado: boolean; arteCargado: boolean; bichos: ResumenBicho[] } {
    return {
      conectado: this.conectado,
      arteCargado: this.mapa !== null,
      bichos: [...this.bichos.values()].map((bicho) => ({
        agentId: bicho.agentId,
        displayName: bicho.displayName,
        state: bicho.state,
        animacion: bicho.animacion,
        x: Math.round(bicho.x),
        y: Math.round(bicho.y),
        destino: bicho.destino,
        enSitio: bicho.enSitio,
      })),
    }
  }

  destroy(): void {
    this.destruido = true
    cancelAnimationFrame(this.raf)
  }

  // --- arte ---------------------------------------------------------------

  private async cargarArte(): Promise<void> {
    const [mapa, sala, hoja] = await Promise.all([
      fetch('/agents/robot.json').then((respuesta) => respuesta.json() as Promise<Mapa>),
      cargarImagen('/agents/room.png'),
      cargarImagen('/agents/robot.png'),
    ])

    if (this.destruido) return

    this.mapa = mapa
    this.sala = sala
    this.hoja = hoja
    this.lienzo.width = mapa.room.width
    this.lienzo.height = mapa.room.height
    this.ctx.imageSmoothingEnabled = false

    // Importante: los agentes pueden haber llegado ANTES que el arte (el SSE es
    // rápido y las imágenes tardan), así que todos tendrían el destino de reserva.
    // Al terminar de cargar, se les manda a su sitio de verdad.
    for (const bicho of this.bichos.values()) {
      bicho.destino = this.sitioPara(bicho.state, bicho.sitio)
      bicho.enSitio = false
      bicho.animacion = 'walk'
    }
  }

  /** A qué sitio va un agente según lo que esté haciendo. */
  private sitioPara(state: AgentState, indice: number): { x: number; y: number } {
    const mapa = this.mapa
    if (!mapa) return { x: 232, y: 140 }

    if (state === 'working') {
      const mesas = mapa.places.desks
      return this.conHueco(mesas[indice % mesas.length] ?? { x: 148, y: 100 }, indice, mesas.length)
    }

    if (state === 'sleeping') {
      const camas = mapa.places.beds
      return this.conHueco(camas[indice % camas.length] ?? { x: 56, y: 130 }, indice, camas.length)
    }

    // Esperando: a la alfombra, repartidos para no pisarse.
    const centro = mapa.places.juggling
    const sitio = indice % 3
    return this.conHueco({ x: centro.x - 26 + sitio * 26, y: centro.y + 6 }, indice, 3)
  }

  /**
   * Hay tres mesas y tres camas: si aparecen más agentes, los que repiten se apartan
   * un poco hacia el lado. Dos robots exactamente en el mismo píxel parecen uno solo.
   */
  private conHueco(
    punto: { x: number; y: number },
    indice: number,
    sitios: number,
  ): { x: number; y: number } {
    const vuelta = Math.floor(indice / sitios)
    if (vuelta === 0) return punto

    const lado = vuelta % 2 === 1 ? 1 : -1
    const salto = Math.ceil(vuelta / 2) * 8
    return { x: punto.x + lado * salto, y: punto.y }
  }

  // --- bucle --------------------------------------------------------------

  private bucle = (ahora: number): void => {
    if (this.destruido) return
    this.raf = requestAnimationFrame(this.bucle)

    const dt = Math.min((ahora - this.ultimo) / 1000, DT_MAXIMO)
    this.ultimo = ahora

    // Con la pantalla apagada o el panel en segundo plano no hay nada que pintar.
    if (document.hidden) return

    this.acumulado += dt
    if (this.acumulado < this.pasoNecesario()) return
    const delta = this.acumulado
    this.acumulado = 0

    this.actualizar(delta)
    this.pintar()
  }

  /**
   * Cuánto hay que esperar entre fotogramas **ahora mismo**: la escena va al ritmo de
   * lo que de verdad se mueve, no siempre a 30 fps. Es lo que separa un panel caliente
   * de uno tranquilo en la Pi: con todos los agentes durmiendo, 2 fps bastan.
   */
  private pasoNecesario(): number {
    const mapa = this.mapa
    if (!mapa) return 1 / this.fpsEscena

    let necesario = FPS_MINIMO
    for (const bicho of this.bichos.values()) {
      const animacion = mapa.animations[bicho.animacion]
      if (!animacion) continue
      // Andando se pide el doble del ritmo del sprite: el movimiento se ve más suave
      // y el robot no va a saltos de un píxel.
      const ritmo = bicho.animacion === 'walk' ? animacion.fps * 2 : animacion.fps
      if (ritmo > necesario) necesario = ritmo
    }

    return 1 / Math.min(this.fpsEscena, necesario)
  }

  private actualizar(dt: number): void {
    const mapa = this.mapa
    if (!mapa) return

    for (const bicho of this.bichos.values()) {
      const lejos = Math.abs(bicho.destino.x - bicho.x) + Math.abs(bicho.destino.y - bicho.y)

      if (!bicho.enSitio && lejos > 1.5) {
        // Andar: primero se alinea en horizontal y luego sube o baja. Así no cruza
        // el cuarto en diagonal por encima de las camas.
        const dx = bicho.destino.x - bicho.x
        const dy = bicho.destino.y - bicho.y
        const paso = VELOCIDAD * dt

        if (Math.abs(dx) > 2) {
          bicho.mirando = dx < 0 ? -1 : 1
          bicho.x += Math.sign(dx) * Math.min(paso, Math.abs(dx))
        } else if (Math.abs(dy) > 1) {
          bicho.y += Math.sign(dy) * Math.min(paso, Math.abs(dy))
        } else {
          bicho.x = bicho.destino.x
          bicho.y = bicho.destino.y
        }

        bicho.animacion = 'walk'
      } else if (!bicho.enSitio) {
        // Ha llegado: ahora sí, a lo suyo.
        bicho.enSitio = true
        bicho.animacion = ANIMACION_POR_ESTADO[bicho.state]
        bicho.frame = 0
        bicho.tiempoFrame = 0
      }

      const animacion = mapa.animations[bicho.animacion]
      if (!animacion) continue

      bicho.tiempoFrame += dt
      const porFotograma = 1 / animacion.fps
      while (bicho.tiempoFrame >= porFotograma) {
        bicho.tiempoFrame -= porFotograma
        bicho.frame = (bicho.frame + 1) % animacion.frames.length
      }
    }
  }

  // --- pintado ------------------------------------------------------------

  private pintar(): void {
    const { ctx } = this
    const mapa = this.mapa

    ctx.clearRect(0, 0, this.lienzo.width, this.lienzo.height)
    if (!mapa || !this.sala || !this.hoja) return

    ctx.drawImage(this.sala, 0, 0)

    // Los de delante (y más abajo) se pintan después: así se tapan bien.
    const ordenados = [...this.bichos.values()].sort((a, b) => a.y - b.y)

    for (const bicho of ordenados) {
      const animacion = mapa.animations[bicho.animacion]
      const fotograma = animacion?.frames[bicho.frame % (animacion?.frames.length ?? 1)]
      if (!fotograma) continue

      const x = Math.round(bicho.x)
      const y = Math.round(bicho.y)

      // Peana: el color que identifica a este agente.
      ctx.globalAlpha = 0.55
      ctx.fillStyle = bicho.color
      ctx.beginPath()
      ctx.ellipse(x, y, 8, 3, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1

      // El robot, con los pies en (x, y).
      ctx.save()
      ctx.translate(x, y - 31)
      if (bicho.mirando < 0) {
        ctx.translate(mapa.size, 0)
        ctx.scale(-1, 1)
      }
      ctx.drawImage(
        this.hoja,
        fotograma.x,
        fotograma.y,
        fotograma.w,
        fotograma.h,
        0,
        0,
        fotograma.w,
        fotograma.h,
      )
      ctx.restore()

      // El nombre, con un borde oscuro para que se lea sobre cualquier fondo.
      ctx.font = '7px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle = 'rgba(10, 8, 24, 0.85)'
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        ctx.fillText(bicho.displayName, x + (dx ?? 0), y + 3 + (dy ?? 0))
      }
      ctx.fillStyle = bicho.color
      ctx.fillText(bicho.displayName, x, y + 3)
    }

    if (!this.conectado) {
      ctx.fillStyle = 'rgba(8, 6, 20, 0.72)'
      ctx.fillRect(0, 0, this.lienzo.width, this.lienzo.height)
      ctx.font = '10px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#fca5a5'
      ctx.fillText('SIN CONEXIÓN', this.lienzo.width / 2, this.lienzo.height / 2 - 6)
      ctx.font = '7px monospace'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
      ctx.fillText('último estado conocido', this.lienzo.width / 2, this.lienzo.height / 2 + 8)
    }
  }
}

function cargarImagen(ruta: string): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const imagen = new Image()
    imagen.onload = () => resolver(imagen)
    imagen.onerror = () => rechazar(new Error(`no se ha podido cargar ${ruta}`))
    imagen.src = ruta
  })
}
