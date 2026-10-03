/* B&S: „Leg dir die App auf den Home-Bildschirm."
 *
 * Für Mitglieder IST diese App das Produkt — die Website ist die Einladung, nicht der Ort, an dem
 * trainiert wird. Also soll nach dem ersten Anmelden ein Fenster erklären, wie man sie auf den
 * Home-Bildschirm legt. Dafür muss man wissen, WER da sitzt: Die Schritte auf einem iPhone sind
 * andere als auf einem Android-Handy, und beide sind falsch, wenn die App längst installiert ist.
 *
 * Alles hier ist reine Rechnerei auf übergebenen Werten — kein Zugriff auf window, kein Speicher.
 * Was der Browser sagt, kommt von außen herein. Nur so lässt sich das prüfen, ohne auf jedem Gerät
 * dieser Welt nachzusehen; und genau hier liegen die Irrtümer, die man im Betrieb nicht sieht:
 * ein iPad, das sich als Mac ausgibt, ein In-App-Browser, in dem es den Knopf gar nicht gibt.
 */

/** Wie lange ein „Später" hält, bevor das Fenster wieder fragt. */
export const SPAETER_TAGE = 7;

/**
 * Läuft die Seite bereits als installierte App?
 *
 * Zwei Wege, weil kein Browser beide kennt: `display-mode: standalone` ist der Standard, und
 * `navigator.standalone` ist das, was iOS stattdessen gesetzt hat und weiterhin setzt.
 */
export function schonInstalliert({ matchMedia, standalone } = {}) {
  if (standalone === true) return true;
  try {
    return !!(matchMedia && matchMedia('(display-mode: standalone)').matches);
  } catch (e) {
    return false;
  }
}

const IOS_GERAET = /iPad|iPhone|iPod/i;
// Andere Browser auf iOS: dort gibt es „Zum Home-Bildschirm" nicht (Chrome, Firefox, Edge, Opera
// und die Google-App bringen eigene Kürzel im Namen).
const IOS_FREMDER_BROWSER = /CriOS|FxiOS|EdgiOS|OPiOS|GSA/i;
// In-App-Browser: wer den Link aus Instagram oder WhatsApp öffnet, sieht ein Fenster ohne jedes
// Teilen-Menü. Die Anleitung wäre dort nicht nur nutzlos, sondern verwirrend.
const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|Line\/|Twitter|WhatsApp|Snapchat|TikTok|LinkedInApp|Pinterest/i;

/**
 * Welches Gerät und welcher Browser — in genau den Fällen, die für die Anleitung zählen.
 *
 * @returns {'ios-safari'|'ios-fremd'|'android'|'computer'}
 */
export function geraet({ ua = '', maxTouchPoints = 0, platform = '' } = {}) {
  // Android zuerst, und zwar bevor irgendetwas geraten wird: Diese Kennung ist eindeutig.
  // B&S: Andersherum stand die iPad-Vermutung (unten) davor — und ein Android-Gerät, dessen
  // `platform` nach Mac aussah, bekam die iPhone-Anleitung mit einem Teilen-Symbol, das es
  // dort nicht gibt. Aufgefallen beim Nachstellen im Browser, nicht im Kopf.
  if (/Android/i.test(ua)) return IN_APP.test(ua) ? 'ios-fremd' : 'android';
  // Ein iPad ab iPadOS 13 gibt sich in der Kennung als Mac aus — ohne die Tastpunkte bekäme
  // jeder iPad-Nutzer die Computer-Antwort und nie eine Anleitung, die zu seinem Gerät passt.
  const istIOS = IOS_GERAET.test(ua) || (/Mac/i.test(platform || ua) && maxTouchPoints > 1);
  if (istIOS) return IN_APP.test(ua) || IOS_FREMDER_BROWSER.test(ua) ? 'ios-fremd' : 'ios-safari';
  return 'computer';
}

/**
 * Der gespeicherte Merkzettel — `null`, wenn nie etwas gespeichert wurde.
 * Kaputtes JSON zählt wie nichts: ein Fenster zu viel ist besser als eine Ausnahme beim Start.
 */
export function merkzettelLesen(roh) {
  try {
    const m = JSON.parse(roh);
    if (!m || typeof m !== 'object') return null;
    const status = m.status === 'nie' || m.status === 'spaeter' ? m.status : null;
    return status ? { status, ts: Number.isFinite(m.ts) ? m.ts : 0 } : null;
  } catch (e) {
    return null;
  }
}

/**
 * Soll das Fenster jetzt kommen?
 *
 * Bewusst zurückhaltend: Es erscheint für angemeldete Menschen auf einem Handy, einmal — und
 * danach erst wieder, wenn ein „Später" sieben Tage alt ist. „Nie" heißt nie. Auf dem Computer
 * kommt es gar nicht: Dort ist der Home-Bildschirm kein Ort, an den man etwas legt.
 *
 * @param {object} lage
 * @param {boolean} lage.angemeldet
 * @param {boolean} lage.installiert
 * @param {'ios-safari'|'ios-fremd'|'android'|'computer'} lage.geraet
 * @param {{status: string, ts: number}|null} lage.merkzettel
 * @param {number} lage.jetzt Zeitstempel in Millisekunden
 */
export function sollZeigen({ angemeldet, installiert, geraet: g, merkzettel, jetzt }) {
  if (!angemeldet || installiert) return false;
  if (g === 'computer') return false;
  if (!merkzettel) return true;
  if (merkzettel.status === 'nie') return false;
  return jetzt - merkzettel.ts >= SPAETER_TAGE * 24 * 60 * 60 * 1000;
}

/**
 * Die Schritte, die auf dem Schirm stehen sollen — Text und Symbol pro Schritt.
 *
 * `symbol` benennt eine selbst gezeichnete Form (components/Icon.jsx), kein Bild von Apple oder
 * Google: Ein nachgezeichnetes Teilen-Symbol zeigt, wonach man sucht, ohne fremde Marken
 * mitauszuliefern — die App liegt in einem öffentlichen Repository.
 */
export function schritte(g) {
  if (g === 'ios-safari') return [
    { symbol: 'share', text: 'Auf das Teilen-Symbol tippen — unten in der Leiste, auf dem iPad oben rechts.' },
    { symbol: 'addToHome', text: 'In der Liste nach unten wischen, bis „Zum Home-Bildschirm" kommt.' },
    { symbol: 'check', text: 'Oben rechts auf „Hinzufügen" — fertig.' }
  ];
  if (g === 'android') return [
    { symbol: 'dotsVertical', text: 'Oben rechts auf die drei Punkte tippen.' },
    { symbol: 'addToHome', text: '„App installieren" oder „Zum Startbildschirm hinzufügen" wählen.' },
    { symbol: 'check', text: 'Mit „Installieren" bestätigen — fertig.' }
  ];
  // ios-fremd: Hier hilft keine Anleitung, sondern nur der Hinweis auf den richtigen Browser.
  return [
    { symbol: 'compass', text: 'Diese Seite in Safari öffnen — in Chrome und in Apps wie Instagram gibt es den Knopf nicht.' },
    { symbol: 'share', text: 'Dort unten auf das Teilen-Symbol tippen.' },
    { symbol: 'check', text: '„Zum Home-Bildschirm" wählen und bestätigen.' }
  ];
}
