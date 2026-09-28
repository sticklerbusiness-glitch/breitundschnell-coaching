import { useEffect, useState } from 'react'
import { clearLoginBounce, redirectToLogin } from '../store/useStore.js'

/* B&S: Die Trainings-App hat keine eigene Anmeldung — die Website besitzt die Session
   (Cookie bs_session). boot() leitet bei 401 selbst weiter; App.jsx rendert diese Ansicht,
   solange niemand angemeldet ist, und stößt die Weiterleitung noch einmal an (z. B. wenn die
   App aus dem Cache startet, bevor boot() durch ist).

   Hält die Website die Session für gültig, während /api/me hier 401 antwortet — abweichendes
   AUTH_SECRET im Gym-Projekt, falsche DATABASE_URL —, schickt sie uns sofort zurück und die
   Weiterleitung liefe endlos: kein Buchstabe auf dem Bildschirm, und wegen location.replace
   auch kein Zurück. redirectToLogin() merkt den zweiten Anlauf (Marke in der sessionStorage)
   und leitet dann nicht mehr weiter, sondern gibt false zurück — ab hier steht hier ein Text,
   der sagt, was los ist, statt eines sich drehenden Tabs. */
export default function Login() {
  const [schleife, setSchleife] = useState(false)
  useEffect(() => { if (!redirectToLogin()) setSchleife(true) }, [])

  if (schleife) return (
    <div className="narrow" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '78vh', textAlign: 'center', gap: 14 }}>
      <h1 style={{ fontSize: 24, margin: 0 }}>Anmeldung konnte nicht übernommen werden</h1>
      <div className="muted">
        Die Website hält dich für angemeldet, die Trainings-App erkennt die Anmeldung aber nicht.
        Das liegt an der Einrichtung der App, nicht an dir — bitte sag einem der Coaches Bescheid.
      </div>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
        <a href="/app" style={{ color: 'var(--acc)' }}>Zu deinem Bereich</a>
        <button
          type="button"
          onClick={() => { clearLoginBounce(); location.reload() }}
          style={{ font: 'inherit', color: 'var(--acc)', background: 'none', border: 0, padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
        >Erneut versuchen</button>
      </div>
    </div>
  )

  return (
    <div className="narrow" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '78vh', textAlign: 'center' }}>
      <div className="muted">Weiterleitung zum Login …</div>
    </div>
  )
}
