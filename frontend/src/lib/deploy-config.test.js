// B&S: Die Auslieferung ist Teil des Produkts — diese Regeln sind sonst nirgends geprüft, und
// falsch sind sie still: ein Header, der auf einen Pfad zeigt, den niemand anfragt, fällt erst
// im Betrieb auf. Geprüft wird deshalb gegen die URLs, die wirklich entstehen (Vite-Base
// /training/, die gebaute index.html) statt gegen die Schreibweise in der Konfiguration.
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { swScope } from './sw-register.js'
import { youtubeEmbed } from './youtube.js'

const BASE = '/training/'            // vite.config.js
const wurzel = new URL('../../../', import.meta.url)          // gym-app/
const vercel = JSON.parse(readFileSync(new URL('vercel.json', wurzel), 'utf8'))
const viteConfig = readFileSync(new URL('frontend/vite.config.js', wurzel), 'utf8')
const indexHtml = readFileSync(new URL('frontend/index.html', wurzel), 'utf8')
const hevySrc = readFileSync(new URL('./import-hevy.js', import.meta.url), 'utf8')

// Vercels `source` ist path-to-regexp; hier kommen nur wörtliche Pfade und (.*) vor.
function zuRegex(source) {
  const teile = source.split('(.*)').map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp('^' + teile.join('(.*)') + '$')
}

// Alle passenden Regeln in Reihenfolge übereinandergelegt — bei gleichem Schlüssel gewinnt die
// letzte, genau wie bei Vercel und Next.
function headerFür(pfad) {
  const raus = {}
  for (const regel of vercel.headers) {
    if (!zuRegex(regel.source).test(pfad)) continue
    for (const h of regel.headers) raus[h.key] = h.value
  }
  return raus
}

function csp(pfad) {
  const raus = {}
  for (const teil of (headerFür(pfad)['Content-Security-Policy'] || '').split(';')) {
    const [name, ...werte] = teil.trim().split(/\s+/)
    if (name) raus[name] = werte
  }
  return raus
}

// Die Pfade, die im Betrieb wirklich angefragt werden: die Hülle (mit und ohne Schrägstrich,
// weil Next auf die Fassung ohne umleitet), der Worker und die gehashten Dateien aus dem Build.
const hülle = ['/training', '/training/', '/training/index.html']

describe('vercel.json — Cache', () => {
  it('hält die Hülle unter JEDER Schreibweise aus dem Cache', () => {
    for (const pfad of hülle) {
      expect(headerFür(pfad)['Cache-Control'], pfad).toMatch(/no-store/)
    }
  })

  it('liefert die gehashten Dateien ein Jahr unveränderlich aus', () => {
    const wert = 'public, max-age=31536000, immutable'
    expect(headerFür(`${BASE}assets/index-siMQDTgJ.js`)['Cache-Control']).toBe(wert)
    expect(headerFür(`${BASE}assets/de-C6TgKOeQ.js`)['Cache-Control']).toBe(wert)
    expect(headerFür(`${BASE}assets/inter-latin-400-normal-DxGVaZUe.woff2`)['Cache-Control']).toBe(wert)
  })

  it('trifft damit die Pfade, die die gebaute Hülle wirklich anfragt', () => {
    const gebaut = new URL('frontend/dist/training/index.html', wurzel)
    if (!existsSync(gebaut)) return          // ohne Build nichts zu prüfen
    const refs = [...readFileSync(gebaut, 'utf8').matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1])
    const dateien = refs.filter(u => u.startsWith(`${BASE}assets/`))
    expect(dateien.length).toBeGreaterThan(0)
    for (const u of dateien) {
      expect(headerFür(u)['Cache-Control'], u).toBe('public, max-age=31536000, immutable')
    }
  })

  it('lässt den Worker selbst nie im Cache liegen', () => {
    expect(headerFür(`${BASE}sw.js`)['Cache-Control']).toMatch(/no-store/)
  })
})

describe('vercel.json — Service Worker', () => {
  it('erlaubt dem Worker genau den Bereich, den die App anfragt', () => {
    // sw-register.js registriert mit diesem scope; ohne den Header lehnt der Browser ab.
    expect(headerFür(`${BASE}sw.js`)['Service-Worker-Allowed']).toBe(swScope(BASE))
  })

  it('und der Bereich deckt beide Schreibweisen der Seite ab', () => {
    const bereich = headerFür(`${BASE}sw.js`)['Service-Worker-Allowed']
    for (const pfad of ['/training', '/training/', '/training/irgendwas']) {
      expect(pfad.startsWith(bereich), pfad).toBe(true)
    }
  })
})

// B&S: Das Gym-Projekt darf den Schrägstrich NICHT normalisieren. Vercels Voreinstellung
// (trailingSlash undefined) liefert /training und /training/ beide mit 200 aus — genau das
// braucht der Rewrite, der immer `${GYM_URL}/training/` anfragt. Mit trailingSlash:false
// würde das Gym-Projekt darauf mit 308 → /training antworten; der Proxy reicht die
// Weiterleitung an den Browser durch, der landet wieder auf breitundschnell.de/training,
// der Rewrite fragt wieder /training/ an … — eine Endlosschleife für jedes Mitglied.
// (Vercel-Doku „Project Configuration → trailingSlash": „both /about and /about/ will serve
// the same content without redirecting".)
describe('vercel.json — Schrägstrich', () => {
  it('normalisiert nicht — sonst schleift der Rewrite der Website endlos', () => {
    expect(vercel.trailingSlash).toBeUndefined()
  })
})

describe('vercel.json — Sicherheits-Header', () => {
  it('verbietet das Einbetten in fremde Seiten (Clickjacking auf den Plan-Editor)', () => {
    for (const pfad of [...hülle, `${BASE}assets/index-siMQDTgJ.js`]) {
      expect(headerFür(pfad)['X-Frame-Options'], pfad).toBe('DENY')
      expect(csp(pfad)['frame-ancestors'], pfad).toEqual(["'none'"])
    }
  })

  it('setzt nosniff, Referrer-Policy und noindex', () => {
    const h = headerFür('/training')
    expect(h['X-Content-Type-Options']).toBe('nosniff')
    expect(h['Referrer-Policy']).toBe('same-origin')
    expect(h['X-Robots-Tag']).toMatch(/noindex/)
  })

  it('erlaubt in der CSP genau die Fremd-Hosts, die die App wirklich benutzt', () => {
    const p = csp('/training')
    const medien = new URL(viteConfig.match(/const DATASET = '([^']+)'/)[1]).origin
    const video = new URL(youtubeEmbed('abcdefghijk')).origin
    const hevy = new URL(hevySrc.match(/HEVY_API = '([^']+)'/)[1]).origin

    expect(p['default-src']).toEqual(["'self'"])
    expect(p['img-src']).toContain(medien)
    expect(p['media-src']).toContain(medien)
    expect(p['frame-src']).toEqual([video])
    expect(p['connect-src']).toEqual(["'self'", hevy])
    expect(p['script-src']).toEqual(["'self'"])
    expect(p['style-src']).toContain("'unsafe-inline'")   // Inline-Styles der Komponenten
    expect(p['font-src']).toEqual(["'self'"])             // Schriften liegen im Build
    expect(p['object-src']).toEqual(["'none'"])
  })
})

describe('index.html', () => {
  it('verlinkt die Icons absolut — unter /training ohne Schrägstrich sonst 404', () => {
    const hrefs = [...indexHtml.matchAll(/<link[^>]*rel="(?:apple-touch-)?icon"[^>]*href="([^"]+)"/g)].map(m => m[1])
    expect(hrefs.length).toBe(2)
    for (const h of hrefs) expect(h.startsWith('%BASE_URL%')).toBe(true)
  })
})

describe('website/next.config.ts', () => {
  const next = new URL('../website/next.config.ts', wurzel)

  it('trägt dieselbe CSP wie vercel.json — sonst hängt der Schutz davon ab, wer gewinnt', () => {
    if (!existsSync(next)) return            // Gym-Repo allein ausgecheckt
    const quelle = readFileSync(next, 'utf8')
    const block = quelle.match(/const GYM_CSP =([\s\S]*?);\n/)
    expect(block, 'GYM_CSP in next.config.ts').not.toBe(null)
    const zusammengesetzt = [...block[1].matchAll(/"([^"]*)"/g)].map(m => m[1]).join('')
    expect(zusammengesetzt).toBe(headerFür('/training')['Content-Security-Policy'])
  })

  it('schützt /training auch dann vor dem iframe, wenn der Proxy die Header schluckt', () => {
    if (!existsSync(next)) return
    const quelle = readFileSync(next, 'utf8')
    expect(quelle).toMatch(/key: "X-Frame-Options", value: "DENY"/)
    expect(quelle).toMatch(/source: "\/training"/)
    expect(quelle).toMatch(/source: "\/training\/:path\*"/)
  })

  // B&S: Der einzige Header, der NICHT doppelt stehen darf. Zwei gleiche CSPs sind dieselbe
  // CSP; zwei `Service-Worker-Allowed` könnten als "/training, /training" ankommen — kein
  // gültiger Geltungsbereich mehr, Registrierung schlägt fehl, Worker kontrolliert wieder
  // nichts. Er gehört an die Herkunft, die /training/sw.js ausliefert: vercel.json.
  it('setzt Service-Worker-Allowed NICHT zusätzlich — der Header darf nicht doppelt kommen', () => {
    expect(headerFür(`${BASE}sw.js`)['Service-Worker-Allowed']).toBe('/training')
    if (!existsSync(next)) return
    // nur gesetzt, nicht erwähnt — der Kommentar dort erklärt genau diese Entscheidung
    expect(readFileSync(next, 'utf8')).not.toMatch(/key:\s*"Service-Worker-Allowed"/)
  })

  // Die Umleitung /training/ → /training ist Nexts eigene (trailingSlash:false). Setzt jemand
  // hier trailingSlash oder skipTrailingSlashRedirect, kippt die kanonische Adresse und mit
  // ihr der Geltungsbereich des Workers und die Icon-Pfade — dann muss das hier mit umgezogen
  // werden statt still zu brechen.
  it('lässt Nexts Schrägstrich-Regel unangetastet — sonst stimmt die kanonische Adresse nicht mehr', () => {
    if (!existsSync(next)) return
    const quelle = readFileSync(next, 'utf8')
    expect(quelle).not.toMatch(/^\s*trailingSlash:/m)
    expect(quelle).not.toMatch(/^\s*skipTrailingSlashRedirect:/m)
  })
})
