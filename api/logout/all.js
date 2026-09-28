import { json, methodNotAllowed, fail } from '../../lib/http.js';
import { requireOrigin } from '../../lib/guard.js';

// Wie /api/logout: überall abmelden ist Sache der Website (tokenVersion).
// Hier bleibt nur die Antwort, die der Client erwartet.
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    if (!requireOrigin(req, res)) return;
    json(res, 200, { ok: true });
  } catch (err) {
    fail(res, err);
  }
}
