import { json, methodNotAllowed, notFound, fail, query } from '../../lib/http.js';
import { requireSession, requireOrigin, isUserId } from '../../lib/guard.js';
import { isCoach } from '../../lib/session.js';
import { readJson, LIMITS } from '../../lib/body.js';
import { validatePlan, samePlan, planRev, withoutPlanRev } from '../../lib/plan.js';
import { coachOwnedCustomEx, planPayload } from '../../lib/state.js';
import { findUser, getStand, savePlan, savePlanAt } from '../../lib/repo.js';

// Der Coach schreibt den Plan eines Mitglieds. Nur hier entstehen routines,
// week und die Coach-Übungen — das Mitglied selbst kann sie nie schreiben
// (siehe strip() in lib/state.js).
export default async function handler(req, res) {
  try {
    if (req.method !== 'PUT') return methodNotAllowed(res, ['PUT']);
    if (!requireOrigin(req, res)) return;
    const ctx = await requireSession(req, res);
    if (!ctx) return;
    if (!isCoach(ctx.user)) return json(res, 403, { error: 'coach only' });

    const target = query(req).get('user');
    if (!isUserId(target)) return notFound(res);
    const member = await findUser(ctx.sql, target);
    if (!member || member.rolle !== 'TEILNEHMER') return notFound(res);

    const body = await readJson(req, LIMITS.plan);
    const checked = validatePlan(body);
    if (checked.error) return json(res, 400, { error: checked.error });

    const row = await getStand(ctx.sql, member.id);
    const curRev = row ? row.rev : 0;          // Revision der ZEILE — dagegen wird bedingt geschrieben
    const curPlanRev = planRev(row?.plan);     // Revision des PLANS — darauf sitzt der Editor

    // B&S: Was dem Mitglied gehört, bleibt dem Mitglied — der Editor schickt
    // alle eigenen Übungen zurück, die in einer Routine vorkommen, auch die des
    // Mitglieds (siehe coachOwnedCustomEx).
    const plan = { ...checked.plan, customEx: coachOwnedCustomEx(checked.plan.customEx, row) };

    // B&S: Unveränderter Plan → gar nicht schreiben. Sonst zählt jede der vielen
    // Speicherungen einer Editor-Sitzung rev hoch und schickt jedes Gerät des
    // Mitglieds zum Nachladen des kompletten Dokuments (checkRev alle 30 s).
    // Steht auf dem Server schon genau dieser Plan, gibt es auch nichts zu
    // streiten — dann ist selbst ein alter baseRev kein Konflikt.
    if (row && samePlan(withoutPlanRev(row.plan), plan)) return json(res, 200, { ok: true, rev: curPlanRev });

    // B&S: Beide Coaches sehen alle Mitglieder, und ein Editor-Tab lädt nie
    // nach. Schickt er die Revision mit, die er geladen hat, und passt sie
    // nicht mehr, gewinnt nicht einfach der letzte Schreiber: 409 mit dem
    // aktuellen Plan, damit der Editor neu laden und es sagen kann.
    // Nur eine Zahl zählt als Stand: steht etwas anderes in baseRev, ist das kein
    // Stand, auf dem dieser Editor sitzt — dann lieber 409 als still überschreiben.
    const hasBase = body.baseRev != null;
    const baseRev = Number.isFinite(body.baseRev) ? body.baseRev : NaN;
    if (hasBase && baseRev !== curPlanRev) return conflict(res, row);

    // Geschrieben wird gegen die Zeilenrevision (die sich auch durch das
    // Mitglied bewegt) — das schützt das Rennen zwischen Lesen und Schreiben.
    const stored = { ...plan, planRev: curPlanRev + 1 };
    const rev = hasBase
      ? await savePlanAt(ctx.sql, member.id, stored, curRev)
      : await savePlan(ctx.sql, member.id, stored);
    // null: zwischen Lesen und Schreiben war jemand schneller — dieselbe Antwort.
    if (rev == null) return conflict(res, await getStand(ctx.sql, member.id));

    json(res, 200, { ok: true, rev: curPlanRev + 1 });
  } catch (err) {
    fail(res, err);
  }
}

/** Vertrag mit dem Editor: 409 { error, rev, plan } — rev und Plan sind der Serverstand. */
function conflict(res, row) {
  json(res, 409, { error: 'conflict', rev: planRev(row?.plan), plan: planPayload(row?.plan) });
}
