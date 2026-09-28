// CSRF-Schutz. Das Session-Cookie ist SameSite=Lax: ein fremder Browser-Tab
// bekommt es bei einem POST/PUT gar nicht erst mit. Diese Prüfung ist der
// zweite Riegel für Browser, die Lax großzügig auslegen.

const DEFAULT_ORIGINS = 'https://breitundschnell.de,https://www.breitundschnell.de';
const DEV_ORIGINS = ['http://localhost:3000', 'http://localhost:5174'];

/** Methoden ohne Nebenwirkung — die brauchen keinen Origin-Check. */
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

export function allowedOrigins(env = {}) {
  const raw = typeof env.GYM_ALLOWED_ORIGINS === 'string' && env.GYM_ALLOWED_ORIGINS.trim()
    ? env.GYM_ALLOWED_ORIGINS
    : DEFAULT_ORIGINS;
  const list = raw.split(',').map(s => s.trim()).filter(Boolean);
  // Im Dev läuft die Website auf :3000 und die App auf :5174 — zwei Origins,
  // die in Produktion nichts zu suchen haben.
  if (env.NODE_ENV !== 'production') for (const o of DEV_ORIGINS) if (!list.includes(o)) list.push(o);
  return list;
}

/**
 * @param {{ method?: string, headers?: Record<string, string|undefined> }} req
 */
export function originOk(req, env = {}) {
  const method = String(req?.method || 'GET').toUpperCase();
  if (SAFE.has(method)) return true;
  const headers = req?.headers || {};
  const origin = headers.origin;
  if (origin) return allowedOrigins(env).includes(origin);
  // Kein Origin-Header: nur akzeptieren, wenn der Browser sagt, dass die
  // Anfrage von der eigenen Seite kommt (oder gar nichts sagt — Nicht-Browser
  // können das Lax-Cookie sowieso nicht fremdseitig mitschicken).
  const site = headers['sec-fetch-site'];
  return !site || site === 'same-origin';
}
