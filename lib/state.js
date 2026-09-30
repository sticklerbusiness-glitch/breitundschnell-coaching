// Das Zustandsdokument ist in der Datenbank in zwei Hälften geteilt:
//   daten — gehört dem Mitglied (Workouts, Einstellungen, Maße …)
//   plan  — gehört den Coaches (routines, week, customEx, namen)
// Der Client sieht davon nur EIN Dokument. compose() setzt es zusammen,
// strip() nimmt es beim Schreiben wieder auseinander, damit ein Mitglied den
// Plan nicht überschreiben kann.
//
// B&S: Eine Ausnahme — ein COACH trainiert selbst. Für sein eigenes Dokument
// gibt es niemanden, der ihm einen Plan schreibt (/api/trainer/plan nimmt nur
// Teilnehmer an), also gehören routines/week/customEx dort ihm selbst und
// liegen in `daten`. Das steuert die Option `selfOwned`.

import { dropUnsafeKeys } from './safe.js';

export const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);

// B&S: Die Felder, deren FORM die App voraussetzt — die Vorgaben in DEF
// (frontend/src/store/useStore.js) sind dort eine Liste bzw. ein Objekt, und
// der Client legt das geladene Dokument mit Object.assign(clone(DEF), state)
// darüber. Steht dort etwas anderes, wirft die erste Ansicht, die es anfasst
// (Home: bodyweight.slice, Stats: .filter, sheets: [...st.bodyweight]) — und im
// Editor-Tab des Coaches ist das dauerhaft, denn der Editor schreibt nie nach
// /api/data. Deshalb wird ein Wert falscher Form gelöscht statt abgelehnt:
// dann greift beim Client wieder DEF, und ein schon verdorbenes Dokument ist
// beim nächsten Push von selbst wieder brauchbar.
const LIST_KEYS = ['bodyweight', 'routines', 'workouts', 'customEx', 'equipProfiles', 'favEx', 'gymCards'];
const OBJECT_KEYS = ['week', 'dayPlan', 'exWeights', 'wc', 'reminder', 'exNotes', 'barWeights'];

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/** Bekannte Felder in falscher Form löschen (an Ort und Stelle). */
export function dropWrongShape(out) {
  if (!isPlainObject(out)) return out;
  for (const key of LIST_KEYS) if (has(out, key) && !Array.isArray(out[key])) delete out[key];
  for (const key of OBJECT_KEYS) if (has(out, key) && !isPlainObject(out[key])) delete out[key];
  return out;
}

/** ids einer customEx-Liste als Menge — die Listen kommen aus drei Quellen. */
function customExIds(list) {
  const out = new Set();
  if (!Array.isArray(list)) return out;
  for (const entry of list) {
    if (isPlainObject(entry) && typeof entry.id === 'string') out.add(entry.id);
  }
  return out;
}

/** Coach-Einträge gewinnen bei gleicher id; danach die eigenen des Mitglieds. */
export function unionById(planList, userList) {
  const out = [];
  const seen = new Set();
  for (const list of [planList, userList]) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      if (!isPlainObject(entry)) continue;
      const id = entry.id;
      if (typeof id !== 'string' || seen.has(id)) continue;
      seen.add(id);
      out.push(entry);
    }
  }
  return out;
}

/**
 * DB-Zeile → das Dokument, das der Client sieht.
 * @param {{ selfOwned?: boolean }} [opts] selfOwned: eigenes Dokument eines Coaches
 */
export function compose(row, opts = {}) {
  const daten = isPlainObject(row?.daten) ? row.daten : {};
  const plan = isPlainObject(row?.plan) ? row.plan : {};
  // B&S: Beim Coach steht der eigene Plan in `daten`. Solange dort noch keiner
  // steht, gilt weiter die plan-Spalte — ein Plan aus der Zeit als Teilnehmer
  // wäre mit der Beförderung sonst unsichtbar; der erste eigene Push übernimmt ihn.
  const source = opts.selfOwned && Array.isArray(daten.routines) ? daten : plan;
  return dropWrongShape(dropUnsafeKeys({
    ...daten,
    routines: Array.isArray(source.routines) ? source.routines : [],
    week: isPlainObject(source.week) ? source.week : {},
    customEx: unionById(source.customEx, daten.customEx),
    _rev: Number.isFinite(row?.rev) ? row.rev : 0
  }));
}

/** Immer serverseitig: der Plan-Teil (`namen` ist reine Coach-Ansicht). */
export function planPayload(plan) {
  const p = isPlainObject(plan) ? plan : {};
  return {
    routines: Array.isArray(p.routines) ? p.routines : [],
    week: isPlainObject(p.week) ? p.week : {},
    customEx: Array.isArray(p.customEx) ? p.customEx : []
  };
}

/**
 * B&S: Wem eine eigene Übung gehört, entscheidet der Server — nicht der Editor.
 * Der Plan-Editor schickt beim Speichern alles zurück, was in einer Routine
 * vorkommt; im Dokument des Mitglieds steht dank compose() aber auch, was das
 * MITGLIED sich selbst angelegt hat. Ohne diese Prüfung könnte ein Mitglied ein
 * beliebiges Objekt in den Coach-Plan schieben (und dort gewinnt es beim
 * nächsten compose() sogar gegen den Coach). Also: in den Plan darf nur, was
 * dort schon steht oder was neu ist — nie etwas, das dem Mitglied gehört.
 * @returns {Array} die Einträge, die der Coach wirklich besitzen darf
 */
export function coachOwnedCustomEx(submitted, row) {
  const list = Array.isArray(submitted) ? submitted : [];
  const daten = isPlainObject(row?.daten) ? row.daten : {};
  const plan = isPlainObject(row?.plan) ? row.plan : {};
  const coachIds = customExIds(plan.customEx);
  const memberIds = customExIds(daten.customEx);
  return list.filter(entry => coachIds.has(entry?.id) || !memberIds.has(entry?.id));
}

/**
 * Dokument des Clients → der Teil, der in `daten` gespeichert wird.
 * routines/week gehören dem Coach, `active` ist gerätelokal, `_rev` gehört dem
 * Server.
 * @param {{ prevDaten?: object, selfOwned?: boolean }} [opts]
 *   prevDaten: der gespeicherte Stand — er trennt Eigenes von Coach-Kopien und
 *   bewahrt einen Plan, der aus einer COACH-Zeit noch in `daten` liegt.
 */
export function strip(state, plan, opts = {}) {
  const out = dropWrongShape(dropUnsafeKeys({ ...state }));
  delete out.active;
  delete out._rev;

  if (opts.selfOwned) {
    // B&S: eigenes Dokument eines Coaches — routines/week bleiben drin, sonst
    // wäre sein Plan nach dem ersten Push weg (es gibt keine plan-Spalte, die
    // ihn zurückgeben könnte). Kaputte Formen fliegen trotzdem raus.
    if (!Array.isArray(out.routines)) delete out.routines;
    if (!isPlainObject(out.week)) delete out.week;
    return out;
  }

  delete out.routines;
  delete out.week;

  // B&S: Es sei denn, in der gespeicherten Hälfte liegt noch ein eigener Plan —
  // dann war diese Person einmal COACH (selfOwned, Plan in `daten`) und ist es
  // nicht mehr. Der gelöschte Wert stünde danach NIRGENDS mehr: die plan-Spalte
  // ist für sie leer, compose() zeigt sie nicht, und der erste Push würde sie
  // auch aus der Zeile nehmen. Also stehen lassen, wie sie gespeichert sind —
  // nicht, wie der Client sie gerade schickt (der kennt sie nicht mehr und darf
  // sie als Mitglied auch nicht schreiben). Wird die Rolle zurückgestellt, ist
  // der Plan sofort wieder da.
  const prev = isPlainObject(opts.prevDaten) ? opts.prevDaten : null;
  if (prev && Array.isArray(prev.routines)) {
    out.routines = prev.routines;
    if (isPlainObject(prev.week)) out.week = prev.week;
  }

  // Eigene Übungen: Kopien der Coach-Einträge müssen nicht doppelt herumliegen.
  // B&S: ABER nur, wenn das Mitglied die id nicht vorher schon selbst hatte —
  // sonst löscht dieser Filter die eigene Übung des Mitglieds, sobald ein Coach
  // sie in eine Routine zieht, und sie ist für immer weg, wenn er sie später
  // wieder herausnimmt.
  const planIds = customExIds(isPlainObject(plan) ? plan.customEx : null);
  const ownIds = customExIds(isPlainObject(opts.prevDaten) ? opts.prevDaten.customEx : null);
  if (Array.isArray(out.customEx) && planIds.size) {
    out.customEx = out.customEx.filter(
      e => !(isPlainObject(e) && planIds.has(e.id) && !ownIds.has(e.id))
    );
  }
  return out;
}
