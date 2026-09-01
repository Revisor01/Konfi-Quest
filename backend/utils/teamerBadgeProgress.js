// backend/utils/teamerBadgeProgress.js
// Berechnet fuer EINE Teamer:in die vollstaendige Abzeichen-Liste inkl.
// Fortschritt — das Gegenstueck zu utils/konfiBadgeProgress.js.
//
// Extrahiert aus routes/teamer.js GET /badges (31.08.2026), weil die Route ab
// sofort ZWEI Verpackungen hat: die alte (Array + Kopfzeilen, Vertrag der
// ausgelieferten Apps) und die neue (GET /teamer/badges/v2). Beide muessen
// dieselben Zahlen zeigen. Stuende die Berechnung weiter in der Route, gaebe
// es zwangslaeufig eine zweite Kopie — genau daran ist die Angleichung am
// 28.08.2026 gescheitert.
//
// Diese Datei rechnet NUR. Wie das Ergebnis aussieht (Array, Objekt, mit oder
// ohne Verwaltungsfelder), entscheiden die Verpackungen in der Route.
//
// KONSISTENZ-VERTRAG: Die Zaehl-Semantik jeder Query bleibt identisch zur
// Wertung in badges.js (checkAndAwardTeamerBadges). Progress und Vergabe
// muessen exakt gleich zaehlen, sonst zeigt die App 10/10 ohne dass das
// Abzeichen kommt.

const { computeCurrentStreak } = require('./streakCalculation');
const { berechneBadgeProgress, bedingungFehlt } = require('./badgeProgress');

// Ermittelt Abzeichen (verdient + offen + Fortschritt) fuer eine Teamer:in.
// Erwartet: db (pg Pool), userId (users.id), orgId (organizations.id).
//
// Gibt { alle, earned, available, stats } zurueck:
//   alle       — jedes Abzeichen mit earned/earned_at/unreachable/progress,
//                UNGEFILTERT (die alte Array-Route filtert selbst anders)
//   earned     — alle verdienten (auch geheime und abgeschaltete)
//   available  — offene, nicht geheime, erreichbare
//   stats      — { totalVisible, totalSecret }, nur aktive und erreichbare
async function getTeamerBadgeProgress(db, userId, orgId) {
  const badgesQuery = `
    SELECT cb.*,
      CASE WHEN ub.id IS NOT NULL THEN true ELSE false END as earned,
      ub.awarded_date AS earned_at
    FROM custom_badges cb
    LEFT JOIN user_badges ub ON cb.id = ub.badge_id AND ub.user_id = $1
    WHERE cb.organization_id = $2 AND cb.target_role = 'teamer' AND (cb.is_active = true OR ub.id IS NOT NULL)
    ORDER BY ub.awarded_date DESC NULLS LAST, cb.name
  `;
  const { rows: badges } = await db.query(badgesQuery, [userId, orgId]);

  // Hauptmetriken einmalig abfragen für Fortschrittsberechnung
  const [actCountRes, evCountRes, uniqueActRes, activeYearsRes, teamerSinceRes, categoryCountsRes, actNamesRes, eventTitlesRes, allDatesRes] = await Promise.all([
    // Teamer-Aktivitäten + Events
    db.query(
      `SELECT (
        (SELECT COUNT(*) FROM user_activities ua
         JOIN activities a ON ua.activity_id = a.id
         WHERE ua.user_id = $1 AND ua.organization_id = $2 AND a.target_role = 'teamer') +
        (SELECT COUNT(*) FROM event_bookings WHERE user_id = $1 AND attendance_status = 'present' AND organization_id = $2)
      ) as count`,
      [userId, orgId]
    ),
    // Nur Events
    db.query(
      "SELECT COUNT(*) as count FROM event_bookings WHERE user_id = $1 AND attendance_status = 'present' AND organization_id = $2",
      [userId, orgId]
    ),
    // Unique Activities
    db.query(
      `SELECT COUNT(DISTINCT ua.activity_id) as count FROM user_activities ua
       JOIN activities a ON ua.activity_id = a.id
       WHERE ua.user_id = $1 AND ua.organization_id = $2 AND a.target_role = 'teamer'`,
      [userId, orgId]
    ),
    // Aktive Jahre (Jahre mit mind. 1 Teamer-Aktivität oder Event)
    db.query(
      `SELECT DISTINCT EXTRACT(YEAR FROM d.date)::int as year FROM (
        SELECT ua.completed_date as date FROM user_activities ua
        JOIN activities a ON ua.activity_id = a.id
        WHERE ua.user_id = $1 AND ua.organization_id = $2 AND a.target_role = 'teamer'
        UNION ALL
        SELECT e.event_date as date FROM event_bookings eb
        JOIN events e ON eb.event_id = e.id
        WHERE eb.user_id = $1 AND eb.attendance_status = 'present' AND eb.organization_id = $2
      ) d WHERE d.date IS NOT NULL`,
      [userId, orgId]
    ),
    // Startjahr-Quelle (teamer_since, Migration 064) — konsistent zur Wertung (badges.js teamer_year)
    db.query(
      "SELECT teamer_since FROM users WHERE id = $1",
      [userId]
    ),
    // Pro Kategorie: Anzahl Teamer-Aktivitäten + anwesende Events (für
    // category_activities-Progress). Identische Logik wie die Wertung in
    // badges.js (checkAndAwardTeamerBadges, case 'category_activities').
    db.query(
      `SELECT c.name AS category, COUNT(*) AS count FROM (
        SELECT ac.category_id, ua.id FROM user_activities ua
        JOIN activities a ON ua.activity_id = a.id
        JOIN activity_categories ac ON a.id = ac.activity_id
        WHERE ua.user_id = $1 AND a.organization_id = $2 AND a.target_role = 'teamer'
        UNION ALL
        SELECT ec.category_id, eb.id FROM event_bookings eb
        JOIN event_categories ec ON eb.event_id = ec.event_id
        WHERE eb.user_id = $1 AND eb.attendance_status = 'present' AND eb.organization_id = $2
      ) src
      JOIN categories c ON src.category_id = c.id AND c.organization_id = $2
      GROUP BY c.name`,
      [userId, orgId]
    ),
    // Teamer-Aktivitaets-Namen + Anzahl (für specific_activity / activity_combination).
    db.query(
      `SELECT a.name, COUNT(*) AS count FROM user_activities ua
       JOIN activities a ON ua.activity_id = a.id
       WHERE ua.user_id = $1 AND a.organization_id = $2 AND a.target_role = 'teamer'
       GROUP BY a.name`,
      [userId, orgId]
    ),
    // Besuchte Event-Namen (für activity_combination required_events).
    // events-Spalte heißt 'name' (nicht 'title') -> als title aliasen.
    db.query(
      `SELECT DISTINCT e.name AS title FROM event_bookings eb
       JOIN events e ON eb.event_id = e.id
       WHERE eb.user_id = $1 AND eb.attendance_status = 'present' AND eb.organization_id = $2`,
      [userId, orgId]
    ),
    // Alle Aktivitaets-/Event-Daten (für streak / time_based).
    db.query(
      `SELECT ua.completed_date AS date FROM user_activities ua
       JOIN activities a ON ua.activity_id = a.id
       WHERE ua.user_id = $1 AND ua.organization_id = $2 AND a.target_role = 'teamer'
       UNION ALL
       SELECT e.event_date AS date FROM event_bookings eb
       JOIN events e ON eb.event_id = e.id
       WHERE eb.user_id = $1 AND eb.attendance_status = 'present' AND eb.organization_id = $2`,
      [userId, orgId]
    )
  ]);

  const activityCount = parseInt(actCountRes.rows[0].count);
  const eventCount = parseInt(evCountRes.rows[0].count);
  const uniqueActivities = parseInt(uniqueActRes.rows[0].count);
  // Map statt Plain Object: schuetzt vor Prototype-Keys als Kategorie- oder
  // Aktivitaetsname. Eine Kategorie namens "constructor" haette hier sonst
  // eine Funktion statt einer Zahl geliefert. Der Konfi-Pfad war so schon
  // gehaertet, dieser nicht (Befund N2, 27.08.2026).
  const categoryCounts = new Map(
    categoryCountsRes.rows.map(r => [r.category, parseInt(r.count)])
  );
  const activityNameCounts = new Map(
    actNamesRes.rows.map(r => [r.name, parseInt(r.count)])
  );
  // Set statt Array: activity_combination fragt nur nach Enthaltensein.
  const attendedEventTitles = new Set(eventTitlesRes.rows.map(r => r.title));
  // Datums-Liste (Strings/Dates) für streak / time_based.
  const allDates = allDatesRes.rows.map(r => r.date).filter(Boolean);
  // Array der aktiven Jahre (INTEGER) — für Startjahr-Filter im teamer_year-Case.
  const activeYearValues = activeYearsRes.rows.map(r => r.year);
  // Einmal vorberechnen: Der Wert haengt allein an allDates, wurde aber
  // bisher je Abzeichen neu gerechnet (Befund N2). Der Konfi-Pfad macht
  // es seit jeher einmal.
  const currentStreak = computeCurrentStreak(allDates);

  // Startjahr für teamer_year (konsistent zur Wertung badges.js):
  // 1. users.teamer_since; 2. Fallback aelteste aktive Jahr (entspricht aelteste Teamer-Aktivität).
  let teamerStartYear = null;
  const teamerSince = teamerSinceRes.rows[0]?.teamer_since;
  if (teamerSince) {
    teamerStartYear = new Date(teamerSince).getFullYear();
  } else if (activeYearValues.length > 0) {
    teamerStartYear = Math.min(...activeYearValues);
  }

  // Fortschritt aus dem gemeinsamen Kern (utils/badgeProgress.js), seit
  // dem Zusammenlegen mit dem Konfi-Pfad (Befund N2 Teil 2). Die Zaehler
  // oben bleiben teamer-spezifisch — der Kern rechnet nur.
  //
  // Antwortform seit 28.08.2026 angeglichen an den Konfi-Pfad
  // (utils/konfiBadgeProgress.js): jedes Abzeichen traegt `earned`,
  // `earned_at`, `unreachable` und `progress` ({ current, target,
  // percentage }; percentage UNGERUNDET wie beim Konfi — die Ansicht
  // rundet). Die frueheren Adapter-Felder progress_points /
  // progress_percentage entfallen mit der neuen Huelle.
  const enrichedBadges = badges.map(badge => {
    // Wie beim Konfi: Verdiente Abzeichen sind nie "unerreichbar" —
    // sie sind ja erreicht worden.
    const unreachable = !badge.earned && bedingungFehlt(badge);
    if (badge.earned) {
      return {
        ...badge,
        unreachable,
        progress: { current: badge.criteria_value, target: badge.criteria_value, percentage: 100 }
      };
    }

    const progress = berechneBadgeProgress(badge, {
      // Teamer:innen haben kein Punktekonto — alle Punkte-Kriterien
      // bleiben 0. `beideKategorien: null` sagt dem Kern ausdruecklich
      // "gibt es hier nicht", statt eine 0 vorzutaeuschen.
      beideKategorien: null,
      // ACHTUNG, Namensfalle: `activityCount` enthaelt hier Aktivitaeten
      // UND anwesende Events (die Query addiert beides), beim Konfi nicht.
      // Deshalb heisst das Feld im Kern `aktivitaetenUndEvents`.
      // Deckungsgleich mit der Wertung (`badges.js:395`).
      aktivitaetenUndEvents: activityCount,
      events: eventCount,
      verschiedeneAktivitaeten: uniqueActivities,
      // Nur Jahre ab dem Startjahr (teamer_since) zaehlen — identisch zur
      // Wertung, sonst zeigte die Anzeige mehr Jahre als angerechnet werden.
      teamerJahre: teamerStartYear === null
        ? 0
        : activeYearValues.filter(y => y >= teamerStartYear).length,
      proKategorie: categoryCounts,
      proAktivitaetsname: activityNameCounts,
      // Der Teamer-Pfad zaehlt bei activity_combination auch
      // required_events mit (wie die Wertung in `badges.js:391`); der
      // Konfi-Pfad liefert dieses Feld bewusst nicht.
      erfuellteEventTitel: attendedEventTitles,
      streak: currentStreak,
      alleDaten: allDates
    });

    return { ...badge, unreachable, progress };
  });

  // Aufteilung wie beim Konfi (utils/konfiBadgeProgress.js):
  // `earned` enthaelt ALLE verdienten Abzeichen — auch geheime und
  // inzwischen abgeschaltete, denn verdient ist verdient. `available`
  // enthaelt nur, was noch offen UND anzeigbar ist: keine unverdienten
  // geheimen (die Ueberraschung bleibt gewahrt, Befund 24.08.2026) und
  // keine unerreichbaren (Bedingung fehlt — die Wertung prueft genau
  // dieses Feld, Befund N2, 27.08.2026).
  //
  // Die Punktearten-Haelfte der Konfi-Unerreichbarkeit
  // (gottesdienst_enabled / gemeinde_enabled am Jahrgang) gilt hier
  // NICHT: Teamer:innen haben kein Punktekonto, die Punkte-Kriterien
  // sind fuer sie ohnehin immer 0.
  const earned = enrichedBadges.filter(b => b.earned);
  const available = enrichedBadges.filter(b => !b.earned && !b.is_hidden && !b.unreachable);

  // Gesamtzahlen fuer die Anzeige "x von y".
  //
  // Gezaehlt wird identisch zum Konfi-Pfad: nur AKTIVE Abzeichen
  // (Entscheidung 27.08.2026) und nur ERREICHBARE. Ein unerreichbares
  // Abzeichen steht in keiner Liste — zaehlte es mit, stuende dort ein Ziel,
  // das niemand vollmachen kann.
  const zaehlbar = enrichedBadges.filter(b => b.is_active && !b.unreachable);

  return {
    alle: enrichedBadges,
    earned,
    available,
    stats: {
      totalVisible: zaehlbar.filter(b => !b.is_hidden).length,
      totalSecret: zaehlbar.filter(b => b.is_hidden).length
    }
  };
}

module.exports = { getTeamerBadgeProgress };
