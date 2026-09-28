import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { DAYN, weekOrder, weekStartOf, uid, exCount } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { dayAssignSheet, dayAddRoutineSheet, starterPlanSheet, planToolsSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { tappable } from '../lib/use-sheet-keyboard.js'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'
// B&S: the plan belongs to the coaches. A member reads it; only the plan editor writes it.
import { usePlanEditable } from '../lib/editor-mode.js'

export default function Plan() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const editable = usePlanEditable()

  const addRoutine = () => {
    const r = { id: uid(), name: t('New routine'), emoji: DEFAULT_GLYPH, ex: [] }
    update(s => { s.routines.push(r) })
    nav('/plan/r/' + r.id)
  }

  // Pull one routine off a weekday; drop the key when the day empties (never store []).
  const removeFromDay = (d, rid) => update(s => {
    const next = [].concat(s.week[d] || []).filter(id => id !== rid)
    if (next.length) s.week[d] = next; else delete s.week[d]
  })

  return <>
    <div className="hdr">
      <div><h1>{t('Plan')}</h1><div className="sub">{t('Your weekly routine')}</div></div>
      <button className="iconbtn" onClick={planToolsSheet} aria-label={t('Share your plan')} title={t('Share your plan')}><Icon name="upload" /></button>
    </div>

    <div className="cols"><div>
      <h4 className="sec">{t('Week schedule')}</h4>
      <div className="list" style={{ display: 'flex', flexDirection: 'column' }}>
        {weekOrder(weekStartOf(S)).map(d => {
          const dayRoutines = [].concat(S.week[d] || []).map(id => S.routines.find(x => x.id === id)).filter(Boolean)
          // An empty day stays one tappable row → pick its first routine (today's behaviour).
          // For a member there is nothing to pick, so the row is a plain rest-day line.
          if (!dayRoutines.length) return <div key={d} className="item" {...(editable ? tappable(() => dayAssignSheet(d)) : {})}>
            <div className="grow"><div className="tt">{t(DAYN[d])}</div></div>
            <span className="tag">{t('Rest')}</span>
            {editable && <Icon name="chevronRight" className="chev" />}</div>
          // A populated day: always-visible routine sub-rows + inline ✕, then ＋ Add routine.
          return <div key={d} className="item" style={{ display: 'block', padding: '10px 14px' }}>
            <div className="row between" style={{ marginBottom: 6 }}>
              <div className="tt">{t(DAYN[d])}</div>
              <div className="small dim">{t('{0} routines', dayRoutines.length)}</div>
            </div>
            {dayRoutines.map(r => <div key={r.id} className="row" style={{ gap: 8, padding: '4px 0 4px 8px' }}>
              <span className="lrow-i" style={{ width: 26, height: 26, fontSize: 14 }}><Icon name={glyphOf(r.emoji)} /></span>
              <div className="grow" style={{ minWidth: 0 }}><div className="tt" style={{ fontSize: 14 }}>{r.name}</div><div className="ss">{exCount(r.ex.length)}</div></div>
              {editable && <button className="iconbtn sm" aria-label={t('Remove')} onClick={() => removeFromDay(d, r.id)}><Icon name="xmark" /></button>}
            </div>)}
            {editable && <button className="btn ghost sm" style={{ marginTop: 4, marginLeft: 8 }} onClick={() => dayAddRoutineSheet(d)}>
              <Icon name="plus" /> {t('Add routine')}
            </button>}
          </div>
        })}
      </div>
    </div><div>
      <div className="row between" style={{ marginTop: 22, marginBottom: 10 }}>
        <h4 className="sec" style={{ margin: 0 }}>{t('Routines')}</h4>
        {editable && <Button size="sm" variant="tinted" icon="plus" onClick={addRoutine}>{t('New')}</Button>}
      </div>
      {S.routines.length ? <div className="list">{S.routines.map(r => <div key={r.id} className="item" {...tappable(() => nav('/plan/r/' + r.id))}>
        <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
        <div className="grow"><div className="tt">{r.name}</div><div className="ss">{exCount(r.ex.length)}</div></div>
        <Icon name="chevronRight" className="chev" /></div>)}</div> : editable ? <>
        <div className="empty"><div className="ico"><Icon name="clipboard" /></div>{t('No routines yet.')}<br />{t('Create one or load the starter plan.')}</div>
        <Button icon="sparkles" onClick={starterPlanSheet}>{t('Load starter plan')}</Button>
      </> : <div className="empty"><div className="ico"><Icon name="clipboard" /></div>
        Noch kein Plan hinterlegt.<br />Dein Coach legt ihn für dich an.</div>}
    </div></div>
  </>
}
