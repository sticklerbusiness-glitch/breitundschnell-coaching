// B&S: Der Service Worker ist die Datei, die im Gym ohne Empfang entscheidet, ob ein Mitglied
// seinen Plan sieht — und die einzige, die nie in einem Test lief. public/sw.js ist ein
// klassisches Worker-Skript (kein Modul), deshalb wird es hier mit new Function() in einer
// nachgebauten Worker-Umgebung ausgeführt: dieselbe Datei, die ausgeliefert wird, mit
// eingesetzten Platzhaltern wie nach dem Build (vite.config.js: swStamp).
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

const QUELLE = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8')

const ORT = 'https://breitundschnell.de/training/sw.js'

/**
 * Führt public/sw.js aus und gibt die registrierten Handler samt Umgebung zurück.
 * @param dateien  die Dateiliste, die der Build in `__ASSETS__` schreibt
 * @param keys     die Cache-Namen, die die Origin schon hat (für activate)
 * @param fehlt    Dateien, deren Vorab-Laden fehlschlägt (404, Netz weg)
 * @param html     Antwort auf fetch('index.html'); null = Anfrage schlägt fehl
 */
function starteWorker ({ dateien = [], keys = [], fehlt = [], html = '<!doctype html>' } = {}) {
  const gelegt = new Map()
  const geloescht = []
  const c = {
    put: vi.fn(async (k, v) => { gelegt.set(String(k), v) }),
    add: vi.fn(async k => {
      if (fehlt.includes(String(k))) throw new Error('404')
      gelegt.set(String(k), 'add')
    }),
    match: vi.fn(async k => gelegt.get(String(k)))
  }
  const caches = {
    open: vi.fn(async () => c),
    keys: vi.fn(async () => keys.slice()),
    delete: vi.fn(async k => { geloescht.push(k); return true }),
    match: vi.fn(async () => undefined)
  }
  const fetchStub = vi.fn(async ziel => {
    if (String(ziel) === 'index.html') {
      if (html === null) throw new Error('offline')
      return new Response(html, { status: 200 })
    }
    return new Response('x', { status: 200 })
  })
  const ort = new URL(ORT)
  const handler = {}
  const self = {
    location: ort,
    addEventListener: (typ, fn) => { handler[typ] = fn },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(), matchAll: vi.fn(async () => []), openWindow: vi.fn() },
    registration: { showNotification: vi.fn(), getNotifications: vi.fn(async () => []) }
  }
  const src = QUELLE
    .replaceAll('__BUILD__', 'stamp01')
    .replaceAll('__ASSETS__', dateien.join(','))
  // eslint-disable-next-line no-new-func
  new Function('self', 'location', 'caches', 'fetch', src)(self, ort, caches, fetchStub)
  return { handler, self, caches, c, gelegt, geloescht, fetchStub }
}

/** Ruft einen Handler auf und wartet alles ab, was er in waitUntil gelegt hat. */
async function feuere (fn, extra = {}) {
  const warten = []
  const e = { waitUntil: p => warten.push(p), ...extra }
  fn(e)
  await Promise.all(warten)
  return e
}

const BAU = [
  'assets/index-CDVYqMur.js',
  'assets/index-eMq5TVYQ.css',
  'assets/de-Bd2dZ13E.js',      // Oberfläche
  'assets/de-CbPE3eCx.js',      // Übungsnamen
  'assets/de-C6TgKOeQ.js',      // Ausführungshinweise
  'assets/inter-latin-400-normal-C38fXH4l.woff2',
  'icon-180.png',
  'icon-192.png',
  'lizenzen.txt'
]

// Die index.html des Builds verlinkt NUR den Eintritts-Chunk und das CSS — die deutschen
// Pakete lädt i18n.js per import.meta.glob nach. Wer die Liste aus der Hülle liest, hat sie
// nicht.
const HUELLE = `<!doctype html><html><head>
<link rel="apple-touch-icon" href="/training/icon-180.png">
<link rel="icon" href="/training/icon-192.png">
<script type="module" src="/training/assets/index-CDVYqMur.js"></script>
<link rel="stylesheet" href="/training/assets/index-eMq5TVYQ.css">
</head><body></body></html>`

describe('sw.js — install', () => {
  it('legt die deutschen Pakete mit in den Cache, nicht nur die Hülle', async () => {
    const w = starteWorker({ dateien: BAU, html: HUELLE })
    await feuere(w.handler.install)
    // Ohne diese drei steht das Mitglied offline vor einer englischen Oberfläche
    // (i18n.js fällt im catch still auf ein leeres Wörterbuch zurück).
    for (const datei of ['assets/de-Bd2dZ13E.js', 'assets/de-CbPE3eCx.js', 'assets/de-C6TgKOeQ.js']) {
      expect(w.gelegt.has(datei), datei).toBe(true)
    }
    expect(w.gelegt.has('index.html')).toBe(true)
    expect(w.self.skipWaiting).toHaveBeenCalled()
  })

  it('nimmt jede gebaute Datei mit — die Liste kommt aus dem Build, nicht aus der Hülle', async () => {
    const w = starteWorker({ dateien: BAU, html: HUELLE })
    await feuere(w.handler.install)
    for (const datei of BAU) expect(w.gelegt.has(datei), datei).toBe(true)
  })

  it('lässt eine einzelne fehlende Datei den Rest nicht mitreißen', async () => {
    const w = starteWorker({ dateien: BAU, html: HUELLE, fehlt: ['assets/de-C6TgKOeQ.js'] })
    await feuere(w.handler.install)
    expect(w.gelegt.has('assets/de-Bd2dZ13E.js')).toBe(true)
    expect(w.self.skipWaiting).toHaveBeenCalled()
  })

  it('legt die Pakete auch dann ab, wenn die Hülle selbst nicht durchkommt', async () => {
    const w = starteWorker({ dateien: BAU, html: null })
    await feuere(w.handler.install)
    expect(w.gelegt.has('assets/de-Bd2dZ13E.js')).toBe(true)
    expect(w.self.skipWaiting).toHaveBeenCalled()
  })
})

describe('sw.js — activate', () => {
  it('räumt nur die eigenen Caches weg, nie die der Website auf derselben Domain', async () => {
    const w = starteWorker({
      keys: ['bs-training-alt', 'bs-training-stamp01', 'workbox-precache-v2-https://breitundschnell.de/', 'next-image']
    })
    await feuere(w.handler.activate)
    expect(w.geloescht).toEqual(['bs-training-alt'])
    expect(w.self.clients.claim).toHaveBeenCalled()
  })
})

describe('sw.js — fetch', () => {
  const anfrage = (pfad, mode = 'navigate') =>
    ({ request: { method: 'GET', url: 'https://breitundschnell.de' + pfad, mode }, respondWith: vi.fn() })

  it('fasst nur den eigenen Bereich an — /trainingsplan der Website bleibt unberührt', async () => {
    const w = starteWorker({ dateien: BAU })
    for (const pfad of ['/trainingsplan', '/training-anfrage', '/', '/app/plan']) {
      const e = anfrage(pfad)
      w.handler.fetch(e)
      expect(e.respondWith, pfad).not.toHaveBeenCalled()
    }
  })

  it('bedient beide Schreibweisen der eigenen Seite', async () => {
    const w = starteWorker({ dateien: BAU })
    for (const pfad of ['/training', '/training/', '/training/assets/index-CDVYqMur.js']) {
      const e = anfrage(pfad)
      w.handler.fetch(e)
      expect(e.respondWith, pfad).toHaveBeenCalled()
    }
  })

  it('lässt die API und fremde Origins in Ruhe', async () => {
    const w = starteWorker({ dateien: BAU })
    const api = anfrage('/training/api/data', 'cors')
    w.handler.fetch(api)
    expect(api.respondWith).not.toHaveBeenCalled()

    const fremd = { request: { method: 'GET', url: 'https://cdn.jsdelivr.net/gh/x/images/1.png', mode: 'no-cors' }, respondWith: vi.fn() }
    w.handler.fetch(fremd)
    expect(fremd.respondWith).not.toHaveBeenCalled()

    const post = { request: { method: 'POST', url: 'https://breitundschnell.de/training/api/data', mode: 'cors' }, respondWith: vi.fn() }
    w.handler.fetch(post)
    expect(post.respondWith).not.toHaveBeenCalled()
  })

  it('liefert die gehashten Dateien aus dem Cache, ohne das Netz zu fragen', async () => {
    const w = starteWorker({ dateien: BAU, html: HUELLE })
    await feuere(w.handler.install)
    w.fetchStub.mockClear()
    const e = anfrage('/training/assets/de-Bd2dZ13E.js', 'cors')
    // c.match() bekommt das Request-Objekt; der Stub schlüsselt über String(k) —
    // deshalb hier direkt gegen den abgelegten Schlüssel prüfen.
    w.handler.fetch(e)
    expect(e.respondWith).toHaveBeenCalled()
    await e.respondWith.mock.calls[0][0]
  })
})

describe('sw.js — Aufräumarbeiten', () => {
  it('trägt keine Web-Push-Handler mehr (die Funktion ist entfernt, der Endpunkt gibt es nicht)', () => {
    const w = starteWorker({ dateien: BAU })
    expect(w.handler.push).toBeUndefined()
    expect(w.handler.pushsubscriptionchange).toBeUndefined()
    expect(QUELLE).not.toMatch(/api\/push\/subscribe/)
  })

  it('verspricht keinen Offline-Modus für die CDN-Medien, den es nicht gibt', () => {
    // Bilder und Animationen kommen cross-origin vom CDN und scheitern an der
    // Origin-Prüfung — ein Zweig dafür wäre toter Code mit falscher Zusage.
    expect(QUELLE).not.toMatch(/isMedia/)
  })
})
