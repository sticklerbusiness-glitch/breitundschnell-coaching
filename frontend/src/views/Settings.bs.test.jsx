// @vitest-environment happy-dom
// B&S: Die Einstellungen sind auf das zusammengestrichen, was ein Mitglied selbst betrifft.
// Alles rund um eine eigene openGym-Instanz (Konto/Passkeys/Pairing, Einladungen, Admin,
// Self-Hosting, APK-Update, KI-Coach, Gym-Check-in, Web-Push, Demo) ist weg, ebenso Sprache,
// Theme und Akzent. Der AGPL-Footer mit dem Quellcode-Link muss dagegen immer stehen.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Settings from './Settings.jsx'
import { SOURCE_URL } from '../lib/brand.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: null }
  state.snapshot = () => ({
    S: state.S,
    update: mut => {
      const next = structuredClone(state.S)
      mut(next)
      state.S = next
    },
    replaceState: vi.fn(),
  })
  return state
})
vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore, DEF: { unit: 'kg', workouts: [], routines: [], week: {} } }
})
vi.mock('../store/useUI.js', () => {
  const snap = () => ({ toast: vi.fn(), openSheet: vi.fn() })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../lib/wakelock.js', () => ({ wakeLockSupported: () => true }))
vi.mock('../sheets.jsx', () => ({
  confirmSheet: vi.fn(), importFromApp: vi.fn(), importFromHevy: vi.fn(),
  equipmentProfileSheet: vi.fn(), menuSheet: vi.fn(),
}))

let host, root
beforeEach(() => {
  mocks.S = {
    unit: 'kg', restSec: 90, restPauseSec: 15, sound: false, effort: 'none',
    gifSize: 'full', workouts: [], routines: [], week: {}, exWeights: {},
  }
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const mount = () => act(() => root.render(<Settings />))
const titles = () => [...host.querySelectorAll('.lrow-t')].map(e => e.textContent)
const sections = () => [...host.querySelectorAll('.sect-t')].map(e => e.textContent)

describe('Einstellungen — was bleibt', () => {
  it('behält die Trainings-Vorlieben und die eigenen Daten', () => {
    mount()
    const t = titles()
    for (const keep of [
      'Weight unit', 'Week starts on', 'Body diagram', 'Weigh in before workouts', 'Workout view',
      'Workout controls', 'Rest timer', 'Keep screen awake', 'Exercise animations', 'Sounds',
      'Effort per set', 'Add equipment profile', 'Import from another app', 'Import from Hevy',
      'Export backup (JSON)', 'Import backup', 'Reset everything',
    ]) expect(t, keep).toContain(keep)
  })

  it('führt einen Abschnitt „Konto“ mit dem Weg zurück auf die Website', () => {
    mount()
    expect(sections()).toContain('Konto')
    expect(titles()).toContain('Zurück zu Mein Bereich')
    expect(titles()).toContain('Abmelden')
  })

  // B&S: Ein Mitglied benutzt die Trainings-App als eigene Oberfläche. Ohne diese beiden Zeilen
  // käme es von hier aus nie zur Datenschutzerklärung (Art. 13 DSGVO) oder zum Impressum
  // (ECG §5) — der Mitgliederbereich der Website verlinkt beides ebenfalls nicht.
  it('verlinkt Datenschutz und Impressum', () => {
    mount()
    expect(titles()).toContain('Datenschutz')
    expect(titles()).toContain('Impressum')
    const loc = { href: '' }
    Object.defineProperty(window, 'location', { value: loc, writable: true, configurable: true })
    const row = t => [...host.querySelectorAll('.lrow')].find(r => r.querySelector('.lrow-t')?.textContent === t)
    act(() => { row('Datenschutz').click() })
    expect(loc.href).toBe('/datenschutz')
    act(() => { row('Impressum').click() })
    expect(loc.href).toBe('/impressum')
  })
})

describe('Einstellungen — was raus ist', () => {
  it('zeigt weder Sprache/Theme/Akzent noch Konto-, Instanz- oder Coach-Zeilen', () => {
    mount()
    const t = titles()
    for (const gone of [
      'Language', 'Theme', 'Accent color', 'Sign out', 'Sign out everywhere', 'Pair the mobile app',
      'Admin dashboard', 'AI Coach', 'Gym check-in', 'Push notifications', 'Workout day reminder',
      'Check for updates', 'Get the Android app', 'Load starter plan', 'Create passkey profile',
      'Self-host openGym', 'Reset demo data',
    ]) expect(t, gone).not.toContain(gone)
    expect(host.querySelector('.swatches')).toBeNull()
    expect(host.textContent).not.toContain('gitlab.com')
  })
})

describe('Einstellungen — AGPL-Footer', () => {
  it('nennt Herkunft und Lizenz und verlinkt den Quellcode', () => {
    mount()
    const text = host.textContent
    expect(text).toContain('Trainings-App von Breit & Schnell')
    expect(text).toContain('basiert auf openGym von Duarte Santos')
    expect(text).toContain('Lizenz AGPL-3.0')
    expect(text).toContain('Übungsdaten: ExerciseDB über hasaneyldrm/exercises-dataset (MIT)')
    const link = [...host.querySelectorAll('a')].find(a => a.textContent === 'Quellcode')
    expect(link).toBeTruthy()
    expect(link.getAttribute('href')).toBe(SOURCE_URL)
    expect(SOURCE_URL).toMatch(/^https:\/\//)
  })

  // B&S: AGPL §13 will den Quellcode GENAU DER Version, die läuft. Ohne Versionsnummer im
  // Footer lässt sich später nicht mehr sagen, welcher Stand das war.
  it('nennt die Version, auf die sich der Quellcode-Link bezieht', () => {
    mount()
    expect(typeof __APP_VERSION__).toBe('string')
    expect(host.textContent).toContain('Trainings-App von Breit & Schnell v' + __APP_VERSION__)
  })

  // B&S: Jede Übungskarte zeigt eine fremde Animation. Das Original nannte den Rechteinhaber im
  // selben Footer; beim Umbau ist die Zeile verloren gegangen. Solange die Bilder drin sind,
  // muss der Nachweis dranstehen — das verlangt auch unsere eigene NOTICE.md von Nachnutzern.
  it('nennt den Bildnachweis und die Schriften', () => {
    mount()
    expect(host.textContent).toContain('Übungsbilder und -animationen ©')
    const gv = [...host.querySelectorAll('a')].find(a => a.textContent === 'Gym visual')
    expect(gv).toBeTruthy()
    expect(gv.getAttribute('href')).toBe('https://gymvisual.com/')
    expect(host.textContent).toContain('SIL Open Font License 1.1')
    expect(host.textContent).toContain('MuscleMap (MIT)')
  })
})
