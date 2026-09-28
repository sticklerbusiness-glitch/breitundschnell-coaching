# Third-party notices · Herkunft der Fremdanteile

Diese Datei gehört zur **Trainings-App von Breit & Schnell**, einem Fork von **openGym**
v1.3.7 (Commit `a68a88d2da04cf3334eeeca136385114a65450ff`, siehe [`UPSTREAM_COMMIT`](UPSTREAM_COMMIT)).
Sie stammt aus openGym und ist für diesen Fork überarbeitet: was hier steht, beschreibt
**diesen** Stand, nicht den von openGym.

openGym — Copyright (C) 2026 Duarte Santos, **GNU AGPL v3.0** (siehe [LICENSE](LICENSE)).
Dieser Fork steht unter derselben Lizenz; die Änderungen der Breit und Schnell OG sind in
der [README](README.md#änderungshinweis-agpl-5a--modification-notice) aufgelistet.
Name, Logo, Icons und Fotos von Breit & Schnell sind davon **nicht** erfasst — siehe den
Abschnitt „Marken" in der README.

**Was davon im Browser landet:** die Lizenztexte der mitgelieferten Fremdanteile (Schriften,
Javascript-Bibliotheken) werden mit ausgeliefert und sind in der laufenden App unter
`/training/lizenzen.txt` abrufbar — Quelle: [`frontend/public/lizenzen.txt`](frontend/public/lizenzen.txt).
Diese Datei hier ist die ausführliche Fassung mit Herkunft und Begründung.

## Was in diesem Fork anders ist als bei openGym

- **Deutsche Übungsnamen und -anleitungen** (`frontend/src/instr/de.js`,
  `frontend/src/exercise-names/de.js`) sind **unsere** Arbeit: übersetzt aus dem
  MIT-lizenzierten englischen Text des Datensatzes (siehe unten). Sie sind ein
  abgeleitetes Werk dieses MIT-Textes und stehen wie der übrige Fork unter der AGPL.
  openGym hat kein deutsches Paket; die übrigen Sprachpakete sind hier entfernt.
- **Keine Generator-Skripte.** openGyms `scripts/build-instructions.mjs`,
  `scripts/instruction-sources/` und `scripts/exercise-name-sources/` gibt es in diesem
  Fork nicht (`frontend/scripts/` enthält nur Hilfsskripte für Build und Tests).
- **Medien werden nicht mitgeliefert, sondern verlinkt.** Bilder und Animationen kommen zur
  Laufzeit von jsDelivr (Festkomma-Commit, `frontend/vite.config.js`); im Repository und im
  Build liegt keine einzige Mediendatei.
- **Schriften kommen dazu** (Inter, Anton, selbst gehostet) — deshalb der neue Abschnitt
  „Schriften" gleich hier unten.
- **Entfernte Funktionen.** Gym-Check-in per QR-Code, die mobilen Capacitor-Builds, Web-Push,
  Passkeys/Registrierung, Demo-Modus und der KI-Coach sind raus. Die Abschnitte dazu bleiben
  weiter unten als Herkunftsnachweis stehen und sind als „nicht in diesem Fork" markiert.

## Schriften · Fonts — SIL Open Font License 1.1

Die Oberfläche benutzt zwei selbst gehostete Schriften (keine Anfrage an Google Fonts):

- **Inter** 400/500/600/700 — Copyright 2016 The Inter Project Authors
  (<https://github.com/rsms/inter>), Paket [`@fontsource/inter`](https://fontsource.org/fonts/inter)
- **Anton** 400 — Copyright 2020 The Anton Project Authors
  (<https://github.com/googlefonts/AntonFont.git>), Paket [`@fontsource/anton`](https://fontsource.org/fonts/anton)

Beide stehen unter der **SIL Open Font License, Version 1.1**. Deren §2 verlangt, dass
Urhebervermerk und Lizenztext **jede Kopie der Schrift begleiten** — die `.woff2`-Dateien
werden mit dem Build ausgeliefert, also reist der Text mit: vollständig in
[`frontend/public/lizenzen.txt`](frontend/public/lizenzen.txt) (in der laufenden App
`/training/lizenzen.txt`), im Original zusätzlich in
`frontend/node_modules/@fontsource/{inter,anton}/LICENSE`.

## Javascript-Bibliotheken im Bundle — MIT

React und React DOM (Meta Platforms, Inc.), React Router (React Training LLC / Remix
Software Inc. / Shopify Inc.) und Zustand (Paul Henschel) werden kompiliert mit
ausgeliefert, alle unter der **MIT License**. Urhebervermerke und Lizenztext stehen
gesammelt in [`frontend/public/lizenzen.txt`](frontend/public/lizenzen.txt).

## Body diagram geometry

The muscle outlines the body maps are drawn from (`frontend/src/lib/body-paths.js`) are derived
from [**MuscleMap**](https://github.com/melihcolpan/MuscleMap) by Melih Colpan, used under the
**MIT License** and reproduced below. MuscleMap ships its path data as Swift source rather than
`.svg` files; the paths were converted to a JSON module, its sub-group shapes were dropped, and
nothing else about the artwork was changed.

```
MIT License

Copyright (c) 2026 Melih Colpan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Übungsdaten & Medien · Exercise data & media

Beides kommt aus
[**hasaneyldrm/exercises-dataset**](https://github.com/hasaneyldrm/exercises-dataset) und ist
unterschiedlich lizenziert. Von der AGPL dieses Forks ist **keines von beiden** erfasst.

Der Datensatz ist selbst eine Weiterverbreitung: der Inhalt stammt aus
[**ExerciseDB v1**](https://exercisedb.dev/) von **AscendAPI**. Das ist aus den Daten selbst
nachvollziehbar — die Dateinamen der Medien tragen ExerciseDBs `exerciseId` (`0001` ist
`0001-2gPfomN.jpg`; `2gPfomN` ist ExerciseDBs Id für „3/4 sit-up"), jedes Metadatenfeld passt,
und die Anleitungssätze sind bis auf entfernte `Step:N `-Präfixe identisch. Siehe
[Issue #5](https://github.com/hasaneyldrm/exercises-dataset/issues/5) in jenem Datensatz.

### Metadaten & Anleitungstext

Die Übungsnamen, -attribute und -anleitungen (englisch in
`frontend/src/lib/exercises-data.js`) stammen aus ExerciseDB v1 und erreichen diesen Fork über
den Datensatz oben, der sie unter der unten abgedruckten **MIT-Lizenz** verbreitet. Die
**deutschen** Pakete (`frontend/src/instr/de.js`, `frontend/src/exercise-names/de.js`) sind
unsere Übersetzung dieses MIT-Textes — ein abgeleitetes Werk, das wie der übrige Fork unter der
AGPL steht (openGym hat kein deutsches Paket; die Behauptung der Originaldatei, alle
Übersetzungen seien openGyms Werk, trifft auf sie nicht zu).

```
MIT License

Copyright (c) 2026 Hasan Emir Yıldırım

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation and data files (the "Software"),
to deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Bilder & Animationen — weder MIT noch AGPL

Die Vorschaubilder (180×180) und die Animationen sind **nicht** von der MIT-Lizenz oben und
**nicht** von der AGPL gedeckt. Ihre Rechtelage ist **ungeklärt**, und das steht hier lieber
deutlich als geraten:

- Der Datensatz schreibt sie **© [Gym visual](https://gymvisual.com/)** zu, dort mit
  schriftlicher Erlaubnis des Rechteinhabers weiterverbreitet — eine Erlaubnis, die *jenem
  Datensatz* erteilt wurde und **nicht übertragbar** ist.
- **ExerciseDB/AscendAPI** bezeichnet sich als „original creator and owner" dieses Inhalts und
  veröffentlicht eigene [Bedingungen](https://exercisedb.io/faq), die Selbst-Hosten, Bündeln
  und gewerbliche Anzeige erlauben, die Weiterverbreitung des rohen Datensatzes oder der
  Medien als eigenständiges oder konkurrierendes Paket aber untersagen.

Diese beiden Angaben widersprechen einander. openGym hat um Klarstellung gebeten; dieser
Hinweis wird aktualisiert, sobald die Herkunft geklärt ist.

**So lange gilt: die Medien sind Inhalt Dritter, lizenziert weder an openGym noch an uns.**

**Dieser Fork verbreitet sie nicht weiter.** Sie liegen nicht im Repository, nicht in seiner
Historie und nicht im Build. Die App lädt sie zur Laufzeit von jsDelivr aus dem oben genannten
Datensatz (fester Commit, `frontend/vite.config.js`) — die IP-Adresse des Mitglieds erreicht
dabei jsDelivr, was in der Datenschutzerklärung der Website steht.

> **B&S, offener Punkt:** Für ein bezahltes Angebot ist ein angepinnter Commit eines
> Ein-Personen-Repositorys auf einem fremden CDN ein einzelner Ausfallpunkt für *jedes* Bild in
> der App — ohne Rückfallebene und ohne eigene Kopie. Der saubere Weg ist, die ~140 MB nach
> schriftlicher Freigabe durch AscendAPI/ExerciseDB selbst zu hosten (ihre Bedingungen erlauben
> genau das) und `VITE_IMG_BASE`/`VITE_GIF_BASE` auf den eigenen Speicher zu zeigen. Bis dahin
> bleiben die Attribution in den Einstellungen und der jsDelivr-Absatz in der
> Datenschutzerklärung stehen.

Wer die Medien weiterverwenden will — hier oder anderswo, gewerblich oder nicht —, **klärt das
vorher mit dem Rechteinhaber** und lässt jede mitgelieferte Attribution unangetastet.

---

# Nur zur Herkunft: Teile, die in diesem Fork NICHT enthalten sind

Die folgenden Abschnitte stammen unverändert aus openGyms NOTICE. Die beschriebenen Funktionen
sind in diesem Fork entfernt; die Absätze bleiben stehen, damit nachvollziehbar ist, was im
Ursprungsprojekt woher kam.

## App store exception (openGym — hier ungenutzt)

Dieser Fork wird ausschließlich als Website ausgeliefert, nicht über App-Stores.

As an additional permission under section 7 of the AGPL v3.0, the copyright holder permits
distribution of the openGym mobile application through app store platforms (such as the
Apple App Store and Google Play) whose terms of service would otherwise be incompatible
with the AGPL, provided the corresponding source code remains available under the AGPL at
the project repository. This permission applies to the distribution channel only and does
not otherwise limit the license.

## Brazilian Portuguese instructions (openGym — hier nicht enthalten)

openGyms brasilianisch-portugiesische Anleitungen (`scripts/instruction-sources/pt-BR.json`) und
Übungsnamen (`scripts/exercise-name-sources/pt-BR.json`) sind eigene Übersetzungen des
englischen MIT-Textes, erstellt mit Unterstützung von Sprachmodellen. In diesem Fork gibt es
weder die Dateien noch das Sprachpaket.

## Gym check-in QR codes (openGym — Funktion hier entfernt)

Das Gym-Check-in (gespeicherter Mitgliedscode als QR-Code) ist in diesem Fork nicht vorhanden.
Die drei Pakete stehen noch in `frontend/package.json` (`lean-qr`, `jsqr`,
`@capacitor-mlkit/barcode-scanning`), werden aber von keiner Datei mehr importiert und landen
damit auch nicht im Bundle. Die Angaben bleiben, so lange die Abhängigkeiten deklariert sind.

### QR/barcode rendering — `lean-qr`

[**lean-qr**](https://github.com/davidje13/lean-qr) von David Evans, **MIT License**:

```
MIT License

Copyright (c) 2021-2025 David Evans

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Camera scan & photo decode in the browser — `jsQR`

[**jsQR**](https://github.com/cozmo/jsQR) by Cosmo Wolfe, under the **Apache License
2.0** (text at <https://www.apache.org/licenses/LICENSE-2.0> and in the package's own `LICENSE`).

### Camera scan & photo decode in the app — `@capacitor-mlkit/barcode-scanning`

[**@capacitor-mlkit/barcode-scanning**](https://github.com/capawesome-team/capacitor-mlkit) by
the Capawesome Team (Robin Genz), a Capacitor wrapper around Google's ML Kit, under the
**Apache License 2.0** (text at <https://www.apache.org/licenses/LICENSE-2.0> and in the
package's own `LICENSE`). Die mobilen Builds gibt es in diesem Fork nicht.
