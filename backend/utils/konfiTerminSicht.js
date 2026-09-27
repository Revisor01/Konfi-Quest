// Welche Termine eine Konfi sieht -- EINE Regel fuer die Konfi-Terminliste
// und die Mitteilung "Neues Event!" (27.09.2026, Audit "Wer bekommt was",
// BF-04 / F-05).
//
// Simon, 27.09.2026 (CLAUDE.md, "Wer sieht und bekommt was"): Konfis sehen
// und bekommen nur den eigenen Jahrgang. Mitteilung = Sichtbarkeit: Eine
// Mitteilung bekommt genau, wer den Vorgang in seiner Liste sieht.
//
//   Termin des eigenen Jahrgangs   sichtbar
//   Termin fremder Jahrgaenge      nicht sichtbar
//   Termin ohne jeden Jahrgang     nicht sichtbar (gilt dem Team, F-05)
//   "Nur Team" (teamer_only)       nie
//   Konfi ohne Jahrgang            sieht keinen Termin
//
// BIS HIERHER stand die Bedingung nur in GET /api/konfi/events (INNER JOIN
// auf event_jahrgang_assignments, eigener Jahrgang, teamer_only IS NOT TRUE).
// Der Anmeldestart-Push fragte dagegen jede Konfi der Gemeinde -- jede
// Konfi bekam jede Woche Einladungen zu Terminen anderer Jahrgaenge und zu
// Team-Terminen ohne Jahrgang, tippte darauf und fand nichts.
//
// Was die Liste darueber hinaus filtert, gehoert nicht zur Sichtbarkeit des
// Termins, sondern zur Darstellung: das Datumsfenster (letzte 12 Monate) und
// abgesagte Termine nur bei eigener Buchung. Der Anmeldestart-Push meldet
// ohnehin nur kuenftige, nicht abgesagte Termine (backgroundService).

/**
 * SQL-Bedingung "eine Konfi des Jahrgangs <jahrgang> sieht Termin <e>".
 *
 * Ist <jahrgang> NULL (Konfi ohne Jahrgang), ist die Bedingung falsch.
 *
 * @param {object} opt
 * @param {string} opt.jahrgang  SQL-Ausdruck fuer den Jahrgang der Konfi
 *                               (z. B. '$3' oder 'kp.jahrgang_id')
 * @param {string} [opt.e='e']   Alias der events-Tabelle
 * @returns {string}
 */
function konfiSiehtTerminSql({ jahrgang, e = 'e' }) {
  return `(
    ${e}.teamer_only IS NOT TRUE
    AND EXISTS (
      SELECT 1 FROM event_jahrgang_assignments eja_konfi_sicht
       WHERE eja_konfi_sicht.event_id = ${e}.id
         AND eja_konfi_sicht.jahrgang_id = ${jahrgang}
    )
  )`;
}

/**
 * Alle Konfis, die Termin <eventId> in ihrer Terminliste sehen -- die
 * Empfaenger von "Neues Event!". Aktive, nicht geloeschte Konten der Gemeinde
 * des Termins.
 *
 * @param {object} db
 * @param {number} eventId
 * @returns {Promise<Array<number>>} Nutzer-IDs ohne Doppelte
 */
async function ladeKonfisDieTerminSehen(db, eventId) {
  if (eventId === null || eventId === undefined || String(eventId) === '') return [];
  const { rows } = await db.query(
    `SELECT DISTINCT u.id
       FROM events e
       JOIN users u ON u.organization_id = e.organization_id
       JOIN roles r ON r.id = u.role_id
       JOIN konfi_profiles kp ON kp.user_id = u.id
      WHERE e.id = $1
        AND r.name = 'konfi'
        AND u.deleted_at IS NULL
        AND u.is_active = true
        AND ${konfiSiehtTerminSql({ jahrgang: 'kp.jahrgang_id', e: 'e' })}
      ORDER BY u.id`,
    [eventId]
  );
  return rows.map((r) => r.id);
}

module.exports = { konfiSiehtTerminSql, ladeKonfisDieTerminSehen };
