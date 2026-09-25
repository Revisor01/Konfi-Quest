// Mitteilungen im Postfach, deren Gegenstand verschwindet (25.09.2026).
//
// Die Tabelle notifications wird an sechs Stellen geschrieben (Antrag
// eingereicht, neuer Antrag bei der Leitung, Entscheidung, Abzeichen) und
// seit dem 25.09.2026 im Postfach gelesen. Geloescht wurde sie bis dahin
// nur mit dem Konto (users.js) oder der Organisation (organizations.js) --
// in activities.js, badges.js, konfi.js, teamer.js, konfi-management.js
// und konfiDeletion.js stand kein einziges DELETE FROM notifications
// (gemessen: 0 Treffer). Folge: Zog eine Konfi ihren Antrag zurueck, blieb
// "Neuer Antrag eingegangen" bei der Leitung stehen und fuehrte beim
// Antippen in eine Liste, in der der Antrag nicht mehr war. Simon: "Und wenn
// es geloescht wird, wird es doch sicherlich auch aus unserer In-App-Liste
// geloescht, oder?"
//
// WAS GEHT UND WAS BLEIBT -- die Unterscheidung:
//
//   Eine Mitteilung, die einen ZUSTAND meldet ("eingereicht und wird
//   geprueft", "neuer Antrag wartet auf dich"), ist tot, sobald der Antrag
//   weg ist: Der Zustand existiert nicht mehr, das Ziel des Antippens auch
//   nicht. Sie geht.
//
//   Eine Mitteilung, die eine ENTSCHEIDUNG festhaelt ("Antrag genehmigt",
//   "Antrag abgelehnt"), ist Verlauf. Sie bleibt wahr, auch wenn der
//   abgelehnte Antrag spaeter aufgeraeumt wird -- der Text traegt den Namen
//   der Aktivitaet, das Ziel ist die Antragsliste der Rolle, die es weiter
//   gibt. Sie bleibt.
//
//   Ein Abzeichen, das die Leitung loescht, verschwindet samt aller
//   Exemplare aus den Profilen (badges.js). "Neues Badge erhalten" zeigt dann
//   auf etwas, das niemand mehr hat. Sie geht.
//
// ZUORDNUNG ueber die Spalte data (jsonb): Die Schreibstellen legen dort
// request_id bzw. badge_id ab -- je nach Stelle als Zahl (newRequest.id) oder
// als Text (req.params.id). `->>` liefert beides als Text, deshalb wird
// ueber Text verglichen und nie gecastet: Ein unerwarteter Wert trifft
// nichts, statt die ganze Loeschung mit einem Cast-Fehler zu kippen. data
// NULL oder ein blosser JSON-String (doppelt serialisiert) ergeben bei `->>`
// NULL und treffen ebenfalls nichts.
//
// Beide Funktionen nehmen db ODER einen Transaktions-Client: Sie fuehren
// kein BEGIN/COMMIT aus, der Aufrufer bestimmt die Transaktion.

/** Die Arten, die einen Zustand des Antrags melden -- nicht die Entscheidung. */
const ZUSTANDS_ARTEN_ANTRAG = ['new_activity_request', 'activity_request_submitted'];

/**
 * Entfernt die Zustands-Mitteilungen zu geloeschten Antraegen.
 *
 * @param {{query: Function}} db  Pool oder Client
 * @param {Array<number|string>} requestIds  Kennungen der geloeschten Antraege
 * @returns {Promise<number>} Anzahl entfernter Mitteilungen
 */
async function loescheMitteilungenZuAntraegen(db, requestIds) {
  const ids = [...new Set((requestIds || []).map((id) => String(id)).filter((id) => id !== '' && id !== 'null' && id !== 'undefined'))];
  if (ids.length === 0) return 0;
  const { rowCount } = await db.query(
    `DELETE FROM notifications
      WHERE type = ANY($1::text[])
        AND data->>'request_id' = ANY($2::text[])`,
    [ZUSTANDS_ARTEN_ANTRAG, ids]
  );
  return rowCount;
}

/**
 * Entfernt "Neues Badge erhalten" zu einem geloeschten Abzeichen.
 *
 * @param {{query: Function}} db  Pool oder Client
 * @param {number|string} badgeId  Kennung des geloeschten Abzeichens
 * @returns {Promise<number>} Anzahl entfernter Mitteilungen
 */
async function loescheMitteilungenZuAbzeichen(db, badgeId) {
  if (badgeId === null || badgeId === undefined || String(badgeId) === '') return 0;
  const { rowCount } = await db.query(
    `DELETE FROM notifications
      WHERE type = 'badge_earned'
        AND data->>'badge_id' = $1::text`,
    [String(badgeId)]
  );
  return rowCount;
}

module.exports = { loescheMitteilungenZuAntraegen, loescheMitteilungenZuAbzeichen, ZUSTANDS_ARTEN_ANTRAG };
