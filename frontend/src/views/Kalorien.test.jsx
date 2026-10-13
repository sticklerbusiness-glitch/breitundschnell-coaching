// @vitest-environment happy-dom
// B&S: Das Kalorienziel setzt das Mitglied selbst — nicht der Coach (individuelle
// Ernährungsberatung ist in Österreich ein reglementiertes Gewerbe, siehe Kalorien.jsx).
// Hier steht fest: Ohne Ziel lädt die Ansicht zum Festlegen ein statt auf den Coach zu
// verweisen, schlägt keine Zahl vor, schickt das Ziel als PATCH an die Website (deutsche
// Schreibweise „2.800" inklusive) und zeigt den Fehlertext des Servers, wenn der ablehnt.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ toast: null, ziel: null, patch: null }))
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../store/useUI.js', () => ({ useUI: selector => selector({ toast: mocks.toast }) }))

import Kalorien from './Kalorien.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const antwort = (status, daten) => ({ ok: status >= 200 && status < 300, status, json: async () => daten })

let host, root, fetchMock

beforeEach(() => {
  mocks.toast = vi.fn()
  mocks.ziel = null
  mocks.patch = body => antwort(200, { ok: true, ziel: body.ziel })
  fetchMock = vi.fn(async (url, opts = {}) => {
    if (opts.method === 'PATCH') return mocks.patch(JSON.parse(opts.body))
    return antwort(200, { heute: '2026-10-13', ziel: mocks.ziel, eintraege: [] })
  })
  vi.stubGlobal('fetch', fetchMock)
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
})

const mount = async () => { await act(async () => { root.render(<Kalorien />) }) }
const knopf = text => [...host.querySelectorAll('button')].find(b => b.textContent.includes(text))
const klick = async el => { await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) }) }
const zielFeld = () => host.querySelector('input[aria-label="Tagesziel in kcal"]')
const tippe = (el, text) => act(() => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, text)
  el.dispatchEvent(new Event('input', { bubbles: true }))
})
const patches = () => fetchMock.mock.calls.filter(([, o]) => o?.method === 'PATCH')

describe('Kalorien — Tagesziel', () => {
  it('lädt ohne Ziel zum Festlegen ein und verweist nicht auf den Coach', async () => {
    await mount()
    expect(knopf('Ziel festlegen')).toBeTruthy()
    expect(host.textContent).not.toContain('kommt vom Coach')
  })

  it('öffnet ein Zahlenfeld ohne vorgeschlagenen Wert, mit Hinweis auf den Rechner', async () => {
    await mount()
    await klick(knopf('Ziel festlegen'))
    const feld = zielFeld()
    expect(feld).toBeTruthy()
    expect(feld.getAttribute('inputmode')).toBe('numeric')
    expect(feld.value).toBe('')
    expect(feld.getAttribute('placeholder') || '').not.toMatch(/\d/)
    expect(host.textContent).toContain('Dein Ziel legst du selbst fest')
  })

  it.each([['2800', 2800], ['2.800', 2800], ['2 800', 2800], ['2800,4', 2800.4]])(
    'schickt „%s" als PATCH { ziel: %s } und zeigt das gespeicherte Ziel', async (eingabe, erwartet) => {
      mocks.patch = () => antwort(200, { ok: true, ziel: Math.round(erwartet) })
      await mount()
      await klick(knopf('Ziel festlegen'))
      tippe(zielFeld(), eingabe)
      await klick(knopf('Speichern'))

      expect(patches()).toHaveLength(1)
      const [url, opts] = patches()[0]
      expect(url).toBe('/api/kalorien')
      expect(JSON.parse(opts.body)).toEqual({ ziel: erwartet })
      expect(zielFeld()).toBeNull()
      expect(host.textContent).toContain(`${Math.round(erwartet)} kcal`)
      expect(mocks.toast).toHaveBeenCalledWith('Ziel gespeichert.')
    })

  it('zeigt den Fehlertext des Servers und lässt das Feld offen', async () => {
    const fehler = 'Bitte gib ein Tagesziel zwischen 500 und 10.000 kcal ein.'
    mocks.patch = () => antwort(400, { fehler })
    await mount()
    await klick(knopf('Ziel festlegen'))
    tippe(zielFeld(), '120')
    await klick(knopf('Speichern'))

    expect(host.textContent).toContain(fehler)
    expect(zielFeld()).toBeTruthy()
    expect(knopf('Ziel festlegen')).toBeTruthy()
  })

  it('sagt ohne Netz, dass nichts gespeichert ist', async () => {
    mocks.patch = () => { throw new TypeError('Failed to fetch') }
    await mount()
    await klick(knopf('Ziel festlegen'))
    tippe(zielFeld(), '2600')
    await klick(knopf('Speichern'))

    expect(host.textContent).toContain('Keine Verbindung — das Ziel ist nicht gespeichert.')
  })

  it('schickt ein leeres Feld ohne bestehendes Ziel gar nicht erst ab', async () => {
    await mount()
    await klick(knopf('Ziel festlegen'))
    await klick(knopf('Speichern'))

    expect(patches()).toHaveLength(0)
    expect(host.textContent).toContain('Trag zuerst dein Tagesziel ein.')
  })

  it('lässt ein bestehendes Ziel ändern und entfernen', async () => {
    mocks.ziel = 2500
    await mount()
    expect(host.textContent).toContain('2500 kcal')

    await klick(knopf('2500 kcal'))
    expect(zielFeld().value).toBe('2500')

    await klick(knopf('Ziel entfernen'))
    expect(JSON.parse(patches()[0][1].body)).toEqual({ ziel: null })
    expect(knopf('Ziel festlegen')).toBeTruthy()
    expect(mocks.toast).toHaveBeenCalledWith('Ziel entfernt.')
  })

  it('Abbrechen schließt das Feld, ohne etwas zu schicken', async () => {
    await mount()
    await klick(knopf('Ziel festlegen'))
    tippe(zielFeld(), '3000')
    await klick(knopf('Abbrechen'))

    expect(zielFeld()).toBeNull()
    expect(patches()).toHaveLength(0)
  })
})
