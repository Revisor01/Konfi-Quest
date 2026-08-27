// Befund B2b (27.08.2026): Das App-Icon hatte mehrere Schreiber mit
// unterschiedlicher Bedeutung.
//
// - Der Chat-Push setzte die CHAT-Unread-Zahl allein aufs Icon
//   (chat.js:1105, 1905) und ueberschrieb damit Antraege, Termine,
//   Challenge-Freigaben und Abzeichen.
// - Alle anderen Pushes fielen auf `badge: 1` zurueck (pushService.js:135,
//   265) -- egal, wie viel tatsaechlich offen war.
// - Nur der Client kannte die echte Summe (BadgeContext.totalBadgeCount),
//   konnte sie aber bei geschlossener App nicht setzen.
//
// Warum der Server rechnen muss und nicht einfach gar nichts setzt: Bei
// geschlossener App gibt es keinen Client. Genau dann ist das Icon aber das
// Einzige, was jemand sieht, bevor er die App oeffnet. Ohne Badge im Push
// bliebe es auf dem letzten Stand stehen.
//
// Diese Datei haelt die Summe an EINER Stelle. Sie muss mit
// BadgeContext.totalBadgeCount uebereinstimmen -- dieselbe Aufteilung je
// Rolle, dieselben Bestandteile. Aendert sich eine Seite, gehoert die andere
// nachgezogen; ein Test haelt die Zusammensetzung fest.

/**
 * Zaehlt alles, was fuer eine Person offen ist -- exakt so, wie es der
 * Client im App-Icon anzeigt.
 *
 * Aufteilung je Rolle (identisch zu BadgeContext.totalBadgeCount):
 *   admin      Chat + offene Antraege + unverarbeitete Termine + Freigaben
 *   teamer     Chat + Freigaben + ungesehene Abzeichen
 *   konfi      Chat + ungesehene Abzeichen
 *
 * Fuer super_admin gilt der Konfi-Zweig (org-fremde Rolle, hat weder
 * Antraege noch Abzeichen) -- der Client schliesst sie ueber isAdmin
 * ebenfalls aus.
 *
 * @param {object} db          Pool oder Client
 * @param {object} empfaenger  { id, type, organization_id, role_name?, assigned_jahrgaenge? }
 * @returns {Promise<number>}  Summe, nie negativ
 */
async function berechneAppIconSumme(db, empfaenger) {
  const userId = empfaenger.id;
  const userType = empfaenger.type;
  const organizationId = empfaenger.organization_id;

  // Wie im Client: super_admin zaehlt NICHT als Admin-Typ.
  const isAdminType = userType === 'admin' && empfaenger.role_name !== 'super_admin';
  const zero = Promise.resolve({ rows: [{ c: 0 }] });

  // Chat-Unread. Eigene Nachrichten zaehlen nicht mit -- dieselbe Bedingung
  // wie in badge-counts und im Hintergrunddienst.
  const chatPromise = db.query(
    `SELECT COALESCE(SUM(
       (SELECT COUNT(*)
          FROM chat_messages m
         WHERE m.room_id = r.id
           AND m.deleted_at IS NULL
           AND m.created_at > COALESCE(crs.last_read_at, '1970-01-01')
           AND NOT (m.user_id = $1 AND m.user_type = $2))
     ), 0)::int AS c
     FROM chat_rooms r
     INNER JOIN chat_participants p ON r.id = p.room_id AND p.user_id = $1 AND p.user_type = $2
     LEFT JOIN chat_read_status crs ON r.id = crs.room_id AND crs.user_id = $1 AND crs.user_type = $2
     WHERE r.organization_id = $3`,
    [userId, userType, organizationId]
  );

  const requestsPromise = isAdminType
    ? db.query(
        `SELECT COUNT(*)::int AS c
           FROM activity_requests ar
           JOIN activities a ON ar.activity_id = a.id
          WHERE a.organization_id = $1 AND ar.status = 'pending'`,
        [organizationId]
      )
    : zero;

  const eventsPromise = isAdminType
    ? db.query(
        `SELECT COUNT(*)::int AS c
           FROM events e
          WHERE e.organization_id = $1
            AND e.event_date < NOW()
            AND EXISTS (
              SELECT 1 FROM event_bookings eb
               WHERE eb.event_id = e.id
                 AND eb.status = 'confirmed'
                 AND eb.attendance_status IS NULL
            )`,
        [organizationId]
      )
    : zero;

  // Offene Challenge-Freigaben. Der Teamer-Zweig schliesst 'nur_team'
  // ausdruecklich ein: Solche Runden haben per Definition keine
  // Jahrgangs-Zuordnung, sind aber fuer jede:n Teamer:in der Organisation
  // moderierbar (Migration 121, Befund H4).
  let challengesPromise = zero;
  if (isAdminType) {
    challengesPromise = db.query(
      `SELECT COUNT(*)::int AS c
         FROM challenge_submissions cs
         JOIN challenges c ON cs.challenge_id = c.id
        WHERE c.organization_id = $1 AND cs.moderation_status = 'pending'`,
      [organizationId]
    );
  } else if (userType === 'teamer') {
    const teamerJahrgangIds = (empfaenger.assigned_jahrgaenge || [])
      .filter((j) => j.can_view)
      .map((j) => j.id);
    challengesPromise = db.query(
      `SELECT COUNT(*)::int AS c
         FROM challenge_submissions cs
         JOIN challenges c ON cs.challenge_id = c.id
        WHERE c.organization_id = $1
          AND cs.moderation_status = 'pending'
          AND (
            c.audience = 'nur_team'
            OR EXISTS (
              SELECT 1 FROM challenge_jahrgang_assignments cja
               WHERE cja.challenge_id = c.id AND cja.jahrgang_id = ANY($2::int[])
            )
          )`,
      [organizationId, teamerJahrgangIds]
    );
  }

  // Ungesehene Abzeichen. Die Leitung kann keine verdienen -> immer 0.
  const badgesPromise = (userType === 'konfi' || userType === 'teamer')
    ? db.query(
        `SELECT COUNT(*)::int AS c
           FROM user_badges ub
           JOIN custom_badges cb ON ub.badge_id = cb.id
          WHERE ub.user_id = $1
            AND ub.organization_id = $2
            AND ub.seen = false
            AND COALESCE(cb.target_role, 'konfi') = $3`,
        [userId, organizationId, userType]
      )
    : zero;

  const [chat, requests, events, challenges, badges] = await Promise.all([
    chatPromise, requestsPromise, eventsPromise, challengesPromise, badgesPromise
  ]);

  const summe =
    (chat.rows[0]?.c || 0) +
    (requests.rows[0]?.c || 0) +
    (events.rows[0]?.c || 0) +
    (challenges.rows[0]?.c || 0) +
    (badges.rows[0]?.c || 0);

  return Math.max(0, summe);
}

/**
 * Wie oben, aber fehlertolerant: Schlaegt die Zaehlung fehl, kommt null
 * zurueck statt eines Fehlers. Der Aufrufer laesst den Badge dann weg --
 * eine Push-Nachricht darf nicht daran scheitern, dass eine Zahl fehlt.
 */
async function appIconSummeOderNull(db, empfaenger) {
  try {
    return await berechneAppIconSumme(db, empfaenger);
  } catch (err) {
    console.error('App-Icon-Summe konnte nicht berechnet werden:', err);
    return null;
  }
}

module.exports = { berechneAppIconSumme, appIconSummeOderNull };
