// B&S: Registrierung des Service Workers — eigenes Modul, weil der Geltungsbereich (scope)
// hier nicht der Standard sein darf und das testbar bleiben muss.
//
// Die App liegt unter der Vite-Base /training/, der Worker also unter /training/sw.js.
// Sein Standard-Geltungsbereich ist damit genau "/training/" — die Seite, die Mitglieder
// tatsächlich bekommen, ist aber "/training" OHNE Schrägstrich: Next steht auf
// trailingSlash:false und leitet /training/ per internem 308 auf /training um, bevor der
// Rewrite greift. "/training" fängt nicht mit "/training/" an, der Worker kontrolliert die
// Seite also nie — er lädt ~2,6 MB in den Cache und ist danach wirkungslos.
//
// Deshalb wird der weitere Bereich "/training" angefragt. Erlaubt wird das nur durch den
// Antwort-Header `Service-Worker-Allowed: /training` auf /training/sw.js. Der steht an genau
// EINER Stelle: gym-app/vercel.json, also an der Herkunft, die die Datei ausliefert.
// B&S: Anders als CSP und X-Frame-Options wird er bewusst NICHT zusätzlich in
// website/next.config.ts gesetzt. Bei doppelten Headern gleichen Namens ist der schlimmste
// Fall dort harmlos (zwei gleiche CSPs sind dieselbe CSP), hier aber nicht: würde der Proxy
// die beiden Werte zu "/training, /training" zusammenhängen, wäre das kein gültiger Scope
// mehr und die Registrierung schlüge fehl — genau der Fehler, den dieser Header verhindern soll.
// Kommt der Header nicht an, verbietet der Browser den weiteren Bereich und wirft eine
// DOMException mit `name: 'SecurityError'` — NUR dann wird ersatzweise mit dem Standardbereich
// registriert. Bei jedem anderen Fehler (Netz weg, 502 vom Proxy, sw.js kaputt) bleibt es beim
// Fehlschlag: sonst hängt nach einem einzigen schlechten WLAN für immer eine zweite,
// ENGE Registrierung an der Origin, die niemand mehr wegräumt und die bei jedem Deploy den
// Precache ein zweites Mal über Mobilfunk lädt.
// Was der Ersatzweg kostet, steht in der README unter „Deploy" — er ist mehr als „kein
// Offline-Modus": die Seite unter /training hat dann gar keinen Controller, und damit fällt
// auch die Pausen-Benachrichtigung aus (store/useUI.js greift auf
// `registration.showNotification` zurück, weil Android Chrome den Notification-Konstruktor
// verbietet).

// '/training/' → '/training'; '/' bleibt '/'.
export function swScope(base) {
  const b = String(base || '/')
  return b.length > 1 ? b.replace(/\/+$/, '') : b
}

// Eine alte Registrierung mit dem ENGEN Standardbereich (aus einem früheren Fehlschlag)
// abmelden, sobald die weite steht. Die weite selbst liefert getRegistration(base) mit —
// ihr Bereich deckt /training/ ab —, deshalb wird auf den Pfad genau verglichen.
async function raeumeEngeAuf(nav, base, weit) {
  try {
    const alt = await nav.serviceWorker.getRegistration?.(base)
    if (!alt || alt === weit || typeof alt.unregister !== 'function') return
    if (new URL(alt.scope).pathname === base) await alt.unregister()
  } catch (e) { /* egal — die weite Registrierung steht */ }
}

export async function registerServiceWorker(nav, base) {
  if (!nav || !nav.serviceWorker) return null
  const url = (base || '/') + 'sw.js'
  try {
    const reg = await nav.serviceWorker.register(url, { scope: swScope(base) })
    // Nur wenn überhaupt erweitert wurde: liegt die App an der Wurzel ('/'), ist der
    // Standardbereich schon der richtige und es gibt keine enge Alt-Registrierung.
    if (base && swScope(base) !== base) await raeumeEngeAuf(nav, base, reg)
    return reg
  } catch (e) {
    if (!e || e.name !== 'SecurityError') return null
    try { return await nav.serviceWorker.register(url) } catch (e2) { return null }
  }
}
