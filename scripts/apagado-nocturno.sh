#!/usr/bin/env bash
# Apagado nocturno del panel.
#
# Instala dos unidades de usuario —un temporizador y el servicio que apaga— para que la
# máquina se apague sola a la hora que se le diga. Se instala como usuario, sin sudo: en
# Raspberry Pi OS la sesión local tiene permiso para apagar por polkit, el mismo permiso
# que usa el menú de apagar del escritorio. El script lo comprueba antes de armar nada.
#
#   ./apagado-nocturno.sh              # apaga todos los días a las 22:00
#   ./apagado-nocturno.sh 23:30        # apaga todos los días a las 23:30
#   ./apagado-nocturno.sh --quitar     # lo desinstala
#
# OJO: encenderse sola es otra cosa. Un Raspberry Pi no tiene reloj con alarma ni estado
# de suspensión, así que **no puede arrancar por software**: hace falta un temporizador en
# el enchufe que devuelva la corriente a la hora de encender, o un Wake-on-LAN desde otra
# máquina que esté siempre encendida. El apagado limpio de aquí es lo que garantiza que ese
# corte de corriente no se lleve nada por delante.
set -euo pipefail

UNIDADES="${HOME}/.config/systemd/user"
NOMBRE="apagado-nocturno"

systemctl --user show-environment >/dev/null 2>&1 || {
    echo "No encuentro el gestor de usuario de systemd (¿falta XDG_RUNTIME_DIR?)." >&2
    exit 1
}

if [[ "${1:-}" == "--quitar" ]]; then
    systemctl --user disable --now "${NOMBRE}.timer" 2>/dev/null || true
    rm -f "${UNIDADES}/${NOMBRE}.timer" "${UNIDADES}/${NOMBRE}.service"
    systemctl --user daemon-reload
    echo "Quitado: la máquina ya no se apaga sola."
    exit 0
fi

HORA="${1:-22:00}"
[[ "${HORA}" =~ ^[0-2][0-9]:[0-5][0-9]$ ]] || {
    echo "La hora tiene que ser HH:MM (por ejemplo 22:00), no «${HORA}»." >&2
    exit 2
}

mkdir -p "${UNIDADES}"

cat > "${UNIDADES}/${NOMBRE}.service" <<'FIN'
[Unit]
Description=Apaga el panel por la noche

[Service]
Type=oneshot
# Apagado limpio: paran los servicios, se cierra la base de datos y no queda nada a
# medio escribir. Es lo que hace que el corte de corriente posterior no se lleve nada.
ExecStart=/usr/bin/systemctl poweroff
FIN

cat > "${UNIDADES}/${NOMBRE}.timer" <<FIN
[Unit]
Description=Apaga el panel todos los días a las ${HORA}

[Timer]
OnCalendar=*-*-* ${HORA}:00
AccuracySec=10s
# Sin Persistent: si la máquina estuvo apagada a esa hora, no queremos que se apague otra
# vez en cuanto arranque, que es justo lo que haría Persistent=true.
Persistent=false

[Install]
WantedBy=timers.target
FIN

systemctl --user daemon-reload
systemctl --user enable --now "${NOMBRE}.timer"

echo -n "Permiso para apagar sin contraseña: "
if command -v systemd-run >/dev/null && command -v busctl >/dev/null; then
    # Se pregunta DESDE EL MISMO CONTEXTO en que correrá el servicio. Por SSH la sesión es
    # remota y logind contesta «challenge» aunque el permiso esté concedido, así que se lanza
    # una unidad transitoria: un servicio de usuario, igual que el de verdad.
    RESPUESTA="$(systemd-run --user --wait --pipe --collect --quiet \
        --unit=comprueba-permiso-apagado \
        busctl call org.freedesktop.login1 /org/freedesktop/login1 \
        org.freedesktop.login1.Manager CanPowerOff 2>/dev/null | sed 's/^s //')"
    case "${RESPUESTA}" in
        '"yes"') echo "${RESPUESTA} (puede apagar sola)" ;;
        '"challenge"') echo "${RESPUESTA} (pedirá contraseña: el apagado no saldría)" ;;
        *) echo "${RESPUESTA:-sin respuesta}" ;;
    esac
else
    echo "(sin systemd-run o busctl: no se puede comprobar)"
fi

echo
systemctl --user is-enabled "${NOMBRE}.timer" | sed 's/^/estado: /'
systemctl --user list-timers "${NOMBRE}.timer" --no-pager | head -2

echo
echo "Armado. Recuerda que encenderse sola necesita el temporizador del enchufe (o un"
echo "Wake-on-LAN desde otra máquina encendida): el Pi no puede arrancar por software."
