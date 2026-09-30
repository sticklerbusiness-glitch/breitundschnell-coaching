import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import apiDev from './vite-api-dev.js'

// B&S: Die App wohnt unter breitundschnell.de/training/ — die Website liegt auf
// derselben Domain unter / und leitet /training/* per Rewrite hierher. Deshalb
// base '/training/' und ein Build, der schon in dist/training/ landet.
const BASE = '/training/'

// B&S: Die Übungsbilder und -animationen (~140 MB) werden nicht mitdeployt,
// sondern vom CDN des Datensatzes geladen — genau die URLs, die upstream für
// den Handy-Build benutzt (frontend/package.json, build:mobile).
// Gesetzt wird das über process.env und nicht über `define`: lib/exercises.js
// liest `const ENV = import.meta.env` einmal aus und greift danach auf
// ENV.VITE_IMG_BASE zu — eine Textersetzung von "import.meta.env.VITE_IMG_BASE"
// träfe diese Stelle nie. Über process.env landen die Werte in import.meta.env
// selbst, genauso wie bei upstreams build:mobile.
const DATASET = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd/'
process.env.VITE_IMG_BASE = process.env.VITE_IMG_BASE || DATASET + 'images/'
process.env.VITE_GIF_BASE = process.env.VITE_GIF_BASE || DATASET + 'videos/'

// B&S: Jede gebaute Datei außer der Hülle und dem Worker selbst, Pfade relativ zum Worker
// (der liegt neben der index.html). Das ist die Precache-Liste des Service Workers: aus der
// gebauten index.html ließe sie sich nicht lesen, dort stehen nur der Eintritts-Chunk und das
// CSS — die deutschen Sprachpakete sind eigene, nachgeladene Chunks.
function bauDateien(dir, praefix = '') {
  const raus = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const rel = praefix + e.name
    if (e.isDirectory()) raus.push(...bauDateien(resolve(dir, e.name), rel + '/'))
    else if (rel !== 'index.html' && rel !== 'sw.js') raus.push(rel)
  }
  return raus
}

// The service worker's cache is named after the build (public/sw.js carries a `__BUILD__`
// placeholder): a deploy is then a new worker with its own cache, and the previous build's
// shell and chunks are dropped on activate instead of piling up under one fixed name. The
// stamp is a hash of the built index.html — it changes exactly when the bundle does.
// Dazu die Liste der gebauten Dateien in den zweiten Platzhalter `__ASSETS__`: ohne sie
// precacht der Worker nur, was die index.html verlinkt, und ein Mitglied im Keller bekommt
// eine englische Oberfläche, weil die deutschen Pakete offline fehlen.
// B&S: Der Ordner kommt aus der aufgelösten Konfiguration, nicht mehr fest aus
// './dist/training/'. Vorher hat jeder Build mit eigenem --outDir den Stempel
// still übersprungen und einen Worker mit dem Platzhalter ausgeliefert: alle
// Deploys hätten denselben Cache-Namen, `activate` räumt dann nichts mehr weg
// und ein Gerät serviert ewig die Dateien des vorherigen Builds. Deshalb bricht
// der Build jetzt ab, statt still das Falsche zu liefern.
export function swStamp() {
  let ausgabe = null
  return {
    name: 'opengym-sw-stamp',
    apply: 'build',
    configResolved(c) { ausgabe = resolve(c.root || process.cwd(), c.build?.outDir || 'dist') },
    closeBundle() {
      const dir = ausgabe || resolve(process.cwd(), 'dist')
      const html = resolve(dir, 'index.html'), sw = resolve(dir, 'sw.js')
      if (!existsSync(html) || !existsSync(sw)) {
        throw new Error(`sw-stamp: ${existsSync(html) ? 'sw.js' : 'index.html'} fehlt in ${dir} — der Service Worker bliebe ungestempelt.`)
      }
      const roh = readFileSync(sw, 'utf8')
      if (!roh.includes('__BUILD__')) {
        throw new Error(`sw-stamp: Kein Platzhalter __BUILD__ in ${sw} — jeder Deploy bekäme denselben Cache-Namen.`)
      }
      if (!roh.includes('__ASSETS__')) {
        throw new Error(`sw-stamp: Kein Platzhalter __ASSETS__ in ${sw} — der Worker precacht dann nichts und die App wäre offline englisch.`)
      }
      const dateien = bauDateien(dir)
      if (!dateien.some(n => n.endsWith('.js'))) {
        throw new Error(`sw-stamp: Keine einzige .js-Datei unter ${dir} — die Precache-Liste wäre leer.`)
      }
      // Die Liste steht kommagetrennt in sw.js (eine Zeichenkette, kein JSON — so bleibt die
      // Datei auch ungestempelt gültiges Javascript). Namen mit Komma oder Anführungszeichen
      // würden sie zerreißen; Vite vergibt solche nicht, eine Datei aus public/ könnte es.
      const schlecht = dateien.filter(n => /["',\n\r\\]/.test(n))
      if (schlecht.length) {
        throw new Error(`sw-stamp: Dateiname mit Komma oder Anführungszeichen: ${schlecht.join(' | ')} — die Precache-Liste in sw.js ist kommagetrennt.`)
      }
      const stamp = createHash('sha256').update(readFileSync(html)).digest('hex').slice(0, 10)
      writeFileSync(sw, roh.replaceAll('__BUILD__', stamp).replaceAll('__ASSETS__', dateien.join(',')))
    }
  }
}

// The version people are asked for in #install-help and on every bug report. Read from
// package.json so it cannot drift from the release it was built in, and inlined at build
// time so no runtime fetch is involved.
const pkgVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkgVersion) },
  // B&S: Umami-Plugin raus (keine Telemetrie), apiDev rein.
  plugins: [react(), apiDev(), swStamp()],
  base: BASE,
  server: {
    // B&S: Die Handler unter ../api und der geteilte Servercode unter ../lib liegen
    // außerhalb von frontend/ — der Dev-Server muss dorthin lesen dürfen.
    fs: { allow: ['..'] },
    // B&S: Fester Port (strictPort, damit er nicht still wandert): das
    // bs_session-Cookie gilt auf localhost portübergreifend, ein Login auf
    // :3000 meldet also auch hier an. Die upstream-Proxys (/api /img /gif)
    // entfallen — die API läuft als Middleware (vite-api-dev.js), die Medien
    // kommen vom CDN.
    port: 5174,
    strictPort: true
  },
  build: { outDir: 'dist/training', chunkSizeWarningLimit: 1500 }
})
