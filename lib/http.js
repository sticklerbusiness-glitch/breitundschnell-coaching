// Antworten für die Serverless-Handler. Bewusst nur plain Node (req, res):
// der Vite-Dev-Plugin reicht einen nackten Node-Request durch, dort gibt es
// weder res.status() noch res.json().

export function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // Ein Trainingsstand ist pro Person verschieden und ändert sich ständig —
  // nichts davon darf in einem Proxy-Cache landen.
  res.setHeader('Cache-Control', 'no-store');
  res.end(payload);
}

export function methodNotAllowed(res, allow) {
  res.setHeader('Allow', allow.join(', '));
  json(res, 405, { error: 'method not allowed' });
}

export function notFound(res) {
  json(res, 404, { error: 'not found' });
}

/**
 * Fehler mit eigenem HTTP-Status (413 zu großer Body, 400 kaputtes JSON …).
 * Alles ohne `status` ist ein Serverfehler und darf nichts nach außen verraten.
 */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function fail(res, err) {
  if (err instanceof HttpError) return json(res, err.status, { error: err.message });
  console.error('[gym-api]', err);
  json(res, 500, { error: 'server error' });
}

/** Query-Parameter eines Node-Requests (req.url ist immer nur der Pfad). */
export function query(req) {
  return new URL(req.url || '/', 'http://localhost').searchParams;
}
