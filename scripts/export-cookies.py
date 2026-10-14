#!/usr/bin/env python3
"""Exporta las cookies de Google del Chromium de esta máquina a un fichero, para
poder leer más tarde las ubicaciones compartidas.

Cómo: las cookies de Chromium están cifradas con la clave del llavero del sistema,
así que no se pueden leer del SQLite a mano. Se las pedimos **al propio Chromium**
por CDP (`Storage.getCookies`), que las devuelve ya descifradas. Se trabaja sobre
una COPIA del perfil, para no tocar el del usuario.

Lo que este script NO hace: imprimir valores de cookies. Solo nombres, dominios y
dónde ha dejado el fichero.

Uso: python3 export-cookies.py [destino.json]
"""
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request

from websocket import create_connection

PERFIL = os.path.expanduser("~/.config/chromium")
COPIA = "/tmp/chromium-copy"
PUERTO = 9333
DESTINO = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser(
    "~/.config/family-dash/google-cookies.json"
)
# Nombres que usan las librerías de ubicaciones compartidas.
IMPRESCINDIBLES = ["__Secure-1PSID", "__Secure-3PSID", "__Secure-1PSIDTS"]


def exporta() -> int:
    if not os.path.exists(os.path.join(PERFIL, "Default", "Cookies")):
        print("No encuentro el almacén de cookies de Chromium.")
        return 1

    shutil.rmtree(COPIA, ignore_errors=True)
    os.makedirs(os.path.join(COPIA, "Default"), exist_ok=True)
    for fichero in ("Cookies", "Cookies-journal", "Preferences"):
        origen = os.path.join(PERFIL, "Default", fichero)
        if os.path.exists(origen):
            shutil.copy2(origen, os.path.join(COPIA, "Default", fichero))
    for fichero in ("Local State",):
        origen = os.path.join(PERFIL, fichero)
        if os.path.exists(origen):
            shutil.copy2(origen, os.path.join(COPIA, fichero))

    print(f"copia del perfil en {COPIA} (no se toca el original)")

    chromium = shutil.which("chromium") or shutil.which("chromium-browser")
    if not chromium:
        print("No encuentro el ejecutable de Chromium.")
        return 1

    proceso = subprocess.Popen(
        [
            chromium,
            "--headless=new",
            "--no-sandbox",
            "--disable-gpu",
            f"--remote-debugging-port={PUERTO}",
            "--remote-allow-origins=*",
            f"--user-data-dir={COPIA}",
            "about:blank",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    try:
        for _ in range(30):
            time.sleep(0.5)
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{PUERTO}/json/version", timeout=2)
                break
            except Exception:  # noqa: BLE001 — todavía no ha arrancado
                continue
        else:
            print("Chromium no ha arrancado.")
            return 1

        objetivos = json.load(urllib.request.urlopen(f"http://127.0.0.1:{PUERTO}/json"))
        pagina = next(o for o in objetivos if o["type"] == "page")
        ws = create_connection(pagina["webSocketDebuggerUrl"], timeout=30)
        contador = 0

        def llamar(metodo, params=None):
            nonlocal contador
            contador += 1
            ws.send(json.dumps({"id": contador, "method": metodo, "params": params or {}}))
            while True:
                mensaje = json.loads(ws.recv())
                if mensaje.get("id") == contador:
                    return mensaje

        # Hay que navegar a un dominio para que el navegador cargue su almacén.
        llamar("Page.navigate", {"url": "https://maps.google.com/"})
        time.sleep(6)

        respuesta = llamar("Storage.getCookies", {})
        todas = respuesta.get("result", {}).get("cookies", [])
        google = [
            cookie
            for cookie in todas
            if cookie.get("domain", "").endswith("google.com")
        ]
        print(f"cookies totales: {len(todas)} · de google.com: {len(google)}")

        nombres = sorted({cookie["name"] for cookie in google})
        print(f"nombres: {', '.join(nombres[:24])}{' …' if len(nombres) > 24 else ''}")

        con_valor = [c for c in google if c.get("value")]
        faltan = [n for n in IMPRESCINDIBLES if n not in {c["name"] for c in con_valor}]
        if faltan:
            print(f"AVISO: no he podido leer {', '.join(faltan)} (¿llavero bloqueado?)")
            if faltan == IMPRESCINDIBLES:
                return 1

        os.makedirs(os.path.dirname(DESTINO), exist_ok=True)
        with open(DESTINO, "w", encoding="utf-8") as fichero:
            json.dump(con_valor, fichero, ensure_ascii=False, indent=2)
        os.chmod(DESTINO, 0o600)
        print(f"escrito {DESTINO} ({len(con_valor)} cookies, permisos 600)")

        # Y en formato Netscape, que es lo que esperan las librerías tipo locationsharinglib.
        netscape = DESTINO.replace(".json", ".txt")
        with open(netscape, "w", encoding="utf-8") as fichero:
            fichero.write("# Netscape HTTP Cookie File\n")
            for cookie in con_valor:
                dominio = cookie.get("domain", "")
                marca = "TRUE" if dominio.startswith(".") else "FALSE"
                seguro = "TRUE" if cookie.get("secure") else "FALSE"
                caduca = int(cookie.get("expires") or 0)
                fichero.write(
                    "\t".join(
                        [
                            dominio,
                            marca,
                            cookie.get("path", "/"),
                            seguro,
                            str(caduca),
                            cookie["name"],
                            cookie["value"],
                        ]
                    )
                    + "\n"
                )
        os.chmod(netscape, 0o600)
        print(f"escrito {netscape} (formato Netscape, permisos 600)")
        return 0
    finally:
        proceso.terminate()
        try:
            proceso.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proceso.kill()
        shutil.rmtree(COPIA, ignore_errors=True)
        print("copia del perfil borrada")


if __name__ == "__main__":
    raise SystemExit(exporta())
