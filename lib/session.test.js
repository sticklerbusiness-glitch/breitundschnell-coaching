import { describe, it, expect } from 'vitest';
import { SignJWT } from 'jose';
import { readClaims, sessionUser, isCoach } from './session.js';

const SECRET = 'test-geheimnis-fuer-die-signatur';
const key = new TextEncoder().encode(SECRET);

const sign = (claims, alg = 'HS256') => new SignJWT(claims)
  .setProtectedHeader({ alg })
  .setSubject(claims.sub || 'cuid1234567890')
  .setIssuedAt()
  .setExpirationTime('30d')
  .sign(key);

/** sql-Doppel: gibt immer dieselben Zeilen zurück, egal welche Abfrage. */
const fakeSql = rows => () => Promise.resolve(rows);

describe('readClaims', () => {
  it('reads sub, rolle and tv', async () => {
    const token = await sign({ rolle: 'COACH', tv: 3 });
    expect(await readClaims('bs_session=' + token, SECRET))
      .toEqual({ userId: 'cuid1234567890', rolle: 'COACH', tv: 3 });
  });

  it('treats a missing tv as 0 and an unknown rolle as TEILNEHMER', async () => {
    const token = await sign({});
    expect(await readClaims('bs_session=' + token, SECRET))
      .toEqual({ userId: 'cuid1234567890', rolle: 'TEILNEHMER', tv: 0 });
  });

  it('is null without a cookie, without a secret or with a wrong signature', async () => {
    const token = await sign({});
    expect(await readClaims('', SECRET)).toBe(null);
    expect(await readClaims('andere=1', SECRET)).toBe(null);
    expect(await readClaims('bs_session=' + token, '')).toBe(null);
    expect(await readClaims('bs_session=' + token, 'falsches-geheimnis')).toBe(null);
    expect(await readClaims('bs_session=nonsense', SECRET)).toBe(null);
  });

  it('refuses an expired token', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' }).setSubject('cuid1234567890')
      .setIssuedAt(0).setExpirationTime(1).sign(key);
    expect(await readClaims('bs_session=' + token, SECRET)).toBe(null);
  });
});

describe('sessionUser', () => {
  const req = token => ({ headers: { cookie: 'bs_session=' + token } });
  const env = { AUTH_SECRET: SECRET };

  it('answers with the row from the database', async () => {
    const token = await sign({ tv: 2 });
    const user = { id: 'cuid1234567890', name: 'Max', rolle: 'TEILNEHMER', tokenVersion: 2 };
    expect(await sessionUser(req(token), fakeSql([user]), env)).toEqual(user);
  });

  it('refuses when the password changed since (tokenVersion moved)', async () => {
    const token = await sign({ tv: 1 });
    const user = { id: 'cuid1234567890', name: 'Max', rolle: 'TEILNEHMER', tokenVersion: 2 };
    expect(await sessionUser(req(token), fakeSql([user]), env)).toBe(null);
  });

  it('refuses when the user is gone', async () => {
    const token = await sign({ tv: 0 });
    expect(await sessionUser(req(token), fakeSql([]), env)).toBe(null);
  });

  it('takes the rolle from the database, not from the token', async () => {
    // Ein Cookie lebt 30 Tage — wer darin Coach wäre, bliebe es viel zu lange.
    const token = await sign({ rolle: 'COACH', tv: 0 });
    const user = { id: 'cuid1234567890', name: 'Max', rolle: 'TEILNEHMER', tokenVersion: 0 };
    expect(isCoach(await sessionUser(req(token), fakeSql([user]), env))).toBe(false);
  });

  it('is null without AUTH_SECRET', async () => {
    const token = await sign({});
    expect(await sessionUser(req(token), fakeSql([{}]), {})).toBe(null);
  });
});

// B&S: Ein Cookie war da, ließ sich aber nicht prüfen. Meistens ist es
// abgelaufen — wenn es ALLE trifft, ist AUTH_SECRET ein anderes als das der
// Website. Von außen sieht beides gleich aus (401), also muss es im Log stehen.
describe('sessionUser — Hinweis im Log', () => {
  const req = token => ({ headers: { cookie: 'bs_session=' + token } });

  async function withWarn(fn) {
    const logs = [];
    const orig = console.warn;
    console.warn = (...args) => logs.push(args.map(String).join(' '));
    try {
      await fn(logs);
    } finally {
      console.warn = orig;
    }
  }

  it('names AUTH_SECRET when a cookie is there but cannot be verified', async () => {
    const token = await sign({});
    await withWarn(async logs => {
      expect(await sessionUser(req(token), fakeSql([{}]), { AUTH_SECRET: 'falsches-geheimnis' })).toBe(null);
      expect(logs.join(' ')).toContain('AUTH_SECRET');
    });
  });

  it('says nothing when there simply is no cookie', async () => {
    await withWarn(async logs => {
      expect(await sessionUser({ headers: {} }, fakeSql([{}]), { AUTH_SECRET: SECRET })).toBe(null);
      expect(logs).toEqual([]);
    });
  });
});
