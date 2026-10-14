import type { LocationPerson } from './index.js'

/** Hace cuántos minutos, para que las posiciones parezcan recién llegadas. */
const hace = (minutos: number): string => new Date(Date.now() - minutos * 60_000).toISOString()

/**
 * Gente de mentira, para probar toda la cadena del widget —el embed de Google, la
 * rotación, el cartel con el nombre— sin credenciales ni datos de nadie. Las
 * direcciones son de Barcelona, que es la ciudad de ejemplo del proyecto.
 */
export function mockPeople(): LocationPerson[] {
  return [
    {
      name: 'Marta',
      address: 'Avinguda Diagonal, 401, Barcelona',
      latitude: 41.3948,
      longitude: 2.1478,
      updatedAt: hace(3),
      accuracy: 18,
      battery: 62,
      charging: false,
    },
    {
      name: 'Pau',
      address: 'Plaça de Sant Jaume, Barcelona',
      latitude: 41.3827,
      longitude: 2.1769,
      updatedAt: hace(12),
      accuracy: 25,
      battery: 34,
      charging: true,
    },
    {
      name: 'Nil',
      address: 'Parc de la Ciutadella, Barcelona',
      latitude: 41.3874,
      longitude: 2.1686,
      updatedAt: hace(47),
      accuracy: 120,
      battery: 88,
      charging: false,
    },
  ]
}
