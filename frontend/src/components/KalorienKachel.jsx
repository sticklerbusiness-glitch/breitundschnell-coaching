import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icon.jsx'
import { kalorienLaden } from '../lib/website-api.js'

/* B&S: Die Kalorien auf dem Startschirm — eine Zeile, ein Tipp.
 *
 * Der Weg zur vollen Ansicht, und gleichzeitig die Antwort auf die einzige Frage, die man
 * morgens hat: Habe ich heute schon eingetragen? Deshalb holt die Kachel den Stand selbst,
 * statt nur zu verlinken; ein Knopf ohne Zahl hätte denselben Platz gekostet und nichts gesagt.
 *
 * Geht die Anfrage schief (kein Netz, abgelaufene Sitzung), bleibt die Kachel stumm statt
 * einen Fehler auf den Startschirm zu setzen: Dafür ist die Ansicht dahinter da, und das
 * Training soll ohne Netz weiterlaufen, als wäre nichts.
 */
export default function KalorienKachel() {
  const nav = useNavigate()
  const [stand, setStand] = useState(null)

  useEffect(() => {
    let abgemeldet = false
    kalorienLaden(1)
      .then(d => { if (!abgemeldet) setStand(d) })
      .catch(() => { /* stumm — siehe oben */ })
    return () => { abgemeldet = true }
  }, [])

  const heute = stand?.eintraege?.find(e => e.datum === stand.heute) || null
  const ziel = stand?.ziel ?? null

  return (
    <div className="card tappable" style={{ cursor: 'pointer' }} onClick={() => nav('/kalorien')}>
      <div className="row between">
        <div>
          <div className="row" style={{ gap: 7, fontSize: 22, fontWeight: 600, letterSpacing: '-.021em' }}>
            <Icon name="flame" style={{ color: 'var(--green)' }} />
            {heute ? `${heute.kcal} kcal` : 'Kalorien'}
          </div>
          <div className="muted small" style={{ marginTop: 2 }}>
            {heute
              ? (ziel ? `von ${ziel} kcal · heute eingetragen` : 'heute eingetragen')
              : (stand ? 'Heute noch nichts eingetragen' : 'Tippen zum Eintragen')}
          </div>
        </div>
        <Icon name="chevronRight" className="chev" style={{ fontSize: 20 }} />
      </div>
    </div>
  )
}
