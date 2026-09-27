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
//     mit Zuweisung — Gruppen, Zweierräume und Termin-Chats kennt keiner.
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
 * Entfernt Jahrgangs-Zuweisungen und Chat-Plätze einer Person in EINER
 * Gemeinde. In der Transaktion des Aufrufers laufen lassen (Client übergeben),
 * zusammen mit dem Löschen der Mitgliedschaft selbst.
 *
 * @param {object} db              Client (in der Transaktion) oder Pool
 * @param {number|string} userId
 * @param {number|string} organizationId  die Gemeinde, deren Mitgliedschaft endet
 * @returns {Promise<{jahrgangIds: number[], chatPlaetze: number}>}
 *   jahrgangIds: die Jahrgänge dieser Gemeinde, deren Zuweisung entfernt
 *   wurde (für syncJahrgangChat danach); chatPlaetze: Zahl der geräumten Plätze.
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
  return { jahrgangIds: jahrgaenge.map((r) => r.id), chatPlaetze };
}

module.exports = { gemeindeZugehoerigkeitRaeumen };
