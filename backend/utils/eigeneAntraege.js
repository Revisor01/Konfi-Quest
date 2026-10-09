// backend/utils/eigeneAntraege.js
//
// Eigenen Antrag stellen und zuruecknehmen -- EINE Stelle fuer
// POST/DELETE /konfi/requests und POST/DELETE /teamer/requests.
//
// Bis 09.10.2026 stand beides zweimal im Code (offene Befunde, „Doppelter
// Code Konfi/Team"); die Kopien waren schon auseinandergelaufen: der
// target_role-Filter fehlte auf dem Konfi-Weg (Befund N3), die
// Race-Behandlung der client_id auf dem Team-Weg (Befund M3), das Loeschen
// des Nachweisfotos auf dem Team-Weg (Befund M5).
//
// Was je Rolle verschieden bleibt, steht in den Routen: Rollenpruefung,
// Erfolgs- und Fehlertexte, die Art des Auftrags an die Leitung. Die
// Texte sind Vertrag mit den Store-Apps und bleiben byte-gleich
// (tests/routes/konfiTeamerKopienCharakterisierung.test.js).

const { heuteBerlin } = require('./zeitformat');
const { findeAntragZuClientId } = require('./antragIdempotenz');
const { loescheMitteilungenZuAntraegen } = require('./postfachAufraeumen');
const { deletePhotoFile } = require('./photoStorage');

/**
 * Legt einen Antrag auf eine Aktivitaet der eigenen Rolle an und schreibt
 * die Mitteilung „Antrag eingereicht" ins eigene Postfach.
 *
 * @param {object} db
 * @param {object} p
 * @param {number} p.userId
 * @param {number} p.organizationId
 * @param {'konfi'|'teamer'} p.zielrolle  target_role der Aktivitaet
 * @param {object} p.body  activity_id, description, photo_filename, requested_date, client_id
 * @param {string} p.ort   Pfad fuer die Fehlerzeile der Mitteilung im Log
 * @returns {Promise<{vorhanden: object}|{nichtGefunden: true}|{antrag: {id:number}, activity: {name:string, points:number}}>}
 *   vorhanden: dieselbe client_id gab es schon (Antwort 200 mit dieser Zeile)
 */
async function stelleEigenenAntrag(db, { userId, organizationId, zielrolle, body, ort }) {
  const { activity_id, description, photo_filename, requested_date, client_id } = body;

  // Idempotenz (Vorab-Check; den Race-Fall faengt behandleClientIdRace im
  // catch der Route ab).
  const vorhanden = await findeAntragZuClientId(db, client_id);
  if (vorhanden) return { vorhanden };

  // heuteBerlin() statt toISOString(): Letzteres liefert IMMER den UTC-Tag.
  // Zwischen 00:00 und 02:00 Berliner Zeit trug ein Antrag ohne Datum sonst
  // den Vortag -- und landete damit im falschen Tag der Punktehistorie.
  const date = requested_date || heuteBerlin();

  // Nur Aktivitaeten der eigenen Rolle (Befund N3, 27.08.2026).
  const { rows: [activity] } = await db.query(
    'SELECT name, points FROM activities WHERE id = $1 AND organization_id = $2 AND target_role = $3',
    [activity_id, organizationId, zielrolle]
  );
  if (!activity) return { nichtGefunden: true };

  const { rows: [antrag] } = await db.query(
    `INSERT INTO activity_requests (user_id, activity_id, requested_date, comment, photo_filename, status, organization_id, client_id)
     VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7)
     RETURNING id`,
    [userId, activity_id, date, description, photo_filename, organizationId, client_id || null]
  );

  // Bestaetigung ins eigene Postfach; ein Fehler hier laesst den Antrag
  // nicht scheitern.
  try {
    await db.query(
      'INSERT INTO notifications (user_id, title, message, type, data, organization_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [
        userId,
        'Antrag eingereicht',
        `Dein Antrag für "${activity.name}" wurde eingereicht und wird geprüft.`,
        'activity_request_submitted',
        JSON.stringify({ request_id: antrag.id, activity_name: activity.name, points: activity.points }),
        organizationId
      ]
    );
  } catch (err) {
    console.error(`Mitteilung zum Antrag nicht geschrieben (${ort}):`, err);
  }

  return { antrag, activity };
}

/**
 * Nimmt einen eigenen, noch wartenden Antrag zurueck: Zeile, Mitteilungen
 * dazu (eigene und die der Leitung, utils/postfachAufraeumen.js) und das
 * Nachweisfoto gehen.
 *
 * @returns {Promise<'nicht_gefunden'|'nicht_wartend'|'geloescht'>}
 */
async function nimmEigenenAntragZurueck(db, { requestId, userId, organizationId }) {
  const { rows: [antrag] } = await db.query(
    'SELECT id, status, photo_filename FROM activity_requests WHERE id = $1 AND user_id = $2 AND organization_id = $3',
    [requestId, userId, organizationId]
  );
  if (!antrag) return 'nicht_gefunden';
  if (antrag.status !== 'pending') return 'nicht_wartend';

  await db.query(
    'DELETE FROM activity_requests WHERE id = $1 AND user_id = $2 AND organization_id = $3',
    [requestId, userId, organizationId]
  );
  await loescheMitteilungenZuAntraegen(db, [requestId]);

  // Nachweisfoto NACH dem Loeschen der Zeile entfernen (Befund M5) --
  // keine Waise im Dateisystem, Datensparsamkeit.
  if (antrag.photo_filename) {
    await deletePhotoFile(antrag.photo_filename);
  }
  return 'geloescht';
}

module.exports = { stelleEigenenAntrag, nimmEigenenAntragZurueck };
