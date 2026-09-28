import { json, methodNotAllowed, fail } from '../../lib/http.js';
import { requireSession } from '../../lib/guard.js';
import { getStand } from '../../lib/repo.js';

// Nur die Revision: die App fragt das im Halbminutentakt und lädt das
// Dokument erst, wenn die Zahl sich bewegt hat.
export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    const ctx = await requireSession(req, res);
    if (!ctx) return;
    const row = await getStand(ctx.sql, ctx.user.id);
    json(res, 200, { rev: row ? row.rev : 0 });
  } catch (err) {
    fail(res, err);
  }
}
