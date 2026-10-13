// B&S: Übungen unter vielen Namen finden — deutsch, englisch, Abkürzung, Gym-Slang.
//
// Statt bei 1.341 Übungen einzeln Namen zu hinterlegen, kennt jeder BEGRIFF seine Geschwister:
// „Kurzhantel = KH = Dumbbell = DB". Wer „KH Bankdrücken" tippt, findet „Bankdrücken (Kurzhantel)",
// wer „OHP" tippt, das Schulterdrücken, wer „pullup" (ohne Bindestrich) den Klimmzug. Das wirkt
// sofort für den ganzen Katalog, auch für eigene Übungen, und lässt sich an einer Stelle pflegen.
//
// Regeln (siehe suchBegriffe/trifft):
// - Jedes getippte Wort bleibt, was es war: es trifft wie bisher ÜBERALL im Text (auch mitten in
//   „Schrägbankdrücken"). Ein Synonym ist nur eine zusätzliche Möglichkeit.
// - Ein Synonym trifft nur am WORTANFANG — sonst fände „laufen" über „run" auch jeden Crunch.
// - Kurze Abkürzungen (KH, DB, LH, DL …) sind nur Suchschlüssel, nie selbst Treffer: „db" steckt
//   in zu vielen Wörtern, um als Text gesucht zu werden.
// - Mehrwortbegriffe („lat pulldown", „bench press") werden als Ganzes erkannt.
// - Schreibweisen: ß = ss, ä/ö/ü = ae/oe/ue = a/o/u, mit oder ohne Bindestrich/Leerzeichen.
//
// Neue Begriffe: einfach eine Gruppe ergänzen oder ein Wort in eine bestehende Gruppe schreiben.

export const SYNONYM_GRUPPEN = [
  // --- Geräte ---
  ['langhantel', 'lh', 'barbell', 'bb', 'olympia-langhantel'],
  ['kurzhantel', 'kurzhanteln', 'kh', 'dumbbell', 'dumbbells', 'db'],
  ['sz-stange', 'sz', 'ez bar', 'ez-bar', 'ez barbell', 'ez', 'curlstange'],
  ['kabelzug', 'kabel', 'seilzug', 'cable', 'cables'],
  ['maschine', 'machine', 'leverage machine', 'geraet'],
  ['multipresse', 'smith', 'smith machine'],
  ['kettlebell', 'kugelhantel', 'kb'],
  ['widerstandsband', 'band', 'resistance band', 'theraband', 'gummiband', 'miniband'],
  ['koerpergewicht', 'body weight', 'bodyweight', 'eigengewicht', 'ohne gewicht', 'calisthenics'],
  ['zusatzgewicht', 'weighted', 'gewichtsweste', 'dip guertel'],
  ['schlitten', 'sled', 'prowler'],
  ['sandsack', 'sandbag'],
  ['medizinball', 'medicine ball', 'slamball'],
  ['gymnastikball', 'stability ball', 'pezziball', 'swiss ball'],
  ['laufband', 'treadmill'],
  ['rudergeraet', 'ruderergometer', 'rowing machine', 'rower', 'concept2', 'erg'],
  ['skierg', 'ski erg', 'ski-ergometer', 'skiergometer'],
  ['ergometer', 'stationary bike', 'heimtrainer', 'spinning', 'indoor cycling', 'rolle', 'bike trainer'],
  // --- Grundübungen ---
  ['kniebeuge', 'kniebeugen', 'squat', 'squats', 'back squat'],
  ['frontkniebeuge', 'front squat'],
  ['goblet squat', 'goblet'],
  ['kreuzheben', 'deadlift', 'deadlifts', 'dl'],
  ['rumaenisches kreuzheben', 'romanian deadlift', 'rdl', 'stiff leg', 'gestreckte beine'],
  ['bankdruecken', 'bench press', 'bench', 'bankpresse'],
  ['schraegbank', 'incline', 'schraegbankdruecken', 'incline bench'],
  ['negativ', 'decline'],
  ['schulterdruecken', 'overhead press', 'ohp', 'military press', 'shoulder press', 'schulterpresse', 'drueckmaschine schulter'],
  ['klimmzug', 'klimmzuege', 'pull-up', 'pull up', 'pullup', 'pull-ups', 'pullups'],
  ['chin-up', 'chin up', 'chinup', 'klimmzug im untergriff'],
  ['liegestuetz', 'liegestuetze', 'push-up', 'push up', 'pushup', 'push-ups', 'pushups'],
  ['dips', 'dip', 'barrenstuetz'],
  ['rudern', 'row', 'rows', 'rowing'],
  ['latzug', 'lat pulldown', 'lat-pulldown', 'pulldown', 'latziehen', 'lat ziehen'],
  ['ausfallschritt', 'ausfallschritte', 'lunge', 'lunges'],
  ['split squat', 'bulgarian split squat', 'bulgarische kniebeuge', 'bss'],
  ['beinpresse', 'leg press'],
  ['beinstrecken', 'beinstrecker', 'leg extension', 'leg extensions'],
  ['beincurl', 'beinbeuger', 'leg curl', 'leg curls', 'hamstring curl'],
  ['wadenheben', 'calf raise', 'calf raises', 'wadenpresse'],
  ['hip thrust', 'hip thrusts', 'hipthrust', 'hueftstoss', 'hueftheben'],
  ['glute bridge', 'beckenheben', 'bruecke'],
  ['good morning', 'diener'],
  ['rueckenstrecken', 'rueckenstrecker', 'hyperextension', 'hyperextensions', 'back extension'],
  ['step-up', 'step up', 'stepup', 'aufsteigen'],
  ['thruster', 'thrusters'],
  ['umsetzen', 'clean', 'power clean'],
  ['reissen', 'snatch'],
  ['swing', 'kettlebell swing', 'kb swing'],
  ['farmers walk', "farmer's walk", 'farmer walk', 'farmers carry', 'farmer carry', 'bauerngang', 'koffertragen'],
  // --- Oberkörper-Isolation ---
  ['bizepscurl', 'bizeps curl', 'biceps curl', 'bicep curl', 'curl'],
  ['hammercurl', 'hammer curl', 'hammer curls'],
  ['scottcurl', 'preacher curl', 'scott curl', 'larry scott'],
  ['konzentrationscurl', 'concentration curl'],
  ['trizepsdruecken', 'pushdown', 'push down', 'trizeps pushdown', 'triceps pushdown'],
  ['french press', 'skull crusher', 'skullcrusher', 'skull crushers', 'stirndruecken'],
  ['kickback', 'kickbacks', 'trizeps kickback'],
  ['seitheben', 'lateral raise', 'lateral raises', 'side raise', 'seitheber'],
  ['frontheben', 'front raise'],
  ['reverse flys', 'reverse fly', 'reverse butterfly', 'butterfly reverse', 'reverse flyes'],
  ['fliegende', 'fly', 'flys', 'flyes', 'butterfly', 'pec deck', 'peck deck', 'crossover'],
  ['face pull', 'face pulls', 'facepull'],
  ['shrugs', 'shrug', 'schulterheben', 'nackenheben'],
  ['aufrechtes rudern', 'upright row'],
  ['ueberzuege', 'pullover', 'pull-over'],
  // --- Rumpf ---
  ['unterarmstuetz', 'plank', 'planke', 'brett'],
  ['seitstuetz', 'side plank', 'seitlicher unterarmstuetz'],
  ['crunch', 'crunches', 'bauchpresse'],
  ['sit-up', 'sit up', 'situp', 'sit-ups', 'situps'],
  ['beinheben', 'leg raise', 'leg raises', 'hanging leg raise'],
  ['russian twist', 'russian twists'],
  ['bauchroller', 'ab wheel', 'ab roller', 'rollout'],
  ['dead bug', 'deadbug'],
  // --- Ausdauer / Hyrox ---
  ['laufen', 'lauf', 'running', 'run', 'joggen', 'jogging', 'dauerlauf'],
  ['schwimmen', 'swimming', 'swim'],
  ['kraul', 'freistil', 'freestyle', 'front crawl', 'crawl'],
  ['brustschwimmen', 'breaststroke'],
  ['rueckenschwimmen', 'backstroke'],
  ['freiwasser', 'open water', 'freiwasserschwimmen'],
  ['radfahren', 'rad', 'fahrrad', 'radeln', 'rennrad', 'bike', 'biking', 'cycling', 'cycle'],
  ['koppellauf', 'brick run', 'koppeltraining', 'brick'],
  ['seilspringen', 'jump rope', 'springseil', 'seilhuepfen', 'rope skipping', 'skipping'],
  ['hampelmann', 'jumping jack', 'jumping jacks'],
  ['mountain climber', 'mountain climbers', 'bergsteiger'],
  ['wall ball', 'wall balls', 'wallball', 'wallballs'],
  ['burpee broad jump', 'burpee broad jumps', 'bbj'],
  ['sled push', 'schlitten schieben'],
  ['sled pull', 'schlitten ziehen'],
  ['sandbag lunges', 'sandsack ausfallschritte'],
  ['battle ropes', 'battle rope', 'tau'],
  // --- Muskeln / Körperteile ---
  ['brust', 'chest', 'pecs', 'brustmuskel'],
  ['ruecken', 'back', 'lats', 'latissimus'],
  ['schulter', 'schultern', 'shoulder', 'shoulders', 'delts', 'deltoids', 'delta'],
  ['bizeps', 'biceps', 'bicep'],
  ['trizeps', 'triceps', 'tricep'],
  ['unterarm', 'unterarme', 'forearm', 'forearms', 'griffkraft', 'grip'],
  ['bauch', 'abs', 'sixpack', 'core', 'rumpf'],
  ['gesaess', 'po', 'glutes', 'glute', 'hintern', 'booty'],
  ['beinstrecker', 'quads', 'quadrizeps', 'quadriceps', 'oberschenkel vorne'],
  ['beinbeuger', 'hamstrings', 'hamstring', 'oberschenkelrueckseite'],
  ['waden', 'calves', 'calf'],
  ['nacken', 'trapez', 'traps', 'trapezius'],
  ['dehnen', 'dehnung', 'stretch', 'stretching', 'mobility'],
]

/** Kleinbuchstaben, ohne Akzente, ß→ss, ä/ö/ü→a/o/u (die Schreibweise „ae/oe/ue" deckt variante()). */
export const sucheNormal = s => String(s || '')
  .toLowerCase()
  .replace(/ß/g, 'ss')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')

/** „drueckmaschine" → „druckmaschine": die ae/oe/ue-Schreibweise auf den Umlaut-freien Stamm. */
const variante = t => t.replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u')
/** Ohne Bindestriche, Leerzeichen, Apostrophe: „pull-up" = „pull up" = „pullup". */
const kompakt = t => t.replace(/[\s\-'’.]/g, '')

// Begriff → Gruppe. Gespeichert in der Umlaut-freien Schreibweise, damit „bankdruecken",
// „bankdrücken" und „bankdrucken" denselben Schlüssel haben.
const GRUPPE_VON = new Map()
const MEHRWORT = []
SYNONYM_GRUPPEN.forEach((gruppe, i) => {
  for (const begriff of gruppe) {
    const k = variante(sucheNormal(begriff))
    if (!GRUPPE_VON.has(k)) GRUPPE_VON.set(k, i)
    if (!GRUPPE_VON.has(kompakt(k))) GRUPPE_VON.set(kompakt(k), i)
    if (/\s/.test(k)) MEHRWORT.push(k)
  }
})
MEHRWORT.sort((a, b) => b.length - a.length)

/** Die Treffer-Wörter einer Gruppe: ohne Kurz-Abkürzungen (die sind nur Schlüssel). */
const wortlaut = i => SYNONYM_GRUPPEN[i].map(b => variante(sucheNormal(b))).filter(b => b.length >= 3)

/**
 * Suchanfrage → Liste von Begriffen; jeder Begriff ist { eigen, synonyme }.
 * `eigen` ist das getippte Wort (trifft überall), `synonyme` treffen am Wortanfang.
 */
export function suchBegriffe(query) {
  let q = ` ${variante(sucheNormal(query)).replace(/\s+/g, ' ').trim()} `
  if (!q.trim()) return []
  const begriffe = []
  // Mehrwortbegriffe zuerst, als Ganzes: „lat pulldown", „bench press", „hip thrust".
  for (const phrase of MEHRWORT) {
    if (q.includes(` ${phrase} `)) {
      begriffe.push({ eigen: phrase, synonyme: wortlaut(GRUPPE_VON.get(phrase)) })
      q = q.replace(` ${phrase} `, ' ')
    }
  }
  for (const wort of q.split(' ').filter(Boolean)) {
    const gruppe = GRUPPE_VON.get(wort) ?? GRUPPE_VON.get(kompakt(wort))
    begriffe.push({ eigen: wort.length >= 1 ? wort : '', synonyme: gruppe != null ? wortlaut(gruppe) : [] })
  }
  return begriffe
}

/**
 * Text einmal für die Suche aufbereiten (pro Übung zwischengespeichert, siehe exercises.js):
 * Umlaute weg, Wortgrenzen markiert, und einmal ganz ohne Trennzeichen.
 */
export function suchText(text) {
  const t = variante(sucheNormal(text))
  return { t, woerter: ` ${t.replace(/[^a-z0-9]+/g, ' ').trim()} `, ohneTrenner: kompakt(t) }
}

/**
 * Trifft der Begriff den aufbereiteten Text? Das getippte Wort trifft überall (wie bisher),
 * ein Synonym nur am Wortanfang — oder mitten im Wort, wenn es lang genug ist, um nicht zufällig
 * irgendwo drinzustecken (deutsche Komposita: „kniebeuge" in „Frontkniebeuge").
 */
export function trifft(begriff, { t, woerter, ohneTrenner }) {
  const eigen = begriff.eigen
  if (eigen && (t.includes(eigen) || ohneTrenner.includes(kompakt(eigen)))) return true
  return begriff.synonyme.some(syn => {
    const k = kompakt(syn)
    return woerter.includes(` ${syn.replace(/[^a-z0-9]+/g, ' ').trim()}`) || (k.length >= 6 && ohneTrenner.includes(k))
  })
}
