import { json, methodNotAllowed, fail } from '../lib/http.js';
import { requireSession, requireOrigin } from '../lib/guard.js';
import { readJson, LIMITS } from '../lib/body.js';
import { setLive } from '../lib/repo.js';
import { activitySignal } from '../lib/activity.js';

// Lebenszeichen, solange ein Workout auf dem Bildschirm ist — daraus liest die
// Coach-Ansicht "trainiert gerade". Kein Dokumentstand, also auch kein rev++:
// sonst würde jede Minute Training alle Geräte zum Nachladen schicken.
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    if (!requireOrigin(req, res)) return;
    const ctx = await requireSession(req, res);
    if (!ctx) return;
    const body = await readJson(req, LIMITS.activity);
    // B&S: nur die bekannten Felder, nicht der ganze Body (lib/activity.js).
    await setLive(ctx.sql, ctx.user.id, activitySignal(body));
    json(res, 200, { ok: true });
  } catch (err) {
    fail(res, err);
  }
}
