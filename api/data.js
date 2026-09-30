import { json, methodNotAllowed, fail } from '../lib/http.js';
import { requireSession, requireOrigin } from '../lib/guard.js';
import { planGehoertDemCoach } from '../lib/session.js';
import { readJson, LIMITS } from '../lib/body.js';
import { compose, strip, planPayload, isPlainObject } from '../lib/state.js';
import { getStand, updateDaten, insertStand } from '../lib/repo.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') return await read(req, res);
    if (req.method === 'PUT') return await write(req, res);
    return methodNotAllowed(res, ['GET', 'PUT']);
  } catch (err) {
    fail(res, err);
  }
}

// B&S: Coaches trainieren selbst. Ihnen schreibt niemand einen Plan
// (/api/trainer/plan nimmt nur Teilnehmer an), also gehört ihr eigener Plan
// ihrem eigenen Dokument. Ohne das hat der Server routines/week aus jedem PUT
// eines Coaches gelöscht und mit dem (immer leeren) Coach-Plan geantwortet —
// der Client hat das übernommen und die eigene Routine war still weg.
// Gefragt wird über die Gegenseite (lib/session.js planGehoertDemCoach): nur wem
// ein Coach einen Plan schreibt, dem löscht der Server routines/week aus dem
// eigenen Push. Alles andere — COACH und jede Rolle, die noch dazukommt —
// besitzt seinen Plan selbst, statt ihn zwischen zwei Prüfungen zu verlieren.
const selfOwnedPlan = user => !planGehoertDemCoach(user);

async function read(req, res) {
  const ctx = await requireSession(req, res);
  if (!ctx) return;
  const selfOwned = selfOwnedPlan(ctx.user);
  const row = await getStand(ctx.sql, ctx.user.id);
  if (!row) return json(res, 200, { state: null, rev: 0 });
  json(res, 200, { state: compose(row, { selfOwned }), rev: row.rev });
}

async function write(req, res) {
  if (!requireOrigin(req, res)) return;
  const ctx = await requireSession(req, res);
  if (!ctx) return;
  const selfOwned = selfOwnedPlan(ctx.user);
  const body = await readJson(req, LIMITS.data);
  const state = body.state;
  if (!isPlainObject(state)) return json(res, 400, { error: 'state required' });
  // Über diese beiden Listen läuft der Server selbst (Coach-Ansicht, Statistik).
  // Ein Wert, der keine Liste ist, würde dort bei jedem Zugriff werfen.
  const list = v => v == null || Array.isArray(v);
  if (!list(state.workouts) || !list(state.routines)) return json(res, 400, { error: 'invalid state' });

  const row = await getStand(ctx.sql, ctx.user.id);
  const curRev = row ? row.rev : 0;
  // baseRev passt nicht: dieses Gerät hat einen älteren Stand gelesen und
  // würde die Schreibvorgänge eines anderen still überschreiben. Der aktuelle
  // Stand fährt mit der 409 zurück, damit der Client mergen kann.
  if (body.baseRev != null && body.baseRev !== curRev) return conflict(res, row, selfOwned);

  const plan = isPlainObject(row?.plan) ? row.plan : {};
  // B&S: Liegt in der Mitglieds-Hälfte ein Plan, obwohl diese Person kein Coach
  // (mehr) ist, ist die Rolle zurückgestellt worden. strip() lässt ihn dann
  // stehen, statt ihn zu löschen — hier steht, warum er im Dokument nicht auftaucht.
  if (!selfOwned && Array.isArray(row?.daten?.routines) && row.daten.routines.length) {
    console.warn('[gym-api] Plan liegt in daten, Rolle ist nicht COACH — bleibt erhalten, sichtbar erst wieder als COACH:', ctx.user.id);
  }
  // B&S: prevDaten — nur so weiß strip(), welche eigene Übung dem Mitglied schon
  // vorher gehörte und darum nicht als Coach-Kopie gelöscht werden darf.
  const daten = strip(state, plan, { prevDaten: row?.daten, selfOwned });
  const rev = row
    ? await updateDaten(ctx.sql, ctx.user.id, daten, curRev)
    : await insertStand(ctx.sql, ctx.user.id, daten);
  // rev === null: zwischen Lesen und Schreiben war jemand schneller. Dasselbe
  // Ergebnis wie ein falscher baseRev — der Client liest neu und mergt.
  if (rev == null) return conflict(res, await getStand(ctx.sql, ctx.user.id), selfOwned);

  // `plan` fährt für das MITGLIED mit: sein Client hat routines/week gerade
  // lokal verändert oder geleert und setzt sie damit sofort wieder auf den
  // Stand des Coaches, ohne auf den nächsten GET zu warten.
  //
  // B&S: Dem Coach schicken wir ihn NICHT zurück. Es wäre sein eigener, gerade
  // gespeicherter Stand — und der ist schon alt, sobald er während der
  // Antwortzeit weitergetippt hat: applyPlan() im Client überschriebe die neue
  // Änderung mit der eben gesendeten, und der nächste Push schriebe die
  // Rückwärts-Änderung auch noch fest. Ohne `plan` steigt applyPlan() sofort
  // aus (useStore.js: `if (!plan) return`) und der Coach behält, was er tippt.
  json(res, 200, { ok: true, ts: state._ts ?? null, rev, ...(selfOwned ? {} : { plan: planPayload(plan) }) });
}

function conflict(res, row, selfOwned) {
  json(res, 409, { error: 'conflict', rev: row ? row.rev : 0, state: row ? compose(row, { selfOwned }) : null });
}
