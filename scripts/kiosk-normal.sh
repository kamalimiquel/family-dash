#!/usr/bin/env bash
# Saca el panel del modo quiosco y lo deja en una ventana normal.
#
# El kiosco se lanza con `--kiosk`, y eso una página no lo puede deshacer por sí sola
# (no es la pantalla completa de la API del navegador). Por eso lo hace el servidor
# del panel cuando alguien pulsa el pulsador redondo: cierra el Chromium del kiosco y
# lo vuelve a abrir sin `--kiosk`, maximizado.
#
# Se conserva el mismo perfil, así que la sesión y las cookies del panel siguen ahí:
# no hay que volver a conectar Google. Al reiniciar la máquina vuelve el quiosco; eso
# ya lo pone el arranque automático.
set -uo pipefail

URL="${1:-http://localhost:4173/?kiosk=1}"
PROFILE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/family-dash-chromium"
UNIDAD="family-dash-ventana"

BROWSER="$(command -v chromium || command -v chromium-browser || true)"
if [ -z "$BROWSER" ]; then
  echo "kiosco: no encuentro Chromium" >&2
  exit 1
fi

# --- cerrar el kiosco ------------------------------------------------------
# Solo el navegador del panel: se le reconoce por su perfil, que es suyo y de nadie más.
pkill -f -- "--user-data-dir=$PROFILE_DIR" 2>/dev/null || true
for _ in $(seq 1 20); do
  pgrep -f -- "--user-data-dir=$PROFILE_DIR" >/dev/null 2>&1 || break
  sleep 0.5
done

# --- el entorno gráfico ----------------------------------------------------
# Este script puede correr desde el servicio del panel, que no tiene las variables de
# la sesión: se buscan aquí, como se hace para las capturas de pantalla.
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
if [ -z "${WAYLAND_DISPLAY:-}" ]; then
  WAYLAND_DISPLAY="$(ls "$XDG_RUNTIME_DIR" 2>/dev/null | grep -m1 '^wayland-' || true)"
  export WAYLAND_DISPLAY
fi
export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=$XDG_RUNTIME_DIR/bus}"

PLATFORM=()
[ -n "${WAYLAND_DISPLAY:-}" ] && PLATFORM=(--ozone-platform=wayland)

# Las banderas del kiosco, menos `--kiosk`, y maximizado en vez de a pantalla completa.
BANDERAS=(
  "${PLATFORM[@]}"
  --start-maximized
  --user-data-dir="$PROFILE_DIR"
  --password-store=basic
  --noerrdialogs
  --disable-infobars
  --disable-session-crashed-bubble
  --disable-features=TranslateUI,Translate
  --lang=es-ES
  --overscroll-history-navigation=0
  --autoplay-policy=no-user-gesture-required
  --touch-events=enabled
  "$URL"
)

# --- abrirlo en ventana ----------------------------------------------------
# En su propia unidad de systemd, que no depende del servicio del panel: así un
# reinicio del panel (un despliegue, por ejemplo) no se lleva por delante la ventana.
if command -v systemd-run >/dev/null 2>&1; then
  systemctl --user stop "$UNIDAD" 2>/dev/null || true
  systemctl --user reset-failed "$UNIDAD" 2>/dev/null || true

  if systemd-run --user --collect --unit="$UNIDAD" \
    --description="Family Dashboard (ventana normal)" \
    --setenv=XDG_RUNTIME_DIR="$XDG_RUNTIME_DIR" \
    --setenv=WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-}" \
    --setenv=DBUS_SESSION_BUS_ADDRESS="$DBUS_SESSION_BUS_ADDRESS" \
    "$BROWSER" "${BANDERAS[@]}" >/dev/null 2>&1; then
    exit 0
  fi
fi

# Si no hay systemd-run, que al menos arranque y no se muera con este script.
setsid "$BROWSER" "${BANDERAS[@]}" >/dev/null 2>&1 &
disown 2>/dev/null || true
