// Runtime-agnostic core of the i18n module: state, constants and readers (t, dateLocale,
// instrFor, exerciseNameFor, getLang). Plain Node-loadable — the browser-only pieces
// (import.meta.glob lazy
// loads, the React subscription hook) live in i18n.js and re-export from here.

// B&S: the app is German only. Upstream's other locale, instruction and exercise-name packs
// are deleted, so listing their languages here would let something select a language with no
// content behind it. What is left: de (the packs), de-CH (derived from de, see below) and en
// (not a pack at all — the source strings and the catalogue's own English text).
export const LANGS = {
  en: 'English', de: 'Deutsch', 'de-CH': 'Deutsch (Schweiz)'
}
export const INSTR_LANGS = ['en', 'de']
export const EXERCISE_NAME_LANGS = ['de']
export const DATE_LOCALES = {
  en: 'en-GB', de: 'de-DE', 'de-CH': 'de-CH'
}

// Locales derived from another language by a pure text transform rather than carried as their
// own pack. Swiss Standard German has no ß — every one is written ss — so de-CH is de with a
// single substitution. Deriving it keeps one German source of truth: a hand-maintained de-CH
// would be 98.7% identical to de.js (16 of 1265 values differ), and check-locales.mjs would
// then require every future German string to be written twice, forever.
//
// The transform is exact in this direction ONLY. Going back needs vowel length — "Maße" and
// "Masse" both collapse to "Masse" — so de is always the base and never the derivative.
//
// Note this covers orthography, not vocabulary: a Swiss-specific word choice (Velo for
// Fahrrad) would need a real pack. None of the current strings contain one.
export const DERIVED_LOCALES = {
  'de-CH': { base: 'de', transform: s => s.replace(/ß/g, 'ss') }
}

// The language whose packs a locale actually loads: a derived locale reads its base's, every
// other language its own. Used for the INSTR_LANGS/EXERCISE_NAME_LANGS membership tests too,
// so de-CH gains instructions and exercise names exactly when de does, with no second entry
// to remember to add.
export const baseLang = l => DERIVED_LOCALES[l]?.base || l

// Applies a derived locale's transform to a loaded pack, returning it unchanged for a language
// that is not derived. Packs are trees of strings: the locale pack is flat { source: target },
// instruction packs are { exId: [steps] }, exercise-name packs { exId: name }.
export function derivePack(l, pack) {
  const transform = DERIVED_LOCALES[l]?.transform
  if (!transform || !pack) return pack
  const walk = v =>
    typeof v === 'string' ? transform(v)
      : Array.isArray(v) ? v.map(walk)
        : v && typeof v === 'object'
          ? Object.fromEntries(Object.entries(v).map(([k, inner]) => [k, walk(inner)]))
          : v
  return walk(pack)
}

let lang = 'en'                 // set only by _setLangState, called from i18n.js setLang
let dict = {}                   // current locale pack (empty = English fallback)
let instr = null                // { exId: [steps] } for the current language, null = English
let exerciseNames = null        // { exId: translated name }, null = original catalogue name
let version = 0                 // bumped on every setLang; drives the React subscription selector

export const getLang = () => lang
export const dateLocale = () => DATE_LOCALES[lang] || 'en-GB'
export const getVersion = () => version

// Translate a source string; {0},{1}… are replaced with args (also on the English fallback).
export function t(s, ...args) {
  let v = dict[s] || s
  for (let i = 0; i < args.length; i++) v = v.replaceAll('{' + i + '}', args[i])
  return v
}

// Instructions for an exercise in the current language (English steps as fallback).
export const instrFor = ex => (instr && instr[ex.id]) || ex.st || []

// B&S: built-in catalogue names show the German name ALONE. Upstream appended the English
// one in parentheses, which reads as clutter in a German-only app ("Bankdrücken (barbell
// bench press)") and pushes long names out of the workout list. The English title is not
// lost — exerciseNameSearchText below keeps it searchable, so a coach who knows an exercise
// by its ExerciseDB name still finds it. User-created exercises have no entry in the pack
// and keep their exact chosen name.
export const exerciseNameFor = ex => (exerciseNames && ex && exerciseNames[ex.id]) || ex?.n || ''

// Search both the localized and canonical English title without changing persisted data.
export const exerciseNameSearchText = ex => {
  const translated = exerciseNames && ex && exerciseNames[ex.id]
  return translated ? `${translated} ${ex.n}` : (ex?.n || '')
}

// Called by i18n.js's setLang once the locale pack has been loaded — kept here rather than
// exported as setLang because loading packs requires import.meta.glob, which is Vite-only.
// `dict`, `instr` and `exerciseNames` may be null to reset to their English fallbacks.
export function _setLangState(newLang, newDict, newInstr, newExerciseNames) {
  lang = LANGS[newLang] ? newLang : 'en'
  dict = lang === 'en' ? {} : (newDict || {})
  instr = lang === 'en' || !INSTR_LANGS.includes(baseLang(lang)) ? null : (newInstr || null)
  exerciseNames = lang === 'en' || !EXERCISE_NAME_LANGS.includes(baseLang(lang))
    ? null
    : (newExerciseNames || null)
  version++
  return version
}
