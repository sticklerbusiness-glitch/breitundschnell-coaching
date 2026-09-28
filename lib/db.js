import postgres from 'postgres';

// Eine Verbindung pro Function-Instanz. Die Datenbank ist dieselbe Supabase-
// Instanz wie bei der Website; geschrieben wird hier nur in "GymStand".

/**
 * DATABASE_URL zerlegen. Die Prisma-Parameter `pgbouncer` und
 * `connection_limit` versteht Postgres nicht — postgres.js würde sie als
 * Server-Settings weiterreichen und die Verbindung scheitert daran.
 */
export function connectionSettings(rawUrl, env = process.env) {
  if (!rawUrl) throw new Error('DATABASE_URL fehlt');
  const url = new URL(rawUrl);
  url.searchParams.delete('pgbouncer');
  url.searchParams.delete('connection_limit');
  const host = url.hostname;
  const local = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  // B&S: NICHT ssl:'require' — postgres.js übersetzt diesen String in
  // rejectUnauthorized:false (node_modules/postgres/src/connection.js). Die
  // Verbindung wäre verschlüsselt, aber ungeprüft: wer den Weg zwischen der
  // Function und Supabase umbiegt, könnte irgendein Zertifikat vorzeigen und
  // Gesundheitsdaten samt DB-Passwort mitlesen. Ein Objekt reicht postgres.js
  // unverändert an tls.connect weiter, inklusive `servername` (= Hostname), also
  // wird die Kette UND der Name geprüft. Der Supabase-Pooler
  // (*.pooler.supabase.com) hat ein öffentlich vertrauenswürdiges Zertifikat —
  // der Standard-CA-Store von Node genügt. Nur für eine eigene CA (z. B. die
  // direkte db.<ref>.supabase.co-Verbindung mit Supabase-Root) gibt es
  // GYM_DB_CA: dort das PEM hineinlegen, dann wird gegen diese CA geprüft.
  const ca = typeof env?.GYM_DB_CA === 'string' && env.GYM_DB_CA.trim() ? env.GYM_DB_CA : null;
  const ssl = { rejectUnauthorized: true, ...(ca ? { ca } : {}) };
  return {
    url: url.toString(),
    options: {
      prepare: false,       // Transaction-Pooler kennt keine Prepared Statements
      max: 1,               // eine Serverless-Instanz bedient genau einen Request
      idle_timeout: 20,
      ...(local ? {} : { ssl })
    }
  };
}

// Im Dev lädt der Vite-Plugin die Handler nach jeder Änderung neu. Ohne diesen
// Umweg über globalThis bekäme jede Neuladung ihren eigenen Pool.
const CACHE = Symbol.for('breitundschnell.gym.sql');

export function getSql(env = process.env) {
  if (globalThis[CACHE]) return globalThis[CACHE];
  const { url, options } = connectionSettings(env.DATABASE_URL, env);
  globalThis[CACHE] = postgres(url, options);
  return globalThis[CACHE];
}
