#!/usr/bin/env python3
"""Genera el arte del «cuarto de los agentes» (pixel-art) sin depender de nada de internet.

Salidas (en public/agents/):
  room.png    — el cuarto, 320x180: tres mesas, zona de dormir y zona de juegos.
  robot.png   — la hoja de sprites del robot, rejilla de 32x32.
  robot.json  — qué fotogramas forman cada animación y a qué velocidad.

El robot es amarillo y siempre el mismo: el color que identifica a cada agente lo
pinta el navegador (una peana y una etiqueta con su nombre), no la hoja de sprites.

Uso: python3 scripts/make-agent-art.py
"""
from __future__ import annotations

import json
import os

from PIL import Image, ImageDraw

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.join(AQUI, '..', 'public', 'agents')

ANCHO_CUARTO, ALTO_CUARTO = 320, 180
LADO = 32

# Paleta del cuarto: madera cálida sobre pared morada, a juego con el panel.
PARED = (58, 42, 78)
PARED_OSCURA = (44, 31, 61)
ZOCALO = (92, 66, 110)
SUELO = (110, 78, 58)
SUELO_CLARO = (126, 92, 68)
SUELO_LINEA = (96, 66, 48)
ALFOMBRA = (86, 62, 120)
ALFOMBRA_BORDE = (120, 92, 168)
MADERA = (138, 96, 62)
MADERA_OSCURA = (104, 70, 44)
PANTALLA = (86, 128, 196)
PANTALLA_LUZ = (128, 176, 232)
CIELO_VENTANA = (36, 26, 62)
LUNA = (232, 226, 178)
ESTRELLA = (176, 168, 214)
SABANA = (206, 200, 226)
SABANA_SOMBRA = (168, 162, 196)
ALMOHADA = (232, 228, 244)
COJIN = (150, 122, 200)
TEJAS = (226, 226, 234)
TEJAS_SOMBRA = (168, 168, 184)

# El robot: amarillo, con visor oscuro y detalles que se leen a 32x32.
ROBOT = (240, 200, 72)
ROBOT_SOMBRA = (198, 158, 44)
ROBOT_LUZ = (255, 232, 140)
VISOR = (46, 40, 62)
OJO = (140, 226, 255)
BRAZO = (214, 176, 60)
BOLA = [(232, 96, 96), (110, 208, 224), (176, 232, 120)]

# Dónde está cada cosa en el cuarto (lo usa también el navegador para saber a qué
# mesa va cada agente y qué zona es cuál).
MESAS = [(84, 74), (148, 78), (212, 74)]  # esquina superior izquierda de cada mesa
ALFOMBRA_CENTRO = (232, 138)  # centro de la zona de juegos
CAMAS = [(56, 162), (56, 140), (56, 118)]  # centro de cada colchón (piso bajo, medio, alto)


def cuarto() -> Image.Image:
    """El cuarto: pared con ventana, suelo de tablas, tres mesas, camas y alfombra."""
    imagen = Image.new('RGBA', (ANCHO_CUARTO, ALTO_CUARTO), PARED)
    lapiz = ImageDraw.Draw(imagen)

    # Pared y zócalo.
    lapiz.rectangle([0, 0, ANCHO_CUARTO, 52], fill=PARED)
    lapiz.rectangle([0, 52, ANCHO_CUARTO, 56], fill=ZOCALO)
    for x in range(0, ANCHO_CUARTO, 40):
        lapiz.line([(x, 0), (x, 52)], fill=PARED_OSCURA)

    # Ventana con luna (es de noche, como el panel).
    lapiz.rectangle([18, 10, 66, 42], fill=CIELO_VENTANA)
    lapiz.rectangle([18, 10, 66, 42], outline=ZOCALO)
    lapiz.ellipse([52, 14, 62, 24], fill=LUNA)
    for x, y in ((26, 16), (32, 26), (40, 18), (46, 32), (58, 34), (24, 34)):
        lapiz.point((x, y), fill=ESTRELLA)
    lapiz.line([(42, 11), (42, 41)], fill=ZOCALO)
    lapiz.line([(19, 26), (65, 26)], fill=ZOCALO)

    # Un reloj de pared, para que la pared no sea un color plano.
    lapiz.rectangle([282, 16, 300, 34], fill=ZOCALO)
    lapiz.rectangle([283, 17, 299, 33], fill=(232, 228, 244))
    lapiz.line([(291, 21), (291, 25)], fill=VISOR)
    lapiz.line([(291, 25), (295, 27)], fill=VISOR)

    # Suelo de tablas: planchas horizontales con las juntas alternadas (no ladrillos).
    lapiz.rectangle([0, 56, ANCHO_CUARTO, ALTO_CUARTO], fill=SUELO)
    for indice, y in enumerate(range(56, ALTO_CUARTO, 14)):
        lapiz.line([(0, y), (ANCHO_CUARTO, y)], fill=SUELO_LINEA)
        lapiz.line([(0, y + 1), (ANCHO_CUARTO, y + 1)], fill=SUELO_CLARO)
        for x in range((indice * 46) % 92, ANCHO_CUARTO, 92):
            lapiz.line([(x, y), (x, min(y + 14, ALTO_CUARTO))], fill=SUELO_LINEA)

    # Zona de juegos: una alfombra redonda y despejada, abajo al centro-derecha.
    lapiz.ellipse([176, 108, 288, 168], fill=ALFOMBRA, outline=ALFOMBRA_BORDE)
    lapiz.ellipse([188, 116, 276, 160], fill=ALFOMBRA, outline=ALFOMBRA_BORDE)
    lapiz.ellipse([248, 122, 276, 158], fill=ALFOMBRA, outline=ALFOMBRA_BORDE)

    # Zona de dormir: una litera de tres pisos. Sin perspectiva, una cama suelta se
    # lee como una estantería; una litera con sus postes y su escalera, no.
    x0, x1 = 14, 98
    suelo_litera = 168
    for nivel in range(3):
        y = suelo_litera - nivel * 22
        lapiz.rectangle([x0 + 6, y - 9, x1 - 6, y], fill=SABANA)
        lapiz.rectangle([x0 + 28, y - 9, x1 - 6, y], fill=COJIN)
        lapiz.line([(x0 + 28, y - 9), (x1 - 6, y - 9)], fill=SABANA_SOMBRA)
        lapiz.line([(x0 + 28, y - 9), (x0 + 28, y)], fill=SABANA_SOMBRA)
        lapiz.rectangle([x0 + 8, y - 8, x0 + 24, y - 1], fill=ALMOHADA)
        lapiz.line([(x0 + 8, y - 1), (x0 + 24, y - 1)], fill=SABANA_SOMBRA)
        lapiz.rectangle([x0, y, x1, y + 3], fill=MADERA)
        lapiz.line([(x0, y + 3), (x1, y + 3)], fill=MADERA_OSCURA)
    # Postes y escalera.
    lapiz.rectangle([x0, suelo_litera - 68, x0 + 4, suelo_litera + 3], fill=MADERA_OSCURA)
    lapiz.rectangle([x1 - 4, suelo_litera - 68, x1, suelo_litera + 3], fill=MADERA_OSCURA)
    for escalon in range(4):
        y = suelo_litera - 6 - escalon * 20
        lapiz.rectangle([x1 - 12, y, x1 - 6, y + 2], fill=MADERA)

    # Una planta junto a la ventana, para que se vea que alguien vive aquí.
    lapiz.rectangle([76, 38, 84, 52], fill=MADERA_OSCURA)
    lapiz.rectangle([77, 36, 83, 40], fill=(86, 150, 92))
    lapiz.rectangle([79, 32, 81, 38], fill=(86, 150, 92))
    lapiz.point((76, 34), fill=(110, 180, 110))
    lapiz.point((83, 35), fill=(110, 180, 110))

    # Tres mesas con su monitor y su teclado.
    for indice, (x, y) in enumerate(MESAS):
        lapiz.rectangle([x, y + 16, x + 52, y + 20], fill=MADERA)
        lapiz.rectangle([x + 3, y + 20, x + 7, y + 34], fill=MADERA_OSCURA)
        lapiz.rectangle([x + 45, y + 20, x + 49, y + 34], fill=MADERA_OSCURA)
        lapiz.rectangle([x + 14, y - 2, x + 38, y + 14], fill=VISOR)
        lapiz.rectangle([x + 16, y, x + 36, y + 11], fill=PANTALLA)
        lapiz.rectangle([x + 18 + indice, y + 2, x + 34 - indice, y + 4], fill=PANTALLA_LUZ)
        lapiz.rectangle([x + 24, y + 14, x + 28, y + 17], fill=VISOR)
        lapiz.rectangle([x + 12, y + 13, x + 40, y + 16], fill=TEJAS)

    return imagen


def robot(pose: str, paso: int) -> Image.Image:
    """Un fotograma del robot (32x32). `pose` es idle | walk | type | sleep."""
    marco = Image.new('RGBA', (LADO, LADO), (0, 0, 0, 0))
    lapiz = ImageDraw.Draw(marco)

    if pose == 'sleep':
        # Tumbado en la cama: cuerpo horizontal, visor a un lado y su Z.
        lapiz.rectangle([6, 20, 26, 26], fill=ROBOT)
        lapiz.rectangle([6, 24, 26, 26], fill=ROBOT_SOMBRA)
        lapiz.rounded_rectangle([4, 17, 14, 25], radius=2, fill=ROBOT)
        lapiz.rectangle([6, 19, 12, 22], fill=VISOR)
        lapiz.line([(15, 18), (15, 15)], fill=ROBOT_SOMBRA)
        lapiz.rectangle([18, 12, 19, 13], fill=ROBOT_LUZ)
        lapiz.rectangle([20, 9, 21, 10], fill=ROBOT_LUZ)
        if paso % 2 == 1:
            lapiz.rectangle([22, 6, 23, 7], fill=ROBOT_LUZ)
        return marco

    # Al andar, el cuerpo sube y baja un píxel: es lo que hace que se lea el paso.
    balanceo = [0, 1, 0, -1][paso % 4] if pose == 'walk' else 0
    cuerpo_y = 13 + balanceo

    lapiz.rounded_rectangle([9, cuerpo_y, 22, cuerpo_y + 12], radius=2, fill=ROBOT)
    lapiz.rectangle([11, cuerpo_y + 1, 20, cuerpo_y + 3], fill=ROBOT_LUZ)
    lapiz.rectangle([9, cuerpo_y + 9, 22, cuerpo_y + 12], fill=ROBOT_SOMBRA)

    lapiz.rounded_rectangle([8, cuerpo_y - 9, 23, cuerpo_y - 1], radius=2, fill=ROBOT)
    lapiz.rectangle([10, cuerpo_y - 7, 21, cuerpo_y - 3], fill=VISOR)

    lapiz.line([(15, cuerpo_y - 9), (15, cuerpo_y - 11)], fill=ROBOT_SOMBRA)
    lapiz.point((15, cuerpo_y - 12), fill=ROBOT_LUZ)

    # Los ojos miran a un lado u otro según el paso: da vida sin más fotogramas.
    ojo_x = 12 if paso % 2 == 0 else 18
    lapiz.point((ojo_x, cuerpo_y - 5), fill=OJO)
    lapiz.point((ojo_x + 1, cuerpo_y - 5), fill=OJO)

    if pose == 'type':
        # En la mesa: brazos encima del teclado y teclado que asoma por delante.
        lapiz.rectangle([6, cuerpo_y + 3, 8, cuerpo_y + 6], fill=BRAZO)
        lapiz.rectangle([23, cuerpo_y + 3, 25, cuerpo_y + 6], fill=BRAZO)
        lapiz.rectangle([9, cuerpo_y + 14, 22, cuerpo_y + 16], fill=TEJAS)
        lapiz.line([(9, cuerpo_y + 16), (22, cuerpo_y + 16)], fill=TEJAS_SOMBRA)
        if paso % 2 == 1:
            lapiz.point((13, cuerpo_y + 13), fill=BRAZO)
            lapiz.point((18, cuerpo_y + 13), fill=BRAZO)
        return marco

    if pose == 'idle':
        # Malabares: tres bolas de 3x3, cada una con su desfase, dibujadas en el
        # propio fotograma (el bucle queda consistente sin simular físicas).
        for indice in range(3):
            altura = [6, 3, 0, 3][(paso + indice * 2) % 4]
            bx = 9 + indice * 6
            by = 2 + (6 - altura)
            lapiz.rectangle([bx, by, bx + 2, by + 2], fill=BOLA[indice])
            lapiz.point((bx, by), fill=(255, 255, 255))
        # Los brazos acompañan: arriba cuando las bolas están altas.
        alto = [6, 3, 0, 3][paso % 4]
        if alto >= 3:
            lapiz.rectangle([6, cuerpo_y + 1, 8, cuerpo_y + 4], fill=BRAZO)
            lapiz.rectangle([23, cuerpo_y + 1, 25, cuerpo_y + 4], fill=BRAZO)
        else:
            lapiz.rectangle([6, cuerpo_y + 4, 8, cuerpo_y + 8], fill=BRAZO)
            lapiz.rectangle([23, cuerpo_y + 4, 25, cuerpo_y + 8], fill=BRAZO)
        lapiz.rectangle([12, cuerpo_y + 12, 13, 29], fill=BRAZO)
        lapiz.rectangle([18, cuerpo_y + 12, 19, 29], fill=BRAZO)
        return marco

    # De pie (o andando): las piernas se abren según el paso.
    if pose == 'walk':
        separacion = [2, 4, 6, 4][paso % 4]
    else:
        separacion = 3
    lapiz.rectangle([16 - separacion, cuerpo_y + 12, 17 - separacion, 29], fill=BRAZO)
    lapiz.rectangle([16 + separacion - 1, cuerpo_y + 12, 16 + separacion, 29], fill=BRAZO)

    return marco


def hoja_de_sprites() -> tuple[Image.Image, dict]:
    """Coloca los fotogramas en una rejilla y devuelve también sus coordenadas."""
    animaciones = {
        'idle': {'fps': 6, 'poses': [('idle', i) for i in range(4)]},
        'walk': {'fps': 8, 'poses': [('walk', i) for i in range(4)]},
        'type': {'fps': 6, 'poses': [('type', i) for i in range(2)]},
        'sleep': {'fps': 2, 'poses': [('sleep', i) for i in range(2)]},
    }

    columnas = max(len(animacion['poses']) for animacion in animaciones.values())
    hoja = Image.new('RGBA', (columnas * LADO, len(animaciones) * LADO), (0, 0, 0, 0))

    salida = {}
    for fila, (nombre, animacion) in enumerate(animaciones.items()):
        fotogramas = []
        for columna, (pose, paso) in enumerate(animacion['poses']):
            hoja.paste(robot(pose, paso), (columna * LADO, fila * LADO))
            fotogramas.append({'x': columna * LADO, 'y': fila * LADO, 'w': LADO, 'h': LADO})
        salida[nombre] = {'fps': animacion['fps'], 'frames': fotogramas}

    return hoja, salida


def main() -> None:
    os.makedirs(SALIDA, exist_ok=True)

    cuarto().save(os.path.join(SALIDA, 'room.png'))
    hoja, animaciones = hoja_de_sprites()
    hoja.save(os.path.join(SALIDA, 'robot.png'))

    mapa = {
        'size': LADO,
        'room': {'width': ANCHO_CUARTO, 'height': ALTO_CUARTO},
        # Dónde está cada sitio, para que el navegador sepa a dónde va cada robot.
        'places': {
            'desks': [{'x': x + 26, 'y': y + 26} for x, y in MESAS],
            # El robot dormido se tumba pegado a la izquierda de su marco, así que el
            # punto de la cama se corre a la izquierda para que quede en el colchón.
            'beds': [{'x': x - 12, 'y': y - 8} for x, y in CAMAS],
            'juggling': {'x': ALFOMBRA_CENTRO[0], 'y': ALFOMBRA_CENTRO[1]},
        },
        'animations': animaciones,
    }
    with open(os.path.join(SALIDA, 'robot.json'), 'w', encoding='utf-8') as fichero:
        json.dump(mapa, fichero, indent=2)
        fichero.write('\n')

    print(f'room.png  {ANCHO_CUARTO}x{ALTO_CUARTO}')
    print(f'robot.png {hoja.width}x{hoja.height} ({LADO}px por fotograma)')
    print('animaciones:', ', '.join(f'{nombre} ({len(datos["frames"])} a {datos["fps"]} fps)'
                                   for nombre, datos in animaciones.items()))


if __name__ == '__main__':
    main()
