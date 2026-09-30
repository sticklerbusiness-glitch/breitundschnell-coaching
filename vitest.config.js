// B&S: Was `npm test` im Wurzelverzeichnis läuft. Ohne diese Datei war es `vitest run --dir lib`
// — der Backend-Code. Die Regeln der Auslieferung (vercel.json, Service Worker, die kanonische
// Adresse) stehen aber im Frontend-Ordner und liefen damit in KEINEM Lauf, der irgendwo außer
// von Hand angestoßen wird: kein CI, kein Vercel-Build. Genau die Dateien, deren Fehler erst im
// Betrieb auffallen, waren so die ungeprüften.
//
// Aufgenommen werden nur Frontend-Tests OHNE DOM und ohne React: sie laufen in der
// Node-Umgebung dieses Laufs. Alles andere aus frontend/ bleibt bei
// `cd frontend && npx vitest run`.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'lib/**/*.test.js',
      'frontend/src/lib/deploy-config.test.js',
      'frontend/src/lib/sw.test.js',
      'frontend/src/lib/sw-register.test.js',
      'frontend/src/lib/canonical-host.test.js'
    ]
  }
});
