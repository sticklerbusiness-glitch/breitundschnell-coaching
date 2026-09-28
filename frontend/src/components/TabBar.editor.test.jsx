// @vitest-environment happy-dom
// B&S: Im Plan-Editor sieht ein Coach das Profil eines Mitglieds. Ein Training darf er darin
// nicht starten — sonst landet seine Session in fremden Daten. Der Start-Knopf fällt deshalb
// weg; ein Platzhalter hält das Raster der vier übrigen Tabs.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TabBar from './TabBar.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ S: null, user: null, editable: false }))
vi.mock('../store/useStore.js', () => {
  const snap = () => ({ S: mocks.S, user: mocks.user })
  const useStore = selector => selector ? selector(snap()) : snap()
  useStore.getState = snap
  return { useStore }
})
vi.mock('../lib/editor-mode.js', () => ({ usePlanEditable: () => mocks.editable }))
vi.mock('react-router-dom', () => ({
  useNavigate: () => () => {},
  useLocation: () => ({ pathname: '/home' }),
}))

let host, root
beforeEach(() => {
  mocks.S = { active: null, routines: [], week: {}, dayPlan: {}, workouts: [] }
  mocks.user = { id: 'u1', name: 'Ana' }
  mocks.editable = false
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const mount = () => act(() => root.render(<TabBar onStart={() => {}} />))

describe('TabBar', () => {
  it('zeigt dem Mitglied den Start-Knopf', () => {
    mount()
    expect(host.querySelector('button.start')).toBeTruthy()
    expect(host.querySelectorAll('#tabbar button').length).toBe(5)
  })

  it('lässt ihn im Plan-Editor weg und hält den Platz frei', () => {
    mocks.editable = true
    mount()
    expect(host.querySelector('button.start')).toBeNull()
    expect(host.querySelectorAll('#tabbar button').length).toBe(4)
    expect(host.querySelector('#tabbar [aria-hidden="true"]')).toBeTruthy()
  })

  it('bleibt ohne angemeldetes Mitglied ganz weg', () => {
    mocks.user = null
    mount()
    expect(host.querySelector('#tabbar')).toBeNull()
  })
})
