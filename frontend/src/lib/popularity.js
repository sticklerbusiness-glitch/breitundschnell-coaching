// B&S: Übungen nach Beliebtheit statt nach dem Alphabet des englischen Datensatzes.
//
// Der Katalog kommt alphabetisch nach seinem ENGLISCHEN Namen sortiert. Auf Deutsch heißt das:
// Wer „Klimmzug" sucht, bekommt „Archer-Klimmzug", „Einarmiger Klimmzug mit Zusatzgewicht" und
// „Klimmzug unterstützt (Widerstandsband)" vor dem ganz normalen Klimmzug, der irgendwo in der
// Mitte steht. Gezählte Beliebtheit über alle Nutzer gibt es nicht (jedes Mitglied hat sein
// eigenes Dokument), deshalb zwei Stufen:
//
//   1. POPULAR — von Hand gereihte Grundübungen, die in fast jedem Plan vorkommen.
//   2. Der Rest nach einer Regel: Grundübung vor Variante, gängiges Gerät vor exotischem,
//      kurzer Name vor langem. „V. 2", „(male)" und Einbeinig-auf-dem-Gymnastikball rutschen ans
//      Ende, ohne dass jemand 1.300 Einträge reihen muss.
//
// Mit Suchbegriff geht die Trefferart vor: der Name genau so → steht im Namen → nur über
// Muskel/Gerät gefunden. Innerhalb jeder Stufe entscheidet die Beliebtheit. So steht bei
// „Klimmzug" der Klimmzug oben, dann die gängigen Klimmzug-Varianten, und „Einarmiger Klimmzug
// mit Zusatzgewicht" weit unten. „Name beginnt so" ist bewusst KEINE eigene Stufe: Im
// Deutschen steckt das Suchwort oft mitten im Wort oder hinter einem Zusatz („Frontkniebeuge",
// „Tiefe Kniebeuge (Langhantel)") — eine Anfangs-Stufe hätte die Kniebeuge an der Multipresse
// vor die Langhantel-Kniebeuge gestellt.

import { exerciseNameFor, getVersion } from './i18n-core.js'

// Reihenfolge = Beliebtheit. Bewusst quer über alle Körperteile gemischt: Der Filter „Alle"
// zeigt genau diese Reihenfolge, die Körperteil-Filter jeweils ihren Ausschnitt davon.
export const POPULAR = [
  // Die großen Grundübungen
  '0043', // Tiefe Kniebeuge (Langhantel)
  '0025', // Bankdrücken (Langhantel)
  '0032', // Kreuzheben (Langhantel)
  '0652', // Klimmzug
  '0662', // Liegestütz
  '0027', // Vorgebeugtes Rudern (Langhantel)
  '0198', // Latzug (Kabelzug)
  '0426', // Schulterdrücken stehend (Kurzhantel)
  '0091', // Schulterdrücken sitzend (Langhantel)
  '0085', // Rumänisches Kreuzheben (Langhantel)
  '0739', // Beinpresse 45° (Schlitten)
  '0251', // Dips für die Brust
  '0814', // Trizeps-Dips
  '0336', // Ausfallschritt (Kurzhantel)
  '1460', // Ausfallschritt im Gehen
  '1409', // Glute Bridge (Langhantel)
  '0861', // Rudern sitzend (Kabelzug)
  // Ausdauer und Hyrox (Strecke + Zeit, lib/endurance.js) — Hybrid-Coaching, also weit oben
  '0685', // Laufen
  'bs-schwimmen-kraul',
  'bs-rad-strasse',
  'bs-rudern-ergo',
  '2142', // SkiErg
  'bs-sled-push',
  'bs-sled-pull',
  'bs-burpee-broad-jump',
  'bs-sandbag-lunges',
  'bs-wall-balls',
  '2133', // Farmer's Walk (Kurzhantel)
  'bs-hip-thrust',
  'bs-plank',
  'bs-face-pull',
  'bs-laufband',
  'bs-rad-indoor',
  'bs-koppellauf',
  'bs-schwimmen-brust',
  'bs-schwimmen-ruecken',
  'bs-schwimmen-freiwasser',
  // Kurzhantel- und Maschinen-Klassiker
  '0289', // Bankdrücken (Kurzhantel)
  '0314', // Schrägbankdrücken (Kurzhantel)
  '0047', // Schrägbankdrücken (Langhantel)
  '0405', // Schulterdrücken sitzend (Kurzhantel)
  '0334', // Seitheben (Kurzhantel)
  '0294', // Bizepscurl (Kurzhantel)
  '0031', // Bizepscurl (Langhantel)
  '0201', // Trizepsdrücken (Kabelzug)
  '0313', // Hammercurl (Kurzhantel)
  '0585', // Beinstrecken (Maschine)
  '0586', // Beincurl liegend (Maschine)
  '0599', // Beincurl sitzend (Maschine)
  '0605', // Wadenheben stehend (Maschine)
  '0292', // Vorgebeugtes Rudern einarmig (Kurzhantel)
  '1326', // Klimmzug im Untergriff
  '0841', // Klimmzug mit Zusatzgewicht
  '0017', // Klimmzug unterstützt
  '0042', // Frontkniebeuge (Langhantel)
  '1760', // Goblet Squat (Kurzhantel)
  '0410', // Einbeiniger Split Squat (Kurzhantel)
  '0549', // Swing (Kettlebell)
  '0596', // Fliegende sitzend (Maschine)
  '0576', // Brustpresse (Maschine)
  '0603', // Schulterdrücken (Maschine)
  '1350', // Rudern sitzend (Maschine)
  '0579', // Latzug zur Brust (Maschine)
  '0743', // Hackenschmidt-Kniebeuge (Schlitten)
  '0060', // French Press Skull Crusher (Langhantel)
  '0194', // Überkopf-Trizepsstrecken mit Seil (Kabelzug)
  '0178', // Seitheben (Kabelzug)
  '0203', // Rudern für die hintere Schulter mit Seil (Kabelzug)
  '0383', // Reverse Flys (Kurzhantel)
  '0602', // Reverse Flys sitzend (Maschine)
  // Rumpf
  '0274', // Crunch am Boden
  '0472', // Hängendes Beinheben
  '0687', // Russian Twist
  '0276', // Dead Bug
  '2135', // Unterarmstütz mit Zusatzgewicht
  '0175', // Crunch kniend (Kabelzug)
  '0489', // Rückenstrecken
  // Athletik und Hyrox-nahe Übungen aus dem Katalog
  '1160', // Burpee
  '0630', // Mountain Climber
  '0514', // Sprungkniebeuge
  '3305', // Thruster (Langhantel)
  '0648', // Power Clean
  '2612', // Seilspringen
  '0798', // Radfahren locker (Ergometer)
  '3666', // Gehen am Laufband mit Steigung
  // Zweite Reihe
  '0308', // Fliegende (Kurzhantel)
  '0227', // Fliegende stehend (Kabelzug)
  '1269', // Crossover stehend mit gestreckten Armen (Kabelzug)
  '0447', // Curl (SZ-Stange)
  '0868', // Curl (Kabelzug)
  '0372', // Scottcurl (Kurzhantel)
  '0070', // Scottcurl (Langhantel)
  '0297', // Konzentrationscurl (Kurzhantel)
  '0030', // Bankdrücken enger Griff (Langhantel)
  '0351', // French Press (Kurzhantel)
  '0333', // Trizeps-Kickback (Kurzhantel)
  '0283', // Diamant-Liegestütz
  '0095', // Shrugs (Langhantel)
  '0406', // Shrugs (Kurzhantel)
  '0606', // T-Bar-Rudern (Maschine)
  '0238', // Überzüge mit gestreckten Armen (Kabelzug)
  '0117', // Sumo-Kreuzheben (Langhantel)
  '0811', // Kreuzheben (Trap-Bar)
  '1459', // Rumänisches Kreuzheben (Kurzhantel)
  '0431', // Step-up (Kurzhantel)
  '2137', // Arnold Press (Kurzhantel)
  '0120', // Aufrechtes Rudern (Langhantel)
  '0044', // Good Morning (Langhantel)
  '0597', // Hüftabduktion sitzend (Maschine)
  '0598', // Hüftadduktion sitzend (Maschine)
  '0594', // Wadenheben sitzend (Maschine)
  '0770', // Kniebeuge (Multipresse)
  '0748', // Bankdrücken (Multipresse)
  '1429', // Klimmzug weiter Griff
  '0499', // Umgekehrtes Rudern
  '0631', // Muscle-up
  '0471', // Handstand-Liegestütz
  '0493', // Liegestütz erhöht
  '0279', // Liegestütz mit erhöhten Füßen
  '0028', // Umsetzen und Drücken (Langhantel)
  '0128', // Battle Ropes (Seil)
  '0300', // Kreuzheben (Kurzhantel)
  '0054', // Ausfallschritt (Langhantel)
  '0381', // Ausfallschritt rückwärts (Kurzhantel)
  '0417', // Wadenheben stehend (Kurzhantel)
  '1373', // Wadenheben stehend
  '0180', // Rudern sitzend am tiefen Zug (Kabelzug)
  '0245', // Latzug im Untergriff (Kabelzug)
  '2616', // Latzug mit V-Griff (Kabelzug)
  '3017', // Pendlay Row (Langhantel)
  '0375', // Überzüge (Kurzhantel)
  '0534', // Goblet Squat (Kettlebell)
  '0860', // Trizeps-Kickback (Kabelzug)
  '0378', // Reverse Flys vorgebeugt (Kurzhantel)
  '0573', // Rückenstrecken (Maschine)
  '1354', // Überkopf-Slam (Medizinball)
  '0129', // Dips an der Bank (Knie gebeugt)
]

const POP_RANK = new Map(POPULAR.map((id, i) => [id, i]))

// Alles außerhalb der Liste beginnt hier — so liegt jede gereihte Übung vor jeder ungereihten.
const UNRANKED = 1000

// Wie gängig das Gerät ist. Langhantel, Kurzhantel und Körpergewicht stehen in jedem Studio;
// Bosu- und Gymnastikball-Varianten sucht kaum jemand.
const EQ_COST = {
  'barbell': 0, 'dumbbell': 0, 'body weight': 0, 'cable': 4, 'leverage machine': 8,
  'ez barbell': 10, 'kettlebell': 12, 'smith machine': 14, 'sled machine': 14, 'weighted': 14,
  'trap bar': 14, 'rope': 18, 'medicine ball': 22, 'band': 28, 'resistance band': 28,
  'assisted': 30, 'olympic barbell': 30, 'wheel roller': 30, 'roller': 40, 'stability ball': 40,
  'bosu ball': 50,
}
const EQ_DEFAULT = 40

// Namensbestandteile, an denen man eine Variante oder eine Doublette erkennt (englischer Name —
// der ist im Datensatz einheitlich, die Übersetzung nicht).
const NAME_COST = [
  [/\bv\. ?\d/, 40],                         // „sit-up v. 2" — Doublette einer Grundübung
  [/\((?:male|female)\)/, 25],
  [/\bpov\)/, 40],                           // dieselbe Übung aus anderer Kameraperspektive
  [/\bstretch\b/, 30],
  [/\bon (?:exercise|stability) ball\b|\bexercise ball\b|\bbosu\b/, 25],
  [/\bassisted\b/, 15],
  [/\b(?:one|single) (?:arm|leg|hand)\b|\balternat(?:e|ing)\b/, 8],
  [/\bweighted\b/, 6],
]

const rankCache = new Map()

/**
 * Beliebtheit einer Übung als Zahl: kleiner = beliebter. Eigene Übungen (Coach oder Mitglied)
 * stehen vor dem Katalog — so wie allExercises() sie schon immer zuerst geliefert hat.
 */
export function popularityRank(ex) {
  if (!ex || typeof ex !== 'object') return Infinity
  if (ex.custom) return -1
  const listed = POP_RANK.get(ex.id)
  if (listed != null) return listed
  const cached = rankCache.get(ex.id)
  if (cached != null) return cached
  const name = String(ex.n || '').toLowerCase()
  let cost = UNRANKED + (EQ_COST[ex.eq] ?? EQ_DEFAULT)
  for (const [re, add] of NAME_COST) if (re.test(name)) cost += add
  // Jedes weitere Wort ist eine weitere Einschränkung: „dumbbell incline one arm hammer press
  // on exercise ball" ist seltener als „dumbbell hammer press".
  cost += name.split(/\s+/).filter(Boolean).length * 3
  if (ex.id) rankCache.set(ex.id, cost)
  return cost
}

const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const wordsOf = s => s.split(/[^a-z0-9äöüß]+/).filter(Boolean)

// Namen werden pro Übung einmal gefaltet; der Schlüssel ist die i18n-Version, damit ein
// Sprachwechsel die übersetzten Namen neu einliest (wie corpusOf in exercises.js).
const nameCache = new WeakMap()
function namesOf(ex) {
  const v = getVersion()
  const hit = nameCache.get(ex)
  if (hit && hit.v === v) return hit.names
  const names = [...new Set([fold(exerciseNameFor(ex)), fold(ex.n)].filter(Boolean))]
  nameCache.set(ex, { v, names })
  return names
}

/**
 * Wie gut trifft der Suchbegriff den NAMEN? 0 = genau so, 1 = steht im Namen (bei mehreren
 * Wörtern: jedes davon, in beliebiger Reihenfolge), 2 = nur über andere Felder gefunden.
 */
export function nameMatchTier(ex, query) {
  const q = fold(query)
  if (!q || !ex) return 0
  const tokens = wordsOf(q)
  let best = 2
  for (const name of namesOf(ex)) {
    if (name === q) return 0
    if (name.includes(q) || (tokens.length && tokens.every(tok => name.includes(tok)))) best = 1
  }
  return best
}

/**
 * Neue Liste, beliebteste zuerst. Mit Suchbegriff geht die Trefferart vor (siehe oben).
 * Die Eingabe bleibt unverändert; Gleichstand entscheidet der deutsche Name.
 */
export function sortByPopularity(list, query = '') {
  if (!Array.isArray(list)) return []
  const q = fold(query)
  const keyed = list.map(ex => ({
    ex,
    tier: q ? nameMatchTier(ex, q) : 0,
    rank: popularityRank(ex),
    name: exerciseNameFor(ex),
  }))
  keyed.sort((a, b) => (a.tier - b.tier) || (a.rank - b.rank) || a.name.localeCompare(b.name, 'de'))
  return keyed.map(k => k.ex)
}
