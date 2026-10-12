import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { DATA_DIR, PDF_MAX_PAGES, PDF_RENDER_WIDTH, PDF_TTL_MS, type PdfSource } from '../config.js'
import type { Db } from '../db.js'
import { isMock } from '../mock.js'
import { getPdfSource } from './source.js'

const exec = promisify(execFile)

export interface PdfDocument {
  /** Nombre del fichero, tal cual está en la carpeta compartida. */
  file: string
  pages: number
  bytes: number
  modifiedAt: string
  /** Cambia cuando cambia el fichero: rompe la caché del navegador. */
  version: string
  /** Ancho/alto de la página, para colocar la miniatura sin deformarla. */
  aspect: number
}

export interface PdfSnapshot {
  document: PdfDocument | null
  /** Por qué no hay PDF que enseñar (se dice en pantalla, no se deja en blanco). */
  reason: { error: string; message: string } | null
  meta: { source: string; fetchedAt: string; ttlSeconds: number }
}

/** Falta el PDF, no se puede leer o no se puede rasterizar: no es un fallo del servidor. */
export class PdfUnavailable extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'PdfUnavailable'
    this.code = code
  }
}

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error))

/** El PDF más reciente de la carpeta, o el fichero concreto si se ató uno. */
async function findFile(source: PdfSource): Promise<string> {
  if (source.file) {
    if (!fs.existsSync(source.file)) {
      throw new PdfUnavailable('pdf_not_found', `no existe ${source.file}`)
    }
    return source.file
  }

  const dir = source.dir
  if (!dir) throw new PdfUnavailable('pdf_not_configured', 'falta decir en qué carpeta está el PDF')

  let names: string[]
  try {
    names = await fs.promises.readdir(dir)
  } catch (error) {
    throw new PdfUnavailable('pdf_unreachable', `no se puede leer ${dir}: ${reason(error)}`)
  }

  const pdfs = names.filter((name) => name.toLowerCase().endsWith('.pdf') && !name.startsWith('.'))
  if (pdfs.length === 0) throw new PdfUnavailable('pdf_empty', `no hay ningún PDF en ${dir}`)

  const dated = await Promise.all(
    pdfs.map(async (name) => ({ name, stat: await fs.promises.stat(path.join(dir, name)) })),
  )
  dated.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)

  const newest = dated[0]
  if (!newest) throw new PdfUnavailable('pdf_empty', `no hay ningún PDF en ${dir}`)
  return path.join(dir, newest.name)
}

/** Páginas y proporción de la primera, según pdfinfo. */
async function inspect(file: string): Promise<{ pages: number; aspect: number }> {
  try {
    const { stdout } = await exec('pdfinfo', [file], { timeout: 20_000 })
    const pages = Number(/Pages:\s+(\d+)/.exec(stdout)?.[1] ?? 0)
    const size = /Page size:\s+([\d.]+)\s+x\s+([\d.]+)/.exec(stdout)
    const width = Number(size?.[1] ?? 0)
    const height = Number(size?.[2] ?? 0)

    return {
      pages: Math.max(1, Math.min(pages || 1, PDF_MAX_PAGES)),
      aspect: width > 0 && height > 0 ? width / height : 1 / Math.SQRT2,
    }
  } catch (error) {
    throw new PdfUnavailable('pdf_unreadable', `no se ha podido leer el PDF: ${reason(error)}`)
  }
}

async function resolve(db: Db): Promise<{ file: string; version: string; pages: number; aspect: number; bytes: number; modifiedAt: Date }> {
  const file = await findFile(getPdfSource(db))

  let stat: fs.Stats
  try {
    stat = await fs.promises.stat(file)
  } catch (error) {
    throw new PdfUnavailable('pdf_not_found', `no se puede leer ${file}: ${reason(error)}`)
  }

  const info = await inspect(file)

  return {
    file,
    version: `${Math.round(stat.mtimeMs)}-${stat.size}`,
    pages: info.pages,
    aspect: info.aspect,
    bytes: stat.size,
    modifiedAt: stat.mtimeMs ? new Date(stat.mtimeMs) : new Date(),
  }
}

/** Deja las páginas en `data/pdf/<version>/` y borra las versiones viejas. */
async function ensureRendered(file: string, version: string, pages: number): Promise<string> {
  const outDir = path.join(DATA_DIR, 'pdf', version)
  const last = path.join(outDir, `page-${pages}.png`)

  if (!fs.existsSync(last)) {
    fs.rmSync(outDir, { recursive: true, force: true })
    fs.mkdirSync(outDir, { recursive: true })

    try {
      await exec(
        'pdftoppm',
        [
          '-png',
          '-scale-to-x',
          String(PDF_RENDER_WIDTH),
          '-scale-to-y',
          '-1',
          '-f',
          '1',
          '-l',
          String(pages),
          file,
          path.join(outDir, 'page'),
        ],
        { timeout: 120_000 },
      )
    } catch (error) {
      fs.rmSync(outDir, { recursive: true, force: true })
      throw new PdfUnavailable('pdf_render_failed', `no se han podido sacar las páginas: ${reason(error)}`)
    }

    if (!fs.existsSync(last)) {
      throw new PdfUnavailable('pdf_render_failed', 'pdftoppm no dejó las páginas esperadas')
    }
  }

  // Fuera las versiones anteriores: solo se guarda la última.
  const base = path.join(DATA_DIR, 'pdf')
  for (const name of fs.existsSync(base) ? await fs.promises.readdir(base) : []) {
    if (name !== version) fs.rmSync(path.join(base, name), { recursive: true, force: true })
  }

  return outDir
}

/** Lo que necesita la tarjeta: qué fichero es y cómo pedir sus páginas. */
export async function describePdf(db: Db): Promise<PdfSnapshot> {
  const meta = {
    source: isMock() ? 'mock' : 'archivo',
    fetchedAt: new Date().toISOString(),
    ttlSeconds: Math.round(PDF_TTL_MS / 1000),
  }

  try {
    const found = await resolve(db)
    await ensureRendered(found.file, found.version, found.pages)

    return {
      document: {
        file: path.basename(found.file),
        pages: found.pages,
        bytes: found.bytes,
        modifiedAt: found.modifiedAt.toISOString(),
        version: found.version,
        aspect: found.aspect,
      },
      reason: null,
      meta,
    }
  } catch (error) {
    if (error instanceof PdfUnavailable) {
      return { document: null, reason: { error: error.code, message: error.message }, meta }
    }
    throw error
  }
}

/** Ruta en disco de una página ya rasterizada, o null si esa página no existe. */
export async function renderedPage(db: Db, page: number): Promise<string | null> {
  const found = await resolve(db)
  if (page > found.pages) return null

  const outDir = await ensureRendered(found.file, found.version, found.pages)
  const file = path.join(outDir, `page-${page}.png`)

  return fs.existsSync(file) ? file : null
}
