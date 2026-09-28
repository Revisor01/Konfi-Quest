// Die Konfi-Zeit einer Person dauerhaft festhalten (28.09.2026, Migration 170).
//
// Simon, 28.09.2026: "Loeschen bei Befoerderung ist gewollt damit der
// Jahrgang spaeter weg kann. Wir legen eine persistent kopie der Konfi
// history fuer den Teamer."
//
// WARUM EINE KOPIE: Was bis hierher als "Konfi-Historie" stehen blieb, haengt
// an lebenden Tabellen. Die Befoerderung loescht alle Buchungen der Person --
// damit die besuchten Termine samt Anwesenheit (Audit 26.09.2026, BF-09).
// Loescht die Leitung spaeter den alten Jahrgang, gehen dessen Termine und
// mit ihnen die Event-Punkte (DELETE /admin/jahrgaenge/:id); Abzeichen gehen,
// wenn die Leitung ein Abzeichen loescht (badges.js). Die Kopie in
// konfi_historie haelt fest, was die Konfi-Zeit ausgemacht hat, BEVOR davon
// etwas weggeht.
//
// WANN SIE ENTSTEHT:
//   - bei der Befoerderung zur Teamer:in, vor dem Loeschen der Buchungen
//     (routes/konfi-management.js, promote-teamer);
//   - beim Loeschen eines Jahrgangs fuer Befoerderte aus diesem Jahrgang, die
//     noch keine haben -- befoerdert vor dem 28.09.2026. Ihre Buchungen sind
//     dann schon weg, aber Event-Punkte, Aktivitaeten, Abzeichen und Stempel
//     stehen noch.
//
// WER SIE SIEHT: die Person selbst (GET /teamer/konfi-zeit) und die Leitung
// ihrer Gemeinde (GET /teamer/:userId/konfi-zeit). Mit dem Konto geht sie
// (ON DELETE CASCADE).
//
// AUFBAU von `daten` (version 1) -- Schluessel deutsch, wie die Antwort:
//   jahrgang      { id, name }
//   punkte        { gottesdienst, gemeinde, gesamt }   (Stand konfi_profiles)
//   level         { id, titel } | null
//   termine       [{ event_id, name, datum, ort, abgesagt, status, anwesenheit,
//                    punkte, punktart }]  vergangene Buchungen und alle
//                    Termine mit Event-Punkten
//   aktivitaeten  [{ name, art, punkte, datum, kommentar }]
//   bonuspunkte   [{ beschreibung, art, punkte, datum }]
//   abzeichen     [{ badge_id, name, beschreibung, icon, farbe, kriterium,
//                    kriterium_wert, verliehen_am }]  nur Konfi-Abzeichen
//   stempel       [{ challenge_id, titel, badge_name, badge_icon, erhalten_am }]
//   konfispruch   wie utils/konfspruch.loeseKonfspruchAuf | null

const { ladeKonfspruch } = require('./konfspruch');

const DATEN_VERSION = 1;

/**
 * Sammelt die Konfi-Zeit einer Person. Aendert nichts.
 *
 * @param {{query: Function}} client
 * @param {number|string} userId
 * @param {number|string} organizationId
 * @returns {Promise<object|null>} daten, oder null ohne Konfi-Profil in dieser Gemeinde
 */
async function sammleKonfiZeit(client, userId, organizationId) {
  const { rows: [profil] } = await client.query(
    `SELECT kp.gottesdienst_points, kp.gemeinde_points, kp.jahrgang_id,
            j.name AS jahrgang_name, l.id AS level_id, l.title AS level_titel
       FROM konfi_profiles kp
       LEFT JOIN jahrgaenge j ON j.id = kp.jahrgang_id
       LEFT JOIN levels l ON l.id = kp.current_level_id
      WHERE kp.user_id = $1 AND kp.organization_id = $2`,
    [userId, organizationId]
  );
  if (!profil) return null;

  const { rows: termine } = await client.query(
    `SELECT e.id AS event_id, e.name, e.event_date AS datum, e.location AS ort,
            COALESCE(e.cancelled, false) AS abgesagt,
            b.status, b.attendance_status AS anwesenheit,
            COALESCE(p.punkte, 0)::int AS punkte, p.punktart
       FROM events e
       LEFT JOIN LATERAL (
         SELECT eb.status, eb.attendance_status
           FROM event_bookings eb
          WHERE eb.event_id = e.id AND eb.user_id = $1
          ORDER BY eb.id DESC
          LIMIT 1
       ) b ON true
       LEFT JOIN (
         SELECT event_id, SUM(points)::int AS punkte, MIN(point_type) AS punktart
           FROM event_points
          WHERE konfi_id = $1 AND organization_id = $2
          GROUP BY event_id
       ) p ON p.event_id = e.id
      WHERE e.organization_id = $2
        AND ((b.status IS NOT NULL AND e.event_date <= NOW()) OR p.event_id IS NOT NULL)
      ORDER BY e.event_date, e.id`,
    [userId, organizationId]
  );

  const { rows: aktivitaeten } = await client.query(
    `SELECT a.name, a.type AS art, COALESCE(ua.points, a.points)::int AS punkte,
            ua.completed_date AS datum, ua.comment AS kommentar
       FROM user_activities ua
       JOIN activities a ON a.id = ua.activity_id
      WHERE ua.user_id = $1 AND ua.organization_id = $2
      ORDER BY ua.completed_date, ua.id`,
    [userId, organizationId]
  );

  const { rows: bonuspunkte } = await client.query(
    `SELECT description AS beschreibung, type AS art, points::int AS punkte, completed_date AS datum
       FROM bonus_points
      WHERE konfi_id = $1 AND organization_id = $2
      ORDER BY completed_date, id`,
    [userId, organizationId]
  );

  // Nur Konfi-Abzeichen -- dieselbe Regel wie GET /teamer/profile (die
  // Teamer-Abzeichen gehoeren nicht zur Konfi-Zeit).
  const { rows: abzeichen } = await client.query(
    `SELECT ub.badge_id, cb.name, cb.description AS beschreibung, cb.icon, cb.color AS farbe,
            cb.criteria_type AS kriterium, cb.criteria_value AS kriterium_wert,
            ub.awarded_date AS verliehen_am
       FROM user_badges ub
       JOIN custom_badges cb ON cb.id = ub.badge_id
      WHERE ub.user_id = $1 AND cb.organization_id = $2 AND cb.target_role = 'konfi'
      ORDER BY ub.awarded_date, ub.id`,
    [userId, organizationId]
  );

  // Challenge-Stempel: eigener Beitrag mit Freigabe, einer je Challenge.
  const { rows: stempel } = await client.query(
    `SELECT c.id AS challenge_id, c.title AS titel, c.badge_name, c.badge_icon,
            MIN(COALESCE(s.approved_at, s.created_at)) AS erhalten_am
       FROM challenge_submissions s
       JOIN challenges c ON c.id = s.challenge_id
      WHERE s.user_id = $1 AND c.organization_id = $2
        AND s.moderation_status = 'approved'
      GROUP BY c.id, c.title, c.badge_name, c.badge_icon
      ORDER BY MIN(COALESCE(s.approved_at, s.created_at))`,
    [userId, organizationId]
  );

  const gottesdienst = parseInt(profil.gottesdienst_points, 10) || 0;
  const gemeinde = parseInt(profil.gemeinde_points, 10) || 0;

  return {
    version: DATEN_VERSION,
    jahrgang: profil.jahrgang_id ? { id: Number(profil.jahrgang_id), name: profil.jahrgang_name } : null,
    punkte: { gottesdienst, gemeinde, gesamt: gottesdienst + gemeinde },
    level: profil.level_id ? { id: Number(profil.level_id), titel: profil.level_titel } : null,
    termine: termine.map((t) => ({ ...t, event_id: Number(t.event_id) })),
    aktivitaeten,
    bonuspunkte,
    abzeichen: abzeichen.map((a) => ({ ...a, badge_id: Number(a.badge_id) })),
    stempel: stempel.map((s) => ({ ...s, challenge_id: Number(s.challenge_id) })),
    konfispruch: await ladeKonfspruch(client, userId, organizationId)
  };
}

/**
 * Legt die Kopie an. In der Transaktion des Aufrufers laufen lassen -- VOR
 * dem Loeschen dessen, was sie festhalten soll.
 *
 * @param {{query: Function}} client
 * @param {number|string} userId
 * @param {number|string} organizationId
 * @param {object} opt
 * @param {'befoerderung'|'jahrgang_geloescht'} opt.anlass
 * @param {number|string|null} [opt.erstelltVon]
 * @returns {Promise<number|null>} Kennung der Kopie, null ohne Konfi-Profil
 */
async function legeKonfiHistorieAn(client, userId, organizationId, { anlass, erstelltVon = null }) {
  const daten = await sammleKonfiZeit(client, userId, organizationId);
  if (!daten) return null;
  const { rows: [zeile] } = await client.query(
    `INSERT INTO konfi_historie (user_id, organization_id, jahrgang_id, jahrgang_name, anlass, erstellt_von, daten)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [userId, organizationId, daten.jahrgang?.id || null, daten.jahrgang?.name || null, anlass, erstelltVon, JSON.stringify(daten)]
  );
  return Number(zeile.id);
}

/**
 * Beim Loeschen eines Jahrgangs: Kopie fuer jede befoerderte Person aus
 * diesem Jahrgang, die noch keine hat. Dieselbe Abgrenzung wie das Loesen
 * der Profile in DELETE /admin/jahrgaenge/:id (Rolle am Konto != konfi).
 *
 * @returns {Promise<number>} Anzahl neuer Kopien
 */
async function sichereKonfiZeitBefoerderter(client, jahrgangId, organizationId, erstelltVon = null) {
  const { rows: personen } = await client.query(
    `SELECT kp.user_id
       FROM konfi_profiles kp
       JOIN users u ON u.id = kp.user_id
       JOIN roles r ON r.id = u.role_id
      WHERE kp.jahrgang_id = $1 AND kp.organization_id = $2 AND r.name <> 'konfi'
        AND NOT EXISTS (SELECT 1 FROM konfi_historie h
                         WHERE h.user_id = kp.user_id AND h.organization_id = kp.organization_id)
      ORDER BY kp.user_id`,
    [jahrgangId, organizationId]
  );
  let angelegt = 0;
  for (const { user_id: userId } of personen) {
    if (await legeKonfiHistorieAn(client, userId, organizationId, { anlass: 'jahrgang_geloescht', erstelltVon })) {
      angelegt++;
    }
  }
  return angelegt;
}

/**
 * Die juengste Kopie einer Person in einer Gemeinde, fuer die Anzeige.
 *
 * @returns {Promise<object|null>} { jahrgang_name, anlass, erstellt_am, ...daten } oder null
 */
async function ladeKonfiHistorie(db, userId, organizationId) {
  const { rows: [zeile] } = await db.query(
    `SELECT jahrgang_name, anlass, erstellt_am, daten
       FROM konfi_historie
      WHERE user_id = $1 AND organization_id = $2
      ORDER BY erstellt_am DESC, id DESC
      LIMIT 1`,
    [userId, organizationId]
  );
  if (!zeile) return null;
  const daten = zeile.daten || {};
  return {
    ...daten,
    jahrgang_name: zeile.jahrgang_name || null,
    anlass: zeile.anlass,
    erstellt_am: zeile.erstellt_am ? new Date(zeile.erstellt_am).toISOString() : null
  };
}

module.exports = { sammleKonfiZeit, legeKonfiHistorieAn, sichereKonfiZeitBefoerderter, ladeKonfiHistorie };
