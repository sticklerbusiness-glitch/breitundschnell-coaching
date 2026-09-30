// B&S: Das "trainiert gerade"-Signal war bisher der einzige Endpunkt, der den
// Body ungeprüft in die Datenbank gelegt hat (`{ ...body, at }`). Damit konnte
// ein Mitglied beliebige Felder — und in der gemeinsamen Live-Datenbank auch
// beliebig viel Text — in seine Zeile schreiben. Gebraucht werden genau die
// Felder, die die App schickt und die Coach-Ansicht lesen könnte; alles andere
// fällt weg.

import { isPlainObject } from './state.js';
import { storableText } from './safe.js';

const MAX_NAME = 80;
const MAX_COUNT = 9999;

const zahl = value => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.min(Math.round(value), MAX_COUNT);
};

/**
 * Body → das Signal, das gespeichert wird. `at` setzt immer der Server: die Zeit
 * des Geräts entscheidet sonst darüber, wie lange "trainiert gerade" stehen bleibt.
 */
export function activitySignal(body, now = new Date()) {
  const b = isPlainObject(body) ? body : {};
  const out = { active: b.active === true, at: now.toISOString() };
  // storableText() NACH dem Schnitt: slice() kann mitten in einer Emoji landen,
  // und das halbe Zeichen nimmt jsonb nicht an — /api/activity liefe danach alle
  // 20 s in einen 500 (siehe lib/safe.js:23-32).
  const name = typeof b.name === 'string' ? storableText(b.name.slice(0, MAX_NAME)) : '';
  if (name) out.name = name;
  for (const key of ['exIdx', 'exTotal', 'setsDone', 'setsTotal']) {
    const value = zahl(b[key]);
    if (value !== null) out[key] = value;
  }
  // Startzeit der Einheit in Millisekunden — die App zeigt daraus die Dauer.
  if (typeof b.startedAt === 'number' && Number.isFinite(b.startedAt) && b.startedAt > 0) {
    out.startedAt = Math.round(b.startedAt);
  }
  return out;
}
