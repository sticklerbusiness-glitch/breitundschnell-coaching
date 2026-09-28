// @vitest-environment happy-dom
// B&S: Diese Ansicht ist der Boden der Login-Schleife. Normal steht hier eine Zeile, während
// die Seite schon weg ist. Bricht die Weiterleitung ab, weil die Website uns eben erst
// zurückgeschickt hat, muss hier stattdessen ein deutscher Fehlertext stehen — sonst dreht
// sich der Tab endlos und niemand sucht nach AUTH_SECRET.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/api.js', () => ({ api: vi.fn() }))
vi.mock('../store/useUI.js', () => ({ useUI: { getState: () => ({ toast: vi.fn() }) } }))

import { clearLoginBounce } from '../store/useStore.js'
import Login from './Login.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root, replace

beforeEach(() => {
  sessionStorage.clear()
  clearLoginBounce()
  history.replaceState({}, '', '/training/#/home')
  replace = vi.spyOn(window.location, 'replace').mockImplementation(() => {})
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  replace.mockRestore()
  sessionStorage.clear()
  clearLoginBounce()
})

const render = () => act(() => { root.render(<Login />) })

describe('Login', () => {
  it('says it is forwarding and does forward', () => {
    render()
    expect(host.textContent).toContain('Weiterleitung zum Login')
    expect(replace).toHaveBeenCalledTimes(1)
  })

  it('shows a German error instead of bouncing a second time', () => {
    clearLoginBounce()
    sessionStorage.setItem('gym_login_bounce', '1')

    render()

    expect(replace).not.toHaveBeenCalled()
    expect(host.textContent).toContain('Anmeldung konnte nicht übernommen werden')
    expect(host.textContent).not.toContain('Weiterleitung zum Login')
    expect(host.querySelector('a[href="/app"]')).toBeTruthy()
  })

  it('lets the visitor try again once the configuration is fixed', () => {
    clearLoginBounce()
    sessionStorage.setItem('gym_login_bounce', '1')
    const reload = vi.spyOn(window.location, 'reload').mockImplementation(() => {})
    try {
      render()
      act(() => { host.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true })) })
      expect(sessionStorage.getItem('gym_login_bounce')).toBeNull()
      expect(reload).toHaveBeenCalled()
    } finally { reload.mockRestore() }
  })
})
