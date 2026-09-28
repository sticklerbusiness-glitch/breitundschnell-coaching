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

// Außerhalb von React (Handler, Sheets).
export const planEditable = () => !!useStore.getState().editor
// In React — rendert mit, wenn der Editor-Modus steht.
export const usePlanEditable = () => useStore(s => !!s.editor)
