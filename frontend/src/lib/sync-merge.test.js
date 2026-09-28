import { describe, expect, it } from 'vitest'
import { localExtras, mergeBodyweight, mergeStates, newerOf, unionById } from './sync-merge.js'

const workout = (id, d = '2026-09-01', start = 1) => ({ id, d, start, entries: [] })
const routine = (id, name = id) => ({ id, name, ex: [] })
const base = (over = {}) => ({
  unit: 'kg', restSec: 90, lang: 'en', week: { 1: ['r1'] }, dayPlan: {},
  workouts: [], routines: [], bodyweight: [], customEx: [], favEx: [], exWeights: {}, exNotes: {}, barWeights: {},
  equipProfiles: [], gymCards: [], _ts: 0, ...over
})
const ids = xs => (xs || []).map(x => x.id)

describe('newerOf / unionById / mergeBodyweight', () => {
  it('picks the later _ts, first argument on a tie or missing stamps', () => {
    const a = { _ts: 5 }, b = { _ts: 9 }
    expect(newerOf(a, b)).toBe(b)
    expect(newerOf(b, a)).toBe(b)
    expect(newerOf({ _ts: 5 }, { _ts: 5 })).toEqual({ _ts: 5 })
    expect(newerOf({}, { })).toEqual({})
  })
  it('unions by id in the newer order, newer wins a shared id, dupes dropped', () => {
    const out = unionById([routine('a', 'A2'), routine('b'), routine('b')], [routine('c'), routine('a', 'A1')])
    expect(ids(out)).toEqual(['a', 'b', 'c'])
    expect(out[0].name).toBe('A2')
    expect(unionById(undefined, null)).toEqual([])
  })
  it('bodyweight: one entry per day, the later-edited one, sorted', () => {
    const out = mergeBodyweight([{ d: '2026-09-02', w: 80, t: 5 }], [{ d: '2026-09-01', w: 81, t: 1 }, { d: '2026-09-02', w: 79, t: 9 }])
    expect(out).toEqual([{ d: '2026-09-01', w: 81, t: 1 }, { d: '2026-09-02', w: 79, t: 9 }])
  })
})

describe('mergeStates', () => {
  const A = () => base({
    _ts: 200, restSec: 120, week: { 1: ['rA'] },
    workouts: [workout('w1'), workout('wA', '2026-09-03')],
    routines: [routine('shared', 'from A'), routine('onlyA')],
    bodyweight: [{ d: '2026-09-01', w: 80, t: 10 }],
    customEx: [{ id: 'cA', name: 'A ex' }], favEx: ['x', 'y'],
    exWeights: { sq: { w: 100 }, bp: { w: 60 } }, exNotes: { sq: 'A note' }, barWeights: { sq: 20 },
    gymCards: [{ id: 'g1', value: '1' }], _rev: 7
  })
  const B = () => base({
    _ts: 100, restSec: 60, week: { 1: ['rB'] },
    workouts: [workout('w1'), workout('wB', '2026-09-02')],
    routines: [routine('shared', 'from B'), routine('onlyB')],
    bodyweight: [{ d: '2026-09-01', w: 79, t: 20 }, { d: '2026-08-30', w: 82, t: 1 }],
    customEx: [{ id: 'cB', name: 'B ex' }], favEx: ['y', 'z'],
    exWeights: { sq: { w: 110 }, dl: { w: 140 } }, exNotes: { dl: 'B note' }, barWeights: { dl: 15 },
    gymCards: [{ id: 'g2', value: '2' }], _rev: 8
  })

  it('no entity of either side disappears, ids stay unique', () => {
    const m = mergeStates(A(), B())
    expect(ids(m.workouts).sort()).toEqual(['w1', 'wA', 'wB'])
    expect(ids(m.routines).sort()).toEqual(['onlyA', 'onlyB', 'shared'])
    expect(ids(m.customEx).sort()).toEqual(['cA', 'cB'])
    expect(ids(m.gymCards).sort()).toEqual(['g1', 'g2'])
    expect(m.bodyweight.map(b => b.d)).toEqual(['2026-08-30', '2026-09-01'])
    expect(m.favEx).toEqual(['x', 'y', 'z'])
    expect(new Set(ids(m.workouts)).size).toBe(m.workouts.length)
  })

  it('the newer copy decides settings, week, and a shared id; the other way round too', () => {
    const m = mergeStates(A(), B())
    expect(m.restSec).toBe(120)
    expect(m.week).toEqual({ 1: ['rA'] })
    expect(m.routines.find(r => r.id === 'shared').name).toBe('from A')
    const m2 = mergeStates(B(), { ...A(), _ts: 50 })
    expect(m2.restSec).toBe(60)
    expect(m2.week).toEqual({ 1: ['rB'] })
    expect(m2.routines.find(r => r.id === 'shared').name).toBe('from B')
  })

  it('bodyweight keeps the later-edited entry of a day, exWeights the larger weight, notes union', () => {
    const m = mergeStates(A(), B())
    expect(m.bodyweight.find(b => b.d === '2026-09-01')).toEqual({ d: '2026-09-01', w: 79, t: 20 })
    expect(m.exWeights).toEqual({ sq: { w: 110 }, bp: { w: 60 }, dl: { w: 140 } })
    expect(m.exNotes).toEqual({ sq: 'A note', dl: 'B note' })
    expect(m.barWeights).toEqual({ sq: 20, dl: 15 })
  })

  it('is commutative on the union fields and idempotent', () => {
    const ab = mergeStates(A(), B()), ba = mergeStates(B(), A())
    for (const f of ['workouts', 'routines', 'customEx', 'gymCards']) expect(ids(ab[f]).sort()).toEqual(ids(ba[f]).sort())
    expect(ab.bodyweight).toEqual(ba.bodyweight)
    expect([...ab.favEx].sort()).toEqual([...ba.favEx].sort())
    expect(ab.exWeights).toEqual(ba.exWeights)
    const again = mergeStates(A(), ab)
    expect(ids(again.workouts)).toEqual(ids(ab.workouts))
    expect(ids(again.routines)).toEqual(ids(ab.routines))
    expect(mergeStates(A(), A()).workouts).toEqual(A().workouts)
  })

  it('sorts workouts by day and start, takes the later _ts, drops _rev, does not touch inputs', () => {
    const a = A(), b = B()
    const m = mergeStates(a, b)
    expect(m.workouts.map(w => w.d)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03'])
    expect(m._ts).toBe(200)
    expect('_rev' in m).toBe(false)
    expect(a).toEqual(A())
    expect(b).toEqual(B())
    m.workouts[0].entries.push('x')
    expect(a.workouts[0].entries).toEqual([])
  })

  it('tolerates a missing side and missing lists', () => {
    expect(mergeStates(A(), null)).toEqual(A())
    expect(mergeStates(null, B())).toEqual(B())
    const sparse = { _ts: 5, workouts: null, routines: undefined }
    const m = mergeStates(sparse, { _ts: 1, workouts: [workout('w')], bodyweight: undefined })
    expect(ids(m.workouts)).toEqual(['w'])
    expect(m.bodyweight).toEqual([])
  })

  it('a workout without an id is kept once by day and start', () => {
    const legacy = { d: '2026-09-01', start: 5, entries: [] }
    const m = mergeStates({ _ts: 2, workouts: [legacy] }, { _ts: 1, workouts: [{ ...legacy }, { d: '2026-09-01', start: 6, entries: [] }] })
    expect(m.workouts).toHaveLength(2)
  })

  // The report that started this: desktop adopted the server copy at T0, the phone logged a
  // workout at T1, the desktop then changed one setting at T2 and pushed its whole document.
  it('the desktop setting and the phone workout both survive', () => {
    const t0 = base({ _ts: 1000, workouts: [workout('w1')], restSec: 90 })
    const server = { ...t0, _ts: 1001, workouts: [workout('w1'), workout('from-phone', '2026-09-05')], _rev: 4 }
    const desktop = { ...t0, _ts: 1002, restSec: 75 }
    const m = mergeStates(desktop, server)
    expect(ids(m.workouts)).toEqual(['w1', 'from-phone'])
    expect(m.restSec).toBe(75)
    expect(m._ts).toBe(1002)
  })
})

describe('sign-in adoption helpers', () => {
  const server = { _ts: 100, unit: 'lb', restSec: 60, workouts: [{ id: 'w1', d: '2026-09-01' }], bodyweight: [{ d: '2026-09-01', w: 80, t: 1 }], routines: [{ id: 'r1', name: 'A' }], week: { 1: ['r1'] } }
  const local = { _ts: 900, unit: 'kg', restSec: 90, workouts: [{ id: 'w9', d: '2026-09-11' }], bodyweight: [{ d: '2026-09-11', w: 81, t: 2 }, { d: '2026-09-01', w: 79, t: 9 }], routines: [{ id: 'rg', name: 'Guest' }], customEx: [{ id: 'c1', name: 'x' }], week: { 2: ['rg'] } }
  it('localExtras counts what the device has that the server does not', () => {
    expect(localExtras(local, server)).toEqual({ workouts: 1, bodyweight: 1, customEx: 1 })
    expect(localExtras(server, server)).toEqual({ workouts: 0, bodyweight: 0, customEx: 0 })
    expect(localExtras(null, server)).toEqual({ workouts: 0, bodyweight: 0, customEx: 0 })
  })
  it('mergeStates with prefer keeps the preferred side\'s settings and plan although the other is newer', () => {
    const m = mergeStates(server, local, { prefer: 'a' })
    expect(m.unit).toBe('lb'); expect(m.restSec).toBe(60); expect(m.week).toEqual({ 1: ['r1'] })
    expect(m.workouts.map(w => w.id)).toEqual(['w1', 'w9'])
    expect(m.routines.map(r => r.id).sort()).toEqual(['r1', 'rg'])
    expect(m.customEx.map(e => e.id)).toEqual(['c1'])
    // the weigh-in both sides have for the same day: the later `t` wins, as between devices
    expect(m.bodyweight.find(e => e.d === '2026-09-01').w).toBe(79)
    expect(mergeStates(server, local).unit).toBe('kg')   // without prefer the newer copy decides
  })
})

// B&S: Die Trainingspläne gehören den Coaches. `server` nennt die Seite, deren `routines` und
// `week` gelten — ohne Vereinigung (eine gelöschte Routine darf nicht zurückkommen) und ohne
// `_ts`-Regel (ein neueres Mitglieds-Gerät darf seinen alten Plan nicht durchsetzen).
describe('mergeStates with the server-owned plan', () => {
  const srv = base({ _ts: 10, routines: [routine('coach-a'), routine('coach-b')], week: { 1: ['coach-a'] }, workouts: [workout('w-srv')], customEx: [{ id: 'c-srv', n: 'S' }] })
  const dev = base({ _ts: 900, routines: [routine('alt'), routine('coach-a', 'umbenannt')], week: { 3: ['alt'] }, workouts: [workout('w-dev', '2026-09-05')], customEx: [{ id: 'c-dev', n: 'D' }] })

  it('takes routines and week verbatim from the named side, whichever is newer', () => {
    for (const [a, b, server] of [[srv, dev, 'a'], [dev, srv, 'b']]) {
      const m = mergeStates(a, b, { server })
      expect(ids(m.routines)).toEqual(['coach-a', 'coach-b'])
      expect(m.routines[0].name).toBe('coach-a')   // not the device's rename
      expect(m.week).toEqual({ 1: ['coach-a'] })
    }
  })

  it('still merges everything the member owns', () => {
    const m = mergeStates(dev, srv, { server: 'b' })
    expect(ids(m.workouts)).toEqual(['w-srv', 'w-dev'])
    expect(ids(m.customEx).sort()).toEqual(['c-dev', 'c-srv'])
    expect(m._ts).toBe(900)
  })

  it('an empty plan on the server side empties the member copy', () => {
    const m = mergeStates(dev, base({ _ts: 10, week: {} }), { server: 'b' })
    expect(m.routines).toEqual([])
    expect(m.week).toEqual({})
  })

  it('combines with prefer: settings from the preferred side, plan from the server side', () => {
    const m = mergeStates(srv, dev, { prefer: 'a', server: 'a' })
    expect(m._ts).toBe(900)
    expect(ids(m.routines)).toEqual(['coach-a', 'coach-b'])
    expect(ids(m.workouts)).toEqual(['w-srv', 'w-dev'])
  })

  it('without the option nothing changes', () => {
    expect(ids(mergeStates(dev, srv).routines).sort()).toEqual(['alt', 'coach-a', 'coach-b'])
  })

  /* B&S: Übungen, die ein Coach angelegt hat, tragen `src:'coach'` und gehören zum Plan.
     `customEx` war eine reine Vereinigung: nahm der Coach eine aus jeder Routine, blieb sie als
     „eigene“ Übung im Dokument des Mitglieds zurück, an die kein Coach mehr herankam. */
  it('drops a coach exercise the server copy no longer carries', () => {
    const geraet = base({ _ts: 900, customEx: [{ id: 'c-coach', n: 'Sled Push B&S', src: 'coach' }, { id: 'c-eigen', n: 'Meine' }] })
    const server = base({ _ts: 10, customEx: [] })

    const m = mergeStates(geraet, server, { server: 'b' })

    expect(ids(m.customEx)).toEqual(['c-eigen'])
  })

  it('keeps a coach exercise the member has trained, as the member’s own', () => {
    const geraet = base({
      _ts: 900,
      customEx: [{ id: 'c-coach', n: 'Sled Push B&S', src: 'coach' }],
      workouts: [{ id: 'w1', d: '2026-09-01', start: 1, entries: [{ id: 'c-coach' }] }]
    })
    const server = base({ _ts: 10, customEx: [] })

    const m = mergeStates(geraet, server, { server: 'b' })

    expect(ids(m.customEx)).toEqual(['c-coach'])   // sonst stünde in der History „Unbekannte Übung“
    expect(m.customEx[0].src).toBeUndefined()
  })

  it('leaves a coach exercise alone while the plan still carries it', () => {
    const geraet = base({ _ts: 900, customEx: [{ id: 'c-coach', n: 'Alt', src: 'coach' }] })
    const server = base({ _ts: 10, customEx: [{ id: 'c-coach', n: 'Neu', src: 'coach' }] })

    const m = mergeStates(geraet, server, { server: 'b' })

    expect(ids(m.customEx)).toEqual(['c-coach'])
    expect(m.customEx[0].src).toBe('coach')
  })

  it('never touches a coach exercise without the server option', () => {
    const geraet = base({ _ts: 900, customEx: [{ id: 'c-coach', n: 'Sled Push B&S', src: 'coach' }] })
    expect(ids(mergeStates(geraet, base({ _ts: 10 })).customEx)).toEqual(['c-coach'])
  })
})
