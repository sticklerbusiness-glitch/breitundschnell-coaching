import { describe, it, expect } from 'vitest';
import { originOk, allowedOrigins } from './origin.js';

const prod = { NODE_ENV: 'production' };
const put = headers => ({ method: 'PUT', headers });

describe('allowedOrigins', () => {
  it('is the live site in production', () => {
    expect(allowedOrigins(prod)).toEqual(['https://breitundschnell.de', 'https://www.breitundschnell.de']);
  });

  it('adds the two dev ports outside production', () => {
    expect(allowedOrigins({})).toContain('http://localhost:5174');
    expect(allowedOrigins({})).toContain('http://localhost:3000');
  });

  it('lets the env replace the list', () => {
    expect(allowedOrigins({ NODE_ENV: 'production', GYM_ALLOWED_ORIGINS: 'https://a.de, https://b.de' }))
      .toEqual(['https://a.de', 'https://b.de']);
  });
});

describe('originOk', () => {
  it('lets reads through', () => {
    expect(originOk({ method: 'GET', headers: { origin: 'https://evil.example' } }, prod)).toBe(true);
  });

  it('accepts a known origin on a write', () => {
    expect(originOk(put({ origin: 'https://breitundschnell.de' }), prod)).toBe(true);
  });

  it('refuses a foreign origin on a write', () => {
    expect(originOk(put({ origin: 'https://evil.example' }), prod)).toBe(false);
    expect(originOk(put({ origin: 'http://localhost:5174' }), prod)).toBe(false);
  });

  it('accepts the dev ports outside production', () => {
    expect(originOk(put({ origin: 'http://localhost:5174' }), {})).toBe(true);
  });

  it('falls back to Sec-Fetch-Site when no origin is sent', () => {
    expect(originOk(put({ 'sec-fetch-site': 'same-origin' }), prod)).toBe(true);
    expect(originOk(put({}), prod)).toBe(true);
    expect(originOk(put({ 'sec-fetch-site': 'cross-site' }), prod)).toBe(false);
    expect(originOk(put({ 'sec-fetch-site': 'same-site' }), prod)).toBe(false);
  });
});
