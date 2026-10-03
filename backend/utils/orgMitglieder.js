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

const { abfragenBuendeln } = require('./abfragenBuendeln');

/**
 * @param {object} db
 * @param {number} organizationId  Organisation des INHALTS
 * @param {string[]} rollen        Rollennamen, z.B. ['admin', 'org_admin']
 * @param {object} [opt]
 * @param {number[]|null} [opt.jahrgangIds]  Nur Personen mit einer Zuweisung
 *   (user_jahrgang_assignments) MIT Leserecht (can_view) auf mindestens einen
 *   dieser Jahrgaenge.
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
    // can_view gehoert dazu (27.09.2026, Audit wer-bekommt-was BF-16): Listen,
    // Zaehler und Jahrgangs-Chat verlangen Leserecht auf den Jahrgang
    // (notifications.js, jahrgangChat.js, darfJahrgang). Ohne diese Bedingung
    // loeste eine Zuweisung mit can_view = false Mitteilungen aus, deren
    // Vorgang die Person in keiner Liste sieht.
    jahrgangFilter = `
       AND EXISTS (
         SELECT 1 FROM user_jahrgang_assignments uja
          WHERE uja.user_id = u.id AND uja.jahrgang_id = ANY($3::int[])
            AND uja.can_view = true
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
 * Die Stamm-Gemeinde steht vorn, die weiteren folgen nach ihrer id (seit
 * 27.09.2026, Befund BF-12): Die Zahl am App-Symbol bucht dort, was keiner
 * Gemeinde der Liste gehoert (siehe utils/appIconBadge.js).
 *
 * @param {object} db
 * @param {number} userId
 * @returns {Promise<Array<{organization_id:number, role_name:string, type:string,
 *   assigned_jahrgaenge:Array<{id:number, can_view:boolean, can_edit:boolean}>}>>}
 *   type wie im Token: konfi, teamer oder admin (alle Leitungsrollen).
 */
async function ladeMitgliedschaftenDerPerson(db, userId) {
  const jePerson = await ladeMitgliedschaftenVieler(db, [userId]);
  const eintrag = jePerson.get(Number(userId));
  return eintrag ? eintrag.mitgliedschaften : [];
}

/**
 * Dasselbe fuer viele Personen auf einmal (27.09.2026, Befund BF-12).
 *
 * Die Zahl am App-Symbol setzen der Push (eine Person oder ein Block) und
 * der Hintergrund-Lauf (alle Konten, alle fuenf Minuten). Beide brauchen die
 * Rolle JE GEMEINDE -- vorher nahmen sie die Rolle am Nutzerkonto fuer jede
 * Gemeinde. Hier steht die Regel EINMAL, ladeMitgliedschaftenDerPerson ist
 * derselbe Weg mit einer Person. Zwei Abfragen, unabhaengig von der Zahl der
 * Personen und Gemeinden.
 *
 * Geloeschte Konten tauchen nicht auf (wie im Push-Weg vorher).
 *
 * @param {object} db
 * @param {Array<number>} userIds
 * @returns {Promise<Map<number, {stamm_organization_id:number|null,
 *   mitgliedschaften:Array<{organization_id:number, role_name:string, type:string,
 *   assigned_jahrgaenge:Array<{id:number, can_view:boolean, can_edit:boolean}>}>}>>}
 *   Je Person die Stamm-Gemeinde aus users.organization_id -- auch wenn sie
 *   gesperrt ist; der Push setzt sie als Rueckfall in den Payload -- und die
 *   Mitgliedschaften in AKTIVEN Gemeinden, die Stamm-Gemeinde zuerst.
 */
async function ladeMitgliedschaftenVieler(db, userIds) {
  const ids = [...new Set((userIds || []).map(Number).filter(Number.isFinite))];
  const jePerson = new Map();
  if (ids.length === 0) return jePerson;

  const [{ rows: zeilen }, { rows: jahrgaenge }] = await abfragenBuendeln(db, [
    () => db.query(
      `
      SELECT m.user_id, m.organization_id, m.role_name, m.is_primary, m.org_aktiv
        FROM (
          SELECT u.id AS user_id, u.organization_id, r.name AS role_name, true AS is_primary,
                 COALESCE(o.is_active, true) AS org_aktiv
            FROM users u
            JOIN roles r ON r.id = u.role_id
            JOIN organizations o ON o.id = u.organization_id
           WHERE u.id = ANY($1::bigint[]) AND u.deleted_at IS NULL
          UNION ALL
          SELECT uo.user_id, uo.organization_id, r.name AS role_name, false AS is_primary,
                 COALESCE(o.is_active, true) AS org_aktiv
            FROM user_organizations uo
            JOIN users u ON u.id = uo.user_id AND u.deleted_at IS NULL
            JOIN roles r ON r.id = uo.role_id
            JOIN organizations o ON o.id = uo.organization_id
           WHERE uo.user_id = ANY($1::bigint[])
        ) m
       ORDER BY m.user_id, m.is_primary DESC, m.organization_id
      `,
      [ids]
    ),
    () => db.query(
      `SELECT uja.user_id, uja.jahrgang_id AS id, uja.can_view, uja.can_edit, j.organization_id
         FROM user_jahrgang_assignments uja
         JOIN jahrgaenge j ON j.id = uja.jahrgang_id
        WHERE uja.user_id = ANY($1::bigint[])`,
      [ids]
    )
  ]);

  // Jahrgaenge je (Person, Gemeinde): Ein Jahrgang gehoert genau einer
  // Organisation, eine Zuweisung aus A zaehlt so nie in B.
  const jahrgaengeJe = new Map();
  for (const j of jahrgaenge) {
    const k = `${Number(j.user_id)}_${j.organization_id}`;
    if (!jahrgaengeJe.has(k)) jahrgaengeJe.set(k, []);
    jahrgaengeJe.get(k).push({ id: j.id, can_view: j.can_view, can_edit: j.can_edit });
  }

  for (const z of zeilen) {
    const userId = Number(z.user_id);
    if (!jePerson.has(userId)) {
      jePerson.set(userId, { stamm_organization_id: null, mitgliedschaften: [], gesehen: new Set() });
    }
    const eintrag = jePerson.get(userId);
    if (z.is_primary) eintrag.stamm_organization_id = z.organization_id;
    // Gesperrte Gemeinden fallen heraus (wie GET /auth/my-organizations).
    // Fuehrt user_organizations die Stamm-Gemeinde doppelt, gewinnt die Rolle
    // am Nutzerkonto: Die Stamm-Zeile kommt durch die Sortierung zuerst.
    if (!z.org_aktiv || eintrag.gesehen.has(z.organization_id)) continue;
    eintrag.gesehen.add(z.organization_id);
    eintrag.mitgliedschaften.push({
      organization_id: z.organization_id,
      role_name: z.role_name,
      type: z.role_name === 'konfi' ? 'konfi' : (z.role_name === 'teamer' ? 'teamer' : 'admin'),
      assigned_jahrgaenge: jahrgaengeJe.get(`${userId}_${z.organization_id}`) || []
    });
  }
  for (const eintrag of jePerson.values()) delete eintrag.gesehen;
  return jePerson;
}

/**
 * Gehoert diese Person zur Gemeinde? Ueber BEIDE Quellen der Zugehoerigkeit
 * (28.09.2026, Audit Punkte/Termine BF-07): Stamm-Gemeinde
 * (users.organization_id) oder Zusatzzugehoerigkeit (user_organizations).
 * Geloeschte Konten gehoeren nirgends mehr dazu. Die Rolle spielt hier keine
 * Rolle -- es geht darum, ob ein Schreibweg die Gemeindegrenze ueberschreitet.
 *
 * @param {object} db
 * @param {number|string} userId
 * @param {number} organizationId
 * @returns {Promise<boolean>}
 */
async function istMitgliedDerOrganisation(db, userId, organizationId) {
  const { rows: [r] } = await db.query(
    `SELECT EXISTS (
       SELECT 1 FROM users u
        WHERE u.id = $1 AND u.deleted_at IS NULL
          AND (u.organization_id = $2
               OR EXISTS (SELECT 1 FROM user_organizations uo
                           WHERE uo.user_id = u.id AND uo.organization_id = $2))
     ) AS mitglied`,
    [userId, organizationId]
  );
  return r.mitglied === true;
}

/**
 * Welche Rolle hat diese Person in DIESER Gemeinde? Ueber beide Quellen
 * (28.09.2026, Teamer-Badges je Gemeinde): in der Stamm-Gemeinde
 * users.role_id -- auch wenn user_organizations sie noch einmal mit anderer
 * Rolle fuehrt (Altbestand aus Migration 101) --, in jeder weiteren
 * user_organizations.role_id. Dieselbe Regel wie rbac.js, checkAndAwardBadges
 * und ladeMitgliedschaftenVieler.
 *
 * Fuer Routen, in denen die Leitung eine Person ihrer Gemeinde nach deren
 * Rolle DORT prueft (etwa "ist Teamer:in") -- vorher lasen sie die Rolle am
 * Konto und die Stamm-Gemeinde, und die Leitung einer weiteren Gemeinde bekam
 * fuer ihre Teamer:in 404.
 *
 * @param {object} db
 * @param {number|string} userId
 * @param {number|string} organizationId
 * @returns {Promise<string|null>}  Rollenname oder null (kein Mitglied,
 *   geloeschtes Konto)
 */
async function ladeRolleInGemeinde(db, userId, organizationId) {
  const { rows: [z] } = await db.query(
    `SELECT CASE WHEN u.organization_id = $2 THEN r_stamm.name ELSE r_dort.name END AS role_name
       FROM users u
       JOIN roles r_stamm ON r_stamm.id = u.role_id
       LEFT JOIN user_organizations uo ON uo.user_id = u.id AND uo.organization_id = $2
       LEFT JOIN roles r_dort ON r_dort.id = uo.role_id
      WHERE u.id = $1 AND u.deleted_at IS NULL
        AND (u.organization_id = $2 OR uo.id IS NOT NULL)`,
    [userId, organizationId]
  );
  return z ? z.role_name : null;
}

const STATISTIK_ROLLEN = ['konfi', 'teamer', 'admin', 'org_admin'];

/**
 * Die Mitgliedschaften fuer die Auswertungen der Support-Ansicht -- EINE
 * Regel-Stelle fuer die Statistik je Gemeinde, die Uebersicht und die Liste
 * der Gemeinden (03.10.2026): ein Eintrag je Konto UND Gemeinde mit der
 * Rolle DORT.
 *
 *   - beide Quellen der Zugehoerigkeit; die Rolle gilt je Gemeinde
 *     (Stamm-Gemeinde users.role_id, jede weitere user_organizations.role_id);
 *     fuehrt user_organizations die Stamm-Gemeinde noch einmal, zaehlt die
 *     Person dort einmal, mit der Rolle am Konto;
 *   - geloeschte Konten fehlen; gesperrte stehen drin (is_active), wer nur
 *     aktive will, filtert darauf;
 *   - Support-Konten OHNE Gemeinde fehlen, auch dort, wo sie Gast sind --
 *     sie gehoeren zum Betrieb, nicht zur Gemeinde. Ein Super-Admin-Konto
 *     MIT Gemeinde (Simons) steht da wie jedes Konto.
 *
 * Als Unterabfrage einsetzen: `FROM (${MITGLIEDSCHAFTEN_SQL}) m`. Spalten:
 * user_id, organization_id, rolle, is_active. Keine Parameter.
 */
const MITGLIEDSCHAFTEN_SQL = `
  SELECT DISTINCT ON (m.user_id, m.organization_id)
         m.user_id, m.organization_id, m.rolle, m.is_active
    FROM (
      -- Stamm-Gemeinde: Rolle am Konto
      SELECT u.id AS user_id, u.organization_id, r.name AS rolle,
             COALESCE(u.is_active, true) AS is_active, true AS stamm
        FROM users u
        JOIN roles r ON r.id = u.role_id
       WHERE u.organization_id IS NOT NULL AND u.deleted_at IS NULL
      UNION ALL
      -- weitere Gemeinden: Rolle DORT; Konten ohne Gemeinde nicht
      SELECT u.id, uo.organization_id, r.name, COALESCE(u.is_active, true), false
        FROM user_organizations uo
        JOIN users u ON u.id = uo.user_id
        JOIN roles r ON r.id = uo.role_id
       WHERE u.organization_id IS NOT NULL AND u.deleted_at IS NULL
    ) m
   ORDER BY m.user_id, m.organization_id, m.stamm DESC`;

/**
 * "Aktiv in den letzten 30 Tagen": Konten, die sich angemeldet
 * (users.last_login_at) oder ihre Anmeldung verlaengert haben (ein
 * Refresh-Token aus dieser Zeit -- die App erneuert ihn bei jedem Start und
 * alle 15 Minuten). Liefert die Spalte user_id; als Unterabfrage einsetzen.
 *
 * @param {string} [jetzt]  SQL-Ausdruck fuer "jetzt" (Vorgabe NOW()); die
 *   Uebersicht gibt ihren Bezugszeitpunkt mit.
 */
const aktiv30TageSql = (jetzt = 'NOW()') => `
  SELECT u.id AS user_id
    FROM users u
   WHERE u.last_login_at > ${jetzt} - interval '30 days'
      OR EXISTS (SELECT 1 FROM refresh_tokens rt
                  WHERE rt.user_id = u.id AND rt.created_at > ${jetzt} - interval '30 days')`;

/**
 * Konten je Gemeinde und Rolle -- fuer die Statistik der Support-Ansicht
 * (GET /support/statistik, 03.10.2026). Die Regel steht in
 * MITGLIEDSCHAFTEN_SQL, fuer alle Gemeinden in EINER Abfrage:
 *
 *   - geloeschte und gesperrte Konten zaehlen nicht (wie ueberall hier);
 *   - Support-Konten OHNE Gemeinde zaehlen nicht, auch nicht dort, wo sie
 *     Gast sind;
 *   - gezaehlt werden die vier Rollen einer Gemeinde.
 *
 * aktiv_30_tage: davon die Konten mit Anmeldung in den letzten 30 Tagen
 * (aktiv30TageSql). Je Konto, nicht je Gemeinde: Wer in zwei
 * Gemeinden mitarbeitet und in einer aktiv war, zaehlt in beiden.
 *
 * @param {object} db
 * @returns {Promise<Map<number, {konten: {konfi: number, teamer: number,
 *   admin: number, org_admin: number}, aktiv_30_tage: number}>>}
 *   nur Gemeinden mit mindestens einem Konto
 */
async function zaehleKontenJeGemeinde(db) {
  const { rows } = await db.query(
    `
    WITH mitglied AS (${MITGLIEDSCHAFTEN_SQL}),
    aktiv AS (${aktiv30TageSql()})
    SELECT m.organization_id,
           COUNT(*) FILTER (WHERE m.rolle = 'konfi')::int     AS konfi,
           COUNT(*) FILTER (WHERE m.rolle = 'teamer')::int    AS teamer,
           COUNT(*) FILTER (WHERE m.rolle = 'admin')::int     AS admin,
           COUNT(*) FILTER (WHERE m.rolle = 'org_admin')::int AS org_admin,
           COUNT(a.user_id)::int                              AS aktiv_30_tage
      FROM mitglied m
      LEFT JOIN aktiv a ON a.user_id = m.user_id
     WHERE m.is_active AND m.rolle = ANY($1::text[])
     GROUP BY m.organization_id
    `,
    [STATISTIK_ROLLEN]
  );
  const jeGemeinde = new Map();
  for (const z of rows) {
    jeGemeinde.set(Number(z.organization_id), {
      konten: { konfi: z.konfi, teamer: z.teamer, admin: z.admin, org_admin: z.org_admin },
      aktiv_30_tage: z.aktiv_30_tage,
    });
  }
  return jeGemeinde;
}

module.exports = {
  zaehleKontenJeGemeinde,
  MITGLIEDSCHAFTEN_SQL,
  aktiv30TageSql,
  STATISTIK_ROLLEN,
  istMitgliedDerOrganisation,
  ladeRolleInGemeinde,
  ladeMitgliederDerOrganisation,
  ladeLeitungDerOrganisation,
  ladeMitgliedschaftenDerPerson,
  ladeMitgliedschaftenVieler,
  LEITUNGSROLLEN
};
