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

/**
 * Die Gegenrichtung: alle Gemeinden EINER Person, jede mit der Rolle und den
 * Jahrgangs-Zuweisungen, die sie DORT hat (25.09.2026, fuer die Zaehler am
 * Gemeinde-Umschalter).
 *
 * Dieselben zwei Quellen wie oben und wie GET /auth/my-organizations:
 * Stamm-Organisation mit users.role_id, Zusatzzugehoerigkeiten mit
 * uo.role_id. Fuehrt user_organizations die Stamm-Organisation doppelt,
 * gewinnt die Rolle am Nutzerkonto (wie in my-organizations). Gesperrte
 * Organisationen fallen heraus, wie dort.
 *
 * Die Jahrgaenge kommen ueber jahrgaenge.organization_id an ihre Gemeinde --
 * ein Jahrgang gehoert genau einer Organisation. Damit kann eine Zuweisung
 * aus Gemeinde A nie in Gemeinde B mitzaehlen (Jahrgangsbindung, siehe
 * utils/jahrgangsZugriff.js).
 *
 * Zwei Abfragen, unabhaengig von der Anzahl der Gemeinden.
 *
 * @param {object} db
 * @param {number} userId
 * @returns {Promise<Array<{organization_id:number, role_name:string, type:string,
 *   assigned_jahrgaenge:Array<{id:number, can_view:boolean, can_edit:boolean}>}>>}
 *   type wie im Token: konfi, teamer oder admin (alle Leitungsrollen).
 */
async function ladeMitgliedschaftenDerPerson(db, userId) {
  const [{ rows: zeilen }, { rows: jahrgaenge }] = await Promise.all([
    db.query(
      `
      SELECT m.organization_id, m.role_name
        FROM (
          SELECT u.organization_id, r.name AS role_name, true AS is_primary
            FROM users u
            JOIN roles r ON r.id = u.role_id
            JOIN organizations o ON o.id = u.organization_id
           WHERE u.id = $1 AND COALESCE(o.is_active, true) = true
          UNION ALL
          SELECT uo.organization_id, r.name AS role_name, false AS is_primary
            FROM user_organizations uo
            JOIN roles r ON r.id = uo.role_id
            JOIN organizations o ON o.id = uo.organization_id
           WHERE uo.user_id = $1 AND COALESCE(o.is_active, true) = true
        ) m
       ORDER BY m.organization_id, m.is_primary DESC
      `,
      [userId]
    ),
    db.query(
      `SELECT uja.jahrgang_id AS id, uja.can_view, uja.can_edit, j.organization_id
         FROM user_jahrgang_assignments uja
         JOIN jahrgaenge j ON j.id = uja.jahrgang_id
        WHERE uja.user_id = $1`,
      [userId]
    )
  ]);

  const jahrgaengeJeOrg = new Map();
  for (const j of jahrgaenge) {
    if (!jahrgaengeJeOrg.has(j.organization_id)) jahrgaengeJeOrg.set(j.organization_id, []);
    jahrgaengeJeOrg.get(j.organization_id).push({ id: j.id, can_view: j.can_view, can_edit: j.can_edit });
  }

  const mitgliedschaften = [];
  const gesehen = new Set();
  for (const z of zeilen) {
    if (gesehen.has(z.organization_id)) continue;
    gesehen.add(z.organization_id);
    mitgliedschaften.push({
      organization_id: z.organization_id,
      role_name: z.role_name,
      type: z.role_name === 'konfi' ? 'konfi' : (z.role_name === 'teamer' ? 'teamer' : 'admin'),
      assigned_jahrgaenge: jahrgaengeJeOrg.get(z.organization_id) || []
    });
  }
  return mitgliedschaften;
}

module.exports = { ladeMitgliederDerOrganisation, ladeLeitungDerOrganisation, ladeMitgliedschaftenDerPerson, LEITUNGSROLLEN };
