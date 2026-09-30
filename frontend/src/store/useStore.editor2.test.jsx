// @vitest-environment happy-dom

/* B&S: Zweite Runde Plan-Editor. Was hier steht, ist jeweils genau der Weg, auf dem der Coach
   im Betrieb eine Änderung verloren oder eine falsche Meldung gelesen hat:
   - der Abschieds-Push beim Tab-Wechsel lief an der Ein-PUT-Sperre vorbei (Konflikt mit sich selbst),
   - `keepalive` wurde in Zeichen statt in Bytes gemessen,
   - bootEditor räumte die Login-Schleifen-Marke nicht weg,
   - ein gescheitertes „Plan neu laden“ meldete „Fehler beim Speichern“,
   - eine Änderung während des Neuladens hinterließ einen Phantom-Push,
   - eine Änderung an einer eigenen Übung des MITGLIEDS wurde angewendet, aber nie gespeichert,
   - `?direkt=1` flog zusammen mit `?kunde=` aus der Adresse. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/api.js', () => ({ api: vi.fn() }))
const { toast } = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('./useUI.js', () => ({ useUI: { getState: () => ({ toast }) } }))

import { api } from '../lib/api.js'
import { DEF, useStore } from './useStore.js'

const clone = v => JSON.parse(JSON.stringify(v))
const routine = (id, ex = []) => ({ id, name: id, ex })
const puts = () => api.mock.calls.filter(([, o]) => o?.method === 'PUT')
const fresh = { S: clone(DEF), user: null, ready: false, editor: null, editorError: null, editorSave: 'idle', editorBoot: false, editorRev: null }
const tick = () => new Promise(r => setTimeout(r, 0))

const MEMBER = 'clx9member01'
const coach = { id: 'coach-1', name: 'Valentin', coach: true }
// c-used hängt in der Routine (Plan-Seite), c-eigen hat das Mitglied selbst angelegt.
const memberState = {
  ...clone(DEF), _ts: 77,
  routines: [routine('r-member', [{ id: '0001', sets: 3 }, { id: 'c-used' }])],
  week: { 1: ['r-member'] },
  customEx: [{ id: 'c-used', n: 'Schlittenschub' }, { id: 'c-eigen', n: 'Sled Push' }],
  workouts: [{ id: 'w1', d: '2026-09-01', entries: [] }]
}
const ownProfile = { ...clone(DEF), _ts: 42, routines: [routine('coach-eigene')] }

const asCoach = (suche = '?kunde=' + MEMBER) => {
  localStorage.setItem('gym_state_v1', JSON.stringify(ownProfile))
  localStorage.setItem('gym_owner', coach.id)
  localStorage.setItem('gym_user', JSON.stringify(coach))
  localStorage.setItem('gym_sync', JSON.stringify({ rev: 9, ts: 42 }))
  history.replaceState({}, '', '/training/' + suche + '#/plan')
  api.mockImplementation(async (path, opts) => {
    if (path === '/api/me') return { user: coach }
    if (path.startsWith('/api/trainer/stand')) return { user: { id: MEMBER, name: 'Ochuko' }, state: clone(memberState), rev: 3 }
    if (path.startsWith('/api/trainer/plan') && opts?.method === 'PUT') return { ok: true, rev: 4 }
    throw Object.assign(new Error('unexpected ' + path), { status: 500 })
  })
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  api.mockReset()
  toast.mockReset()
  useStore.setState(clone(fresh))
})
afterEach(() => {
  vi.useRealTimers()
  localStorage.clear()
  sessionStorage.clear()
  useStore.setState(clone(fresh))
  history.replaceState({}, '', '/')
})

describe('der Abschieds-Push beim Verlassen der Seite', () => {
  it('wartet auf den laufenden PUT, statt mit demselben baseRev daneben zu rennen', async () => {
    asCoach()
    await useStore.getState().boot()
    api.mockClear()
    let erledige
    api.mockImplementationOnce(() => new Promise(r => { erledige = () => r({ ok: true, rev: 4 }) }))
    api.mockImplementation(async () => ({ ok: true, rev: 5 }))

    const erster = useStore.getState().pushPlan()          // P1 unterwegs, baseRev 3
    useStore.getState().update(s => { s.week = { 2: ['r-member'] } })   // E2 liegt in der Sammlung
    window.dispatchEvent(new Event('pagehide'))            // flush() → keepalive-Push
    // Erst messen, dann P1 beantworten: ein früher Abbruch ließe den PUT hängen.
    const waehrendP1 = puts().length

    erledige()
    await erster
    await tick()

    expect(waehrendP1).toBe(1)                             // NICHT zwei mit demselben baseRev
    expect(puts()).toHaveLength(2)
    expect(JSON.parse(puts()[1][1].body).baseRev).toBe(4)  // der Nachzügler kennt die neue Revision
    expect(useStore.getState().editorSave).toBe('saved')   // kein Konflikt mit sich selbst
  })

  it('misst die keepalive-Grenze in Bytes, nicht in Zeichen', async () => {
    asCoach()
    await useStore.getState().boot()
    api.mockClear()
    // 40 000 Umlaute: als String unter der Grenze, als UTF-8 mit 80 000 Bytes weit darüber.
    useStore.getState().update(s => { s.routines[0].ex[0].note = 'ä'.repeat(40000) })
    window.dispatchEvent(new Event('pagehide'))
    await tick()

    expect(puts()).toHaveLength(1)
    expect(puts()[0][1].keepalive).toBeFalsy()
  })

  it('schickt einen kleinen Plan weiterhin mit keepalive', async () => {
    asCoach()
    await useStore.getState().boot()
    api.mockClear()
    useStore.getState().update(s => { s.week = { 2: ['r-member'] } })
    window.dispatchEvent(new Event('pagehide'))
    await tick()

    expect(puts()).toHaveLength(1)
    expect(puts()[0][1].keepalive).toBe(true)
  })
})

describe('bootEditor und die Login-Schleifen-Marke', () => {
  it('räumt die Marke weg, sobald der Stand des Mitglieds da ist', async () => {
    sessionStorage.setItem('gym_login_bounce', '1')
    asCoach()

    await useStore.getState().boot()

    expect(useStore.getState().user).toEqual(coach)
    expect(sessionStorage.getItem('gym_login_bounce')).toBeNull()
  })
})

describe('Plan neu laden', () => {
  it('meldet einen Ladefehler als Ladefehler, nicht als Speicherfehler', async () => {
    asCoach()
    await useStore.getState().boot()
    api.mockReset()
    api.mockRejectedValue(Object.assign(new Error('offline'), { status: null }))

    await useStore.getState().reloadPlan()

    expect(useStore.getState().editorSave).toBe('reload-error')
  })

  it('lässt keinen Phantom-Push zurück, wenn währenddessen etwas geändert wird', async () => {
    vi.useFakeTimers()
    asCoach()
    await useStore.getState().boot()
    api.mockReset()
    let liefere
    api.mockImplementationOnce(() => new Promise(r => {
      liefere = () => r({ user: { id: MEMBER, name: 'Ochuko' }, state: { ...clone(memberState), week: { 5: ['r-member'] } }, rev: 8 })
    }))
    api.mockImplementation(async () => ({ ok: true, rev: 9 }))

    const laden = useStore.getState().reloadPlan()
    useStore.getState().update(s => { s.week = { 2: ['r-member'] } })   // Änderung während des Ladens
    liefere()
    await laden
    await vi.advanceTimersByTimeAsync(5000)

    expect(useStore.getState().S.week).toEqual({ 5: ['r-member'] })
    expect(puts()).toHaveLength(0)                       // kein Push auf den gerade geladenen Stand
    expect(toast).toHaveBeenCalled()                     // und der Verlust wird gesagt
  })
})

describe('eigene Übungen des Mitglieds sind im Editor tabu', () => {
  it('nimmt eine Umbenennung gar nicht erst an, statt „Gespeichert“ zu melden', async () => {
    vi.useFakeTimers()
    asCoach()
    await useStore.getState().boot()
    api.mockClear()

    useStore.getState().update(s => { s.customEx.find(e => e.id === 'c-eigen').n = 'Umbenannt' })
    await vi.advanceTimersByTimeAsync(5000)

    expect(useStore.getState().S.customEx.find(e => e.id === 'c-eigen').n).toBe('Sled Push')
    expect(puts()).toHaveLength(0)
    expect(useStore.getState().editorSave).toBe('idle')
    expect(toast).toHaveBeenCalled()
  })

  it('lässt die Übung aus dem Plan weiterhin ändern', async () => {
    vi.useFakeTimers()
    asCoach()
    await useStore.getState().boot()
    api.mockClear()

    useStore.getState().update(s => { s.customEx.find(e => e.id === 'c-used').n = 'Schlitten schieben' })
    await vi.advanceTimersByTimeAsync(2000)

    expect(useStore.getState().S.customEx.find(e => e.id === 'c-used').n).toBe('Schlitten schieben')
    expect(puts()).toHaveLength(1)
  })
})

/* B&S: Der Server kürzt einen zu großen Plan und verwirft eine Übung, die dem Mitglied
   gehört — und antwortet dabei 200 mit `gekuerzt`/`fremdeUebungen` (api/trainer/plan.js).
   Ohne diese Meldung stand „Gespeichert“ über einem Plan, den der Server so nie hatte. */
describe('was der Server beim Speichern verworfen hat', () => {
  it('sagt eine Kürzung samt Grenze', async () => {
    asCoach()
    await useStore.getState().boot()
    api.mockReset()
    api.mockResolvedValue({ ok: true, rev: 4, gekuerzt: { ex: 2, routines: 1 } })

    await useStore.getState().pushPlan()
    await tick()                                         // hinweis() hängt an einem import()

    expect(useStore.getState().editorSave).toBe('saved')
    const texte = toast.mock.calls.map(c => c[0]).join(' | ')
    expect(texte).toContain('gekürzt')
    expect(texte).toContain('40')
  })

  it('sagt eine verworfene Übung des Mitglieds — und zwar genau einmal', async () => {
    asCoach()
    await useStore.getState().boot()
    api.mockReset()
    api.mockResolvedValue({ ok: true, rev: 4, fremdeUebungen: ['c-eigen'] })

    await useStore.getState().pushPlan()
    await tick()
    expect(toast.mock.calls.map(c => c[0]).join(' | ')).toContain('Mitglieds')

    // B&S: Derselbe Hinweis kommt bei jedem weiteren Push zurück — er darf nicht jedes Mal
    // einen Toast über die Meldungen legen, auf die es im Editor ankommt.
    await useStore.getState().pushPlan()
    await tick()
    expect(toast).toHaveBeenCalledTimes(1)
  })

  it('schweigt, wenn alles durchging', async () => {
    asCoach()
    await useStore.getState().boot()
    api.mockReset()
    api.mockResolvedValue({ ok: true, rev: 4 })

    await useStore.getState().pushPlan()
    await tick()

    expect(toast).not.toHaveBeenCalled()
  })
})

describe('?direkt=1', () => {
  it('überlebt, wenn ?kunde= aus der Adresse fliegt', async () => {
    localStorage.setItem('gym_state_v1', JSON.stringify(ownProfile))
    history.replaceState({}, '', '/training/?kunde=' + MEMBER + '&direkt=1#/plan')
    api.mockImplementation(async path => {
      if (path === '/api/me') return { user: { id: 'm1', name: 'Ochuko', coach: false } }
      if (path.startsWith('/api/data')) return { state: null, rev: 0 }
      throw Object.assign(new Error('unexpected ' + path), { status: 500 })
    })

    await useStore.getState().boot()

    expect(new URLSearchParams(location.search).get('kunde')).toBeNull()
    expect(new URLSearchParams(location.search).get('direkt')).toBe('1')
  })
})
