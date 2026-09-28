import { getSql } from './db.js';
import { sessionUser } from './session.js';
import { originOk } from './origin.js';
import { json } from './http.js';

// Die drei Zeilen, die am Anfang fast jedes Handlers stehen.

/**
 * B&S: Fehlt AUTH_SECRET, kann keine Sitzung geprüft werden — das sah bisher
 * für jeden Besucher aus wie "nicht angemeldet" (401), also schoben sich App und
 * Website den Menschen gegenseitig zum Login, und im Log stand nichts. Eine
 * fehlende Variable ist ein Serverfehler, kein Anmeldeproblem: 500, und im
 * Function-Log steht, welche Variable fehlt.
 * @returns {boolean} false heißt: 500 ist schon raus.
 */
function envOk(res, env) {
  const missing = ['AUTH_SECRET', 'DATABASE_URL'].filter(key => !env[key]);
  if (!missing.length) return true;
  console.error('[gym-api] Konfiguration unvollständig — fehlt: ' + missing.join(', '));
  json(res, 500, { error: 'server misconfigured' });
  return false;
}

/** @returns {Promise<{ sql: any, user: object } | null>} null heißt: 401 (oder 500) ist schon raus. */
export async function requireSession(req, res, env = process.env) {
  if (!envOk(res, env)) return null;
  const sql = getSql(env);
  const user = await sessionUser(req, sql, env);
  if (!user) {
    json(res, 401, { error: 'not signed in' });
    return null;
  }
  return { sql, user };
}

/** @returns {boolean} false heißt: 403 ist schon raus. */
export function requireOrigin(req, res, env = process.env) {
  if (originOk(req, env)) return true;
  json(res, 403, { error: 'bad origin' });
  return false;
}

/** Mitglieds-id aus ?user= — dieselbe Form, die auch der Editor-Link prüft. */
export const isUserId = v => typeof v === 'string' && /^[a-z0-9]{10,40}$/i.test(v);
