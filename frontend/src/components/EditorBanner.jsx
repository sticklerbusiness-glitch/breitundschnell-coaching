import { useStore } from '../store/useStore.js'

/* B&S: Kopfzeile des Plan-Editors (lib/editor-mode.js). Sie muss auf jedem Bildschirm sofort
   sagen, dass hier der Plan eines Mitglieds bearbeitet wird und nicht das eigene Profil —
   und ob die letzte Änderung beim Server angekommen ist. Wenn der Editor gar nicht erst
   aufgehen kann (kein Coach, Mitglied nicht ladbar), ersetzt sie den ganzen Bildschirm:
   dahinter läge sonst das eigene Profil des Coaches, das hier niemand sehen will. */

const bar = {
  display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
  padding: '8px 16px', background: 'var(--acc)', color: 'var(--on-acc, #fff)',
  fontSize: 13, fontWeight: 600, lineHeight: 1.3
}
const link = { color: 'inherit', textDecoration: 'underline', opacity: .9 }
const retryBtn = {
  font: 'inherit', color: 'inherit', background: 'rgba(0,0,0,.25)',
  border: 0, borderRadius: 8, padding: '3px 9px', cursor: 'pointer'
}

const STATUS = { saving: 'Speichert …', saved: 'Gespeichert' }

// B&S: Der Fehlerfall legt sich über ALLES — die Routen, die Tab-Leiste, die Sheets. Als
// bloßes Geschwister der Routen (so war es) schob der Fehlerblock die volle App nur unter den
// Bildschirmrand: darunter stand ein leeres Vorgabe-Profil samt Start-Knopf, das aussah wie
// „meine Daten sind weg“, und ein dort geloggtes Training wäre beim Neuladen verschwunden
// gewesen. `position:fixed` mit eigenem Hintergrund macht das unerreichbar, ohne dass diese
// Komponente etwas über App.jsx wissen muss.
const overlay = {
  position: 'fixed', inset: 0, zIndex: 300, overflow: 'auto',
  background: 'var(--bg)', color: 'var(--label)',
  // Außerhalb von #app gibt es dessen Innenabstand nicht — auf dem Handy klebte der Text sonst
  // am Rand (`.narrow` bekommt seine Breite erst ab 1000 px).
  padding: '24px 16px',
  display: 'flex', flexDirection: 'column', justifyContent: 'center'
}

export default function EditorBanner() {
  const editor = useStore(s => s.editor)
  const editorError = useStore(s => s.editorError)
  const editorSave = useStore(s => s.editorSave)
  const pushPlan = useStore(s => s.pushPlan)
  const reloadPlan = useStore(s => s.reloadPlan)

  if (editorError) return (
    <div style={overlay} data-testid="editor-error">
      <div className="narrow" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center', gap: 14 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Plan-Editor</h1>
        <div className="muted">{editorError}</div>
        <div><a href="/admin/mitglieder" style={{ color: 'var(--acc)' }}>Zurück zum Admin</a></div>
      </div>
    </div>
  )
  if (!editor) return null

  return (
    <div style={bar}>
      <span>Plan-Editor · {editor.name || editor.userId}</span>
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* B&S: 409 — der andere Coach hat denselben Plan geändert. Zwei Pläne lassen sich
            nicht zusammenführen, also die Wahl: hier stehen bleiben oder den Plan des Servers
            holen und die eigene, noch nicht gespeicherte Änderung dafür aufgeben. */}
        {editorSave === 'conflict'
          ? <>
              <span>Ein anderer Coach hat den Plan geändert</span>
              <button type="button" style={retryBtn} onClick={() => reloadPlan()}>Plan neu laden (eigene Änderung verwerfen)</button>
            </>
          : editorSave === 'error'
            ? <button type="button" style={retryBtn} onClick={() => pushPlan()}>Fehler beim Speichern — erneut versuchen</button>
            : <span style={{ opacity: .85, fontWeight: 500 }}>{STATUS[editorSave] || ''}</span>}
        {/* B&S: Erst speichern, dann weg. Ein einfacher Link würde die Seite verlassen, während
            die letzte Änderung noch in der 1,5-Sekunden-Sammlung liegt. */}
        <a
          href={'/admin/mitglieder/' + editor.userId}
          style={link}
          onClick={async e => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
            e.preventDefault()
            try { await pushPlan() } catch { /* pushPlan setzt selbst editorSave:'error' */ }
            const stand = useStore.getState().editorSave
            if (stand === 'error' || stand === 'conflict') {
              const frage = stand === 'conflict'
                ? 'Ein anderer Coach hat den Plan geändert — deine letzte Änderung wurde nicht gespeichert. Trotzdem zurück zum Admin?'
                : 'Die letzte Änderung konnte nicht gespeichert werden. Trotzdem zurück zum Admin?'
              if (!window.confirm(frage)) return
            }
            window.location.assign('/admin/mitglieder/' + editor.userId)
          }}
        >Zurück zum Admin</a>
      </span>
    </div>
  )
}
