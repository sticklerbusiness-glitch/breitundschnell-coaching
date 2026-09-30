// @vitest-environment happy-dom
// B&S: Eigene Übungen haben zwei Besitzer. Was das Mitglied selbst anlegt, darf es auch wieder
// löschen. Was über den Plan kommt (erkennbar: eine Routine benutzt es), gehört dem Coach —
// Umbenennen würde der Server verwerfen, und „Löschen“ risse dem Mitglied nur sein
// Arbeitsgewicht und den Favoriten-Stern weg, während die Übung Sekunden später zurückkäme.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ed = vi.hoisted(() => ({ on: false }))
vi.mock('./lib/editor-mode.js', () => ({
  usePlanEditable: () => ed.on, planEditable: () => ed.on,
  useEditorMode: () => ed.on, editorMode: () => ed.on, readEditorParam: () => null,
}))

import { coachOwnsEx, COACH_EX_HINT, deleteCustomEx, customExSheet, exerciseDetailSheet, exConfigSheet } from './sheets.jsx'
import { registerCustom } from './lib/exercises.js'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'

const COACH_EX = { id: 'cCoach', n: 'Schlittenschub', bp: 'upper legs', eq: 'body weight', tg: 'quads', sm: [], custom: true }
const OWN_EX = { id: 'cOwn', n: 'Sandsack-Carry', bp: 'waist', eq: 'body weight', tg: 'abs', sm: [], custom: true }

const S = () => useStore.getState().S
const mounted = []

function install() {
  const st = structuredClone(DEF)
  st.customEx = [structuredClone(COACH_EX), structuredClone(OWN_EX)]
  // Nur die Coach-Übung hängt in einer Routine — daran erkennt die App den Besitzer.
  st.routines = [{ id: 'r1', name: 'Push', emoji: 'dumbbell', ex: [{ id: COACH_EX.id, sets: 3, reps: 5, weight: 40 }] }]
  st.week = { 1: ['r1'] }
  st.exWeights = { [COACH_EX.id]: { w: 40, r: 5 }, [OWN_EX.id]: { w: 20, r: 8 } }
  st.favEx = [COACH_EX.id, OWN_EX.id]
  st.workouts = []
  st.active = null
  useStore.setState({ S: st, user: null })
  registerCustom(st.customEx)
}

// Rendert das oberste Sheet und gibt sein Host-Element zurück.
function renderTop() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const buttonLabels = host => [...host.querySelectorAll('button')].map(b => b.textContent)
// confirmSheet rendert einen eigenen Dialog — hier reicht der Bestätigen-Knopf.
const confirmTop = () => {
  const host = renderTop()
  act(() => host.querySelector('.btn.danger').click())
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  useUI.setState({ sheets: [], toastMsg: '' })
  ed.on = false
  document.body.innerHTML = ''
  install()
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
  registerCustom([])
})

describe('coachOwnsEx', () => {
  it('erkennt die Plan-Übung des Coaches und lässt die eigene in Ruhe', () => {
    expect(coachOwnsEx(S(), COACH_EX)).toBe(true)
    expect(coachOwnsEx(S(), OWN_EX)).toBe(false)
  })

  it('gilt nicht für Katalog-Übungen und nicht im Plan-Editor', () => {
    expect(coachOwnsEx(S(), { id: '0001', n: 'Bench', bp: 'chest' })).toBe(false)
    ed.on = true
    expect(coachOwnsEx(S(), COACH_EX)).toBe(false)
  })

  // B&S: Der Store stempelt alles, was im Plan-Editor neu entsteht, mit `src: 'coach'`
  // (useStore.js). Solange der Coach die Übung noch in keine Routine gehängt hat, ist die Marke
  // das einzige Erkennungszeichen — sonst könnte das Mitglied sie in genau diesem Fenster
  // umbenennen oder löschen.
  it('erkennt die Marke src:"coach" auch ohne Routine', () => {
    const frisch = { ...OWN_EX, id: 'cNeu', src: 'coach' }
    expect(coachOwnsEx(S(), frisch)).toBe(true)
    ed.on = true
    expect(coachOwnsEx(S(), frisch)).toBe(false)
  })
})

describe('das Mitglied kann eine Plan-Übung des Coaches nicht anfassen', () => {
  it('das Detail-Sheet zeigt statt Bearbeiten/Löschen eine Erklärung', () => {
    exerciseDetailSheet(COACH_EX)
    const host = renderTop()
    expect(buttonLabels(host)).not.toContain('Edit')
    expect(buttonLabels(host)).not.toContain('Delete')
    expect(host.textContent).toContain(COACH_EX_HINT)
  })

  it('bei der eigenen Übung bleiben Bearbeiten und Löschen stehen', () => {
    exerciseDetailSheet(OWN_EX)
    const host = renderTop()
    expect(buttonLabels(host)).toContain('Edit')
    expect(buttonLabels(host)).toContain('Delete')
    expect(host.textContent).not.toContain(COACH_EX_HINT)
  })

  it('deleteCustomEx lehnt ab und lässt Arbeitsgewicht und Favorit stehen', () => {
    deleteCustomEx(COACH_EX)
    expect(useUI.getState().sheets.length).toBe(0)
    expect(useUI.getState().toastMsg).toBe(COACH_EX_HINT)
    expect(S().customEx.map(x => x.id)).toEqual([COACH_EX.id, OWN_EX.id])
    expect(S().exWeights[COACH_EX.id]).toEqual({ w: 40, r: 5 })
    expect(S().favEx).toContain(COACH_EX.id)
  })

  it('das Bearbeiten-Sheet geht gar nicht erst auf', () => {
    customExSheet(COACH_EX)
    expect(useUI.getState().sheets.length).toBe(0)
    expect(useUI.getState().toastMsg).toBe(COACH_EX_HINT)
  })

  // B&S: Der zweite Weg zu „Bearbeiten oder löschen“ führt über die Übungs-Konfiguration
  // (ExConfig) — auch dort darf der Knopf bei einer Plan-Übung nicht stehen.
  it('die Übungs-Konfiguration bietet kein „Bearbeiten oder löschen“ an', () => {
    exConfigSheet(COACH_EX, S().routines[0].ex[0], () => {}, null, S().routines[0])
    const host = renderTop()
    expect(buttonLabels(host)).not.toContain('Edit or delete this exercise')
    expect(host.textContent).toContain(COACH_EX_HINT)
  })
})

describe('die eigene Übung bleibt löschbar', () => {
  it('entfernt sie samt Arbeitsgewicht und Favorit', () => {
    deleteCustomEx(OWN_EX)
    confirmTop()
    expect(S().customEx.map(x => x.id)).toEqual([COACH_EX.id])
    expect(S().exWeights[OWN_EX.id]).toBeUndefined()
    expect(S().favEx).toEqual([COACH_EX.id])
    // Die Routinen des Coaches bleiben unangetastet.
    expect(S().routines[0].ex.map(e => e.id)).toEqual([COACH_EX.id])
  })

  it('das Bearbeiten-Sheet geht auf', () => {
    customExSheet(OWN_EX)
    expect(useUI.getState().sheets.length).toBe(1)
  })

  it('und die Übungs-Konfiguration behält ihren Knopf', () => {
    exConfigSheet(OWN_EX, { id: OWN_EX.id, sets: 3, reps: 8, weight: 20 }, () => {})
    const host = renderTop()
    expect(buttonLabels(host)).toContain('Edit or delete this exercise')
    expect(host.textContent).not.toContain(COACH_EX_HINT)
  })
})

describe('im Plan-Editor darf der Coach seine eigene Übung wieder löschen', () => {
  beforeEach(() => { ed.on = true })

  it('nimmt sie aus dem Katalog und aus der Routine', () => {
    deleteCustomEx(COACH_EX)
    confirmTop()
    expect(S().customEx.map(x => x.id)).toEqual([OWN_EX.id])
    expect(S().routines[0].ex).toEqual([])
  })

  it('und das Bearbeiten-Sheet geht auf', () => {
    customExSheet(COACH_EX)
    expect(useUI.getState().sheets.length).toBe(1)
  })
})
