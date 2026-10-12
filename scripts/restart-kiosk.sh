#!/usr/bin/env bash
# Reinicia el kiosco (Chromium a pantalla completa) para que cargue la última
# versión del panel. Vale tanto desde una terminal dentro de la sesión gráfica
# como por SSH (necesita el socket de Wayland, que se busca solo).
#
#   ./scripts/restart-kiosk.sh              # http://localhost:4173/?kiosk=1
#   ./scripts/restart-kiosk.sh <url>        # otra URL
#
# Ojo: hay que matar el navegador de verdad y borrar su perfil antes de
# relanzarlo. Si no, Chromium detecta la instancia viva (mismo --user-data-dir),
# le pasa la URL a esa y se limita a enfocar la ventana: seguirías viendo la
# versión antigua sin ningún error a la vista.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=$XDG_RUNTIME_DIR/bus}"

if [ -z "${WAYLAND_DISPLAY:-}" ]; then
  WAYLAND_DISPLAY="$(ls "$XDG_RUNTIME_DIR" 2>/dev/null | grep -m1 '^wayland-' || true)"
  [ -n "$WAYLAND_DISPLAY" ] && export WAYLAND_DISPLAY
fi

PROFILE="${XDG_CACHE_HOME:-$HOME/.cache}/family-dash-chromium"
LOG="${XDG_CACHE_HOME:-$HOME/.cache}/family-dash-kiosk.log"

echo "== cerrando el kiosco anterior =="
pkill -9 -f "user-data-dir=$PROFILE" 2>/dev/null || true
pkill -9 -f "systemd-inhibit.*family-dash-chromium" 2>/dev/null || true
sleep 2

echo "== perfil limpio =="
rm -rf "$PROFILE"

echo "== relanzando =="
setsid "$HERE/kiosk.sh" "${1:-http://localhost:4173/?kiosk=1}" </dev/null >>"$LOG" 2>&1 &
sleep 8

if pgrep -f "user-data-dir=$PROFILE" >/dev/null; then
  echo "kiosco en marcha (PID $(pgrep -f "user-data-dir=$PROFILE" | head -1)); log: $LOG"
else
  echo "AVISO: no encuentro el proceso del kiosco; mira $LOG" >&2
  exit 1
fi
