// @vitest-environment happy-dom
// B&S: the plan belongs to the coaches. A member opens a routine to READ it — what to do,
// how much of it, the coach's tip and the coach's video — and finds nothing that would let
// them change it.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ed = vi.hoisted(() => ({ on: false }))
vi.mock('../lib/editor-mode.js', () => ({
  usePlanEditable: () => ed.on, planEditable: () => ed.on, readEditorParam: () => null,
}))
vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))
vi.mock('../sheets.jsx', () => ({
  glyphPicker: vi.fn(), exercisePicker: vi.fn(), exConfigSheet: vi.fn(), confirmSheet: vi.fn(),
  exerciseDetailSheet: vi.fn(),
}))
vi.mock('../components/Media.jsx', () => ({ Thumb: ({ ex }) => <span data-thumb={ex.id} /> }))
vi.mock('../components/BodyMap.jsx', () => ({ default: () => null }))
// A real <iframe> makes happy-dom fetch youtube-nocookie.com; the frame itself is covered in
// components/YouTube.test.jsx, so here only the wiring matters.
vi.mock('../components/YouTube.jsx', () => ({
  default: ({ id, title }) => <div data-yt={id} data-yt-title={title} />,
}))

import RoutineEdit from './RoutineEdit.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { exerciseDetailSheet } from '../sheets.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = v => JSON.parse(JSON.stringify(v))
const VIDEO = 'dQw4w9WgXcQ'

let root, host
function mount() {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(
    <MemoryRouter initialEntries={['/plan/r/r1']}>
      <Routes><Route path="/plan/r/:id" element={<RoutineEdit />} /></Routes>
    </MemoryRouter>
  ))
}

beforeEach(() => {
  localStorage.clear()
  ed.on = false
  const S = clone(DEF)
  S.routines = [{
    id: 'r1', name: 'Push', emoji: 'dumbbell', prog: 'linear',
    ex: [
      { id: '0025', mode: 'reps', sets: 3, reps: 8, weight: 60, restSec: 120, note: 'Ellbogen eng führen', yt: VIDEO },
      { id: '0047', mode: 'reps', sets: 3, reps: 10, weight: 20, warmupSets: 2 },
    ],
  }]
  useStore.setState({ S, user: null })
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('RoutineEdit — a member reads the plan', () => {
  it('shows the scheme, the rest, the warm-ups and a thumb per exercise', () => {
    mount()
    const items = [...host.querySelectorAll('.item')]
    expect(items).toHaveLength(2)
    expect(items[0].querySelector('.ss').textContent).toBe('3 × 8 · 60 kg')
    expect(items[0].textContent).toContain('Pause 120 s')
    expect(items[1].textContent).toContain('2 Aufwärmsätze')
    expect(host.querySelectorAll('[data-thumb]')).toHaveLength(2)
  })

  it('shows the coach’s tip and the coach’s video', () => {
    mount()
    const tip = host.querySelector('[data-coach-tip]')
    expect(tip.textContent).toContain('Tipp vom Coach')
    expect(tip.textContent).toContain('Ellbogen eng führen')
    const players = [...host.querySelectorAll('[data-yt]')]
    expect(players).toHaveLength(1)                      // only the exercise that has one
    expect(players[0].getAttribute('data-yt')).toBe(VIDEO)
    expect(players[0].getAttribute('data-yt-title')).toBeTruthy()
  })

  it('offers nothing that writes: no name field, no reorder, no add/copy/delete', () => {
    mount()
    expect(host.querySelectorAll('input')).toHaveLength(0)
    expect(host.querySelectorAll('textarea')).toHaveLength(0)
    const labels = [...host.querySelectorAll('button')].map(b => b.getAttribute('aria-label') || b.textContent)
    expect(labels).toEqual(['Plan'])   // the back arrow, nothing else
    expect(host.querySelector('.swipe-del, [data-routine-row]')).toBeNull()
  })

  it('a tap on an exercise opens its detail sheet — reading, not editing', () => {
    mount()
    act(() => { host.querySelectorAll('.item .row')[0].dispatchEvent(new Event('click', { bubbles: true })) })
    expect(exerciseDetailSheet).toHaveBeenCalledTimes(1)
    expect(exerciseDetailSheet.mock.calls[0][0].id).toBe('0025')
    expect(useStore.getState().S.routines[0].ex).toHaveLength(2)
  })

  it('the plan editor gets the editable screen back', () => {
    ed.on = true
    mount()
    expect(host.querySelectorAll('[data-routine-row]')).toHaveLength(2)
    expect(host.querySelector('input')).not.toBeNull()
    expect([...host.querySelectorAll('button')].some(b => b.textContent.includes('Delete routine'))).toBe(true)
  })

  // B&S: Der Server kürzt einen Routinennamen bei 80 Zeichen (lib/plan.js MAX_ROUTINE_NAME).
  // Ohne dieselbe Grenze im Eingabefeld tippt der Coach weiter und bekommt beim nächsten Laden
  // einen anderen Namen zurück, als auf seinem Bildschirm stand.
  it('begrenzt den Routinennamen auf die Länge, die der Server behält', () => {
    ed.on = true
    mount()
    expect(host.querySelector('input.input').getAttribute('maxlength')).toBe('80')
  })
})
