import { describe, it, expect } from 'vitest';
import { connectionSettings } from './db.js';
import { SUPABASE_ROOT_CA } from './supabase-ca.js';

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
    const { options } = connectionSettings('postgresql://u:p@db.fremder-anbieter.example:5432/postgres', {});
    expect(options).toEqual({ prepare: false, max: 1, idle_timeout: 20, ssl: { rejectUnauthorized: true } });
    expect(options.ssl).not.toBe('require');
  });

  // B&S: Der Fehler, der die App vom 30.09. bis 03.10.2026 lahmgelegt hat, ohne dass man ihn
  // sah: Supabase stellt seine Server-Zertifikate selbst aus, Node kennt diese Wurzel nicht,
  // und jede geprüfte Verbindung starb mit SELF_SIGNED_CERT_IN_CHAIN — hinter einem 500.
  // Lokal fiel es nie auf, weil die Testdatenbank ohne TLS läuft.
  it('brings the Supabase root along for a Supabase host', () => {
    for (const host of ['aws-1-eu-west-1.pooler.supabase.com', 'db.ref.supabase.co']) {
      const { options } = connectionSettings(`postgresql://u:p@${host}:6543/postgres`, {});
      expect(options.ssl.rejectUnauthorized, host).toBe(true);
      expect(options.ssl.ca, host).toBe(SUPABASE_ROOT_CA);
      expect(options.ssl.ca, host).toContain('BEGIN CERTIFICATE');
    }
  });

  it('does not hand that root to anyone else', () => {
    const { options } = connectionSettings('postgresql://u:p@nicht.supabase.example:5432/postgres', {});
    expect(options.ssl.ca).toBeUndefined();
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
    const { options } = connectionSettings('postgresql://u:p@fremd.example:5432/postgres', { GYM_DB_CA: '  ' });
    expect(options.ssl).toEqual({ rejectUnauthorized: true });
  });

  // Eine leere Variable darf die mitgelieferte Wurzel nicht verdrängen — sonst schaltet ein
  // versehentlich angelegtes, leeres GYM_DB_CA die App wieder ab.
  it('falls back to the bundled root when GYM_DB_CA is empty', () => {
    const { options } = connectionSettings('postgresql://u:p@x.pooler.supabase.com:6543/postgres', { GYM_DB_CA: '' });
    expect(options.ssl.ca).toBe(SUPABASE_ROOT_CA);
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
