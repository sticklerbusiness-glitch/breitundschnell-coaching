// B&S: Übungen unter vielen Namen finden — deutsch, englisch, Abkürzung, Gym-Slang, Schreibvarianten.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CATALOGUE, matchExercise } from './exercises.js'
import de from '../exercise-names/de.js'
import { _setLangState } from './i18n-core.js'
import { sortByPopularity } from './popularity.js'
import { suchBegriffe } from './search-synonyms.js'

const byId = Object.fromEntries(CATALOGUE.map(e => [e.id, e]))
const suche = q => sortByPopularity(CATALOGUE.filter(e => matchExercise(e, q)), q).map(e => e.id)
const findet = (q, id) => expect(matchExercise(byId[id], q), `„${q}" sollte ${id} finden`).toBe(true)

beforeAll(() => { _setLangState('de', {}, null, de) })
afterAll(() => { _setLangState('en', {}, null, null) })

describe('Synonyme', () => {
  it('findet Übungen über Abkürzungen und Slang', () => {
    findet('OHP', '0091')            // Schulterdrücken sitzend (Langhantel)
    findet('RDL', '0085')            // Rumänisches Kreuzheben
    findet('KH Bankdrücken', '0289') // Bankdrücken (Kurzhantel)
    findet('DB bench', '0289')
    findet('Butterfly', '0596')      // Fliegende sitzend (Maschine)
    findet('Lat Pulldown', '0198')   // Latzug (Kabelzug)
    findet('Hüftstoß', 'bs-hip-thrust')
    findet('Seilzug Trizeps', '0201') // Trizepsdrücken (Kabelzug)
  })

  it('findet über Schreibvarianten', () => {
    findet('pullup', '0652')
    findet('pull up', '0652')
    findet('Pushup', '0662')
    findet('bankdruecken', '0025')
    findet('Hueftstoss', 'bs-hip-thrust')
  })

  it('findet die neuen Übungen auch englisch', () => {
    findet('swimming', 'bs-schwimmen-kraul')
    findet('front crawl', 'bs-schwimmen-kraul')
    findet('rowing machine', 'bs-rudern-ergo')
    findet('treadmill', 'bs-laufband')
    findet('cycling', 'bs-rad-strasse')
    findet('plank', 'bs-plank')
  })

  it('stellt die passende Übung nach oben', () => {
    expect(suche('pullup')[0]).toBe('0652')            // Klimmzug
    expect(suche('KH Bankdrücken')[0]).toBe('0289')    // Bankdrücken (Kurzhantel)
    expect(suche('squat')[0]).toBe('0043')             // Tiefe Kniebeuge (Langhantel)
    expect(suche('bench')[0]).toBe('0025')             // Bankdrücken (Langhantel)
  })

  it('findet nichts Falsches über zu kurze oder versteckte Wortteile', () => {
    // „laufen" → Synonym „run" darf nicht „Crunch" treffen
    expect(matchExercise(byId['0274'], 'laufen')).toBe(false)   // Crunch am Boden
    // „KH" ist nur Schlüssel, nie selbst Text: kein Treffer bei Langhantel-Übungen ohne Kurzhantel
    expect(matchExercise(byId['0025'], 'KH')).toBe(false)
    // jedes Wort muss treffen
    expect(matchExercise(byId['0652'], 'pullup langhantel')).toBe(false)
  })

  it('verhält sich ohne Synonym wie bisher', () => {
    expect(suchBegriffe('xyz')).toEqual([{ eigen: 'xyz', synonyme: [] }])
    expect(suchBegriffe('   ')).toEqual([])
    findet('drücken', '0025')   // getipptes Wort trifft weiter mitten im Wort
  })
})
