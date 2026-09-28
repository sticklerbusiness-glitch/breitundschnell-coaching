// B&S: Der Stempel im Service Worker ist das, was einen neuen Build von einem alten Cache
// trennt. Vorher hing er an einem festen './dist/training/' und übersprang sich selbst still,
// sobald jemand mit --outDir gebaut hat. Hier steht fest: er folgt der Konfiguration, und wenn
// er nicht stempeln kann, bricht der Build ab, statt das Falsche auszuliefern.
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { swStamp } from './vite.config.js'

const ordner = []
afterEach(() => { while (ordner.length) rmSync(ordner.pop(), { recursive: true, force: true }) })

function build(dateien) {
  const dir = mkdtempSync(join(tmpdir(), 'bs-swstamp-'))
  ordner.push(dir)
  for (const [name, inhalt] of Object.entries(dateien)) writeFileSync(join(dir, name), inhalt)
  return dir
}

const WORKER = "const CACHE = 'bs-training-__BUILD__'\nself.addEventListener('install', () => {})\n"

function stempeln(dir, { root = '/woanders', outDir = dir } = {}) {
  const plugin = swStamp()
  plugin.configResolved({ root, build: { outDir } })
  plugin.closeBundle()
  return readFileSync(join(dir, 'sw.js'), 'utf8')
}

describe('sw-stamp', () => {
  it('stempelt in dem Ordner, den die aufgelöste Konfiguration nennt (auch bei --outDir)', () => {
    const dir = build({ 'index.html': '<html>eins</html>', 'sw.js': WORKER })
    expect(stempeln(dir)).toMatch(/const CACHE = 'bs-training-[0-9a-f]{10}'/)
  })

  it('löst einen relativen outDir gegen die root auf', () => {
    const root = mkdtempSync(join(tmpdir(), 'bs-root-'))
    ordner.push(root)
    mkdirSync(join(root, 'dist', 'training'), { recursive: true })
    writeFileSync(join(root, 'dist/training/index.html'), '<html>zwei</html>')
    writeFileSync(join(root, 'dist/training/sw.js'), WORKER)
    const inhalt = stempeln(join(root, 'dist/training'), { root, outDir: 'dist/training' })
    expect(inhalt).toMatch(/bs-training-[0-9a-f]{10}/)
  })

  it('gibt jedem Build einen eigenen Cache-Namen — sonst räumt activate nie auf', () => {
    const a = stempeln(build({ 'index.html': '<html>a</html>', 'sw.js': WORKER }))
    const b = stempeln(build({ 'index.html': '<html>b</html>', 'sw.js': WORKER }))
    expect(a).not.toBe(b)
    // gleiche Hülle → gleicher Stempel, der Hash hängt an der index.html
    const c = stempeln(build({ 'index.html': '<html>a</html>', 'sw.js': WORKER }))
    expect(c).toBe(a)
  })

  it('bricht ab, statt einen ungestempelten Worker auszuliefern', () => {
    const dir = build({ 'index.html': '<html>x</html>', 'sw.js': "const CACHE = 'bs-training-fix'\n" })
    expect(() => stempeln(dir)).toThrow(/__BUILD__/)
  })

  it('bricht ab, wenn die gebauten Dateien gar nicht dort liegen', () => {
    const dir = build({ 'index.html': '<html>x</html>' })
    expect(() => stempeln(dir)).toThrow(/sw\.js/)
    const ohneHülle = build({ 'sw.js': WORKER })
    expect(() => stempeln(ohneHülle)).toThrow(/index\.html/)
  })
})
