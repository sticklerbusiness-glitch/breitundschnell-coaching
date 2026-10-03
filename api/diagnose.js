import { json, methodNotAllowed, fail } from '../lib/http.js';
import { readClaims } from '../lib/session.js';
import { getSql, connectionSettings } from '../lib/db.js';

/* B&S: Selbsttest der Trainings-App — „woran scheitert es gerade?"
 *
 * Gebaut am 03.10.2026, nach zwei Tagen Suche nach einem Fehler, der von außen immer gleich
 * aussah: Die App antwortete 500, und ob das an der Konfiguration, am Netz oder an einem
 * falschen Passwort zur Datenbank lag, stand nur im Funktions-Protokoll bei Vercel — das sich
 * über die Schnittstelle nicht abrufen ließ. Dieser Endpunkt beantwortet die Frage in einer
 * Sekunde und von überall.
 *
 * Wer darf das sehen? Nur wer eine gültige COACH-Sitzung vorweist. Geprüft wird AUSSCHLIESSLICH
 * die Unterschrift des Cookies — ohne Datenbank, denn genau die ist ja möglicherweise kaputt.
 * Dass die Rolle hier aus dem Cookie kommt statt aus der Datenbank, ist für diesen einen
 * Endpunkt richtig: Er gibt keine Daten heraus, und ein Mitglied, das sein Cookie selbst
 * fälschen wollte, bräuchte dafür AUTH_SECRET — womit es ohnehin alles könnte.
 *
 * Herausgegeben wird nur, was zum Reparieren nötig ist: WELCHE Variablen gesetzt sind (nicht
 * ihr Inhalt), der HOST der Datenbank samt Port (nicht Benutzer, nicht Passwort) und die
 * Fehlerklasse des Verbindungsversuchs. Ein Passwort, ein Schlüssel oder ein Datensatz
 * verlässt diesen Endpunkt nie.
 */

const gesetzt = key => {
  const v = process.env[key];
  return typeof v === 'string' && v.trim().length > 0;
};

/** Host:Port der Datenbank — ohne Benutzer und Passwort. */
function ziel() {
  try {
    const { url } = connectionSettings(process.env.DATABASE_URL);
    const u = new URL(url);
    return { host: u.hostname, port: u.port || '5432', datenbank: u.pathname.slice(1) || null };
  } catch (e) {
    return { fehler: e.message.slice(0, 120) };
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

    const claims = await readClaims(req?.headers?.cookie, process.env.AUTH_SECRET);
    if (!claims) return json(res, 401, { error: 'not signed in' });
    if (claims.rolle !== 'COACH') return json(res, 403, { error: 'coach only' });

    const umgebung = {
      AUTH_SECRET: gesetzt('AUTH_SECRET'),
      DATABASE_URL: gesetzt('DATABASE_URL'),
      GYM_ALLOWED_ORIGINS: gesetzt('GYM_ALLOWED_ORIGINS'),
      GYM_DB_CA: gesetzt('GYM_DB_CA')
    };

    let datenbank;
    const start = Date.now();
    try {
      const sql = getSql();
      // Billigste denkbare Abfrage: Sie beweist nur, dass eine Verbindung steht und
      // Anmeldedaten stimmen. Keine Tabelle, keine Zeile, keine Daten.
      await sql`SELECT 1`;
      datenbank = { ok: true, dauerMs: Date.now() - start };
    } catch (err) {
      // Name und Code sagen, WAS kaputt ist: ein Zertifikat, ein Passwort, ein Netzweg.
      // Die Meldung selbst kann die Verbindungszeichenfolge enthalten — die bleibt draußen.
      datenbank = {
        ok: false,
        dauerMs: Date.now() - start,
        name: err?.name ?? null,
        code: err?.code ?? null,
        ursache: err?.cause?.code ?? err?.cause?.name ?? null
      };
    }

    json(res, 200, { umgebung, ziel: ziel(), datenbank });
  } catch (err) {
    fail(res, err);
  }
}
