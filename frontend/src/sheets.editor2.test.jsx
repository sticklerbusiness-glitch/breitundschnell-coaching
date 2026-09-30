// @vitest-environment happy-dom
/* B&S: Zweite Runde Plan-Editor, Oberflächen-Seite.
   - Eine eigene Übung des MITGLIEDS (keine Routine benutzt sie, keine Coach-Marke) darf der
     Coach im Editor nicht umbenennen oder löschen: pushPlan filtert sie weg und der Server
     verwirft sie, auf dem Schirm stünde die Änderung trotzdem samt „Gespeichert“.
   - Das Hantelstangen-Gewicht gehört dem Mitglied (s.barWeights, kein Plan-Feld). Im Editor
     bewegte sich der Stepper nie und warf pro Tipp einen Toast.
   - „Plan teilen“ trug im Editor den Namen des COACHES in Datei und Ausdruck. */
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ed = vi.hoisted(() => ({ editor: false, coach: false }))
vi.mock('./lib/editor-mode.js', () => ({
  usePlanEditable: () => ed.editor || ed.coach,
  planEditable: () => ed.editor || ed.coach,
  useEditorMode: () => ed.editor,
  editorMode: () => ed.editor,
  readEditorParam: () => null,
}))

vi.mock('./lib/plan-share.js', () => ({
  buildPlanBundle: vi.fn(() => ({ name: 'x', routines: [] })),
  parsePlan: vi.fn(),
  mergePlan: vi.fn(),
  printPlan: vi.fn(),
  planPrintHTML: vi.fn(() => '<html></html>'),
}))

import {
  coachOwnsEx, memberOwnsEx, MEMBER_EX_HINT, deleteCustomEx, customExSheet,
  exerciseDetailSheet, exConfigSheet, planToolsSheet
} from './sheets.jsx'
import { buildPlanBundle, printPlan } from './lib/plan-share.js'
import { registerCustom, EXIDX } from './lib/exercises.js'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'

const BAR_EX = '0023'   // barbell alternate biceps curl — usesBar() ist wahr
const COACH_EX = { id: 'cCoach', n: 'Schlittenschub', bp: 'upper legs', eq: 'body weight', tg: 'quads', sm: [], custom: true }
const MEMBER_EX = { id: 'cOwn', n: 'Sled Push', bp: 'waist', eq: 'body weight', tg: 'abs', sm: [], custom: true }

const S = () => useStore.getState().S
const mounted = []

function install() {
  const st = structuredClone(DEF)
  st.customEx = [structuredClone(COACH_EX), structuredClone(MEMBER_EX)]
  st.routines = [{ id: 'r1', name: 'Push', emoji: 'dumbbell', ex: [{ id: COACH_EX.id, sets: 3, reps: 5, weight: 40 }] }]
  st.week = { 1: ['r1'] }
  st.workouts = []
  st.active = null
  useStore.setState({ S: st, user: { id: 'coach-1', name: 'Valentin', coach: true }, editor: { userId: 'm1', name: 'Ochuko' } })
  registerCustom(st.customEx)
}

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
  ed.editor = true
  ed.coach = false
  document.body.innerHTML = ''
  install()
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
  registerCustom([])
  useStore.setState({ editor: null, user: null })
})

describe('memberOwnsEx', () => {
  it('erkennt im Editor die eigene Übung des Mitglieds', () => {
    expect(memberOwnsEx(S(), MEMBER_EX)).toBe(true)
    expect(memberOwnsEx(S(), COACH_EX)).toBe(false)     // hängt in einer Routine → Plan-Seite
    expect(memberOwnsEx(S(), EXIDX[BAR_EX])).toBe(false)
  })

  it('gilt nur im Editor — nicht beim Mitglied und nicht im eigenen Bereich eines Coaches', () => {
    ed.editor = false
    expect(memberOwnsEx(S(), MEMBER_EX)).toBe(false)
    ed.coach = true
    expect(memberOwnsEx(S(), MEMBER_EX)).toBe(false)
    expect(coachOwnsEx(S(), COACH_EX)).toBe(false)      // seine eigenen Übungen bleiben seine
  })
})

describe('die eigene Übung des Mitglieds ist im Editor nur lesbar', () => {
  it('das Detail-Sheet zeigt statt Bearbeiten/Löschen eine Erklärung', () => {
    exerciseDetailSheet(MEMBER_EX)
    const host = renderTop()
    expect(buttonLabels(host)).not.toContain('Edit')
    expect(buttonLabels(host)).not.toContain('Delete')
    expect(host.textContent).toContain(MEMBER_EX_HINT)
  })

  it('das Bearbeiten-Sheet geht gar nicht erst auf', () => {
    customExSheet(MEMBER_EX)
    expect(useUI.getState().sheets.length).toBe(0)
    expect(useUI.getState().toastMsg).toBe(MEMBER_EX_HINT)
  })

  it('deleteCustomEx lehnt ab', () => {
    deleteCustomEx(MEMBER_EX)
    expect(useUI.getState().sheets.length).toBe(0)
    expect(useUI.getState().toastMsg).toBe(MEMBER_EX_HINT)
    expect(S().customEx.map(x => x.id)).toEqual([COACH_EX.id, MEMBER_EX.id])
  })

  it('lässt die Plan-Übung des Coaches weiterhin bearbeiten', () => {
    customExSheet(COACH_EX)
    expect(useUI.getState().sheets.length).toBe(1)
  })
})

describe('das Hantelstangen-Gewicht gehört dem Mitglied', () => {
  it('steht im Editor nicht in der Übungs-Konfiguration', () => {
    exConfigSheet(EXIDX[BAR_EX], { id: BAR_EX, sets: 3, reps: 5, weight: 40 }, () => {}, null, S().routines[0])
    const host = renderTop()
    expect(host.textContent).not.toContain('Bar weight')
  })

  it('steht im Editor nicht im Detail-Sheet', () => {
    exerciseDetailSheet(EXIDX[BAR_EX])
    const host = renderTop()
    expect(host.textContent).not.toContain('Bar weight')
  })

  it('bleibt außerhalb des Editors stehen', () => {
    ed.editor = false
    useStore.setState({ editor: null })
    exConfigSheet(EXIDX[BAR_EX], { id: BAR_EX, sets: 3, reps: 5, weight: 40 }, () => {}, null, S().routines[0])
    const host = renderTop()
    expect(host.textContent).toContain('Bar weight')
  })
})

describe('Plan teilen', () => {
  it('nennt im Ausdruck das Mitglied, nicht den Coach', () => {
    planToolsSheet()
    const host = renderTop()
    const druck = [...host.querySelectorAll('button')].find(b => b.textContent.includes('Print'))
    act(() => druck.click())
    expect(printPlan).toHaveBeenCalledWith(expect.anything(), 'Ochuko')
  })

  it('nennt in der Export-Datei das Mitglied', async () => {
    planToolsSheet()
    const host = renderTop()
    const exp = [...host.querySelectorAll('button')].find(b => b.textContent.includes('Export'))
    await act(async () => { exp.click() })
    expect(buildPlanBundle).toHaveBeenCalledWith(expect.anything(), 'Ochuko’s plan')
  })

  it('nennt außerhalb des Editors den angemeldeten Benutzer', () => {
    ed.editor = false
    useStore.setState({ editor: null })
    planToolsSheet()
    const host = renderTop()
    const druck = [...host.querySelectorAll('button')].find(b => b.textContent.includes('Print'))
    act(() => druck.click())
    expect(printPlan).toHaveBeenCalledWith(expect.anything(), 'Valentin')
  })
})
