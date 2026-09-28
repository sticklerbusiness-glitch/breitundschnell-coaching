// B&S: the German pack is the only pack, so it carries every guarantee the twelve-locale
// key-set check used to spread across files. The catalogue terms matter most: the views hand
// `bp`, `eq`, `tg`, `mg` and `sm` straight to t(), and a missing key falls back to the English
// source SILENTLY — an untranslated chip reads "leverage machine" in an otherwise German app
// and nothing fails anywhere. scripts/check-locales.mjs runs the same checks at review time.
import { describe, expect, it } from 'vitest'
import de from '../locales/de.js'
import { EXDB } from './exercises-data.js'
import { MUSCLE_NAME } from './muscles.js'

const BODYPARTS = [...new Set(EXDB.map(e => e.bp))].sort()
const EQUIPMENT = [...new Set(EXDB.map(e => e.eq))].sort()
const MUSCLE_TERMS = [...new Set([
  ...EXDB.flatMap(e => [e.tg, e.mg, ...(e.sm || [])]),
  ...Object.values(MUSCLE_NAME)
].filter(Boolean))].sort()

const placeholders = value => [...String(value).matchAll(/\{\d+\}/g)].map(m => m[0]).sort()

describe('German locale', () => {
  it('translates all ten catalogue body parts', () => {
    expect(BODYPARTS).toHaveLength(10)
    for (const bp of BODYPARTS) expect(de[bp], `body part ${bp}`).toEqual(expect.any(String))
  })

  it('translates all 28 equipment values with the gym terms the coaches use', () => {
    expect(EQUIPMENT).toHaveLength(28)
    for (const eq of EQUIPMENT) expect(de[eq], `equipment ${eq}`).toEqual(expect.any(String))
    expect(de.barbell).toBe('Langhantel')
    expect(de.dumbbell).toBe('Kurzhantel')
    expect(de.cable).toBe('Kabelzug')
    expect(de['smith machine']).toBe('Multipresse')
    expect(de['ez barbell']).toBe('SZ-Stange')
    expect(de['body weight']).toBe('Körpergewicht')
  })

  it('translates every target and muscle name the exercise views show', () => {
    for (const term of MUSCLE_TERMS) expect(de[term], `muscle term ${term}`).toEqual(expect.any(String))
  })

  // The chips, tags and list subtitles that show these terms no longer carry
  // `text-transform: capitalize` (German capitalises nouns, not words), so the capital has
  // to be in the string itself or the label renders lower-case.
  it('capitalises every catalogue term, since the CSS no longer does', () => {
    for (const term of [...BODYPARTS, ...EQUIPMENT, ...MUSCLE_TERMS]) {
      const value = de[term]
      expect(value.charAt(0), `${term} -> ${value}`).toBe(value.charAt(0).toUpperCase())
    }
  })

  it('keeps every interpolation placeholder of its English source string', () => {
    for (const [source, translated] of Object.entries(de)) {
      expect(placeholders(translated), source).toEqual(placeholders(source))
    }
  })

  // de-CH is derived from this pack by ß → ss (lib/i18n-core.js DERIVED_LOCALES). The
  // substitution is only exact in that direction, so the German source must never be the
  // Swiss spelling — "Masse" cannot be turned back into "Maße".
  it('uses standard German ß, not the Swiss ss it is derived into', () => {
    const swiss = /gross|grösser|schliess|gesäss|füsse|strasse|heiss|weiss/i
    const offenders = Object.entries(de).filter(([, v]) => swiss.test(v))
    expect(offenders).toEqual([])
  })

  it('never calls the app openGym on a screen a member can reach', () => {
    // The self-hosting, phone-pairing and APK-update screens are removed by the fork, so
    // their strings are dead weight rather than wrong (and the APK one carries upstream's
    // real download domain, which is a URL, not our product name). Everything a member can
    // still reach is branded.
    const dead = /self-host|Pair the|pairing|Connect the|Connect to my server|your own openGym|openGym server|openGym app|openGym site|APK/i
    const live = Object.entries(de).filter(([key]) => !dead.test(key))
    for (const [key, value] of live) expect(value, key).not.toMatch(/openGym/i)
  })
})
