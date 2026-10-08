// @vitest-environment happy-dom
// B&S: Supersätze waren da, aber unauffindbar (32-px-Kette ohne Text). Jetzt sitzt ein
// beschrifteter Schalter zwischen zwei Übungen, und jede Übung trägt ihre Block-Bezeichnung
// (A, B1, B2 …) — im Editor und beim Mitglied.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../store/useStore.js'
import { unitLabels } from '../lib/history.js'

const mode = vi.hoisted(() => ({ editable: true }))
vi.mock('../lib/editor-mode.js', () => ({
  usePlanEditable: () => mode.editable, planEditable: () => mode.editable,
  useEditorMode: () => mode.editable, editorMode: () => mode.editable, readEditorParam: () => null,
}))
vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))
vi.mock('../sheets.jsx', () => ({
  glyphPicker: vi.fn(), exercisePicker: vi.fn(), exConfigSheet: vi.fn(), confirmSheet: vi.fn(),
  exerciseDetailSheet: vi.fn()
}))
vi.mock('../components/Media.jsx', () => ({ Thumb: () => null }))
vi.mock('../components/BodyMap.jsx', () => ({ default: () => null }))
vi.mock('../components/YouTube.jsx', () => ({ default: () => null }))

const { default: RoutineEdit } = await import('./RoutineEdit.jsx')

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = value => JSON.parse(JSON.stringify(value))
const custom = id => ({ id, n: id, bp: 'chest', eq: 'body weight', tg: 'chest', custom: true })
const entry = (id, sg) => ({ id, sets: 3, reps: 8, ...(sg ? { sg } : {}) })

let root, container
afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  root = container = null
})

function render(ex) {
  const S = clone(DEF)
  S.routines = [{ id: 'r1', name: 'Supersatz-Test', emoji: 'dumbbell', ex }]
  S.customEx = ['c1', 'c2', 'c3', 'c4'].map(custom)
  useStore.setState({ S, user: null })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(
    <MemoryRouter initialEntries={['/routine/r1']}>
      <Routes><Route path="/routine/:id" element={<RoutineEdit />} /></Routes>
    </MemoryRouter>
  ))
}

const routine = () => useStore.getState().S.routines[0].ex
const links = () => [...container.querySelectorAll('.ss-link-btn')]
const tags = () => [...container.querySelectorAll('.blk-tag')].map(t => t.textContent)

describe('unitLabels', () => {
  it('letters every unit and numbers the members of a superset', () => {
    expect(unitLabels([entry('a'), entry('b', 'g'), entry('c', 'g'), entry('d')])).toEqual(['A', 'B1', 'B2', 'C'])
    expect(unitLabels([entry('a', 'x'), entry('b', 'x'), entry('c', 'x')])).toEqual(['A1', 'A2', 'A3'])
  })

  it('keeps going after Z and survives junk', () => {
    const many = Array.from({ length: 28 }, (_, i) => entry('e' + i))
    expect(unitLabels(many).slice(24)).toEqual(['Y', 'Z', 'AA', 'AB'])
    expect(unitLabels(null)).toEqual([])
  })
})

describe('plan editor', () => {
  it('shows a labelled superset switch between every two exercises', () => {
    mode.editable = true
    render([entry('c1'), entry('c2'), entry('c3')])
    expect(links()).toHaveLength(2)
    expect(links().map(b => b.textContent)).toEqual(['+ Supersatz', '+ Supersatz'])
    expect(tags()).toEqual(['A', 'B', 'C'])
  })

  it('links two exercises into a superset and unlinks them again', () => {
    mode.editable = true
    render([entry('c1'), entry('c2'), entry('c3')])
    act(() => links()[1].click())   // c2 + c3
    expect(routine()[1].sg).toBeTruthy()
    expect(routine()[2].sg).toBe(routine()[1].sg)
    expect(routine()[0].sg).toBeUndefined()
    expect(tags()).toEqual(['A', 'B1', 'B2'])
    expect(links()[1].getAttribute('aria-pressed')).toBe('true')
    expect(links()[1].textContent).toBe('Supersatz')

    act(() => links()[1].click())
    expect(routine().some(e => e.sg)).toBe(false)
    expect(tags()).toEqual(['A', 'B', 'C'])
  })

  it('grows a superset to three exercises', () => {
    mode.editable = true
    render([entry('c1'), entry('c2'), entry('c3')])
    act(() => links()[0].click())
    act(() => links()[1].click())
    expect(new Set(routine().map(e => e.sg)).size).toBe(1)
    expect(tags()).toEqual(['A1', 'A2', 'A3'])
  })

  it('does not start a drag from the switch', () => {
    mode.editable = true
    render([entry('c1'), entry('c2')])
    expect(links()[0].closest('[data-nodrag]')).not.toBeNull()
  })
})

describe('member view', () => {
  it('shows the block labels and names the superset, without any switch', () => {
    mode.editable = false
    render([entry('c1'), entry('c2', 'g'), entry('c3', 'g')])
    expect(links()).toHaveLength(0)
    expect(tags()).toEqual(['A', 'B1', 'B2'])
    expect(container.querySelector('.ss-label').textContent).toContain('Supersatz B')
  })
})
