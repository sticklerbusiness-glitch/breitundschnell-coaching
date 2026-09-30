// B&S: Die *.vercel.app-Adresse des GYM-Projekts liefert dieselbe App ohne Sitzung aus — eine
// tote Zweitkopie mit eigenem Worker und eigenem localStorage. Hier steht fest, dass sie auf die
// echte Domain zurückführt, den Pfad samt ?kunde= mitnimmt, sich für Tests aushängen lässt —
// und dass sie die Previews der WEBSITE in Ruhe lässt: dort kommt /training über denselben
// Rewrite wie live, das ist die einzige Stelle, an der sich die Naht vor dem Livegang prüfen
// lässt.
import { describe, expect, it } from 'vitest'
import { canonicalUrl } from './canonical-host.js'
import { SITE_URL } from './brand.js'

const ort = (hostname, pathname = '/training/', search = '', hash = '') =>
  ({ hostname, pathname, search, hash })

describe('canonicalUrl', () => {
  it('holt die Zweitkopie unter der Adresse des Gym-Projekts auf die echte Domain zurück', () => {
    expect(canonicalUrl(ort('breitundschnell-coaching.vercel.app')))
      .toBe(`${SITE_URL}/training/`)
  })

  it('nimmt Pfad, Query und Fragment mit — der Coach-Link bleibt heil', () => {
    expect(canonicalUrl(ort('breitundschnell-coaching-git-main-bs.vercel.app', '/training/', '?kunde=u1', '#/plan')))
      .toBe(`${SITE_URL}/training/?kunde=u1#/plan`)
  })

  it('lässt die echte Domain und localhost in Ruhe', () => {
    expect(canonicalUrl(ort('breitundschnell.de'))).toBe(null)
    expect(canonicalUrl(ort('www.breitundschnell.de'))).toBe(null)
    expect(canonicalUrl(ort('localhost'))).toBe(null)
    expect(canonicalUrl(null)).toBe(null)
  })

  it('lässt die Previews der WEBSITE in Ruhe — dort wird /training geprüft', () => {
    // Die Website liefert /training per Rewrite aus dem Gym-Projekt aus; eine Umleitung von
    // hier aus hieße: man prüft unbemerkt die Produktion statt der Preview.
    expect(canonicalUrl(ort('breitundschnell-website.vercel.app'))).toBe(null)
    expect(canonicalUrl(ort('breitundschnell-website-git-abc123-bs.vercel.app'))).toBe(null)
    expect(canonicalUrl(ort('irgendwas-abc123.vercel.app'))).toBe(null)
  })

  it('fällt nicht auf einen Host herein, der nur so tut', () => {
    expect(canonicalUrl(ort('vercel.app.beispiel.de'))).toBe(null)
    expect(canonicalUrl(ort('breitundschnell-coaching.vercel.app.beispiel.de'))).toBe(null)
    expect(canonicalUrl(ort('nicht-breitundschnell-coaching.vercel.app'))).toBe(null)
  })

  it('?direkt=1 hängt die Umleitung aus, damit ein Deployment direkt prüfbar bleibt', () => {
    expect(canonicalUrl(ort('breitundschnell-coaching.vercel.app', '/training/', '?direkt=1'))).toBe(null)
  })

  it('merkt sich ?direkt=1 für die Sitzung — sonst hält die Escape-Hatch genau einen Aufruf', () => {
    // useStore räumt `kunde` aus der Adresse, der Hash-Router schreibt sie ohnehin laufend um:
    // nach dem ersten Reload wäre `direkt` weg und der Prüfende stünde auf der Produktion.
    const merk = new Map()
    const speicher = {
      getItem: k => (merk.has(k) ? merk.get(k) : null),
      setItem: (k, v) => merk.set(k, String(v))
    }
    expect(canonicalUrl(ort('breitundschnell-coaching.vercel.app', '/training/', '?direkt=1'), speicher)).toBe(null)
    expect(canonicalUrl(ort('breitundschnell-coaching.vercel.app', '/training/', ''), speicher)).toBe(null)
  })

  it('überlebt einen Speicher, der wirft (privates Fenster)', () => {
    const kaputt = { getItem () { throw new Error('nope') }, setItem () { throw new Error('nope') } }
    expect(canonicalUrl(ort('breitundschnell-coaching.vercel.app', '/training/', '?direkt=1'), kaputt)).toBe(null)
    expect(canonicalUrl(ort('breitundschnell-coaching.vercel.app'), kaputt)).toBe(`${SITE_URL}/training/`)
  })
})
