/** Un titular de un feed. */
export interface FeedItem {
  title: string
  link: string | null
  /** ISO 8601, o `null` si el feed no traía una fecha que se entienda. */
  date: string | null
}

/** Entidades con nombre que salen de verdad en los feeds. */
const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  aacute: 'á',
  eacute: 'é',
  iacute: 'í',
  oacute: 'ó',
  uacute: 'ú',
  uuml: 'ü',
  agrave: 'à',
  egrave: 'è',
  igrave: 'ì',
  ograve: 'ò',
  ugrave: 'ù',
  ntilde: 'ñ',
  ccedil: 'ç',
  szlig: 'ß',
  auml: 'ä',
  ouml: 'ö',
  euml: 'ë',
  iuml: 'ï',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  laquo: '«',
  raquo: '»',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  bull: '•',
  middot: '·',
  deg: '°',
  euro: '€',
  pound: '£',
  times: '×',
  shy: '',
}

export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (whole, body: string) => {
    if (body.startsWith('#')) {
      const hex = body[1] === 'x' || body[1] === 'X'
      const code = hex ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10)
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return whole
      try {
        return String.fromCodePoint(code)
      } catch {
        return whole
      }
    }
    return ENTITIES[body] ?? ENTITIES[body.toLowerCase()] ?? whole
  })
}

/** Deja el texto en una línea: fuera CDATA, entidades y etiquetas HTML. */
export function cleanText(input: string): string {
  const withoutCdata = input.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  return decodeEntities(withoutCdata.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

const innerTag = (block: string, name: string): string | null => {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'))
  return match?.[1] ?? null
}

/** RSS: `<link>…</link>`. Atom: `<link href="…"/>` (se prefiere `rel="alternate"`). */
const linkOf = (block: string): string | null => {
  const inner = innerTag(block, 'link')
  const text = inner === null ? '' : cleanText(inner)
  if (text) return text

  const attributes = [...block.matchAll(/<link\b([^>]*?)\/?>/gi)].map((match) => match[1] ?? '')
  const preferred = attributes.find((attr) => /rel=["']alternate["']/i.test(attr)) ?? attributes[0]
  const href = preferred?.match(/href=["']([^"']+)["']/i)?.[1]
  return href ? decodeEntities(href).trim() : null
}

const isoOrNull = (raw: string | null): string | null => {
  if (raw === null) return null
  const text = cleanText(raw)
  if (!text) return null
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/**
 * Parser mínimo de RSS 2.0 y Atom: titulares, enlaces y fechas. No es un parser
 * de XML de verdad (para esto no hace falta): son feeds generados, y cualquier
 * entrada que no se entienda se descarta en vez de tumbar la respuesta.
 */
export function parseFeed(xml: string, limit = 12): FeedItem[] {
  const items: FeedItem[] = []

  for (const match of xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)) {
    const block = match[2] ?? ''
    const title = cleanText(innerTag(block, 'title') ?? '')
    if (!title) continue

    items.push({
      title,
      link: linkOf(block),
      date:
        isoOrNull(innerTag(block, 'pubDate')) ??
        isoOrNull(innerTag(block, 'dc:date')) ??
        isoOrNull(innerTag(block, 'published')) ??
        isoOrNull(innerTag(block, 'updated')),
    })

    if (items.length >= limit) break
  }

  return items
}
