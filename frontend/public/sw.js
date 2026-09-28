/* Breit & Schnell Trainings-App — service worker — the app shell and its hashed assets are cached at install;
   the shell stays network-first, the hashed assets and the media (img/gif) are cache-first
   (B&S: their URL carries the content hash, so a cached copy is never stale). A home-screen app reopened without a network
   comes back from here with the same bundle it last ran; the state itself lives in localStorage.
   `CACHE` carries the build hash (vite.config.js rewrites it), so every deploy is a new worker
   with its own cache and the previous build's files are dropped on activate. */
const CACHE = 'bs-training-__BUILD__'

// B&S: Der Ordner mit den gebauten Dateien, relativ zum Worker selbst (/training/assets/) —
// so bleibt es richtig, egal unter welcher Base die App liegt.
const ASSETS = new URL('assets/', self.location).pathname

// What the shell needs to boot without a network: index.html plus every script/style/icon it
// references. Read from the served index.html so the list follows the build, not a hand-kept
// manifest that would go stale the first time a chunk is renamed.
async function precache() {
  const c = await caches.open(CACHE)
  const res = await fetch('index.html', { cache: 'no-cache' })
  if (!res.ok) return
  const html = await res.text()
  await c.put('index.html', new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } }))
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1])
    .filter(u => /\.(?:js|css|png|svg|webmanifest|json)(?:\?|$)/.test(u) && !/^(?:https?:)?\/\//.test(u))
  await Promise.all([...new Set(refs)].map(u => c.add(u).catch(() => {})))
}

self.addEventListener('install', e => {
  e.waitUntil(precache().catch(() => {}).then(() => self.skipWaiting()))
})
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()))
})

// The payload is parsed inside waitUntil: a push whose handler throws before showing anything is
// a "silent push", which Chrome counts against the site and eventually revokes. A body that is
// not JSON still shows a notification.
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let data = {}
    try { data = e.data ? e.data.json() : {} } catch { data = { body: (() => { try { return e.data.text() } catch { return '' } })() } }
    // One alert per kind: a new rest-timer push replaces the last one instead of stacking
    // up in the tray (issue #172). `tag` alone should do that, but iOS keeps every one, so
    // the previous notification with the same tag is closed by hand first.
    const tag = data.tag || 'breitundschnell'
    try { for (const n of await self.registration.getNotifications({ tag })) n.close() } catch {}
    await self.registration.showNotification(data.title || 'Breit & Schnell', {
      body: data.body || '',
      icon: 'icon-512.png',
      badge: 'icon-180.png',
      tag,
      renotify: true
    })
  })())
})
self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(clients => {
    const c = clients.find(c => 'focus' in c)
    return c ? c.focus() : self.clients.openWindow('./')
  }))
})
// The push service rotated the subscription (key change, expiry): subscribe again with the same
// server key and tell the server, so the row it holds keeps pointing at this browser.
self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil((async () => {
    const old = e.oldSubscription || (await self.registration.pushManager.getSubscription())
    const key = e.newSubscription?.options?.applicationServerKey || old?.options?.applicationServerKey
    if (!key) return
    const sub = e.newSubscription || await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
    await fetch('api/push/subscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) }).catch(() => {})
  })())
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin) return
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
  const isMedia = url.pathname.includes('/img/') || url.pathname.includes('/gif/')
  if (isMedia || url.pathname.startsWith(ASSETS)) {
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
