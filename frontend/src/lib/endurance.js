// B&S: Ausdauer als eigene Erfassungsart „Distanz" (mode 'dist').
//
// openGym kennt für Cardio nur Minuten + km/h. Läufer, Schwimmer, Triathleten und Hyrox-Athleten
// denken aber in Strecke und Zeit — „6 × 800 m in 3:10", „10 × 100 m Kraul", „50 m Sled Push mit
// 152 kg" — und lesen daraus die Pace. Darum:
//
//   Plan (Routine-Eintrag): { mode: 'dist', sets, m, sec?, weight?, restSec? }
//     m      Strecke pro Satz/Intervall in Metern
//     sec    Zielzeit pro Satz in Sekunden (optional — ohne steht nur die Strecke da)
//     weight Last in kg (optional — Schlitten, Farmer's Carry, Sandsack)
//   Protokoll (Satz): { m, sec, w?, done }
//
// Die Pace wird nie gespeichert, nur aus Strecke und Zeit abgeleitet — so kann sie nie zu den
// beiden anderen Zahlen im Widerspruch stehen. Wie sie angezeigt wird, hängt von der Sportart ab:
// Laufen pro km, Schwimmen pro 100 m, Rudern und SkiErg pro 500 m, Rad als km/h.

import { EXIDX } from './exercises.js'

export const SPORTS = {
  run:   { pace: 1000, step: 100,  dflt: 5000,  label: 'Laufen' },
  swim:  { pace: 100,  step: 25,   dflt: 400,   label: 'Schwimmen' },
  bike:  { pace: 0,    step: 1000, dflt: 20000, label: 'Rad' },
  row:   { pace: 500,  step: 100,  dflt: 1000,  label: 'Rudern' },
  ski:   { pace: 500,  step: 100,  dflt: 1000,  label: 'SkiErg' },
  carry: { pace: null, step: 5,    dflt: 50,    label: 'Strecke' },
}

// Katalog-Übungen aus dem openGym-Datensatz, die in Wahrheit Strecken sind. Die neuen
// B&S-Übungen (lib/bs-exercises.js) tragen `sport` selbst.
const SPORT_OF = {
  '0685': 'run',   // Laufen
  '0684': 'run',   // Laufen (Gerät)
  '3666': 'run',   // Gehen am Laufband mit Steigung
  '0798': 'bike',  // Radfahren locker (Ergometer)
  '2138': 'bike',  // Radfahren schnell (Ergometer)
  '2142': 'ski',   // SkiErg
  '2133': 'carry', // Farmer's Walk
}

const exOf = idOrEx => (typeof idOrEx === 'string' ? EXIDX[idOrEx] : idOrEx)

/** Sportart einer Übung oder null (dann ist sie keine Strecke). */
export function sportOf(idOrEx) {
  const ex = exOf(idOrEx)
  if (!ex) return null
  if (ex.sport && SPORTS[ex.sport]) return ex.sport
  return SPORT_OF[ex.id] || null
}

const n = v => (Number.isFinite(Number(v)) ? Number(v) : 0)

/** „800 m", „12,5 m", „5 km", „21,1 km" — ab einem Kilometer in km, deutsches Komma. */
export function fmtDist(m) {
  // Eine Nachkommastelle unter 1 km: Hyrox schiebt den Schlitten in Bahnen zu 12,5 m.
  const meters = Math.max(0, Math.round(n(m) * 10) / 10)
  if (meters < 1000) return meters.toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' m'
  const km = Math.round(meters / 10) / 100
  return km.toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' km'
}

/** „3:10", „1:02:30" — ab einer Stunde mit Stunden. */
export function fmtDur(sec) {
  const s = Math.max(0, Math.round(n(sec)))
  const h = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(mm).padStart(2, '0')}:${ss}` : `${mm}:${ss}`
}

/**
 * Getippte Dauer → Sekunden, oder null, wenn das keine Dauer ist.
 * „3:10" = 190 s, „1:02:30" = 3750 s, „45" = 45 MINUTEN (wer eine Laufzeit tippt, meint mit
 * einer nackten Zahl Minuten; Sekunden gehen als „0:45"). Komma und Punkt zählen wie der
 * Doppelpunkt, weil die Zahlentastatur am Handy keinen hat.
 */
export function parseDur(text) {
  const raw = String(text ?? '').trim().replace(/[.,]/g, ':')
  if (!raw) return null
  if (!/^\d+(:\d{1,2}){0,2}$/.test(raw)) return null
  const parts = raw.split(':').map(Number)
  if (parts.length === 1) return parts[0] * 60
  if (parts.slice(1).some(p => p > 59)) return null
  return parts.reduce((total, p) => total * 60 + p, 0)
}

/**
 * Pace zu Strecke und Zeit, passend zur Sportart: „4:30 /km", „1:45 /100 m", „1:52 /500 m",
 * „32,4 km/h". Leer, wenn eine der beiden Zahlen fehlt oder die Sportart keine Pace kennt.
 */
export function paceLabel(sport, m, sec) {
  const meters = n(m), seconds = n(sec)
  const cfg = SPORTS[sport] || SPORTS.run
  if (!(meters > 0) || !(seconds > 0) || cfg.pace === null) return ''
  if (cfg.pace === 0) {
    const kmh = Math.round((meters / 1000) / (seconds / 3600) * 10) / 10
    return kmh.toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' km/h'
  }
  const per = seconds * cfg.pace / meters
  return fmtDur(per) + (cfg.pace === 1000 ? ' /km' : ` /${cfg.pace} m`)
}

/** Umkehrung für den Plan-Editor: Pace (Sekunden pro Pace-Einheit) × Strecke → Zielzeit. */
export function timeForPace(sport, m, paceSec) {
  const cfg = SPORTS[sport] || SPORTS.run
  if (!(n(m) > 0) || !(n(paceSec) > 0) || !cfg.pace) return null
  return Math.round(n(paceSec) * n(m) / cfg.pace)
}

/** Sekunden pro Pace-Einheit (für das Pace-Feld im Editor), oder null. */
export function paceSecOf(sport, m, sec) {
  const cfg = SPORTS[sport] || SPORTS.run
  if (!(n(m) > 0) || !(n(sec) > 0) || !cfg.pace) return null
  return Math.round(n(sec) * cfg.pace / n(m))
}

/** Einheit des Pace-Felds: „/km", „/100 m", „/500 m" — oder null (Rad, Strecke ohne Pace). */
export function paceUnit(sport) {
  const cfg = SPORTS[sport] || SPORTS.run
  if (!cfg.pace) return null
  return cfg.pace === 1000 ? '/km' : `/${cfg.pace} m`
}

/** Schrittweite des Streckenfelds: 25 m im Becken, 100 m auf der Bahn, 1 km auf dem Rad. */
export const distStep = sport => (SPORTS[sport] || SPORTS.run).step

/** Vorgabe für eine frisch hinzugefügte Strecken-Übung. */
export function distDefaults(sport) {
  return { sets: 1, m: (SPORTS[sport] || SPORTS.run).dflt }
}

/**
 * Ein Satz oder eine Vorgabe in einer Zeile: „800 m · 3:10 · 3:58 /km", „50 m · 152 kg".
 * Fehlt die Zeit, steht nur die Strecke da.
 */
export function distLine({ m, sec, w }, sport, unit = 'kg') {
  const parts = [fmtDist(m)]
  if (n(sec) > 0) parts.push(fmtDur(sec))
  const pace = paceLabel(sport, m, sec)
  if (pace) parts.push(pace)
  if (n(w) > 0) parts.push(String(Math.round(n(w) * 10) / 10).replace('.', ',') + ' ' + unit)
  return parts.join(' · ')
}

/** Gesamtstrecke erledigter Arbeitssätze in Metern — für Verlauf und Statistik. */
export const totalMeters = rows => (Array.isArray(rows) ? rows : []).reduce((sum, s) => sum + Math.max(0, n(s?.m)), 0)
