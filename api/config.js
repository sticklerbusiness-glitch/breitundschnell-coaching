import { json, methodNotAllowed, fail } from '../lib/http.js';

// Die Fähigkeiten dieser Instanz — der Client fragt das vor dem Login.
// Kein `coach`-Schlüssel: daran hängt bei openGym die gesamte KI-Coach-
// Oberfläche, und die bleibt aus (die Website hat ihren eigenen Chat).
export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    json(res, 200, { invite_only: true, allow_guest: false, trainer_disabled: true });
  } catch (err) {
    fail(res, err);
  }
}
