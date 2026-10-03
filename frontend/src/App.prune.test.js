// B&S: Die Trainings-App ist ein Fork von openGym, aus dem ganze Bereiche herausfallen:
// Gast/Demo, Gym-Check-in, KI-Coach, Admin, das Mobile-Onboarding und Web-Push. Der Shell-Code
// ist die Stelle, an der so etwas zurückkommen würde (eine Route genügt), deshalb steht er hier
// als Quelltext auf dem Prüfstand — ihn zu rendern hieße, den halben Store mitzufälschen.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')

describe('App-Shell — Routen', () => {
  it('führt genau die Screens, die Mitglieder und Coaches brauchen', () => {
    for (const path of ['/home', '/plan', '/plan/r/:id', '/workout', '/stats', '/history', '/library', '/muscles', '/kalorien', '/check-in', '/settings']) {
      expect(source, path).toContain(`path="${path}"`)
    }
  })

  // B&S: Gemeint ist openGyms Check-in — die Mitgliedskarte fürs Studio (gymCards, store:72).
  // Unser „/check-in" ist etwas anderes: das Foto nach dem Training. Der Bindestrich hält die
  // beiden auch hier auseinander, damit diese Prüfung weiter das tut, wofür sie gedacht war.
  it('kennt weder openGyms Studio-Check-in noch Coach- oder Admin-Screens', () => {
    for (const gone of ['/checkin', '/coach', '/admin', 'MobileOnboarding', 'CoachChat', 'CoachIntake', 'CoachSetup']) {
      expect(source, gone).not.toContain(gone)
    }
  })

  it('zeigt die Tab-Leiste auf jedem Screen', () => {
    expect(source).toContain('<TabBar onStart={startFlow} />')
    expect(source).not.toContain("loc.pathname !== '/coach'")
  })
})

describe('App-Shell — fester Auftritt', () => {
  it('setzt Dark-Mode und Elektro-Blau, ohne Theme-Wahl', () => {
    expect(source).toContain("de.dataset.theme = 'dark'")
    expect(source).toContain("de.dataset.accent = 'blau'")
    expect(source).toContain("meta.content = '#0a0a0a'")
    expect(source).not.toContain('prefers-color-scheme')
    expect(source).not.toContain('ACCENTS')
  })

  it('startet deutsch', () => {
    expect(source).toContain("setLang('de')")
    expect(source).toContain("document.documentElement.lang = 'de'")
  })
})

describe('App-Shell — Session und Editor', () => {
  it('kennt keinen Gastmodus und schiebt keine Push-Abos mehr', () => {
    expect(source).not.toContain('isGuest')
    expect(source).not.toContain('syncPushSubscription')
    expect(source).toContain('const authed = !!user')
  })

  it('hängt das Editor-Banner über die Routen', () => {
    expect(source).toContain("import EditorBanner from './components/EditorBanner.jsx'")
    expect(source.indexOf('<EditorBanner />')).toBeGreaterThan(-1)
    expect(source.indexOf('<EditorBanner />')).toBeLessThan(source.indexOf('<Routes>'))
  })
})
