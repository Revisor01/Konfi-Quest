// Zugriffsregel fuer Socket-Raeume im Chat.
//
// Ueber den Socket-Raum `room_<id>` verteilt chat.js das vollstaendige
// Nachrichtenobjekt (newMessage, pollUpdated, reactionAdded, messageDeleted)
// sowie die Tipp-Anzeige. Geprueft wurde beim Beitritt bisher NUR die
// Organisation — jeder angemeldete Nutzer derselben Gemeinde konnte damit
// jedem Raum beitreten und alle neuen Nachrichten mitlesen, auch fremde
// Direktchats (Befund 23.08.2026).
//
// Die Regel entspricht der der HTTP-Routen in routes/chat.js:
//   - Raum muss zur aktiven Organisation des Nutzers gehoeren
//   - Leitung/Admins (type 'admin', also admin | org_admin | super_admin)
//     duerfen org-weit, ohne Teilnehmerschaft
//   - alle anderen muessen Teilnehmer:in des Raums sein
//
// user_type ist dabei dreiwertig ('admin' | 'teamer' | 'konfi') und muss exakt
// dem Wert in chat_participants entsprechen — ein Teamer, der als 'admin'
// gesucht wird, findet seinen eigenen Raum nicht.

/**
 * Prueft, ob ein Nutzer den Socket-Raum eines Chats betreten darf.
 *
 * @param {object} db    Pool oder Client mit .query
 * @param {number} roomId
 * @param {{id:number, organization_id:number, type:string}} user
 * @returns {Promise<{ok:boolean, grund?:string}>}
 */
async function darfRaumBetreten(db, roomId, user) {
  if (!user || !Number.isInteger(Number(roomId))) {
    return { ok: false, grund: 'ungueltige Anfrage' };
  }

  const { rows: [raum] } = await db.query(
    'SELECT organization_id FROM chat_rooms WHERE id = $1',
    [roomId]
  );
  if (!raum) return { ok: false, grund: 'nicht gefunden' };

  if (raum.organization_id !== user.organization_id) {
    return { ok: false, grund: `Org-Isolation (Raum-Org ${raum.organization_id})` };
  }

  if (user.type === 'admin') return { ok: true };

  const { rows: [teilnehmer] } = await db.query(
    'SELECT 1 FROM chat_participants WHERE room_id = $1 AND user_id = $2 AND user_type = $3',
    [roomId, user.id, user.type]
  );
  if (!teilnehmer) return { ok: false, grund: 'kein Teilnehmer' };

  return { ok: true };
}

module.exports = { darfRaumBetreten };
