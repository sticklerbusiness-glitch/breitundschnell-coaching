import { describe, it, expect } from 'vitest'
import { matchExercise, normalizeStr } from './exercises.js'
import { _setLangState } from './i18n-core.js'

describe('normalizeStr', () => {
  it('handles null, undefined and empty strings', () => {
    expect(normalizeStr(null)).toBe('')
    expect(normalizeStr(undefined)).toBe('')
    expect(normalizeStr('')).toBe('')
  })

  it('lowercases text and removes diacritics / accents', () => {
    expect(normalizeStr('Elevação Lateral')).toBe('elevacao lateral')
    expect(normalizeStr('SUPINO INCLINADO COM HALTERES')).toBe('supino inclinado com halteres')
    expect(normalizeStr('Tríceps & Panturrilhas')).toBe('triceps & panturrilhas')
    expect(normalizeStr('Quadríceps / Glúteos')).toBe('quadriceps / gluteos')
  })
})

describe('matchExercise', () => {
  const benchPress = {
    id: '0025',
    n: 'barbell bench press',
    bp: 'chest',
    tg: 'pectorals',
    eq: 'barbell',
    sm: ['triceps', 'deltoids'],
    desc: 'Classic chest exercise using a barbell on a flat bench.'
  }

  const lateralRaise = {
    id: '0283',
    n: 'dumbbell lateral raise',
    bp: 'shoulders',
    tg: 'delts',
    eq: 'dumbbell',
    sm: ['traps'],
    desc: 'Shoulder isolation movement.'
  }

  it('returns true for empty or whitespace-only query', () => {
    expect(matchExercise(benchPress, '')).toBe(true)
    expect(matchExercise(benchPress, '   ')).toBe(true)
    expect(matchExercise(benchPress, null)).toBe(true)
  })

  it('matches exact and partial words in exercise name regardless of case', () => {
    expect(matchExercise(benchPress, 'bench')).toBe(true)
    expect(matchExercise(benchPress, 'BENCH')).toBe(true)
    expect(matchExercise(benchPress, 'barbell')).toBe(true)
    expect(matchExercise(benchPress, 'press')).toBe(true)
    expect(matchExercise(benchPress, 'squat')).toBe(false)
  })

  it('matches multiple tokens in ANY order (not just sequential)', () => {
    // "bench barbell" is reversed order compared to "barbell bench press"
    expect(matchExercise(benchPress, 'bench barbell')).toBe(true)
    expect(matchExercise(benchPress, 'press bench barbell')).toBe(true)
    expect(matchExercise(benchPress, 'barbell press chest')).toBe(true)
    expect(matchExercise(benchPress, 'bench squat')).toBe(false)
  })

  it('matches target muscle, equipment, secondary muscles and description', () => {
    expect(matchExercise(benchPress, 'pectorals')).toBe(true)
    expect(matchExercise(benchPress, 'triceps barbell')).toBe(true)
    expect(matchExercise(benchPress, 'flat bench')).toBe(true)
    expect(matchExercise(lateralRaise, 'dumbbell shoulder')).toBe(true)
  })

  it('matches accent-insensitively', () => {
    const customEx = {
      id: 'custom-1',
      n: 'Elevação de Panturrilha',
      bp: 'lower legs',
      tg: 'calves',
      eq: 'body weight',
      desc: 'Exercício para panturrilhas em pé.'
    }

    expect(matchExercise(customEx, 'elevacao')).toBe(true)
    expect(matchExercise(customEx, 'elevação')).toBe(true)
    expect(matchExercise(customEx, 'panturrilha elevacao')).toBe(true)
    expect(matchExercise(customEx, 'ELEVACAO PE')).toBe(true)
  })

  it('matches translated UI terms when a language is active', () => {
    // B&S: German, the only locale the fork ships — the Portuguese packs are deleted.
    _setLangState('de', {
      chest: 'Brust',
      barbell: 'Langhantel',
      dumbbell: 'Kurzhantel',
      shoulders: 'Schultern'
    }, null)

    // "Brust" is the translated bp, "Langhantel" is the translated eq
    expect(matchExercise(benchPress, 'brust')).toBe(true)
    expect(matchExercise(benchPress, 'langhantel')).toBe(true)
    expect(matchExercise(benchPress, 'brust langhantel bench')).toBe(true)
    expect(matchExercise(lateralRaise, 'kurzhantel schultern')).toBe(true)
  })

  // B&S: the German exercise-name pack renames the whole catalogue in the UI, and the name it
  // shows is now the ONLY one on screen (exerciseNameFor no longer appends the English one).
  // Searching has to reach both, or the library goes dark the moment a member types what they
  // see — or a coach types the ExerciseDB name they know.
  it('matches the localized exercise name as well as the English one', () => {
    _setLangState('de', {}, null, { '0025': 'Bankdrücken (Langhantel)' })

    expect(matchExercise(benchPress, 'bankdrücken')).toBe(true)
    expect(matchExercise(benchPress, 'bankdrucken langhantel')).toBe(true)  // diacritics folded
    expect(matchExercise(benchPress, 'bench press')).toBe(true)   // English still reaches it
    expect(matchExercise(lateralRaise, 'bankdrücken')).toBe(false)  // untranslated entry unaffected
  })

  it('rebuilds the cached haystack when the language changes', () => {
    _setLangState('de', {}, null, { '0025': 'Bankdrücken (Langhantel)' })
    expect(matchExercise(benchPress, 'bankdrücken')).toBe(true)

    _setLangState('en', null, null, null)
    expect(matchExercise(benchPress, 'bankdrücken')).toBe(false)
    expect(matchExercise(benchPress, 'bench')).toBe(true)
  })
})
