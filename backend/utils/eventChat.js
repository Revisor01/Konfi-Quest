// eventChat.js — Mitgliedschaft im Event-Chat, gekoppelt an die Event-Teilnahme.
//
// Regel: Wer am Termin teilnimmt, ist im Chat dazu. Wer sich abmeldet, fliegt
// raus. Das Anlegen des Chats bleibt eine bewusste Handlung der Leitung
// (POST /events/:id/chat) — hier geht es nur um die Mitgliedschaft in einem
// bereits bestehenden Chat.
//
// Befund 24.08.2026: Diese Regel stand als kopierter Block an genau EINER von
// vier Abmelde-Routen — ausgerechnet nicht in der, die die Konfi-App benutzt.
// Konfis blieben nach der Abmeldung im Chat und lasen dort weiter mit. Manuell
// verlassen konnten sie ihn auch nicht: chat.js verweigert das mit dem Hinweis,
// Event-Chats verlasse man ueber die Abmeldung. Genau die tat es nicht.
//
// user_type muss dem Wert entsprechen, mit dem spaeter gelesen wird:
// konfi -> 'konfi', teamer -> 'teamer', org_admin/admin -> 'admin'
// (dieselbe Abbildung wie in jahrgangChat.js).

/**
 * Entfernt eine Person aus allen Chat-Raeumen eines Termins.
 * Idempotent: Ist sie nicht drin, passiert nichts.
 *
 * @param {object} db   Pool ODER Client (muss .query haben). Innerhalb einer
 *                      Transaktion den Client uebergeben.
 * @param {number} eventId
 * @param {number} userId
 * @param {number} organizationId
 * @returns {Promise<number>} Anzahl entfernter Mitgliedschaften.
 */
async function removeFromEventChat(db, eventId, userId, organizationId) {
  const { rowCount } = await db.query(
    `DELETE FROM chat_participants
     WHERE user_id = $1
       AND room_id IN (
         SELECT id FROM chat_rooms WHERE event_id = $2 AND organization_id = $3
       )`,
    [userId, eventId, organizationId]
  );
  return rowCount;
}

module.exports = { removeFromEventChat };
