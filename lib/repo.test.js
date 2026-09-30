import { describe, it, expect } from 'vitest';
import { findUser, getStand, updateDaten, insertStand, setLive, savePlan, savePlanAt } from './repo.js';

/**
 * sql-Doppel: merkt sich den zusammengesetzten Text und die Parameter, damit
 * die Abfragen ohne Datenbank prüfbar sind.
 */
function recorder(rows = []) {
  const calls = [];
  const sql = (strings, ...values) => {
    calls.push({ text: strings.join('?').replace(/\s+/g, ' ').trim(), values });
    return Promise.resolve(rows);
  };
  sql.json = value => ({ json: value });
  sql.calls = calls;
  return sql;
}

describe('repo', () => {
  it('findUser asks for exactly the four session fields', async () => {
    const sql = recorder([{ id: 'u1' }]);
    expect(await findUser(sql, 'u1')).toEqual({ id: 'u1' });
    expect(sql.calls[0].text).toContain('"id", "name", "rolle", "tokenVersion"');
    expect(sql.calls[0].values).toEqual(['u1']);
  });

  it('getStand and findUser answer null instead of undefined', async () => {
    const sql = recorder([]);
    expect(await findUser(sql, 'u1')).toBe(null);
    expect(await getStand(sql, 'u1')).toBe(null);
  });

  it('updateDaten writes only against the revision it read', async () => {
    const sql = recorder([{ rev: 5 }]);
    expect(await updateDaten(sql, 'u1', { a: 1 }, 4)).toBe(5);
    const { text, values } = sql.calls[0];
    expect(text).toContain('"rev" = "rev" + 1');
    expect(text).toContain('WHERE "userId" = ? AND "rev" = ?');
    expect(text).toContain('"aktualisiertAm" = now()');
    expect(values).toEqual([{ json: { a: 1 } }, 'u1', 4]);
  });

  it('updateDaten answers null when the row moved on', async () => {
    expect(await updateDaten(recorder([]), 'u1', {}, 4)).toBe(null);
  });

  it('insertStand starts at rev 1 and gives up on a race', async () => {
    const sql = recorder([{ rev: 1 }]);
    expect(await insertStand(sql, 'u1', {})).toBe(1);
    expect(sql.calls[0].text).toContain('ON CONFLICT ("userId") DO NOTHING');
    expect(await insertStand(recorder([]), 'u1', {})).toBe(null);
  });

  it('setLive never touches rev', async () => {
    const sql = recorder([]);
    await setLive(sql, 'u1', { active: true, at: 'jetzt' });
    expect(sql.calls[0].text).not.toContain('"rev" = "GymStand"."rev" + 1');
    expect(sql.calls[0].text).toContain('SET "live" = EXCLUDED."live"');
  });

  it('savePlan bumps rev so the member app reloads', async () => {
    const sql = recorder([{ rev: 9 }]);
    expect(await savePlan(sql, 'u1', { routines: [] })).toBe(9);
    expect(sql.calls[0].text).toContain('"rev" = "GymStand"."rev" + 1');
    expect(sql.calls[0].text).toContain("'{}'::jsonb");
  });
});

// B&S: savePlan bleibt für den Fall ohne baseRev; savePlanAt ist der Weg, auf
// dem ein Editor-Tab vom Vormittag den Nachmittag des anderen Coaches nicht
// mehr still überschreiben kann.
describe('savePlanAt', () => {
  it('writes only against the revision the coach loaded', async () => {
    const sql = recorder([{ rev: 8 }]);
    expect(await savePlanAt(sql, 'u1', { routines: [] }, 7)).toBe(8);
    const { text, values } = sql.calls[0];
    expect(text).toContain('UPDATE "GymStand"');
    expect(text).toContain('WHERE "userId" = ? AND "rev" = ?');
    expect(values).toEqual([{ json: { routines: [] } }, 'u1', 7]);
  });

  it('answers null when another coach got there first', async () => {
    expect(await savePlanAt(recorder([]), 'u1', { routines: [] }, 7)).toBe(null);
  });

  // B&S: Stand 0 sind zwei Fälle — keine Zeile, oder eine, die nur vom
  // „trainiert gerade“-Signal stammt (setLive legt sie mit rev 0 an). Ein reines
  // DO NOTHING hätte den zweiten Fall dauerhaft als Konflikt gemeldet, und der
  // Coach hätte für genau dieses Mitglied nie einen Plan speichern können.
  it('writes the first plan both without a row and onto a rev-0 row from setLive', async () => {
    const sql = recorder([{ rev: 1 }]);
    expect(await savePlanAt(sql, 'u1', { routines: [] }, 0)).toBe(1);
    expect(sql.calls[0].text).toContain('ON CONFLICT ("userId") DO UPDATE');
    expect(sql.calls[0].text).toContain('WHERE "GymStand"."rev" = 0');
    expect(sql.calls[0].text).not.toContain('DO NOTHING');
  });

  it('gives up on stand 0 only when the row already moved past it', async () => {
    expect(await savePlanAt(recorder([]), 'u1', { routines: [] }, 0)).toBe(null);
  });
});

// B&S: /api/activity war der einzige Endpunkt ohne jede Selbstbegrenzung — ein
// Skript mit gültigem Cookie hätte die gemeinsame Live-Datenbank im Sekundentakt
// beschreiben können. Die App meldet sich alle 20 s; geschrieben wird seltener.
describe('setLive — Schreibbremse', () => {
  it('only overwrites a signal that is older than the gap', async () => {
    const sql = recorder([]);
    await setLive(sql, 'u1', { active: true, at: '2026-09-28T17:00:00.000Z' }, 10000);
    const { text, values } = sql.calls[0];
    expect(text).toContain('"GymStand"."live" IS NULL');
    expect(text).toContain('"GymStand"."live"->>\'at\' < ?');
    expect(Date.now() - Date.parse(values[2])).toBeGreaterThanOrEqual(10000);
  });

  // B&S: Der Wechsel-Zweig war mit OR angehängt und damit ganz ohne Pause —
  // ein Skript, das abwechselnd {active:true} und {active:false} schickt, hat
  // die gemeinsame Live-Datenbank bei JEDEM Request beschrieben.
  it('gives the change branch its own, shorter pause instead of none', async () => {
    const sql = recorder([]);
    await setLive(sql, 'u1', { active: true }, 10000);
    const { text, values } = sql.calls[0];
    expect(text).toContain('IS DISTINCT FROM ? AND "GymStand"."live"->>\'at\' < ?');
    const abstand = Date.now() - Date.parse(values[4]);
    expect(abstand).toBeGreaterThanOrEqual(2000);
    expect(abstand).toBeLessThan(10000);
  });

  it('never makes the change branch wait longer than the normal gap', async () => {
    const sql = recorder([]);
    await setLive(sql, 'u1', { active: false }, 500);
    const { values } = sql.calls[0];
    expect(Date.parse(values[4])).toBeGreaterThanOrEqual(Date.parse(values[2]));
  });

  it('always lets a change of state through, so "trainiert gerade" can end', async () => {
    const sql = recorder([]);
    await setLive(sql, 'u1', { active: false });
    expect(sql.calls[0].text).toContain('"GymStand"."live"->>\'active\' IS DISTINCT FROM ?');
    expect(sql.calls[0].values[3]).toBe('false');
    const an = recorder([]);
    await setLive(an, 'u1', { active: true });
    expect(an.calls[0].values[3]).toBe('true');
  });
});
