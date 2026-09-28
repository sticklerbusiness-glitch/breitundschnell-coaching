// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Settings from './Settings.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

// B&S: Der Trainingsplan gehört den Coaches und liegt auf dem Server. Beide Wege, die hier
// Daten ersetzen — "Alles zurücksetzen" und ein eingespieltes Backup — dürfen deshalb nur
// die eigenen Daten des Mitglieds anfassen und den Plan in Ruhe lassen.
const mocks = vi.hoisted(() => {
  const state = { S: null }
  state.replaceState = vi.fn()
  state.confirmSheet = vi.fn()
  state.toast = vi.fn()
  state.snapshot = () => ({
    S: state.S,
    update: mut => {
      const next = structuredClone(state.S)
      mut(next)
      state.S = next
    },
    replaceState: state.replaceState,
  })
  return state
})
vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore, DEF: { unit: 'kg', workouts: [], routines: [], week: {}, bodyweight: [] } }
})
vi.mock('../store/useUI.js', () => {
  const snap = () => ({ toast: (...a) => mocks.toast(...a), openSheet: vi.fn() })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../lib/wakelock.js', () => ({ wakeLockSupported: () => false }))
vi.mock('../sheets.jsx', () => ({
  confirmSheet: (...a) => mocks.confirmSheet(...a), importFromApp: vi.fn(),
  importFromHevy: vi.fn(), equipmentProfileSheet: vi.fn(), menuSheet: vi.fn(),
}))

let host, root
beforeEach(() => {
  mocks.S = {
    unit: 'kg', restSec: 90, restPauseSec: 15, sound: false, effort: 'none',
    gifSize: 'full', workouts: [], routines: [{ id: 'r1', name: 'Push', ex: [] }], week: { 1: ['r1'] },
    bodyweight: [], exWeights: {},
  }
  mocks.replaceState.mockClear()
  mocks.confirmSheet.mockClear()
  mocks.toast.mockClear()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const mount = () => act(() => root.render(<Settings />))
const rowTitled = title => [...host.querySelectorAll('.lrow')].find(r => r.querySelector('.lrow-t')?.textContent === title)

describe('Einstellungen — alles zurücksetzen', () => {
  it('fragt auf Deutsch nach, sagt dass der Plan bleibt, und setzt auf die Defaults zurück', () => {
    mount()
    const row = rowTitled('Reset everything')
    expect(row).toBeTruthy()
    act(() => { row.click() })
    expect(mocks.confirmSheet).toHaveBeenCalledTimes(1)
    const dialog = mocks.confirmSheet.mock.calls[0][0]
    expect(dialog.title).toBe('Alles zurücksetzen?')
    expect(dialog.message).toContain('Dein Trainingsplan vom Coach bleibt.')
    expect(dialog.confirmText).toBe('Alles löschen')
    expect(dialog.danger).toBe(true)
    act(() => { dialog.onConfirm() })
    expect(mocks.replaceState).toHaveBeenCalledTimes(1)
    expect(mocks.replaceState.mock.calls[0][1]).toBe(true)
    expect(mocks.replaceState.mock.calls[0][0].workouts).toEqual([])
    expect(mocks.toast).toHaveBeenCalledWith('Alle Daten zurückgesetzt')
  })
})

describe('Einstellungen — Backup einspielen', () => {
  const backup = {
    unit: 'kg', workouts: [{ id: 'w1', d: '2026-01-02', ex: [] }],
    routines: [{ id: 'alt', name: 'Alter Plan', ex: [] }], week: { 3: ['alt'] },
  }
  const importFile = async text => {
    mount()
    const input = host.querySelector('input[accept=".json,application/json"]')
    expect(input).toBeTruthy()
    Object.defineProperty(input, 'files', {
      value: [new File([text], 'backup.json', { type: 'application/json' })], configurable: true,
    })
    // B&S: Der FileReader ist asynchron. Eine feste Wartezeit (vorher 10 ms) reicht unter Last
    // nicht und machte den Test in der vollen Suite sporadisch rot — hier wird gewartet, BIS die
    // Datei verarbeitet ist (Nachfrage-Sheet oder Fehler-Toast), höchstens zwei Sekunden.
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }))
      const frist = Date.now() + 2000
      while (Date.now() < frist && !mocks.confirmSheet.mock.calls.length && !mocks.toast.mock.calls.length) {
        await new Promise(r => setTimeout(r, 5))
      }
    })
  }

  it('bringt Trainings zurück, lässt aber Routinen und Wochenplan des Coaches stehen', async () => {
    await importFile(JSON.stringify(backup))
    expect(mocks.confirmSheet).toHaveBeenCalledTimes(1)
    const dialog = mocks.confirmSheet.mock.calls[0][0]
    expect(dialog.title).toBe('Backup einspielen?')
    act(() => { dialog.onConfirm() })
    const next = mocks.replaceState.mock.calls[0][0]
    expect(next.workouts).toEqual(backup.workouts)
    expect(next.routines).toEqual(mocks.S.routines)   // der Plan vom Server, nicht der aus der Datei
    expect(next.week).toEqual(mocks.S.week)
    expect(mocks.toast).toHaveBeenCalledWith('Backup eingespielt')
  })

  it('weist eine Datei ab, die kein Backup ist', async () => {
    await importFile(JSON.stringify({ hallo: 'welt' }))
    expect(mocks.confirmSheet).not.toHaveBeenCalled()
    expect(mocks.replaceState).not.toHaveBeenCalled()
    expect(mocks.toast).toHaveBeenCalledWith('Import fehlgeschlagen: Das ist keine Backup-Datei der Trainings-App.')
  })
})
