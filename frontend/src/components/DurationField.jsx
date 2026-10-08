// B&S: Eingabe für Zeiten im Format m:ss bzw. h:mm:ss — für die Strecken-Erfassung (Laufen,
// Schwimmen, Rad). Der Wert ist immer in Sekunden; 0 heißt „keine Zeit" und zeigt ein leeres Feld.
//
// Getippt wird frei („3:10", „3,10", „1:02:30", „45" = 45 Minuten — siehe parseDur). Jede
// Eingabe, die schon eine Zeit IST, wird sofort gespeichert — wie bei den Zahlenfeldern. Nur beim
// Verlassen zu speichern verlor die Zeit, wenn man direkt danach „Beenden" tippte (WebKit lässt
// das Feld dabei fokussiert, es kommt nie ein blur). Was keine Zeit ist, wird nicht gespeichert;
// beim Verlassen zeigt das Feld wieder den letzten gültigen Wert.
import { useState } from 'react'
import { fmtDur, parseDur } from '../lib/endurance.js'
import Icon from './Icon.jsx'

export function DurationField({ value, onChange, placeholder = 'm:ss', className = '', ...rest }) {
  const [draft, setDraft] = useState(null)
  const shown = draft ?? (value > 0 ? fmtDur(value) : '')
  const commit = () => {
    if (draft == null) return
    const text = draft.trim()
    setDraft(null)
    if (!text) { onChange(0); return }
    const sec = parseDur(text)
    if (sec != null) onChange(sec)
  }
  return (
    <input
      type="text"
      // Ziffernfeld mit Komma: das Komma zählt wie der Doppelpunkt (parseDur).
      inputMode="decimal"
      className={'num ' + className}
      value={shown}
      placeholder={placeholder}
      onFocus={e => e.target.select()}
      onChange={e => {
        const text = e.target.value
        setDraft(text)
        const sec = parseDur(text)
        if (sec != null && sec !== value) onChange(sec)
      }}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
      {...rest}
    />
  )
}

/** Wie Stepper (components/ui.jsx), nur mit Zeitfeld: − / Zeit / + mit Beschriftung darüber. */
export function DurationStepper({ label, value, step = 5, onChange, placeholder }) {
  const bump = dir => onChange(Math.max(0, Math.round((Number(value) || 0) + dir * step)))
  return <div className="stp-w"><span className="stp-l">{label}</span>
    <div className="stp">
      <button type="button" aria-label="Decrease" onClick={() => bump(-1)}><Icon name="minus" /></button>
      <span className="val"><DurationField value={value} onChange={onChange} placeholder={placeholder} aria-label={label} /></span>
      <button type="button" aria-label="Increase" onClick={() => bump(1)}><Icon name="plus" /></button>
    </div>
  </div>
}
