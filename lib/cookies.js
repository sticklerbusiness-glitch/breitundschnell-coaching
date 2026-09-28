// Cookie-Header selbst zerlegen: die Handler laufen als nackte Node-Funktionen,
// ein Framework mit req.cookies gibt es hier nicht.

/** Cookie-Header → { name: wert }. Bei doppeltem Namen gewinnt der erste. */
export function parseCookies(header) {
  const out = {};
  if (typeof header !== 'string' || !header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 1) continue;
    const name = part.slice(0, eq).trim();
    if (!name || Object.prototype.hasOwnProperty.call(out, name)) continue;
    let value = part.slice(eq + 1).trim();
    if (value.length > 1 && value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    try {
      value = decodeURIComponent(value);
    } catch {
      // Ein kaputt kodierter Wert bleibt, wie er ankam — ein JWT enthält ohnehin kein %.
    }
    out[name] = value;
  }
  return out;
}

export function cookieValue(header, name) {
  const v = parseCookies(header)[name];
  return v === undefined || v === '' ? null : v;
}
