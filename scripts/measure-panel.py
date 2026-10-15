#!/usr/bin/env python3
"""Mide el panel con CDP y guarda una captura. "Parece que cabe" no vale: los números sí.

Comprueba el tamaño real de cada tarjeta, que nada se desborde, que el fondo de vídeo
exista y corra de verdad, y —con `--tap`— que un toque llegue a la tarjeta del menú y
abra el visor. Los eventos de ratón son de verdad (`Input.dispatchMouseEvent`), no
`.click()`: solo eso demuestra que el elemento *recibe* el toque.

    chromium --headless=new --no-sandbox --disable-gpu \\
      --remote-debugging-port=9222 --remote-allow-origins=* \\
      --window-size=1080,1920 --user-data-dir=/tmp/cdp about:blank &

    uv run --with websocket-client python3 scripts/measure-panel.py \\
      --base http://127.0.0.1:4173 --size 1080x1920 --tap --out /tmp/panel.png

Necesita `websocket-client` (de ahí el `uv run --with`).
"""
import argparse
import base64
import json
import sys
import time
import urllib.request

try:
    from websocket import create_connection
except ImportError:  # pragma: no cover
    sys.exit("falta websocket-client: lánzalo con `uv run --with websocket-client python3 …`")

# Nombre legible -> selector. Los tamaños esperados salen de los centímetros:
# la pantalla es de 27" con 1080x1920, o sea 32,12 px por centímetro.
TARJETAS = [
    ("hora y tiempo", ".widget--now"),
    ("mapa", ".widget--map"),
    ("agenda", ".widget--calendar"),
    ("tareas", ".widget--tasks"),
    ("menu", ".widget--pdf"),
    ("titulares", ".news-strip"),
]

MEDIDA = """(() => {
  const cajas = {};
  for (const [clave, selector] of %s) {
    const nodo = document.querySelector(selector);
    if (!nodo) { cajas[clave] = null; continue; }
    const r = nodo.getBoundingClientRect();
    cajas[clave] = [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
  }
  const pantalla = document.querySelector('.screen');
  const video = document.querySelector('.backdrop__video');
  cajas.desbordeVertical = document.documentElement.scrollHeight - window.innerHeight;
  cajas.sobraAbajo = pantalla ? Math.round(window.innerHeight - pantalla.getBoundingClientRect().bottom) : null;
  cajas.tarjetasNoticias = document.querySelectorAll('.news').length;
  cajas.video = video ? {
    pausado: video.paused,
    segundo: Number(video.currentTime.toFixed(2)),
    tamano: video.videoWidth + 'x' + video.videoHeight,
    error: video.error ? video.error.code : null,
  } : null;
  return cajas;
})()"""

TOQUE = """(() => {
  const tarjeta = document.querySelector('.widget--pdf');
  if (!tarjeta) return null;
  const r = tarjeta.getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
})()"""

VISOR = """(() => {
  const visor = document.querySelector('.viewer');
  return visor ? { abierto: true, fichero: (visor.querySelector('.viewer__name') || {}).textContent } : { abierto: false };
})()"""

TOQUE_TIEMPO = TOQUE.replace(".widget--pdf", ".widget--now")

# El desplegable del tiempo: la tarjeta se ensancha, el reloj se queda arriba, debajo sale
# el radar y la columna de la derecha (temperatura y previsión) no debe cambiar de tamaño.
DESPLEGADO = """(() => {
  const caja = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)];
  };
  const tamano = (sel, prop) => {
    const el = document.querySelector(sel);
    return el ? getComputedStyle(el)[prop] : null;
  };
  const teselas = Array.from(document.querySelectorAll('.radar__map img.leaflet-tile'));
  const tarjeta = document.querySelector('.widget--now');
  return {
    desplegada: !!tarjeta && tarjeta.classList.contains('widget--now--abierto'),
    tarjeta: caja('.widget--now'),
    reloj: caja('.widget--now .clock'),
    radar: caja('.radar'),
    clima: caja('.widget--now .weather'),
    lugar: tamano('.widget--now .weather__place', 'fontSize'),
    valor: tamano('.widget--now .weather__value', 'fontSize'),
    hora: tamano('.widget--now .clock__time', 'fontSize'),
    teselas: teselas.length,
    cargadas: teselas.filter((t) => t.naturalWidth > 0).length,
    pie: (document.querySelector('.radar__pie') || {}).textContent || null,
    aviso: (document.querySelector('.radar__aviso') || {}).textContent || null,
  };
})()"""


class Navegador:
    def __init__(self, puerto: int = 9222):
        objetivos = json.load(urllib.request.urlopen(f"http://127.0.0.1:{puerto}/json"))
        pagina = next(o for o in objetivos if o["type"] == "page")
        self.ws = create_connection(pagina["webSocketDebuggerUrl"], timeout=30)
        self.contador = 0

    def llamar(self, metodo, params=None):
        self.contador += 1
        self.ws.send(json.dumps({"id": self.contador, "method": metodo, "params": params or {}}))
        while True:
            mensaje = json.loads(self.ws.recv())
            if mensaje.get("id") == self.contador:
                return mensaje

    def evaluar(self, expresion):
        resultado = self.llamar("Runtime.evaluate", {"expression": expresion, "returnByValue": True})
        return resultado["result"]["result"].get("value")


def main() -> int:
    parser = argparse.ArgumentParser(description="Mide el panel y saca una captura.")
    parser.add_argument("--base", default="http://127.0.0.1:4173")
    parser.add_argument("--size", default="1080x1920", help="ancho x alto en píxeles")
    parser.add_argument("--espera", type=float, default=8, help="segundos antes de medir")
    parser.add_argument("--tap", action="store_true", help="prueba un toque real en la tarjeta del PDF")
    parser.add_argument(
        "--tap-tiempo",
        action="store_true",
        help="toca la tarjeta de la hora y el tiempo y comprueba el desplegable del radar",
    )
    parser.add_argument("--out", default="/tmp/panel.png")
    args = parser.parse_args()

    ancho, alto = (int(x) for x in args.size.lower().split("x"))
    navegador = Navegador()

    navegador.llamar(
        "Emulation.setDeviceMetricsOverride",
        {"width": ancho, "height": alto, "deviceScaleFactor": 1, "mobile": False},
    )
    navegador.llamar("Page.navigate", {"url": f"{args.base}/?kiosk=1"})
    time.sleep(args.espera)

    print(f"== {ancho}x{alto} (centímetros a 32,12 px/cm) ==")
    cajas = navegador.evaluar(MEDIDA % json.dumps(TARJETAS))
    for clave, _ in TARJETAS:
        caja = cajas.get(clave)
        if not caja:
            print(f"  {clave:15} (no está en el DOM)")
            continue
        _, _, w, h = caja
        print(f"  {clave:15} {w:5} x {h:4} px   = {w / 32.12:5.1f} x {h / 32.12:4.1f} cm")
    print(f"  desborde vertical: {cajas['desbordeVertical']} px (0 es lo bueno)")
    print(f"  sobra abajo:       {cajas['sobraAbajo']} px")
    print(f"  tarjetas de noticias: {cajas['tarjetasNoticias']}")
    print(f"  vídeo de fondo:    {cajas['video']}")

    tamano_antes = navegador.evaluar(
        """(() => {
      const tamano = (sel, prop) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el)[prop] : null;
      };
      return {
        lugar: tamano('.widget--now .weather__place', 'fontSize'),
        valor: tamano('.widget--now .weather__value', 'fontSize'),
        hora: tamano('.widget--now .clock__time', 'fontSize'),
      };
    })()"""
    )

    if args.tap:
        centro = navegador.evaluar(TOQUE)
        if not centro:
            print("  no hay tarjeta de PDF que tocar")
        else:
            for tipo in ("mousePressed", "mouseReleased"):
                navegador.llamar(
                    "Input.dispatchMouseEvent",
                    {
                        "type": tipo,
                        "x": centro["x"],
                        "y": centro["y"],
                        "button": "left",
                        "clickCount": 1,
                        "buttons": 1 if tipo == "mousePressed" else 0,
                    },
                )
                time.sleep(0.12)
            time.sleep(1.5)
            print(f"  toque en el PDF:   {navegador.evaluar(VISOR)}")

    if args.tap_tiempo:
        centro = navegador.evaluar(TOQUE_TIEMPO)
        if not centro:
            print("  no hay tarjeta de la hora y el tiempo que tocar")
        else:
            for tipo in ("mousePressed", "mouseReleased"):
                navegador.llamar(
                    "Input.dispatchMouseEvent",
                    {
                        "type": tipo,
                        "x": centro["x"],
                        "y": centro["y"],
                        "button": "left",
                        "clickCount": 1,
                        "buttons": 1 if tipo == "mousePressed" else 0,
                    },
                )
                time.sleep(0.12)
            time.sleep(6)
            datos = navegador.evaluar(DESPLEGADO) or {}
            print("== el desplegable del tiempo ==")
            print(f"  desplegada:        {datos.get('desplegada')}")
            print(f"  tarjeta:           {datos.get('tarjeta')} (debe ocupar la fila entera)")
            print(f"  reloj:             {datos.get('reloj')}")
            print(f"  radar:             {datos.get('radar')} (debajo del reloj)")
            print(f"  teselas del radar: {datos.get('cargadas')}/{datos.get('teselas')} cargadas")
            print(f"  pie del radar:     {datos.get('pie') or datos.get('aviso')}")
            reloj, radar = datos.get("reloj"), datos.get("radar")
            if reloj and radar:
                print(f"  reloj encima:      {reloj[1] + reloj[3] <= radar[1]} (el reloj acaba donde empieza el radar)")
            # La columna de la derecha no se debe mover; el reloj sí (deja sitio al radar).
            print("  el tiempo, de tamaño (debe ser igual que en reposo):")
            for clave, sello in (("lugar", "weather__place"), ("valor", "weather__value")):
                antes, despues = tamano_antes[clave], datos.get(clave)
                igual = "igual" if antes == despues else f"¡CAMBIÓ! (antes {antes})"
                print(f"    {sello:16} {despues}  {igual}")
            antes, despues = tamano_antes["hora"], datos.get("hora")
            print(f"    {'clock__time':16} {despues}  (en reposo {antes}: el reloj se recoge a propósito)")

    captura = navegador.llamar("Page.captureScreenshot", {"format": "png"})
    with open(args.out, "wb") as fichero:
        fichero.write(base64.b64decode(captura["result"]["data"]))
    print(f"  captura: {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
