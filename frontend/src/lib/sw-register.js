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
// Kommt der Header nicht an, schlägt die Registrierung fehl — dann wird mit dem
// Standardbereich registriert, damit wenigstens der Zustand von vorher gilt (die App läuft
// dann ohne Offline-Modus weiter; der Abnahmetest dafür steht in der README unter „Deploy").

// '/training/' → '/training'; '/' bleibt '/'.
export function swScope(base) {
  const b = String(base || '/')
  return b.length > 1 ? b.replace(/\/+$/, '') : b
}

export async function registerServiceWorker(nav, base) {
  if (!nav || !nav.serviceWorker) return null
  const url = (base || '/') + 'sw.js'
  try {
    return await nav.serviceWorker.register(url, { scope: swScope(base) })
  } catch (e) {
    try { return await nav.serviceWorker.register(url) } catch (e2) { return null }
  }
}
