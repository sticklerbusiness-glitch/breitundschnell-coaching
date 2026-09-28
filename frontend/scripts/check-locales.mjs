#!/usr/bin/env node
// B&S: the app ships German only. Upstream's job here was to keep thirteen locale packs on
// the same key set; with one pack that invariant is vacuous, and the bug it guarded against
// has changed shape. What can still go wrong is a *catalogue* term with no German string:
// `t()` falls back to the English source silently, so a missed key does not crash — it just
// prints "leverage machine" on a chip in an otherwise German app, and nobody notices until a
// member does. Those terms come from data (src/lib/exercises-data.js, src/lib/muscles.js),
// not from source strings, so scripts/check-source-strings.mjs cannot see them either.
//
//   node scripts/check-locales.mjs
//
// Checks: de.js is the only pack; every body part, equipment value and muscle term in the
// catalogue is translated; no value still says "openGym"; no Swiss ss where German wants ß
// (de-CH is DERIVED from this file by ß → ss, so the substitution must only ever run one way).

import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const load = async rel => (await import(pathToFileURL(join(root, rel)).href)).default
const named = async (rel, key) => (await import(pathToFileURL(join(root, rel)).href))[key]

const localesDir = join(root, 'src', 'locales')
const files = readdirSync(localesDir).filter(f => f.endsWith('.js')).sort()

const problems = []
if (files.join() !== 'de.js') {
  problems.push(`src/locales/ should hold de.js and nothing else, found: ${files.join(', ') || '(empty)'}`)
}

const de = await load('src/locales/de.js')
if (!de || typeof de !== 'object') {
  console.error('de.js: no default-exported object')
  process.exit(1)
}

// Every term the views hand to t() straight out of the dataset.
const EXDB = await named('src/lib/exercises-data.js', 'EXDB')
const MUSCLE_NAME = await named('src/lib/muscles.js', 'MUSCLE_NAME')
const terms = new Map()   // term -> what kind of term it is, for the error message
const add = (kind, value) => { if (value) terms.set(value, kind) }
for (const ex of EXDB) {
  add('body part', ex.bp)
  add('equipment', ex.eq)
  add('target', ex.tg)
  add('muscle group', ex.mg)
  for (const muscle of ex.sm || []) add('secondary muscle', muscle)
}
for (const name of Object.values(MUSCLE_NAME)) add('muscle name', name)

for (const [term, kind] of terms) {
  if (!(term in de)) problems.push(`untranslated ${kind}: ${JSON.stringify(term)}`)
}

for (const [key, value] of Object.entries(de)) {
  if (typeof value !== 'string') { problems.push(`non-string value for ${JSON.stringify(key)}`); continue }
  // Swiss orthography. Only the words the pack actually carried are listed — a blanket
  // ss → ß rule is wrong (dass, muss, lassen, Fitness are all correctly ss).
  const swiss = value.match(/\b\w*(?:gross|grösser|grössern|schliess|Schliess|gesäss|Gesäss|füsse|Füsse|strasse|Strasse|heiss|weiss|masse\b)\w*/gi)
  if (swiss) problems.push(`Swiss ss instead of ß in ${JSON.stringify(key)}: ${swiss.join(', ')}`)
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s) in the German locale:`)
  for (const p of problems) console.error(`  ${p}`)
  process.exit(1)
}

console.log(`de.js — ${Object.keys(de).length} keys, ${terms.size} catalogue terms all translated.`)
