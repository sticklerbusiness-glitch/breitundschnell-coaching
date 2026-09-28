// @vitest-environment happy-dom

/* B&S: Die Trainings-App hat keine eigene Anmeldung — die Website besitzt die Session.
   Zwei Dinge müssen dabei stimmen:
   1. Der Rücksprung nimmt die ganze Adresse mit, `?kunde=<id>` eingeschlossen. Sonst landet
      ein Coach nach dem Re-Login in seinem eigenen Profil statt im Plan des Mitglieds.
   2. Hält die Website die Session für gültig, während /api/me hier 401 antwortet (abweichendes
      AUTH_SECRET im Gym-Projekt), schickt sie uns sofort zurück. Ohne Bremse ist das eine
      Endlosschleife ohne einen Buchstaben auf dem Schirm und ohne Zurück (location.replace). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/api.js', () => ({ api: vi.fn() }))
vi.mock('./useUI.js', () => ({ useUI: { getState: () => ({ toast: vi.fn() }) } }))

import { api } from '../lib/api.js'
import { DEF, clearLoginBounce, loginUrl, redirectToLogin, useStore } from './useStore.js'

const clone = v => JSON.parse(JSON.stringify(v))
const fresh = { S: clone(DEF), user: null, ready: false, editor: null, editorError: null, editorSave: 'idle', editorBoot: false, editorRev: null }
const BOUNCE = 'gym_login_bounce'
const unauthorized = () => Object.assign(new Error('unauthorized'), { status: 401 })

let replace

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  api.mockReset()
  clearLoginBounce()
  useStore.setState(clone(fresh))
  replace = vi.spyOn(window.location, 'replace').mockImplementation(() => {})
})
afterEach(() => {
  replace.mockRestore()
  localStorage.clear()
  sessionStorage.clear()
  clearLoginBounce()
  useStore.setState(clone(fresh))
  history.replaceState({}, '', '/')
})

describe('the way back to the website login', () => {
  it('carries the query string, so ?kunde= survives the round trip', () => {
    history.replaceState({}, '', '/training/?kunde=clx9member01#/plan')
    expect(loginUrl()).toBe('/login?weiter=' + encodeURIComponent('/training/?kunde=clx9member01#/plan'))
  })

  it('carries the route alone when there is no editor parameter', () => {
    history.replaceState({}, '', '/training/#/stats')
    expect(loginUrl()).toBe('/login?weiter=' + encodeURIComponent('/training/#/stats'))
  })

  it('redirects once and leaves a marker behind', () => {
    history.replaceState({}, '', '/training/#/home')
    expect(redirectToLogin()).toBe(true)
    expect(replace).toHaveBeenCalledWith(loginUrl())
    expect(sessionStorage.getItem(BOUNCE)).toBe('1')
  })

  it('refuses the second bounce of the same tab instead of looping', () => {
    // So sieht der nächste Seitenaufbau aus: die Marke liegt noch da, das Seitenleben ist neu.
    clearLoginBounce()
    sessionStorage.setItem(BOUNCE, '1')

    expect(redirectToLogin()).toBe(false)
    expect(replace).not.toHaveBeenCalled()
  })

  it('forgets the marker as soon as an account is confirmed', () => {
    sessionStorage.setItem(BOUNCE, '1')
    useStore.getState().setUser({ id: 'u1', name: 'Val' })
    expect(sessionStorage.getItem(BOUNCE)).toBeNull()
    expect(redirectToLogin()).toBe(true)
  })
})

describe('boot when the gym API answers 401 although the website session is fine', () => {
  it('redirects the first time', async () => {
    history.replaceState({}, '', '/training/#/home')
    api.mockRejectedValue(unauthorized())

    await useStore.getState().boot()

    expect(replace).toHaveBeenCalledTimes(1)
    expect(useStore.getState().user).toBeNull()
    expect(useStore.getState().ready).toBe(true)
  })

  it('stops on the second pass and leaves views/Login.jsx to show the error', async () => {
    history.replaceState({}, '', '/training/#/home')
    clearLoginBounce()
    sessionStorage.setItem(BOUNCE, '1')
    api.mockRejectedValue(unauthorized())

    await useStore.getState().boot()

    expect(replace).not.toHaveBeenCalled()
    expect(useStore.getState().user).toBeNull()
    expect(useStore.getState().ready).toBe(true)     // App.jsx rendert Login statt des Spinners
    expect(redirectToLogin()).toBe(false)            // und Login.jsx bekommt dasselbe „nein“
  })

  it('stops the editor boot too, without touching the coach profile', async () => {
    localStorage.setItem('gym_state_v1', JSON.stringify({ ...clone(DEF), _ts: 42, routines: [{ id: 'eigen', name: 'eigen', ex: [] }] }))
    history.replaceState({}, '', '/training/?kunde=clx9member01#/plan')
    clearLoginBounce()
    sessionStorage.setItem(BOUNCE, '1')
    api.mockRejectedValue(unauthorized())
    const raw = localStorage.getItem('gym_state_v1')

    await useStore.getState().boot()

    expect(replace).not.toHaveBeenCalled()
    expect(useStore.getState().ready).toBe(true)
    expect(useStore.getState().editorBoot).toBe(true)   // nichts läuft von hier in den localStorage
    expect(localStorage.getItem('gym_state_v1')).toBe(raw)
  })
})
