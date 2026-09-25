// Mitglieder einer Organisation nach Rolle -- ueber BEIDE Quellen der
// Zugehoerigkeit (25.09.2026).
//
// BEFUND, in Produktion gemessen: Nutzer 41 ist laut users.organization_id in
// Organisation 1 zuhause, steht in user_organizations aber als org_admin fuer
// die Organisationen 1, 2 und 4. Eine Challenge in Organisation 4 loeste den
// Push an die Leitung aus -- er erreichte ihn nicht. Alle Empfaenger-Abfragen
// des Push-Service fragten `u.organization_id = $1`, also nur die
// Stamm-Organisation. Die Absicht, Mehrfachzugehoerigkeit zu unterstuetzen,
// war da: jeder Payload traegt die organization_id des INHALTS, "damit der
// Tap in DIESE Organisation wechselt" -- nur die Empfaengerliste zog nicht
// mit. Elf Push-Arten und zwei In-App-Mitteilungen hingen daran.
//
// DAS MUSTER IST NICHT NEU: rbac.js loest die aktive Organisation seit
// Migration 101 gegen user_organizations auf, liveUpdate.js (22.08.2026),
// teamChat.js und jahrgangChat.js vereinen fuer ihre Empfaenger dieselben
// zwei Quellen per UNION. Hier steht es einmal, damit es nicht an vierzehn
// Stellen einzeln nachgezogen werden muss.
//
// DIE ROLLE GILT JE ORGANISATION: user_organizations traegt ein eigenes
// role_id. Wer in Gemeinde A org_admin ist und in Gemeinde B nur Teamer:in,
// bekommt in B keine Leitungs-Meldungen. Deshalb wird die Rolle je Quelle
// getrennt gezogen -- users.role_id fuer die Stamm-Organisation,
// uo.role_id fuer die Zusatzzugehoerigkeit -- und NICHT pauschal ueber die
// Rolle am Nutzerkonto.
//
// GESPERRTE UND GELOESCHTE KONTEN fallen hier schon raus. Fuer den Push
// filtert getTokensForUser das seit dem 28.08.2026 ohnehin zentral; fuer die
// In-App-Mitteilungen und die E-Mail gab es diesen zentralen Filter nicht.

/**
 * @param {object} db
 * @param {number} organizationId  Organisation des INHALTS
 * @param {string[]} rollen        Rollennamen, z.B. ['admin', 'org_admin']
 * @param {object} [opt]
 * @param {number[]|null} [opt.jahrgangIds]  Nur Personen mit einer Zuweisung
 *   (user_jahrgang_assignments) auf mindestens einen dieser Jahrgaenge.
 * @returns {Promise<Array<number|string>>} Nutzer-IDs ohne Doppelte, so wie
 *   pg sie liefert (users.id ist bigint).
 */
async function ladeMitgliederDerOrganisation(db, organizationId, rollen, { jahrgangIds = null } = {}) {
  if (!Array.isArray(rollen) || rollen.length === 0) return [];
  if (Array.isArray(jahrgangIds) && jahrgangIds.length === 0) return [];

  const params = [organizationId, rollen];
  let jahrgangFilter = '';
  if (Array.isArray(jahrgangIds)) {
    params.push(jahrgangIds);
    jahrgangFilter = `
       AND EXISTS (
         SELECT 1 FROM user_jahrgang_assignments uja
          WHERE uja.user_id = u.id AND uja.jahrgang_id = ANY($3::int[])
       )`;
  }

  const { rows } = await db.query(
    `
    -- Stamm-Organisation: Rolle aus users.role_id
    SELECT u.id
      FROM users u
      JOIN roles r ON r.id = u.role_id
     WHERE u.organization_id = $1
       AND r.name = ANY($2::text[])
       AND u.is_active = true
       AND u.deleted_at IS NULL${jahrgangFilter}
    UNION
    -- Zusatzzugehoerigkeit: Rolle aus user_organizations.role_id DIESER Org
    SELECT u.id
      FROM user_organizations uo
      JOIN users u ON u.id = uo.user_id
      JOIN roles r ON r.id = uo.role_id
     WHERE uo.organization_id = $1
       AND r.name = ANY($2::text[])
       AND u.is_active = true
       AND u.deleted_at IS NULL${jahrgangFilter}
    `,
    params
  );
  return rows.map((r) => r.id);
}

const LEITUNGSROLLEN = ['admin', 'org_admin'];

/**
 * Die Leitung einer Organisation (admin + org_admin), ueber beide Quellen.
 */
function ladeLeitungDerOrganisation(db, organizationId, opt) {
  return ladeMitgliederDerOrganisation(db, organizationId, LEITUNGSROLLEN, opt);
}

module.exports = { ladeMitgliederDerOrganisation, ladeLeitungDerOrganisation, LEITUNGSROLLEN };
