import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icon.jsx'
import { checkinsLaden } from '../lib/website-api.js'

/* B&S: Der Check-in auf dem Startschirm.
 *
 * Zeigt, wann zuletzt ein Foto da war — das ist die ganze Idee des Accountability-Checks:
 * nicht die Zahl, sondern der Abstand. „Vor 6 Tagen" sagt mehr als jede Statistik.
 *
 * Wie die Kalorien-Kachel: Geht die Anfrage schief, bleibt sie stumm. Der Startschirm ist
 * nicht der Ort für Fehlermeldungen über Dinge, die man gerade nicht tun wollte.
 */

const TAG = 24 * 60 * 60 * 1000

function abstand(iso) {
  const tage = Math.floor((Date.now() - new Date(iso).getTime()) / TAG)
  if (tage <= 0) return 'heute'
  if (tage === 1) return 'gestern'
  return `vor ${tage} Tagen`
}

export default function CheckInKachel() {
  const nav = useNavigate()
  const [letzter, setLetzter] = useState(undefined)   // undefined = noch unbekannt, null = keiner

  useEffect(() => {
    let weg = false
    checkinsLaden(1)
      .then(d => { if (!weg) setLetzter(d.checkins?.[0] || null) })
      .catch(() => { /* stumm — siehe oben */ })
    return () => { weg = true }
  }, [])

  return (
    <div className="card tappable" style={{ cursor: 'pointer' }} onClick={() => nav('/check-in')}>
      <div className="row between">
        <div>
          <div className="row" style={{ gap: 7, fontSize: 22, fontWeight: 600, letterSpacing: '-.021em' }}>
            <Icon name="camera" style={{ color: 'var(--purple)' }} />
            Check-in
          </div>
          <div className="muted small" style={{ marginTop: 2 }}>
            {letzter === undefined ? 'Foto nach dem Training'
              : letzter === null ? 'Noch keins — nach dem nächsten Training geht’s los'
              : `Zuletzt ${abstand(letzter.createdAt)}`}
          </div>
        </div>
        <Icon name="chevronRight" className="chev" style={{ fontSize: 20 }} />
      </div>
    </div>
  )
}
