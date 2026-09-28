import { describe, it, expect } from 'vitest';
import { connectionSettings } from './db.js';

describe('connectionSettings', () => {
  it('removes the Prisma-only parameters', () => {
    const { url } = connectionSettings(
      'postgresql://u:p@db.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require'
    );
    expect(url).not.toContain('pgbouncer');
    expect(url).not.toContain('connection_limit');
    expect(url).toContain('sslmode=require');
  });

  // B&S: NICHT der String 'require' — postgres.js übersetzt ihn in
  // rejectUnauthorized:false, die Verbindung wäre dann verschlüsselt, aber
  // ungeprüft. Ein Objekt geht unverändert an tls.connect.
  it('verifies the certificate against a remote host', () => {
    const { options } = connectionSettings('postgresql://u:p@db.pooler.supabase.com:6543/postgres', {});
    expect(options).toEqual({ prepare: false, max: 1, idle_timeout: 20, ssl: { rejectUnauthorized: true } });
    expect(options.ssl).not.toBe('require');
  });

  it('takes an own CA from GYM_DB_CA when there is one', () => {
    const { options } = connectionSettings(
      'postgresql://u:p@db.ref.supabase.co:5432/postgres',
      { GYM_DB_CA: '-----BEGIN CERTIFICATE-----\nxx\n-----END CERTIFICATE-----' }
    );
    expect(options.ssl.rejectUnauthorized).toBe(true);
    expect(options.ssl.ca).toContain('BEGIN CERTIFICATE');
  });

  it('ignores an empty GYM_DB_CA instead of passing ca: ""', () => {
    const { options } = connectionSettings('postgresql://u:p@db.pooler.supabase.com:6543/postgres', { GYM_DB_CA: '  ' });
    expect(options.ssl).toEqual({ rejectUnauthorized: true });
  });

  it('does not ask for TLS on localhost', () => {
    for (const host of ['localhost', '127.0.0.1']) {
      const { options } = connectionSettings(`postgresql://u:p@${host}:5432/postgres`, {});
      expect(options.ssl).toBeUndefined();
      expect(options.prepare).toBe(false);
    }
  });

  it('complains when the url is missing', () => {
    expect(() => connectionSettings('')).toThrow(/DATABASE_URL/);
  });
});
