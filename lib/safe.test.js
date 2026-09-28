import { describe, it, expect } from 'vitest';
import { dropUnsafeKeys, isSafeKey, sanitizeJson, storableText, UNSAFE_KEYS } from './safe.js';

// B&S: Zwei Dinge, die zwischen JSON.parse und der Datenbank niemand gebrauchen
// kann — Prototyp-Schlüssel (die im Browser über Object.assign den Prototyp des
// Zustandsobjekts setzen) und Zeichen, die Postgres in jsonb nicht annimmt
// (U+0000, einzelne Surrogate) und die darum den Push eines Mitglieds dauerhaft
// auf 500 legen würden.

const NUL = String.fromCharCode(0);

describe('isSafeKey', () => {
  it('knows the three keys that are not data', () => {
    expect(UNSAFE_KEYS).toEqual(['__proto__', 'constructor', 'prototype']);
    for (const key of UNSAFE_KEYS) expect(isSafeKey(key)).toBe(false);
    expect(isSafeKey('workouts')).toBe(true);
    expect(isSafeKey(7)).toBe(false);
  });
});

describe('storableText', () => {
  it('removes every NUL and leaves everything else alone', () => {
    expect(storableText('a' + NUL + 'b' + NUL)).toBe('ab');
    expect(storableText('ohne')).toBe('ohne');
    expect(storableText(5)).toBe(5);
    expect(storableText(null)).toBe(null);
  });

  // B&S: dieselbe Klasse wie NUL — Postgres lehnt beim Parsen eines jsonb-Werts
  // auch ein einzelnes Surrogat ab (halbe Emoji aus einem kaputten Import). Ohne
  // Filter wäre das wieder ein 500, den der Client ewig wiederholt.
  it('removes a lone surrogate but keeps a whole emoji', () => {
    expect(storableText('Bank\ud83cdr\udfcbcken')).toBe('Bankdrcken');
    expect(storableText('Kniebeuge \u{1F3CB}\u{FE0F}')).toBe('Kniebeuge \u{1F3CB}\u{FE0F}');
  });
});

describe('dropUnsafeKeys', () => {
  it('removes them as the own properties JSON.parse made them', () => {
    const obj = JSON.parse('{"a":1,"__proto__":{"pwn":1},"constructor":2,"prototype":3}');
    const out = dropUnsafeKeys(obj);
    expect(out).toEqual({ a: 1 });
    expect(Object.prototype.hasOwnProperty.call(out, '__proto__')).toBe(false);
  });

  it('survives anything that is not an object', () => {
    expect(dropUnsafeKeys(null)).toBe(null);
    expect(dropUnsafeKeys('x')).toBe('x');
  });
});

describe('sanitizeJson', () => {
  it('cleans nested objects and arrays', () => {
    const input = JSON.parse('{"w":[{"__proto__":{"pwn":1},"n":"Satz\\u0000eins"}],"tief":{"a":{"__proto__":{}}}}');
    const out = sanitizeJson(input);
    expect(out.w[0]).toEqual({ n: 'Satzeins' });
    expect(Object.prototype.hasOwnProperty.call(out.tief.a, '__proto__')).toBe(false);
  });

  it('does not poison Object.prototype on the way', () => {
    sanitizeJson(JSON.parse('{"__proto__":{"pwn":1}}'));
    expect({}.pwn).toBeUndefined();
  });

  it('cleans a NUL out of a key as well as out of a value', () => {
    expect(sanitizeJson({ ['a' + NUL + 'b']: 'c' + NUL + 'd' })).toEqual({ ab: 'cd' });
  });

  it('builds a fresh copy instead of mutating the input', () => {
    const input = { a: { b: 1 } };
    const out = sanitizeJson(input);
    expect(out).toEqual(input);
    expect(out.a).not.toBe(input.a);
  });

  // Ein rekursiver Durchlauf ohne Grenze wäre ein Stack-Overflow — also 500
  // statt einer Antwort. Ein Trainingsdokument ist flach verschachtelt.
  it('answers 400 instead of blowing the stack on absurd nesting', () => {
    let deep = {};
    for (let i = 0; i < 200; i++) deep = { deep };
    expect(() => sanitizeJson(deep)).toThrow(expect.objectContaining({ status: 400 }));
  });

  it('leaves a document of normal depth alone', () => {
    let deep = 'x';
    for (let i = 0; i < 20; i++) deep = { deep };
    expect(() => sanitizeJson(deep)).not.toThrow();
  });
});
