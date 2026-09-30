/* B&S: Plan-Editor der Coaches.
 *
 * Die Trainingspläne gehören den Coaches, geloggt wird vom Mitglied. Ein Coach öffnet den Plan
 * eines Mitglieds mit `/training/?kunde=<userId>#/plan` — dieselbe App, aber auf dessen Stand
 * und mit den Plan-Bedienelementen, die einem Mitglied verborgen bleiben.
 *
 * Der Modus hängt allein am Store-Feld `editor`: dort liegt er einmal, statt den Query-Parameter
 * überall neu zu lesen (der Hash-Router ändert die Adresse laufend). Solange er gesetzt ist,
 * fasst der Store den localStorage nicht an — dort liegt das eigene Profil des Coaches.
 */
import { useStore } from '../store/useStore.js'

// Die userId aus der Adresse — cuid/uuid-artig, sonst null. Bewusst aus `location.search`:
// der Rest der Route steht im Hash und wechselt beim Navigieren.
export function readEditorParam() {
  try {
    const v = new URLSearchParams(location.search).get('kunde')
    return v && /^[a-z0-9]{10,40}$/i.test(v) ? v : null
  } catch (e) { return null }
}

/* B&S: Zwei Fragen, nicht eine.
 *
 * `editorMode` — sehe ich gerade den Stand eines MITGLIEDS an? Dann gehört mir davon nur der
 * Plan: Training starten, Favoriten, Wiegungen, Einstellungen, Hantelstangen-Gewicht und die
 * Notiz einer Einheit gehören ihm und werden hier nur gelesen.
 *
 * `planEditable` — darf ich den Plan schreiben, der hier auf dem Schirm steht? Das gilt im
 * Editor UND im eigenen Bereich eines Coaches: Coaches trainieren selbst, und ihnen schreibt
 * niemand einen Plan, also gehört ihr Plan ihrem eigenen Dokument (api/data.js: selfOwnedPlan,
 * lib/state.js: strip/compose mit `selfOwned`). Solange beide Fragen dieselbe Antwort hatten,
 * sah ein Coach in seiner eigenen App die Lese-Ansicht eines Mitglieds und kam nie an eine
 * eigene Routine — die Server-Hälfte war gebaut, die Oberfläche fehlte.
 */

// Außerhalb von React (Handler, Sheets).
export const editorMode = () => !!useStore.getState().editor
export const planEditable = () => {
  const s = useStore.getState()
  return !!s.editor || !!s.user?.coach
}
// In React — rendert mit, wenn sich der Modus ändert.
export const useEditorMode = () => useStore(s => !!s.editor)
export const usePlanEditable = () => useStore(s => !!s.editor || !!s.user?.coach)
