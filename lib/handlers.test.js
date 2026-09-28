import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SignJWT } from 'jose';

// Die Handler selbst, verdrahtet wie in Produktion — nur mit einem sql-Doppel
// statt der Datenbank. getSql() nimmt den Client aus globalThis, wenn dort
// schon einer liegt; genau dort wird hier eingehängt.
const SQL_CACHE = Symbol.for('breitundschnell.gym.sql');
const SECRET = 'test-geheimnis-fuer-die-signatur';

let db;   // wird pro Test neu gesetzt
const rowsFor = (text, values) => {
  if (text.includes('FROM "User"')) {
    const user = db.users[values[0]];
    return user ? [user] : [];
  }
  if (text.includes('FROM "GymStand"')) return db.stand ? [db.stand] : [];
  if (text.startsWith('UPDATE "GymStand"')) return db.writeRev == null ? [] : [{ rev: db.writeRev }];
  if (text.startsWith('INSERT INTO "GymStand"')) return db.writeRev == null ? [] : [{ rev: db.writeRev }];
  return [];
};

const sql = (strings, ...values) => {
  const text = strings.join('?').replace(/\s+/g, ' ').trim();
  db.queries.push(text);
  // B&S: Für die neuen Tests zählt nicht nur, DASS geschrieben wurde, sondern WAS.
  db.calls.push({ text, values });
  return Promise.resolve(rowsFor(text, values));
};
/** Die Parameter des ersten Schreibvorgangs (INSERT/UPDATE auf "GymStand"). */
const written = () => db.calls.find(c => /^(INSERT INTO|UPDATE) "GymStand"/.test(c.text));
sql.json = v => ({ json: v });

function response() {
  return {
    statusCode: 0, headers: {}, body: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v },
    end(text) { this.body = JSON.parse(text) }
  };
}

let token, coachToken;
const req = (method, url, extra = {}) => ({
  method, url,
  headers: { cookie: 'bs_session=' + (extra.coach ? coachToken : token), 'sec-fetch-site': 'same-origin', ...extra.headers },
  ...(extra.body !== undefined ? { body: extra.body } : {})
});

let me, config, data, rev, activity, stand, plan, logout;

beforeAll(async () => {
  globalThis[SQL_CACHE] = sql;
  process.env.AUTH_SECRET = SECRET;
  // B&S: Ohne diese beiden Variablen antwortet jeder Handler 500 (lib/guard.js).
  // Die Datenbank selbst wird nie angefasst — sql hängt schon in globalThis.
  process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/postgres';
  const key = new TextEncoder().encode(SECRET);
  const sign = (sub, rolle) => new SignJWT({ rolle, tv: 0 })
    .setProtectedHeader({ alg: 'HS256' }).setSubject(sub).setIssuedAt().setExpirationTime('30d').sign(key);
  token = await sign('mitglied12345', 'TEILNEHMER');
  coachToken = await sign('coach1234567', 'COACH');
  ;[me, config, data, rev, activity, stand, plan, logout] = await Promise.all([
    import('../api/me.js'), import('../api/config.js'), import('../api/data.js'),
    import('../api/data/rev.js'), import('../api/activity.js'),
    import('../api/trainer/stand.js'), import('../api/trainer/plan.js'), import('../api/logout.js')
  ]).then(mods => mods.map(m => m.default));
});

const MITGLIED = { id: 'mitglied12345', name: 'Max', rolle: 'TEILNEHMER', tokenVersion: 0 };
const COACH = { id: 'coach1234567', name: 'Valentin', rolle: 'COACH', tokenVersion: 0 };

beforeEach(() => {
  db = { queries: [], calls: [], users: { [MITGLIED.id]: MITGLIED, [COACH.id]: COACH }, stand: null, writeRev: 1 };
});

async function call(handler, request) {
  const res = response();
  await handler(request, res);
  return res;
}

describe('GET /api/config', () => {
  it('hides the AI coach by not mentioning it', async () => {
    const res = await call(config, { method: 'GET', url: '/api/config', headers: {} });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ invite_only: true, allow_guest: false, trainer_disabled: true });
    expect('coach' in res.body).toBe(false);
  });
});

describe('GET /api/me', () => {
  it('answers with the member', async () => {
    const res = await call(me, req('GET', '/api/me'));
    expect(res.body).toEqual({ user: { id: 'mitglied12345', name: 'Max', admin: false, coach: false } });
  });

  it('is 401 without a valid cookie', async () => {
    const res = await call(me, { method: 'GET', url: '/api/me', headers: {} });
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'not signed in' });
  });

  it('is 405 on the wrong method', async () => {
    const res = await call(me, req('POST', '/api/me'));
    expect(res.statusCode).toBe(405);
  });
});

describe('/api/data', () => {
  it('GET without a row is an empty state', async () => {
    const res = await call(data, req('GET', '/api/data'));
    expect(res.body).toEqual({ state: null, rev: 0 });
  });

  it('GET hands out the coach plan inside the document', async () => {
    db.stand = { daten: { workouts: [] }, plan: { routines: [{ id: 'r1' }], week: { 1: ['r1'] } }, rev: 3 };
    const res = await call(data, req('GET', '/api/data'));
    expect(res.body.rev).toBe(3);
    expect(res.body.state.routines).toEqual([{ id: 'r1' }]);
    expect(res.body.state._rev).toBe(3);
  });

  it('PUT stores only the member half and returns the plan', async () => {
    db.stand = { daten: {}, plan: { routines: [{ id: 'r1' }], week: {}, customEx: [] }, rev: 2 };
    db.writeRev = 3;
    const res = await call(data, req('PUT', '/api/data', {
      body: { state: { workouts: [], routines: [{ id: 'gefaelscht' }], _ts: 42 }, baseRev: 2 }
    }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, ts: 42, rev: 3, plan: { routines: [{ id: 'r1' }], week: {}, customEx: [] } });
    // Die untergeschobenen routines dürfen nicht in daten gelandet sein
    expect(db.queries.some(q => q.startsWith('UPDATE "GymStand"'))).toBe(true);
  });

  it('PUT refuses a stale baseRev with the current document', async () => {
    db.stand = { daten: { workouts: [1] }, plan: {}, rev: 5 };
    const res = await call(data, req('PUT', '/api/data', { body: { state: { workouts: [] }, baseRev: 4 } }));
    expect(res.statusCode).toBe(409);
    expect(res.body.rev).toBe(5);
    expect(res.body.state.workouts).toEqual([1]);
  });

  it('PUT answers 409 when it loses the race to write', async () => {
    db.stand = { daten: {}, plan: {}, rev: 5 };
    db.writeRev = null;   // UPDATE trifft keine Zeile mehr
    const res = await call(data, req('PUT', '/api/data', { body: { state: { workouts: [] } } }));
    expect(res.statusCode).toBe(409);
  });

  it('PUT refuses a state that is not a document', async () => {
    expect((await call(data, req('PUT', '/api/data', { body: {} }))).statusCode).toBe(400);
    expect((await call(data, req('PUT', '/api/data', { body: { state: { workouts: 'nein' } } }))).body)
      .toEqual({ error: 'invalid state' });
  });

  it('PUT refuses a foreign origin', async () => {
    const res = await call(data, req('PUT', '/api/data', {
      body: { state: {} }, headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' }
    }));
    expect(res.statusCode).toBe(403);
  });

  it('GET /api/data/rev is just the number', async () => {
    db.stand = { daten: {}, plan: {}, rev: 8 };
    expect((await call(rev, req('GET', '/api/data/rev'))).body).toEqual({ rev: 8 });
  });
});

describe('POST /api/activity', () => {
  it('stamps the signal with a time', async () => {
    const res = await call(activity, req('POST', '/api/activity', { body: { active: true, name: 'Push' } }));
    expect(res.body).toEqual({ ok: true });
    expect(db.queries[1]).toContain('SET "live" = EXCLUDED."live"');
  });
});

describe('/api/trainer', () => {
  const coachReq = (method, url, body) => req(method, url, { coach: true, body });

  it('refuses a member', async () => {
    const res = await call(stand, req('GET', '/api/trainer/stand?user=mitglied12345'));
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'coach only' });
  });

  // B&S: `rev` ist hier die Revision des PLANS (steckt in der plan-Spalte), nicht
  // die der Zeile — die bewegt sich auch, wenn das Mitglied einen Satz loggt.
  it('gives the coach the member state and the revision of the plan', async () => {
    db.stand = { daten: { workouts: [1] }, plan: { routines: [{ id: 'r1' }], planRev: 6 }, rev: 2 };
    const res = await call(stand, coachReq('GET', '/api/trainer/stand?user=mitglied12345'));
    expect(res.statusCode).toBe(200);
    expect(res.body.user).toEqual({ id: 'mitglied12345', name: 'Max' });
    expect(res.body.rev).toBe(6);
    expect(res.body.state.routines).toEqual([{ id: 'r1' }]);
    // Der interne Zähler bleibt im Server.
    expect(res.body.state.planRev).toBeUndefined();
  });

  it('answers state null when the member never opened the app', async () => {
    const res = await call(stand, coachReq('GET', '/api/trainer/stand?user=mitglied12345'));
    expect(res.body).toEqual({ user: { id: 'mitglied12345', name: 'Max' }, state: null, rev: 0 });
  });

  it('is 404 for an unknown, nonsense or non-member id', async () => {
    for (const id of ['kurz', 'gibtesnichtxx', COACH.id]) {
      const res = await call(stand, coachReq('GET', '/api/trainer/stand?user=' + id));
      expect(res.statusCode, id).toBe(404);
      expect(res.body).toEqual({ error: 'not found' });
    }
  });

  it('PUT plan stores the plan and answers with the new revision', async () => {
    db.writeRev = 4;
    const res = await call(plan, coachReq('PUT', '/api/trainer/plan?user=mitglied12345', {
      routines: [{ id: 'r1', name: 'Push', ex: [{ id: 'e1', sets: 3, restSec: 90 }] }],
      week: { 1: 'r1' }, namen: { e1: 'Bankdrücken' }
    }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, rev: 1 });
    expect(db.queries.some(q => q.startsWith('INSERT INTO "GymStand"'))).toBe(true);
  });

  it('PUT plan refuses a broken plan before it writes', async () => {
    const res = await call(plan, coachReq('PUT', '/api/trainer/plan?user=mitglied12345', { routines: 'nein' }));
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'invalid plan' });
    expect(db.queries.every(q => !q.startsWith('INSERT INTO "GymStand"'))).toBe(true);
  });

  it('PUT plan refuses a member and a foreign origin', async () => {
    expect((await call(plan, req('PUT', '/api/trainer/plan?user=mitglied12345', { body: { routines: [] } }))).statusCode).toBe(403);
    const res = await call(plan, req('PUT', '/api/trainer/plan?user=mitglied12345', {
      coach: true, body: { routines: [] }, headers: { origin: 'https://evil.example' }
    }));
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'bad origin' });
  });
});

describe('POST /api/logout', () => {
  it('is a no-op that answers ok', async () => {
    expect((await call(logout, req('POST', '/api/logout'))).body).toEqual({ ok: true });
    expect(db.queries).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// B&S: alles ab hier prüft Verhalten, das dieser Fork gegenüber openGym geändert
// hat — Konfiguration, Coach als eigener Athlet, Plan-Konflikte, Eigentum an
// eigenen Übungen und der geprüfte Aktivitäts-Body.
// ---------------------------------------------------------------------------

describe('fehlende Konfiguration', () => {
  /** console.error einsammeln, ohne die Testausgabe zuzumüllen. */
  async function withQuietError(fn) {
    const logs = [];
    const orig = console.error;
    console.error = (...args) => logs.push(args.map(String).join(' '));
    try {
      await fn(logs);
    } finally {
      console.error = orig;
    }
  }

  it('is a 500 that names the variable, never a 401 the member could loop on', async () => {
    const secret = process.env.AUTH_SECRET;
    delete process.env.AUTH_SECRET;
    try {
      await withQuietError(async logs => {
        const res = await call(me, req('GET', '/api/me'));
        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({ error: 'server misconfigured' });
        expect(logs.join(' ')).toContain('AUTH_SECRET');
        // Nichts angefasst: ohne Konfiguration wird gar nicht erst gefragt.
        expect(db.queries).toEqual([]);
      });
    } finally {
      process.env.AUTH_SECRET = secret;
    }
  });

  it('names DATABASE_URL too', async () => {
    const url = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      await withQuietError(async logs => {
        const res = await call(data, req('GET', '/api/data'));
        expect(res.statusCode).toBe(500);
        expect(logs.join(' ')).toContain('DATABASE_URL');
      });
    } finally {
      process.env.DATABASE_URL = url;
    }
  });
});

// B&S: Beide Betreiber sind selbst Athleten. Für sie schreibt niemand einen Plan
// (/api/trainer/plan nimmt nur Teilnehmer), also gehört ihr Plan ihrem eigenen
// Dokument. Vorher hat der Server routines/week aus jedem Coach-PUT gelöscht und
// mit dem leeren Coach-Plan geantwortet — die eigene Routine war still weg.
describe('/api/data — der Coach trainiert selbst', () => {
  const coachReq = (method, url, body) => req(method, url, { coach: true, body });
  const routine = { id: 'r1', name: 'Oberkörper', ex: [{ id: '0001', sets: 3 }] };

  it('keeps the routines a coach pushes for himself', async () => {
    db.stand = { daten: { workouts: [] }, plan: {}, rev: 2 };
    db.writeRev = 3;
    const res = await call(data, coachReq('PUT', '/api/data', {
      state: { workouts: [], routines: [routine], week: { 1: ['r1'] } }, baseRev: 2
    }));
    expect(res.statusCode).toBe(200);
    // Gespeichert wird der Plan des Coaches mit — das ist der Kern des Fehlers.
    expect(written().values[0].json.routines).toEqual([routine]);
    expect(written().values[0].json.week).toEqual({ 1: ['r1'] });
    // Und die Antwort gibt ihm zurück, was er geschickt hat, statt ihn zu leeren.
    expect(res.body.plan).toEqual({ routines: [routine], week: { 1: ['r1'] }, customEx: [] });
  });

  it('gives a coach his own plan back on GET', async () => {
    db.stand = { daten: { workouts: [], routines: [routine], week: { 1: ['r1'] } }, plan: {}, rev: 4 };
    const res = await call(data, coachReq('GET', '/api/data'));
    expect(res.body.state.routines).toEqual([routine]);
    expect(res.body.state.week).toEqual({ 1: ['r1'] });
  });

  it('still shows a plan written while the coach was a member, until he pushes his own', async () => {
    db.stand = { daten: { workouts: [] }, plan: { routines: [routine], week: {} }, rev: 4 };
    expect((await call(data, coachReq('GET', '/api/data'))).body.state.routines).toEqual([routine]);
  });

  it('keeps stripping routines and week from a member', async () => {
    db.stand = { daten: {}, plan: { routines: [{ id: 'echt' }], week: {}, customEx: [] }, rev: 2 };
    db.writeRev = 3;
    const res = await call(data, req('PUT', '/api/data', {
      body: { state: { workouts: [], routines: [{ id: 'gefaelscht' }], week: { 0: ['x'] } }, baseRev: 2 }
    }));
    expect(res.statusCode).toBe(200);
    expect(written().values[0].json.routines).toBeUndefined();
    expect(written().values[0].json.week).toBeUndefined();
    expect(res.body.plan.routines).toEqual([{ id: 'echt' }]);
  });

  it('never lets a member document set a prototype in the coach tab', async () => {
    db.stand = { daten: {}, plan: {}, rev: 1 };
    db.writeRev = 2;
    // JSON.parse legt __proto__ als ganz normale eigene Eigenschaft an.
    const state = JSON.parse('{"workouts":[],"__proto__":{"pwn":1},"tief":{"__proto__":{"pwn":1}}}');
    await call(data, req('PUT', '/api/data', { body: { state, baseRev: 1 } }));
    const daten = written().values[0].json;
    expect(Object.prototype.hasOwnProperty.call(daten, '__proto__')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(daten.tief, '__proto__')).toBe(false);
  });

  // B&S: Beides nimmt jsonb nicht an. Ungefiltert scheitert der INSERT, der
  // Handler antwortet 500, und der Client wiederholt den Push endlos — die
  // Trainings dieses Mitglieds kämen nie wieder beim Server an.
  it('drops NUL and a lone surrogate instead of a permanent 500 from jsonb', async () => {
    db.stand = { daten: {}, plan: {}, rev: 1 };
    db.writeRev = 2;
    const state = JSON.parse('{"workouts":[],"note":"Satz\\u0000eins","ex":"Bank\\ud83cdr\\udfcbcken"}');
    const res = await call(data, req('PUT', '/api/data', { body: { state, baseRev: 1 } }));
    expect(res.statusCode).toBe(200);
    expect(written().values[0].json.note).toBe('Satzeins');
    expect(written().values[0].json.ex).toBe('Bankdrcken');
  });
});

// B&S: Beide Coaches sehen alle Mitglieder und ein Editor-Tab lädt nie nach.
// Ohne baseRev schrieb ein Tab vom Vormittag den Nachmittag des anderen weg.
describe('/api/trainer/plan — verlorene Änderungen', () => {
  const coachReq = (method, url, body) => req(method, url, { coach: true, body });
  const push = { id: 'r1', name: 'Push', ex: [{ id: '0001', sets: 3 }] };
  // planRev = der Stand, auf dem der Editor sitzt; rev = der Stand der Zeile.
  const planRow = (planRev, routines, rev = 42) =>
    ({ daten: {}, plan: { routines, week: {}, customEx: [], namen: {}, planRev }, rev });

  it('answers 409 with the current plan when the rev moved on', async () => {
    db.stand = planRow(7, [{ id: 'r9', name: 'Vom anderen Coach', ex: [] }]);
    const res = await call(plan, coachReq('PUT', '/api/trainer/plan?user=mitglied12345', {
      routines: [push], baseRev: 6
    }));
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({
      error: 'conflict',
      rev: 7,
      plan: { routines: [{ id: 'r9', name: 'Vom anderen Coach', ex: [] }], week: {}, customEx: [] }
    });
    expect(written()).toBeUndefined();
  });

  it('writes against exactly that rev when it still matches', async () => {
    db.stand = planRow(7, [], 42);
    db.writeRev = 43;
    const res = await call(plan, coachReq('PUT', '/api/trainer/plan?user=mitglied12345', {
      routines: [push], baseRev: 7
    }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, rev: 8 });
    // Geschrieben wird bedingt gegen die ZEILENrevision — das ist der Schutz
    // gegen das Rennen zwischen Lesen und Schreiben.
    expect(written().text).toContain('WHERE "userId" = ? AND "rev" = ?');
    expect(written().values[2]).toBe(42);
    expect(written().values[0].json.planRev).toBe(8);
  });

  // B&S: Die Zeilenrevision zählt auch hoch, wenn das MITGLIED einen Satz loggt.
  // Würde der Editor dagegen prüfen, bekäme der Coach alle paar Minuten „ein
  // anderer Coach hat den Plan geändert" zu lesen, während nur trainiert wurde.
  it('is not a conflict when only the member wrote in the meantime', async () => {
    db.stand = planRow(7, [], 99);   // planRev unverändert, Zeile weit weiter
    db.writeRev = 100;
    const res = await call(plan, coachReq('PUT', '/api/trainer/plan?user=mitglied12345', {
      routines: [push], baseRev: 7
    }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, rev: 8 });
  });

  it('answers 409 when someone else wrote between the read and the write', async () => {
    db.stand = planRow(7, []);
    db.writeRev = null;   // das bedingte UPDATE trifft keine Zeile mehr
    const res = await call(plan, coachReq('PUT', '/api/trainer/plan?user=mitglied12345', {
      routines: [push], baseRev: 7
    }));
    expect(res.statusCode).toBe(409);
    expect(res.body.rev).toBe(7);
  });

  it('treats a baseRev that is not a number as a conflict, never as a free overwrite', async () => {
    db.stand = planRow(7, []);
    const res = await call(plan, coachReq('PUT', '/api/trainer/plan?user=mitglied12345', {
      routines: [push], baseRev: 'sieben'
    }));
    expect(res.statusCode).toBe(409);
    expect(written()).toBeUndefined();
  });

  it('does not write (and does not bump rev) when the plan did not change', async () => {
    db.stand = planRow(5, [{ id: 'r1', name: 'Push', ex: [] }]);
    const res = await call(plan, coachReq('PUT', '/api/trainer/plan?user=mitglied12345', {
      routines: [{ id: 'r1', name: 'Push', ex: [] }], week: {}, customEx: [], namen: {}, baseRev: 5
    }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, rev: 5 });
    expect(written()).toBeUndefined();
  });

  // Steht auf dem Server schon genau dieser Plan, gibt es nichts zu streiten —
  // sonst käme ein Editor, der nur einen Favoritenstern gesetzt hat, in eine
  // Konfliktmeldung, obwohl niemand etwas anderes geschrieben hat.
  it('is not a conflict when the stale tab sends exactly the stored plan', async () => {
    db.stand = planRow(5, [{ id: 'r1', name: 'Push', ex: [] }]);
    const res = await call(plan, coachReq('PUT', '/api/trainer/plan?user=mitglied12345', {
      routines: [{ id: 'r1', name: 'Push', ex: [] }], week: {}, customEx: [], namen: {}, baseRev: 2
    }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, rev: 5 });
    expect(written()).toBeUndefined();
  });

  // B&S: setLive legt beim ersten „trainiert gerade“ eine Zeile mit rev 0 an,
  // bevor das Mitglied je gepusht hat. Der Editor sitzt dann auf Stand 0 — das
  // darf kein Dauerkonflikt sein, sonst bekommt genau dieses Mitglied nie einen Plan.
  it('saves the first plan even when only the activity ping created the row', async () => {
    db.stand = { daten: {}, plan: null, rev: 0 };
    db.writeRev = 1;
    const res = await call(plan, coachReq('PUT', '/api/trainer/plan?user=mitglied12345', {
      routines: [push], baseRev: 0
    }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, rev: 1 });
    expect(written().text).toContain('WHERE "GymStand"."rev" = 0');
  });

  it('shortens an over-long routine name instead of wedging the editor with a 400', async () => {
    db.writeRev = 2;
    const res = await call(plan, coachReq('PUT', '/api/trainer/plan?user=mitglied12345', {
      routines: [{ id: 'r1', name: 'x'.repeat(200), ex: [] }]
    }));
    expect(res.statusCode).toBe(200);
    expect(written().values[1].json.routines[0].name).toHaveLength(80);
  });

  // B&S: compose() legt dem Editor auch die eigenen Übungen des Mitglieds vor;
  // beim Speichern schickt er alles zurück, was in einer Routine vorkommt. Wer
  // wem gehört, entscheidet deshalb der Server.
  it('never promotes a member-owned custom exercise into the coach plan', async () => {
    db.stand = {
      daten: { customEx: [{ id: 'cmitglied', n: 'Schlittenschub' }] },
      plan: { routines: [], week: {}, customEx: [{ id: 'ccoach', n: 'Coach-Übung' }], namen: {}, planRev: 3 },
      rev: 3
    };
    db.writeRev = 4;
    const res = await call(plan, coachReq('PUT', '/api/trainer/plan?user=mitglied12345', {
      routines: [{ id: 'r1', name: 'Push', ex: [{ id: 'cmitglied' }, { id: 'ccoach' }, { id: 'cneu' }] }],
      customEx: [
        { id: 'cmitglied', n: 'Untergeschoben' },
        { id: 'ccoach', n: 'Coach-Übung' },
        { id: 'cneu', n: 'Neu vom Coach' }
      ],
      baseRev: 3
    }));
    expect(res.statusCode).toBe(200);
    expect(written().values[0].json.customEx.map(e => e.id)).toEqual(['ccoach', 'cneu']);
  });
});

describe('POST /api/activity — geprüfter Body', () => {
  it('stores only the known fields and stamps the time itself', async () => {
    const res = await call(activity, req('POST', '/api/activity', {
      body: {
        active: true, name: 'Push', exIdx: 2, exTotal: 6,
        at: '1999-01-01T00:00:00.000Z', boese: 'x'.repeat(200), verschachtelt: { a: 1 }
      }
    }));
    expect(res.body).toEqual({ ok: true });
    const live = written().values[1].json;
    expect(Object.keys(live).sort()).toEqual(['active', 'at', 'exIdx', 'exTotal', 'name']);
    expect(live.at).not.toBe('1999-01-01T00:00:00.000Z');
    expect(Date.parse(live.at)).toBeGreaterThan(Date.now() - 60000);
  });

  it('writes at most every few seconds, so a script cannot hammer the shared row', async () => {
    await call(activity, req('POST', '/api/activity', { body: { active: true } }));
    const { text } = written();
    expect(text).toContain('"GymStand"."live"->>\'at\' <');
    expect(text).toContain('IS DISTINCT FROM');
  });

  it('refuses a payload over the 2 KB limit', async () => {
    const res = await call(activity, req('POST', '/api/activity', { body: { active: true, name: 'x'.repeat(5000) } }));
    expect(res.statusCode).toBe(413);
    expect(res.body).toEqual({ error: 'body too large' });
    expect(written()).toBeUndefined();
  });
});
