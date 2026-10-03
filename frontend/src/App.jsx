import { useEffect, useLayoutEffect, useRef } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation, useNavigationType } from 'react-router-dom'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { bindUI } from './components/ui.jsx'
import { setLang, useLang } from './lib/i18n.js'
import { setPlayOnSilent } from './lib/sound.js'
import { setNav } from './lib/nav.js'
import { initBackButton } from './lib/back.js'
import { useWakeLock } from './lib/wakelock.js'
import { installViewportGuard } from './lib/viewport-guard.js'
import { installChipDrag } from './lib/hchips.js'
import { startFlow } from './sheets.jsx'
import Icon from './components/Icon.jsx'
import TabBar from './components/TabBar.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import Modals from './components/Modals.jsx'
import Toast from './components/Toast.jsx'
import SyncBanner from './components/SyncBanner.jsx'
import AppInstallieren from './components/AppInstallieren.jsx'
import EditorBanner from './components/EditorBanner.jsx'
import RestTimer from './components/RestTimer.jsx'
import TimerFlash from './components/TimerFlash.jsx'
import Login from './views/Login.jsx'
import Home from './views/Home.jsx'
import Plan from './views/Plan.jsx'
import RoutineEdit from './views/RoutineEdit.jsx'
import Workout from './views/Workout.jsx'
import Stats from './views/Stats.jsx'
import Kalorien from './views/Kalorien.jsx'
import CheckIn from './views/CheckIn.jsx'
import History from './views/History.jsx'
import Library from './views/Library.jsx'
import Muscles from './views/Muscles.jsx'
import Settings from './views/Settings.jsx'

// last known scrollY per route, so back-navigation can put the page where it was
const scrollPositions = new Map()

bindUI(useUI)   // lets the shared controls open sheets without importing the store at module scope

// B&S: die App hat genau ein Erscheinungsbild — dunkel mit Elektro-Blau, wie die Website.
// Kein Theme-/Akzent-Wechsel mehr, also auch kein 'system'-Zweig und kein matchMedia-Listener.
function applyPrefs() {
  const de = document.documentElement
  de.dataset.theme = 'dark'
  de.dataset.accent = 'blau'
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.content = '#0a0a0a'
}

function Shell() {
  const navigate = useNavigate()
  const loc = useLocation()
  const navType = useNavigationType()
  const { S, user, ready } = useStore()
  // B&S: Plan-Editor des Coaches (?kunde=…) — schaltet Mitglieds-eigene Seiten ab.
  const editor = useStore(s => s.editor)
  // B&S: Scheitert der Editor (veralteter Link, gelöschtes Mitglied), bleibt `user` leer —
  // App.jsx hielt den Coach deshalb für abgemeldet und rannte views/Login an. Dessen Effekt
  // läuft auch unter dem fixed-Overlay von EditorBanner: er schickte über /login (wo die
  // Website sofort zurückschickt) und setzte dabei die Login-Schleifen-Marke, sodass der
  // zweite Durchlauf „Anmeldung konnte nicht übernommen werden“ behauptete. Die Routen sind
  // hinter dem Overlay ohnehin unerreichbar.
  const editorError = useStore(s => s.editorError)
  // iOS: whether timer sounds get past the ring/silent switch (Settings → Sounds). Page-level,
  // so it is applied here on load and on change rather than at each beep.
  useEffect(() => { setPlayOnSilent(!!S.soundOnSilent) }, [S.soundOnSilent])
  useLang()   // re-renders the whole shell once the German language pack has loaded
  useEffect(() => { setNav(navigate) }, [navigate])
  useEffect(() => { applyPrefs() }, [])
  // B&S: die App ist deutschsprachig — keine Sprachwahl, kein Fallback auf 'en'.
  useEffect(() => { setLang('de'); document.documentElement.lang = 'de' }, [])
  // Forward navigation starts at the top; going back lands where you left off.
  // The position is recorded from scroll events rather than read at route
  // change, because by then a shorter page may already have clamped it.
  const pathRef = useRef(loc.pathname)
  // iOS leaves the page displaced after the keyboard goes away (see lib/viewport-guard.js).
  useEffect(() => installViewportGuard(), [])
  // Click-drag a horizontal chip strip to scroll it sideways (lib/hchips.js) — on a desktop
  // browser there's otherwise no way to reach the filters past the edge.
  useEffect(() => installChipDrag(), [])
  useEffect(() => {
    const onScroll = () => {
      // Modals pins the body while a sheet is open; scrollY is 0 then, not a position.
      if (document.body.style.position === 'fixed') return
      scrollPositions.set(pathRef.current, window.scrollY)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useLayoutEffect(() => {
    pathRef.current = loc.pathname
    if (navType !== 'POP') { window.scrollTo(0, 0); return }
    const y = scrollPositions.get(loc.pathname) || 0
    // the restored view needs a layout pass before it is tall enough to scroll to y
    const frame = window.requestAnimationFrame(() => window.scrollTo(0, y))
    return () => window.cancelAnimationFrame(frame)
  }, [loc.pathname, navType])
  // bound to the workout, not to the route — checking Stats mid-session keeps the screen on
  useWakeLock(!!S.active && S.keepAwake !== false)

  // B&S: kein Gastmodus mehr — angemeldet ist, wer eine Session der Website hat.
  const authed = !!user
  if (!ready && !authed) return (
    <div id="app">
      <div style={{ paddingTop: '44vh', display: 'flex', justifyContent: 'center', fontSize: 34, color: 'var(--label-3)' }}>
        <Icon name="dumbbell" />
      </div>
    </div>
  )

  return (
    <>
      {/* keyed on the route: a view that throws is contained, and switching tabs
          re-mounts the boundary, so the tab bar is always a way out */}
      <div id="app" className="vfade" key={loc.pathname}>
        <ErrorBoundary>
          {authed && <SyncBanner />}
          {/* B&S: zeigt einmalig, wie die App auf den Home-Bildschirm kommt (rendert nichts) */}
          {authed && <AppInstallieren />}
          {/* B&S: Plan-Editor des Coaches — zeigt sich nur, wenn die App mit ?kunde=… läuft. */}
          <EditorBanner />
          {editorError ? null : !authed ? <Login /> : (
            <Routes>
              <Route path="/home" element={<Home />} />
              <Route path="/plan" element={<Plan />} />
              <Route path="/plan/r/:id" element={<RoutineEdit />} />
              <Route path="/workout" element={<Workout />} />
              <Route path="/stats" element={<Stats />} />
              {/* B&S: Kalorien gehören dem Mitglied, nicht dem Plan. Im Editor sieht ein Coach
                  den Stand eines Mitglieds an und darf dort nichts eintragen — wie bei den
                  Einstellungen führt die Route deshalb zurück auf den Plan. */}
              <Route path="/kalorien" element={editor ? <Navigate to="/plan" replace /> : <Kalorien />} />
              {/* B&S: Der Accountability-Check — ein Foto nach dem Training. Der Bindestrich
                  im Pfad hält ihn von openGyms Studio-Check-in auseinander (Mitgliedskarte,
                  abgeschaltet); App.prune.test.js wacht darüber, dass der draußen bleibt. */}
              <Route path="/check-in" element={editor ? <Navigate to="/plan" replace /> : <CheckIn />} />
              <Route path="/history" element={<History />} />
              <Route path="/library" element={<Library />} />
              <Route path="/muscles" element={<Muscles />} />
              {/* B&S: Im Plan-Editor gehören die Einstellungen dem Mitglied, nicht dem Coach.
                  Sie werden dort nicht gespeichert (nur der Plan geht zurück an den Server) und
                  „Alles zurücksetzen“ würde den Plan des Mitglieds löschen. Darum gibt es die
                  Seite im Editor gar nicht. */}
              <Route path="/settings" element={editor ? <Navigate to="/plan" replace /> : <Settings />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
          )}
        </ErrorBoundary>
      </div>
      <TabBar onStart={startFlow} />
      <RestTimer />
      <Modals />
      <Toast />
      <TimerFlash />
    </>
  )
}

export default function App() {
  const boot = useStore(s => s.boot)
  useEffect(() => { boot() }, [boot])
  // Android system back — sheet, then page, then press-again-to-exit (see lib/back.js)
  useEffect(() => {
    let stop = null, gone = false
    initBackButton().then(fn => { if (gone) fn(); else stop = fn })
    return () => { gone = true; stop?.() }
  }, [])
  return <HashRouter><Shell /></HashRouter>
}
