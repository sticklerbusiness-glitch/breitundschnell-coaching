import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { requireSession, requireOrigin, isUserId } from './guard.js';

// getSql() nimmt den Client aus globalThis, wenn dort schon einer liegt — so
// kommt dieser Test ohne Datenbank aus.
const SQL_CACHE = Symbol.for('breitundschnell.gym.sql');
let gefragt;
beforeAll(() => {
  globalThis[SQL_CACHE] = () => { gefragt = true; return Promise.resolve([]) };
});

function response() {
  return {
    statusCode: 0, headers: {}, body: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v },
    end(text) { this.body = JSON.parse(text) }
  };
}

let logs, origError;
beforeEach(() => {
  gefragt = false;
  logs = [];
  origError = console.error;
  console.error = (...args) => logs.push(args.map(String).join(' '));
});
afterEach(() => { console.error = origError });

const VOLL = { AUTH_SECRET: 'geheim', DATABASE_URL: 'postgresql://u:p@localhost:5432/postgres' };

// B&S: Fehlte AUTH_SECRET, sah das für jeden Besucher aus wie „nicht angemeldet"
// (401) — App und Website haben sich den Menschen gegenseitig zum Login
// geschoben, und im Log stand nichts. Eine fehlende Variable ist ein
// Serverfehler, kein Anmeldeproblem.
describe('requireSession — fehlende Konfiguration', () => {
  for (const fehlt of ['AUTH_SECRET', 'DATABASE_URL']) {
    it('answers 500 and names ' + fehlt + ' in the log', async () => {
      const env = { ...VOLL };
      delete env[fehlt];
      const res = response();
      expect(await requireSession({ headers: {} }, res, env)).toBe(null);
      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: 'server misconfigured' });
      expect(logs.join(' ')).toContain(fehlt);
      // Und gar nicht erst die Datenbank fragen.
      expect(gefragt).toBe(false);
    });
  }

  it('names both when both are missing', async () => {
    const res = response();
    await requireSession({ headers: {} }, res, {});
    expect(logs.join(' ')).toContain('AUTH_SECRET');
    expect(logs.join(' ')).toContain('DATABASE_URL');
  });

  it('is still a plain 401 when only the cookie is missing', async () => {
    const res = response();
    expect(await requireSession({ headers: {} }, res, VOLL)).toBe(null);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'not signed in' });
    expect(logs).toEqual([]);
  });
});

describe('requireOrigin', () => {
  it('lets the own site through and answers 403 for anything else', () => {
    const ok = response();
    expect(requireOrigin({ method: 'PUT', headers: { origin: 'https://breitundschnell.de' } }, ok, {})).toBe(true);
    const res = response();
    expect(requireOrigin({ method: 'PUT', headers: { origin: 'https://evil.example' } }, res, {})).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'bad origin' });
  });
});

describe('isUserId', () => {
  it('takes a cuid-shaped id and nothing else', () => {
    expect(isUserId('mitglied12345')).toBe(true);
    expect(isUserId('kurz')).toBe(false);
    expect(isUserId('__proto__')).toBe(false);
    expect(isUserId(null)).toBe(false);
  });
});
