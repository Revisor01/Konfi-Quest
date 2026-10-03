// Das letzte aktive Super-Admin-Konto bleibt (03.10.2026).
//
// Gemeinden anlegen, sperren und loeschen, Support-Konten verwalten: Das kann
// nur ein Super-Admin (requireSuperAdmin). Wird das letzte aktive
// Super-Admin-Konto gesperrt oder geloescht, kann das niemand mehr -- auch
// nicht, um den Fehler zu beheben; dann hilft nur ein Eingriff in die
// Datenbank. Deshalb pruefen die Wege, die ein Super-Admin-Konto sperren
// oder loeschen, vorher hier:
//   - PATCH und DELETE /organizations/support-konten/:id (routes/supportKonten.js),
//   - POST /auth/delete-account (die Selbstloeschung, jede Rolle).
// Ueber die Benutzerverwaltung einer Gemeinde (PUT/DELETE /users/:id) kommt
// ein Super-Admin-Konto nur in die Hand eines anderen Super-Admins
// (checkUserHierarchy), und der zaehlt selbst als aktives Konto mit.
//
// SUPER-ADMIN heisst wie ueberall (utils/roleHierarchy.js,
// istSuperAdminKonto): Merkmal users.is_super_admin ODER Rolle super_admin --
// mit oder ohne Gemeinde. AKTIV heisst: nicht gesperrt (is_active NULL gilt
// wie beim Login als aktiv) und nicht geloescht. Eine gesperrte Gemeinde
// zaehlt nicht, weil die Gemeinde-Sperre fuer Super-Admins nicht gilt.
//
// GLEICHZEITIG: Zwei Super-Admins, die sich im selben Moment gegenseitig
// sperren, saehen beide noch den anderen. Die Sperre unten reiht alle
// Aenderungen an Super-Admin-Konten hintereinander; sie gilt bis zum Ende der
// Transaktion des Aufrufers.

// Schluesselraum der Sperre (erste Haelfte des Zwei-Zahlen-Schluessels), wie
// BENUTZERNAME_SPERRE und TERMIN_LOESCHEN_SPERRE.
const SUPER_ADMIN_SPERRE = 31026;

const MELDUNG_LETZTER = Object.freeze({
  sperren: 'Das letzte aktive Super-Admin-Konto lässt sich nicht sperren. Lege zuerst ein weiteres an.',
  loeschen: 'Das letzte aktive Super-Admin-Konto lässt sich nicht löschen. Lege zuerst ein weiteres an.',
});

/**
 * Bleibt ohne dieses Konto ein anderes aktives Super-Admin-Konto?
 * Nur mit dem Client einer offenen Transaktion rufen -- die Sperre haelt bis
 * zu deren Ende.
 *
 * @param {import('pg').PoolClient} client
 * @param {number|string} userId  das Konto, das gesperrt oder geloescht werden soll
 * @returns {Promise<boolean>}
 */
async function bleibtEinSuperAdmin(client, userId) {
  await client.query('SELECT pg_advisory_xact_lock($1, 0)', [SUPER_ADMIN_SPERRE]);
  const { rows: [{ anzahl }] } = await client.query(
    `SELECT COUNT(*)::int AS anzahl
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.id <> $1
        AND u.deleted_at IS NULL
        AND COALESCE(u.is_active, true) = true
        AND (u.is_super_admin IS TRUE OR r.name = 'super_admin')`,
    [userId]
  );
  return anzahl > 0;
}

/**
 * Die gemeindefreie Systemrolle super_admin (Migration 190).
 * @returns {Promise<number|null>} ihre ID, null wenn sie fehlt
 */
async function systemrolleSuperAdmin(db) {
  const { rows: [rolle] } = await db.query(
    "SELECT id FROM roles WHERE organization_id IS NULL AND name = 'super_admin'"
  );
  return rolle ? Number(rolle.id) : null;
}

module.exports = { SUPER_ADMIN_SPERRE, MELDUNG_LETZTER, bleibtEinSuperAdmin, systemrolleSuperAdmin };
