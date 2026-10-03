/* B&S: Anfragen an die WEBSITE, nicht an die eigene API.
 *
 * Diese App liegt unter /training/ und ihre eigenen Funktionen darunter (lib/api.js hängt
 * deshalb alles an die Base). Kalorien, Check-ins und das Konto gehören aber der Website:
 * Sie liegen in eigenen Tabellen, auf die der Admin-Bereich direkt rechnet, und ihre Regeln
 * stehen im privaten Repository — nicht in diesem öffentlichen hier.
 *
 * Technisch ist das dieselbe Herkunft (breitundschnell.de), das Sitzungs-Cookie fährt also
 * mit und die Inhaltsrichtlinie erlaubt es (connect-src 'self'). Der einzige Unterschied zu
 * api(): der Pfad geht absolut an die Wurzel statt an die Base.
 */

/** Eine Antwort ohne Netz ist etwas anderes als eine Antwort mit Fehler — das muss man unterscheiden können. */
export class WebsiteFehler extends Error {
  constructor(nachricht, status, daten) {
    super(nachricht)
    this.name = 'WebsiteFehler'
    this.status = status
    this.daten = daten
  }
}

export async function website(pfad, opts = {}) {
  const url = '/' + String(pfad).replace(/^\/+/, '')
  // B&S: Bei FormData setzt der Browser den Content-Type SELBST — samt der Grenzmarke, an
  // der die Teile voneinander getrennt werden. Wer ihn hier überschreibt, schickt ein
  // Formular ohne diese Marke, und der Server findet darin keine Datei.
  const istFormular = typeof FormData !== 'undefined' && opts.body instanceof FormData
  const antwort = await fetch(url, {
    ...opts,
    headers: {
      ...(istFormular ? {} : { 'Content-Type': 'application/json' }),
      ...(opts.headers || {})
    },
    // Gleiche Herkunft, aber ausdrücklich: ohne Cookie ist jede dieser Routen 401.
    credentials: 'same-origin'
  })
  const daten = await antwort.json().catch(() => ({}))
  if (!antwort.ok) {
    throw new WebsiteFehler(daten.fehler || `HTTP ${antwort.status}`, antwort.status, daten)
  }
  return daten
}

/* ---- Kalorien ---- */

/** @returns {Promise<{heute: string, ziel: number|null, eintraege: Array}>} */
export const kalorienLaden = (tage = 14) => website(`api/kalorien?tage=${tage}`)

/** Ohne `datum` entscheidet der Server, welcher Tag heute ist — in Berliner Zeit. */
export const kalorienSpeichern = eintrag =>
  website('api/kalorien', { method: 'PUT', body: JSON.stringify(eintrag) })

export const kalorienLoeschen = tag =>
  website(`api/kalorien?datum=${encodeURIComponent(tag)}`, { method: 'DELETE' })

/* ---- Check-in-Fotos ---- */

/** @returns {Promise<{checkins: Array<{id,createdAt,bildPfad,kommentar}>}>} */
export const checkinsLaden = (limit = 30) => website(`api/checkins?limit=${limit}`)

/** `datei` ist das bereits verkleinerte Bild (siehe views/CheckIn.jsx). */
export function checkinHochladen(datei, kommentar) {
  const formular = new FormData()
  formular.append('bild', datei, datei.name || 'checkin.webp')
  if (kommentar) formular.append('kommentar', kommentar)
  return website('api/checkins', { method: 'POST', body: formular })
}

export const checkinLoeschen = id =>
  website(`api/checkins?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
