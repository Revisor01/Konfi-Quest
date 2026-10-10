// Der Stand einer Umfrage fuer das Socket-Ereignis 'pollUpdated' -- EINE
// Stelle fuer alle, die ihn senden: die Stimme (POST /chat/polls/:id/vote),
// das Aufdecken von Hand (POST /chat/polls/:id/aufdecken) und das Aufdecken
// durch den Ablauf (Hintergrund-Lauf `umfrage_namen`).
//
// Warum der Ablauf einen Lauf braucht (10.10.2026): Was fuer eine Umfrage
// gilt, wird beim Lesen ausgewertet (utils/umfrageRegeln.js) -- nach
// expires_at gelten die Namen als aufgedeckt. Ein offener Chat bekam davon
// aber nichts mit, weil niemand ein Ereignis sendete; die Namen erschienen
// erst nach dem Neuladen. Der Lauf setzt namen_aufgedeckt_at auf expires_at
// (am Lesen aendert das nichts: aufgedeckt ist sie dann so oder so, mit
// demselben Zeitpunkt) und nutzt die Spalte zugleich als Merker, dass der
// Stand schon verschickt ist. Wer die Zeile im UPDATE setzt, sendet; ein
// zweiter Lauf (andere Replica) findet sie nicht mehr.
//
// Die Store-Apps kennen 'pollUpdated' und ersetzen damit Stimmen und
// `anonymous` der Nachricht -- sie sehen die Namen also ebenfalls sofort.

const { umfrageFelder } = require('./umfrageRegeln');

// Stimmen einer Umfrage fuer die Auslieferung aufbereiten.
//
// Bei anonymen Umfragen wurde bisher nur der Name weggelassen, user_id und
// user_type aber weiterhin je Stimme mitgeliefert. Ueber die Teilnehmerliste
// (GET /rooms/:id/participants) liess sich daraus aufloesen, wer was gewaehlt
// hat -- die zugesagte Anonymitaet war nur kosmetisch (Befund 23.08.2026).
//
// Das Frontend braucht die Kennung ausschliesslich, um die EIGENE Stimme zu
// markieren (MessageBubble: vote.user_id === user.id && vote.user_type ===
// user.type). Deshalb wird bei anonymen Umfragen nur noch die eigene Stimme
// mit Kennung ausgeliefert; fremde zaehlen anonym mit.
const stimmenAufbereiten = (rawVotes, anonym, empfaengerId, empfaengerTyp) =>
  rawVotes.map(v => {
    const eigene = v.user_id === empfaengerId && v.user_type === empfaengerTyp;
    if (!anonym) {
      return {
        user_id: v.user_id,
        user_type: v.user_type,
        option_index: v.option_index,
        user_name: v.voter_name,
      };
    }
    return {
      user_id: eigene ? v.user_id : null,
      user_type: eigene ? v.user_type : null,
      option_index: v.option_index,
      user_name: undefined,
    };
  });

/**
 * Den aktuellen Stand einer Umfrage einsammeln -- dieselbe Form wie in
 * GET /chat/rooms/:id/messages: options als Array, anonymitaets-bewusste
 * Stimmen. Broadcast an den ganzen Raum: Es gibt keinen einzelnen
 * Empfaenger, also wird keine "eigene" Stimme markiert; bei anonymen
 * Umfragen fallen alle Kennungen weg.
 *
 * @returns {Promise<object|null>} null, wenn es die Umfrage nicht gibt
 */
async function umfrageStandLaden(db, pollDbId) {
  const { rows: [poll] } = await db.query(
    `SELECT p.id, p.message_id, p.question, p.options, p.multiple_choice,
            p.anonymous, p.exclusive_options, p.expires_at,
            p.einmalige_antwort, p.namen_spaeter, p.namen_aufgedeckt_at
     FROM chat_polls p WHERE p.id = $1`,
    [pollDbId]
  );
  if (!poll) return null;

  const { rows: rawVotes } = await db.query(
    `SELECT v.user_id, v.user_type, v.option_index, u.display_name as voter_name
     FROM chat_poll_votes v
     LEFT JOIN users u ON v.user_id = u.id
     WHERE v.poll_id = $1`,
    [pollDbId]
  );

  let parsedOptions = [];
  try { parsedOptions = JSON.parse(poll.options); } catch (e) { parsedOptions = []; }
  // Wirksame Anonymitaet: Bei "Namen spaeter" bis zum Aufdecken anonym
  // (utils/umfrageRegeln.js) -- auch im Live-Update keine Namen.
  const felder = umfrageFelder(poll);

  return {
    poll_id: poll.id,
    message_id: poll.message_id,
    question: poll.question,
    options: parsedOptions,
    multiple_choice: Boolean(poll.multiple_choice),
    anonymous: felder.anonymous,
    exclusive_options: Boolean(poll.exclusive_options),
    expires_at: poll.expires_at,
    einmalige_antwort: felder.einmalige_antwort,
    namen_spaeter: felder.namen_spaeter,
    namen_aufgedeckt: felder.namen_aufgedeckt,
    namen_aufgedeckt_at: felder.namen_aufgedeckt_at,
    votes: stimmenAufbereiten(rawVotes, felder.anonymous, null, null),
  };
}

/**
 * Den Stand per 'pollUpdated' an den Raum senden. Ohne io (Tests) still;
 * wirft nie -- ein Live-Update ist Beiwerk.
 */
async function umfrageStandSenden(io, db, pollDbId, roomId) {
  if (!io) return;
  try {
    const poll = await umfrageStandLaden(db, pollDbId);
    if (!poll) return;
    io.to(`room_${roomId}`).emit('pollUpdated', {
      roomId: parseInt(roomId, 10),
      messageId: poll.message_id,
      poll,
    });
  } catch (emitErr) {
    console.error('Failed to emit pollUpdated:', emitErr);
  }
}

/**
 * Umfragen mit "Namen spaeter", deren Ablauf vorbei ist und die noch nicht
 * aufgedeckt sind: aufdecken (namen_aufgedeckt_at = expires_at) und den
 * neuen Stand an den Raum senden. Atomar -- jede Umfrage genau einmal.
 *
 * @returns {Promise<number>} wie viele Umfragen aufgedeckt wurden
 */
async function abgelaufeneNamenAufdecken(db, io) {
  const { rows } = await db.query(
    `UPDATE chat_polls p
     SET namen_aufgedeckt_at = p.expires_at
     FROM chat_messages m
     WHERE m.id = p.message_id
       AND p.namen_spaeter = true
       AND p.namen_aufgedeckt_at IS NULL
       AND p.expires_at IS NOT NULL
       AND p.expires_at <= NOW()
     RETURNING p.id, m.room_id`
  );
  for (const r of rows) {
    await umfrageStandSenden(io, db, r.id, r.room_id);
  }
  return rows.length;
}

module.exports = { stimmenAufbereiten, umfrageStandLaden, umfrageStandSenden, abgelaufeneNamenAufdecken };
