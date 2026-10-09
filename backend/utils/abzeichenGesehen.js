// backend/utils/abzeichenGesehen.js
//
// Alle eigenen Abzeichen einer Gemeinde als gesehen markieren -- EINE Stelle
// fuer POST /konfi/badges/mark-seen und PUT/POST /teamer/badges/mark-seen.
// Bis 09.10.2026 stand das UPDATE im Konfi-Weg und im Team-Weg je einmal
// (offene Befunde, „Doppelter Code Konfi/Team"). Die Antworttexte bleiben je
// Weg verschieden; sie sind Vertrag mit den Store-Apps.

/**
 * @param {object} db
 * @param {number} userId
 * @param {number} organizationId
 */
function markiereAbzeichenGesehen(db, userId, organizationId) {
  return db.query(
    'UPDATE user_badges SET seen = true WHERE user_id = $1 AND organization_id = $2 AND seen = false',
    [userId, organizationId]
  );
}

module.exports = { markiereAbzeichenGesehen };
