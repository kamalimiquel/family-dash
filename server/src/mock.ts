/** Datos simulados: SOLO si alguien arranca el servidor con DASH_MOCK=1. */
export function isMock(): boolean {
  return process.env.DASH_MOCK === '1'
}
