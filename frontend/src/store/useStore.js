import { create } from 'zustand'
import { api } from '../lib/api.js'
import { t, exerciseNameFor } from '../lib/i18n.js'
import { EXIDX, registerCustom } from '../lib/exercises.js'
import { mergeStates, localExtras, unionById } from '../lib/sync-merge.js'
import { readEditorParam } from '../lib/editor-mode.js'

import { WC_DEFAULT } from '../lib/workout-controls.js'

const KEY = 'gym_state_v1'
// Where this device stands with the server: the revision it last adopted or pushed, and its own
// `_ts` at that moment. `rev` goes back to the server as `baseRev` on every push, so a write over
// a document this device never saw is refused (409) instead of dropping another device's work;
// `ts` tells a pull whether anything changed here since. See pushState/pullState.
const SYNC_KEY = 'gym_sync'
const CHECK_MIN_MS = 3000    // rev checks closer together than this are the same event (focus + visibility)
const POLL_MS = 30000        // while the app is open and signed in, ask the server for its revision this often
export const DEF = {
  // B&S: Sprache, Theme und Akzent sind keine Einstellung mehr — die App ist deutsch, dunkel
  // und Elektro-Blau wie die Website. forcePrefs() zieht ältere Profile darauf nach.
  unit: 'kg', restSec: 90, restPauseSec: 15, sound: true, soundOnSilent: false, timerFlash: false, keepAwake: true, lang: 'de',
  theme: 'dark', accent: 'blau', body: 'male', targetW: null,
  bodyweight: [], routines: [], week: {}, dayPlan: {},
  exWeights: {}, workouts: [], active: null, customEx: [], gifSize: 'full',
  // How the active workout is laid out — 'cards' (one exercise at a time with Prev/Next),
  // 'list' (every exercise stacked and scrollable) or 'compact' (that stack stripped to just
  // names and set rows — no media, tags, notes, last-time or progression line). Purely
  // presentational: profiles written before this setting existed overlay onto DEF and keep the
  // 'cards' behaviour. beginWorkout copies the value onto s.active, so the header ⋮ menu can
  // override it for the running session without touching this saved default.
  workoutView: 'cards',
  // Which controls the workout screen shows besides the sets themselves. The default is the
  // lean layout: one "more" button per exercise and a menu on each set number. Every switch
  // brings one of the old always-visible button groups back (Settings → During a workout).
  wc: { ...WC_DEFAULT },
  // effort: which per-set effort scale is logged — 'none' | 'rir' | 'rpe'. null, not 'none', so
  // that a profile which never chose (loaded state is overlaid on DEF, on every path: local,
  // server pull, backup import) still falls back to the `showRir` boolean this replaced and
  // keeps the column it had. See effortOf.
  reminder: { on: false, time: '08:00', tz: null }, effort: null, autoBackup: false,
  // Equipment profiles (issue: filter Library/picker/routines by what you actually own —
  // e.g. "Home" vs "Gym" — building on the session-only equipment filter from issue #6).
  equipProfiles: [], activeEquipId: null, equipFilterOn: false,
  // Standing per-exercise notes, keyed by exercise id: the gym-specific facts that are true
  // every time you do the movement ("seat 4, pin 7"). Distinct from a routine's `note`, which
  // belongs to one exercise in one plan, and from a session note, which belongs to one day.
  exNotes: {},
  // Favourite exercise ids (issue #6) — sorted to the top of the picker/Library. Personal, so
  // it syncs with the profile but is never part of a shared plan bundle (lib/favourites.js).
  favEx: [],
  // First day of the week as a getDay() index — 1 Monday, 0 Sunday. Monday is the default so
  // every profile written before this setting existed keeps the week it has been looking at.
  // See lib/format.js: nothing reads this field directly, everything goes through the helpers.
  weekStart: 1,
  // Per-exercise bar weight overrides, keyed by exercise id, in the profile unit (see
  // lib/bar.js). Personal equipment, so it syncs with the account but never travels in a
  // shared plan. Logged weights stay the total — this only feeds the plate math.
  barWeights: {},
  // Gym check-in cards (see views/CheckIn.jsx). Each is a membership
  // code shown as a QR/barcode at the gym's turnstile — added by typing it, importing a photo
  // of the card, or scanning it. We only ever keep the code's VALUE, never a photo: the image
  // is regenerated from `value` every time it's shown (lib/qr.js). `fmt` is the barcode symbology
  // ('qrcode' | 'ean13' | 'code128' | … — lower-cased BarcodeFormat) so it renders as the same
  // kind of code the gym issued. Just data, so it syncs and backs up like everything else.
  //   [{ id, label, value, fmt }]
  gymCards: [],
  // The card the check-in screen last settled on, so it reopens where you left it (handy when
  // you have more than one gym). Holds a gymCards id, or null before any card exists / is chosen;
  // a stale id (card since removed) is simply ignored by the view.
  lastGymCardId: null,
  // Whether the check-in feature is on at all (Settings toggle). Off hides the Home
  // card and the /checkin route; the saved gymCards stay so turning it back on restores them.
  // Defaults on; an older profile without the key reads as on (`!== false`).
  checkIn: true,
  // Whether Start opens the quick weigh-in first (sheets.jsx startFlow, issue #137). Off starts
  // the session straight away; weight can still be logged from Home/Stats. Defaults on; an
  // older profile without the key reads as on (`!== false`).
  weighIn: true,
}
const clone = o => JSON.parse(JSON.stringify(o))

// B&S: Jede geladene Kopie — localStorage, Server, Backup — wird auf die App-Vorgaben gezogen.
// Ein Profil aus openGym-Zeiten bringt sonst Englisch, Hell oder Lime mit, und es gibt keine
// Einstellung mehr, mit der man das wieder loswürde.
const forcePrefs = S => { S.lang = DEF.lang; S.theme = DEF.theme; S.accent = DEF.accent; return S }

function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return forcePrefs(Object.assign(clone(DEF), JSON.parse(raw)))
  } catch (e) { /* ignore */ }
  return clone(DEF)
}

// B&S: Die Website besitzt die Anmeldung (Cookie bs_session). Ohne Session geht es dorthin
// zurück — mit der Route, auf der man stand, im `weiter`-Parameter. `location.search` gehört
// mit dazu: dort steht `?kunde=<id>`, und ohne ihn käme ein Coach nach dem Login in seinem
// EIGENEN Profil an statt im Plan-Editor des Mitglieds.
export const loginUrl = () => '/login?weiter=' + encodeURIComponent('/training/' + location.search + location.hash)

// B&S: Hält die Website die Anmeldung für gültig, während /api/me hier 401 antwortet (ein
// abweichendes AUTH_SECRET in der Gym-Umgebung, eine falsche DATABASE_URL), schickt sie uns
// sofort zurück — und die Weiterleitung liefe endlos, ohne einen Buchstaben auf dem Bildschirm
// und ohne Zurück-Knopf (location.replace). Eine Marke in der sessionStorage überlebt genau
// diesen Sprung: liegt sie beim nächsten Start noch da, wird nicht erneut weitergeleitet,
// sondern der Fehler gezeigt (views/Login.jsx). setUser() räumt sie weg, sobald eine
// Anmeldung bestätigt ist.
const BOUNCE_KEY = 'gym_login_bounce'
let redirecting = false   // in DIESEM Seitenleben läuft die Weiterleitung schon
const bounced = () => { try { return sessionStorage.getItem(BOUNCE_KEY) === '1' } catch (e) { return false } }
export const clearLoginBounce = () => {
  redirecting = false
  try { sessionStorage.removeItem(BOUNCE_KEY) } catch (e) { /* ignore */ }
}
/** @returns {boolean} false = es wurde NICHT weitergeleitet — der Aufrufer muss den Fehler zeigen. */
export const redirectToLogin = () => {
  if (redirecting) return true
  if (bounced()) return false
  redirecting = true
  try { sessionStorage.setItem(BOUNCE_KEY, '1') } catch (e) { /* ignore */ }
  try { window.location.replace(loginUrl()) } catch (e) { /* ignore */ }
  return true
}

// B&S: `?kunde=` aus der Adresse nehmen, ohne die Seite neu zu laden — ab hier liefert
// readEditorParam() null und die App läuft wie für jedes andere Mitglied. NUR `kunde`:
// vorher ging die ganze Query weg und mit ihr `?direkt=1`, die einzige dokumentierte
// Möglichkeit, ein Preview-Deployment direkt zu prüfen (lib/canonical-host.js) — der nächste
// Reload warf den Prüfenden auf die Produktion.
const dropEditorParam = () => {
  try {
    const u = new URL(location.href)
    u.searchParams.delete('kunde')
    history.replaceState(history.state, '', u.pathname + u.search + u.hash)
  } catch (e) { /* ignore */ }
}

/* B&S: Im Plan-Editor liegt auch der Übungs-Katalog des MITGLIEDS auf dem Schirm. Was nicht
   zum Plan gehört (keine Routine benutzt es, keine Coach-Marke), gehört ihm: pushPlan filtert
   es weg und der Server verwirft es (lib/state.js: coachOwnedCustomEx). Die Änderung stand
   trotzdem auf dem Schirm, samt „Gespeichert“. sheets.jsx zeigt denselben Text an den Knöpfen. */
export const MEMBER_EX_HINT = 'Diese Übung hat das Mitglied selbst angelegt — im Plan-Editor kannst du nur die Übungen ändern, die zum Plan gehören.'

const hasData = st => !!((st.workouts || []).length || (st.routines || []).length || (st.bodyweight || []).length)

// Decide whether a pulled account state may replace the local saved state. A local active workout
// is deliberately carried forward: the server stores completed/saved state, while the in-progress
// session belongs to the device that is currently running it.
export function restoredStateFor(local, remote, dirty = false) {
  if (!remote || (hasData(local) && (dirty || (remote._ts || 0) < (local._ts || 0)))) return null
  const next = Object.assign(clone(DEF), remote)
  if (local.active) next.active = local.active
  return next
}

export const useStore = create((set, get) => {
  let pushTm = null
  let toldTooLarge = false
  let pushing = null       // the PUT in flight, so a second push waits for it instead of racing it
  let pushAgain = false    // a push asked for while one was in flight — run once more after it
  let pulling = null       // the GET in flight, so two resume signals make one request
  let pushPending = false  // a change made before boot's pull — pushed once boot is through
  // B&S: dasselbe für den Plan-Editor — höchstens ein PUT /api/trainer/plan unterwegs.
  let planPushing = null
  let planPushAgain = false
  let forceNext = false    // the next push replaces the server copy outright (import, reset)
  let lastCheck = 0
  let pollTm = null
  let offlineChanges = false   // a push failed for lack of network — the next one that lands says so

  const readSync = () => { try { return JSON.parse(localStorage.getItem(SYNC_KEY)) || null } catch { return null } }
  const writeSync = (rev, ts) => localStorage.setItem(SYNC_KEY, JSON.stringify({ rev, ts: ts || 0 }))
  // What the banner shows a signed-in user: `offline` when the server could not be reached at
  // all, `pending` while a change is still owed to it (either way, or a push the server refused).
  const setSync = patch => {
    const cur = get().sync
    const next = { ...cur, ...patch }
    if (next.offline !== cur.offline || next.pending !== cur.pending || next.lastSynced !== cur.lastSynced) set({ sync: next })
  }
  const isNetworkError = e => e && e.status == null   // fetch itself failed: no response at all

  // B&S: Im Plan-Editor (und auf dessen Fehlerbildschirm) sieht die App den Stand eines
  // Mitglieds an, im localStorage liegt aber das eigene Profil des Coaches. Keine Zeile davon
  // wird hier gelesen oder geschrieben, und es läuft keine Synchronisation des eigenen Profils.
  // `editorBoot` deckt die Zeit ab, in der bootEditor noch auf den Server wartet: ohne sie gäbe
  // es ein Fenster, in dem eine einzige Änderung das Profil des Coaches mit den Vorgaben
  // überschreibt (localStorage) und es später über sein eigenes Konto pusht.
  const inEditor = () => !!get().editor || !!get().editorError || !!get().editorBoot

  // B&S: Kurzer Hinweis in der Oberfläche. useUI importiert diesen Store, daher der späte Import.
  const hinweis = msg => {
    import('./useUI.js').then(({ useUI }) => useUI.getState().toast(msg)).catch(() => {})
  }

  /* B&S: Der Server antwortet 200 und sagt dabei, was er verworfen hat: `gekuerzt` sind die
     Obergrenzen, die er abgeschnitten hat (lib/plan.js), `fremdeUebungen` sind eigene Übungen
     des Mitglieds, die nicht in den Plan dürfen (lib/state.js: coachOwnedCustomEx). Ohne diese
     Meldung arbeitete der Coach auf einem Plan weiter, den der Server so nie hatte — und über
     allem stand „Gespeichert“. Fehlt das Feld (älterer Server), passiert hier nichts. */
  const GRENZ_TEXT = {
    routines: 'Routinen (max. 50)',
    ex: 'Übungen in einer Routine (max. 40)',
    customEx: 'eigene Übungen (max. 200)'
  }
  // Jede Meldung genau einmal: dieselbe Kürzung kommt bei JEDEM weiteren Push zurück (der
  // Editor schickt den Plan am Stück), und ein Dutzend gleicher Toasts verdeckt die
  // Meldungen, auf die es hier ankommt.
  let letzteVerwerfung = ''
  const sagWasVerworfenWurde = r => {
    const g = r && typeof r.gekuerzt === 'object' && r.gekuerzt ? r.gekuerzt : null
    const teile = g ? Object.entries(g).filter(([, n]) => Number.isFinite(n) && n > 0).map(([k, n]) => n + ' × ' + (GRENZ_TEXT[k] || k)) : []
    const fremde = Array.isArray(r?.fremdeUebungen) ? r.fremdeUebungen.filter(id => typeof id === 'string') : []
    const msg = teile.length
      ? 'Beim Speichern gekürzt: ' + teile.join(', ') + '. Lade den Plan neu, um den gespeicherten Stand zu sehen.'
      : fremde.length
        // B&S: Neutral formuliert — derselbe Hinweis kommt auch, wenn der Coach eine eigene
        // Übung des Mitglieds ganz regulär in eine Routine hängt (die Routine behält sie, nur
        // der Katalog-Eintrag bleibt dem Mitglied). Ein Vorwurf wäre dort falsch.
        ? 'Eigene Übungen des Mitglieds bleiben seine — Namen und Beschreibungen daran speichert der Server nicht.'
        : ''
    const marke = msg + '|' + fremde.join(',')
    if (!msg || marke === letzteVerwerfung) return
    letzteVerwerfung = marke
    hinweis(msg)
  }

  /* B&S: Die Grenze des Plan-Editors liegt hier im Store, nicht in den einzelnen Ansichten.
     Auf dem Bildschirm steht der Stand des Mitglieds; dem Coach gehört davon nur der Plan —
     `routines`, `week` und die eigenen Übungen (`customEx`), die der Plan benutzt. Jede andere
     Änderung (Workout löschen, Favoriten-Stern, Session-Notiz, Einstellungen, Backup-Import …)
     wäre eine Geisterbewegung: Sie stünde auf dem Schirm, erreichte keinen Server und löste
     trotzdem einen Plan-Push samt rev-Erhöhung aus — das Gerät des Mitglieds lädt dann alles
     neu, wegen einer Änderung, die es gar nicht gibt. Darum wird sie abgelehnt, mit Hinweis. */
  const PLAN_FIELDS = ['routines', 'week', 'customEx']
  const IS_PLAN_FIELD = new Set(PLAN_FIELDS)
  const planChanged = (cur, next) => PLAN_FIELDS.some(k => !same(cur[k], next[k]))
  const memberChanged = (cur, next) => {
    for (const k of new Set([...Object.keys(cur), ...Object.keys(next)])) {
      if (IS_PLAN_FIELD.has(k)) continue
      const a = cur[k]
      const b = next[k]
      if (a === b) continue
      if (a && b && typeof a === 'object' && typeof b === 'object' && same(a, b)) continue
      return true
    }
    return false
  }
  /* Eine echte Plan-Änderung räumt nebenbei auch im Stand des Mitglieds auf: „Routine löschen“
     nimmt die id aus `dayPlan`, „Übung löschen“ aus `exWeights`, `favEx` und den History-
     Einträgen. Diese Nebenwirkungen gehören dem Mitglied und bleiben hier stehen (sein Gerät
     räumt selbst auf) — die Absicht des Coaches, die Plan-Änderung, geht durch. Nur die drei
     Plan-Felder werden übernommen. */
  const planOnly = (cur, next) => {
    const out = { ...cur }
    for (const k of PLAN_FIELDS) out[k] = next[k]
    return out
  }
  // B&S: Eine Übung, die der Coach im Editor neu anlegt, gehört ihm: sie wandert mit dem Plan
  // und verschwindet mit ihm. Die Marke `src:'coach'` übersteht den Server (validatePlan lässt
  // die Einträge unverändert) und unterscheidet sie später von den eigenen des Mitglieds.
  const markCoachEx = (cur, next) => {
    const had = new Set((cur.customEx || []).map(e => e && e.id))
    next.customEx = (next.customEx || []).map(e => (e && e.id && !had.has(e.id) && e.src !== 'coach' ? { ...e, src: 'coach' } : e))
  }
  /* B&S: …und die Gegenprobe. Ein Eintrag, den der Coach weder selbst angelegt hat
     (`src:'coach'`) noch eine Routine benutzt, gehört dem Mitglied. pushPlan filtert ihn weg
     und lib/state.js: coachOwnedCustomEx verwirft ihn — die Umbenennung stünde auf dem Schirm,
     der Plan bliebe unverändert, der Server antwortete 200 und das Banner meldete
     „Gespeichert“. Also gar nicht erst anwenden. Neue Einträge trägt markCoachEx bereits. */
  const touchesMemberEx = (cur, next) => {
    const used = new Set()
    for (const r of (cur.routines || [])) for (const e of (r?.ex || [])) if (e?.id) used.add(e.id)
    const nachher = new Map((next.customEx || []).filter(e => e && e.id).map(e => [e.id, e]))
    for (const e of (cur.customEx || [])) {
      if (!e || !e.id) continue
      const n = nachher.get(e.id)
      if (n && same(e, n)) continue
      if (e.src === 'coach' || used.has(e.id)) continue
      return true
    }
    return false
  }

  // `_ts` is when this device last changed the data — it decides which copy wins on the next
  // pull (restoredStateFor). A copy merely adopted from the server keeps the stamp it came
  // with: re-stamping a read would make an unchanged copy look newer than a real change made
  // on another device, and push it over that change.
  const persist = (S, push = true, stamp = true) => {
    forcePrefs(S)
    // B&S: Editor-Modus — nichts in den localStorage, nichts an /api/data. Was der Coach
    // ändert, geht gebündelt als Plan an /api/trainer/plan (pushPlan).
    if (inEditor()) {
      const cur = get().S
      if (!planChanged(cur, S)) {
        // Nichts am Plan — dann war die Aktion hier fehl am Platz (Workout löschen, Favoriten-
        // Stern, Session-Notiz, Einstellung). Ohne Anwendung, ohne Push, ohne rev-Erhöhung.
        if (memberChanged(cur, S)) hinweis('Im Plan-Editor kannst du nur den Plan ändern.')
        return
      }
      const next = planOnly(cur, S)
      const editing = !!get().editor
      if (editing) markCoachEx(cur, next)
      if (editing && touchesMemberEx(cur, next)) { hinweis(MEMBER_EX_HINT); return }
      registerCustom(next.customEx)
      // B&S: „Gespeichert“ darf nie über einer Änderung stehen, die noch in der Sammlung liegt.
      set({ S: next, ...(editing && push ? { editorSave: 'idle' } : {}) })
      if (push && editing) {
        clearTimeout(pushTm)
        pushTm = setTimeout(() => get().pushPlan(), 1500)
      }
      return
    }
    if (stamp) S._ts = Date.now()
    registerCustom(S.customEx)
    localStorage.setItem(KEY, JSON.stringify(S))
    set({ S })
    if (push && get().user) {
      // Before boot has pulled, the copy in hand may be older than the server's: a push now
      // would carry it with a stale (or no) baseRev. It waits for finishBoot.
      if (!get().ready) { pushPending = true; return }
      clearTimeout(pushTm)
      pushTm = setTimeout(() => get().pushState(), 1500)
    }
  }
  // Boot's last step: from here on changes push, and one made during boot goes now.
  const finishBoot = (extra = {}) => {
    set({ ready: true, ...extra })
    if (pushPending && get().user) {
      clearTimeout(pushTm)
      pushTm = setTimeout(() => get().pushState(), 1500)
    }
    pushPending = false
  }

  // A signed-in device shows what the server has. Coming back — to the tab, the window, the app,
  // the network — and every half minute while open, it asks the server for its revision (one
  // small GET) and fetches the document only when the number moved; a change still owed to the
  // server is pushed on the same occasion. A phone that sat in a pocket all afternoon and a
  // desktop tab left open all week used to show, and then push, whatever they last had.
  const checkRev = async (force = false) => {
    if (inEditor()) return   // B&S: der Coach sieht einen fremden Stand an — nichts zu vergleichen
    if (!get().user || !get().ready || document.visibilityState === 'hidden') return
    if (!force && Date.now() - lastCheck < CHECK_MIN_MS) return
    lastCheck = Date.now()
    if (pulling) return pulling
    const sync = readSync()
    const owed = localStorage.getItem('gym_dirty') === '1' || pushTm !== null || pushPending
    if (!sync || owed) return get().pullState()
    try {
      const { rev } = await api('/api/data/rev')
      setSync({ offline: false })
      if (rev !== sync.rev) return get().pullState()
    } catch (e) {
      if (e.status === 401) return
      if (isNetworkError(e)) setSync({ offline: true })
      else return get().pullState()   // a server that lacks the route (older API) — the full pull knows the old protocol
    }
  }
  const schedulePoll = () => {
    clearTimeout(pollTm)
    pollTm = setTimeout(() => { checkRev(); schedulePoll() }, POLL_MS)
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkRev() })
  window.addEventListener('focus', () => checkRev())
  window.addEventListener('pageshow', e => { if (e.persisted) checkRev() })
  window.addEventListener('online', () => checkRev(true))   // also retries a push that failed offline
  schedulePoll()

  // Both copies changed: keep both sides' entries, let the newer copy decide the rest
  // (lib/sync-merge.js), and remember the server's revision so the push that follows is
  // conditional on exactly the document that was merged. The merged copy is stamped — it is a
  // real change this device now holds — while `ts` in the marker stays old, so a pull that
  // happens before the push lands still sees it as unsent.
  const mergeInto = (local, remote, rev) => {
    // B&S: `server: 'b'` — routines/week gehören den Coaches, die Server-Kopie gilt. Ist der
    // angemeldete Benutzer SELBST Coach, ist das sein eigener Plan (api/data.js: selfOwnedPlan)
    // und gehört in die normale _ts-Logik: sonst wäre eine offline gemachte Planänderung von
    // ihm still weg.
    const eigenerPlan = !!get().user?.coach
    const merged = Object.assign(clone(DEF), mergeStates(local, remote, eigenerPlan ? {} : { server: 'b' }))
    merged.active = local.active || null
    persist(merged, false)
    writeSync(rev, readSync()?.ts || 0)
  }
  // Take the server's copy as this device's own, timestamp and all (see persist).
  const adopt = (next, rev) => { persist(next, false, false); writeSync(rev, next._ts) }

  const same = (x, y) => JSON.stringify(x) === JSON.stringify(y)
  // B&S: Der Server schickt auf jeden PUT den Plan zurück, der dem Mitglied gehört (die Coaches
  // haben ihn womöglich gerade geändert — der eigene PUT hat ihn gar nicht erst mitgeschickt).
  // Er wird übernommen, ohne zu stempeln und ohne einen weiteren Push auszulösen; sonst schaukeln
  // sich Push und Re-Render gegenseitig hoch. Nur schreiben, wenn sich wirklich etwas ändert.
  // B&S: Übungen, die der Coach angelegt hat (`src:'coach'`), gehören zum Plan. Nimmt er eine
  // aus jeder Routine heraus, trägt der Plan sie nicht mehr — die Vereinigung unten würde sie
  // sonst als „eigene“ Übung des Mitglieds zurücklassen, die kein Coach mehr erreicht. Hat das
  // Mitglied damit schon trainiert, bleibt sie erhalten (in der History stünde sonst nur noch
  // „Unbekannte Übung“) und gehört ab jetzt ihm: die Marke fällt weg.
  const loggedExIds = S => {
    const ids = new Set()
    for (const w of (S.workouts || [])) for (const e of ((w && w.entries) || [])) if (e && e.id) ids.add(e.id)
    return ids
  }
  const ownEx = (S, planCustom) => {
    const own = (S.customEx || []).filter(Boolean)
    const planIds = new Set((planCustom || []).map(e => e && e.id))
    if (!own.some(e => e.src === 'coach' && !planIds.has(e.id))) return own
    const logged = loggedExIds(S)
    const out = []
    for (const e of own) {
      if (e.src !== 'coach' || planIds.has(e.id)) { out.push(e); continue }
      if (logged.has(e.id)) { const { src, ...rest } = e; out.push(rest) }
    }
    return out
  }

  const applyPlan = plan => {
    if (!plan) return
    const S = get().S
    const routines = Array.isArray(plan.routines) ? plan.routines : []
    const week = plan.week && typeof plan.week === 'object' ? plan.week : {}
    const customEx = unionById(plan.customEx, ownEx(S, plan.customEx))
    if (same(S.routines, routines) && same(S.week, week) && same(S.customEx, customEx)) return
    const next = Object.assign(clone(S), { routines: clone(routines), week: clone(week), customEx: clone(customEx) })
    persist(next, false, false)
  }

  const doPush = async (attempt = 0) => {
    const S = get().S
    const sync = readSync()
    const force = forceNext
    const body = { state: S }
    if (!force && sync) body.baseRev = sync.rev
    try {
      const r = await api('/api/data', { method: 'PUT', body: JSON.stringify(body) })
      if (force) forceNext = false
      // A server from before revisions answers without one — then there is nothing to hold the
      // next push to, and the marker must not pretend otherwise.
      if (r.rev == null) localStorage.removeItem(SYNC_KEY)
      else writeSync(r.rev, S._ts)
      localStorage.removeItem('gym_dirty')
      applyPlan(r.plan)
      toldTooLarge = false
      // Back from offline with changes that were waiting: say so once — the banner that promised
      // "syncs when you're back online" has just kept its word.
      setSync({ offline: false, pending: false, lastSynced: Date.now() })
      if (offlineChanges) {
        offlineChanges = false
        import('./useUI.js').then(({ useUI }) => useUI.getState().toast(t('Back online — synced with the server.'))).catch(() => {})
      }
    } catch (e) {
      // A session that is gone is boot's business (/api/me); the copy stays owed to the server.
      if (e.status === 401) { localStorage.setItem('gym_dirty', '1'); return }
      if (isNetworkError(e)) { localStorage.setItem('gym_dirty', '1'); offlineChanges = true; setSync({ offline: true, pending: true }); return }
      if (e.status === 409 && e.data && attempt < 2) {
        // Another device wrote since this one last read. The server sent its document along;
        // merge and push once more against that revision. A second refusal in a row leaves the
        // copy dirty and the next resume pull takes it from there.
        mergeInto(get().S, e.data.state, e.data.rev || 0)
        return doPush(attempt + 1)
      }
      localStorage.setItem('gym_dirty', '1')
      setSync({ offline: false, pending: true })
      // A 413 means the document is past the API's body limit (B&S: 4 MB, siehe gym-app/api).
      // Every later push is at least as big, so nothing reaches the server until the limit is
      // raised — said once per refusal streak; gym_dirty keeps the retries going. useUI imports
      // this store, hence the lazy import.
      if (e.status === 413 && !toldTooLarge) {
        toldTooLarge = true
        import('./useUI.js')
          .then(({ useUI }) => useUI.getState().toast(t('Sync failed: the server refused the upload as too large. Your changes have not reached the server.')))
          .catch(() => {})
      }
    }
  }

  // A change made right before switching away/closing the tab must not get lost mid-debounce —
  // a set logged and the phone pocketed straight after. B&S: im Editor-Modus betrifft das den
  // Plan, den der Coach gerade geändert hat.
  const flush = () => {
    if (!pushTm) return
    clearTimeout(pushTm)
    pushTm = null
    // B&S: Beim Verlassen der Seite bricht der Browser einen normalen fetch ab. `keepalive`
    // lässt ihn weiterlaufen, auch wenn die Seite schon weg ist — sonst verliert der Coach
    // genau die Änderung, die er als Letztes gemacht hat.
    if (get().editor) get().pushPlan({ keepalive: true })   // pushPlan hält die Ein-PUT-Sperre
    else get().pushState()
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush() })
  window.addEventListener('pagehide', flush)   // Safari kills the home-screen app without a visibilitychange at times
  // B&S: Im Plan-Editor schreibt nichts in den localStorage — was beim Verlassen der Seite
  // noch in der Sammlung liegt oder gerade unterwegs ist, ist danach weg. Ein zu großer Plan
  // fährt ohnehin ohne `keepalive` (siehe pushPlan), und ein Abschieds-Push hinter einem
  // laufenden PUT kommt nicht mehr los. Also fragen, statt still zu verlieren.
  window.addEventListener('beforeunload', e => {
    if (!get().editor) return
    if (pushTm === null && planPushing === null) return
    e.preventDefault()
    e.returnValue = ''   // ältere Browser zeigen den Dialog nur mit gesetztem returnValue
  })

  // The owner check in setUser only runs in the tab that signs in. Another tab of the same
  // browser still holding the previous profile would keep writing that profile's data over the
  // shared copy and push it under the new session's cookie — so it drops the profile, and
  // whoever signs in there passes the same check. The owner key is written last on both a
  // sign-in and a sign-out, so on a new owner the copy in storage is already the wiped one; with
  // no owner (a sign-out) this tab falls back to defaults rather than read the key at all — the
  // previous profile's data must not stay here whichever key's event lands first.
  window.addEventListener('storage', e => {
    if (e.key !== 'gym_owner' || inEditor()) return
    const user = get().user
    if (!user || e.newValue === user.id) return
    clearTimeout(pushTm)
    pushTm = null
    set({ user: null, S: e.newValue ? loadState() : clone(DEF) })
  })

  // Everything a sign-out leaves behind on this device, whichever way it was triggered. The owner
  // goes last, after the wiped copy is written — the storage listener above relies on the order.
  const clearLocalSession = () => {
    get().setUser(null)
    localStorage.removeItem('gym_dirty')
    localStorage.removeItem(SYNC_KEY)
    localStorage.removeItem(KEY)
    persist(clone(DEF), false)
    localStorage.removeItem('gym_owner')
  }

  return {
    // B&S: Steht `?kunde=` in der Adresse, gehört dieser Tab dem Plan-Editor. Dann wird das
    // eigene Profil des Coaches gar nicht erst aus dem localStorage geholt — bootEditor() setzt
    // den Stand des Mitglieds, und bis dahin sind die Vorgaben zu sehen, nicht fremde Daten.
    S: (() => { const s = readEditorParam() ? clone(DEF) : loadState(); registerCustom(s.customEx); return s })(),
    user: (() => {
      if (readEditorParam()) return null
      try { return JSON.parse(localStorage.getItem('gym_user')) || null } catch { return null }
    })(),
    ready: false,
    // Server sync as the banner sees it (components/SyncBanner.jsx). Only meaningful signed in.
    sync: { offline: false, pending: !readEditorParam() && localStorage.getItem('gym_dirty') === '1', lastSynced: 0 },
    /* B&S: Plan-Editor (lib/editor-mode.js). `editor` = { userId, name } des Mitglieds, dessen
       Plan der Coach gerade bearbeitet — null im normalen Mitglieder-Betrieb. `editorError`
       ersetzt den ganzen Bildschirm (kein Coach, Mitglied nicht ladbar), `editorSave` ist der
       Speicherstand für das Banner. */
    editor: null,
    editorError: null,
    editorSave: 'idle',   // 'idle' | 'saving' | 'saved' | 'error' | 'conflict' | 'loading' | 'reload-error'
    // B&S: läuft, solange bootEditor auf den Server wartet — siehe inEditor().
    editorBoot: false,
    // B&S: der Plan-Stand, auf dem dieser Editor sitzt (rev aus /api/trainer/stand bzw. aus der
    // letzten Antwort auf einen Push). Geht als `baseRev` mit jedem Push zurück, damit der
    // Server die Änderung des anderen Coaches nicht überschreibt, sondern 409 antwortet.
    editorRev: null,

    // Mutate a draft of S via producer fn, then persist + schedule sync.
    update(mut, push = true) {
      const S = clone(get().S)
      mut(S)
      persist(S, push)
    },
    // A replace that is meant to reach the server (backup import, reset) is a deliberate
    // overwrite, not a change to merge: the push it arms goes without a baseRev.
    replaceState(S, push = false) { if (push) forceNext = true; persist(clone(S), push) },

    // B&S: Auto-Backup schrieb eine Datei im Datenverzeichnis der Handy-App — die gibt es nicht
    // mehr. Die Aufrufstellen (sheets.jsx, views/RoutineEdit.jsx) bleiben, der Aufruf tut nichts.
    autoBackupNow() {},

    // B&S: Gast-Modus gibt es nicht mehr — in die App kommt nur, wer auf der Website angemeldet
    // ist. Bleibt als Stub, solange App.jsx/TabBar.jsx danach fragen.
    isGuest: () => false,

    // Public config from /api/config (invite_only, trainer_disabled). null until the first
    // successful fetch, cached here rather than fetched by each screen that needs it.
    config: null,
    async loadConfig() {
      if (get().config) return get().config
      return get().refreshConfig()
    },
    // Always asks. The cached copy is right for one boot, but an admin can switch the Coach on
    // while a paired phone sits on the setup screen — that screen wants today's answer.
    async refreshConfig() {
      try { const c = await api('/api/config'); set({ config: c }); return c }
      catch { return null }
    },

    setUser(u) {
      // B&S: Eine bestätigte Anmeldung beendet den Schleifen-Schutz (siehe redirectToLogin).
      if (u) clearLoginBounce()
      if (u) {
        // The local copy belongs to whoever last signed in here. When a session expires or is
        // revoked elsewhere, boot() only drops the user and the data stays; a different profile
        // signing in next must not inherit it (pullState would push it into that account, and
        // carry the in-progress workout along). A proper sign-out clears the owner, so data
        // logged after it still moves into the profile that signs in next.
        const owner = localStorage.getItem('gym_owner')
        if (owner && owner !== u.id) {
          localStorage.removeItem('gym_dirty')
          localStorage.removeItem(SYNC_KEY)
          localStorage.removeItem(KEY)
          persist(clone(DEF), false)
        }
        localStorage.setItem('gym_owner', u.id)
        localStorage.setItem('gym_user', JSON.stringify(u))
      } else localStorage.removeItem('gym_user')
      set({ user: u })
    },

    // One PUT at a time: a push asked for while one is in flight runs after it (once, however
    // many asked), and the promise returned covers that follow-up too, so a caller that awaits
    // before signing out knows the last change is on the server.
    async pushState() {
      if (!get().user || inEditor()) return
      clearTimeout(pushTm)
      pushTm = null
      if (pushing) { pushAgain = true; return pushing.then(() => pushing) }
      pushing = doPush().finally(() => {
        pushing = null
        if (pushAgain) { pushAgain = false; get().pushState() }
      })
      return pushing
    },
    // Ask the server for its copy and settle the difference. Coalesced, and a push still waiting
    // in the debounce goes first — the server's answer is then the one that already includes it,
    // and the push itself is what catches a conflict.
    async pullState() {
      if (inEditor()) return   // B&S: im Plan-Editor gibt es keine eigene Kopie abzugleichen
      if (pulling) return pulling
      pulling = (async () => {
        try {
          if (pushTm) { clearTimeout(pushTm); pushTm = null; await get().pushState() }
          else if (pushing) await pushing
          const res = await api('/api/data')
          lastCheck = Date.now()
          setSync({ offline: false })
          const { state, rev } = res
          const S = get().S
          // Owed to the server: a push that failed, or a change made while boot was still pulling.
          const dirty = localStorage.getItem('gym_dirty') === '1' || pushPending
          const sync = readSync()
          // A server from before revisions: the old rule, newer `_ts` wins outright.
          if (rev == null) {
            localStorage.removeItem(SYNC_KEY)
            const restored = restoredStateFor(S, state, dirty)
            if (restored) persist(restored, false, false)
            else if (hasData(S)) await get().pushState()
            return
          }
          // No marker yet — first pull on this device, or a client that just learned about
          // revisions. The newer copy wins as before, except that a copy still owed to the
          // server (dirty) is merged instead of pushed over whatever is there.
          if (!sync) {
            if (dirty && state) { mergeInto(S, state, rev); pushPending = false; await get().pushState(); return }
            const restored = restoredStateFor(S, state, false)
            if (restored) adopt(restored, rev)
            else if (hasData(S)) { writeSync(rev, 0); await get().pushState() }
            else writeSync(rev, state?._ts || 0)
            return
          }
          const serverMoved = rev !== sync.rev
          const localChanged = dirty || (S._ts || 0) > (sync.ts || 0)
          if (!serverMoved) { if (localChanged) await get().pushState(); return }
          if (!state) { writeSync(rev, 0); if (hasData(S)) await get().pushState(); return }
          if (!localChanged) { adopt(Object.assign(clone(DEF), state, { active: S.active || null }), rev); return }
          mergeInto(S, state, rev)
          pushPending = false
          await get().pushState()
        } catch (e) { if (isNetworkError(e)) setSync({ offline: true }) /* keep local; the poll retries */ }
        finally { pulling = null }
      })()
      return pulling
    },

    // Sign-in (and pairing a phone) takes the server's profile as this device's copy — the
    // profile is the truth for a signed-in user, whatever the timestamps say. The only thing
    // the device may add are the entries it logged while signed out: `ask(extras)` (a dialog,
    // supplied by the caller) decides whether those workouts, weigh-ins and custom exercises
    // are added to the profile or dropped. A profile with no state yet simply takes the
    // device's data, as creating a profile always did.
    async adoptProfile(ask) {
      if (pulling) await pulling
      const res = await api('/api/data')   // a failure here is the caller's toast: sign-in needed the server anyway
      const { state, rev } = res
      const S = get().S
      setSync({ offline: false })
      if (!state) {
        localStorage.removeItem('gym_dirty')
        if (hasData(S)) { if (rev != null) writeSync(rev, 0); forceNext = true; await get().pushState() }
        else if (rev != null) writeSync(rev, 0)
        return { adopted: false, added: false }
      }
      const extras = localExtras(S, state)
      const keep = (extras.workouts || extras.bodyweight || extras.customEx) && typeof ask === 'function' ? await ask(extras) : false
      const serverCopy = Object.assign(clone(DEF), state, { active: S.active || null })
      if (keep) {
        // B&S: `server: 'a'` — der Plan des Servers gilt; das Gerät steuert nur seine Einträge bei.
        const merged = Object.assign(clone(DEF), mergeStates(state, S, { prefer: 'a', server: 'a' }))
        merged.active = S.active || null
        persist(merged, false)
        if (rev != null) writeSync(rev, 0)
        else localStorage.removeItem(SYNC_KEY)
        await get().pushState()
        return { adopted: true, added: true }
      }
      localStorage.removeItem('gym_dirty')
      if (rev != null) adopt(serverCopy, rev)
      else { localStorage.removeItem(SYNC_KEY); persist(serverCopy, false, false) }
      setSync({ pending: false })
      return { adopted: true, added: false }
    },

    async signOut() {
      try { await get().pushState(); await api('/api/logout', { method: 'POST', body: '{}' }) } catch (e) { /* */ }
      clearLocalSession()
    },

    // Boot: ask the server who we are, then pull.
    async boot() {
      // B&S: Mit `?kunde=<userId>` will ein Coach den Plan eines Mitglieds bearbeiten. Ein
      // eigener Weg, der das Profil des Coaches im localStorage gar nicht erst anfasst.
      const kunde = readEditorParam()
      if (kunde) return get().bootEditor(kunde)
      try {
        const me = await api('/api/me')
        get().setUser(me.user)
        await get().pullState()
      } catch (e) {
        // B&S: Ohne gültige Session gehört der Besucher auf die Anmeldung der Website — die
        // Trainings-App hat keine eigene. Ein Netzfehler ist etwas anderes: dann geht es mit
        // der zuletzt synchronisierten Kopie offline weiter (siehe unten).
        if (e.status === 401) { get().setUser(null); redirectToLogin() }
        // Started without a network (a home-screen app reopened in the gym's basement): keep the
        // signed-in copy and say so from the first screen, not only after the first failed push.
        else if (isNetworkError(e) && get().user) setSync({ offline: true })
      }
      finishBoot()
    },

    // B&S: Boot im Plan-Editor. Der Stand des Mitglieds kommt von /api/trainer/stand und bleibt
    // im Speicher — weder er noch der Anmeldestand landen im localStorage, dort liegt das eigene
    // Profil des Coaches (siehe inEditor/persist). `ready` wird direkt gesetzt statt über
    // finishBoot(): es gibt hier nichts nachzuschieben, was auf /api/data wartet.
    async bootEditor(userId) {
      // B&S: Ab der ersten Zeile gilt der Editor-Modus, und `user` bleibt leer, bis der Stand
      // da ist — sonst zeigt App.jsx zwischen /api/me und /api/trainer/stand die volle App auf
      // einem leeren Vorgabe-Profil, und ein einziger Tipper darin überschreibt das gespeicherte
      // Profil des Coaches im localStorage (und pusht es später in sein eigenes Konto).
      set({ editorBoot: true })
      // B&S: außerhalb des try, weil auch der Fehlerzweig wissen muss, wer da ist.
      let me = null
      // Raus aus dem Editor, rein in den eigenen Bereich: Parameter aus der Adresse, eigenes
      // Profil aus dem localStorage, dann der normale Weg. Zwei Wege führen hierher — ein
      // Mitglied mit einem Coach-Link, und ein Coach, der ein Coach-Ziel eingesetzt hat.
      const eigenerBereich = async text => {
        dropEditorParam()
        const own = loadState()
        registerCustom(own.customEx)
        set({
          S: own,
          editorBoot: false,
          editorError: null,
          sync: { ...get().sync, pending: localStorage.getItem('gym_dirty') === '1' }
        })
        get().setUser(me.user)
        hinweis(text)
        await get().pullState()
        finishBoot()
      }
      try {
        me = await api('/api/me')
        if (!me.user?.coach) {
          // B&S: Kein Coach — dieser Link gehört ihm nicht. Früher blieb er auf einem
          // Fehlerbildschirm stehen, unter dem die volle App weiterlief: alles bedienbar,
          // nichts gespeichert, das protokollierte Workout beim Neuladen weg. Stattdessen
          // fliegt der Parameter aus der Adresse und er landet in seinem eigenen Bereich.
          return await eigenerBereich('Dieser Link ist für Coaches — du siehst hier deinen eigenen Trainingsbereich.')
        }
        // `user` erst jetzt: bis hierher hält App.jsx den Ladebildschirm.
        const stand = await api('/api/trainer/stand?user=' + encodeURIComponent(userId))
        get().applyStand(stand, userId)
        // B&S: Eine bestätigte Anmeldung beendet den Schleifen-Schutz — dieselbe Zeile wie in
        // setUser(), das hier nicht benutzt werden darf (es schriebe gym_user/gym_owner des
        // Coaches). Ohne sie blieb die Marke für die Lebensdauer des Tabs stehen und die
        // nächste schlicht abgelaufene Sitzung las „Anmeldung konnte nicht übernommen werden“.
        clearLoginBounce()
        set({ user: me.user, editorBoot: false, ready: true })
      } catch (e) {
        // B&S: Beim 401 geht die Seite weg (Login). Nur wenn die Weiterleitung geblockt ist
        // (Schleife, siehe redirectToLogin), bleibt hier etwas stehen: `user` ist leer, App.jsx
        // rendert views/Login.jsx mit dem Fehlertext. `editorBoot` bleibt gesetzt, damit auch
        // dann nichts in den localStorage des Coaches läuft.
        if (e.status === 401) { if (!redirectToLogin()) set({ ready: true }); return }
        // B&S: 409 heißt „das Ziel ist selbst ein Coach“ (api/trainer/stand.js). Fast immer hat
        // sich ein Trainer die eigene Kennung in den Link gesetzt, weil das der einzige Weg ist,
        // den die Doku für Coaches nennt. Das ist kein Fehler, den man ihm vorhalten muss:
        // Coaches schreiben ihren Plan direkt in der App — also dorthin, statt auf einen
        // Fehlerbildschirm, dessen einziger Ausweg zurück auf die Website führt.
        if (e.status === 409 && me?.user) {
          return await eigenerBereich('Coaches haben keinen Plan vom Coach — deinen eigenen legst du hier direkt an.')
        }
        set({ editorBoot: false, editorError: e.status === 404 ? 'Mitglied nicht gefunden.' : 'Der Plan konnte nicht geladen werden.', ready: true })
      }
    },

    // B&S: Antwort von /api/trainer/stand in den Store legen — beim Boot und beim Neuladen
    // nach einem Konflikt. `rev` ist der Stand, gegen den der nächste Push geschrieben wird.
    applyStand(res, fallbackId) {
      const { user, state, rev } = res || {}
      letzteVerwerfung = ''   // frischer Stand → die Hinweise dürfen wieder kommen
      const S = forcePrefs(Object.assign(clone(DEF), state || {}))
      S.active = null   // die laufende Einheit gehört dem Gerät des Mitglieds
      registerCustom(S.customEx)
      set({
        S,
        editor: { userId: user?.id || fallbackId, name: user?.name || '' },
        editorSave: 'idle',
        editorRev: Number.isFinite(rev) ? rev : 0
      })
    },

    // B&S: Nach einem 409 — den Plan des Mitglieds neu holen. Die eigene, noch nicht
    // gespeicherte Änderung geht dabei verloren; genau das sagt das Banner vorher an.
    async reloadPlan() {
      const ed = get().editor
      if (!ed) return
      clearTimeout(pushTm)
      pushTm = null
      // B&S: 'loading'/'reload-error' und nicht 'saving'/'error' — hier wird geladen, nicht
      // gespeichert. Das Banner bot sonst „Fehler beim Speichern — erneut versuchen“ an, und
      // dieser Knopf pushte den bewusst verworfenen Plan mit stale editorRev: garantiert
      // wieder 409, also ein Pendeln zwischen zwei falschen Meldungen ohne Ausweg.
      const vorher = get().S
      set({ editorSave: 'loading' })
      try {
        const stand = await api('/api/trainer/stand?user=' + encodeURIComponent(ed.userId))
        // Während des Ladens ist die Oberfläche bedienbar. Eine Änderung von eben wird jetzt
        // überschrieben — das wird gesagt, und der dafür armierte Push wird geräumt, damit er
        // nicht 1,5 s später den gerade geladenen Stand zurückschickt.
        const dazwischen = get().S !== vorher
        get().applyStand(stand, ed.userId)
        clearTimeout(pushTm)
        pushTm = null
        if (dazwischen) hinweis('Der Plan wurde neu geladen — deine Änderung von eben ist dabei verloren gegangen.')
      } catch (e) {
        set({ editorSave: 'reload-error' })
      }
    },

    // B&S: Was der Coach im Editor ändert, geht gebündelt als Plan an das Mitglied: routines,
    // week, die dort benutzten eigenen Übungen und deren Namen (damit die Admin-Ansicht der
    // Website den Plan lesbar anzeigen kann, ohne den Übungskatalog zu kennen). Nie /api/data —
    // die Log-Daten des Mitglieds fasst der Editor nicht an.
    async pushPlan(opts = {}) {
      const ed = get().editor
      if (!ed) return
      clearTimeout(pushTm)
      pushTm = null
      // B&S: Immer nur ein PUT unterwegs. Zwei gleichzeitige Pushes tragen denselben `baseRev`,
      // der zweite bekäme also 409 — der Coach sähe einen Konflikt mit sich selbst. Wer
      // währenddessen speichern will, wird einmal nachgeholt; das zurückgegebene Versprechen
      // deckt diesen Nachzügler mit ab (siehe pushState), damit das Banner vor dem Verlassen
      // der Seite wirklich den letzten Stand meldet. Beim Entladen (keepalive) wird nicht
      // gewartet — dafür ist keine Zeit mehr.
      // B&S: Die Sperre gilt AUCH für den Abschieds-Push (keepalive). Ohne das ging beim
      // Tab-Wechsel ein zweiter PUT mit demselben baseRev raus, der Verlierer bekam 409 und
      // der Coach las „Ein anderer Coach hat den Plan geändert“ — es gab keinen anderen.
      if (planPushing) { planPushAgain = true; return planPushing.then(() => planPushing) }
      const S = get().S
      const routines = Array.isArray(S.routines) ? S.routines : []
      const used = new Set()
      for (const r of routines) for (const e of (r?.ex || [])) if (e?.id) used.add(e.id)
      // B&S: Eigene Übungen des Mitglieds nur, solange der Plan sie benutzt — sie gehören ihm
      // und stehen ohnehin in seinem Dokument. Was der Coach selbst angelegt hat (`src:'coach'`)
      // fährt dagegen immer mit: sonst wäre eine gerade erst angelegte Übung nach einem Neuladen
      // spurlos weg (der Editor schreibt nichts in den localStorage), und eine kurz aus der
      // Routine genommene ließe sich nicht wieder einsetzen.
      const customEx = (S.customEx || []).filter(e => e && (used.has(e.id) || e.src === 'coach'))
      const namen = {}
      for (const id of used) namen[id] = exerciseNameFor(EXIDX[id]) || id
      set({ editorSave: 'saving' })
      // B&S: `baseRev` ist der Stand, auf dem dieser Editor sitzt (aus /api/trainer/stand bzw.
      // aus der Antwort auf den letzten Push). Hat inzwischen der andere Coach geschrieben,
      // antwortet der Server 409, statt dessen Änderung stillschweigend zu überschreiben.
      const baseRev = get().editorRev
      const body = JSON.stringify({
        routines, week: S.week || {}, customEx, namen,
        ...(Number.isFinite(baseRev) ? { baseRev } : {})
      })
      // keepalive trägt höchstens 64 KB — in BYTES. `body.length` zählt UTF-16-Einheiten, ein
      // Plan voller Umlaute und Gedankenstriche passte damit scheinbar und der Browser wies
      // den Request beim Entladen mit einem TypeError ab. Ein größerer Plan geht als normaler
      // Request raus; dass er dabei abbrechen kann, fängt der beforeunload-Hinweis oben.
      const keepalive = !!opts.keepalive && new TextEncoder().encode(body).byteLength < 60000
      const run = (async () => {
        try {
          const r = await api('/api/trainer/plan?user=' + encodeURIComponent(ed.userId), {
            method: 'PUT',
            body,
            ...(keepalive ? { keepalive: true } : {})
          })
          set({ editorSave: 'saved', ...(Number.isFinite(r?.rev) ? { editorRev: r.rev } : {}) })
          sagWasVerworfenWurde(r)
        } catch (e) {
          // B&S: 409 = der andere Coach war schneller. Kein zweiter Versuch — zwei Pläne lassen
          // sich nicht zusammenführen; das Banner bietet an, den Plan neu zu laden (reloadPlan).
          set({ editorSave: e.status === 409 ? 'conflict' : 'error' })
        }
      })()
      planPushing = run.finally(() => {
        planPushing = null
        if (planPushAgain) { planPushAgain = false; get().pushPlan() }
      })
      // Beim Entladen wartet niemand auf einen Nachzügler — die Sperre selbst gilt trotzdem,
      // sonst rennt der nächste normale Push neben dem keepalive-PUT mit demselben baseRev.
      return keepalive ? run : planPushing
    }
  }
})

export { hasData }