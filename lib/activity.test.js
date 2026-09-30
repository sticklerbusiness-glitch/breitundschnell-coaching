import { describe, it, expect } from 'vitest';
import { activitySignal } from './activity.js';
import { storableText } from './safe.js';

// B&S: "trainiert gerade" war der einzige Endpunkt, der den Body ungeprüft in
// die Datenbank gelegt hat (`{ ...body, at }`). Gebraucht werden genau die
// Felder, die die App schickt — alles andere ist Platz in der gemeinsamen
// Live-Datenbank, den niemand braucht.

const NOW = new Date('2026-09-28T17:30:00.000Z');

describe('activitySignal', () => {
  it('keeps exactly the fields the coach view can read', () => {
    expect(activitySignal({
      active: true, name: 'Oberkörper', exIdx: 2, exTotal: 6, setsDone: 7, setsTotal: 18, startedAt: 1700000000000
    }, NOW)).toEqual({
      active: true, at: NOW.toISOString(), name: 'Oberkörper',
      exIdx: 2, exTotal: 6, setsDone: 7, setsTotal: 18, startedAt: 1700000000000
    });
  });

  it('drops everything it does not know', () => {
    const out = activitySignal({ active: true, gross: 'x'.repeat(5000), nested: { a: 1 }, id: 'fremd' }, NOW);
    expect(Object.keys(out).sort()).toEqual(['active', 'at']);
  });

  it('never lets the device decide the time', () => {
    const out = activitySignal({ active: true, at: '1999-01-01T00:00:00.000Z' }, NOW);
    expect(out.at).toBe(NOW.toISOString());
  });

  it('treats anything but a literal true as "not training"', () => {
    for (const value of ['true', 1, {}, undefined]) {
      expect(activitySignal({ active: value }, NOW).active).toBe(false);
    }
  });

  it('clamps counters and refuses nonsense numbers', () => {
    const out = activitySignal({ exIdx: 1e9, exTotal: -3, setsDone: 2.6, setsTotal: NaN }, NOW);
    expect(out.exIdx).toBe(9999);
    expect(out.exTotal).toBeUndefined();
    expect(out.setsDone).toBe(3);
    expect(out.setsTotal).toBeUndefined();
  });

  it('shortens a long routine name instead of storing it whole', () => {
    expect(activitySignal({ name: 'x'.repeat(500) }, NOW).name).toHaveLength(80);
  });

  // B&S: Der Schnitt darf nicht mitten in einer Emoji landen — ein einzelnes
  // Surrogat nimmt jsonb nicht an, und /api/activity liefe danach alle 20 s in
  // einen 500 (siehe lib/safe.js:26-31).
  it('never leaves half an emoji behind when it shortens the name', () => {
    const name = 'a' + '\u{1F4AA}'.repeat(60);
    const out = activitySignal({ name }, NOW);
    expect(out.name.length).toBeLessThanOrEqual(80);
    expect(out.name).toBe(storableText(out.name));
  });

  it('drops a name that is nothing but an unstorable character', () => {
    expect(activitySignal({ name: '\ud83d' }, NOW).name).toBeUndefined();
  });

  it('survives a body that is not an object at all', () => {
    expect(activitySignal(null, NOW)).toEqual({ active: false, at: NOW.toISOString() });
  });
});
