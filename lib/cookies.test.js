import { describe, it, expect } from 'vitest';
import { parseCookies, cookieValue } from './cookies.js';

describe('parseCookies', () => {
  it('reads a normal header', () => {
    expect(parseCookies('a=1; bs_session=tok.en.sig; b=2')).toEqual({ a: '1', bs_session: 'tok.en.sig', b: '2' });
  });

  it('survives nothing at all', () => {
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies('')).toEqual({});
    expect(parseCookies('kaputt')).toEqual({});
  });

  it('unwraps quotes and percent-encoding', () => {
    expect(parseCookies('a="wert"; b=x%20y')).toEqual({ a: 'wert', b: 'x y' });
  });

  it('keeps the first of two with the same name', () => {
    expect(parseCookies('a=1; a=2').a).toBe('1');
  });
});

describe('cookieValue', () => {
  it('finds the session cookie between others', () => {
    expect(cookieValue('foo=bar; bs_session=abc', 'bs_session')).toBe('abc');
  });

  it('is null when it is missing or empty', () => {
    expect(cookieValue('foo=bar', 'bs_session')).toBe(null);
    expect(cookieValue('bs_session=', 'bs_session')).toBe(null);
    expect(cookieValue(undefined, 'bs_session')).toBe(null);
  });
});
