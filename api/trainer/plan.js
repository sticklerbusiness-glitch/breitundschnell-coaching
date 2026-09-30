import { json, methodNotAllowed, notFound, fail, query } from '../../lib/http.js';
import { requireSession, requireOrigin, isUserId } from '../../lib/guard.js';
import { isCoach, planGehoertDemCoach } from '../../lib/session.js';
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
    // Wen es nicht gibt, gibt es nicht — das verrät am wenigsten über die
    // Mitgliederliste. B&S: Ein COACH als Ziel ist aber etwas anderes, und
    // dieselbe Antwort war hier eine falsche Auskunft: Wer sich selbst in
    // ?kunde= einsetzt, las „Mitglied nicht gefunden" und stand in einer
    // Sackgasse ohne Weg in seinen eigenen Trainingsbereich. Fragen darf hier
    // ohnehin nur ein angemeldeter Coach, also ist die Unterscheidung frei.
    if (!member) return notFound(res);
    if (!planGehoertDemCoach(member)) return json(res, 409, { error: 'coach target' });

    const body = await readJson(req, LIMITS.plan);
    const checked = validatePlan(body);
    if (checked.error) return json(res, 400, { error: checked.error });

    const row = await getStand(ctx.sql, member.id);
    const curRev = row ? row.rev : 0;          // Revision der ZEILE — dagegen wird bedingt geschrieben
    const curPlanRev = planRev(row?.plan);     // Revision des PLANS — darauf sitzt der Editor

    // B&S: Was dem Mitglied gehört, bleibt dem Mitglied — der Editor schickt
    // alle eigenen Übungen zurück, die in einer Routine vorkommen, auch die des
    // Mitglieds (siehe coachOwnedCustomEx).
    const eigene = coachOwnedCustomEx(checked.plan.customEx, row);
    const plan = { ...checked.plan, customEx: eigene };

    // B&S: … und die Regel sagt, was sie verworfen hat. Sonst zeigt der Editor
    // die Korrektur des Coaches an einer mitgliedseigenen Übung weiter, bis er
    // neu lädt — dann ist sie weg, ohne dass irgendwo etwas stand, und der Coach
    // macht es wahrscheinlich ein zweites Mal.
    const behalten = new Set(eigene);
    const fremdeUebungen = checked.plan.customEx
      .filter(e => !behalten.has(e))
      .map(e => e?.id)
      .filter(id => typeof id === 'string');
    /** Antwort an den Editor — Hinweise nur, wenn es welche gibt. */
    const antwort = rev => {
      const body = { ok: true, rev };
      if (checked.gekuerzt) body.gekuerzt = checked.gekuerzt;
      if (fremdeUebungen.length) body.fremdeUebungen = fremdeUebungen;
      return body;
    };

    // B&S: Unveränderter Plan → gar nicht schreiben. Sonst zählt jede der vielen
    // Speicherungen einer Editor-Sitzung rev hoch und schickt jedes Gerät des
    // Mitglieds zum Nachladen des kompletten Dokuments (checkRev alle 30 s).
    // Steht auf dem Server schon genau dieser Plan, gibt es auch nichts zu
    // streiten — dann ist selbst ein alter baseRev kein Konflikt.
    if (row && samePlan(withoutPlanRev(row.plan), plan)) return json(res, 200, antwort(curPlanRev));

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
    let rev = hasBase
      ? await savePlanAt(ctx.sql, member.id, stored, curRev)
      : await savePlan(ctx.sql, member.id, stored);
    if (rev == null) {
      // B&S: null heißt nur „die Zeilenrevision ist nicht mehr die gelesene" —
      // und die zählt auch hoch, wenn das MITGLIED gerade einen Satz loggt. Das
      // wäre kein Konflikt am Plan, der Editor würde aber „ein anderer Coach hat
      // den Plan geändert" zeigen und die Arbeit des Coaches verwerfen. Also
      // einmal nachsehen: steht der Plan noch auf demselben Stand, war es das
      // Mitglied — dann mit der neuen Zeilenrevision wiederholen. Genau EIN
      // zweiter Versuch, damit daraus keine Schleife wird.
      const frisch = await getStand(ctx.sql, member.id);
      if (hasBase && planRev(frisch?.plan) === curPlanRev) {
        rev = await savePlanAt(ctx.sql, member.id, stored, frisch ? frisch.rev : 0);
      }
      if (rev == null) return conflict(res, frisch);
    }

    json(res, 200, antwort(curPlanRev + 1));
  } catch (err) {
    fail(res, err);
  }
}

/** Vertrag mit dem Editor: 409 { error, rev, plan } — rev und Plan sind der Serverstand. */
function conflict(res, row) {
  json(res, 409, { error: 'conflict', rev: planRev(row?.plan), plan: planPayload(row?.plan) });
}
