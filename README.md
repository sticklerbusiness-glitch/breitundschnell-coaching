# Breit & Schnell — Trainings-App

Die Trainings-App des Online-Coachings von **Breit & Schnell** (Valentin & Ochuko). Mitglieder
sehen hier ihren Plan, loggen ihre Sätze und ihre Historie; die Coaches schreiben die Pläne.
Sie läuft unter `https://breitundschnell.de/training` neben der Website, die auf derselben
Domain unter `/` liegt und die Anmeldung besitzt (ohne Schrägstrich am Ende — warum, steht
unter „Deploy").

Diese App ist ein Fork von **[openGym](https://gitlab.com/DuarteSantos8/opengym)** v1.3.7
(Commit `a68a88d2da04cf3334eeeca136385114a65450ff`, siehe [`UPSTREAM_COMMIT`](UPSTREAM_COMMIT)),
Copyright (C) 2026 Duarte Santos, lizenziert unter der **GNU AGPL v3.0** (siehe [`LICENSE`](LICENSE)
und [`NOTICE.md`](NOTICE.md)). Dieser Fork steht unter derselben Lizenz.

## Änderungshinweis (AGPL §5a) · Modification notice

**Geändert am 2026-09-19 durch die Breit und Schnell OG.** Gegenüber openGym v1.3.7 wurde
verändert:

- **Marke und Gestaltung** — Name, Icons, Farben (Schwarz/Weiß mit Elektro-Blau `#2E6BFF`),
  Schriften (Inter, Anton, selbst gehostet), Service-Worker- und Manifest-Angaben.
- **Nur Deutsch** — die Oberfläche, die Übungsnamen und die Ausführungshinweise; die übrigen
  Sprachpakete sind entfernt.
- **Pläne gehören den Coaches** — `routines` und `week` liegen serverseitig und werden nur über
  `/api/trainer/plan` geschrieben. In der App der Mitglieder ist jeder Weg, der einen Plan
  verändern würde, entfernt oder gesperrt; Mitglieder loggen nur. Neu sind ein Plan-Editor für
  Coaches innerhalb der App, ein YouTube-Video und ein Coach-Tipp je Übung.
- **Eigenes Backend** — statt openGyms Node-Server mit Dateien auf der Platte läuft die API als
  Serverless-Functions auf Postgres (Supabase) und benutzt die bestehende Sitzung der Website
  (Cookie `bs_session`) statt einer eigenen Anmeldung.
- **Entfernt** — KI-Coach, Passkeys/Registrierung/Einladungen, Gast- und Demo-Modus, Admin-
  Oberfläche, Web-Push und Erinnerungen, Gym-Check-in, die mobilen Capacitor-Builds und die
  Kopplung mit einer Handy-App.

## Aufbau

```
gym-app/
├─ api/         Vercel-Functions: eine Datei = ein Endpunkt unter /training/api/*
├─ lib/         geteilter Servercode + Unit-Tests (kein Vercel-Function-Ordner!)
├─ frontend/    die SPA (React + Vite, base '/training/', HashRouter)
└─ vercel.json  Build, Rewrite /training/api/* → /api/*, Cache- und Sicherheits-Header
```

Die Datenbank gehört der Website: dort liegen die Prisma-Migrationen, hier wird nur SQL gegen
die Tabelle `"GymStand"` (und lesend gegen `"User"`) gesprochen. Ein Dokument je Mitglied,
geteilt in `daten` (gehört dem Mitglied) und `plan` (gehört den Coaches); `rev` zählt jede
Änderung, damit zwei Geräte sich nicht gegenseitig überschreiben.

## Lokal starten

**Node 24** (`.nvmrc`, `engines` in beiden `package.json`) — dieselbe Version, die Vercel baut.
Vite 8 verlangt mindestens 20.19 bzw. 22.12; mit einem älteren Node warnt jeder Build und
`npm ci` meldet `EBADENGINE`, das Ergebnis ist dann nicht mehr das, was live gebaut wird:

```bash
nvm install 24 && nvm use   # liest .nvmrc
```

Die App hat keine eigene Anmeldung — sie braucht die Website daneben:

```bash
cd ../website && npm run dev      # Terminal 1 → http://localhost:3000, dort einloggen
cd frontend && npm run dev        # Terminal 2 → http://localhost:5174/training/
```

Das Cookie `bs_session` gilt auf `localhost` portübergreifend; wer auf `:3000` angemeldet ist,
ist es auf `:5174` auch. Die Website spiegelt `/training/*` zusätzlich per Rewrite hierher
(`next.config.ts`), `http://localhost:3000/training/` funktioniert also genauso — und dort
landet eine Weiterleitung zum Login auf demselben Port. Der Vite-Dev-Server hängt die Handler
aus `api/` selbst unter `/training/api/*` ein
([`frontend/vite-api-dev.js`](frontend/vite-api-dev.js)) und liest
`DATABASE_URL` und `AUTH_SECRET` aus `../website/.env` — Zugangsdaten werden **nie** in dieses
Repository kopiert, es ist öffentlich.

Als Coach den Plan eines Mitglieds bearbeiten: `http://localhost:5174/training/?kunde=<userId>#/plan`.

> **Achtung:** `../website/.env` zeigt auf die **Live-Datenbank**. Beim lokalen Entwickeln
> schreibst du echte Daten.

## Tests

```bash
npm test                     # Backend + Auslieferung (vitest, ohne Datenbank)
cd frontend && npx vitest run    # Frontend
cd frontend && npx vite build    # Build (landet in frontend/dist/training/)
```

`npm test` im Wurzelverzeichnis ist `vitest run` mit der Liste aus [`vitest.config.js`](vitest.config.js):

- **`lib/`** — der geteilte Servercode. Die Handler unter `api/` haben keine eigenen
  Testdateien (Vercel baut jede Datei dort als Function, ein Test wäre ein Endpunkt); sie
  kommen über `lib/handlers.test.js` mit, und `lib/api-endpunkte.test.js` lädt jeden von
  ihnen einmal und verlangt einen Default-Export — das fängt vertippte Importe, die sonst
  erst in der Produktion 500 werfen.
- **die vier Tests der Auslieferung aus `frontend/src/lib/`** — `deploy-config.test.js`
  (Cache-, Sicherheits- und `Service-Worker-Allowed`-Header aus `vercel.json` gegen die
  Pfade, die wirklich angefragt werden), `sw.test.js` (führt `public/sw.js` in einer
  nachgebauten Worker-Umgebung aus), `sw-register.test.js`, `canonical-host.test.js`.
  Sie liegen im Frontend, gehören aber zur Auslieferung und liefen vorher in keinem Lauf
  außer einem von Hand angestoßenen.

Fünf Prüfungen in `deploy-config.test.js` greifen über die Verzeichnisgrenze nach `../website/`
(CSP zeichengleich mit `next.config.ts`, `X-Frame-Options`, kein doppelter
`Service-Worker-Allowed`, Nexts Schrägstrich-Regel, und dass der Mitgliederbereich `/training`
**ohne** Schrägstrich verlinkt). `website/` ist ein **eigenes Git-Repository** — in einem
frischen Klon dieses Repos liegt es nicht daneben, dann werden die fünf **sichtbar
übersprungen** (`↓` im Protokoll, nicht grün). Wer die CSP ändert, ändert sie in beiden
Dateien und lässt `npm test` einmal dort laufen, wo beide Verzeichnisse nebeneinander liegen.

Der Build stempelt den Service Worker mit dem Build-Hash **und** mit der Liste aller gebauten
Dateien (`__BUILD__`, `__ASSETS__`) und **bricht ab**, wenn eines davon nicht klappt (früher
lief er still durch und lieferte einen Worker mit Platzhalter-Cachenamen aus).

## Umgebungsvariablen

Siehe [`.env.example`](.env.example). Im Vercel-Projekt gesetzt werden müssen:

| Variable | Pflicht | Bedeutung |
|---|---|---|
| `DATABASE_URL` | ja | Supabase Postgres, Transaction Pooler (Port 6543). `pgbouncer` und `connection_limit` werden beim Verbinden entfernt. |
| `AUTH_SECRET` | ja | zeichengleich mit der Website — damit ist das Sitzungs-Cookie signiert. |
| `GYM_ALLOWED_ORIGINS` | nein | kommagetrennt; Default `https://breitundschnell.de,https://www.breitundschnell.de` (im Dev zusätzlich `localhost:3000` und `:5174`). |
| `VITE_SOURCE_URL` | nein | Ziel des „Quellcode“-Links im AGPL-Hinweis der Einstellungen. |
| `VITE_IMG_BASE`, `VITE_GIF_BASE` | nein | Übungsbilder/-animationen; Default ist das CDN des Datensatzes. **Wer sie auf eigenen Speicher umstellt, muss den neuen Host in die `img-src`/`media-src` der CSP eintragen** — in `vercel.json` *und* zeichengleich in `website/next.config.ts`. |

## Marken · Trademarks

„Breit & Schnell", das Logo, die Icons und die Fotos in diesem Verzeichnis sind Marken- und
Bildrechte der **Breit und Schnell OG**. Die AGPL gilt für den Quellcode und erteilt keine
Rechte an Marken (AGPL §7 lit. e). Wer diesen Code weiterverwendet, tauscht Name, Logo und
Icons bitte gegen eigene aus und erweckt nicht den Eindruck, das Angebot käme von uns oder
werde von uns unterstützt.

"Breit & Schnell", the logo, the icons and the photos in this repository are trademarks and
image rights of **Breit und Schnell OG**. The AGPL covers the source code and grants no
trademark rights (AGPL §7(e)). If you reuse this code, please replace the name, logo and icons
with your own and do not suggest that your service comes from us or is endorsed by us.

## Quellcode · Source

Dieses Verzeichnis IST der Quellcode der laufenden Version unter
`https://breitundschnell.de/training` — der Link dorthin steht in der App unter
Einstellungen (AGPL §13). Er wird über die Build-Variable `VITE_SOURCE_URL` gesetzt;
Standard ist `https://github.com/sticklerbusiness-glitch/breitundschnell-coaching`.
Der Link muss nach dem ersten Push **öffentlich** erreichbar sein — einmal abgemeldet im
Browser öffnen, sonst steht in der App ein §13-Angebot, das ins Leere zeigt.

Die Lizenztexte der mitgelieferten Fremdanteile (Schriften, Bibliotheken) werden
mitausgeliefert: [`frontend/public/lizenzen.txt`](frontend/public/lizenzen.txt) →
`/training/lizenzen.txt`. Herkunft und Begründung stehen in [`NOTICE.md`](NOTICE.md).

## Deploy

Eigenes Vercel-Projekt (Region `dub1`), Einstellungen stehen in [`vercel.json`](vercel.json):
`npm --prefix frontend run build` → `frontend/dist`, die SPA liegt darin unter `training/`.
Die Website leitet `/training/*` per Rewrite in ihrer `next.config.ts` hierher — dadurch ist
alles eine Domain und dasselbe Cookie. Die Migration für die Tabelle `GymStand` läuft im
Website-Repo, nicht hier.

### Die eine richtige Adresse: `/training` OHNE Schrägstrich

Next steht auf `trailingSlash: false` und leitet **jeden** Pfad mit Schrägstrich am Ende per
internem 308 auf die Fassung ohne um — und zwar bevor der Rewrite greift. `/training/` wird
also immer zu `/training`, egal was verlinkt ist. Daraus folgt dreierlei, und alle drei Punkte
sind so gelöst, dass sie unter **beiden** Schreibweisen funktionieren:

| Was | Warum | Wo gelöst |
|---|---|---|
| Icon-Pfade | relative `icon-180.png` würden unter `/training` gegen den Domain-Stamm aufgelöst (404, „Zum Home-Bildschirm" bekäme auf iOS einen Screenshot) | `frontend/index.html` — absolute `%BASE_URL%`-Pfade |
| Service-Worker-Geltungsbereich | der Worker liegt unter `/training/sw.js`, sein Standardbereich ist `/training/` — die Seite unter `/training` fällt heraus, der Worker lädt 2,6 MB und kontrolliert nie etwas | Header `Service-Worker-Allowed: /training` in `vercel.json` + `scope` in `frontend/src/lib/sw-register.js` |
| Zweitkopie auf `*.vercel.app` | dieselbe App ohne Sitzung, mit eigenem Worker und eigenem localStorage | `frontend/src/lib/canonical-host.js` leitet im Browser auf die echte Domain um (`?direkt=1` hängt das für die Sitzung aus); serverseitig geht das nicht, weil genau über diese Adresse der Rewrite läuft |

Umgeleitet werden **nur die eigenen Adressen des Gym-Projekts**
(`breitundschnell-coaching*.vercel.app`), nicht jedes `*.vercel.app`: eine **Preview der
Website** liefert `/training` über denselben Rewrite wie live aus und ist die einzige Stelle,
an der sich diese Naht vor dem Livegang prüfen lässt — eine Umleitung von dort schickte den
Prüfenden unbemerkt auf die Produktion. Damit das funktioniert, muss `GYM_URL` im
Vercel-Projekt der Website auch für die Umgebung **„Preview"** gesetzt sein; sonst gibt es dort
keine Rewrite-Regel und `/training` antwortet 404. Wird das Gym-Projekt bei Vercel umbenannt,
gehört der neue Name in `canonical-host.js` (dann leitet bis dahin nichts um — die App
funktioniert, die Zweitkopie bleibt nur erreichbar).

Und ein vierter Punkt, der nur dadurch keiner ist, dass `vercel.json` ihn in Ruhe lässt:
`trailingSlash` steht dort **nicht** — Vercels Voreinstellung liefert `/training` und
`/training/` beide mit 200 aus. Wer dort `"trailingSlash": false` einträgt, baut eine
Endlosschleife: die Website fragt über den Rewrite immer `${GYM_URL}/training/` an, das
Gym-Projekt antwortete dann mit 308 auf `/training`, der Browser landet wieder auf
`breitundschnell.de/training`, der Rewrite fragt wieder `/training/` an. Ein Test hält das
fest (`deploy-config.test.js`).

Und weil das die eine richtige Adresse ist, verlinkt die Website sie auch so: `/training` ohne
Schrägstrich in `website/src/app/app/` (Reiter „Training", der Knopf auf „Heute", die Weiche
`/app/training`). Mit Schrägstrich antwortet Next 308, der Service Worker fängt die Navigation
ab und bekommt wegen `redirect: 'manual'` eine `opaqueredirect`-Antwort, der Browser folgt und
fragt `/training` erneut an — eine zusätzliche Runde durch den Proxy bei jedem App-Start. Auch
das hält ein Test fest (er wird übersprungen, wenn `website/` nicht daneben liegt). Die zwei
Coach-Links aus dem Admin-Bereich (`/training/?kunde=<id>#/plan`) tragen ihn noch.

**Abnahmetest nach dem Deploy** (in der Konsole auf `https://breitundschnell.de/training`,
nach einem Reload):

```js
navigator.serviceWorker.controller !== null                         // muss true sein
(await navigator.serviceWorker.getRegistrations()).map(r => r.scope) // genau EINE, endet auf /training
```

Die zweite Zeile gehört dazu, weil `sw-register.js` genau zwei Wege kennt: den weiten Bereich
`/training` (richtig) und — **nur** wenn der Browser ihn mit `SecurityError` verbietet, der
Header also nicht durch den Rewrite-Proxy kam — ersatzweise den Standardbereich `/training/`.
Steht da eine Registrierung, die auf `/training/` endet, fehlt der Header. Bei jedem anderen
Fehler (Netz weg, 502 vom Proxy) wird **nicht** ersatzweise registriert: sonst hinge nach
einem schlechten WLAN für immer eine zweite Registrierung an der Domain, die bei jedem Deploy
den Precache ein zweites Mal über Mobilfunk lädt. Eine so entstandene alte enge Registrierung
meldet `sw-register.js` ab, sobald die weite steht.

Kommt der Header nicht durch, kostet das **zweierlei**: keinen Offline-Modus (die Seite unter
`/training` hat keinen Controller) **und** die Pausen-Benachrichtigung zwischen den Sätzen —
`store/useUI.js` holt sich dafür `registration.showNotification`, weil Android Chrome den
`Notification`-Konstruktor verbietet (`Illegal constructor`); ohne Registrierung fällt sie
stumm aus.

**Was der Worker vorab lädt:** alle Dateien des Builds (~2,6 MB, die Liste setzt
`vite.config.js` beim Build in `sw.js` ein), nicht nur die in der `index.html` verlinkten. Die
deutsche Oberfläche, die Übungsnamen und die Ausführungshinweise sind eigene, nachgeladene
Chunks — ohne sie stünde ein Mitglied nach einem Deploy offline vor einer englischen
Oberfläche (`lib/i18n.js` fällt still auf ein leeres Wörterbuch zurück). Beim `activate`
räumt der Worker nur Caches mit dem Präfix `bs-training-` weg: `caches.keys()` gilt für die
ganze Domain, und die Website liegt auf derselben.

### Header in `vercel.json`

- **Sicherheit, für alles:** `Content-Security-Policy` (self + `cdn.jsdelivr.net` für die
  Übungsbilder + `youtube-nocookie.com` als einziger erlaubter iframe + `api.hevyapp.com` für
  den Hevy-Import + Inline-Styles der App), `X-Frame-Options: DENY` und `frame-ancestors 'none'`
  — sonst könnte eine fremde Seite `/training?kunde=<id>` in einen iframe legen und einen
  angemeldeten Coach in ein Plan-Speichern klicken lassen —, dazu `X-Content-Type-Options`,
  `Referrer-Policy: same-origin` und `X-Robots-Tag: noindex` (die App steckt hinter dem Login,
  in der Suche hat sie nichts verloren — und die Zweitkopie unter `*.vercel.app` erst recht nicht).
  Dieselbe CSP steht zeichengleich in `website/next.config.ts`, damit sie gilt, egal welche
  Schicht beim gleichen Header-Namen gewinnt; ein Test vergleicht die beiden Zeichenketten.
- **Cache:** alles unter `/training/assets/` trägt den Inhalts-Hash im Namen und wird ein Jahr
  `immutable` ausgeliefert (sonst revalidiert jeder App-Start ~25 Dateien über den Proxy);
  die ungehashten Dateien aus `frontend/public/` (die drei Icons, `lizenzen.txt`) einen Tag —
  ohne eigene Regel gilt für sie Vercels Voreinstellung `max-age=0, must-revalidate` und jeder
  App-Start schickt bedingte Anfragen quer durch den Proxy. Ein Test verlangt für **jede**
  Datei aus `public/` eine Regel, damit eine neue nicht wieder durchfällt. `sw.js` und die
  Hülle (`/training`, `/training/`, `/training/index.html` — je nach Weg kommt ein anderer
  Pfad an) nie aus dem Cache.

---

## English (short)

The training app of **Breit & Schnell**, an online coaching business. It is a fork of
**openGym** v1.3.7 (commit `a68a88d2da04cf3334eeeca136385114a65450ff`) by Duarte Santos,
licensed under the **GNU AGPL v3.0**; this fork keeps that licence.

**Modification notice (AGPL §5a): modified on 2026-09-19 by Breit und Schnell OG.** Changes:
rebranding (name, icons, colours, fonts); German-only UI, exercise names and instructions;
training plans are owned by the coaches on the server (members log, they do not edit plans),
with an in-app plan editor for coaches plus a YouTube video and a coach tip per exercise; a new
backend — serverless functions on Postgres reusing the website's session cookie instead of
openGym's file-based Node server and its own sign-in; removed: AI coach, passkeys/registration/
invites, guest and demo mode, admin UI, web push, gym check-in and the Capacitor mobile builds.

Run it locally: start the website on `:3000` and sign in there, then `cd frontend && npm run dev`
and open `http://localhost:5174/training/`. The dev server mounts the handlers from `api/` and
reads `DATABASE_URL` and `AUTH_SECRET` from `../website/.env` — no secret is ever copied into
this repository. Tests: `npm test` (backend) and `npx vitest run` in `frontend/`.
