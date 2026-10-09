// Was an einer Mitgliedschaft in EINER Gemeinde hängt, geht mit ihr.
//
// Endet die Zugehörigkeit einer Person zu einer Gemeinde, gehen zwei Dinge
// dieser Gemeinde mit (Simon, 27.09.2026 — CLAUDE.md „Wer sieht und bekommt
// was": Rolle und Jahrgänge gelten je Gemeinde):
//   - ihre Jahrgangs-Zuweisungen in dieser Gemeinde — sonst gelten sie bei
//     einer erneuten Aufnahme sofort wieder, ohne dass jemand sie vergeben hat;
//   - ihre Plätze in ALLEN Chat-Räumen dieser Gemeinde. chat.js pusht an alle
//     chat_participants eines Raums, ohne auf die Gemeinde zu sehen; wer dort
//     sitzen bleibt, bekommt jede neue Nachricht aufs Handy. Die Syncs
//     (syncTeamChat, syncJahrgangChat) erfassen nur Team-Chat und Jahrgänge
//     mit Zuweisung — Gruppen, Zweierräume und Termin-Chats kennt keiner;
//   - ihre Mitteilungen aus dieser Gemeinde im Postfach (seit 27.09.2026,
//     Audit „Wer bekommt was" BF-13, Simon zu F-07: „ja"). Vorher las sie das
//     Postfach der alten Gemeinde weiter — Namen und Abmeldegründe von Konfis,
//     die sie nichts mehr angehen —, die Einträge zählten an Glocke und
//     App-Symbol, und Antippen wollte in eine Gemeinde wechseln, der sie
//     nicht mehr angehört. notifications.organization_id ist die Gemeinde
//     des Inhalts (utils/postfachArten.js). Eine entzogene
//     Jahrgangs-Zuweisung allein räumt das Postfach NICHT: Dort bleiben die
//     Mitteilungen als Verlauf (dieselbe Entscheidung).
// Alles in anderen Gemeinden bleibt unberührt.
//
// DREI WEGE führen dorthin, und sie liefen auseinander (Audit „Wer bekommt
// was" 27.09.2026, BF-08): Die Leitung beendet eine Zusatz-Mitgliedschaft
// (routes/users.js, DELETE /users/:id Fall 1), die Leitung entfernt eine
// hier beheimatete Person, die anderswo weiterarbeitet (users.js
// kontoZiehtUm), und der Super-Admin entzieht eine Mitgliedschaft
// (routes/organizations.js, DELETE /:id/members/:userId). Die ersten beiden
// räumten seit dem 27.09.2026 (Commit 1eec4910) je mit einer eigenen Kopie,
// der dritte gar nicht. Jetzt rufen alle drei diese Funktion.

/**
 * Entfernt Jahrgangs-Zuweisungen, Chat-Plätze und Postfach-Mitteilungen einer
 * Person in EINER Gemeinde. In der Transaktion des Aufrufers laufen lassen
 * (Client übergeben), zusammen mit dem Löschen der Mitgliedschaft selbst.
 *
 * @param {object} db              Client (in der Transaktion) oder Pool
 * @param {number|string} userId
 * @param {number|string} organizationId  die Gemeinde, deren Mitgliedschaft endet
 * @returns {Promise<{jahrgangIds: number[], chatPlaetze: number, mitteilungen: number}>}
 *   jahrgangIds: die Jahrgänge dieser Gemeinde, deren Zuweisung entfernt
 *   wurde (für syncJahrgangChat danach); chatPlaetze: Zahl der geräumten
 *   Plätze; mitteilungen: Zahl der entfernten Postfach-Einträge.
 */
async function gemeindeZugehoerigkeitRaeumen(db, userId, organizationId) {
  const { rows: jahrgaenge } = await db.query(
    `DELETE FROM user_jahrgang_assignments uja
      USING jahrgaenge j
      WHERE uja.jahrgang_id = j.id AND uja.user_id = $1 AND j.organization_id = $2
      RETURNING j.id`,
    [userId, organizationId]
  );
  const { rowCount: chatPlaetze } = await db.query(
    `DELETE FROM chat_participants cp
      USING chat_rooms r
      WHERE cp.room_id = r.id AND cp.user_id = $1 AND r.organization_id = $2`,
    [userId, organizationId]
  );
  const { rowCount: mitteilungen } = await db.query(
    'DELETE FROM notifications WHERE user_id = $1 AND organization_id = $2',
    [userId, organizationId]
  );
  return { jahrgangIds: jahrgaenge.map((r) => r.id), chatPlaetze, mitteilungen };
}

/**
 * HIER ZUHAUSE, ABER AUCH ANDERSWO MITGLIED: DAS KONTO ZIEHT UM (27.09.2026).
 *
 * Simon, 27.09.2026: "Ich muss jemanden, der in mehreren Organisationen ist,
 * in meiner loeschen koennen und dafuer sorgen, dass er dann nicht mehr in
 * meiner ist. [...] Die andere Institution oder Organisation muss dann den
 * Account behalten."
 *
 * Die Stamm-Gemeinde des Kontos wird eine der weiteren Gemeinden, mit der
 * Rolle, die es dort hat. Die Zeile dieser weiteren Gemeinde in
 * user_organizations geht (sie ist jetzt die Stamm-Gemeinde), ebenso eine
 * alte Stamm-Zeile der verlassenen Gemeinde (Migration 101 hat jede
 * Stamm-Gemeinde auch dort eingetragen -- sie ist KEINE weitere
 * Mitgliedschaft). Jahrgaenge, Chat-Plaetze und Postfach der verlassenen
 * Gemeinde gehen wie bei jedem Ende einer Mitgliedschaft
 * (gemeindeZugehoerigkeitRaeumen).
 *
 * Welche Gemeinde: zuerst eine, in der die Person nicht gesperrt ist
 * (Migration 196), dann eine aktive Gemeinde, dann die aelteste
 * Mitgliedschaft. Ist sie in der Zielgemeinde gesperrt (alle anderen
 * ebenso), ist danach das ganze Konto gesperrt -- die Sperre der anderen
 * Gemeinde gilt weiter.
 *
 * ZWEI WEGE rufen das: die Leitung entfernt eine hier beheimatete Person
 * (routes/users.js, DELETE /users/:id Fall 2) und der Super-Admin loescht
 * die ganze Gemeinde (routes/organizations.js, DELETE /:id) -- dort
 * verschwand ein solches Konto bis zum 29.09.2026 samt seiner Arbeit in der
 * anderen Gemeinde.
 *
 * In der Transaktion des Aufrufers laufen lassen; der Aufrufer sperrt die
 * Zeile in users vorher und leert danach Rechte-Cache und Sockets.
 *
 * @param {object} client  Client in der Transaktion
 * @param {number|string} userId
 * @param {number|string} organizationId  die Gemeinde, die das Konto verlaesst
 * @returns {Promise<null | {organization_id: number, role_id: number}>}
 *   die neue Stamm-Gemeinde und Rolle; null, wenn es keine weitere
 *   Mitgliedschaft gibt -- dann ist nichts geaendert.
 */
async function inWeitereGemeindeUmziehen(client, userId, organizationId) {
  const { rows: [ziel] } = await client.query(
    `SELECT uo.organization_id, uo.role_id, uo.role_title, uo.teamer_since, uo.is_active
       FROM user_organizations uo
       JOIN organizations o ON o.id = uo.organization_id
      WHERE uo.user_id = $1 AND uo.organization_id <> $2
      ORDER BY uo.is_active DESC,
               COALESCE(o.is_active, true) DESC,
               uo.created_at ASC NULLS LAST,
               uo.id ASC
      LIMIT 1`,
    [userId, organizationId]
  );
  if (!ziel) return null;

  // Felder je Gemeinde (08.10.2026, Migration 196): Funktionsbezeichnung und
  // "Teamer:in seit" der neuen Stamm-Gemeinde stehen ab jetzt am Konto.
  await client.query(
    `UPDATE users SET organization_id = $2, role_id = $3, role_title = $4, teamer_since = $5,
                      updated_at = NOW()
      WHERE id = $1`,
    [userId, ziel.organization_id, ziel.role_id, ziel.role_title, ziel.teamer_since]
  );
  // Die Zeile der neuen Stamm-Gemeinde geht -- es sei denn, die Person ist
  // dort gesperrt: Dann bleibt sie als Stamm-Zeile mit der Sperre stehen.
  // Ist die Person danach nirgends mehr frei, ist das Konto gesperrt.
  await client.query(
    'DELETE FROM user_organizations WHERE user_id = $1 AND organization_id = $2',
    [userId, organizationId]
  );
  if (ziel.is_active !== false) {
    await client.query(
      'DELETE FROM user_organizations WHERE user_id = $1 AND organization_id = $2',
      [userId, ziel.organization_id]
    );
  } else {
    await client.query(
      'UPDATE users SET is_active = false WHERE id = $1', [userId]);
  }
  await gemeindeZugehoerigkeitRaeumen(client, userId, organizationId);
  return { organization_id: Number(ziel.organization_id), role_id: Number(ziel.role_id) };
}

module.exports = { gemeindeZugehoerigkeitRaeumen, inWeitereGemeindeUmziehen };
