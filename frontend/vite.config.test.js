// B&S: Der Stempel im Service Worker ist das, was einen neuen Build von einem alten Cache
// trennt. Vorher hing er an einem festen './dist/training/' und übersprang sich selbst still,
// sobald jemand mit --outDir gebaut hat. Hier steht fest: er folgt der Konfiguration, und wenn
// er nicht stempeln kann, bricht der Build ab, statt das Falsche auszuliefern.
// Dazu die zweite Hälfte: die Liste der gebauten Dateien, die der Worker vorab lädt. Sie lässt
// sich aus der gebauten index.html NICHT lesen (dort stehen nur Eintritts-Chunk und CSS), also
// kommt sie von hier — fehlt sie, steht ein Mitglied offline vor einer englischen Oberfläche.
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { swStamp } from './vite.config.js'

const ordner = []
afterEach(() => { while (ordner.length) rmSync(ordner.pop(), { recursive: true, force: true }) })

function build(dateien) {
  const dir = mkdtempSync(join(tmpdir(), 'bs-swstamp-'))
  ordner.push(dir)
  for (const [name, inhalt] of Object.entries(dateien)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true })
    writeFileSync(join(dir, name), inhalt)
  }
  return dir
}

const WORKER = "const CACHE = 'bs-training-__BUILD__'\n"
  + "const PRECACHE = '__ASSETS__'.split(',').filter(Boolean)\n"
  + "self.addEventListener('install', () => {})\n"

// Ein Build, wie ihn Vite hinlegt: Hülle, Worker, gehashte Dateien, dazu die ungehashten aus
// public/.
const BAU = {
  'index.html': '<html>eins</html>',
  'sw.js': WORKER,
  'assets/index-abc123.js': 'x',
  'assets/de-def456.js': 'y',
  'assets/index-ghi789.css': 'z',
  'icon-192.png': 'p',
  'lizenzen.txt': 'l'
}

function stempeln(dir, { root = '/woanders', outDir = dir } = {}) {
  const plugin = swStamp()
  plugin.configResolved({ root, build: { outDir } })
  plugin.closeBundle()
  return readFileSync(join(dir, 'sw.js'), 'utf8')
}

const precacheListe = inhalt => inhalt.match(/const PRECACHE = '([^']*)'/)[1].split(',').filter(Boolean)

describe('sw-stamp', () => {
  it('stempelt in dem Ordner, den die aufgelöste Konfiguration nennt (auch bei --outDir)', () => {
    expect(stempeln(build(BAU))).toMatch(/const CACHE = 'bs-training-[0-9a-f]{10}'/)
  })

  it('löst einen relativen outDir gegen die root auf', () => {
    const root = mkdtempSync(join(tmpdir(), 'bs-root-'))
    ordner.push(root)
    mkdirSync(join(root, 'dist', 'training', 'assets'), { recursive: true })
    writeFileSync(join(root, 'dist/training/index.html'), '<html>zwei</html>')
    writeFileSync(join(root, 'dist/training/sw.js'), WORKER)
    writeFileSync(join(root, 'dist/training/assets/index-abc123.js'), 'x')
    const inhalt = stempeln(join(root, 'dist/training'), { root, outDir: 'dist/training' })
    expect(inhalt).toMatch(/bs-training-[0-9a-f]{10}/)
  })

  it('gibt jedem Build einen eigenen Cache-Namen — sonst räumt activate nie auf', () => {
    const a = stempeln(build(BAU))
    const b = stempeln(build({ ...BAU, 'index.html': '<html>zwei</html>' }))
    expect(a).not.toBe(b)
    // gleiche Hülle → gleicher Stempel, der Hash hängt an der index.html
    const c = stempeln(build(BAU))
    expect(c).toBe(a)
  })

  it('schreibt jede gebaute Datei in die Precache-Liste — auch die nachgeladenen Chunks', () => {
    const liste = precacheListe(stempeln(build(BAU)))
    // Genau diese Datei verlinkt die index.html NICHT; ohne sie ist die App offline englisch.
    expect(liste).toContain('assets/de-def456.js')
    expect(liste.sort()).toEqual([
      'assets/de-def456.js', 'assets/index-abc123.js', 'assets/index-ghi789.css',
      'icon-192.png', 'lizenzen.txt'
    ])
    // Die Hülle legt der Worker selbst ab (network-first), sich selbst nie.
    expect(liste).not.toContain('index.html')
    expect(liste).not.toContain('sw.js')
  })

  it('bricht ab, statt einen ungestempelten Worker auszuliefern', () => {
    const dir = build({ ...BAU, 'sw.js': "const CACHE = 'bs-training-fix'\n" })
    expect(() => stempeln(dir)).toThrow(/__BUILD__/)
  })

  it('bricht ab, wenn der Platzhalter für die Dateiliste fehlt', () => {
    const dir = build({ ...BAU, 'sw.js': "const CACHE = 'bs-training-__BUILD__'\n" })
    expect(() => stempeln(dir)).toThrow(/__ASSETS__/)
  })

  it('bricht ab, wenn im Build keine einzige .js-Datei liegt', () => {
    const dir = build({ 'index.html': '<html>x</html>', 'sw.js': WORKER, 'icon-192.png': 'p' })
    expect(() => stempeln(dir)).toThrow(/\.js-Datei/)
  })

  it('bricht ab bei einem Dateinamen, der die kommagetrennte Liste zerreißen würde', () => {
    const dir = build({ ...BAU, 'lies,mich.txt': 'x' })
    expect(() => stempeln(dir)).toThrow(/Komma/)
  })

  it('bricht ab, wenn die gebauten Dateien gar nicht dort liegen', () => {
    const dir = build({ 'index.html': '<html>x</html>' })
    expect(() => stempeln(dir)).toThrow(/sw\.js/)
    const ohneHülle = build({ 'sw.js': WORKER })
    expect(() => stempeln(ohneHülle)).toThrow(/index\.html/)
  })
})
