// B&S: Übungen, die der openGym-Datensatz nicht hat, die ein Hybrid-Coaching aber jede Woche
// braucht: Schwimmen, Rad, Ruder-Ergometer, die Hyrox-Stationen — und drei Kraft-Klassiker,
// die im Datensatz schlicht fehlen (Plank, Hip Thrust, Face Pull).
//
// Sie stehen im Katalog wie jede andere Übung (EXIDX, Suche, Plan-Editor), haben aber keine
// Animation — dort zeigt die App das Hantel-Symbol, und der Coach hängt bei Bedarf sein eigenes
// Video an. Die Namen sind direkt deutsch (die App gibt es nur auf Deutsch), die ids beginnen
// mit „bs-", damit sie nie mit einer Nummer aus dem Datensatz kollidieren.
//
//   sport  macht die Übung zur Strecke (Erfassung „Distanz", siehe lib/endurance.js)
//   dm     Vorgabe-Erfassung für Übungen ohne Strecke ('time' = halten)
//
// Muskelangaben im Vokabular des Datensatzes (tg/sm), damit die Körperkarte sie ohne
// Sonderweg liest (lib/muscles.js ALIAS).

export const BS_EXERCISES = [
  // --- Schwimmen ---
  {
    id: 'bs-schwimmen-kraul', n: 'Schwimmen – Kraul', bp: 'cardio', eq: 'body weight',
    tg: 'cardiovascular system', sm: ['lats', 'shoulders', 'triceps', 'core'], sport: 'swim',
    st: ['Strecke und Zeit pro Intervall erfassen — die App rechnet die Pace pro 100 m.', 'Pausen zwischen den Intervallen am Beckenrand, Länge laut Plan.'],
  },
  {
    id: 'bs-schwimmen-brust', n: 'Schwimmen – Brust', bp: 'cardio', eq: 'body weight',
    tg: 'cardiovascular system', sm: ['pectorals', 'quads', 'adductors', 'shoulders'], sport: 'swim',
    st: ['Strecke und Zeit pro Intervall erfassen — die App rechnet die Pace pro 100 m.'],
  },
  {
    id: 'bs-schwimmen-ruecken', n: 'Schwimmen – Rücken', bp: 'cardio', eq: 'body weight',
    tg: 'cardiovascular system', sm: ['lats', 'shoulders', 'core'], sport: 'swim',
    st: ['Strecke und Zeit pro Intervall erfassen — die App rechnet die Pace pro 100 m.'],
  },
  {
    id: 'bs-schwimmen-freiwasser', n: 'Freiwasserschwimmen', bp: 'cardio', eq: 'body weight',
    tg: 'cardiovascular system', sm: ['lats', 'shoulders', 'triceps', 'core'], sport: 'swim',
    st: ['Strecke und Zeit erfassen (Uhr oder Schätzung) — die App rechnet die Pace pro 100 m.', 'Nie allein ins offene Wasser; Boje und auffällige Badekappe.'],
  },
  // --- Rad und Lauf (Triathlon) ---
  {
    id: 'bs-rad-strasse', n: 'Radfahren (Straße)', bp: 'cardio', eq: 'bike',
    tg: 'cardiovascular system', sm: ['quads', 'glutes', 'hamstrings', 'calves'], sport: 'bike',
    st: ['Strecke und Fahrzeit erfassen — die App rechnet den Schnitt in km/h.'],
  },
  {
    id: 'bs-rad-indoor', n: 'Radfahren (Rolle / Indoor)', bp: 'cardio', eq: 'stationary bike',
    tg: 'cardiovascular system', sm: ['quads', 'glutes', 'hamstrings', 'calves'], sport: 'bike',
    st: ['Strecke und Fahrzeit vom Trainer oder der Rolle übernehmen — die App rechnet den Schnitt.'],
  },
  {
    id: 'bs-koppellauf', n: 'Koppellauf (direkt nach dem Rad)', bp: 'cardio', eq: 'body weight',
    tg: 'cardiovascular system', sm: ['quads', 'calves', 'hamstrings', 'glutes'], sport: 'run',
    st: ['Direkt nach der Radeinheit loslaufen — mit dem Rad als Supersatz verbinden.', 'Strecke und Zeit erfassen — die App rechnet die Pace pro km.'],
  },
  {
    id: 'bs-laufband', n: 'Laufen (Laufband)', bp: 'cardio', eq: 'treadmill',
    tg: 'cardiovascular system', sm: ['quads', 'calves', 'hamstrings', 'glutes'], sport: 'run',
    st: ['Strecke und Zeit vom Laufband übernehmen — die App rechnet die Pace pro km.', 'Für draußen gleiche Belastung: 1 % Steigung einstellen.'],
  },
  // --- Ergometer ---
  {
    id: 'bs-rudern-ergo', n: 'Rudern (Ergometer)', bp: 'cardio', eq: 'rowing machine',
    tg: 'cardiovascular system', sm: ['upper back', 'lats', 'quads', 'glutes', 'biceps'], sport: 'row',
    st: ['Beine – Rumpf – Arme beim Zug, umgekehrt beim Vorrollen.', 'Strecke und Zeit vom Display übernehmen — die App rechnet die Zeit pro 500 m.'],
  },
  // --- Hyrox-Stationen ---
  {
    id: 'bs-sled-push', n: 'Sled Push (Schlitten schieben)', bp: 'upper legs', eq: 'sled',
    tg: 'quads', sm: ['glutes', 'calves', 'hamstrings', 'shoulders', 'triceps', 'core'], sport: 'carry',
    st: ['Arme lang oder gebeugt an den Stangen, Körper flach nach vorn geneigt.', 'Kurze, kräftige Schritte über den Vorfuß, Rumpf fest.', 'Hyrox: 4 × 12,5 m mit Wettkampfgewicht.'],
  },
  {
    id: 'bs-sled-pull', n: 'Sled Pull (Schlitten ziehen)', bp: 'back', eq: 'sled',
    tg: 'upper back', sm: ['lats', 'biceps', 'forearms', 'hamstrings', 'glutes'], sport: 'carry',
    st: ['Seil Hand über Hand ziehen, Hüfte tief und hinter dem Körperschwerpunkt.', 'Mit den Beinen gegenstemmen, nicht nur aus den Armen ziehen.', 'Hyrox: 4 × 12,5 m mit Wettkampfgewicht.'],
  },
  {
    id: 'bs-burpee-broad-jump', n: 'Burpee Broad Jumps', bp: 'upper legs', eq: 'body weight',
    tg: 'quads', sm: ['glutes', 'pectorals', 'triceps', 'shoulders', 'calves'], sport: 'carry',
    st: ['Burpee mit Brust am Boden, dann beidbeinig so weit wie möglich nach vorn springen.', 'Hyrox: 80 m. Erfasst wird die Strecke, die Zeit ist optional.'],
  },
  {
    id: 'bs-sandbag-lunges', n: 'Sandbag Lunges (Sandsack-Ausfallschritte)', bp: 'upper legs', eq: 'sandbag',
    tg: 'quads', sm: ['glutes', 'hamstrings', 'core', 'upper back'], sport: 'carry',
    st: ['Sandsack auf den Schultern, Ausfallschritte im Gehen.', 'Hinteres Knie berührt den Boden, Oberkörper aufrecht.', 'Hyrox: 100 m.'],
  },
  {
    id: 'bs-wall-balls', n: 'Wall Balls', bp: 'upper legs', eq: 'medicine ball',
    tg: 'quads', sm: ['glutes', 'shoulders', 'triceps', 'core'],
    st: ['Ball vor der Brust, tiefe Kniebeuge.', 'Aus der Hocke explosiv hoch und den Ball an das Ziel werfen, fangen und direkt in die nächste Kniebeuge.', 'Hyrox: 100 Wiederholungen.'],
  },
  // --- Kraft-Klassiker, die im Datensatz fehlen ---
  {
    id: 'bs-plank', n: 'Unterarmstütz (Plank)', bp: 'waist', eq: 'body weight',
    tg: 'abs', sm: ['obliques', 'shoulders', 'glutes'], dm: 'time',
    st: ['Unterarme unter den Schultern, Körper eine gerade Linie von Kopf bis Ferse.', 'Bauch und Gesäß fest, nicht ins Hohlkreuz fallen.'],
  },
  {
    id: 'bs-hip-thrust', n: 'Hip Thrust (Langhantel)', bp: 'upper legs', eq: 'barbell',
    tg: 'glutes', sm: ['hamstrings', 'quads', 'core'],
    st: ['Schulterblätter an der Bank, Langhantel gepolstert auf der Hüfte.', 'Hüfte strecken, bis Oberkörper und Oberschenkel eine Linie bilden; oben kurz das Gesäß anspannen.'],
  },
  {
    id: 'bs-face-pull', n: 'Face Pull (Kabelzug)', bp: 'shoulders', eq: 'cable',
    tg: 'delts', sm: ['rear deltoids', 'traps', 'rhomboids', 'rotator cuff'],
    st: ['Seil auf Augenhöhe, mit den Daumen nach hinten zum Gesicht ziehen.', 'Ellbogen hoch, am Ende die Hände nach außen drehen.'],
  },
]
