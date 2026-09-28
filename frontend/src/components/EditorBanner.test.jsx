// @vitest-environment happy-dom
// B&S: Das Banner ist die einzige Stelle, an der ein Coach sieht, dass er im Plan eines
// Mitglieds steht und nicht im eigenen Profil — und der Fehlerfall darf den Bildschirm
// dahinter nicht durchscheinen lassen.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/api.js', () => ({ api: vi.fn() }))
vi.mock('../store/useUI.js', () => ({ useUI: { getState: () => ({ toast: vi.fn() }) } }))

import { useStore } from '../store/useStore.js'
import EditorBanner from './EditorBanner.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root
const render = () => act(() => { root.render(<EditorBanner />) })

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  useStore.setState({ editor: null, editorError: null, editorSave: 'idle' })
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  useStore.setState({ editor: null, editorError: null, editorSave: 'idle' })
})

describe('EditorBanner', () => {
  it('renders nothing outside editor mode', () => {
    render()
    expect(host.textContent).toBe('')
  })

  it('names the member and links back to the admin area', () => {
    useStore.setState({ editor: { userId: 'clx9member01', name: 'Ochuko' }, editorSave: 'saved' })
    render()
    expect(host.textContent).toContain('Plan-Editor · Ochuko')
    expect(host.textContent).toContain('Gespeichert')
    expect(host.querySelector('a[href="/admin/mitglieder/clx9member01"]')).toBeTruthy()
  })

  it('offers a retry when the save failed', () => {
    const pushPlan = vi.fn()
    useStore.setState({ editor: { userId: 'clx9member01', name: 'Ochuko' }, editorSave: 'error', pushPlan })
    render()
    const btn = host.querySelector('button')
    expect(btn.textContent).toMatch(/erneut versuchen/)
    act(() => { btn.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(pushPlan).toHaveBeenCalled()
  })

  /* B&S: 409 — der andere Coach hat denselben Plan geändert. Zwei Pläne lassen sich nicht
     zusammenführen, also sagt das Banner es und bietet genau eine Auflösung an. */
  it('names the other coach on a conflict and offers to reload the plan', () => {
    const reloadPlan = vi.fn()
    const pushPlan = vi.fn()
    useStore.setState({ editor: { userId: 'clx9member01', name: 'Ochuko' }, editorSave: 'conflict', reloadPlan, pushPlan })
    render()

    expect(host.textContent).toContain('Ein anderer Coach hat den Plan geändert')
    expect(host.textContent).not.toContain('Gespeichert')
    const btn = host.querySelector('button')
    expect(btn.textContent).toMatch(/Plan neu laden/)
    act(() => { btn.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(reloadPlan).toHaveBeenCalled()
    expect(pushPlan).not.toHaveBeenCalled()
  })

  it('says nothing while a change is still in the debounce', () => {
    useStore.setState({ editor: { userId: 'clx9member01', name: 'Ochuko' }, editorSave: 'idle' })
    render()
    expect(host.textContent).not.toContain('Gespeichert')
    expect(host.textContent).not.toContain('Speichert')
  })

  /* B&S: Der Fehlerblock war nur ein Geschwister der Routen — die volle App lief darunter
     weiter (leeres Vorgabe-Profil, Start-Knopf, Tab-Leiste), nur unter den Bildschirmrand
     geschoben. Jetzt liegt er als eigene Ebene darüber. */
  it('replaces the whole screen when the editor could not open', () => {
    useStore.setState({ editorError: 'Mitglied nicht gefunden.' })
    render()

    expect(host.textContent).toContain('Mitglied nicht gefunden.')
    expect(host.textContent).not.toContain('Plan-Editor ·')
    const deckel = host.querySelector('[data-testid="editor-error"]')
    expect(deckel.style.position).toBe('fixed')
    expect(deckel.style.inset).toBe('0')
    expect(Number(deckel.style.zIndex)).toBeGreaterThanOrEqual(200)   // über Sheets (100) und Toast (200)
    expect(deckel.getAttribute('style')).toContain('background')      // nichts scheint durch
  })
})
