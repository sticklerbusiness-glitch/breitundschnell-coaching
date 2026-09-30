import { describe, it, expect } from 'vitest';
import { Readable } from 'node:stream';
import { readJson, LIMITS } from './body.js';

// Ein Request, wie der Dev-Plugin (und Vercel ohne eigenen Parser) ihn liefert:
// ein Stream, nichts vorverdaut.
function request(text, headers = {}) {
  const req = Readable.from([Buffer.from(text)]);
  req.headers = headers;
  return req;
}

describe('readJson', () => {
  it('reads a body from the stream', async () => {
    expect(await readJson(request('{"state":{"a":1}}'), LIMITS.data)).toEqual({ state: { a: 1 } });
  });

  it('treats an empty body as {}', async () => {
    expect(await readJson(request(''), LIMITS.data)).toEqual({});
  });

  it('refuses a body over the limit while it is still arriving', async () => {
    await expect(readJson(request('x'.repeat(50)), 10)).rejects.toMatchObject({ status: 413 });
  });

  it('refuses on the announced length alone', async () => {
    const req = request('{}', { 'content-length': String(LIMITS.activity + 1) });
    await expect(readJson(req, LIMITS.activity)).rejects.toMatchObject({ status: 413 });
  });

  it('refuses broken json and non-objects', async () => {
    await expect(readJson(request('{nope'), 1000)).rejects.toMatchObject({ status: 400 });
    await expect(readJson(request('[1,2]'), 1000)).rejects.toMatchObject({ status: 400 });
    await expect(readJson(request('"text"'), 1000)).rejects.toMatchObject({ status: 400 });
  });

  it('takes a body the platform already parsed', async () => {
    const req = { headers: {}, body: { state: { a: 1 } } };
    expect(await readJson(req, LIMITS.data)).toEqual({ state: { a: 1 } });
  });

  it('parses a body the platform handed over as text', async () => {
    expect(await readJson({ headers: {}, body: '{"a":1}' }, LIMITS.data)).toEqual({ a: 1 });
  });

  it('has the limits from the spec', () => {
    expect(LIMITS).toEqual({ data: 4194304, plan: 524288, activity: 2048 });
  });
});

// B&S: readRawBody hat den Request beim 413 sofort zerstört — der Socket war
// weg, BEVOR fail(res, err) die Antwort hinausschreiben konnte. Der Client sah
// keinen Status, sondern einen abgebrochenen fetch, und isNetworkError() in
// doPush() griff zuerst: „offline", gym_dirty, und der nächste Push schickt
// dasselbe zu große Dokument wieder — endlos, und niemand erfährt je, dass das
// Dokument zu groß ist.
describe('readJson — zu großer Body', () => {
  /** Nur das, was readRawBody wirklich benutzt: on(), destroy(), resume(). */
  function fakeRequest() {
    const handlers = {};
    return {
      headers: {}, destroyed: false, resumed: 0, gesammelt: 0,
      on(event, fn) { (handlers[event] ||= []).push(fn); return this },
      emit(event, arg) { (handlers[event] || []).forEach(fn => fn(arg)) },
      destroy() { this.destroyed = true },
      resume() { this.resumed++ }
    };
  }

  it('does not destroy the request before the 413 can be answered', async () => {
    const req = fakeRequest();
    const p = readJson(req, 10);
    req.emit('data', Buffer.from('x'.repeat(20)));
    req.emit('data', Buffer.from('y'.repeat(20)));
    req.emit('end');
    await expect(p).rejects.toMatchObject({ status: 413 });
    expect(req.destroyed).toBe(false);
    expect(req.resumed).toBeGreaterThan(0);   // leerlaufen lassen statt zerstören
  });

  it('answers the 413 exactly once, whatever the stream does afterwards', async () => {
    const req = fakeRequest();
    const p = readJson(req, 10);
    req.emit('data', Buffer.from('x'.repeat(20)));
    req.emit('aborted');
    req.emit('error', new Error('socket weg'));
    await expect(p).rejects.toMatchObject({ status: 413 });
  });
});

// B&S: Auf Vercel ist der Body schon geparst — der Stream ist leer, und vorher
// lief KEINE der Prüfungen unten. Ohne Content-Length (chunked) gab es die
// Grenze in Produktion also gar nicht, und ein Array-Body kam durch, den der
// Dev-Server ablehnt. Lokal und auf Vercel muss dasselbe gelten.
describe('readJson — Body, den die Plattform schon geparst hat', () => {
  const parsed = body => ({ headers: {}, body });

  it('applies the limit to a pre-parsed object too', async () => {
    await expect(readJson(parsed({ a: 'x'.repeat(5000) }), LIMITS.activity))
      .rejects.toMatchObject({ status: 413 });
  });

  it('refuses a pre-parsed array exactly like the dev server does', async () => {
    await expect(readJson(parsed([1, 2]), LIMITS.data)).rejects.toMatchObject({ status: 400 });
  });

  it('counts bytes, not UTF-16 units', async () => {
    // 'ä' ist ein Zeichen, aber zwei Bytes — die Grenze ist eine Byte-Grenze.
    const text = '{"a":"' + 'ä'.repeat(20) + '"}';
    expect(Buffer.byteLength(text)).toBeGreaterThan(text.length);
    await expect(readJson(request(text), text.length)).rejects.toMatchObject({ status: 413 });
  });

  it('hands back a copy, not the caller object', async () => {
    const body = { state: { a: 1 } };
    const out = await readJson(parsed(body), LIMITS.data);
    expect(out).toEqual(body);
    expect(out.state).not.toBe(body.state);
  });
});

// B&S: Die eine Stelle, durch die jeder schreibende Request läuft — hier fliegen
// Prototyp-Schlüssel und NUL raus (siehe lib/safe.js).
describe('readJson — gefährliche Inhalte', () => {
  it('never carries __proto__ out of the body', async () => {
    const out = await readJson(request('{"state":{"__proto__":{"pwn":1}}}'), LIMITS.data);
    expect(Object.prototype.hasOwnProperty.call(out.state, '__proto__')).toBe(false);
    expect({}.pwn).toBeUndefined();
  });

  it('drops NUL, which jsonb cannot store', async () => {
    const out = await readJson(request('{"note":"a\\u0000b"}'), LIMITS.data);
    expect(out.note).toBe('ab');
  });

  it('refuses absurd nesting with a 400 instead of blowing the stack', async () => {
    const deep = '['.repeat(200) + ']'.repeat(200);
    await expect(readJson(request('{"a":' + deep + '}'), LIMITS.data))
      .rejects.toMatchObject({ status: 400 });
  });
});
