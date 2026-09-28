// Nur für die lokale Entwicklung: der Vite-Plugin liest DATABASE_URL und
// AUTH_SECRET aus ../website/.env, damit dieselben Zugangsdaten an genau
// einer Stelle liegen. Geheimnisse werden NIE in die gym-app kopiert.

/** .env-Text → { KEY: VALUE }. Versteht Kommentare, export und Anführungszeichen. */
export function parseEnvFile(text) {
  const out = {};
  if (typeof text !== 'string') return out;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(trimmed);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.length > 1 && value.endsWith(quote)) {
      value = value.slice(1, -1);
      if (quote === '"') value = value.replace(/\\n/g, '\n');
    } else {
      // Unquoted: alles ab einem freistehenden # ist Kommentar.
      const hash = value.indexOf(' #');
      if (hash >= 0) value = value.slice(0, hash).trim();
    }
    out[key] = value;
  }
  return out;
}

/** Werte übernehmen, ohne schon Gesetztes zu überschreiben. */
export function applyEnv(target, values, keys) {
  for (const key of keys) {
    if (!target[key] && values[key]) target[key] = values[key];
  }
  return target;
}
