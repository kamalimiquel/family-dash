# Privacidad

*Family Dashboard* es un panel doméstico: se ejecuta **en casa**, en un ordenador propio, y lo usa
solo la familia que lo instala.

## Qué datos toca

- **Cuenta de Google** (opcional): con el permiso `calendar.readonly` lee los eventos del calendario
  para enseñarlos en pantalla; con el permiso `tasks` lee las tareas pendientes y marca como hechas
  las que se pulsan en el panel. Se conceden al instalar y se pueden retirar cuando se quiera desde
  <https://myaccount.google.com/permissions>.
- **Contraseña de la carpeta compartida** y **cookies del mapa** (opcionales): se guardan en el
  propio equipo, fuera del repositorio.

## Dónde van los datos

No salen de casa. No hay servidor del proyecto, ni cuentas de usuario, ni analítica, ni publicidad.
Todo se guarda en una base de datos SQLite dentro del propio equipo (`data/dashboard.sqlite`), y las
credenciales en ficheros con permisos restringidos, fuera del repositorio.

## Terceros

Lo que se enseña viene de servicios que ya usas: Google (Calendar y Tasks), el tiempo y los
titulares de las fuentes RSS que configures, y las ubicaciones compartidas de Google Maps. Cada uno
se rige por su propia política.

## Este repositorio

No contiene datos de nadie: ni calendarios, ni tareas, ni direcciones, ni credenciales.
