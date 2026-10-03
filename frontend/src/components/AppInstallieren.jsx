import { useEffect } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import Icon from './Icon.jsx'
import { geraet, merkzettelLesen, schonInstalliert, schritte, sollZeigen } from '../lib/installation.js'

/* B&S: „Leg dir die App auf den Home-Bildschirm."
 *
 * Für ein Mitglied IST diese App das Produkt — die Website ist die Einladung. Ein Symbol auf dem
 * Home-Bildschirm ist der Unterschied zwischen „ich öffne Safari, tippe die Adresse, melde mich an"
 * und „ich tippe einmal". Deshalb erklärt das hier nicht, DASS man es tun kann, sondern zeigt
 * Schritt für Schritt, auf welches Symbol zu drücken ist — die Entscheidungsarbeit liegt bei uns,
 * nicht beim Mitglied.
 *
 * Die Regeln, wann es erscheint, stehen in lib/installation.js und sind dort geprüft.
 */

const MERKZETTEL = 'gym_install_hinweis'

// B&S: Android kündigt die Installation an, bevor sie möglich ist — das Ereignis kommt einmal und
// nur dann, wenn der Browser die App für installierbar hält. Wer es nicht aufhebt, hat später
// keinen Knopf mehr: ein zweites Mal kommt es nicht. Deshalb hier auf Modulebene, beim ersten
// Import, lange vor dem ersten Rendern.
let angebot = null
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()   // sonst zeigt Chrome seine eigene Leiste zusätzlich zu unserer
    angebot = e
  })
  window.addEventListener('appinstalled', () => { angebot = null; merken('nie') })
}

function merken(status) {
  try {
    localStorage.setItem(MERKZETTEL, JSON.stringify({ status, ts: Date.now() }))
  } catch (e) { /* privater Modus: dann fragt es beim nächsten Mal eben noch einmal */ }
}

function lage() {
  const nav = typeof navigator === 'undefined' ? {} : navigator
  const win = typeof window === 'undefined' ? {} : window
  return {
    angemeldet: !!useStore.getState().user,
    installiert: schonInstalliert({
      matchMedia: win.matchMedia && win.matchMedia.bind(win),
      standalone: nav.standalone
    }),
    geraet: geraet({ ua: nav.userAgent || '', maxTouchPoints: nav.maxTouchPoints || 0, platform: nav.platform || '' }),
    merkzettel: merkzettelLesen(safeGet()),
    jetzt: Date.now()
  }
}

function safeGet() {
  try { return localStorage.getItem(MERKZETTEL) } catch (e) { return null }
}

function Anleitung({ art, close }) {
  const liste = schritte(art)
  const direkt = art === 'android' && angebot
  return (
    <>
      <h3 style={{ marginBottom: 4 }}>Leg dir die App auf den Home-Bildschirm</h3>
      <div className="muted small" style={{ marginBottom: 16, lineHeight: 1.5 }}>
        Dann startest du dein Training mit einem Tipp — ohne Browser, ohne Adresse, und du bleibst
        angemeldet.
      </div>

      <div className="list" style={{ marginBottom: 16 }}>
        {liste.map((s, i) => (
          <div key={i} className="item" style={{ alignItems: 'center', gap: 12 }}>
            <div aria-hidden="true" style={{
              flex: 'none', width: 34, height: 34, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--surface-3)', color: 'var(--acc)'
            }}>
              <Icon name={s.symbol} size={20} />
            </div>
            <div style={{ lineHeight: 1.45 }}>
              <b style={{ color: 'var(--label-3)', marginRight: 6 }}>{i + 1}.</b>{s.text}
            </div>
          </div>
        ))}
      </div>

      {direkt ? (
        <button className="btn primary" onClick={async () => {
          close()
          try {
            angebot.prompt()
            const { outcome } = await angebot.userChoice
            angebot = null
            merken(outcome === 'accepted' ? 'nie' : 'spaeter')
          } catch (e) { merken('spaeter') }
        }}>Jetzt installieren</button>
      ) : (
        <button className="btn primary" onClick={() => { close(); merken('nie') }}>Hab ich gemacht</button>
      )}
      <div style={{ height: 8 }} />
      <button className="btn ghost dim" onClick={() => { close(); merken('spaeter') }}>Später</button>
      <div className="muted small" style={{ marginTop: 12, textAlign: 'center' }}>
        Du findest die Anleitung jederzeit wieder unter Einstellungen.
      </div>
    </>
  )
}

/** Die Anleitung von Hand öffnen (Einstellungen) — auch auf dem Computer, wer fragt, bekommt sie. */
export function installationZeigen() {
  const art = lage().geraet
  useUI.getState().openSheet(close => (
    <Anleitung art={art === 'computer' ? 'ios-safari' : art} close={close} />
  ))
}

/**
 * Zeigt die Anleitung von selbst — einmal, nach dem Anmelden, auf einem Handy ohne App.
 *
 * Rendert nichts. Der Umweg über eine Komponente statt eines Aufrufs in boot() ist Absicht: So
 * hängt das Fenster am Lebenszyklus der Oberfläche und kann nicht erscheinen, während noch der
 * Ladebildschirm steht.
 */
export default function AppInstallieren() {
  const user = useStore(s => s.user)
  const ready = useStore(s => s.ready)
  const editor = useStore(s => s.editor)
  useEffect(() => {
    // Im Plan-Editor nicht: dort schaut ein Coach auf den Stand eines Mitglieds und hat gerade
    // etwas anderes vor. Er bekommt die Anleitung in seinem eigenen Bereich.
    if (!ready || !user || editor) return
    const l = lage()
    if (!sollZeigen(l)) return
    // Eine knappe Sekunde: Das Fenster soll nach dem Bild der App kommen, nicht davor — sonst
    // bittet uns eine Seite um etwas, bevor sie gezeigt hat, worum es überhaupt geht.
    const t = setTimeout(() => {
      // Nichts dazwischenfunken, wenn inzwischen etwas anderes offen ist.
      if (useUI.getState().sheets.length) return
      useUI.getState().openSheet(close => <Anleitung art={l.geraet} close={close} />)
    }, 1200)
    return () => clearTimeout(t)
  }, [ready, user, editor])
  return null
}
