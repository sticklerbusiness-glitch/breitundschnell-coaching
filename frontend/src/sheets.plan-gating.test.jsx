// @vitest-environment happy-dom
// B&S: routines and the weekly schedule belong to the coaches — the member's app only logs.
// Every sheet that would write into s.routines / s.week is pinned here on both sides of the
// switch, plus the one thing that has to survive the trip into a session: the coach's video.
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ed = vi.hoisted(() => ({ on: false }))
vi.mock('./lib/editor-mode.js', () => ({
  usePlanEditable: () => ed.on, planEditable: () => ed.on, readEditorParam: () => null,
}))

import { addToRoutineSheet, dayAssignSheet, dayAddRoutineSheet, planImportSheet, beginWorkout } from './sheets.jsx'
import { EXDB, EXIDX } from './lib/exercises.js'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'

const clone = v => JSON.parse(JSON.stringify(v))
const ids = EXDB.filter(e => e.bp !== 'cardio').slice(0, 2).map(e => e.id)
const VIDEO = 'dQw4w9WgXcQ'

const sheetCount = () => useUI.getState().sheets.length
const S = () => useStore.getState().S

function install(extra = {}) {
  const st = clone(DEF)
  st.routines = [{
    id: 'r1', name: 'Push', emoji: 'dumbbell', prog: 'off',
    ex: [{ id: ids[0], sets: 3, reps: 5, weight: 60, note: 'Ellbogen eng', yt: VIDEO, restSec: 120 }],
  }]
  st.week = { 1: ['r1'] }
  st.active = null
  st.workouts = []
  useStore.setState({ S: { ...st, ...extra }, user: null })
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  useUI.setState({ sheets: [], toastMsg: '' })
  ed.on = false
  install()
})

describe('a member cannot reach a plan-writing sheet', () => {
  it('“add to routine” never opens', () => {
    addToRoutineSheet(EXIDX[ids[1]])
    expect(sheetCount()).toBe(0)
  })

  it('the weekday sheets never open', () => {
    dayAssignSheet(2)
    dayAddRoutineSheet(1)
    expect(sheetCount()).toBe(0)
  })

  it('importing a plan file never opens', () => {
    planImportSheet({ name: 'x', routines: [], customEx: [], week: {}, routineCount: 0, exerciseCount: 0, scheduledDays: 0, dropped: 0 })
    expect(sheetCount()).toBe(0)
    expect(S().routines.map(r => r.id)).toEqual(['r1'])
  })
})

describe('the plan editor reaches all of them', () => {
  beforeEach(() => { ed.on = true })

  it('opens “add to routine”, the weekday sheets and the plan import', () => {
    addToRoutineSheet(EXIDX[ids[1]])
    expect(sheetCount()).toBe(1)
    dayAssignSheet(2)
    expect(sheetCount()).toBe(2)
    dayAddRoutineSheet(1)
    expect(sheetCount()).toBe(3)
  })
})

describe('the coach’s video and tip travel into the session', () => {
  it('a started workout carries yt and note on the entry’s target', () => {
    act(() => beginWorkout(['r1'], null))
    const entry = S().active.entries[0]
    expect(entry.target.yt).toBe(VIDEO)
    expect(entry.target.note).toBe('Ellbogen eng')
    expect(entry.target.restSec).toBe(120)
  })
})
