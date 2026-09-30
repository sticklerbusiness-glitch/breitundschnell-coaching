// @vitest-environment happy-dom
/* B&S: Zwei Fragen, die lange dieselbe waren und es nicht sind:
   - `editorMode()` — sehe ich gerade den Stand eines MITGLIEDS an? Dann gehört mir davon nur
     der Plan; alles andere (Training starten, Favoriten, Einstellungen) gehört ihm.
   - `planEditable()` — darf ich den Plan schreiben, der hier auf dem Schirm steht? Das gilt im
     Editor UND im eigenen Bereich eines Coaches: Coaches trainieren selbst, und ihnen schreibt
     niemand einen Plan (api/data.js: selfOwnedPlan). Ohne den zweiten Fall sah ein Coach in
     seiner eigenen App die Lese-Ansicht eines Mitglieds und kam nie an eine eigene Routine. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./api.js', () => ({ api: vi.fn() }))
vi.mock('../store/useUI.js', () => ({ useUI: { getState: () => ({ toast: vi.fn() }) } }))

import { useStore } from '../store/useStore.js'
import { editorMode, planEditable } from './editor-mode.js'

const EDITOR = { userId: 'clx9member01', name: 'Ochuko' }

beforeEach(() => { useStore.setState({ editor: null, user: null }) })

describe('planEditable', () => {
  it('ist für ein Mitglied aus', () => {
    useStore.setState({ user: { id: 'm1', name: 'Ochuko', coach: false } })
    expect(planEditable()).toBe(false)
    expect(editorMode()).toBe(false)
  })

  it('ist für einen Coach in seinem EIGENEN Bereich an', () => {
    useStore.setState({ user: { id: 'c1', name: 'Valentin', coach: true } })
    expect(planEditable()).toBe(true)
    expect(editorMode()).toBe(false)     // er sieht keinen fremden Stand an
  })

  it('ist im Plan-Editor an', () => {
    useStore.setState({ user: { id: 'c1', name: 'Valentin', coach: true }, editor: EDITOR })
    expect(planEditable()).toBe(true)
    expect(editorMode()).toBe(true)
  })

  it('ist ohne Anmeldung aus', () => {
    expect(planEditable()).toBe(false)
    expect(editorMode()).toBe(false)
  })
})
