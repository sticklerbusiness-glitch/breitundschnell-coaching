import { describe, it, expect } from 'vitest';
import { validatePlan, samePlan, planRev, withoutPlanRev } from './plan.js';

const routine = (id, ex = []) => ({ id, name: 'Push', ex });

describe('validatePlan', () => {
  it('keeps unknown exercise config fields verbatim', () => {
    // Genau hier ist upstreams Trainer-Patch gescheitert: eine Whitelist der
    // cfg-Felder hat restSec, note, warmupSets … beim Speichern verschluckt.
    const ex = { id: 'e1', sets: 4, reps: '8-10', restSec: 120, note: 'Ellbogen eng', warmupSets: 2, intensifier: 'dropset', yt: 'dQw4w9WgXcQ' };
    const out = validatePlan({ routines: [routine('r1', [ex])] });
    expect(out.error).toBeUndefined();
    expect(out.plan.routines[0].ex[0]).toEqual(ex);
  });

  it('drops unknown top-level keys', () => {
    const out = validatePlan({ routines: [], evil: 1, _rev: 9, workouts: [1] });
    expect(Object.keys(out.plan).sort()).toEqual(['customEx', 'namen', 'routines', 'week']);
  });

  it('normalises week to arrays and drops unknown ids and days', () => {
    const out = validatePlan({
      routines: [routine('r1'), routine('r2')],
      week: { 0: 'r1', 2: ['r2', 'weg'], 5: [], 9: ['r1'], montag: ['r1'] }
    });
    expect(out.plan.week).toEqual({ 0: ['r1'], 2: ['r2'], 5: [] });
  });

  it('shortens long display names instead of refusing the plan', () => {
    const out = validatePlan({ routines: [], namen: { e1: 'x'.repeat(300), e2: 7 } });
    expect(out.plan.namen.e1).toHaveLength(120);
    expect(out.plan.namen.e2).toBeUndefined();
  });

  it('accepts an empty plan', () => {
    expect(validatePlan({ routines: [] }).plan).toEqual({ routines: [], week: {}, customEx: [], namen: {} });
  });

  // B&S: Ein 400 trifft immer den GANZEN Plan — der Editor schickt ihn am Stück
  // und schickt beim nächsten Versuch denselben wieder. Eine zu lange Eingabe
  // darf darum nie die ganze Sitzung des Coaches unspeicherbar machen: kürzen.
  describe('clamps instead of refusing the whole plan', () => {
    it('shortens an over-long routine name', () => {
      const out = validatePlan({ routines: [{ id: 'r1', name: 'x'.repeat(200), ex: [] }] });
      expect(out.error).toBeUndefined();
      expect(out.plan.routines[0].name).toHaveLength(80);
    });

    it('shortens an over-long routine id instead of losing the routine', () => {
      const out = validatePlan({ routines: [routine('r'.repeat(90))] });
      expect(out.error).toBeUndefined();
      expect(out.plan.routines[0].id).toHaveLength(40);
    });

    it('keeps the first 50 routines', () => {
      const out = validatePlan({ routines: Array.from({ length: 51 }, (_, i) => routine('r' + i)) });
      expect(out.error).toBeUndefined();
      expect(out.plan.routines).toHaveLength(50);
      expect(out.plan.routines[49].id).toBe('r49');
    });

    it('keeps the first 40 exercises of a routine', () => {
      const ex = Array.from({ length: 41 }, (_, i) => ({ id: 'e' + i }));
      const out = validatePlan({ routines: [routine('r1', ex)] });
      expect(out.error).toBeUndefined();
      expect(out.plan.routines[0].ex).toHaveLength(40);
    });

    it('keeps the first 200 custom exercises', () => {
      const customEx = Array.from({ length: 201 }, (_, i) => ({ id: 'c' + i, n: 'x' }));
      const out = validatePlan({ routines: [], customEx });
      expect(out.error).toBeUndefined();
      expect(out.plan.customEx).toHaveLength(200);
    });

    it('shortens an over-long custom exercise name', () => {
      const out = validatePlan({ routines: [], customEx: [{ id: 'c1', n: 'x'.repeat(300) }] });
      expect(out.plan.customEx[0].n).toHaveLength(120);
    });

    // B&S: compose() legt die eigenen Übungen des Mitglieds mit ins Dokument und
    // der Editor schickt alle zurück, die eine Routine benutzt. Ein selbst
    // gebauter Eintrag ohne `n` darf darum nicht den ganzen Plan ablehnen —
    // sonst könnte der Coach für dieses Mitglied nie wieder speichern.
    it('drops a custom exercise without a name instead of refusing the plan', () => {
      const out = validatePlan({ routines: [], customEx: [{ id: 'c1' }, { id: 'c2', n: 'Sled Push' }] });
      expect(out.error).toBeUndefined();
      expect(out.plan.customEx).toEqual([{ id: 'c2', n: 'Sled Push' }]);
    });
  });

  // B&S: ids landen im Client als Objektschlüssel (EXIDX[e.id] = e). '__proto__'
  // würde dort den Prototyp setzen, und ein `delete` bekäme das nicht zurück.
  describe('prototype keys never survive', () => {
    it('drops a custom exercise whose id is a prototype key', () => {
      const out = validatePlan({ routines: [], customEx: [{ id: '__proto__', n: 'böse' }, { id: 'c1', n: 'ok' }] });
      expect(out.plan.customEx).toEqual([{ id: 'c1', n: 'ok' }]);
    });

    it('refuses a routine or exercise whose id is a prototype key', () => {
      expect(validatePlan({ routines: [routine('constructor')] })).toEqual({ error: 'invalid plan' });
      expect(validatePlan({ routines: [routine('r1', [{ id: 'prototype' }])] })).toEqual({ error: 'invalid plan' });
    });

    it('never carries a prototype key out of a routine or exercise object', () => {
      const evil = JSON.parse('{"routines":[{"id":"r1","name":"P","ex":[{"id":"e1","__proto__":{"pwn":1}}],"__proto__":{"pwn":1}}],"namen":{"__proto__":"x"}}');
      const out = validatePlan(evil);
      expect(Object.prototype.hasOwnProperty.call(out.plan.routines[0], '__proto__')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(out.plan.routines[0].ex[0], '__proto__')).toBe(false);
      expect(out.plan.namen).toEqual({});
    });

    it('rejects an id that is not id-shaped at all', () => {
      expect(validatePlan({ routines: [routine('r 1; drop')] })).toEqual({ error: 'invalid plan' });
    });
  });

  // Strukturell falsch bleibt hart: daran kann der Editor nichts kürzen.
  const bad = {
    'no object': null,
    'routines missing': {},
    'routines not an array': { routines: {} },
    'routine without id': { routines: [{ name: 'Push', ex: [] }] },
    'routine without ex list': { routines: [{ id: 'r1', name: 'Push' }] },
    'routine name not a string': { routines: [{ id: 'r1', name: 7, ex: [] }] },
    'exercise without id': { routines: [routine('r1', [{ sets: 3 }])] },
    'week not an object': { routines: [], week: 'montag' },
    'week value not a list': { routines: [], week: { 0: 3 } },
    'customEx not an array': { routines: [], customEx: {} },
    'namen not an object': { routines: [], namen: [] }
  };
  for (const [what, input] of Object.entries(bad)) {
    it('refuses: ' + what, () => {
      expect(validatePlan(input)).toEqual({ error: 'invalid plan' });
    });
  }
});

describe('samePlan', () => {
  it('is true for a plan that only differs in key order', () => {
    const a = { routines: [{ id: 'r1', name: 'P', ex: [] }], week: { 0: ['r1'] }, customEx: [], namen: {} };
    const b = { namen: {}, customEx: [], week: { 0: ['r1'] }, routines: [{ ex: [], name: 'P', id: 'r1' }] };
    expect(samePlan(a, b)).toBe(true);
  });

  it('sees every kind of real change', () => {
    const base = { routines: [{ id: 'r1', name: 'P', ex: [{ id: 'e1', sets: 3 }] }], week: {}, customEx: [], namen: {} };
    expect(samePlan(base, { ...base, week: { 0: ['r1'] } })).toBe(false);
    expect(samePlan(base, { ...base, routines: [{ id: 'r1', name: 'Pull', ex: [{ id: 'e1', sets: 3 }] }] })).toBe(false);
    expect(samePlan(base, { ...base, routines: [{ id: 'r1', name: 'P', ex: [{ id: 'e1', sets: 4 }] }] })).toBe(false);
    expect(samePlan(base, { ...base, routines: [] })).toBe(false);
    expect(samePlan(base, {})).toBe(false);
    expect(samePlan(base, null)).toBe(false);
  });

  it('does not confuse an array with an object', () => {
    expect(samePlan([], {})).toBe(false);
    expect(samePlan({ 0: 'a' }, ['a'])).toBe(false);
  });
});

// B&S: Die Zeilenrevision zählt auch hoch, wenn das Mitglied einen Satz loggt.
// Der Editor des Coaches braucht darum einen Zähler, der sich nur bei einem
// echten Plan-Schreibvorgang bewegt — sonst meldet er laufend einen Konflikt,
// den es nicht gibt.
describe('planRev', () => {
  it('reads the counter and treats a plan without one as stand 0', () => {
    expect(planRev({ routines: [], planRev: 5 })).toBe(5);
    expect(planRev({ routines: [] })).toBe(0);
    expect(planRev(null)).toBe(0);
    expect(planRev({ planRev: 'sieben' })).toBe(0);
  });

  it('withoutPlanRev leaves the plan itself alone', () => {
    const plan = { routines: [{ id: 'r1' }], week: {}, customEx: [], namen: {}, planRev: 3 };
    expect(withoutPlanRev(plan)).toEqual({ routines: [{ id: 'r1' }], week: {}, customEx: [], namen: {} });
    expect(plan.planRev).toBe(3);
    expect(withoutPlanRev(null)).toBe(null);
  });

  it('makes two stands comparable although only one carries the counter', () => {
    const gespeichert = { routines: [], week: {}, customEx: [], namen: {}, planRev: 9 };
    const geschickt = { routines: [], week: {}, customEx: [], namen: {} };
    expect(samePlan(gespeichert, geschickt)).toBe(false);
    expect(samePlan(withoutPlanRev(gespeichert), geschickt)).toBe(true);
  });
});
