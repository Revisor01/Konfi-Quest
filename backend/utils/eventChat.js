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
// Event-Chats verlasse man über die Abmeldung. Genau die tat es nicht.
//
// NUR BESTAETIGTE KOMMEN HINEIN (Simon, 27.09.2026, F-11 im Bericht "Wer
// bekommt was", BF-17): "Bestätigte ja, Wartende erst beim Nachrücken;
// Abgemeldete nicht." Vom 24.08. bis hierher kam JEDE Buchung hinein -- beim
// Anlegen alles ausser 'cancelled' (also auch Warteliste, 'opted_out' und
// 'excused'), danach jede neue Buchung samt Warteliste. Das Handbuch sagte
// seit jeher "Wer auf der Warteliste steht, ist nicht dabei".
//
// Die Regel steht deshalb an EINER Stelle, in den beiden Eintrittswegen
// unten: addToEventChat und syncEventChat nehmen nur auf, wer eine
// BESTAETIGTE Buchung hat. Die Aufrufer (Anmelden, Eintragen durch die
// Leitung, Nachruecken, Zusage des Teams, Pflicht-Automatik, Wieder-
// anmelden) muessen dafuer nichts wissen: Sie rufen wie bisher nach dem
// Schreiben der Buchung, und wer auf der Warteliste landet, bleibt draussen,
// bis promoteFromWaitlist ihn bestaetigt und hier erneut ruft.
//
// Wer auf die Warteliste ZURUECKGESETZT wird, geht wieder hinaus
// (routes/events/teilnehmer.js) -- er ist dann ein Wartender wie jeder
// andere. Die Pflicht-Abmeldung (opt-out) bleibt, wie am 24.08.2026
// entschieden, im Chat, wenn sie schon drin war ("der Termin betrifft einen
// ja weiter"); neu hinein kommt eine Abgemeldete nicht.
//
// user_type muss dem Wert entsprechen, mit dem später gelesen wird:
// konfi -> 'konfi', teamer -> 'teamer', org_admin/admin -> 'admin'
// (dieselbe Abbildung wie in jahrgangChat.js).

// DIE ROLLE DER GEMEINDE DES TERMINS (Simon, 08.10.2026,
// docs/planung/mehrfach-konten.md Punkt 1). Bis dahin kam der Typ aus der
// Rolle am Konto (users.role_id) -- der Stamm-Gemeinde. Wer zuhause
// Gemeindeleitung und in B Teamer:in ist, sass in B's Event-Chats als
// 'admin'; Chatliste und Zaehler in B suchen user_type = 'teamer' und fanden
// den Raum nicht. Jetzt dieselbe Regel wie ladeRolleInGemeinde
// (utils/orgMitglieder.js) und TEAM_MITGLIED_ROLLE (routes/chat.js): in der
// Stamm-Gemeinde users.role_id -- auch wenn user_organizations sie noch einmal
// fuehrt --, in jeder weiteren user_organizations.role_id. Inline als SQL,
// weil syncEventChat fuer Mengen ist. Gehoert die Person der Gemeinde nicht
// (mehr) an, bleibt der bisherige Wert (Rolle am Konto), damit niemand still
// herausfaellt. Den Bestand gleicht Migration 197 an.
// Erwartet die Aliase cr (chat_rooms) und u (users); liefert r (roles).
const ROLLE_IN_GEMEINDE_DES_RAUMS = `
     LEFT JOIN user_organizations uo_raum
       ON uo_raum.user_id = u.id AND uo_raum.organization_id = cr.organization_id
     JOIN roles r
       ON r.id = CASE WHEN u.organization_id = cr.organization_id THEN u.role_id
                      ELSE COALESCE(uo_raum.role_id, u.role_id) END`;

/**
 * Entfernt eine Person aus allen Chat-Räumen eines Termins.
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

/**
 * Traegt eine Person in alle Chat-Räume eines Termins ein — aber nur, wenn
 * sie dort BESTAETIGT angemeldet ist (seit 27.09.2026, siehe Kopf). Wer auf
 * der Warteliste steht oder abgemeldet ist, bleibt draussen; der Aufruf tut
 * dann nichts.
 * Idempotent: Ist sie schon drin, passiert nichts. Existiert kein Chat, auch
 * nicht — der Chat wird bewusst nur auf Wunsch der Leitung angelegt.
 *
 * Die Rolle wird selbst nachgesehen, damit der user_type stimmt: Ein Teamer,
 * der als 'admin' eingetragen wird, findet seinen eigenen Raum nicht. Es ist
 * die Rolle in der Gemeinde des Termins (ROLLE_IN_GEMEINDE_DES_RAUMS).
 *
 * @param {object} db   Pool ODER Client (muss .query haben).
 * @param {number} eventId
 * @param {number} userId
 * @param {number} organizationId
 * @returns {Promise<number>} Anzahl angelegter Mitgliedschaften.
 */
async function addToEventChat(db, eventId, userId, organizationId) {
  const { rowCount } = await db.query(
    `INSERT INTO chat_participants (room_id, user_id, user_type)
     SELECT cr.id, u.id,
            CASE WHEN r.name = 'konfi' THEN 'konfi'
                 WHEN r.name = 'teamer' THEN 'teamer'
                 ELSE 'admin' END
     FROM chat_rooms cr
     JOIN users u ON u.id = $2
     ${ROLLE_IN_GEMEINDE_DES_RAUMS}
     WHERE cr.event_id = $1
       AND cr.organization_id = $3
       AND u.deleted_at IS NULL
       AND EXISTS (
         SELECT 1 FROM event_bookings eb
          WHERE eb.event_id = cr.event_id
            AND eb.user_id = u.id
            AND eb.status = 'confirmed'
       )
     ON CONFLICT DO NOTHING`,
    [eventId, userId, organizationId]
  );
  return rowCount;
}

/**
 * Gleicht die Mitgliedschaft im Chat eines Termins an die Buchungen an:
 * Jede BESTAETIGT gebuchte Person kommt hinein (seit 27.09.2026; vorher
 * jeder Status ausser 'cancelled', also auch Warteliste und Abgemeldete).
 * Entfernt niemanden — das macht removeFromEventChat beim Austragen.
 *
 * Für Mengen gedacht (Pflicht-Event-Automatik), wo einzelne Aufrufe je Person
 * unnötig viele Abfragen wären. Idempotent.
 *
 * @param {object} db   Pool ODER Client (muss .query haben).
 * @param {number} eventId
 * @param {number} organizationId
 * @returns {Promise<number>} Anzahl neu angelegter Mitgliedschaften.
 */
async function syncEventChat(db, eventId, organizationId) {
  const { rowCount } = await db.query(
    `INSERT INTO chat_participants (room_id, user_id, user_type)
     SELECT cr.id, u.id,
            CASE WHEN r.name = 'konfi' THEN 'konfi'
                 WHEN r.name = 'teamer' THEN 'teamer'
                 ELSE 'admin' END
     FROM chat_rooms cr
     JOIN event_bookings eb ON eb.event_id = cr.event_id
     JOIN users u ON u.id = eb.user_id
     ${ROLLE_IN_GEMEINDE_DES_RAUMS}
     WHERE cr.event_id = $1
       AND cr.organization_id = $2
       AND eb.status = 'confirmed'
       AND u.deleted_at IS NULL
     ON CONFLICT DO NOTHING`,
    [eventId, organizationId]
  );
  return rowCount;
}

module.exports = { removeFromEventChat, addToEventChat, syncEventChat };
