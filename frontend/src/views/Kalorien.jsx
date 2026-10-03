import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import { Button, NumberField, TextField } from '../components/ui.jsx'
import { useUI } from '../store/useUI.js'
import { kalorienLaden, kalorienLoeschen, kalorienSpeichern } from '../lib/website-api.js'

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
 */

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
          <div style={{ textAlign: 'right' }}>
            <div className="muted small">{lage.ziel ? 'Dein Ziel' : 'Ziel'}</div>
            <div style={{ fontSize: 17 }}>{lage.ziel ? `${lage.ziel} kcal` : <span className="muted">kommt vom Coach</span>}</div>
            {diff != null && (
              <div className="small" style={{ color: diff <= 0 ? 'var(--green)' : 'var(--orange)' }}>
                {diff <= 0 ? `${Math.abs(diff)} unter Ziel` : `${diff} über Ziel`}
              </div>
            )}
          </div>
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
        Dein Coach sieht deine Einträge und den Wochenschnitt.
      </div>
    </>}
  </>
}
