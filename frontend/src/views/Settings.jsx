import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, DEF } from '../store/useStore.js'
import { workoutControls } from '../lib/workout-controls.js'
import { convertStateUnit } from '../lib/units.js'
import { useUI } from '../store/useUI.js'
import { todayISO, weekStartOf, MONDAY, SUNDAY } from '../lib/format.js'
import { effortOf } from '../lib/history.js'
import { unlock, playOnSilentSupported } from '../lib/sound.js'
import { wakeLockSupported } from '../lib/wakelock.js'
import { t } from '../lib/i18n.js'
import { SOURCE_URL } from '../lib/brand.js'
// B&S: Im Plan-Editor gehört der Stand dem Mitglied — die zerstörenden Wege bleiben dort zu.
import { editorMode } from '../lib/editor-mode.js'
import { confirmSheet, importFromApp, importFromHevy, equipmentProfileSheet, menuSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Section, Row, SelectRow, Switch, Segmented } from '../components/ui.jsx'
import { installationZeigen } from '../components/AppInstallieren.jsx'

// B&S: Die Einstellungen enthalten nur noch, was das Mitglied selbst betrifft — seine
// Trainings-Vorlieben und seine eigenen Daten. Alles, was zum Betrieb einer eigenen
// openGym-Instanz gehörte (Konto/Passkeys/Pairing, Einladungen, Admin, Self-Hosting,
// APK-Update, KI-Coach, Gym-Check-in, Web-Push, Demo) ist weg: das Konto lebt auf der
// Website, der Trainingsplan gehört den Coaches. Sprache, Theme und Akzent sind fest.
export default function Settings() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const { update, replaceState } = useStore()
  const toast = useUI(s => s.toast)
  const fileRef = useRef(null)
  const importRef = useRef(null)
  const wakeOK = wakeLockSupported()
  // B&S: App.jsx zeigt diese Seite im Plan-Editor gar nicht erst an. Falls sie doch einmal
  // gerendert wird (Deep-Link, künftige Route), dürfen die beiden Wege, die den ganzen Stand
  // ersetzen, nicht laufen: im Editor landet jede Änderung als PUT /api/trainer/plan beim
  // Mitglied — „Alles zurücksetzen“ löschte damit dessen Plan, ein Backup risse die
  // Coach-Übungen heraus. Der Coach hat hier schlicht nichts zu ändern.
  const editorBlocked = () => {
    if (!editorMode()) return false
    toast('Im Plan-Editor bearbeitest du nur den Trainingsplan — die Daten des Mitglieds bleiben unangetastet.')
    return true
  }

  // Two honest choices on a unit switch (issue #22): convert the numbers, or keep them and only
  // change the label — the old behaviour, still right for someone who logged in lb all along
  // under a kg label. Closing the sheet leaves the unit as it was.
  // B&S: Umgerechnet werden nur die eigenen Daten. Routinen und Wochenplan gehören den Coaches:
  // eine Umrechnung dort würde beim nächsten Sync vom Server verworfen (Mitglied) bzw. die
  // Zahlen im Plan dauerhaft überschreiben (Plan-Editor) — beides falsch. Darum bleiben die
  // Plan-Gewichte in der Einheit des Coaches, und der Text sagt das auch.
  const convertOwnData = v => {
    const cur = useStore.getState().S
    const next = convertStateUnit(cur, v)
    next.routines = cur.routines
    next.week = cur.week
    replaceState(next)
  }
  const switchUnit = v => {
    if (v === S.unit) return
    menuSheet({
      title: t('Convert to {0}?', v),
      subtitle: 'Deine eigenen Zahlen — geloggte Sätze, Arbeitsgewichte, Körpergewicht, Hantelstangen — stehen in '
        + S.unit + '. Umrechnen oder nur das Kürzel tauschen? Die Vorgaben in deinem Trainingsplan legt dein Coach fest; die bleiben unverändert.',
      items: [
        { icon: 'shuffle', label: t('Convert the numbers'), onClick: () => convertOwnData(v) },
        { icon: 'pencil', label: t('Keep the numbers, change the label'), onClick: () => update(s => { s.unit = v }) },
      ],
    })
  }

  // Datenmitnahme (DSGVO): der ganze Stand als JSON, jederzeit und ohne Nachfrage.
  const doExport = () => {
    const json = JSON.stringify(S, null, 2)
    const name = 'breit-und-schnell-backup-' + todayISO() + '.json'
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href)
    toast(t('Backup exported'))
  }
  // B&S: Ein Backup bringt Trainings, Gewichte und Einstellungen zurück — nie den Plan.
  // Routinen und Wochenplan gehören den Coaches; was in der Datei steht, wird verworfen,
  // damit ein alter Stand den aktuellen Plan nicht überschreibt.
  const doImport = ev => {
    const f = ev.target.files[0]; if (!f) return
    if (editorBlocked()) { ev.target.value = ''; return }
    const rd = new FileReader()
    rd.onload = () => {
      try {
        const data = JSON.parse(rd.result)
        if (!data || !Array.isArray(data.workouts)) throw new Error('Das ist keine Backup-Datei der Trainings-App.')
        delete data.routines; delete data.week; delete data.active; delete data._rev
        confirmSheet({
          title: 'Backup einspielen?',
          message: 'Ersetzt deine Trainings, Gewichts-Einträge und Einstellungen durch die Datei. Dein Trainingsplan vom Coach bleibt unverändert.',
          confirmText: 'Einspielen', danger: true,
          onConfirm: () => {
            if (editorBlocked()) return
            const cur = useStore.getState().S
            const next = Object.assign(JSON.parse(JSON.stringify(DEF)), data)
            next.routines = cur.routines; next.week = cur.week
            // B&S: Eigene Übungen, die der Plan benutzt, kommen vom Coach. Sie bleiben stehen,
            // auch wenn die Backup-Datei sie nicht kennt — sonst zeigt der Plan „Unbekannte
            // Übung“ auf Einträge, die die Routinen weiter referenzieren.
            const fromFile = Array.isArray(next.customEx) ? next.customEx : []
            const planEx = (cur.customEx || []).filter(x => (cur.routines || []).some(r => (r.ex || []).some(e => e.id === x.id)))
            next.customEx = planEx.concat(fromFile.filter(x => !planEx.some(p => p.id === x.id)))
            replaceState(next, true)
            toast('Backup eingespielt')
          },
        })
      } catch (e) { toast('Import fehlgeschlagen: ' + e.message) }
    }
    rd.readAsText(f)
  }
  // Der leere Stand wird wie jede andere Änderung ins Profil geschoben, erreicht also jedes
  // Gerät. Der Plan liegt serverseitig getrennt davon und kommt nach dem Zurücksetzen wieder.
  const resetEverything = () => {
    if (editorBlocked()) return
    confirmSheet({
      title: 'Alles zurücksetzen?',
      message: 'Löscht deine Trainings, Gewichts-Einträge und Einstellungen aus deinem Profil — auf allen Geräten. Dein Trainingsplan vom Coach bleibt. Das lässt sich nicht rückgängig machen.',
      confirmText: 'Alles löschen', danger: true,
      onConfirm: () => {
        if (editorBlocked()) return
        replaceState(JSON.parse(JSON.stringify(DEF)), true)
        nav('/home'); toast('Alle Daten zurückgesetzt')
      },
    })
  }

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav('/home')} aria-label={t('Home')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 10 }}><h1>{t('Settings')}</h1></div>
    </div>

    {/* ---------- general ---------- */}
    {/* B&S: Der Footer sagt ausdrücklich, was die Umrechnung NICHT anfasst — sonst liest sich
        ein kg-Plan nach dem Wechsel auf lb wie eine lb-Vorgabe. */}
    <Section title={t('General')} footer="Beim Wechsel der Einheit kannst du deine eigenen Zahlen umrechnen lassen. Die Vorgaben in deinem Trainingsplan legt dein Coach fest — sie bleiben in seiner Einheit stehen.">
      <Row icon="scale" iconTint="var(--teal)" title={t('Weight unit')}>
        <Segmented className="seg-inline"
          options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]}
          value={S.unit} onChange={v => switchUnit(v)} />
      </Row>
      {/* Monday or Sunday — the Plan list, the Home strip, the calendar grid and every
          "this week" total follow it. Stored as a getDay() index (see lib/format.js). */}
      <Row icon="calendar" iconTint="var(--orange)" title={t('Week starts on')}>
        <Segmented className="seg-inline"
          options={[{ value: MONDAY, label: t('Monday') }, { value: SUNDAY, label: t('Sunday') }]}
          value={weekStartOf(S)} onChange={v => update(s => { s.weekStart = v })} />
      </Row>
      {/* Purely how the muscle map is drawn — nothing else in the app reads this. */}
      <Row icon="figureStrength" iconTint="var(--teal)" title={t('Body diagram')}>
        <Segmented
          className="seg-inline"
          options={[{ value: 'male', label: t('Male') }, { value: 'female', label: t('Female') }]}
          value={S.body === 'female' ? 'female' : 'male'}
          onChange={v => update(s => { s.body = v })}
        />
      </Row>
    </Section>

    {/* ---------- during a workout ---------- */}
    <Section title={t('During a workout')} footer={wakeOK ? t('The screen stays on while a workout is running, so you don’t have to unlock your phone between sets.') : null}>
      {/* The quick weigh-in that opens on Start (sheets.jsx startFlow, issue #137); off skips straight
          to the session. Home and Stats still log weight by hand. */}
      <Row icon="scale" iconTint="var(--green)" title={t('Weigh in before workouts')}
        subtitle={t('Asks for your body weight when a workout starts. Off starts the session straight away.')}>
        <Switch checked={S.weighIn !== false} onChange={v => update(s => { s.weighIn = v })} />
      </Row>
      {/* One exercise at a time (cards with Prev/Next), the whole session stacked as a
          scrollable list, or that list stripped to just names and set rows (compact).
          Legacy/unknown values read as cards. The running session can override this from
          the workout header's ⋮ menu without changing this default. */}
      <Row icon="list" iconTint="var(--blue)" title={t('Workout view')}>
        <Segmented className="seg-inline"
          options={[{ value: 'cards', label: t('Cards') }, { value: 'list', label: t('List') }, { value: 'compact', label: t('Compact') }]}
          value={['list', 'compact'].includes(S.workoutView) ? S.workoutView : 'cards'}
          onChange={v => update(s => { s.workoutView = v })} />
      </Row>
      {/* The lean workout screen keeps the sets and one "more" button per exercise; each switch
          brings one of the old always-visible button groups back for people who liked them. */}
      <Row icon="wrench" iconTint="var(--purple)" title={t('Workout controls')} accessory="chevron"
        subtitle={t('Everything hidden here stays one tap away: the ⋯ button of an exercise and the number of a set.')}
        onClick={() => workoutControlsSheet()} />
      <SelectRow icon="timer" iconTint="var(--orange)" title={t('Rest timer')}
        value={S.restSec} onChange={v => update(s => { s.restSec = v })}
        options={[{ value: 0, label: t('Off') }, ...[60, 90, 120, 150, 180].map(v => ({ value: v, label: v + 's' }))]} />
      {/* Default for a rest-pause burst added live on a plain set — a planned exercise's own
          "Rest (s)" (in its Intensifier config) overrides this, same as the main rest timer
          is the fallback whenever an exercise has no progression rule of its own. */}
      <SelectRow icon="bolt" iconTint="var(--acc)" title={t('Rest-pause rest')}
        value={S.restPauseSec} onChange={v => update(s => { s.restPauseSec = v })}
        options={[10, 15, 20, 30].map(v => ({ value: v, label: v + 's' }))} />
      <Row icon="sun" iconTint="var(--yellow)" title={t('Keep screen awake')}
        subtitle={wakeOK ? null : t('Not supported in this browser.')}>
        <Switch checked={wakeOK && S.keepAwake !== false} disabled={!wakeOK}
          onChange={v => update(s => { s.keepAwake = v })} />
      </Row>
      {/* 'full'/'mini' is also what the tap-toggle on the workout animation writes; 'off' hides
          workout media entirely (library, detail sheet and picker thumbs are unaffected).
          Legacy/unknown values read as 'full'. */}
      <Row icon="figureRun" iconTint="var(--green)" title={t('Exercise animations')}>
        <Segmented className="seg-inline"
          options={[{ value: 'full', label: t('Full') }, { value: 'mini', label: t('Small') }, { value: 'off', label: t('Hidden') }]}
          value={S.gifSize === 'mini' || S.gifSize === 'off' ? S.gifSize : 'full'}
          onChange={v => update(s => { s.gifSize = v })} />
      </Row>
      <Row icon="bell" iconTint="var(--pink)" title={t('Sounds')}>
        {/* Turning Sounds on is a tap: unlock the audio context now so a timer that ends before
            the next set check can already sound (iOS, #152). */}
        <Switch checked={!!S.sound} onChange={v => { if (v) unlock(true); update(s => { s.sound = v }) }} />
      </Row>
      {/* iOS only (WebKit's audio-session API, iOS 17+): with it off the ring/silent switch mutes
          the timer. On, the phone treats the timer like a music player — exclusive, and the
          music app is not told it may resume — so it is a choice, off by default (lib/sound.js). */}
      {S.sound && playOnSilentSupported() && (
        <Row icon="bell" iconTint="var(--orange)" title={t('Play sounds when the phone is on silent')}
          subtitle={t('Music playing on this phone stops during a workout and does not resume by itself.')}>
          <Switch checked={!!S.soundOnSilent} onChange={v => update(s => { s.soundOnSilent = v })} />
        </Row>
      )}
      <Row icon="sun" iconTint="var(--yellow)" title={t('Flash screen when timer ends')}>
        <Switch checked={!!S.timerFlash} onChange={v => update(s => { s.timerFlash = v })} />
      </Row>
      {/* Two names for the same judgement, so the column asks in the scale you already think in.
          The (i) sits before the control — you read it on the way to the choice, not after it. */}
      <Row icon="target" iconTint="var(--purple)" title={t('Effort per set')}>
        <button className="helpbtn" aria-label={t('What are RIR and RPE?')} onClick={effortHelpSheet}><Icon name="info" /></button>
        <Segmented className="seg-inline"
          options={[{ value: 'none', label: t('Off') }, { value: 'rir', label: t('RIR') }, { value: 'rpe', label: t('RPE') }]}
          value={effortOf(S)} onChange={v => update(s => { s.effort = v; delete s.showRir })} />
      </Row>
    </Section>

    {/* ---------- equipment ---------- */}
    <EquipmentCard S={S} update={update} />

    {/* ---------- data: bring your history over, back it up, wipe it ---------- */}
    <Section title={t('Data')} footer="Dein Trainingsplan kommt von deinem Coach — ein Backup spielt ihn nicht zurück.">
      <Row icon="shuffle" iconTint="var(--teal)" title={t('Import from another app')}
        subtitle={t('FitNotes, Strong, Hevy — or body weight from Apple Health')}
        accessory="chevron" onClick={() => importRef.current.click()} />
      <Row icon="key" iconTint="var(--teal)" title={t('Import from Hevy')}
        subtitle={t('Pull your history with a Hevy Pro API key')}
        accessory="chevron" onClick={importFromHevy} />
      <Row icon="download" iconTint="var(--blue)" title={t('Export backup (JSON)')} accessory="chevron" onClick={doExport} />
      <Row icon="upload" iconTint="var(--blue)" title={t('Import backup')} accessory="chevron" onClick={() => fileRef.current.click()} />
      <Row icon="trash" iconTint="var(--red)" title={t('Reset everything')} danger onClick={resetEverything} />
    </Section>
    <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={doImport} />
    {/* Reset after reading so picking the same file twice still fires onChange. */}
    <input ref={importRef} type="file" accept=".csv,.xml,text/csv,text/xml" style={{ display: 'none' }}
      onChange={ev => { const f = ev.target.files[0]; if (f) importFromApp(f); ev.target.value = '' }} />

    {/* B&S: Wer das Fenster nach dem Anmelden weggetippt hat, findet die Anleitung hier wieder —
        sonst ist sie genau einmal da und danach für immer weg. */}
    <Section title="App">
      <Row icon="addToHome" iconTint="var(--acc)" title="Auf den Home-Bildschirm legen"
        subtitle="Schritt für Schritt — danach startest du dein Training mit einem Tipp"
        accessory="chevron" onClick={installationZeigen} />
    </Section>

    {/* ---------- Konto: das liegt auf der Website, nicht in der Trainings-App ---------- */}
    <Section title="Konto">
      <Row icon="personCircle" iconTint="var(--grey)" title="Zurück zu Mein Bereich"
        subtitle="Coaching, Nachrichten und Rechnungen auf breitundschnell.de"
        accessory="chevron" onClick={() => { window.location.href = '/app' }} />
      <Row icon="signOut" iconTint="var(--red)" title="Abmelden"
        subtitle="Über dein Konto auf der Website" accessory="chevron"
        onClick={() => { window.location.href = '/app/konto' }} />
      {/* B&S: Pflichtangaben. Die Trainings-App ist für ein Mitglied eine eigene Oberfläche —
          ohne diese beiden Zeilen käme es nie zur Datenschutzerklärung (Art. 13 DSGVO) oder
          zum Impressum (ECG §5), weil der Mitgliederbereich sie auch nicht verlinkt. */}
      <Row icon="shield" iconTint="var(--blue)" title="Datenschutz"
        subtitle="Welche Trainingsdaten wir speichern und warum" accessory="chevron"
        onClick={() => { window.location.href = '/datenschutz' }} />
      <Row icon="info" iconTint="var(--grey)" title="Impressum" accessory="chevron"
        onClick={() => { window.location.href = '/impressum' }} />
    </Section>

    {/* B&S: Pflicht-Footer. Die App ist ein Fork von openGym und steht unter der AGPL-3.0 —
        der Quellcode-Link muss sichtbar bleiben, solange die App ausgeliefert wird.
        Die Versionsnummer steht dabei, weil die AGPL §13 den Quellcode GENAU DIESER Version
        verlangt: ohne sie lässt sich später nicht mehr sagen, welcher Stand gerade lief. */}
    <div className="dim small" style={{ textAlign: 'center', marginTop: 4, lineHeight: 1.6 }}>
      Trainings-App von Breit &amp; Schnell v{__APP_VERSION__} · basiert auf openGym von Duarte Santos · Lizenz AGPL-3.0 ·{' '}
      <a href={SOURCE_URL} target="_blank" rel="noopener">Quellcode</a><br />
      Übungsdaten: ExerciseDB über hasaneyldrm/exercises-dataset (MIT)<br />
      {/* B&S: Bildnachweis wie im Original. Die Animationen stammen nicht von uns und werden
          von einem fremden Server geladen — das muss dranstehen, solange sie drin sind. */}
      Übungsbilder und -animationen ©{' '}
      <a href="https://gymvisual.com/" target="_blank" rel="noopener">Gym visual</a>, geladen über
      jsDelivr<br />
      Schriften: Inter und Anton (SIL Open Font License 1.1) · Körperkarte: MuscleMap (MIT)
    </div>
  </div>
}

// The whole point is that the two scales are one judgement counted from opposite ends, and a
// paragraph is a bad way to say that — the conversion table shows it in one look. Reading down
// a column is the answer to "what do I put here", so the numbers get their own aligned columns.
const EFFORT_ROWS = [
  ['0', '10', 'Nothing left — went to failure'],
  ['1', '9', 'One more rep in the tank'],
  ['2', '8', 'Two more reps'],
  ['3', '7', 'Three more reps'],
  ['4+', '≤6', 'Easy — warm-up territory'],
]
// RIR 2 / RPE 8: the row a working set usually lands on — the anchor the others are read
// against. Not where the stepper starts; + walks up from the bottom of the scale.
const EFFORT_TYPICAL = 2

// Settings → During a workout → Workout controls. S.wc overlays DEF.wc, so a profile from
// before this setting existed reads as the lean default.
function WorkoutControlsSheet() {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const wc = workoutControls(S)
  const set = (k, v) => update(s => { s.wc = { ...workoutControls(s), [k]: v } })
  return <>
    <h3>{t('Workout controls')}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{t('Everything hidden here stays one tap away: the ⋯ button of an exercise and the number of a set.')}</div>
    <Section>
      <Row icon="plus" iconTint="var(--acc)" title={t('Weight and reps buttons')} subtitle={t('Off: tap the number and type it')}>
        <Switch checked={wc.steppers} onChange={v => set('steppers', v)} />
      </Row>
      <Row icon="bolt" iconTint="var(--orange)" title={t('Drop and burst shortcuts on every set')}>
        <Switch checked={wc.setShortcuts} onChange={v => set('setShortcuts', v)} />
      </Row>
      <Row icon="link" iconTint="var(--blue)" title={t('Superset buttons in the exercise header')}>
        <Switch checked={wc.pairButtons} onChange={v => set('pairButtons', v)} />
      </Row>
      <Row icon="shuffle" iconTint="var(--teal)" title={t('Move, swap and remove buttons below the exercise')}>
        <Switch checked={wc.exerciseButtons} onChange={v => set('exerciseButtons', v)} />
      </Row>
    </Section>
  </>
}
function workoutControlsSheet() {
  useUI.getState().openSheet(() => <WorkoutControlsSheet />)
}

function effortHelpSheet() {
  useUI.getState().openSheet(close => <>
    <h3>{t('Effort per set')}</h3>
    <div className="muted small" style={{ lineHeight: 1.5 }}>
      {t('How hard a set was, logged next to weight and reps. Two scales for the same judgement, counted from opposite ends.')}
    </div>
    <div className="efftbl">
      <div className="r hd"><span className="n">{t('RIR')}</span><span className="n">{t('RPE')}</span><span className="f">{t('How it felt')}</span></div>
      {EFFORT_ROWS.map(([rir, rpe, feel], i) => (
        <div key={rir} className={'r' + (i === EFFORT_TYPICAL ? ' on' : '')}>
          <span className="n">{rir}</span><span className="n">{rpe}</span><span className="f">{t(feel)}</span>
        </div>
      ))}
    </div>
    <div className="dim small" style={{ lineHeight: 1.5, display: 'grid', gap: 8 }}>
      <div>{t('RIR counts the reps you left; RPE reads the same effort off a 10-point scale — so RPE ≈ 10 − RIR. Pick the one you already think in.')}</div>
      <div>{t('The highlighted row is where most working sets land. Sets you have already logged keep their own scale, and nothing else reads the value — progression and estimated 1RM are unaffected.')}</div>
    </div>
    <div style={{ height: 8 }} />
  </>)
}

// Equipment profiles ("Home", "Gym", ...) — each an id/name/eq-list; the active one filters
// the Library, exercise picker, and flags routine entries that need something outside it
// (see lib/equipment.js). Purely local/synced state — no server changes needed.
function EquipmentCard({ S, update }) {
  const profiles = S.equipProfiles || []
  const remove = p => confirmSheet({
    title: t('Delete profile?'), message: t('"{0}" and its equipment list will be removed.', p.name),
    confirmText: t('Delete'), danger: true,
    onConfirm: () => update(s => {
      s.equipProfiles = (s.equipProfiles || []).filter(x => x.id !== p.id)
      if (s.activeEquipId === p.id) s.activeEquipId = (s.equipProfiles[0] && s.equipProfiles[0].id) || null
    }),
  })
  return <Section title={t('Equipment')} footer={t('Filters the exercise library and picker, and flags routine exercises that need something you don’t have in the active profile.')}>
    {profiles.length > 0 && <Row icon="dumbbell" iconTint="var(--acc)" title={t('Filter by equipment')}>
      <Switch checked={!!S.equipFilterOn} onChange={v => update(s => { s.equipFilterOn = v })} />
    </Row>}
    {profiles.length > 0 && <SelectRow icon="list" iconTint="var(--blue)" title={t('Active profile')}
      value={S.activeEquipId || ''} onChange={v => update(s => { s.activeEquipId = v })}
      options={profiles.map(p => ({ value: p.id, label: p.name }))} />}
    {profiles.map(p => (
      <Row key={p.id} icon="dumbbell" iconTint="var(--teal)" title={p.name}
        subtitle={t('{0} equipment types', p.equipment.length)} accessory="chevron"
        onClick={() => equipmentProfileSheet(p)}>
        <button className="iconbtn" aria-label={t('Delete')} onClick={ev => { ev.stopPropagation(); remove(p) }}><Icon name="trash" /></button>
      </Row>
    ))}
    <Row icon="plus" iconTint="var(--acc)" title={t('Add equipment profile')} accessory="chevron" onClick={() => equipmentProfileSheet(null)} />
  </Section>
}
