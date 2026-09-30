// B&S: Zwei Dinge, die zwischen JSON.parse und der Datenbank niemand gebrauchen kann.
//
// 1) `__proto__`, `constructor`, `prototype`: JSON.parse legt sie als ganz normale
//    eigene Eigenschaften an, ein Spread behält sie, JSON.stringify schreibt sie
//    wieder raus. Im Browser landet das Dokument in Object.assign(clone(DEF), state)
//    — und Object.assign schreibt über [[Set]], setzt also den Prototyp des
//    Zustandsobjekts auf Daten, die ein Mitglied geschickt hat (auch im Tab des
//    Coaches, der sich den Stand ansieht). Der Server ist die eine Stelle, durch die
//    beide Wege laufen.
// 2) U+0000 und einzelne Surrogate: gültiges JSON, aber Postgres kann beides in
//    jsonb nicht speichern. Ohne Filter scheitert der INSERT, der Handler
//    antwortet 500, und der Client wiederholt den Push endlos — das
//    Trainingsdokument käme nie wieder an.

import { HttpError } from './http.js';

export const UNSAFE_KEYS = ['__proto__', 'constructor', 'prototype'];
const UNSAFE = new Set(UNSAFE_KEYS);

/** Schlüssel, der kein Prototyp-Schlüssel ist. */
export const isSafeKey = key => typeof key === 'string' && !UNSAFE.has(key);

// B&S: Zeichen, die Postgres beim Parsen eines jsonb-Werts ablehnt.
//   \u0000             — "unsupported Unicode escape sequence"
//   einzelnes Surrogat — "Unicode low surrogate must follow a high surrogate"
// Das zweite ist die halbe Emoji aus einem kaputten Copy&Paste oder Import: in
// JavaScript völlig unauffällig, in der Datenbank ein dauerhafter 500.
const UNSTORABLE = /\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** Text, den jsonb auch wirklich annimmt. Alles andere geht unverändert durch. */
export const storableText = text =>
  typeof text === 'string' ? text.replace(UNSTORABLE, '') : text;

// Ein Trainingsdokument ist flach verschachtelt (Workouts → Sätze). Alles jenseits
// dieser Tiefe ist kein Versehen, und ein rekursiver Durchlauf ohne Grenze wäre ein
// Stack-Overflow (→ 500) statt einer Antwort.
const MAX_DEPTH = 64;

/**
 * An Ort und Stelle, auf allen Ebenen. Für Objekte, die schon gebaut sind —
 * vor allem für Zeilen aus der Datenbank: was dort aus der Zeit vor diesem
 * Filter liegt, trägt die Schlüssel auch TIEFER im Dokument, und genau das geht
 * über compose() an das Gerät des Mitglieds und an den Editor-Tab des Coaches.
 */
export function dropUnsafeKeys(obj, depth = 0) {
  if (obj === null || typeof obj !== 'object' || depth >= MAX_DEPTH) return obj;
  if (Array.isArray(obj)) {
    for (const entry of obj) dropUnsafeKeys(entry, depth + 1);
    return obj;
  }
  for (const key of UNSAFE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) delete obj[key];
  }
  for (const key of Object.keys(obj)) dropUnsafeKeys(obj[key], depth + 1);
  return obj;
}

/**
 * Frisch aufgebaute Kopie: ohne Prototyp-Schlüssel und nur mit Zeichen,
 * die jsonb speichern kann.
 * @throws {HttpError} 400, wenn die Verschachtelung jedes vernünftige Maß sprengt
 */
export function sanitizeJson(value, depth = 0) {
  if (typeof value === 'string') return storableText(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) throw new HttpError(400, 'invalid json');
  if (Array.isArray(value)) return value.map(entry => sanitizeJson(entry, depth + 1));
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    // B&S: ERST säubern, DANN prüfen. Andersherum sah die Prüfung 'const\u0000ructor'
    // (harmlos) und geschrieben wurde 'constructor' — jeder Prototyp-Schlüssel kam
    // mit einem NUL im Namen durch.
    const name = storableText(key);
    if (!isSafeKey(name)) continue;
    // defineProperty statt Zuweisung: out['__proto__'] = … würde den PROTOTYP des
    // Ergebnisses setzen statt ein Feld anzulegen. Hier kann nie etwas anderes als
    // eine gewöhnliche eigene Eigenschaft entstehen.
    Object.defineProperty(out, name, {
      value: sanitizeJson(entry, depth + 1),
      enumerable: true,
      writable: true,
      configurable: true
    });
  }
  return out;
}
