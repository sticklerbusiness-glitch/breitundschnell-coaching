import { describe, it, expect } from 'vitest'
import { geraet, merkzettelLesen, schonInstalliert, schritte, sollZeigen, SPAETER_TAGE } from './installation.js'

// Kennungen, wie sie wirklich vorkommen — gekürzt auf das, woran erkannt wird.
const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1',
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 334.0.0.32.102',
  ipadOS: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
}

describe('welches Gerät sitzt da', () => {
  it('erkennt Safari auf dem iPhone', () => {
    expect(geraet({ ua: UA.iphoneSafari })).toBe('ios-safari')
  })

  it('erkennt ein Android-Handy', () => {
    expect(geraet({ ua: UA.androidChrome })).toBe('android')
  })

  it('hält einen Computer für einen Computer', () => {
    expect(geraet({ ua: UA.mac, maxTouchPoints: 0 })).toBe('computer')
  })

  // B&S: Ein iPad ab iPadOS 13 nennt sich selbst Macintosh. Ohne die Tastpunkte-Prüfung
  // bekäme jeder iPad-Nutzer gar keine Anleitung — und das sind genau die Geräte, auf denen
  // man die App am ehesten dauerhaft liegen hat.
  it('erkennt ein iPad, das sich als Mac ausgibt', () => {
    expect(geraet({ ua: UA.ipadOS, maxTouchPoints: 5, platform: 'MacIntel' })).toBe('ios-safari')
    expect(geraet({ ua: UA.mac, maxTouchPoints: 0, platform: 'MacIntel' })).toBe('computer')
  })

  // In Chrome auf dem iPhone und im Fenster aus Instagram gibt es „Zum Home-Bildschirm" nicht.
  // Eine Anleitung, die auf einen Knopf zeigt, den es nicht gibt, ist schlimmer als keine.
  // B&S: Beim Nachstellen im Browser kam ein Android-Gerät heraus, dessen `platform` noch
  // „MacIntel" meldete — die iPad-Vermutung schlug zu und das Handy bekam eine Anleitung für
  // ein Teilen-Symbol, das es unter Android nicht gibt. Die Android-Kennung ist eindeutig und
  // wird deshalb zuerst gefragt.
  it('lässt sich von einer widersprüchlichen Plattform-Angabe nicht täuschen', () => {
    expect(geraet({ ua: UA.androidChrome, maxTouchPoints: 5, platform: 'MacIntel' })).toBe('android')
  })

  it('unterscheidet Safari von allem anderen auf iOS', () => {
    expect(geraet({ ua: UA.iphoneChrome })).toBe('ios-fremd')
    expect(geraet({ ua: UA.instagram })).toBe('ios-fremd')
  })
})

describe('läuft die App schon vom Home-Bildschirm', () => {
  it('glaubt dem iOS-Weg', () => {
    expect(schonInstalliert({ standalone: true })).toBe(true)
  })

  it('glaubt dem Standard-Weg', () => {
    expect(schonInstalliert({ matchMedia: () => ({ matches: true }) })).toBe(true)
    expect(schonInstalliert({ matchMedia: () => ({ matches: false }) })).toBe(false)
  })

  it('sagt nein statt zu werfen, wenn der Browser matchMedia nicht kennt', () => {
    expect(schonInstalliert({})).toBe(false)
    expect(schonInstalliert({ matchMedia: () => { throw new Error('nope') } })).toBe(false)
  })
})

describe('wann das Fenster kommt', () => {
  const lage = (extra = {}) => ({
    angemeldet: true, installiert: false, geraet: 'ios-safari', merkzettel: null, jetzt: 1_000_000_000_000, ...extra
  })

  it('kommt für ein angemeldetes Handy ohne App', () => {
    expect(sollZeigen(lage())).toBe(true)
  })

  it('kommt nicht vor der Anmeldung', () => {
    expect(sollZeigen(lage({ angemeldet: false }))).toBe(false)
  })

  it('kommt nicht, wenn die App schon installiert ist', () => {
    expect(sollZeigen(lage({ installiert: true }))).toBe(false)
  })

  it('kommt auf dem Computer gar nicht', () => {
    expect(sollZeigen(lage({ geraet: 'computer' }))).toBe(false)
  })

  it('schweigt nach „nie" für immer', () => {
    expect(sollZeigen(lage({ merkzettel: { status: 'nie', ts: 0 } }))).toBe(false)
  })

  it('fragt nach einem „Später" erst nach sieben Tagen wieder', () => {
    const jetzt = 1_000_000_000_000
    const frisch = { status: 'spaeter', ts: jetzt - 24 * 60 * 60 * 1000 }
    const alt = { status: 'spaeter', ts: jetzt - (SPAETER_TAGE * 24 + 1) * 60 * 60 * 1000 }
    expect(sollZeigen(lage({ merkzettel: frisch, jetzt }))).toBe(false)
    expect(sollZeigen(lage({ merkzettel: alt, jetzt }))).toBe(true)
  })
})

describe('der Merkzettel', () => {
  it('liest, was gespeichert wurde', () => {
    expect(merkzettelLesen('{"status":"spaeter","ts":42}')).toEqual({ status: 'spaeter', ts: 42 })
  })

  it('wertet Unsinn wie nichts, statt den Start zu sprengen', () => {
    for (const roh of [null, '', 'kaputt', '[]', '{"status":"was-anderes"}', '{"ts":5}']) {
      expect(merkzettelLesen(roh), String(roh)).toBeNull()
    }
  })
})

describe('die Schritte', () => {
  it('nennt für iPhone und Android je drei und unterscheidet sie', () => {
    const ios = schritte('ios-safari')
    const android = schritte('android')
    expect(ios).toHaveLength(3)
    expect(android).toHaveLength(3)
    expect(ios[0].text).not.toEqual(android[0].text)
    expect(ios.map(s => s.symbol)).toContain('share')
    expect(android.map(s => s.symbol)).toContain('dotsVertical')
  })

  it('schickt aus einem fremden Browser zuerst nach Safari', () => {
    expect(schritte('ios-fremd')[0].text).toMatch(/Safari/)
  })
})
