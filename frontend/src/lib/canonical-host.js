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
// Escape-Hatch für den Betrieb: ?direkt=1 hängt die Umleitung aus, damit ein Deployment
// (auch eine Preview-URL) direkt geprüft werden kann.
import { SITE_URL } from './brand.js'

export function canonicalUrl(loc) {
  if (!loc || !/\.vercel\.app$/i.test(loc.hostname || '')) return null
  try { if (new URLSearchParams(loc.search || '').has('direkt')) return null } catch (e) { /* egal */ }
  return SITE_URL + (loc.pathname || '/') + (loc.search || '') + (loc.hash || '')
}
