// B&S: Die *.vercel.app-Adresse des Gym-Projekts liefert dieselbe App ohne Sitzung aus — eine
// tote Zweitkopie mit eigenem Worker und eigenem localStorage. Hier steht fest, dass sie auf die
// echte Domain zurückführt, den Pfad samt ?kunde= mitnimmt und sich für Tests aushängen lässt.
import { describe, expect, it } from 'vitest'
import { canonicalUrl } from './canonical-host.js'
import { SITE_URL } from './brand.js'

const ort = (hostname, pathname = '/training/', search = '', hash = '') =>
  ({ hostname, pathname, search, hash })

describe('canonicalUrl', () => {
  it('holt die Zweitkopie unter *.vercel.app auf die echte Domain zurück', () => {
    expect(canonicalUrl(ort('breitundschnell-coaching.vercel.app')))
      .toBe(`${SITE_URL}/training/`)
  })

  it('nimmt Pfad, Query und Fragment mit — der Coach-Link bleibt heil', () => {
    expect(canonicalUrl(ort('irgendwas-abc123.vercel.app', '/training/', '?kunde=u1', '#/plan')))
      .toBe(`${SITE_URL}/training/?kunde=u1#/plan`)
  })

  it('lässt die echte Domain und localhost in Ruhe', () => {
    expect(canonicalUrl(ort('breitundschnell.de'))).toBe(null)
    expect(canonicalUrl(ort('www.breitundschnell.de'))).toBe(null)
    expect(canonicalUrl(ort('localhost'))).toBe(null)
    expect(canonicalUrl(null)).toBe(null)
  })

  it('fällt nicht auf einen Host herein, der nur so tut', () => {
    expect(canonicalUrl(ort('vercel.app.beispiel.de'))).toBe(null)
  })

  it('?direkt=1 hängt die Umleitung aus, damit ein Deployment direkt prüfbar bleibt', () => {
    expect(canonicalUrl(ort('breitundschnell-coaching.vercel.app', '/training/', '?direkt=1'))).toBe(null)
  })
})
