// B&S: Beliebtheit statt Alphabet — vor allem der Fall, der aufgefallen ist: Bei „Klimmzug"
// stand der normale Klimmzug unten und der einarmige mit Zusatzgewicht weit oben.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { EXDB } from './exercises-data.js'
import { CATALOGUE, matchExercise } from './exercises.js'
import de from '../exercise-names/de.js'
import { _setLangState } from './i18n-core.js'
import { POPULAR, popularityRank, nameMatchTier, sortByPopularity } from './popularity.js'

const byId = Object.fromEntries(CATALOGUE.map(e => [e.id, e]))
const ids = list => list.map(e => e.id)
const search = q => sortByPopularity(CATALOGUE.filter(e => matchExercise(e, q)), q)

beforeAll(() => { _setLangState('de', {}, null, de) })
afterAll(() => { _setLangState('en', {}, null, null) })

describe('POPULAR', () => {
  it('names only catalogue exercises, each once', () => {
    const known = new Set(EXDB.map(e => e.id))
    expect(POPULAR.filter(id => !known.has(id))).toEqual([])
    expect(new Set(POPULAR).size).toBe(POPULAR.length)
  })

  it('ranks every listed exercise ahead of every unlisted one', () => {
    const worstListed = Math.max(...POPULAR.map(id => popularityRank(byId[id])))
    const unlisted = CATALOGUE.filter(e => !POPULAR.includes(e.id))
    expect(Math.min(...unlisted.map(popularityRank))).toBeGreaterThan(worstListed)
  })
})

describe('sortByPopularity', () => {
  it('puts squat, bench press and deadlift first when nothing is searched', () => {
    expect(ids(sortByPopularity(CATALOGUE)).slice(0, 3)).toEqual(['0043', '0025', '0032'])
  })

  it('finds the plain pull-up first and the one-arm weighted one far below', () => {
    const list = ids(search('Klimmzug'))
    expect(list[0]).toBe('0652') // Klimmzug
    // Die gängigen Varianten vor den seltenen
    expect(list.indexOf('0841')).toBeLessThan(list.indexOf('3290')) // mit Zusatzgewicht vor einarmig mit Zusatzgewicht
    expect(list.indexOf('1326')).toBeLessThan(list.indexOf('0638')) // Untergriff vor einarmig im Untergriff
    expect(list.indexOf('3290')).toBeGreaterThan(list.length / 2)
  })

  it('orders by how well the name matches before popularity', () => {
    const list = ids(search('bankdrücken'))
    expect(list[0]).toBe('0025') // Bankdrücken (Langhantel)
    // Das Suchwort muss nicht am Anfang stehen: „Tiefe Kniebeuge (Langhantel)" vor der
    // Kniebeuge an der Multipresse, „Vorgebeugtes Rudern" vor dem Rudern am Schlingentrainer.
    expect(ids(search('kniebeuge'))[0]).toBe('0043')
    expect(ids(search('rudern'))[0]).toBe('0027')
    // Ein Treffer nur über Muskel oder Gerät steht hinter jedem Namenstreffer
    const tiers = search('brust').map(e => nameMatchTier(e, 'brust'))
    expect([...tiers].sort((a, b) => a - b)).toEqual(tiers)
  })

  it('matches the English name too', () => {
    expect(nameMatchTier(byId['0652'], 'pull-up')).toBe(0)
    expect(ids(search('pull-up'))[0]).toBe('0652')
  })

  it('pushes duplicates and exotic equipment behind the plain variant', () => {
    const plain = byId['0735'] // sit-up v. 2
    const male = byId['3204']  // arms overhead full sit-up (male)
    const basic = byId['0457'] // flexion leg sit up (straight arm)
    expect(popularityRank(basic)).toBeLessThan(popularityRank(plain))
    expect(popularityRank(basic)).toBeLessThan(popularityRank(male))
  })

  it('keeps your own exercises first and leaves the input untouched', () => {
    const own = { id: 'cx_1', n: 'Schlittenschieben Halle', bp: 'upper legs', custom: true }
    const input = [byId['0025'], own, byId['0043']]
    expect(ids(sortByPopularity(input))).toEqual(['cx_1', '0043', '0025'])
    expect(ids(input)).toEqual(['0025', 'cx_1', '0043'])
  })

  it('survives junk', () => {
    expect(sortByPopularity(null)).toEqual([])
    expect(popularityRank(null)).toBe(Infinity)
    expect(nameMatchTier(null, 'x')).toBe(0)
  })
})
