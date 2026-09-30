import { json, methodNotAllowed, notFound, fail, query } from '../../lib/http.js';
import { requireSession, isUserId } from '../../lib/guard.js';
import { isCoach, planGehoertDemCoach } from '../../lib/session.js';
import { findUser, getStand } from '../../lib/repo.js';
import { compose } from '../../lib/state.js';
import { planRev } from '../../lib/plan.js';

// Der Stand eines Mitglieds für den Plan-Editor. Beide Coaches sehen alle
// Mitglieder — das ist eine Entscheidung des Betreibers, keine Lücke.
export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    const ctx = await requireSession(req, res);
    if (!ctx) return;
    if (!isCoach(ctx.user)) return json(res, 403, { error: 'coach only' });

    const target = query(req).get('user');
    if (!isUserId(target)) return notFound(res);
    const member = await findUser(ctx.sql, target);
    // Ein anderer Coach ist kein Trainingsziel — und "gibt es nicht" ist die
    // Antwort, die am wenigsten über die Mitgliederliste verrät.
    if (!member || !planGehoertDemCoach(member)) return notFound(res);

    const row = await getStand(ctx.sql, member.id);
    // B&S: `rev` ist hier die Revision des PLANS, nicht die der Zeile. Der Editor
    // schickt sie als baseRev zurück; die Zeilenrevision bewegt sich auch, wenn
    // das Mitglied einen Satz loggt, und hätte dem Coach dann laufend einen
    // Konflikt gemeldet, den es gar nicht gibt (siehe lib/plan.js planRev).
    json(res, 200, {
      user: { id: member.id, name: member.name },
      state: row ? compose(row) : null,
      rev: planRev(row?.plan)
    });
  } catch (err) {
    fail(res, err);
  }
}
