import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { MOBILE } from './lib/mobile.js'
import { canonicalUrl } from './lib/canonical-host.js'
import { registerServiceWorker } from './lib/sw-register.js'
// B&S: fonts are self-hosted (GDPR — no request to fonts.gstatic.com). Latin subsets only:
// they cover German (ä ö ü ß) plus the typographic dashes and quotes the locale uses.
// Inter 400/500/600/700 is the whole UI; Anton 400 is the display face for big titles.
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/anton/latin-400.css'
import './index.css'

// App.jsx restores per-route scroll itself; the browser's own attempt races it.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

// B&S: Auf der *.vercel.app-Adresse des Gym-Projekts läuft dieselbe App ohne Sitzung und
// ohne Login-Seite — eine tote Zweitkopie. Von dort zurück auf die echte Domain, und zwar
// VOR dem Rendern, damit dort nie ein Profil in localStorage entsteht (lib/canonical-host.js).
const umleitung = canonicalUrl(location)
if (umleitung) {
  location.replace(umleitung)
} else {
  createRoot(document.getElementById('root')).render(
    <StrictMode><App /></StrictMode>
  )

  // Not in the mobile build: the native shell already serves everything from disk.
  // B&S: the app is served under the Vite base (/training/), so the worker is registered
  // from there too — a bare 'sw.js' would resolve against whatever path the page was
  // opened at and could land outside the scope the app needs. Den Geltungsbereich setzt
  // lib/sw-register.js auf /training (ohne Schrägstrich): genau dort liegt die Seite.
  if (!MOBILE && 'serviceWorker' in navigator && location.protocol === 'https:') {
    registerServiceWorker(navigator, import.meta.env.BASE_URL)
  }
}
