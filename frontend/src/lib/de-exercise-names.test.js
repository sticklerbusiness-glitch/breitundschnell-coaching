// B&S: the German exercise pack is the only pack, and it is data, not code — nothing in the
// app fails when an id is missing from it. `instrFor` falls back to the English `st` and
// `exerciseNameFor` to the English `n`, silently: a gap shows up as one English exercise in
// an otherwise German list, which nobody reports. These checks are what stands in for that
// missing crash. They also hold the two translation rules the app depends on: the step count
// must match the English one (the views number the steps and read them back in order), and
// two exercises must not share a German name unless the catalogue gives them the same
// English one, or a coach picking from 1,324 exercises cannot tell the variants apart.
import { describe, expect, it } from 'vitest'
import { EXDB } from './exercises-data.js'
import de from '../exercise-names/de.js'
import instrDe from '../instr/de.js'
import {
  EXERCISE_NAME_LANGS, INSTR_LANGS, LANGS,
  exerciseNameFor, exerciseNameSearchText, instrFor, _setLangState
} from './i18n-core.js'

const byId = Object.fromEntries(EXDB.map(e => [e.id, e]))

describe('German exercise names', () => {
  it('covers every catalogue exercise', () => {
    expect(EXDB).toHaveLength(1324)
    const missing = EXDB.filter(e => !de[e.id]).map(e => `${e.id} ${e.n}`)
    expect(missing).toEqual([])
  })

  it('has no entry the catalogue does not know', () => {
    expect(Object.keys(de).filter(id => !byId[id])).toEqual([])
  })

  it('is never empty, over-long or ended with a full stop', () => {
    for (const [id, name] of Object.entries(de)) {
      expect(name, id).toEqual(expect.any(String))
      expect(name.trim(), id).not.toBe('')
      // Long names are cut off in the workout list and the routine editor's rows.
      expect(name.length, `${id} "${name}"`).toBeLessThanOrEqual(60)
      expect(name, id).not.toMatch(/\.$/)
    }
  })

  it('keeps variants tellable apart: a shared German name needs a shared English one', () => {
    const groups = {}
    for (const [id, name] of Object.entries(de)) (groups[name] ||= []).push(id)
    const collisions = Object.entries(groups)
      .filter(([, ids]) => ids.length > 1)
      .filter(([, ids]) => new Set(ids.map(id => byId[id].n.toLowerCase())).size > 1)
      .map(([name, ids]) => `${name}: ${ids.map(id => `${id} "${byId[id].n}"`).join(' / ')}`)
    expect(collisions).toEqual([])
  })

  it('actually translates the exercises that have a German gym term', () => {
    // A sample with an unambiguous German name. Catching "barbell bench press" still reading
    // "barbell bench press" is the point — an untranslated id is otherwise invisible.
    const expected = {
      '0025': 'Bankdrücken (Langhantel)',
      '0032': 'Kreuzheben (Langhantel)',
      '0085': 'Rumänisches Kreuzheben (Langhantel)',
      '0042': 'Frontkniebeuge (Langhantel)',
      '0314': 'Schrägbankdrücken (Kurzhantel)',
      '0334': 'Seitheben (Kurzhantel)',
      '0294': 'Bizepscurl (Kurzhantel)',
      '0861': 'Rudern sitzend (Kabelzug)',
      '0597': 'Hüftabduktion sitzend (Maschine)',
      '0585': 'Beinstrecken (Maschine)',
      '0652': 'Klimmzug',
      '0662': 'Liegestütz',
      '0472': 'Hängendes Beinheben',
      '0120': 'Aufrechtes Rudern (Langhantel)'
    }
    for (const [id, name] of Object.entries(expected)) expect(de[id], id).toBe(name)
  })

  it('leaves no name identical to its English source unless the German term is the loanword', () => {
    // Burpee, Handstand, Russian Twist and friends are what German gyms say, so an identical
    // string is correct for them. Everything else must have moved.
    const loanwords = EXDB.filter(e => de[e.id].toLowerCase() === e.n.toLowerCase())
    expect(loanwords.length).toBeLessThan(60)
    for (const e of loanwords) {
      // A loanword is a name ("Skin the Cat", "Bear Crawl"), not a sentence: an untranslated
      // description would carry the words that only appear in one.
      expect(de[e.id], e.id).not.toMatch(/\b(with|and|your|for the|onto)\b/i)
    }
  })
})

describe('German exercise instructions', () => {
  it('covers every catalogue exercise with the same steps the English has', () => {
    const wrong = []
    for (const e of EXDB) {
      const steps = instrDe[e.id]
      if (!Array.isArray(steps)) { wrong.push(`${e.id} missing`); continue }
      if (steps.length !== (e.st || []).length) wrong.push(`${e.id} ${steps.length} ≠ ${(e.st || []).length}`)
    }
    expect(wrong).toEqual([])
  })

  it('has no empty step and no step left in English', () => {
    for (const [id, steps] of Object.entries(instrDe)) {
      for (const [i, step] of steps.entries()) {
        expect(step, `${id}[${i}]`).toEqual(expect.any(String))
        expect(step.trim(), `${id}[${i}]`).not.toBe('')
        expect(step, `${id}[${i}]`).not.toBe(byId[id].st[i])
      }
    }
  })

  it('writes the steps as du-form imperatives, not English sentences', () => {
    const sample = ['0025', '0032', '0652', '0662', '0334']
    for (const id of sample) {
      for (const step of instrDe[id]) {
        expect(step, id).not.toMatch(/\b(Lie|Stand|Hold|Keep|Repeat|Lower|Push|Grab)\b/)
      }
    }
    expect(instrDe['0025'][0]).toMatch(/^Leg dich/)
  })
})

describe('German is the language the packs are wired to', () => {
  it('is listed for both pack kinds', () => {
    expect(INSTR_LANGS).toContain('de')
    expect(EXERCISE_NAME_LANGS).toContain('de')
  })

  it('offers no language without content behind it', () => {
    // en is the source language (no pack), de has the packs, de-CH derives from de.
    expect(Object.keys(LANGS).sort()).toEqual(['de', 'de-CH', 'en'])
  })

  it('shows the German name alone and keeps the English one searchable', () => {
    _setLangState('de', {}, instrDe, de)
    const bench = byId['0025']
    expect(exerciseNameFor(bench)).toBe('Bankdrücken (Langhantel)')
    expect(exerciseNameFor(bench)).not.toMatch(/bench press/)
    expect(exerciseNameSearchText(bench)).toBe('Bankdrücken (Langhantel) barbell bench press')
    expect(instrFor(bench)).toBe(instrDe['0025'])
    // A member's own exercise is not in the pack and keeps the name they typed.
    expect(exerciseNameFor({ id: 'cx_1', n: 'Schlittenschieben Halle' })).toBe('Schlittenschieben Halle')
    _setLangState('en', {}, null, null)
  })
})
