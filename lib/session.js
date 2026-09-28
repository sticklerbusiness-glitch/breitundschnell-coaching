import { jwtVerify } from 'jose';
import { cookieValue } from './cookies.js';
import { findUser } from './repo.js';

// Dieselbe Sitzung wie auf der Website: Cookie bs_session, HS256 mit
// AUTH_SECRET, Claims sub / rolle / tv. Siehe website/src/lib/auth.ts —
// diese Prüfung muss dieselbe Antwort geben, sonst schieben sich beide
// Seiten den Besucher gegenseitig zum Login.

export const COOKIE_NAME = 'bs_session';

/**
 * Cookie → Claims, oder null. Prüft nur die Signatur, nicht die Datenbank.
 * `algorithms` ist Pflicht: ohne die Einschränkung akzeptiert jwtVerify auch,
 * was im Token-Header steht.
 */
export async function readClaims(cookieHeader, secretText) {
  const token = cookieValue(cookieHeader, COOKIE_NAME);
  if (!token || !secretText) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secretText), {
      algorithms: ['HS256']
    });
    if (typeof payload.sub !== 'string' || !payload.sub) return null;
    return {
      userId: payload.sub,
      rolle: payload.rolle === 'COACH' ? 'COACH' : 'TEILNEHMER',
      // Ältere Cookies kennen tv noch nicht — die zählen als Stand 0.
      tv: typeof payload.tv === 'number' ? payload.tv : 0
    };
  } catch {
    return null;
  }
}

/**
 * Der angemeldete User als DB-Zeile, oder null. Die Rolle kommt aus der
 * Datenbank, nicht aus dem Token: wer zum Coach wird (oder es nicht mehr ist),
 * soll das nicht 30 Tage lang im Cookie mit sich herumtragen.
 */
export async function sessionUser(req, sql, env = process.env) {
  const cookie = cookieValue(req?.headers?.cookie, COOKIE_NAME);
  const claims = await readClaims(req?.headers?.cookie, env.AUTH_SECRET);
  // B&S: Ein Cookie war da, ließ sich aber nicht prüfen. Meistens ist es
  // abgelaufen — wenn es ALLE trifft, ist AUTH_SECRET ein anderes als das der
  // Website. Genau das stand bisher nirgends, und von außen sieht beides gleich
  // aus (401). Die Antwort bleibt 401, der Hinweis steht im Log.
  if (cookie && !claims) console.warn('[gym-api] bs_session nicht prüfbar — AUTH_SECRET falsch oder Cookie abgelaufen');
  if (!claims) return null;
  const user = await findUser(sql, claims.userId);
  if (!user) return null;
  // Passwort seit dem Ausstellen geändert → Cookie verbraucht.
  if ((user.tokenVersion ?? 0) !== claims.tv) return null;
  return user;
}

export const isCoach = user => user?.rolle === 'COACH';
