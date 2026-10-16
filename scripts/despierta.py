#!/usr/bin/env python3
"""Manda un paquete mágico de Wake-on-LAN para despertar la máquina del panel.

    ./despierta.py d8:3a:dd:ac:16:ef                    # a la red local, por difusión
    ./despierta.py d8:3a:dd:ac:16:ef 192.168.1.255 9    # difusión de la subred y puerto

Sirve igual desde el NAS —en su tarea programada— que desde cualquier otro cacharro de la
red. Solo necesita Python 3, nada más.

OJO, dos cosas que hay que tener claras antes de contar con esto:

- **Despertar por red solo funciona por cable.** Por WiFi no hay manera: cuando la máquina
  está apagada, la tarjeta inalámbrica no existe para nadie y no puede recibir nada. Si el
  panel va por WiFi, esto no sirve (habría que enchufarle un cable).
- **Y solo si se apagó dejando la tarjeta a la escucha**: en la Pi,
  `nmcli connection modify <conexión> 802-3-ethernet.wake-on-lan magic`. En un Raspberry Pi 4
  hace falta además que el EEPROM no corte la alimentación al apagar (`POWER_OFF_ON_HALT=0`,
  que es lo que trae de fábrica: comprobable con `rpi-eeprom-config`).
"""
import socket
import sys


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2

    mac = sys.argv[1].replace(":", "").replace("-", "").lower()
    if len(mac) != 12 or any(c not in "0123456789abcdef" for c in mac):
        print(f"«{sys.argv[1]}» no parece una dirección MAC.", file=sys.stderr)
        return 2

    destino = sys.argv[2] if len(sys.argv) > 2 else "255.255.255.255"
    try:
        puerto = int(sys.argv[3]) if len(sys.argv) > 3 else 9
    except ValueError:
        print("El puerto tiene que ser un número (el de siempre es 9).", file=sys.stderr)
        return 2

    paquete = b"\xff" * 6 + bytes.fromhex(mac) * 16
    conexion = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    conexion.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    conexion.sendto(paquete, (destino, puerto))
    conexion.close()

    print(f"Paquete mágico enviado a {mac} por {destino}:{puerto}")
    print("(Si la máquina está apagada pero a la escucha, arranca en unos segundos.)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
