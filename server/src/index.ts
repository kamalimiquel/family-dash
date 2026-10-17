import fs from 'node:fs'
import path from 'node:path'
import express, { type NextFunction, type Request, type Response } from 'express'
import { Room } from './agents/index.js'
import { DB_PATH, DIST_DIR, HOST, PORT } from './config.js'
import { databaseInfo, openDatabase } from './db.js'
import { googleStatus } from './google/auth.js'
import { createAgendaRouter } from './routes/agenda.js'
import { createAgentsRouter } from './routes/agents.js'
import { createGoogleRouter } from './routes/google.js'
import { createKioskRouter } from './routes/kiosk.js'
import { createLocationsRouter } from './routes/locations.js'
import { createNewsRouter } from './routes/news.js'
import { createPdfRouter } from './routes/pdf.js'
import { createPortalRouter } from './routes/portal.js'
import { createSettingsRouter } from './routes/settings.js'
import { createWeatherRouter } from './routes/weather.js'

const db = openDatabase(DB_PATH)
// El cuarto de los agentes: aquí vive el estado (lo que hacen), no dónde están.
const room = new Room(db)
const startedAt = Date.now()

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '16kb' }))

// --- API ------------------------------------------------------------------

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    node: process.version,
    db: databaseInfo(db, DB_PATH),
    google: googleStatus(db),
  })
})

app.use('/api', createWeatherRouter(db))
app.use('/api', createSettingsRouter(db))
app.use('/api', createGoogleRouter(db))
app.use('/api', createAgendaRouter(db))
app.use('/api', createNewsRouter(db))
app.use('/api', createLocationsRouter(db))
app.use('/api', createAgentsRouter(db, room))
app.use('/api', createPdfRouter(db))
app.use('/api', createPortalRouter(db))
app.use('/api', createKioskRouter())

// Cualquier otra ruta /api: 404 en JSON, no HTML.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'not_found' })
})

// --- frontend (build de Vite) --------------------------------------------

if (fs.existsSync(DIST_DIR)) {
  app.use(
    express.static(DIST_DIR, {
      index: false,
      etag: true,
      lastModified: true,
      setHeaders: (res, filePath) => {
        // Los assets llevan el hash en el nombre: se pueden cachear para siempre.
        // El HTML no: si no, el kiosco sigue enseñando la versión vieja.
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        } else {
          res.setHeader('Cache-Control', 'no-store')
        }
      },
    }),
  )

  const indexHtml = path.join(DIST_DIR, 'index.html')
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    res.sendFile(
      indexHtml,
      { cacheControl: false, headers: { 'Cache-Control': 'no-store' } },
      (error) => {
        if (error) next(error)
      },
    )
  })
} else {
  console.warn(`[aviso] no existe ${DIST_DIR}; ejecuta "npm run build" antes de arrancar`)
}

// --- errores --------------------------------------------------------------

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = error instanceof Error ? error.message : String(error)
  const upstream = /open-meteo/i.test(message)
  const google = /google/i.test(message) || /Google/.test(message)
  console.error('[error]', message)
  res.status(upstream || google ? 502 : 500).json({
    error: upstream ? 'weather_unavailable' : google ? 'google_unavailable' : 'internal_error',
    message,
  })
})

// --- arranque y parada limpia --------------------------------------------

const server = app.listen(PORT, HOST, () => {
  console.log(`Family Dashboard escuchando en http://${HOST}:${PORT}`)
  console.log(`SQLite: ${DB_PATH}`)
})

function shutdown(signal: string): void {
  console.log(`${signal} recibido: cerrando…`)
  server.close(() => {
    try {
      db.close()
    } catch {
      /* ya cerrada */
    }
    process.exit(0)
  })
  // Las conexiones de SSE (el cuarto) no se cierran solas: sin esto, cada reinicio
  // del servicio se queda esperando a que caduque el temporizador de socorro.
  server.closeAllConnections?.()
  setTimeout(() => process.exit(0), 3000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
