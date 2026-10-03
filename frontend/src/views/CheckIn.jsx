import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import { Button, TextField } from '../components/ui.jsx'
import { useUI } from '../store/useUI.js'
import { confirmSheet } from '../sheets.jsx'
import { checkinHochladen, checkinLoeschen, checkinsLaden } from '../lib/website-api.js'

/* B&S: Der Accountability-Check — ein Foto nach dem Training.
 *
 * Nicht zu verwechseln mit dem Check-in, das openGym mitbrachte: Dort ging es um
 * Mitgliedskarten fürs Studio (abgeschaltet, siehe App.prune.test.js). Hier geht es um den
 * Beweis an sich selbst und um den Blick der Coaches darauf.
 *
 * Das Foto geht an die Website und von dort in einen PRIVATEN Speicher. Es gibt keine
 * Adresse, die man weitergeben kann: Jedes Bild wird einzeln über /api/uploads/<name>
 * ausgeliefert, und dort wird jedes Mal geprüft, ob der Abrufende der Besitzer oder ein
 * Coach ist. Ein Körperfoto ist ein Gesundheitsdatum.
 */

const MAX_KANTE = 1600            // Pixel — reicht fürs Raster locker
const MAX_BYTES = 4 * 1024 * 1024 // muss zu MAX_BYTES in website/src/lib/uploads.ts passen

/**
 * Rechnet das Foto im Browser herunter und schickt es als WebP.
 *
 * Aus 4 MB Handyfoto werden 200–400 KB. Das muss sein: Der Server nimmt keinen größeren
 * Körper an (Vercel deckelt bei 4,5 MB). Nebenbei wird aus HEIC etwas, das auch Chrome und
 * Firefox anzeigen können. Scheitert die Umwandlung, geht das Original raus — dann entscheidet
 * der Server, und der sagt verständlich, was los ist.
 */
async function verkleinern(datei) {
  try {
    const bild = await createImageBitmap(datei)
    const faktor = Math.min(1, MAX_KANTE / Math.max(bild.width, bild.height))
    const leinwand = document.createElement('canvas')
    leinwand.width = Math.round(bild.width * faktor)
    leinwand.height = Math.round(bild.height * faktor)
    const ctx = leinwand.getContext('2d')
    if (!ctx) return datei
    ctx.drawImage(bild, 0, 0, leinwand.width, leinwand.height)
    bild.close()
    const blob = await new Promise(r => leinwand.toBlob(r, 'image/webp', 0.85))
    if (!blob || blob.size === 0 || blob.size >= datei.size) return datei
    return new File([blob], 'checkin.webp', { type: 'image/webp' })
  } catch (e) {
    return datei
  }
}

const zeitpunkt = iso => new Date(iso).toLocaleString('de-DE', {
  timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
})

export default function CheckIn() {
  const nav = useNavigate()
  const toast = useUI(s => s.toast)
  const dateiRef = useRef(null)
  const [zustand, setZustand] = useState('laden')
  const [checkins, setCheckins] = useState([])
  const [kommentar, setKommentar] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState(null)

  const laden = useCallback(async () => {
    try {
      const d = await checkinsLaden(30)
      setCheckins(d.checkins || [])
      setZustand('da')
    } catch (e) {
      setZustand(e.status === 401 ? 'abgemeldet' : 'fehler')
    }
  }, [])

  useEffect(() => { laden() }, [laden])

  const hochladen = async ereignis => {
    const datei = ereignis.target.files?.[0]
    // Das Feld wird sofort geleert: Sonst löst dieselbe Datei beim zweiten Mal kein
    // change-Ereignis aus, und ein zweiter Versuch sähe aus, als täte der Knopf nichts.
    ereignis.target.value = ''
    if (!datei) return
    setFehler(null)
    setLaeuft(true)
    try {
      const klein = await verkleinern(datei)
      if (klein.size > MAX_BYTES) {
        setFehler('Das Foto ist zu groß und ließ sich hier nicht verkleinern. Probier es als JPG.')
        return
      }
      await checkinHochladen(klein, kommentar.trim())
      setKommentar('')
      await laden()
      toast('Check-in gespeichert.')
    } catch (e) {
      setFehler(e.status ? e.message : 'Keine Verbindung — das Foto wurde nicht hochgeladen.')
    } finally {
      setLaeuft(false)
    }
  }

  const loeschen = c => confirmSheet({
    title: 'Check-in löschen?',
    message: 'Das Foto wird mitgelöscht und ist danach auch für deinen Coach weg.',
    confirmText: 'Löschen',
    danger: true,
    onConfirm: async () => {
      try {
        await checkinLoeschen(c.id)
        await laden()
      } catch (e) {
        toast(e.status ? e.message : 'Keine Verbindung.')
      }
    }
  })

  return <>
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav('/home')} aria-label="Zurück"><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 12 }}>
        <h1>Check-in</h1>
        <div className="sub">Ein Foto nach dem Training.</div>
      </div>
    </div>

    {zustand === 'fehler' && (
      <div className="empty">
        <div className="ico"><Icon name="warning" /></div>
        Die Check-ins konnten nicht geladen werden.
        <div style={{ marginTop: 10 }}><Button onClick={laden}>Erneut versuchen</Button></div>
      </div>
    )}
    {zustand === 'abgemeldet' && (
      <div className="empty"><div className="ico"><Icon name="lock" /></div>Deine Anmeldung ist abgelaufen. Lade die App neu.</div>
    )}

    {(zustand === 'da' || zustand === 'laden') && <>
      <div className="list" style={{ marginBottom: 10 }}>
        <label className="item" style={{ justifyContent: 'space-between', gap: 12 }}>
          <span style={{ flex: 'none' }}>Notiz</span>
          <TextField value={kommentar} maxLength={200} placeholder="Beine, schwer — und trotzdem da"
            onChange={e => setKommentar(e.target.value)} />
        </label>
      </div>
      {fehler && <div className="small" style={{ color: 'var(--red)', marginBottom: 8 }}>{fehler}</div>}
      {/* capture="environment" schlägt auf dem Handy die Kamera vor, lässt aber die
          Fotomediathek offen — wer nach dem Duschen eincheckt, hat das Bild schon. */}
      <input ref={dateiRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic"
        capture="environment" onChange={hochladen} style={{ display: 'none' }} />
      <Button variant="primary" icon="camera" disabled={laeuft} onClick={() => dateiRef.current?.click()}>
        {laeuft ? 'Wird hochgeladen …' : 'Foto aufnehmen oder wählen'}
      </Button>

      {zustand === 'laden' && <div className="muted small" style={{ marginTop: 12 }}>Wird geladen …</div>}

      {zustand === 'da' && (checkins.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 18 }}>
          {checkins.map(c => (
            <div key={c.id} style={{ position: 'relative' }}>
              <img src={c.bildPfad} alt={`Check-in vom ${zeitpunkt(c.createdAt)}`} loading="lazy"
                style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 12, background: 'var(--surface-2)' }} />
              <button className="iconbtn" aria-label="Check-in löschen" onClick={() => loeschen(c)}
                style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,.55)' }}>
                <Icon name="xmark" />
              </button>
              <div className="muted small" style={{ marginTop: 4 }}>{zeitpunkt(c.createdAt)}</div>
              {c.kommentar && <div className="small" style={{ lineHeight: 1.35 }}>{c.kommentar}</div>}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty" style={{ marginTop: 18 }}>
          <div className="ico"><Icon name="camera" /></div>
          Noch keine — nach dem nächsten Training geht&apos;s los.
        </div>
      ))}

      <div className="dim small" style={{ textAlign: 'center', marginTop: 16 }}>
        Deine Fotos sehen nur du und deine Coaches.
      </div>
    </>}
  </>
}
