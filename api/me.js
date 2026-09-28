import { json, methodNotAllowed, fail } from '../lib/http.js';
import { requireSession } from '../lib/guard.js';

// `admin` bleibt immer false: die Admin-Oberfläche von openGym ist aus, die
// Mitgliederverwaltung macht die Website. `coach` schaltet den Plan-Editor frei.
export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    const ctx = await requireSession(req, res);
    if (!ctx) return;
    json(res, 200, {
      user: { id: ctx.user.id, name: ctx.user.name, admin: false, coach: ctx.user.rolle === 'COACH' }
    });
  } catch (err) {
    fail(res, err);
  }
}
