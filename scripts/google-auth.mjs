#!/usr/bin/env node
/**
 * Conecta una cuenta de Google con el backend del panel.
 *
 * Levanta un servidor de loopback para recibir el código de autorización, abre
 * la URL de consentimiento (o la imprime) y le pasa el código al backend, que es
 * quien guarda el refresh_token en SQLite.
 *
 *   node scripts/google-auth.mjs
 *   node scripts/google-auth.mjs --no-open --port 8917 --backend http://127.0.0.1:4173
 *
 * Antes hay que darle las credenciales de la app:
 *   curl -X POST http://127.0.0.1:4173/api/google/app \
 *     -H 'content-type: application/json' \
 *     -d '{"client_id":"...apps.googleusercontent.com","client_secret":"..."}'
 */
import http from 'node:http'
import { execFile } from 'node:child_process'

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const port = Number(option('port', '8917'))
const backend = option('backend', 'http://127.0.0.1:4173').replace(/\/$/, '')
const shouldOpen = !args.includes('--no-open')
const redirectUri = `http://127.0.0.1:${port}/oauth2callback`

const finish = (code, message) => {
  console.log(message)
  server.close()
  process.exit(code)
}

const status = await fetch(`${backend}/api/google/status`).then((r) => r.json())
if (!status.configured) {
  console.error(
    'La app de Google no está configurada todavía.\n' +
      `Manda client_id y client_secret a ${backend}/api/google/app (hay un ejemplo en la cabecera de este script).`,
  )
  process.exit(1)
}

const { url, state } = await fetch(
  `${backend}/api/google/auth-url?redirect_uri=${encodeURIComponent(redirectUri)}`,
).then((r) => r.json())

console.log('\nAbre esta URL en un navegador y autoriza el acceso:\n')
console.log(`  ${url}\n`)
if (shouldOpen) {
  execFile('xdg-open', [url], (error) => {
    if (error) console.log('(no he podido abrir el navegador; ábrela a mano)')
  })
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url ?? '/', redirectUri)
  if (requestUrl.pathname !== '/oauth2callback') {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('nada que ver aquí')
    return
  }

  const error = requestUrl.searchParams.get('error')
  if (error) {
    res.writeHead(400, { 'content-type': 'text/html; charset=utf-8' })
    res.end(`<h1>Autorización cancelada</h1><p>${error}</p>`)
    finish(1, `Google devolvió un error: ${error}`)
    return
  }

  const code = requestUrl.searchParams.get('code')
  if (!code) {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('falta el código')
    return
  }

  const exchanged = await fetch(`${backend}/api/google/exchange`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, redirect_uri: redirectUri, state }),
  }).then((r) => r.json())

  if (!exchanged.connected) {
    res.writeHead(500, { 'content-type': 'text/html; charset=utf-8' })
    res.end(`<h1>No se pudo conectar</h1><pre>${JSON.stringify(exchanged, null, 2)}</pre>`)
    finish(1, `Fallo al conectar: ${JSON.stringify(exchanged)}`)
    return
  }

  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end('<h1>Listo</h1><p>La cuenta ya está conectada. Puedes cerrar esta pestaña.</p>')
  finish(0, `Cuenta conectada: ${exchanged.email ?? '(sin email)'} · scopes: ${exchanged.scope ?? '—'}`)
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Esperando el código en ${redirectUri} …`)
})
