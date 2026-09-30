/* Breit & Schnell Trainings-App — service worker — die Hülle und ALLE Dateien des Builds
   liegen nach dem Install im Cache; die Hülle bleibt network-first, die gehashten Dateien
   sind cache-first (B&S: ihre URL trägt den Inhalts-Hash, eine Kopie im Cache ist also nie
   veraltet). Eine vom Home-Bildschirm ohne Netz geöffnete App kommt von hier mit demselben
   Bundle zurück, das sie zuletzt gefahren hat; der Zustand selbst liegt in localStorage.
   Die Übungsbilder und -animationen kommen vom CDN (cross-origin) und werden hier NICHT
   angefasst — ohne Netz bleiben sie leer, der Plan und alle Texte sind da.
   `CACHE` trägt den Build-Hash (vite.config.js setzt ihn ein), jeder Deploy ist also ein
   neuer Worker mit eigenem Cache; beim activate fliegen nur die Caches der VORHERIGEN Builds
   dieser App raus (Präfix), nie die einer anderen App auf derselben Domain. */
const PRAEFIX = 'bs-training-'
const CACHE = PRAEFIX + '__BUILD__'

// B&S: Der eigene Bereich, abgeleitet aus dem Ort des Workers — '/training/' und '/training'.
// So bleibt es richtig, egal unter welcher Base die App liegt, und eine Seite der Website wie
// /trainingsplan fällt heraus (der erlaubte Scope '/training' ist ein reiner Zeichenketten-
// Vergleich, würde sie also mitnehmen).
const BEREICH = new URL('./', self.location).pathname
const WURZEL = BEREICH.length > 1 ? BEREICH.replace(/\/+$/, '') : BEREICH
const ASSETS = BEREICH + 'assets/'

// Was die Hülle ohne Netz zum Starten braucht: index.html plus JEDE Datei des Builds. Die
// Liste kommt aus dem Build selbst (vite.config.js ersetzt `__ASSETS__` im closeBundle),
// nicht mehr aus den src=/href=-Verweisen der gebauten index.html: dort stehen nur der
// Eintritts-Chunk und das CSS. Die deutschen Pakete (Oberfläche, Übungsnamen,
// Ausführungshinweise) sind eigene, nachgeladene Chunks — ohne sie fällt i18n.js offline
// still auf ein leeres Wörterbuch zurück und das Mitglied steht im Gym vor einer englischen
// Oberfläche mit englischen Übungsnamen.
const PRECACHE = '__ASSETS__'.split(',').filter(Boolean)

async function precache() {
  const c = await caches.open(CACHE)
  // Die Hülle zuerst und immer frisch: sie ist der Einstieg für den Offline-Fallback.
  try {
    const res = await fetch('index.html', { cache: 'no-cache' })
    if (res.ok) {
      const html = await res.text()
      await c.put('index.html', new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } }))
    }
  } catch (e) { /* kein Netz für die Hülle — die Dateien unten trotzdem versuchen */ }
  // Einzeln mit eigenem catch statt addAll(): eine Datei, die gerade nicht durchkommt,
  // darf nicht den ganzen Vorab-Cache verwerfen.
  await Promise.all(PRECACHE.map(u => c.add(u).catch(() => {})))
}

self.addEventListener('install', e => {
  e.waitUntil(precache().catch(() => {}).then(() => self.skipWaiting()))
})
self.addEventListener('activate', e => {
  // Nur die eigenen Caches: `caches.keys()` gilt für die ganze Origin, und die Website liegt
  // auf derselben Domain (Rewrite /training/*). Ohne den Präfix-Filter löscht ein Deploy der
  // Trainings-App den Precache der Website mit.
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k.startsWith(PRAEFIX) && k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()))
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(clients => {
    const c = clients.find(c => 'focus' in c)
    return c ? c.focus() : self.clients.openWindow('./')
  }))
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin) return
  // B&S: Nur der eigene Bereich. Der Header `Service-Worker-Allowed: /training` erlaubt einen
  // Scope, den der Browser als Zeichenketten-Präfix behandelt — eine künftige Seite der
  // Website unter /trainingsplan läge darin. Hier wird auf Pfadsegmente geprüft.
  if (url.pathname !== WURZEL && !url.pathname.startsWith(BEREICH)) return
  // B&S: the app is served under /training/, so its API is /training/api/* — matched
  // anywhere in the path rather than only at the root, or every data request would be
  // network-first CACHED and an offline reload would replay a stale session.
  if (url.pathname.includes('/api/')) return    // never cache auth/data

  // B&S: Dateien unter assets/ tragen den Inhalts-Hash im Namen und ändern sich unter
  // derselben URL nie — deshalb cache-first statt network-first. Network-first hieß: im
  // Keller mit einem Balken LTE hängt fetch() für 1,5 MB Javascript, der .catch()-Zweig
  // greift nie (die Verbindung bricht ja nicht ab), und das Mitglied sieht einen weißen
  // Bildschirm, obwohl eine byte-gleiche Kopie im Cache liegt. Ein neuer Build hat neue
  // Namen und einen neuen Cache-Namen; der alte Cache fliegt beim activate raus.
  if (url.pathname.startsWith(ASSETS)) {
    e.respondWith(caches.open(CACHE).then(c => c.match(e.request).then(hit =>
      hit || fetch(e.request).then(res => { if (res.ok) c.put(e.request, res.clone()); return res })
    )))
    return
  }
  // Network first; the copy for the cache is cloned before the response is handed to the page —
  // cloning later, once the page has started reading the body, throws and caches nothing, which
  // is why the shell never used to survive an offline reload.
  e.respondWith(fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {}) }
    return res
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(hit =>
    hit || (e.request.mode === 'navigate' ? caches.match('index.html') : undefined)
  )))
})
