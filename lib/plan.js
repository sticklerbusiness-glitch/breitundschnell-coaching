import { isPlainObject } from './state.js';
import { dropUnsafeKeys, isSafeKey, storableText } from './safe.js';

// Plan-Prüfung: NUR die Struktur, nie die Felder einer Übungs-Konfiguration.
// Der Community-Trainer-Patch von upstream hat genau hier Pläne zerlegt: er
// führte eine Whitelist der erlaubten cfg-Felder und warf damit restSec, note,
// warmupSets, intensifier … still weg. Unbekannte Felder in einer Übung sind
// Features, die der Client kennt und der Server nicht kennen muss.
//
// B&S: Grenzen kürzen, statt den ganzen Plan abzulehnen. Ein 400 trifft immer
// den GANZEN Plan — der Editor schickt ihn am Stück, zeigt nur „Fehler beim
// Speichern“ und schickt beim nächsten Versuch dasselbe wieder. Ein einziger zu
// langer Routinenname hätte damit eine ganze Editor-Sitzung des Coaches
// unspeicherbar gemacht. Hart abgelehnt wird nur noch, was strukturell falsch
// ist (keine Liste, kein Objekt, keine id).

const MAX_ROUTINES = 50;
const MAX_EX_PER_ROUTINE = 40;
const MAX_CUSTOM_EX = 200;
const MAX_ID = 40;
const MAX_ROUTINE_NAME = 80;
const MAX_NAME = 120;

// ids sind im Client immer aus [0-9a-z] erzeugt (uid()) oder Katalognummern.
// Alles andere ist keine echte id, sondern ein Versuch, über einen Schlüssel wie
// '__proto__' in Objekte zu schreiben, die den Plan später indexieren.
const ID_RE = /^[A-Za-z0-9_-]+$/;

/**
 * id prüfen; null heißt: als id unbrauchbar.
 * B&S: NICHT kürzen. Eine gekürzte id ist eine ANDERE id — zwei Einträge, die
 * in den ersten 40 Zeichen übereinstimmen, wurden damit zu einem: beide lagen
 * in der Liste, der Client indexiert nach id, und jeder Wochentag zeigte
 * dieselbe Routine. Eine zu lange id ist keine gekürzte id, sondern keine.
 */
function cleanId(value) {
  if (typeof value !== 'string' || value.length > MAX_ID) return null;
  return value && isSafeKey(value) && ID_RE.test(value) ? value : null;
}

// B&S: Zu langer Text wird gekürzt, nie abgelehnt. Ein 400 trifft den GANZEN
// Plan, und der Editor schickt beim nächsten Versuch denselben wieder — ein
// einziger zu langer Name hätte die Sitzung des Coaches unspeicherbar gemacht.
// storableText() NACH dem Schnitt: slice() zählt UTF-16-Einheiten und kann
// mitten in einer Emoji landen. Das einzelne Surrogat, das dabei entsteht,
// nimmt jsonb nicht an — der INSERT wirft, die Antwort ist 500, und der Editor
// schickt denselben Namen wieder. Genau die Sackgasse, die das Kürzen
// vermeiden soll (siehe lib/safe.js:23-32).
const text = (value, max) => (typeof value === 'string' ? storableText(value.slice(0, max)) : '');

/**
 * @returns {{ plan: object, gekuerzt?: object } | { error: string }} geprüfter,
 *   normalisierter Plan (unbekannte Top-Level-Schlüssel fallen weg) oder ein
 *   Fehler für 400. `gekuerzt` steht nur dabei, wenn eine Obergrenze wirklich
 *   gegriffen hat — damit der Editor es sagen kann, statt Struktur still zu
 *   verlieren: { routines?: n, ex?: n, customEx?: n }.
 */
export function validatePlan(input) {
  if (!isPlainObject(input)) return { error: 'invalid plan' };
  if (!Array.isArray(input.routines)) return { error: 'invalid plan' };

  // B&S: Was an einer Obergrenze wegfällt, wird gezählt und im 200er mitgeteilt.
  // Der Editor behält seine 51 Routinen im Speicher und zeigt sie weiter — beim
  // nächsten Laden sind sie weg, und ohne Rückmeldung erfährt der Coach nie,
  // dass der Server die Struktur gekürzt hat.
  const weg = { routines: 0, ex: 0, customEx: 0 };

  const routines = [];
  const ids = new Set();
  weg.routines += Math.max(0, input.routines.length - MAX_ROUTINES);
  for (const r of input.routines.slice(0, MAX_ROUTINES)) {
    if (!isPlainObject(r)) return { error: 'invalid plan' };
    const id = cleanId(r.id);
    if (!id) return { error: 'invalid plan' };
    // Zweimal dieselbe id: der Client indexiert Routinen nach id, die zweite
    // wäre nie erreichbar und würde nur einen Wochentag falsch belegen.
    if (ids.has(id)) { weg.routines++; continue; }
    // Kein String als Name ist strukturell falsch (der Editor schreibt immer
    // einen) — zu LANG wird dagegen nur gekürzt, siehe text().
    if (typeof r.name !== 'string') return { error: 'invalid plan' };
    if (!Array.isArray(r.ex)) return { error: 'invalid plan' };
    const ex = [];
    weg.ex += Math.max(0, r.ex.length - MAX_EX_PER_ROUTINE);
    for (const e of r.ex.slice(0, MAX_EX_PER_ROUTINE)) {
      if (!isPlainObject(e)) return { error: 'invalid plan' };
      const exId = cleanId(e.id);
      if (!exId) return { error: 'invalid plan' };
      ex.push(dropUnsafeKeys({ ...e, id: exId }));
    }
    routines.push(dropUnsafeKeys({ ...r, id, name: text(r.name, MAX_ROUTINE_NAME), ex }));
    ids.add(id);
  }

  // week: Wochentag '0'..'6' → eine Routine-id oder mehrere. Immer als Array
  // ablegen, damit der Client nur eine Form kennen muss; ids, die es nicht
  // (mehr) gibt, fliegen raus statt später ins Leere zu zeigen.
  const week = {};
  if (input.week != null) {
    if (!isPlainObject(input.week)) return { error: 'invalid plan' };
    for (const [key, value] of Object.entries(input.week)) {
      if (!/^[0-6]$/.test(key)) continue;
      const list = typeof value === 'string' ? [value] : Array.isArray(value) ? value : null;
      if (list === null) return { error: 'invalid plan' };
      week[key] = list.map(cleanId).filter(id => id && ids.has(id));
    }
  }

  const customEx = [];
  const customIds = new Set();
  if (input.customEx != null) {
    if (!Array.isArray(input.customEx)) return { error: 'invalid plan' };
    weg.customEx += Math.max(0, input.customEx.length - MAX_CUSTOM_EX);
    for (const e of input.customEx.slice(0, MAX_CUSTOM_EX)) {
      if (!isPlainObject(e)) continue;
      const id = cleanId(e.id);
      if (!id) continue;   // als id unbrauchbar (z. B. '__proto__'): nur dieser Eintrag fällt weg
      if (customIds.has(id)) { weg.customEx++; continue; }   // dieselbe id zweimal
      // B&S: Auch ein Eintrag ohne Namen fällt einzeln weg statt den ganzen Plan
      // abzulehnen. compose() legt die eigenen Übungen des MITGLIEDS mit ins
      // Dokument, der Editor schickt alle zurück, die eine Routine benutzt — ein
      // selbst gebauter Eintrag ohne `n` hätte sonst gereicht, damit der Coach
      // für dieses Mitglied nie wieder speichern kann.
      const n = text(e.n, MAX_NAME);
      if (!n) continue;
      customIds.add(id);
      customEx.push(dropUnsafeKeys({ ...e, id, n }));
    }
  }

  // namen ist reine Anzeige (der Coach-Editor schickt die deutschen Namen der
  // referenzierten Übungen mit). Zu lange Werte werden gekürzt statt den
  // ganzen Plan abzulehnen — daran soll kein Speichern scheitern.
  const namen = {};
  if (input.namen != null) {
    if (!isPlainObject(input.namen)) return { error: 'invalid plan' };
    for (const [key, value] of Object.entries(input.namen)) {
      const id = cleanId(key);
      if (!id || typeof value !== 'string') continue;
      namen[id] = text(value, MAX_NAME);
    }
  }

  // Nur melden, was wirklich weggefallen ist — ein leeres Feld im 200er wäre
  // für den Editor ein Hinweis, der nichts bedeutet.
  const gekuerzt = Object.fromEntries(Object.entries(weg).filter(([, anzahl]) => anzahl > 0));
  const out = { plan: { routines, week, customEx, namen } };
  if (Object.keys(gekuerzt).length) out.gekuerzt = gekuerzt;
  return out;
}

// B&S: Der Plan hat eine EIGENE Revision, die in der plan-Spalte mitläuft.
// Die Revision der ZEILE zählt auch dann hoch, wenn das Mitglied einen Satz
// loggt — der Editor-Tab des Coaches hätte damit alle paar Minuten „ein anderer
// Coach hat den Plan geändert" gemeldet, während in Wahrheit nur das Mitglied
// trainiert hat. Dieser Zähler bewegt sich nur, wenn wirklich ein Plan
// geschrieben wird. Er bleibt im Server: planPayload() gibt ihn nicht heraus,
// der Editor bekommt ihn nur als undurchsichtige Zahl in `rev`.
export const planRev = plan => (Number.isFinite(plan?.planRev) ? plan.planRev : 0);

/** Derselbe Plan ohne den internen Zähler — für den Vergleich zweier Stände. */
export function withoutPlanRev(plan) {
  if (!isPlainObject(plan)) return plan;
  const { planRev: _zaehler, ...rest } = plan;
  return rest;
}

/**
 * B&S: „Hat sich am Plan überhaupt etwas geändert?" Jede Speicherung zählt rev
 * hoch, und jedes rev schickt ALLE Geräte des Mitglieds zum Nachladen des
 * ganzen Dokuments. Eine Editor-Sitzung besteht aber zum großen Teil aus
 * Speicherungen, die nichts ändern (der Editor schickt bei jeder Kleinigkeit
 * den ganzen Plan). Tief vergleichen statt zu stringifyen: eine andere
 * Schlüsselreihenfolge würde sonst als Änderung durchgehen — und ein falsches
 * „gleich" wäre ein verlorener Plan, ein falsches „verschieden" nur ein
 * überflüssiger Schreibvorgang.
 * @returns {boolean}
 */
export function samePlan(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every(k => Object.prototype.hasOwnProperty.call(b, k) && samePlan(a[k], b[k]));
}
