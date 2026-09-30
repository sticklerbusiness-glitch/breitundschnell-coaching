// @vitest-environment happy-dom
/* B&S: Scheitert der Plan-Editor (veralteter Link, gelöschtes Mitglied), steht auf dem
   Bildschirm „Mitglied nicht gefunden.“ — und sonst nichts. Vorher rannte darunter views/Login
   an: `user` ist im Fehlerfall leer, also hielt App.jsx den Besucher für abgemeldet, schickte
   ihn über /login (wo die Website ihn sofort zurückschickte) und setzte dabei die
   Login-Schleifen-Marke. Zweiter Durchlauf: derselbe 404, aber der Text darunter behauptete
   plötzlich, die Anmeldung sei kaputt. */
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./lib/api.js', () => ({ api: vi.fn() }))

import { api } from './lib/api.js'
import App from './App.jsx'
import { clearLoginBounce, useStore } from './store/useStore.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const MEMBER = 'clx9member01'
const coach = { id: 'coach-1', name: 'Valentin', coach: true }
let host, root, replace

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  clearLoginBounce()
  api.mockReset()
  useStore.setState({ user: null, ready: false, editor: null, editorError: null, editorBoot: false, editorSave: 'idle', editorRev: null })
  replace = vi.spyOn(window.location, 'replace').mockImplementation(() => {})
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  replace.mockRestore()
  localStorage.clear()
  sessionStorage.clear()
  clearLoginBounce()
  history.replaceState({}, '', '/')
})

describe('der Fehlerbildschirm des Plan-Editors', () => {
  it('zeigt den Fehler, statt den Coach durch den Website-Login zu schicken', async () => {
    history.replaceState({}, '', '/training/?kunde=' + MEMBER + '#/plan')
    api.mockImplementation(async path => {
      if (path === '/api/me') return { user: coach }
      throw Object.assign(new Error('not found'), { status: 404 })
    })

    await act(async () => { root.render(<App />) })

    expect(host.querySelector('[data-testid="editor-error"]')).toBeTruthy()
    expect(host.textContent).toContain('Mitglied nicht gefunden.')
    expect(host.textContent).not.toContain('Weiterleitung zum Login')
    expect(replace).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('gym_login_bounce')).toBeNull()
  })
})
