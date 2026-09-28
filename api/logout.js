import { json, methodNotAllowed, fail } from '../lib/http.js';
import { requireOrigin } from '../lib/guard.js';

// Abmelden macht die Website (sie hält das Cookie). Der Endpunkt bleibt, weil
// der Client ihn kennt — er tut nur nichts.
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    if (!requireOrigin(req, res)) return;
    json(res, 200, { ok: true });
  } catch (err) {
    fail(res, err);
  }
}
