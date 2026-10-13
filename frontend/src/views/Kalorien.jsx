import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import { Button, NumberField, TextField } from '../components/ui.jsx'
import { useUI } from '../store/useUI.js'
import { kalorienLaden, kalorienLoeschen, kalorienSpeichern, kalorienZielSpeichern } from '../lib/website-api.js'

/* B&S: Kalorien — bis zum 03.10.2026 eine Seite im Mitgliederbereich der Website.
 *
 * Für ein Mitglied ist diese App das Produkt; dass das Tracking woanders lag, war der
 * Grund, zwei Adressen im Kopf zu behalten. Die Daten bleiben, wo sie waren (eigene
 * Tabelle, der Admin rechnet darauf) — nur die Oberfläche steht jetzt hier.
 *
 * Bewusst online: Der Eintrag geht direkt zur Website und nicht in das Dokument, das
 * diese App offline mitführt. Zwei Synchronisierungswege mit zwei Konfliktregeln wären
 * mehr Gelegenheit zum Datenverlust, als ein Keller ohne Empfang wert ist — der Plan
 * und das laufende Training funktionieren offline weiter, das Eintragen wartet.
 *
 * Das Tagesziel setzt das Mitglied hier SELBST (Coaches für ihr eigenes Konto genauso).
 * Bis Oktober 2026 stand an seiner Stelle „kommt vom Coach" — das darf es nicht mehr:
 * Kalorien oder Makros für eine einzelne Person festzulegen ist in Österreich
 * Ernährungsberatung, ein reglementiertes Gewerbe (§ 119 GewO), und die Coaches sind
 * Fitnesstrainer. Erlaubt ist, dass das Mitglied trackt und sich sein Ziel selbst gibt; die
 * Coaches sehen beides und halten es dran. Deshalb schlägt diese Ansicht auch keine Zahl
 * vor — kein Platzhalterwert, keine Empfehlung —, sondern verweist auf einen Rechner.
 */

/* B&S: Was im Ziel-Feld steht, so weit aufbereitet, wie es ohne Raten geht. Die eine Regel
 * (500–10.000 kcal, Komma erlaubt) steht auf der Website (pruefeKalorienZiel) und antwortet
 * mit eigenem Fehlertext. Hier nur, was sie nicht wissen kann: „2.800" ist auf einem
 * deutschen Handy zweitausendachthundert und nicht 2,8 — ein Punkt vor genau drei Ziffern
 * ist ein Tausenderpunkt. Was keine saubere Zahl ist, geht roh hinüber, damit der Server
 * es mit seinem Text ablehnt, statt dass hier eine zweite Fassung der Regel entsteht.
 */
function zielAusEingabe(text) {
  const s = String(text ?? '').replace(/\s+/g, '')
  if (s === '') return null
  const ohneTausender = /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : s
  return /^\d+([.,]\d+)?$/.test(ohneTausender) ? Number(ohneTausender.replace(',', '.')) : ohneTausender
}

const heuteText = tag => {
  const [j, m, d] = tag.split('-')
  return `${d}.${m}.`
}

const wochentag = tag => ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(`${tag}T12:00:00Z`).getUTCDay()]

export default function Kalorien() {
  const nav = useNavigate()
  const toast = useUI(s => s.toast)
  const [lage, setLage] = useState({ zustand: 'laden', heute: null, ziel: null, eintraege: [] })
  const [eingabe, setEingabe] = useState({ kcal: null, protein: null, carbs: null, fett: null, notiz: '' })
  const [speichert, setSpeichert] = useState(false)
  const [fehler, setFehler] = useState(null)
  // Das Ziel-Feld: zu, bis jemand auf die Ziel-Kachel tippt — das Ziel ändert man selten,
  // ein dauernd offenes Feld stünde dem täglichen Eintragen nur im Weg.
  const [zielOffen, setZielOffen] = useState(false)
  const [zielText, setZielText] = useState('')
  const [zielSpeichert, setZielSpeichert] = useState(false)
  const [zielFehler, setZielFehler] = useState(null)

  const laden = useCallback(async () => {
    try {
      const d = await kalorienLaden(14)
      setLage({ zustand: 'da', ...d })
    } catch (e) {
      // 401 heißt: die Sitzung ist weg. Darum kümmert sich der Rest der App (boot/pullState),
      // hier bleibt nur der ehrliche Hinweis statt einer leeren Liste, die nach „nichts
      // eingetragen" aussieht.
      setLage(l => ({ ...l, zustand: e.status === 401 ? 'abgemeldet' : 'fehler' }))
    }
  }, [])

  useEffect(() => { laden() }, [laden])

  const heutigerEintrag = lage.eintraege.find(e => e.datum === lage.heute) || null

  // Beim ersten Laden das Formular mit dem füllen, was für heute schon dasteht — sonst
  // sieht „Aktualisieren" aus wie „überschreibt alles mit leer".
  useEffect(() => {
    if (lage.zustand !== 'da') return
    setEingabe({
      kcal: heutigerEintrag?.kcal ?? null,
      protein: heutigerEintrag?.protein ?? null,
      carbs: heutigerEintrag?.carbs ?? null,
      fett: heutigerEintrag?.fett ?? null,
      notiz: heutigerEintrag?.notiz ?? ''
    })
  }, [lage.zustand, lage.heute, heutigerEintrag?.kcal, heutigerEintrag?.protein, heutigerEintrag?.carbs, heutigerEintrag?.fett, heutigerEintrag?.notiz])

  const speichern = async () => {
    if (!eingabe.kcal) { setFehler('Trag zuerst die Kalorien ein.'); return }
    setSpeichert(true)
    setFehler(null)
    try {
      await kalorienSpeichern({
        kcal: eingabe.kcal,
        protein: eingabe.protein,
        carbs: eingabe.carbs,
        fett: eingabe.fett,
        notiz: eingabe.notiz
      })
      await laden()
      toast('Eingetragen.')
    } catch (e) {
      setFehler(e.status ? e.message : 'Keine Verbindung — der Eintrag ist nicht gespeichert.')
    } finally {
      setSpeichert(false)
    }
  }

  const zielBearbeiten = () => {
    setZielText(lage.ziel ? String(lage.ziel) : '')
    setZielFehler(null)
    setZielOffen(true)
  }

  // `roh` ist null für „Ziel entfernen"; sonst der aufbereitete Feldinhalt.
  const zielSetzen = async roh => {
    setZielSpeichert(true)
    setZielFehler(null)
    try {
      const antwort = await kalorienZielSpeichern(roh)
      setLage(l => ({ ...l, ziel: antwort.ziel ?? null }))
      setZielOffen(false)
      toast(antwort.ziel ? 'Ziel gespeichert.' : 'Ziel entfernt.')
    } catch (e) {
      setZielFehler(e.status ? e.message : 'Keine Verbindung — das Ziel ist nicht gespeichert.')
    } finally {
      setZielSpeichert(false)
    }
  }

  const zielSpeichern = ereignis => {
    ereignis.preventDefault()
    const roh = zielAusEingabe(zielText)
    // Leeres Feld mit bestehendem Ziel heißt „weg damit" (wie beim Server); ohne Ziel gäbe
    // es nichts zu entfernen, und ein „Ziel entfernt." wäre nur verwirrend.
    if (roh === null && !lage.ziel) { setZielFehler('Trag zuerst dein Tagesziel ein.'); return }
    zielSetzen(roh)
  }

  const loeschen = async tag => {
    try {
      await kalorienLoeschen(tag)
      await laden()
    } catch (e) {
      toast(e.status ? e.message : 'Keine Verbindung.')
    }
  }

  // Der Schnitt zählt nur Tage MIT Eintrag — sonst drückt jeder vergessene Tag ihn nach
  // unten und die Zahl sagt mehr über das Eintragen als über das Essen.
  const mitEintrag = lage.eintraege.slice(0, 7)
  const schnitt = mitEintrag.length
    ? Math.round(mitEintrag.reduce((s, e) => s + e.kcal, 0) / mitEintrag.length)
    : null

  const diff = heutigerEintrag && lage.ziel ? heutigerEintrag.kcal - lage.ziel : null

  return <>
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav('/home')} aria-label="Zurück"><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 12 }}>
        <h1>Kalorien</h1>
        <div className="sub">Konstanz schlägt Perfektion.</div>
      </div>
    </div>

    {lage.zustand === 'laden' && <div className="muted small">Wird geladen …</div>}
    {lage.zustand === 'fehler' && (
      <div className="empty">
        <div className="ico"><Icon name="warning" /></div>
        Die Kalorien konnten nicht geladen werden.
        <div style={{ marginTop: 10 }}><Button onClick={laden}>Erneut versuchen</Button></div>
      </div>
    )}
    {lage.zustand === 'abgemeldet' && (
      <div className="empty"><div className="ico"><Icon name="lock" /></div>Deine Anmeldung ist abgelaufen. Lade die App neu.</div>
    )}

    {lage.zustand === 'da' && <>
      <div className="list" style={{ marginBottom: 14 }}>
        <div className="item" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="muted small">Heute</div>
            <div style={{ fontSize: 30, fontWeight: 650, letterSpacing: '-.02em' }}>
              {heutigerEintrag ? heutigerEintrag.kcal : '—'}
              <span className="muted" style={{ fontSize: 15, fontWeight: 400 }}> kcal</span>
            </div>
          </div>
          {/* B&S: Die Ziel-Kachel ist der Knopf zum Setzen und Ändern — kein eigener Menüpunkt
              für etwas, das man selten anfasst. */}
          <button type="button" onClick={zielBearbeiten} aria-expanded={zielOffen}
            aria-label={lage.ziel
              // B&S: Das aria-label ersetzt den Inhalt des Knopfs für Screenreader —
              // deshalb muss die Abweichung („120 unter Ziel“) mit hinein, sonst geht sie verloren.
              ? `Dein Ziel: ${lage.ziel} kcal${diff != null ? (diff <= 0 ? `, ${Math.abs(diff)} unter Ziel` : `, ${diff} über Ziel`) : ''} — ändern`
              : undefined}
            style={{ textAlign: 'right', padding: '4px 0 4px 12px' }}>
            <span className="muted small" style={{ display: 'block' }}>{lage.ziel ? 'Dein Ziel' : 'Tagesziel'}</span>
            <span style={{ display: 'block', fontSize: 17 }}>
              {lage.ziel
                ? <>{lage.ziel} kcal <Icon name="pencil" className="muted" style={{ fontSize: 13 }} /></>
                : <span className="accent">Ziel festlegen</span>}
            </span>
            {diff != null && (
              <span className="small" style={{ display: 'block', color: diff <= 0 ? 'var(--green)' : 'var(--orange)' }}>
                {diff <= 0 ? `${Math.abs(diff)} unter Ziel` : `${diff} über Ziel`}
              </span>
            )}
          </button>
        </div>
        {schnitt != null && (
          <div className="item" style={{ justifyContent: 'space-between' }}>
            <span className="muted">
              {mitEintrag.length === 1 ? 'Bisher nur heute eingetragen' : `Schnitt aus ${mitEintrag.length} Tagen`}
            </span>
            <b>{schnitt} kcal</b>
          </div>
        )}
      </div>

      {zielOffen && (
        <form onSubmit={zielSpeichern} style={{ marginBottom: 18 }}>
          <div className="list" style={{ marginBottom: 8 }}>
            <label className="item" style={{ justifyContent: 'space-between', gap: 12 }}>
              <span style={{ flex: 'none' }}>Tagesziel (kcal)</span>
              {/* Bewusst kein NumberField: das schneidet „2.800" am Punkt ab und macht 2 daraus. */}
              <TextField value={zielText} inputMode="numeric" autoComplete="off" autoFocus
                aria-label="Tagesziel in kcal" style={{ maxWidth: 130, textAlign: 'right' }}
                onChange={e => setZielText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') setZielOffen(false) }} />
            </label>
          </div>
          <div className="muted small" style={{ marginBottom: 10 }}>
            Dein Ziel legst du selbst fest — zum Beispiel mit einem Online-Kalorienrechner.
            Dein Coach sieht es und hilft dir, dranzubleiben.
          </div>
          {zielFehler && <div className="small" style={{ color: 'var(--red)', marginBottom: 8 }}>{zielFehler}</div>}
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Button type="submit" variant="primary" size="sm" disabled={zielSpeichert}>
              {zielSpeichert ? 'Wird gespeichert …' : 'Speichern'}
            </Button>
            <Button type="button" size="sm" disabled={zielSpeichert} onClick={() => setZielOffen(false)}>Abbrechen</Button>
            {lage.ziel && (
              <Button type="button" variant="danger" size="sm" disabled={zielSpeichert} onClick={() => zielSetzen(null)}>
                Ziel entfernen
              </Button>
            )}
          </div>
        </form>
      )}

      <h3 style={{ marginBottom: 8 }}>{heutigerEintrag ? 'Heute aktualisieren' : 'Für heute eintragen'}</h3>
      <div className="muted small" style={{ marginBottom: 10 }}>
        Ein zweiter Eintrag für denselben Tag ersetzt den ersten — es wird nicht addiert.
      </div>
      <div className="list" style={{ marginBottom: 10 }}>
        <label className="item" style={{ justifyContent: 'space-between' }}>
          <span>Kalorien</span>
          <NumberField value={eingabe.kcal} nullable decimal={false} placeholder="2650" style={{ maxWidth: 110 }}
            onChange={v => setEingabe(e => ({ ...e, kcal: v }))} />
        </label>
        {[['protein', 'Protein (g)', '160'], ['carbs', 'Kohlenhydrate (g)', '300'], ['fett', 'Fett (g)', '80']].map(([feld, titel, bsp]) => (
          <label key={feld} className="item" style={{ justifyContent: 'space-between' }}>
            <span>{titel}</span>
            <NumberField value={eingabe[feld]} nullable decimal={false} placeholder={bsp} style={{ maxWidth: 110 }}
              onChange={v => setEingabe(e => ({ ...e, [feld]: v }))} />
          </label>
        ))}
        <label className="item" style={{ justifyContent: 'space-between', gap: 12 }}>
          <span style={{ flex: 'none' }}>Notiz</span>
          <TextField value={eingabe.notiz} placeholder="Cheat Day, Wettkampf …" maxLength={200}
            onChange={e => setEingabe(v => ({ ...v, notiz: e.target.value }))} />
        </label>
      </div>
      {fehler && <div className="small" style={{ color: 'var(--red)', marginBottom: 8 }}>{fehler}</div>}
      <Button variant="primary" disabled={speichert} onClick={speichern}>
        {speichert ? 'Wird gespeichert …' : heutigerEintrag ? 'Aktualisieren' : 'Eintragen'}
      </Button>

      <h3 style={{ margin: '22px 0 8px' }}>Letzte 14 Tage</h3>
      {lage.eintraege.length ? (
        <div className="list">
          {lage.eintraege.map(e => (
            <div key={e.datum} className="item" style={{ justifyContent: 'space-between', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <b>{e.datum === lage.heute ? 'Heute' : `${wochentag(e.datum)}, ${heuteText(e.datum)}`}</b>
                {(e.protein != null || e.carbs != null || e.fett != null) && (
                  <div className="muted small">
                    {[e.protein != null && `${e.protein} P`, e.carbs != null && `${e.carbs} KH`, e.fett != null && `${e.fett} F`]
                      .filter(Boolean).join(' · ')}
                  </div>
                )}
                {e.notiz && <div className="muted small" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.notiz}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: lage.ziel && e.kcal > lage.ziel ? 'var(--orange)' : 'var(--label)' }}>{e.kcal} kcal</span>
                <button className="iconbtn" aria-label={`Eintrag vom ${e.datum} löschen`} onClick={() => loeschen(e.datum)}>
                  <Icon name="xmark" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty"><div className="ico"><Icon name="flame" /></div>Noch nichts eingetragen.</div>
      )}

      <div className="dim small" style={{ textAlign: 'center', marginTop: 14 }}>
        Dein Coach sieht deine Einträge, dein Ziel und den Wochenschnitt.
      </div>
    </>}
  </>
}
