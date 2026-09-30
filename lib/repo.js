// Alle SQL-Zugriffe an einem Ort. Jede Funktion bekommt den sql-Client
// übergeben — damit hängt keine Logik an einer echten Datenbank und lässt
// sich mit einem Doppel testen.
//
// Die Tabellen gehören der Website (Prisma-Migrationen): "User" und
// "GymStand" mit Prisma-Standardnamen, also in Anführungszeichen.

export async function findUser(sql, id) {
  const rows = await sql`
    SELECT "id", "name", "rolle", "tokenVersion"
    FROM "User"
    WHERE "id" = ${id}
  `;
  return rows[0] || null;
}

export async function getStand(sql, userId) {
  const rows = await sql`
    SELECT "userId", "daten", "plan", "rev"
    FROM "GymStand"
    WHERE "userId" = ${userId}
  `;
  return rows[0] || null;
}

/**
 * Bedingtes Schreiben: nur, wenn die Revision noch die ist, die der Client
 * gelesen hat. Zwei Geräte, die gleichzeitig pushen, können sich so nicht
 * gegenseitig überschreiben — der Verlierer bekommt 409 und mergt.
 * @returns {Promise<number|null>} neue Revision, oder null wenn das Rennen verloren ging
 */
export async function updateDaten(sql, userId, daten, baseRev) {
  const rows = await sql`
    UPDATE "GymStand"
    SET "daten" = ${sql.json(daten)}, "rev" = "rev" + 1, "aktualisiertAm" = now()
    WHERE "userId" = ${userId} AND "rev" = ${baseRev}
    RETURNING "rev"
  `;
  return rows[0] ? rows[0].rev : null;
}

/**
 * Erste Zeile für dieses Mitglied. `aktualisiertAm` muss hier von Hand
 * gesetzt werden: @updatedAt füllt Prisma, nicht Postgres.
 * @returns {Promise<number|null>} null, wenn inzwischen doch jemand eine Zeile angelegt hat
 */
export async function insertStand(sql, userId, daten) {
  const rows = await sql`
    INSERT INTO "GymStand" ("userId", "daten", "rev", "aktualisiertAm")
    VALUES (${userId}, ${sql.json(daten)}, 1, now())
    ON CONFLICT ("userId") DO NOTHING
    RETURNING "rev"
  `;
  return rows[0] ? rows[0].rev : null;
}

/**
 * "Trainiert gerade"-Signal. Ohne rev-Erhöhung: das ist kein Dokumentstand.
 * B&S: Die App meldet sich alle 20 s; geschrieben wird höchstens alle `minGapMs`.
 * Sonst ist das der einzige Endpunkt ohne jede Selbstbegrenzung — ein Skript
 * mit gültigem Cookie könnte die gemeinsame Live-Datenbank im Sekundentakt
 * beschreiben. Ein WECHSEL (Training beendet) geht immer sofort durch, sonst
 * bliebe "trainiert gerade" beim Coach hängen.
 * `at` ist eine ISO-Zeit in UTC und lässt sich darum als Text vergleichen —
 * das spart einen Cast, der an einem alten kaputten Wert scheitern könnte.
 */
export async function setLive(sql, userId, live, minGapMs = 10000) {
  const jetzt = Date.now();
  const cutoff = new Date(jetzt - minGapMs).toISOString();
  const active = live?.active === true ? 'true' : 'false';
  // B&S: Der Wechsel-Zweig braucht eine eigene, KÜRZERE Pause — nicht gar keine.
  // Mit OR ohne Zeitbedingung war die Bremse durch abwechselndes true/false
  // vollständig zu umgehen, und genau dafür ist sie da. 2 s reichen, damit
  // „Training beendet“ praktisch sofort durchgeht; die Obergrenze liegt dann bei
  // 30 Schreibvorgängen pro Minute statt bei unbegrenzt.
  const wechselCutoff = new Date(jetzt - Math.min(2000, minGapMs)).toISOString();
  await sql`
    INSERT INTO "GymStand" ("userId", "daten", "live", "rev", "aktualisiertAm")
    VALUES (${userId}, '{}'::jsonb, ${sql.json(live)}, 0, now())
    ON CONFLICT ("userId") DO UPDATE
      SET "live" = EXCLUDED."live", "aktualisiertAm" = now()
      WHERE "GymStand"."live" IS NULL
         OR "GymStand"."live"->>'at' < ${cutoff}
         OR ("GymStand"."live"->>'active' IS DISTINCT FROM ${active}
             AND "GymStand"."live"->>'at' < ${wechselCutoff})
  `;
}

/**
 * Coach schreibt den Plan. rev zählt hoch, damit die App des Mitglieds nachlädt.
 * Ohne baseRev: bedingungsloses Upsert (letzter gewinnt).
 */
export async function savePlan(sql, userId, plan) {
  const rows = await sql`
    INSERT INTO "GymStand" ("userId", "daten", "plan", "rev", "aktualisiertAm")
    VALUES (${userId}, '{}'::jsonb, ${sql.json(plan)}, 1, now())
    ON CONFLICT ("userId") DO UPDATE
      SET "plan" = EXCLUDED."plan", "rev" = "GymStand"."rev" + 1, "aktualisiertAm" = now()
    RETURNING "rev"
  `;
  return rows[0] ? rows[0].rev : null;
}

/**
 * B&S: Wie savePlan, aber nur gegen die Revision, die der Coach geladen hat.
 * Beide Coaches sehen alle Mitglieder, und ein Editor-Tab lädt nie nach: ohne
 * diese Bedingung schreibt ein Tab vom Vormittag den ganzen Nachmittag des
 * anderen Coaches still weg (und zwei schnell aufeinander folgende Speicher-
 * vorgänge desselben Coaches können sich überholen).
 * @returns {Promise<number|null>} neue Revision, oder null wenn jemand anderes schneller war
 */
export async function savePlanAt(sql, userId, plan, baseRev) {
  if (baseRev === 0) {
    // B&S: Stand 0 heißt „noch kein Dokument“ — und das sind ZWEI Fälle: gar keine
    // Zeile, oder eine, die nur vom „trainiert gerade“-Signal stammt (setLive legt sie
    // mit rev 0 an, bevor das Mitglied das erste Mal gepusht hat). Ein reines
    // DO NOTHING hätte den zweiten Fall für immer als Konflikt gemeldet: der Coach
    // hätte für genau dieses Mitglied nie einen Plan speichern können.
    const rows = await sql`
      INSERT INTO "GymStand" ("userId", "daten", "plan", "rev", "aktualisiertAm")
      VALUES (${userId}, '{}'::jsonb, ${sql.json(plan)}, 1, now())
      ON CONFLICT ("userId") DO UPDATE
        SET "plan" = EXCLUDED."plan", "rev" = "GymStand"."rev" + 1, "aktualisiertAm" = now()
        WHERE "GymStand"."rev" = 0
      RETURNING "rev"
    `;
    return rows[0] ? rows[0].rev : null;
  }
  const rows = await sql`
    UPDATE "GymStand"
    SET "plan" = ${sql.json(plan)}, "rev" = "rev" + 1, "aktualisiertAm" = now()
    WHERE "userId" = ${userId} AND "rev" = ${baseRev}
    RETURNING "rev"
  `;
  return rows[0] ? rows[0].rev : null;
}
