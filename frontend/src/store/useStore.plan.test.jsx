// @vitest-environment happy-dom

/* B&S: Der Trainingsplan gehört den Coaches, das Log dem Mitglied.
   - Jede Antwort auf PUT /api/data trägt den Plan des Servers zurück: er wird übernommen,
     ohne zu stempeln und ohne einen weiteren Push (sonst schaukeln sich Push und Re-Render auf).
   - Mit `?kunde=<id>` sieht ein Coach den Stand eines Mitglieds an. Solange das läuft, bleibt
     der localStorage unberührt — dort liegt sein eigenes Profil — und Änderungen gehen als
     Plan an PUT /api/trainer/plan, nie an /api/data. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/api.js', () => ({ api: vi.fn() }))
const { toast } = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('./useUI.js', () => ({ useUI: { getState: () => ({ toast }) } }))

import { api } from '../lib/api.js'
import { DEF, useStore } from './useStore.js'
import { readEditorParam } from '../lib/editor-mode.js'

const clone = v => JSON.parse(JSON.stringify(v))
const routine = (id, ex = []) => ({ id, name: id, ex })
const puts = () => api.mock.calls.filter(([, o]) => o?.method === 'PUT')
const paths = () => api.mock.calls.map(([p]) => p)
const signedIn = (S, extra = {}) => useStore.setState({ S, user: { id: 'user-1' }, ready: true, ...extra })
const fresh = { S: clone(DEF), user: null, ready: false, editor: null, editorError: null, editorSave: 'idle', editorBoot: false, editorRev: null }
// Der Hinweis-Toast hängt an einem dynamischen import() — ein Tick, bis er da ist.
const tick = () => new Promise(r => setTimeout(r, 0))

beforeEach(() => { localStorage.clear(); api.mockReset(); toast.mockReset(); useStore.setState(clone(fresh)) })
afterEach(() => { vi.useRealTimers(); localStorage.clear(); useStore.setState(clone(fresh)); history.replaceState({}, '', '/') })

describe('the plan the server sends back with every push', () => {
  it('is re-applied without stamping and without arming another push', async () => {
    vi.useFakeTimers()
    signedIn({ ...clone(DEF), _ts: 500, routines: [routine('alt')], week: { 1: ['alt'] }, customEx: [{ id: 'c1', n: 'Meine Übung' }] })
    localStorage.setItem('gym_sync', JSON.stringify({ rev: 1, ts: 100 }))
    api.mockResolvedValueOnce({ ok: true, rev: 2, plan: { routines: [routine('coach')], week: { 2: ['coach'] }, customEx: [{ id: 'c2', n: 'Vom Coach' }] } })

    await useStore.getState().pushState()

    const S = useStore.getState().S
    expect(S.routines.map(r => r.id)).toEqual(['coach'])
    expect(S.week).toEqual({ 2: ['coach'] })
    expect(S.customEx.map(e => e.id)).toEqual(['c2', 'c1'])   // Plan gewinnt, eigene bleiben
    expect(S._ts).toBe(500)                                   // nicht gestempelt
    expect(JSON.parse(localStorage.getItem('gym_state_v1')).routines.map(r => r.id)).toEqual(['coach'])
    expect(JSON.parse(localStorage.getItem('gym_sync'))).toEqual({ rev: 2, ts: 500 })

    await vi.advanceTimersByTimeAsync(5000)
    expect(puts()).toHaveLength(1)
  })

  it('leaves the state object alone when the plan already matches', async () => {
    signedIn({ ...clone(DEF), _ts: 500, routines: [routine('coach')], week: { 2: ['coach'] }, customEx: [{ id: 'c2', n: 'Vom Coach' }] })
    const before = useStore.getState().S
    api.mockResolvedValueOnce({ ok: true, rev: 2, plan: { routines: [routine('coach')], week: { 2: ['coach'] }, customEx: [{ id: 'c2', n: 'Vom Coach' }] } })

    await useStore.getState().pushState()

    expect(useStore.getState().S).toBe(before)
  })

  it('an empty plan clears a routine the coaches deleted', async () => {
    signedIn({ ...clone(DEF), _ts: 500, routines: [routine('weg')], week: { 1: ['weg'] } })
    api.mockResolvedValueOnce({ ok: true, rev: 2, plan: { routines: [], week: {}, customEx: [] } })

    await useStore.getState().pushState()

    expect(useStore.getState().S.routines).toEqual([])
    expect(useStore.getState().S.week).toEqual({})
  })

  /* B&S: Eine Übung, die ein Coach angelegt hat, trägt `src:'coach'` und gehört zum Plan.
     Vorher war `customEx` eine reine Vereinigung: nahm der Coach die Übung aus jeder Routine,
     blieb sie als „eigene“ Übung des Mitglieds zurück, an die kein Coach mehr herankam. */
  it('drops a coach exercise the plan no longer carries', async () => {
    signedIn({
      ...clone(DEF), _ts: 500,
      customEx: [{ id: 'c-coach', n: 'Sled Push B&S', src: 'coach' }, { id: 'c-eigen', n: 'Meine Übung' }]
    })
    api.mockResolvedValueOnce({ ok: true, rev: 2, plan: { routines: [], week: {}, customEx: [] } })

    await useStore.getState().pushState()

    expect(useStore.getState().S.customEx.map(e => e.id)).toEqual(['c-eigen'])
  })

  it('keeps a coach exercise the member has already trained — as the member’s own', async () => {
    signedIn({
      ...clone(DEF), _ts: 500,
      customEx: [{ id: 'c-coach', n: 'Sled Push B&S', src: 'coach' }],
      workouts: [{ id: 'w1', d: '2026-09-01', entries: [{ id: 'c-coach', sets: [] }] }]
    })
    api.mockResolvedValueOnce({ ok: true, rev: 2, plan: { routines: [], week: {}, customEx: [] } })

    await useStore.getState().pushState()

    const ex = useStore.getState().S.customEx
    expect(ex.map(e => e.id)).toEqual(['c-coach'])     // in der History stünde sonst „Unbekannte Übung“
    expect(ex[0].src).toBeUndefined()                  // ab jetzt gehört sie ihm
  })
})

describe('editor mode', () => {
  const MEMBER = 'clx9member01'
  const coach = { id: 'coach-1', name: 'Valentin', coach: true }
  // 0001 = "3/4 sit-up" aus dem Katalog, c-used/c-unused sind eigene Übungen des Mitglieds
  const memberState = {
    ...clone(DEF), _ts: 77,
    routines: [routine('r-member', [{ id: '0001', sets: 3 }, { id: 'c-used' }])],
    week: { 1: ['r-member'] },
    customEx: [{ id: 'c-used', n: 'Schlittenschub' }, { id: 'c-unused', n: 'Alte Übung' }],
    workouts: [{ id: 'w1', d: '2026-09-01', entries: [] }]
  }
  const ownProfile = { ...clone(DEF), _ts: 42, routines: [routine('coach-eigene')] }

  const asCoach = () => {
    localStorage.setItem('gym_state_v1', JSON.stringify(ownProfile))
    localStorage.setItem('gym_owner', coach.id)
    localStorage.setItem('gym_user', JSON.stringify(coach))
    localStorage.setItem('gym_sync', JSON.stringify({ rev: 9, ts: 42 }))
    history.replaceState({}, '', '/training/?kunde=' + MEMBER + '#/plan')
    api.mockImplementation(async (path, opts) => {
      if (path === '/api/me') return { user: coach }
      if (path.startsWith('/api/trainer/stand')) return { user: { id: MEMBER, name: 'Ochuko' }, state: clone(memberState), rev: 3 }
      if (path.startsWith('/api/trainer/plan') && opts?.method === 'PUT') return { ok: true, rev: 4 }
      throw Object.assign(new Error('unexpected ' + path), { status: 500 })
    })
  }
  // Was im localStorage liegt, ist das Profil des Coaches — jeder Zugriff darauf ist ein Fehler.
  const watchStorage = () => {
    const desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    const real = globalThis.localStorage
    const touched = []
    const spy = new Proxy(real, {
      get(target, prop) {
        const v = Reflect.get(target, prop)
        if (prop === 'setItem' || prop === 'removeItem' || prop === 'getItem') {
          return (...args) => { touched.push(prop + ' ' + args[0]); return v.apply(target, args) }
        }
        return typeof v === 'function' ? v.bind(target) : v
      }
    })
    Object.defineProperty(globalThis, 'localStorage', { value: spy, configurable: true })
    return { touched, stop: () => Object.defineProperty(globalThis, 'localStorage', desc) }
  }

  it('reads the member id out of the query string', () => {
    history.replaceState({}, '', '/training/?kunde=' + MEMBER + '#/plan')
    expect(readEditorParam()).toBe(MEMBER)
    history.replaceState({}, '', '/training/?kunde=nope#/plan')
    expect(readEditorParam()).toBeNull()
    history.replaceState({}, '', '/training/#/plan')
    expect(readEditorParam()).toBeNull()
  })

  it('boots on the member stand without reading or writing the coach profile', async () => {
    asCoach()
    const raw = localStorage.getItem('gym_state_v1')
    const w = watchStorage()
    try { await useStore.getState().boot() } finally { w.stop() }

    expect(useStore.getState().editor).toEqual({ userId: MEMBER, name: 'Ochuko' })
    expect(useStore.getState().editorError).toBeNull()
    expect(useStore.getState().user).toEqual(coach)
    expect(useStore.getState().S.routines.map(r => r.id)).toEqual(['r-member'])
    expect(useStore.getState().S.lang).toBe('de')
    expect(w.touched).toEqual([])
    expect(localStorage.getItem('gym_state_v1')).toBe(raw)
    expect(paths()).toEqual(['/api/me', '/api/trainer/stand?user=' + MEMBER])
  })

  it('saves a change as the plan of that member, with only the exercises it uses', async () => {
    vi.useFakeTimers()
    asCoach()
    await useStore.getState().boot()
    api.mockClear()
    const w = watchStorage()
    try {
      useStore.getState().update(s => { s.routines[0].ex.push({ id: 'c-used', note: 'Coach-Tipp' }) })
      expect(useStore.getState().editorSave).toBe('idle')
      await vi.advanceTimersByTimeAsync(1600)
    } finally { w.stop() }

    expect(w.touched).toEqual([])
    expect(puts()).toHaveLength(1)
    const [path, opts] = puts()[0]
    expect(path).toBe('/api/trainer/plan?user=' + MEMBER)
    const body = JSON.parse(opts.body)
    expect(body.routines[0].ex.map(e => e.id)).toEqual(['0001', 'c-used', 'c-used'])
    expect(body.week).toEqual({ 1: ['r-member'] })
    expect(body.customEx.map(e => e.id)).toEqual(['c-used'])          // c-unused ist in keiner Routine
    expect(body.namen).toEqual({ '0001': '3/4 sit-up', 'c-used': 'Schlittenschub' })
    expect(useStore.getState().editorSave).toBe('saved')
    expect(paths().some(p => p.startsWith('/api/data'))).toBe(false)
  })

  it('reports a failed save and retries on demand', async () => {
    vi.useFakeTimers()
    asCoach()
    await useStore.getState().boot()
    api.mockRejectedValueOnce(Object.assign(new Error('HTTP 500'), { status: 500 }))

    useStore.getState().update(s => { s.week = { 2: ['r-member'] } })
    await vi.advanceTimersByTimeAsync(1600)
    expect(useStore.getState().editorSave).toBe('error')

    await useStore.getState().pushPlan()
    expect(useStore.getState().editorSave).toBe('saved')
  })

  it('never polls the revision or pushes the state while it is on', async () => {
    vi.useFakeTimers()
    asCoach()
    await useStore.getState().boot()
    api.mockClear()

    window.dispatchEvent(new Event('online'))
    window.dispatchEvent(new Event('focus'))
    document.dispatchEvent(new Event('visibilitychange'))
    await useStore.getState().pushState()
    await useStore.getState().pullState()
    await vi.advanceTimersByTimeAsync(60000)

    expect(api).not.toHaveBeenCalled()
  })

  it('a storage event from another tab does not wipe the member stand', async () => {
    asCoach()
    await useStore.getState().boot()

    localStorage.setItem('gym_owner', 'someone-else')
    window.dispatchEvent(new StorageEvent('storage', { key: 'gym_owner', oldValue: coach.id, newValue: 'someone-else' }))

    expect(useStore.getState().user).toEqual(coach)
    expect(useStore.getState().S.routines.map(r => r.id)).toEqual(['r-member'])
  })

  /* B&S: Ein Mitglied, dem der Link weitergereicht wurde, bekam früher einen Fehlerbildschirm,
     unter dem die volle App auf einem leeren Vorgabe-Profil weiterlief: alles bedienbar, nichts
     gespeichert, das geloggte Training beim Neuladen weg. Diesen Zustand gibt es nicht mehr —
     der Parameter fliegt aus der Adresse und es landet in seinem eigenen Bereich. */
  it('sends a member who opens the editor link into their own app, with a hint', async () => {
    const mitglied = { id: 'clx9member99', name: 'Wer', coach: false }
    const eigenes = { ...clone(DEF), _ts: 500, routines: [routine('mein-plan')], workouts: [{ id: 'w1', d: '2026-09-01', entries: [] }] }
    localStorage.setItem('gym_state_v1', JSON.stringify(eigenes))
    localStorage.setItem('gym_owner', mitglied.id)
    localStorage.setItem('gym_sync', JSON.stringify({ rev: 5, ts: 500 }))
    history.replaceState({}, '', '/training/?kunde=' + MEMBER + '#/plan')
    api.mockImplementation(async path => {
      if (path === '/api/me') return { user: mitglied }
      if (path === '/api/data') return { state: clone(eigenes), rev: 5 }
      throw Object.assign(new Error('unexpected ' + path), { status: 500 })
    })

    await useStore.getState().boot()
    await tick()

    expect(useStore.getState().editorError).toBeNull()
    expect(useStore.getState().editor).toBeNull()
    expect(useStore.getState().editorBoot).toBe(false)
    expect(useStore.getState().user).toEqual(mitglied)
    expect(useStore.getState().ready).toBe(true)
    expect(useStore.getState().S.routines.map(r => r.id)).toEqual(['mein-plan'])
    expect(location.search).toBe('')                 // der Coach-Link ist aus der Adresse raus
    expect(readEditorParam()).toBeNull()
    expect(toast.mock.calls.flat().join(' ')).toContain('für Coaches')
    expect(paths().some(p => p.startsWith('/api/trainer/'))).toBe(false)
  })

  /* B&S: Der Editor-Modus war pro Bildschirm gegattert, nicht pro Schreibvorgang. Jede
     Änderung — Workout löschen, Favoriten-Stern, Session-Notiz — wurde angewendet, zeigte ein
     Ergebnis, erreichte nie den Server und löste trotzdem einen Plan-Push samt rev-Erhöhung
     aus. Die Grenze liegt jetzt im Store: nur der Plan geht durch. */
  it('refuses a change that is not the plan — no screen effect, no push, no rev bump', async () => {
    vi.useFakeTimers()
    asCoach()
    await useStore.getState().boot()
    api.mockClear()
    const vorher = useStore.getState().S

    useStore.getState().update(s => { s.workouts = [] })          // „Workout löschen“ in der History

    expect(useStore.getState().S).toBe(vorher)                    // die Einheit steht noch da
    expect(useStore.getState().editorSave).toBe('idle')
    await vi.advanceTimersByTimeAsync(5000)
    expect(api).not.toHaveBeenCalled()
    expect(toast.mock.calls.flat().join(' ')).toContain('Im Plan-Editor kannst du nur den Plan ändern.')
  })

  it('refuses every member-owned field the editor can still reach', async () => {
    vi.useFakeTimers()
    asCoach()
    await useStore.getState().boot()
    api.mockClear()

    useStore.getState().update(s => { s.favEx = ['0001'] })       // Favoriten-Stern
    useStore.getState().update(s => { s.dayPlan = { '2026-10-01': 'r-member' } })
    useStore.getState().update(s => { s.restSec = 120 })
    await vi.advanceTimersByTimeAsync(5000)

    expect(useStore.getState().S.favEx).toEqual([])
    expect(useStore.getState().S.dayPlan).toEqual({})
    expect(useStore.getState().S.restSec).toBe(DEF.restSec)
    expect(api).not.toHaveBeenCalled()
  })

  /* B&S: Eine echte Plan-Änderung räumt nebenbei im Stand des Mitglieds auf — „Routine löschen“
     nimmt die id auch aus dayPlan, „Übung löschen“ aus exWeights/favEx/History. Die Absicht des
     Coaches muss durchgehen; die Nebenwirkungen bleiben beim Mitglied stehen. */
  it('deletes a routine although the clean-up also touches the member’s dayPlan', async () => {
    vi.useFakeTimers()
    asCoach()
    await useStore.getState().boot()
    useStore.setState({ S: { ...useStore.getState().S, dayPlan: { '2026-10-01': 'r-member' } } })
    api.mockClear()

    useStore.getState().update(s => {              // genau das tut views/RoutineEdit.jsx
      s.routines = s.routines.filter(r => r.id !== 'r-member')
      delete s.week[1]
      delete s.dayPlan['2026-10-01']
    })
    await vi.advanceTimersByTimeAsync(1600)

    expect(useStore.getState().S.routines).toEqual([])
    expect(useStore.getState().S.week).toEqual({})
    expect(useStore.getState().S.dayPlan).toEqual({ '2026-10-01': 'r-member' })   // gehört dem Mitglied
    expect(toast).not.toHaveBeenCalled()
    expect(JSON.parse(puts()[0][1].body).routines).toEqual([])
  })

  it('removes a coach exercise although the clean-up also touches the member’s log', async () => {
    vi.useFakeTimers()
    asCoach()
    await useStore.getState().boot()
    useStore.setState({ S: { ...useStore.getState().S, exWeights: { 'c-used': { w: 60 } }, favEx: ['c-used'] } })
    api.mockClear()

    useStore.getState().update(s => {              // genau das tut deleteCustomEx in sheets.jsx
      s.customEx = s.customEx.filter(e => e.id !== 'c-used')
      s.routines.forEach(r => { r.ex = r.ex.filter(e => e.id !== 'c-used') })
      delete s.exWeights['c-used']
      s.favEx = []
    })
    await vi.advanceTimersByTimeAsync(1600)

    expect(useStore.getState().S.customEx.map(e => e.id)).toEqual(['c-unused'])
    expect(useStore.getState().S.routines[0].ex.map(e => e.id)).toEqual(['0001'])
    expect(useStore.getState().S.exWeights).toEqual({ 'c-used': { w: 60 } })       // PR des Mitglieds
    expect(useStore.getState().S.favEx).toEqual(['c-used'])
    expect(toast).not.toHaveBeenCalled()
    expect(puts()).toHaveLength(1)
  })

  it('never reports "Gespeichert" over a change that is still in the debounce', async () => {
    vi.useFakeTimers()
    asCoach()
    await useStore.getState().boot()

    useStore.getState().update(s => { s.week = { 2: ['r-member'] } })
    await vi.advanceTimersByTimeAsync(1600)
    expect(useStore.getState().editorSave).toBe('saved')

    useStore.getState().update(s => { s.week = { 3: ['r-member'] } })
    expect(useStore.getState().editorSave).toBe('idle')
  })

  /* B&S: Beide Coaches sehen alle Mitglieder, und ein Editor-Tab lädt nie nach. Der Stand, auf
     dem er sitzt, geht als `baseRev` mit — sonst schreibt ein Tab vom Vormittag den ganzen
     Nachmittag des anderen Coaches still weg. */
  it('sends the revision it loaded as baseRev and takes the new one from the answer', async () => {
    vi.useFakeTimers()
    asCoach()
    await useStore.getState().boot()
    expect(useStore.getState().editorRev).toBe(3)
    api.mockClear()

    useStore.getState().update(s => { s.week = { 2: ['r-member'] } })
    await vi.advanceTimersByTimeAsync(1600)

    expect(JSON.parse(puts()[0][1].body).baseRev).toBe(3)
    expect(useStore.getState().editorRev).toBe(4)
  })

  it('names the other coach on 409 and reloads the plan on demand', async () => {
    vi.useFakeTimers()
    asCoach()
    await useStore.getState().boot()
    api.mockClear()
    api.mockRejectedValueOnce(Object.assign(new Error('conflict'), {
      status: 409, data: { error: 'conflict', rev: 8, plan: { routines: [], week: {}, customEx: [] } }
    }))

    useStore.getState().update(s => { s.week = { 2: ['r-member'] } })
    await vi.advanceTimersByTimeAsync(1600)

    expect(useStore.getState().editorSave).toBe('conflict')
    expect(useStore.getState().S.week).toEqual({ 2: ['r-member'] })   // die eigene Änderung steht noch
    expect(useStore.getState().editorRev).toBe(3)                     // nicht heimlich nachgezogen

    api.mockReset()
    api.mockImplementation(async path => {
      if (path.startsWith('/api/trainer/stand')) {
        return { user: { id: MEMBER, name: 'Ochuko' }, state: { ...clone(memberState), week: { 5: ['r-member'] } }, rev: 8 }
      }
      throw Object.assign(new Error('unexpected ' + path), { status: 500 })
    })
    await useStore.getState().reloadPlan()

    expect(useStore.getState().S.week).toEqual({ 5: ['r-member'] })   // eigene Änderung verworfen
    expect(useStore.getState().editorRev).toBe(8)
    expect(useStore.getState().editorSave).toBe('idle')
  })

  it('keeps one plan PUT in flight and folds the next one in behind it', async () => {
    asCoach()
    await useStore.getState().boot()
    api.mockClear()
    let erledige
    api.mockImplementationOnce(() => new Promise(r => { erledige = () => r({ ok: true, rev: 4 }) }))
    api.mockImplementation(async () => ({ ok: true, rev: 5 }))

    const erster = useStore.getState().pushPlan()
    const zweiter = useStore.getState().pushPlan()
    expect(puts()).toHaveLength(1)                   // der zweite wartet, statt mit demselben baseRev zu rennen

    erledige()
    await Promise.all([erster, zweiter])

    expect(puts()).toHaveLength(2)
    expect(JSON.parse(puts()[1][1].body).baseRev).toBe(4)   // der Nachzügler kennt schon die neue Revision
    expect(useStore.getState().editorRev).toBe(5)
  })

  /* B&S: Eine im Editor angelegte Übung gehört dem Coach (`src:'coach'`) und fährt auch dann
     mit dem Plan, wenn noch keine Routine sie benutzt — der Editor schreibt nichts in den
     localStorage, sie wäre sonst nach einem Neuladen spurlos weg. */
  it('marks an exercise the coach creates and carries it before a routine uses it', async () => {
    vi.useFakeTimers()
    asCoach()
    await useStore.getState().boot()
    api.mockClear()

    useStore.getState().update(s => { s.customEx = [...s.customEx, { id: 'c-neu', n: 'Schlittenschub B&S', custom: true }] })
    await vi.advanceTimersByTimeAsync(1600)

    const body = JSON.parse(puts()[0][1].body)
    expect(body.customEx.map(e => e.id)).toEqual(['c-used', 'c-neu'])   // c-unused gehört dem Mitglied
    expect(body.customEx.find(e => e.id === 'c-neu').src).toBe('coach')
    expect(body.customEx.find(e => e.id === 'c-used').src).toBeUndefined()
  })

  /* B&S: Zwischen /api/me und /api/trainer/stand lag ein Fenster, in dem `user` schon stand,
     `editor` aber noch nicht: App.jsx zeigte die volle App auf einem leeren Vorgabe-Profil, und
     ein einziger Tipper darin ersetzte das gespeicherte Profil des Coaches durch die Vorgaben. */
  it('holds the loading screen and the coach profile until the member stand is there', async () => {
    asCoach()
    let liefereStand
    const stand = new Promise(r => { liefereStand = r })
    api.mockImplementation(async path => {
      if (path === '/api/me') return { user: coach }
      if (path.startsWith('/api/trainer/stand')) return stand
      throw Object.assign(new Error('unexpected ' + path), { status: 500 })
    })

    const raw = localStorage.getItem('gym_state_v1')
    const w = watchStorage()
    const laeuft = useStore.getState().boot()
    await vi.waitFor(() => expect(paths()).toContain('/api/trainer/stand?user=' + MEMBER))

    expect(useStore.getState().editorBoot).toBe(true)
    expect(useStore.getState().user).toBeNull()      // App.jsx hält den Ladebildschirm
    useStore.getState().update(s => { s.routines = [routine('vertippt')] })

    liefereStand({ user: { id: MEMBER, name: 'Ochuko' }, state: clone(memberState), rev: 3 })
    await laeuft
    w.stop()

    expect(w.touched).toEqual([])
    expect(localStorage.getItem('gym_state_v1')).toBe(raw)
    expect(useStore.getState().editorBoot).toBe(false)
  })
})
