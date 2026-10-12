#!/usr/bin/env bash
# Lanza el panel familiar en Chromium a pantalla completa (modo kiosco).
#
#   ./scripts/kiosk.sh                       # http://localhost:4173/?kiosk=1
#   ./scripts/kiosk.sh http://pi.local:4173  # otra URL
#
# Mantiene la pantalla encendida: en X11 con xset, y en Wayland (labwc) con un
# inhibidor de logind, que evita el idle/sleep del sistema mientras corre.
set -euo pipefail

URL="${1:-http://localhost:4173/?kiosk=1}"

# --- que la pantalla no se apague -----------------------------------------
if command -v xset >/dev/null 2>&1 && [ -n "${DISPLAY:-}" ]; then
  xset s off || true
  xset -dpms || true
  xset s noblank || true
fi

INHIBIT=()
if command -v systemd-inhibit >/dev/null 2>&1; then
  # Best-effort: bloquear idle/sleep puede requerir autorización de polkit según
  # desde dónde se lance. Se prueba y, si no lo permite, se arranca sin inhibidor.
  for WHAT in "idle:sleep" "idle"; do
    if systemd-inhibit --what="$WHAT" --why="Family Dashboard kiosk" --mode=block \
      true >/dev/null 2>&1; then
      INHIBIT=(systemd-inhibit --what="$WHAT" --why="Family Dashboard kiosk" --mode=block)
      break
    fi
  done
fi

# --- navegador ------------------------------------------------------------
# Raspberry Pi OS Bookworm/Trixie: `chromium`; imágenes antiguas: `chromium-browser`.
BROWSER="$(command -v chromium || command -v chromium-browser || true)"
if [ -z "$BROWSER" ]; then
  echo "Chromium no encontrado. Instálalo con: sudo apt install -y chromium" >&2
  exit 1
fi

PROFILE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/family-dash-chromium"
mkdir -p "$PROFILE_DIR"

# Sesión Wayland (Raspberry Pi OS con labwc) → Chromium debe usar ozone/wayland;
# si no, intenta X11, no encuentra $DISPLAY y muere.
PLATFORM=()
if [ -n "${WAYLAND_DISPLAY:-}" ] && [ -z "${DISPLAY:-}" ]; then
  PLATFORM=(--ozone-platform=wayland)
fi

# Espera (máx. 30 s) a que el servidor del panel responda.
for _ in $(seq 1 30); do
  if curl -sf -o /dev/null "$URL"; then
    break
  fi
  sleep 1
done

exec "${INHIBIT[@]}" "$BROWSER" \
  "${PLATFORM[@]}" \
  --kiosk \
  --user-data-dir="$PROFILE_DIR" \
  --password-store=basic \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-features=TranslateUI,Translate \
  --lang=es-ES \
  --check-for-update-interval=31536000 \
  --overscroll-history-navigation=0 \
  --autoplay-policy=no-user-gesture-required \
  --touch-events=enabled \
  "$URL"
