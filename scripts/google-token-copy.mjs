#!/usr/bin/env node
/**
 * Copia la autorización de Google de un equipo a otro, para no tener que teclear
 * la contraseña de Google en la pantalla táctil de la Pi.
 *
 *   1. En el equipo donde se hizo el consentimiento:
 *        node scripts/google-token-copy.mjs export > /tmp/google-auth.json
 *   2. Copia el fichero a la Pi y, allí:
 *        node scripts/google-token-copy.mjs import /tmp/google-auth.json
 *   3. Reinicia el servicio para que recoja los datos:
 *        systemctl --user restart family-dash.service
 *
 * El fichero exportado contiene el refresh_token: es un secreto, bórralo cuando
 * termines y no lo subas a ningún sitio.
 */
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const dbPath =
  process.env.DASH_DB ?? path.join(path.resolve(here, '..'), 'data', 'dashboard.sqlite')

const [action, file] = process.argv.slice(2)

if (!fs.existsSync(dbPath)) {
  console.error(`No encuentro la base de datos en ${dbPath}`)
  process.exit(1)
}

const db = new DatabaseSync(dbPath)

const readApp = () =>
  db.prepare('SELECT client_id, client_secret FROM google_app WHERE id = 1').get()
const readAccount = () =>
  db
    .prepare(
      'SELECT email, refresh_token, scope, token_type, obtained_at FROM google_account WHERE id = 1',
    )
    .get()

if (action === 'export') {
  const app = readApp()
  const account = readAccount()
  if (!app || !account) {
    console.error('No hay credenciales de app y/o cuenta conectada en esta base de datos')
    process.exit(1)
  }
  process.stdout.write(JSON.stringify({ app, account }, null, 2) + '\n')
  console.error('Exportado. Ojo: contiene el refresh_token, trátalo como un secreto.')
} else if (action === 'import') {
  if (!file) {
    console.error('Uso: node scripts/google-token-copy.mjs import <fichero.json>')
    process.exit(1)
  }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!data.app?.client_id || !data.app?.client_secret || !data.account?.refresh_token) {
    console.error('El fichero no tiene la forma esperada (app.client_id, app.client_secret, account.refresh_token)')
    process.exit(1)
  }

  const now = Date.now()
  db.prepare(
    `INSERT INTO google_app (id, client_id, client_secret, updated_at) VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET client_id = excluded.client_id,
       client_secret = excluded.client_secret, updated_at = excluded.updated_at`,
  ).run(data.app.client_id, data.app.client_secret, now)

  db.prepare(
    `INSERT INTO google_account
       (id, email, refresh_token, access_token, access_expires_at, scope, token_type, obtained_at, updated_at)
     VALUES (1, ?, ?, NULL, NULL, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       email = excluded.email, refresh_token = excluded.refresh_token,
       access_token = NULL, access_expires_at = NULL,
       scope = excluded.scope, token_type = excluded.token_type,
       updated_at = excluded.updated_at`,
  ).run(
    data.account.email ?? null,
    data.account.refresh_token,
    data.account.scope ?? null,
    data.account.token_type ?? null,
    Number(data.account.obtained_at ?? now),
    now,
  )

  console.log(`Importado: ${data.account.email ?? '(sin email)'}`)
  console.log('Reinicia el servicio para que el panel use la cuenta.')
} else {
  console.error('Uso: node scripts/google-token-copy.mjs export|import [fichero.json]')
  process.exit(1)
}

db.close()
