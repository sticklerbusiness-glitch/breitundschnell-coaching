import { json, methodNotAllowed, fail } from '../lib/http.js';

// Die Fähigkeiten dieser Instanz — der Client fragt das vor dem Login.
// Kein `coach`-Schlüssel: daran hängt bei openGym die gesamte KI-Coach-
// Oberfläche, und die bleibt aus.
//
// B&S: `whatsapp` ist der Draht zum Coach — eine Nummer, die NICHT im Code steht.
// Dieses Repository ist öffentlich; die Nummer kommt aus der Umgebung des
// Vercel-Projekts (WHATSAPP_NUMMER). Ist sie nicht gesetzt, fehlt der Schlüssel,
// und die App zeigt gar nichts an — ein Knopf auf wa.me ohne Nummer führt bei
// WhatsApp auf eine Fehlerseite und sieht aus wie ein kaputtes Produkt.
export function whatsappNummer(env = process.env) {
  const ziffern = String(env.WHATSAPP_NUMMER || '').replace(/\D/g, '');
  return ziffern.length >= 8 ? ziffern : null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    const nummer = whatsappNummer();
    json(res, 200, {
      invite_only: true,
      allow_guest: false,
      trainer_disabled: true,
      ...(nummer ? { whatsapp: nummer } : {})
    });
  } catch (err) {
    fail(res, err);
  }
}
