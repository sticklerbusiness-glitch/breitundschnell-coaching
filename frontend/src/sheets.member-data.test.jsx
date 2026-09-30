// @vitest-environment happy-dom
// B&S: Im Plan-Editor sieht der Coach den Stand des Mitglieds, aber er besitzt davon nur den
// Plan. Der Store lehnt jede andere Änderung ab (useStore.js) — deshalb darf die Oberfläche
// solche Knöpfe hier gar nicht erst anbieten: sonst meldet „Workout gelöscht“ eine Löschung,
// die nie passiert ist, und der Favoriten-Stern springt zurück.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ed = vi.hoisted(() => ({ on: false }))
vi.mock('./lib/editor-mode.js', () => ({
  usePlanEditable: () => ed.on, planEditable: () => ed.on,
  useEditorMode: () => ed.on, editorMode: () => ed.on, readEditorParam: () => null,
}))

import { workoutDetailSheet, exerciseDetailSheet } from './sheets.jsx'
import { EXDB } from './lib/exercises.js'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'

const EX = EXDB.find(e => e.bp !== 'cardio')
const WORKOUT = {
  id: 'w1', d: '2026-01-02', name: 'Push', start: 1, end: 60 * 60 * 1000, vol: 3000,
  note: 'Schulter hat gezwickt',
  entries: [{ id: EX.id, target: { mode: 'reps', reps: 5, weight: 60 }, sets: [{ w: 60, r: 5, done: true }] }],
}

const S = () => useStore.getState().S
const mounted = []

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

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  useUI.setState({ sheets: [], toastMsg: '' })
  ed.on = false
  document.body.innerHTML = ''
  const st = structuredClone(DEF)
  st.workouts = [structuredClone(WORKOUT)]
  st.favEx = []
  st.routines = []
  st.active = null
  useStore.setState({ S: st, user: null })
})
afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

describe('eine geloggte Einheit gehört dem Mitglied', () => {
  it('das Mitglied kann sie löschen und die Notiz ändern', () => {
    workoutDetailSheet(S().workouts[0])
    const host = renderTop()
    expect(buttonLabels(host)).toContain('Delete workout')
    expect(host.querySelector('textarea')).not.toBeNull()
  })

  it('im Plan-Editor steht sie nur da — kein Löschen, keine Notiz-Eingabe', () => {
    ed.on = true
    workoutDetailSheet(S().workouts[0])
    const host = renderTop()
    expect(buttonLabels(host)).not.toContain('Delete workout')
    expect(host.querySelector('textarea')).toBeNull()
    // Gelesen wird die Notiz trotzdem — sie ist für den Coach die interessanteste Zeile.
    expect(host.textContent).toContain('Schulter hat gezwickt')
    expect(host.textContent).toContain('im Plan-Editor bearbeitest du nur den Trainingsplan')
    expect(S().workouts).toHaveLength(1)
  })
})

describe('der Favoriten-Stern gehört dem Mitglied', () => {
  it('steht in der Übungs-Ansicht', () => {
    exerciseDetailSheet(EX)
    const host = renderTop()
    expect(host.querySelector('.fav-btn')).not.toBeNull()
  })

  it('fehlt im Plan-Editor', () => {
    ed.on = true
    exerciseDetailSheet(EX)
    const host = renderTop()
    expect(host.querySelector('.fav-btn')).toBeNull()
  })
})
