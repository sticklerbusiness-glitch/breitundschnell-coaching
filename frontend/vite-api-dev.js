import { existsSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseEnvFile, applyEnv } from '../lib/env-file.js'

// Dev-Server-Seite der API. In Produktion sind die Dateien unter ../api/ je eine
// Vercel-Function hinter dem Rewrite /training/api/:path* → /api/:path*; hier
// hängt dieselbe Datei als Middleware im Vite-Server. Ein zweiter Server (und
// damit ein zweiter Codepfad, der in Produktion niemand testet) entfällt.

const API_DIR = new URL('../api/', import.meta.url)
const PREFIX = '/training/api/'

// Genau die Routen aus der Spezifikation — Pfad → Datei unter api/.
const ROUTES = {
  'me': 'me.js',
  'config': 'config.js',
  'data': 'data.js',
  'data/rev': 'data/rev.js',
  'logout': 'logout.js',
  'logout/all': 'logout/all.js',
  'activity': 'activity.js',
  'trainer/stand': 'trainer/stand.js',
  'trainer/plan': 'trainer/plan.js'
}

// Die Zugangsdaten liegen an genau einer Stelle: in der .env der Website.
// Kopien in der gym-app würden irgendwann auseinanderlaufen — und im
// AGPL-Repo landen.
const ENV_KEYS = ['DATABASE_URL', 'AUTH_SECRET', 'GYM_ALLOWED_ORIGINS']

function loadEnv(logger) {
  const file = process.env.GYM_ENV_FILE || fileURLToPath(new URL('../../website/.env', import.meta.url))
  if (!existsSync(file)) {
    logger.warn(`[api-dev] ${file} nicht gefunden — /training/api/* antwortet mit 500`)
    return
  }
  applyEnv(process.env, parseEnvFile(readFileSync(file, 'utf8')), ENV_KEYS)
  if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development'
  const missing = ['DATABASE_URL', 'AUTH_SECRET'].filter(k => !process.env[k])
  if (missing.length) logger.warn(`[api-dev] ${missing.join(', ')} fehlt in ${file}`)
  else logger.info(`[api-dev] DATABASE_URL + AUTH_SECRET aus ${file}`)
}

// ssrLoadModule kennt den ganzen Modulgraph: eine Änderung in ../lib wirkt
// beim nächsten Request, ohne den Dev-Server neu zu starten. Der Fallback ist
// ein normaler Import mit Zeitstempel, falls Vite den Pfad außerhalb von
// frontend/ einmal nicht auflösen kann.
async function loadHandler(server, file) {
  const path = fileURLToPath(new URL(file, API_DIR))
  try {
    const mod = await server.ssrLoadModule('/@fs' + path)
    if (mod && mod.default) return mod.default
  } catch (err) {
    server.config.logger.warn('[api-dev] ssrLoadModule: ' + err.message)
  }
  const mod = await import(pathToFileURL(path).href + '?v=' + statSync(path).mtimeMs)
  return mod.default
}

export default function apiDev() {
  return {
    name: 'bs-api-dev',
    apply: 'serve',
    configureServer(server) {
      loadEnv(server.config.logger)
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost')
        if (!url.pathname.startsWith(PREFIX)) return next()
        const route = url.pathname.slice(PREFIX.length).replace(/\/+$/, '')
        const file = ROUTES[route]
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        if (!file) {
          res.statusCode = 404
          return res.end(JSON.stringify({ error: 'not found' }))
        }
        // Der Handler sieht denselben Pfad wie auf Vercel hinter dem Rewrite.
        req.url = '/api/' + route + url.search
        try {
          const handler = await loadHandler(server, file)
          await handler(req, res)
        } catch (err) {
          server.config.logger.error('[api-dev] ' + route + ': ' + (err && err.stack || err))
          if (!res.headersSent) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: 'server error' }))
          }
        }
      })
    }
  }
}
