// @vitest-environment happy-dom
// B&S: Zwei Dinge, die die Einstellungen NICHT anfassen dürfen.
// 1. Routinen und Wochenplan gehören den Coaches — die Umrechnung der Gewichtseinheit rechnet
//    nur die eigenen Zahlen des Mitglieds um, sonst stünde im Plan eine kg-Zahl mit lb-Etikett.
// 2. Im Plan-Editor ist der ganze Stand der des Mitglieds: dort laufen weder „Alles
//    zurücksetzen“ noch ein eingespieltes Backup, weil beides als Plan-Schreibvorgang beim
//    Mitglied landen würde.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ed = vi.hoisted(() => ({ on: false, coach: false }))
vi.mock('../lib/editor-mode.js', () => ({
  usePlanEditable: () => ed.on || ed.coach, planEditable: () => ed.on || ed.coach,
  useEditorMode: () => ed.on, editorMode: () => ed.on, readEditorParam: () => null,
}))

import Settings from './Settings.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: null }
  state.replaceState = vi.fn()
  state.confirmSheet = vi.fn()
  state.menuSheet = vi.fn()
  state.toast = vi.fn()
  state.snapshot = () => ({
    S: state.S,
    update: mut => { const next = structuredClone(state.S); mut(next); state.S = next },
    replaceState: state.replaceState,
  })
  return state
})
vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore, DEF: { unit: 'kg', workouts: [], routines: [], week: {}, bodyweight: [], customEx: [] } }
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
  importFromHevy: vi.fn(), equipmentProfileSheet: vi.fn(),
  menuSheet: (...a) => mocks.menuSheet(...a),
}))

let host, root
beforeEach(() => {
  ed.on = false
  ed.coach = false
  mocks.S = {
    unit: 'kg', restSec: 90, restPauseSec: 15, sound: false, effort: 'none', gifSize: 'full',
    workouts: [{ id: 'w1', d: '2026-01-02', entries: [{ id: '0001', sets: [{ w: 100, r: 5, done: true }] }] }],
    routines: [{ id: 'r1', name: 'Push', ex: [{ id: 'cCoach', sets: 5, reps: 5, weight: 100, inc: 2.5 }] }],
    week: { 1: ['r1'] },
    customEx: [{ id: 'cCoach', n: 'Schlittenschub', bp: 'upper legs', custom: true }],
    bodyweight: [{ d: '2026-01-02', kg: 80 }], exWeights: { '0001': { w: 100, r: 5 } },
  }
  mocks.replaceState.mockClear(); mocks.confirmSheet.mockClear()
  mocks.menuSheet.mockClear(); mocks.toast.mockClear()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const mount = () => act(() => root.render(<Settings />))
const rowTitled = title => [...host.querySelectorAll('.lrow')].find(r => r.querySelector('.lrow-t')?.textContent === title)
const clickRow = title => act(() => { rowTitled(title).click() })

describe('Gewichtseinheit umrechnen', () => {
  const convert = () => {
    mount()
    const lb = [...host.querySelectorAll('.seg-inline button')].find(b => b.textContent === 'lb')
    act(() => { lb.click() })
    expect(mocks.menuSheet).toHaveBeenCalledTimes(1)
    const sheet = mocks.menuSheet.mock.calls[0][0]
    act(() => { sheet.items[0].onClick() })
    return { sheet, next: mocks.replaceState.mock.calls[0][0] }
  }

  it('rechnet die eigenen Zahlen um und lässt die Vorgaben des Coaches unangetastet', () => {
    const { next } = convert()
    expect(next.unit).toBe('lb')
    // eigene Daten: umgerechnet
    expect(next.workouts[0].entries[0].sets[0].w).toBeCloseTo(220.5, 1)
    expect(next.exWeights['0001'].w).toBeCloseTo(220.5, 1)
    // Plan: identisch mit dem Server-Stand, nicht bloß gleich gerechnet
    expect(next.routines).toBe(mocks.S.routines)
    expect(next.week).toBe(mocks.S.week)
    expect(next.routines[0].ex[0].weight).toBe(100)
  })

  it('wird ohne Push geschrieben — der Plan darf davon nichts mitbekommen', () => {
    convert()
    expect(mocks.replaceState).toHaveBeenCalledTimes(1)
    expect(mocks.replaceState.mock.calls[0][1]).toBeUndefined()
  })

  it('sagt im Sheet und im Abschnitts-Footer, dass der Plan in der Einheit des Coaches bleibt', () => {
    const { sheet } = convert()
    expect(sheet.subtitle).toContain('Trainingsplan legt dein Coach fest')
    expect(host.textContent).toContain('sie bleiben in seiner Einheit stehen')
  })
})

describe('Backup einspielen behält die Übungen des Coaches', () => {
  const importFile = async text => {
    mount()
    const input = host.querySelector('input[accept=".json,application/json"]')
    Object.defineProperty(input, 'files', {
      value: [new File([text], 'backup.json', { type: 'application/json' })], configurable: true,
    })
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }))
      // B&S: Der FileReader ist asynchron — eine feste Wartezeit reicht unter Last nicht und
      // machte den Test in der vollen Suite sporadisch rot. Warten, BIS die Datei verarbeitet
      // ist (Nachfrage-Sheet oder Fehler-Toast), höchstens zwei Sekunden.
      const frist = Date.now() + 2000
      while (Date.now() < frist && !mocks.confirmSheet.mock.calls.length && !mocks.toast.mock.calls.length) {
        await new Promise(r => setTimeout(r, 5))
      }
    })
  }

  it('übernimmt die eigenen Übungen aus der Datei und hängt die Plan-Übung davor', async () => {
    await importFile(JSON.stringify({
      unit: 'kg', workouts: [], customEx: [{ id: 'cAlt', n: 'Alte Eigene', bp: 'chest', custom: true }],
    }))
    act(() => { mocks.confirmSheet.mock.calls[0][0].onConfirm() })
    const next = mocks.replaceState.mock.calls[0][0]
    expect(next.customEx.map(x => x.id)).toEqual(['cCoach', 'cAlt'])
  })
})

describe('im Plan-Editor bleiben die zerstörenden Wege zu', () => {
  beforeEach(() => { ed.on = true })

  it('„Alles zurücksetzen“ fragt nicht einmal nach', () => {
    mount()
    clickRow('Reset everything')
    expect(mocks.confirmSheet).not.toHaveBeenCalled()
    expect(mocks.replaceState).not.toHaveBeenCalled()
    expect(mocks.toast.mock.calls[0][0]).toContain('Im Plan-Editor')
  })

  it('ein Backup wird nicht einmal gelesen', async () => {
    mount()
    const input = host.querySelector('input[accept=".json,application/json"]')
    Object.defineProperty(input, 'files', {
      value: [new File([JSON.stringify({ workouts: [] })], 'b.json', { type: 'application/json' })], configurable: true,
    })
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }))
      // B&S: Der FileReader ist asynchron — eine feste Wartezeit reicht unter Last nicht und
      // machte den Test in der vollen Suite sporadisch rot. Warten, BIS die Datei verarbeitet
      // ist (Nachfrage-Sheet oder Fehler-Toast), höchstens zwei Sekunden.
      const frist = Date.now() + 2000
      while (Date.now() < frist && !mocks.confirmSheet.mock.calls.length && !mocks.toast.mock.calls.length) {
        await new Promise(r => setTimeout(r, 5))
      }
    })
    expect(mocks.confirmSheet).not.toHaveBeenCalled()
    expect(mocks.replaceState).not.toHaveBeenCalled()
    expect(mocks.toast.mock.calls[0][0]).toContain('Im Plan-Editor')
  })
})

/* B&S: Der Riegel gilt dem Plan-Editor, nicht dem Plan-Recht. Ein Coach in seinem eigenen
   Bereich darf seinen Plan schreiben UND seine Einstellungen zurücksetzen — es sind seine. */
describe('im eigenen Bereich eines Coaches bleiben sie offen', () => {
  beforeEach(() => { ed.coach = true })

  it('„Alles zurücksetzen“ fragt wie bei jedem Mitglied nach', () => {
    mount()
    clickRow('Reset everything')
    expect(mocks.confirmSheet).toHaveBeenCalledTimes(1)
    expect(mocks.toast).not.toHaveBeenCalled()
  })
})
