import { describe, it, expect } from 'vitest';
import { compose, strip, unionById, planPayload, coachOwnedCustomEx } from './state.js';

describe('unionById', () => {
  it('lets the coach entry win on the same id', () => {
    const out = unionById([{ id: 'a', n: 'Coach' }], [{ id: 'a', n: 'Mitglied' }, { id: 'b', n: 'Eigene' }]);
    expect(out).toEqual([{ id: 'a', n: 'Coach' }, { id: 'b', n: 'Eigene' }]);
  });

  it('survives junk', () => {
    expect(unionById(null, undefined)).toEqual([]);
    expect(unionById([null, 'x', { noId: 1 }], [{ id: 'b' }])).toEqual([{ id: 'b' }]);
  });
});

describe('compose', () => {
  it('puts the coach plan over the member document', () => {
    const state = compose({
      daten: { workouts: [1], customEx: [{ id: 'm1', n: 'Eigene' }], routines: ['weg'], week: { 0: ['weg'] } },
      plan: { routines: [{ id: 'r1' }], week: { 1: ['r1'] }, customEx: [{ id: 'c1', n: 'Coach' }], namen: { x: 'y' } },
      rev: 7
    });
    expect(state.workouts).toEqual([1]);
    expect(state.routines).toEqual([{ id: 'r1' }]);
    expect(state.week).toEqual({ 1: ['r1'] });
    expect(state.customEx).toEqual([{ id: 'c1', n: 'Coach' }, { id: 'm1', n: 'Eigene' }]);
    expect(state._rev).toBe(7);
    // namen ist reine Coach-Ansicht und hat im Dokument nichts verloren
    expect(state.namen).toBeUndefined();
  });

  it('fills defaults without a plan', () => {
    const state = compose({ daten: { workouts: [] }, plan: null, rev: 0 });
    expect(state).toEqual({ workouts: [], routines: [], week: {}, customEx: [], _rev: 0 });
  });
});

describe('strip', () => {
  it('drops everything the member does not own', () => {
    const out = strip(
      { workouts: [1], routines: [{ id: 'r' }], week: { 0: ['r'] }, active: { on: true }, _rev: 4, lang: 'de' },
      {}
    );
    expect(out).toEqual({ workouts: [1], lang: 'de' });
  });

  it('removes custom exercises that the plan already carries', () => {
    const out = strip(
      { customEx: [{ id: 'c1', n: 'Kopie' }, { id: 'm1', n: 'Eigene' }] },
      { customEx: [{ id: 'c1', n: 'Coach' }] }
    );
    expect(out.customEx).toEqual([{ id: 'm1', n: 'Eigene' }]);
  });

  it('does not mutate the caller state', () => {
    const state = { routines: [1], workouts: [] };
    strip(state, {});
    expect(state.routines).toEqual([1]);
  });
});

describe('planPayload', () => {
  it('always answers with all three fields', () => {
    expect(planPayload(null)).toEqual({ routines: [], week: {}, customEx: [] });
    expect(planPayload({ routines: [{ id: 'r' }], namen: { a: 'b' } }))
      .toEqual({ routines: [{ id: 'r' }], week: {}, customEx: [] });
  });
});

describe('round trip', () => {
  it('compose → strip gives back exactly the member half', () => {
    const row = {
      daten: { workouts: [{ d: '2026-09-19' }], customEx: [{ id: 'm1', n: 'Eigene' }] },
      plan: { routines: [{ id: 'r1', ex: [] }], week: { 3: ['r1'] }, customEx: [{ id: 'c1', n: 'Coach' }] },
      rev: 2
    };
    const seen = compose(row);
    expect(strip(seen, row.plan)).toEqual(row.daten);
  });
});

// ---------------------------------------------------------------------------
// B&S: was dieser Fork gegenüber openGym geändert hat — der Coach als eigener
// Athlet, eigene Übungen des Mitglieds, die ein Plan nicht verschlucken darf,
// und Prototyp-Schlüssel, die weder rein noch raus dürfen.
// ---------------------------------------------------------------------------

describe('compose/strip — ein Coach trainiert selbst', () => {
  const routine = { id: 'r1', name: 'Oberkörper', ex: [] };

  it('reads a coach plan out of his own document', () => {
    const state = compose(
      { daten: { workouts: [], routines: [routine], week: { 1: ['r1'] } }, plan: {}, rev: 3 },
      { selfOwned: true }
    );
    expect(state.routines).toEqual([routine]);
    expect(state.week).toEqual({ 1: ['r1'] });
  });

  it('keeps routines and week in a coach document on write', () => {
    const out = strip(
      { workouts: [], routines: [routine], week: { 1: ['r1'] }, active: { on: 1 }, _rev: 3 },
      {},
      { selfOwned: true }
    );
    expect(out).toEqual({ workouts: [], routines: [routine], week: { 1: ['r1'] } });
  });

  it('still drops a broken shape from a coach document', () => {
    const out = strip({ routines: 'nein', week: 7 }, {}, { selfOwned: true });
    expect(out).toEqual({});
  });

  it('falls back to the plan column until the coach pushed his own routines', () => {
    // Wer erst Teilnehmer war, hat dort einen Plan stehen — der bliebe sonst
    // mit der Beförderung unsichtbar.
    const state = compose({ daten: { workouts: [] }, plan: { routines: [routine] }, rev: 1 }, { selfOwned: true });
    expect(state.routines).toEqual([routine]);
    // Sobald eigene routines da sind (auch leer), gewinnt das eigene Dokument.
    const eigen = compose({ daten: { routines: [] }, plan: { routines: [routine] }, rev: 1 }, { selfOwned: true });
    expect(eigen.routines).toEqual([]);
  });

  it('leaves a member document exactly as before', () => {
    const row = { daten: { workouts: [], routines: [{ id: 'gefaelscht' }] }, plan: { routines: [routine] }, rev: 1 };
    expect(compose(row).routines).toEqual([routine]);
    expect(strip(row.daten, row.plan).routines).toBeUndefined();
  });
});

// B&S: Der Filter „Kopien der Coach-Einträge müssen nicht doppelt herumliegen"
// hat die EIGENE Übung des Mitglieds gelöscht, sobald ein Coach sie in eine
// Routine zog — und wenn er sie später herausnahm, war sie überall weg.
describe('strip — eigene Übungen des Mitglieds überleben den Plan', () => {
  const eigene = { id: 'c_abc', n: 'Schlittenschub' };

  it('keeps an entry the member already owned before the coach used it', () => {
    const out = strip(
      { customEx: [eigene] },
      { customEx: [eigene] },
      { prevDaten: { customEx: [eigene] } }
    );
    expect(out.customEx).toEqual([eigene]);
  });

  it('still drops a plain copy of a coach exercise', () => {
    const out = strip(
      { customEx: [{ id: 'c_coach', n: 'Kopie' }, eigene] },
      { customEx: [{ id: 'c_coach', n: 'Coach' }] },
      { prevDaten: { customEx: [eigene] } }
    );
    expect(out.customEx).toEqual([eigene]);
  });
});

describe('coachOwnedCustomEx', () => {
  const row = {
    daten: { customEx: [{ id: 'c_mitglied', n: 'Eigene' }] },
    plan: { customEx: [{ id: 'c_coach', n: 'Coach' }] }
  };

  it('lets the coach keep his own and add new ones', () => {
    const out = coachOwnedCustomEx(
      [{ id: 'c_coach', n: 'Coach neu' }, { id: 'c_neu', n: 'Neu' }],
      row
    );
    expect(out.map(e => e.id)).toEqual(['c_coach', 'c_neu']);
  });

  it('refuses to promote an entry that belongs to the member', () => {
    const out = coachOwnedCustomEx([{ id: 'c_mitglied', n: 'Untergeschoben', boese: 1 }], row);
    expect(out).toEqual([]);
  });

  it('survives a missing row and junk', () => {
    expect(coachOwnedCustomEx(null, null)).toEqual([]);
    expect(coachOwnedCustomEx([{ id: 'c1', n: 'x' }], null)).toEqual([{ id: 'c1', n: 'x' }]);
  });
});

describe('Prototyp-Schlüssel', () => {
  it('never leaves compose, even from a row written before the filter existed', () => {
    const row = JSON.parse('{"daten":{"workouts":[],"__proto__":{"pwn":1}},"plan":{},"rev":1}');
    const state = compose(row);
    expect(Object.prototype.hasOwnProperty.call(state, '__proto__')).toBe(false);
  });

  it('never reaches the database through strip', () => {
    const state = JSON.parse('{"workouts":[],"constructor":1,"prototype":2,"__proto__":{"pwn":1}}');
    expect(strip(state, {})).toEqual({ workouts: [] });
  });
});
