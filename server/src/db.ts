import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export type Db = DatabaseSync

interface Migration {
  version: number
  name: string
  sql: string
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'cache-and-settings',
    sql: `
      CREATE TABLE cache (
        key        TEXT PRIMARY KEY,
        payload    TEXT NOT NULL,
        source     TEXT,
        fetched_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX cache_expires_at_idx ON cache (expires_at);

      CREATE TABLE settings (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `,
  },
]

/**
 * Abre (y crea si hace falta) la base SQLite y aplica las migraciones que
 * falten. WAL para que leer la caché y escribirla no se bloqueen entre sí.
 */
export function openDatabase(file: string): Db {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true })
  }

  const db = new DatabaseSync(file)
  db.prepare('PRAGMA journal_mode = WAL').get()
  db.prepare('PRAGMA foreign_keys = ON').get()
  db.prepare('PRAGMA busy_timeout = 5000').get()
  migrate(db)
  return db
}

function migrate(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `)

  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map(
      (row) => Number(row.version),
    ),
  )

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue

    db.exec('BEGIN')
    try {
      db.exec(migration.sql)
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
        migration.version,
        migration.name,
        Date.now(),
      )
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }
}

/** Resumen para /api/health. */
export function databaseInfo(db: Db, file: string): Record<string, unknown> {
  const entries = db.prepare('SELECT COUNT(*) AS n FROM cache').get() as { n: number }
  const migrations = db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get() as { n: number }
  let sizeBytes: number | null = null
  try {
    sizeBytes = fs.statSync(file).size
  } catch {
    sizeBytes = null
  }
  return { file, sizeBytes, cacheEntries: Number(entries.n), migrations: Number(migrations.n) }
}
