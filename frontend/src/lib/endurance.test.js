// B&S: Strecke + Zeit statt Gewicht × Wiederholungen — Laufen, Schwimmen, Rad, Hyrox.
import { describe, expect, it } from 'vitest'
import { fmtDist, fmtDur, parseDur, paceLabel, timeForPace, paceSecOf, sportOf, distSportOf, distLine, totalMeters } from './endurance.js'
import { EXIDX, CATALOGUE } from './exercises.js'
import { BS_EXERCISES } from './bs-exercises.js'
import { modeOf, defaultModeOf, defaultConfig, exLine, setLabel, buildSets, insertWarmupRow, metricModeForEntry } from './history.js'
import { modeForSet } from './workout-model.js'
import { exerciseHistory } from './exercise-history.js'
import { policyFor } from './progression.js'
import { MUSCLES, musclesOf } from './muscles.js'

describe('formatting', () => {
  it('writes distances in m below and km from one kilometre', () => {
    expect(fmtDist(800)).toBe('800 m')
    expect(fmtDist(12.5)).toBe('12,5 m')
    expect(fmtDist(5000)).toBe('5 km')
    expect(fmtDist(21100)).toBe('21,1 km')
    expect(fmtDist(42195)).toBe('42,2 km')
  })

  it('writes durations as m:ss and with hours from one hour', () => {
    expect(fmtDur(190)).toBe('3:10')
    expect(fmtDur(45)).toBe('0:45')
    expect(fmtDur(3750)).toBe('1:02:30')
  })

  it('reads what people type into a time field', () => {
    expect(parseDur('3:10')).toBe(190)
    expect(parseDur('3,10')).toBe(190)   // Ziffernfeld am Handy
    expect(parseDur('1:02:30')).toBe(3750)
    expect(parseDur('45')).toBe(2700)    // nackte Zahl = Minuten
    expect(parseDur('0:45')).toBe(45)
    expect(parseDur('3:75')).toBeNull()
    expect(parseDur('abc')).toBeNull()
    expect(parseDur('')).toBeNull()
  })
})

describe('pace', () => {
  it('uses the unit each sport thinks in', () => {
    expect(paceLabel('run', 800, 190)).toBe('3:58 /km')
    expect(paceLabel('swim', 100, 105)).toBe('1:45 /100 m')
    expect(paceLabel('row', 1000, 224)).toBe('1:52 /500 m')
    expect(paceLabel('bike', 40000, 4500)).toBe('32 km/h')
    expect(paceLabel('carry', 50, 40)).toBe('')
    expect(paceLabel('run', 800, 0)).toBe('')
  })

  it('turns a pace back into a target time and back', () => {
    expect(timeForPace('run', 10000, 330)).toBe(3300)   // 10 km @ 5:30 → 55:00
    expect(paceSecOf('run', 10000, 3300)).toBe(330)
    expect(timeForPace('bike', 10000, 330)).toBeNull()  // Rad hat km/h, keine Pace
  })

  it('puts a set on one line', () => {
    expect(distLine({ m: 800, sec: 190 }, 'run')).toBe('800 m · 3:10 · 3:58 /km')
    expect(distLine({ m: 50, sec: 0, w: 152 }, 'carry')).toBe('50 m · 152 kg')
    expect(totalMeters([{ m: 800 }, { m: 800 }, { m: '' }, null])).toBe(1600)
  })
})

describe('catalogue', () => {
  it('adds the new exercises once, with ids the server accepts and muscles the map can draw', () => {
    const ids = BS_EXERCISES.map(e => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const ex of BS_EXERCISES) {
      expect(ex.id).toMatch(/^[A-Za-z0-9_-]{1,40}$/)  // gym-app/lib/plan.js ID_RE + MAX_ID
      expect(EXIDX[ex.id]).toBe(ex)
      expect(CATALOGUE).toContain(ex)
      if (ex.bp !== 'cardio') expect(Object.keys(musclesOf(ex)).every(m => MUSCLES.includes(m))).toBe(true)
    }
  })

  it('knows which exercises are distances', () => {
    expect(sportOf('bs-schwimmen-kraul')).toBe('swim')
    expect(sportOf('0685')).toBe('run')       // Laufen aus dem Datensatz
    expect(sportOf('2142')).toBe('ski')       // SkiErg
    expect(sportOf('bs-sled-push')).toBe('carry')
    expect(sportOf('0025')).toBeNull()        // Bankdrücken
    expect(sportOf('bs-wall-balls')).toBeNull()
  })

  it('shows any exercise switched to distance the same way in editor and workout', () => {
    expect(distSportOf('1460')).toBe('carry')   // Ausfallschritt im Gehen: Strecke ohne Pace
    expect(distSportOf('3360')).toBe('run')     // Bear Crawl (Cardio): wie Laufen
    expect(setLabel('1460', { m: 50, sec: 60 })).toBe('50 m · 1:00')
  })
})

describe('dist mode in plans and workouts', () => {
  it('starts new distance exercises as a distance, without reinterpreting old entries', () => {
    expect(defaultModeOf('bs-schwimmen-kraul')).toBe('dist')
    expect(defaultModeOf('bs-plank')).toBe('time')
    expect(defaultConfig('bs-schwimmen-kraul')).toEqual({ mode: 'dist', sets: 1, m: 400 })
    expect(defaultConfig('0685')).toEqual({ mode: 'dist', sets: 1, m: 5000 })
    // Ein gespeicherter Laufen-Eintrag von früher (Minuten + km/h, ohne mode) bleibt Cardio.
    expect(modeOf({ id: '0685', sets: 1, min: 30, speed: 10 })).toBe('cardio')
  })

  it('describes the plan line like a coach writes it', () => {
    expect(exLine({ id: '0685', mode: 'dist', sets: 6, m: 800, sec: 190 }, 'kg')).toBe('6 × 800 m · 3:10 · 3:58 /km')
    expect(exLine({ id: '0685', mode: 'dist', sets: 1, m: 10000 }, 'kg')).toBe('10 km')
    expect(exLine({ id: 'bs-sled-push', mode: 'dist', sets: 4, m: 12.5, weight: 152 }, 'kg')).toBe('4 × 12,5 m · 152 kg')
  })

  it('builds the rows from the plan, not from last time', () => {
    const S = { workouts: [{ d: '2026-10-01', entries: [{ id: '0685', target: { mode: 'dist', m: 800 }, sets: [{ m: 1000, sec: 300, done: true }] }] }], exWeights: {} }
    const rows = buildSets(S, { id: '0685', mode: 'dist', sets: 3, m: 800, sec: 190 })
    expect(rows).toEqual([{ m: 800, sec: 190, done: false }, { m: 800, sec: 190, done: false }, { m: 800, sec: 190, done: false }])
    const sled = buildSets({ workouts: [], exWeights: {} }, { id: 'bs-sled-push', mode: 'dist', sets: 1, m: 50, weight: 152 })
    expect(sled).toEqual([{ m: 50, sec: 0, w: 152, done: false }])
  })

  it('keeps an old cardio routine filled even when the last run was logged as distance', () => {
    const S = { workouts: [{ d: '2026-10-07', entries: [{ id: '0685', target: { mode: 'dist', m: 5000 }, sets: [{ m: 5000, sec: 1500, done: true }] }] }], exWeights: {} }
    expect(buildSets(S, { id: '0685', sets: 1, min: 30, speed: 10 })).toEqual([{ min: 30, speed: 10, done: false }])
  })

  it('adds a warm-up as the same distance with an open time', () => {
    const rows = insertWarmupRow([{ m: 400, sec: 90, done: false }], 'dist', { m: 400 })
    expect(rows[0]).toMatchObject({ m: 400, sec: 0, phase: 'warmup' })
  })

  it('reads a logged distance set as distance even without its target', () => {
    expect(modeForSet({ m: 800, sec: 190 })).toBe('dist')
    expect(setLabel('0685', { m: 800, sec: 190 })).toBe('800 m · 3:10 · 3:58 /km')
    expect(metricModeForEntry({ id: '0685', target: { mode: 'dist' }, sets: [{ m: 800, sec: 190, done: true }] })).toBe('dist')
  })

  it('plots the distance per session in the history and has no automatic progression', () => {
    const S = { workouts: [
      { id: 'w1', d: '2026-10-01', start: 1, entries: [{ id: '0685', target: { mode: 'dist', m: 800 }, sets: [{ m: 800, sec: 190, done: true }, { m: 800, sec: 188, done: true }] }] },
      { id: 'w2', d: '2026-10-03', start: 2, entries: [{ id: '0685', target: { mode: 'dist', m: 5000 }, sets: [{ m: 5000, sec: 1500, done: true }] }] },
    ] }
    const h = exerciseHistory(S, '0685')
    expect(h.metric).toBe('km')
    expect(h.points.map(p => p.y)).toEqual([1.6, 5])
    expect(h.best).toBe(5)
    expect(policyFor({ id: '0685', mode: 'dist', prog: 'linear' }, null, 'dist')).toBe('off')
  })
})
