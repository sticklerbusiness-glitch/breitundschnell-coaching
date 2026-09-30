// B&S: Das Vercel-Projekt der Trainings-App hat eine eigene Adresse (…​.vercel.app), unter der
// dieselbe App ein zweites Mal erreichbar ist. Dort gibt es kein bs_session-Cookie und keine
// /login-Seite: /api/me antwortet 401, die App leitet auf /login um und man landet auf einem
// nackten Vercel-404 — mit eigenem Service Worker und eigenem localStorage, unsichtbar für die
// echte App. Diese Adresse steht in Betrieb.md (GYM_URL) und damit in Verlauf und Zwischenablage.
//
// Serverseitig lässt sich das NICHT umleiten: genau über diese Adresse holt sich die Website die
// App per Rewrite. Eine Weiterleitung in vercel.json träfe jeden Proxy-Request und damit jedes
// Mitglied. Also hier im Client, wo nur ein echter Browser auf dem falschen Host landet.
//
// B&S: Umgeleitet wird NUR von den eigenen Adressen des Gym-Projekts, nicht von jedem
// *.vercel.app. Eine Preview der WEBSITE (breitundschnell-website-git-….vercel.app) liefert
// /training über denselben Rewrite wie live aus — das ist die einzige Stelle, an der sich die
// Naht (Service-Worker-Allowed durch den Proxy? CSP doppelt? Schrägstrich?) VOR dem Livegang
// prüfen lässt. Eine Umleitung von dort schickte den Prüfenden unbemerkt auf die Produktion.
// Damit /training auf Preview-Deployments der Website überhaupt antwortet, muss `GYM_URL` im
// Vercel-Projekt der Website auch für „Preview" gesetzt sein (Konzept/Betrieb.md).
//
// Escape-Hatch für den Betrieb: ?direkt=1 hängt die Umleitung aus, damit ein Deployment des
// Gym-Projekts direkt geprüft werden kann — einmal gesetzt, gilt es für die ganze Sitzung
// (sessionStorage), sonst wirft der nächste Reload den Prüfenden zurück auf die Produktion.
import { SITE_URL } from './brand.js'

// Der Projektname des Gym-Projekts bei Vercel (Konzept/Betrieb.md, package.json „name"):
// `breitundschnell-coaching.vercel.app` und jede Preview/Branch-Adresse davon
// (`breitundschnell-coaching-git-<branch>-<team>.vercel.app`).
const EIGEN = /^breitundschnell-coaching(?:-[a-z0-9-]+)?\.vercel\.app$/i

const DIREKT_KEY = 'gym_direkt'

const sitzung = () => {
  try { return typeof sessionStorage === 'undefined' ? null : sessionStorage } catch (e) { return null }
}

/**
 * Die Adresse, auf die von hier aus umgeleitet werden muss — oder null.
 * @param loc     location-artig (hostname, pathname, search, hash)
 * @param store   sessionStorage-artig; nur für Tests von außen gegeben
 */
export function canonicalUrl(loc, store = sitzung()) {
  if (!loc || !EIGEN.test(loc.hostname || '')) return null
  let direkt = false
  try { direkt = new URLSearchParams(loc.search || '').has('direkt') } catch (e) { /* egal */ }
  if (direkt) {
    try { store?.setItem(DIREKT_KEY, '1') } catch (e) { /* egal */ }
    return null
  }
  try { if (store?.getItem(DIREKT_KEY) === '1') return null } catch (e) { /* egal */ }
  return SITE_URL + (loc.pathname || '/') + (loc.search || '') + (loc.hash || '')
}
