import { describe, it, expect } from 'vitest';
import { parseEnvFile, applyEnv } from './env-file.js';

describe('parseEnvFile', () => {
  it('reads the shape the website uses (quoted values, comments)', () => {
    const text = [
      '# Lokale Konfiguration',
      '',
      'DATABASE_URL="postgresql://u:p@host:6543/postgres?pgbouncer=true"',
      '',
      '# 4) Kommentarzeile',
      "AUTH_SECRET='abc def'",
      'NEXT_PUBLIC_APP_URL=http://localhost:3000 # mit Kommentar',
      'export CRON_SECRET=xyz',
      '# ANTHROPIC_API_KEY="auskommentiert"',
      'kaputte zeile'
    ].join('\n');
    expect(parseEnvFile(text)).toEqual({
      DATABASE_URL: 'postgresql://u:p@host:6543/postgres?pgbouncer=true',
      AUTH_SECRET: 'abc def',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      CRON_SECRET: 'xyz'
    });
  });

  it('keeps a # that belongs to the value', () => {
    expect(parseEnvFile('A="ge#heim"').A).toBe('ge#heim');
  });

  it('survives nothing', () => {
    expect(parseEnvFile(undefined)).toEqual({});
    expect(parseEnvFile('')).toEqual({});
  });
});

describe('applyEnv', () => {
  it('only fills what is still empty and only the listed keys', () => {
    const target = { AUTH_SECRET: 'schon da' };
    applyEnv(target, { AUTH_SECRET: 'neu', DATABASE_URL: 'url', CRON_SECRET: 'nein' }, ['AUTH_SECRET', 'DATABASE_URL']);
    expect(target).toEqual({ AUTH_SECRET: 'schon da', DATABASE_URL: 'url' });
  });
});
