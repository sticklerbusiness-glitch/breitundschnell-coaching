import { HttpError } from './http.js';
import { sanitizeJson } from './safe.js';

/**
 * Rohen Request-Body lesen und dabei mitzählen. Ohne Limit könnte ein
 * einziger Request den Function-Speicher füllen; mit Limit steht die Grenze
 * dort, wo sie fachlich hingehört (4 MB Trainingsdokument, 512 KB Plan …).
 */
export function readRawBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let done = false;
    const chunks = [];
    const finish = (err, value) => {
      if (done) return;
      done = true;
      err ? reject(err) : resolve(value);
    };
    req.on('data', chunk => {
      // Nach dem 413 nichts mehr sammeln — aber auch nicht abbrechen.
      if (done) return;
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buf.length;
      if (size > limit) {
        finish(new HttpError(413, 'body too large'));
        // B&S: NICHT req.destroy(). Das nahm den Socket, bevor fail(res, err)
        // die 413 hinausschreiben konnte — der Client sah keinen Status, sondern
        // einen abgebrochenen fetch, hielt das für „offline" und schickte
        // dasselbe zu große Dokument endlos wieder. Den Rest einfach leerlaufen
        // lassen: gesammelt wird nichts mehr (chunks sind schon frei), und die
        // Antwort kommt normal durch.
        chunks.length = 0;
        if (typeof req.resume === 'function') req.resume();
        return;
      }
      chunks.push(buf);
    });
    req.on('end', () => finish(null, Buffer.concat(chunks).toString('utf8')));
    req.on('error', err => finish(err));
    req.on('aborted', () => finish(new HttpError(400, 'request aborted')));
  });
}

/**
 * JSON-Body als einfaches Objekt. Vercel parst den Body manchmal schon selbst
 * (dann ist der Stream leer) — deshalb zuerst req.body ansehen.
 */
export async function readJson(req, limit) {
  const declared = Number(req.headers?.['content-length']);
  if (Number.isFinite(declared) && declared > limit) throw new HttpError(413, 'body too large');

  let raw;
  if (typeof req.body === 'string') raw = req.body;
  else if (Buffer.isBuffer(req.body)) raw = req.body.toString('utf8');
  // B&S: Vercel hat den Body schon geparst — der Stream ist leer und keine der
  // Prüfungen weiter unten würde je laufen. Ohne Content-Length (chunked) wäre
  // die Grenze damit in Produktion gar nicht da, und ein Array-Body käme durch,
  // den der Dev-Server ablehnt. Also einmal zurückschreiben und dieselben
  // Prüfungen anwenden: lokal und auf Vercel gilt dasselbe.
  else if (req.body && typeof req.body === 'object') raw = JSON.stringify(req.body);
  else raw = await readRawBody(req, limit);

  // B&S: Bytes, nicht UTF-16-Einheiten — sonst ist die Grenze bei deutschem Text
  // (und erst recht bei Emoji) lockerer als angekündigt.
  // Auf dem Weg mit vorab geparstem Body OHNE Content-Length sind das die Bytes
  // der Rück-Serialisierung, also die NUTZDATEN — die Einrückung des Originals
  // ist da schon weg. Das ist die Grenze, auf die es ankommt (Speicher der
  // Function, Größe in jsonb); die Leitung selbst begrenzt die Plattform. Eine
  // Pflicht-Content-Length wäre hier das größere Risiko: fehlt der Header auf
  // dem chunked-Weg, käme kein Push mehr durch.
  if (Buffer.byteLength(raw) > limit) throw new HttpError(413, 'body too large');
  if (!raw.trim()) return {};
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'invalid json');
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400, 'invalid json');
  // B&S: Prototyp-Schlüssel und NUL fliegen hier raus, an der einen Stelle, durch
  // die jeder schreibende Request läuft (siehe lib/safe.js).
  return sanitizeJson(data);
}

export const LIMITS = {
  data: 4 * 1024 * 1024,
  plan: 512 * 1024,
  activity: 2 * 1024
};
