// @vitest-environment happy-dom
// B&S: Home ist der Einstieg des Mitglieds — mit einem leisen Weg zurück in den
// Mitgliederbereich der Website, ohne Gym-Check-in und ohne Aufforderung, sich selbst einen
// Plan zu bauen (den macht der Coach). Im Plan-Editor liest der Coach nur mit: nichts, was
// etwas eintragen oder ein Training starten würde, ist da.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Home from './Home.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ S: null, user: null, editor: null, editable: false }))
vi.mock('../store/useStore.js', () => {
  const snap = () => ({ S: mocks.S, user: mocks.user, editor: mocks.editor })
  const useStore = selector => selector ? selector(snap()) : snap()
  useStore.getState = snap
  return { useStore }
})
vi.mock('../lib/editor-mode.js', () => ({ usePlanEditable: () => mocks.editable }))
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../sheets.jsx', () => ({
  bwSheet: vi.fn(), goalSheet: vi.fn(), dayOverrideSheet: vi.fn(), calendarSheet: vi.fn(),
  startFlow: vi.fn(), starterPlanSheet: vi.fn(), bwDeltaColor: () => '',
}))

let host, root
beforeEach(() => {
  mocks.S = {
    unit: 'kg', routines: [], week: {}, dayPlan: {}, workouts: [], bodyweight: [],
    active: null, targetW: null, exWeights: {},
  }
  mocks.user = { id: 'u1', name: 'Ana' }
  mocks.editor = null
  mocks.editable = false
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const mount = () => act(() => root.render(<Home />))
const buttonLabelled = label => [...host.querySelectorAll('button')].find(b => b.textContent === label)
const backLink = () => [...host.querySelectorAll('a')].find(a => a.getAttribute('href') === '/app')

describe('Home — Mitglied', () => {
  it('führt leise zurück in den Mitgliederbereich', () => {
    mount()
    expect(backLink()).toBeTruthy()
    expect(backLink().textContent).toBe('← Mein Bereich')
    expect(host.querySelector('.hdr').contains(backLink())).toBe(true)
  })

  it('bietet keinen Gym-Check-in und keinen eigenen Planbau an', () => {
    mount()
    expect(host.textContent).not.toContain('Check in')
    expect(buttonLabelled('Load starter plan')).toBeFalsy()
    expect(host.textContent).toContain('Dein Coach stellt deinen Trainingsplan zusammen.')
  })

  it('lässt das Mitglied sein Gewicht eintragen', () => {
    mount()
    expect(buttonLabelled('Log')).toBeTruthy()
  })
})

describe('Home — Plan-Editor', () => {
  beforeEach(() => {
    mocks.editable = true
    mocks.editor = { userId: 'm1', name: 'Bea' }
  })

  it('nennt das Mitglied statt den Coach und lässt den Rückweg zur Website weg', () => {
    mount()
    expect(host.querySelector('.hdr h1').textContent).toBe('Bea')
    expect(backLink()).toBeFalsy()
  })

  it('zeigt keine Eintrag- oder Start-Aktionen', () => {
    mocks.S.routines = [{ id: 'r1', name: 'Push', emoji: null, ex: [{ id: 'a' }] }]
    mocks.S.week = { [new Date().getDay()]: ['r1'] }
    mount()
    expect(buttonLabelled('Log')).toBeFalsy()
    expect(buttonLabelled('Goal')).toBeFalsy()
    const today = host.querySelector('.today-row')
    expect(today.getAttribute('role')).toBeNull()
    expect(today.textContent).not.toContain('Start')
  })

  it('lässt den Coach einen Plan anlegen, wenn noch keiner da ist', () => {
    mount()
    expect(buttonLabelled('Load starter plan')).toBeTruthy()
    expect(buttonLabelled('Build my own plan')).toBeTruthy()
  })
})
