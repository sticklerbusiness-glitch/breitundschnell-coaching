// @vitest-environment happy-dom
// B&S: Das „trainiert gerade“-Signal der Coaches.
// Zwei Dinge sind hier schiefgegangen und dürfen nicht zurückkommen:
// 1. Der Abmelde-Beacon ging an den ABSOLUTEN Pfad /api/activity — das ist die Next-Website
//    nebenan, die diese Route nicht hat. Er muss wie jeder andere Aufruf relativ zur Vite-Base
//    an /training/api/activity gehen (lib/api.js).
// 2. React führt Effekt-Cleanups beim Schließen des Tabs nicht aus — genau der Fall, für den
//    ein Beacon da ist. Ohne `pagehide` blieb das Mitglied bis zum Ablauf des Fensters als
//    trainierend stehen.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Workout from './Workout.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: null, user: { id: 'u1', name: 'Mitglied' }, api: null, beacons: [] }
  state.api = vi.fn(() => Promise.resolve({}))
  state.storeSnapshot = () => ({
    S: state.S,
    user: state.user,
    update: mut => { const next = structuredClone(state.S); mut(next); state.S = next },
  })
  state.uiSnapshot = () => ({
    timer: null, work: null, startRest: vi.fn(), stopRest: vi.fn(), stopWork: vi.fn(),
    shiftRestOwner: vi.fn(), startWork: vi.fn(), toast: vi.fn(),
  })
  return state
})
vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.storeSnapshot()) : mocks.storeSnapshot()
  useStore.getState = mocks.storeSnapshot
  return { useStore }
})
vi.mock('../store/useUI.js', () => {
  const useUI = selector => selector ? selector(mocks.uiSnapshot()) : mocks.uiSnapshot()
  useUI.getState = mocks.uiSnapshot
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../lib/editor-mode.js', () => ({
  usePlanEditable: () => false, planEditable: () => false, readEditorParam: () => null,
}))
vi.mock('../components/Media.jsx', () => ({ default: () => null }))
vi.mock('../lib/api.js', () => ({
  api: (...a) => mocks.api(...a), IS_APPLE: false, IS_ANDROID: false, BIO: 'biometrics',
}))
vi.mock('../sheets.jsx', () => ({
  startFlow: vi.fn(), exercisePicker: vi.fn(), exConfigSheet: vi.fn(), exerciseDetailSheet: vi.fn(),
  finishWorkout: vi.fn(), workoutCompleteSheet: vi.fn(), confirmSheet: vi.fn(),
  swapActiveWorkoutExercise: vi.fn(), menuSheet: vi.fn(), barWeightSheet: vi.fn(),
  exerciseNoteSheet: vi.fn(), sessionNoteSheet: vi.fn(), effortPickerSheet: vi.fn(),
  exerciseHistorySheet: vi.fn(), addRoutineToSessionSheet: vi.fn(),
}))

// Im Testlauf ist die Vite-Base '/'; die Produktion läuft unter '/training/'. Genau dieser
// Unterschied ist der Fehler gewesen, also wird er hier nachgestellt.
const BASE = '/training/'
const ACTIVITY_URL = BASE + 'api/activity'

let host, root
beforeEach(() => {
  vi.stubEnv('BASE_URL', BASE)
  mocks.beacons.length = 0
  mocks.api.mockClear()
  navigator.sendBeacon = vi.fn((url, body) => { mocks.beacons.push({ url, body }); return true })
  mocks.S = {
    unit: 'kg', restSec: 90, sound: false, effort: 'none', gifSize: 'full',
    workouts: [], exWeights: {}, routines: [],
    active: {
      id: 'a1', name: 'Push', start: Date.now(), cur: 0,
      entries: [{ id: '0001', target: { mode: 'reps', reps: 5, weight: 60 }, sets: [{ w: 60, r: 5, done: false }] }],
    },
  }
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  if (root) act(() => root.unmount())
  host.remove()
  vi.unstubAllEnvs()
})

const mount = () => act(() => root.render(<Workout />))

describe('Anwesenheits-Signal', () => {
  it('meldet den Start über api() — also relativ zur Base, nicht an die Website', () => {
    mount()
    expect(mocks.api).toHaveBeenCalled()
    expect(mocks.api.mock.calls[0][0]).toBe('/api/activity')
    expect(JSON.parse(mocks.api.mock.calls[0][1].body).active).toBe(true)
  })

  it('schickt den Abmelde-Beacon an die Gym-API unter der Vite-Base', () => {
    mount()
    act(() => { root.unmount() }); root = null
    expect(mocks.beacons.length).toBe(1)
    expect(mocks.beacons[0].url).toBe(ACTIVITY_URL)
    expect(mocks.beacons[0].url).not.toBe('/api/activity')
    expect(mocks.beacons[0].url.endsWith('/api/activity')).toBe(true)
    // und zusätzlich der normale Aufruf für die App-interne Navigation
    const last = mocks.api.mock.calls.at(-1)
    expect(last[0]).toBe('/api/activity')
    expect(JSON.parse(last[1].body)).toEqual({ active: false })
  })

  it('meldet auch beim Schließen der Seite ab — dort läuft kein React-Cleanup', () => {
    mount()
    act(() => { window.dispatchEvent(new Event('pagehide')) })
    expect(mocks.beacons.length).toBe(1)
    expect(mocks.beacons[0].url).toBe(ACTIVITY_URL)
  })

  it('hängt den pagehide-Listener beim Verlassen der Ansicht wieder ab', () => {
    mount()
    act(() => { root.unmount() }); root = null
    mocks.beacons.length = 0
    window.dispatchEvent(new Event('pagehide'))
    expect(mocks.beacons.length).toBe(0)
  })
})
