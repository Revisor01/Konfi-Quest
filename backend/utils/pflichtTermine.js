// Pflicht-Events einer Konfi: welche sind faellig, welche besucht -- EINE
// Regel fuer die Konfi-Liste der Leitung (GET /api/admin/konfis,
// pflicht_besucht / pflicht_faellig) und die Anwesenheits-Statistik
// (GET /api/admin/konfis/:id/attendance-stats, attended / total_mandatory).
// CLAUDE.md: Liste und Zaehler lesen dieselbe Regel-Stelle, sonst laufen sie
// auseinander.
//
// Simon, 13.10.2026: "3 von 5" -- besucht von bisher faelligen;
// "entschuldigt zaehlt als nicht besucht".
//
//   faellig   Pflicht-Event (events.mandatory) der Gemeinde, das die Konfi
//             sieht (eigener Jahrgang oder Termin ohne jeden Jahrgang, nie
//             "Nur Team" -- utils/konfiTerminSicht.js), nicht abgesagt und
//             schon begonnen (event_date in der Vergangenheit).
//   besucht   Anwesenheit "anwesend" (attendance_status 'present').
//             Entschuldigt, abwesend, abgemeldet oder nicht eingetragen
//             zaehlt als nicht besucht.
//
// BIS 13.10.2026 hatte die Statistik ihre eigene Bedingung (INNER JOIN auf
// den Jahrgang der Konfi): Ein Pflicht-Event ohne Jahrgang fehlte, ein
// "Nur Team"-Termin mit Jahrgang zaehlte mit, und eine Konfi ohne Jahrgang
// bekam immer 0 von 0. Die Antwortform der Statistik bleibt dieselbe.
//
// NOCH NICHT auf dieser Regel: die Summe der Anwesenheits-Matrix
// (frontend/src/utils/anwesenheitsMatrix.ts: auch kuenftige Termine,
// entschuldigt und abgemeldet nicht im Nenner) und die Anwesenheitsliste per
// E-Mail (routes/jahrgaenge.js, matrix-email: auch kuenftige, nur abgemeldet
// nicht im Nenner). Offen bei Simon: docs/offene-befunde.md, "Pflicht-Events:
// drei Zaehlweisen fuer dieselbe Konfi"; ebenso, ob Termine vor dem Eintritt
// in den Jahrgang faellig sind ("Pflicht-Events vor dem Eintritt in den
// Jahrgang").

const { konfiSiehtTerminSql } = require('./konfiTerminSicht');

/**
 * SQL-Bedingung: Termin <e> ist fuer eine Konfi des Jahrgangs <jahrgang>
 * ein faelliges Pflicht-Event der Gemeinde <org>.
 *
 * @param {object} opt
 * @param {string} opt.jahrgang  SQL-Ausdruck fuer den Jahrgang der Konfi
 *                               (z. B. '$2' oder 'kp.jahrgang_id'); NULL =
 *                               Konfi ohne Jahrgang
 * @param {string} opt.org       SQL-Ausdruck fuer die Gemeinde (z. B. '$1')
 * @param {string} [opt.e='e']   Alias der events-Tabelle
 * @returns {string}
 */
function pflichtFaelligSql({ jahrgang, org, e = 'e' }) {
  return `(
    ${e}.mandatory = true
    AND ${e}.cancelled IS NOT TRUE
    AND ${e}.event_date < NOW()
    AND ${e}.organization_id = ${org}
    AND ${konfiSiehtTerminSql({ jahrgang, e })}
  )`;
}

/**
 * SQL-Bedingung: die Buchung <eb> zaehlt als besucht.
 *
 * @param {string} [eb='eb']  Alias der event_bookings-Tabelle
 * @returns {string}
 */
function pflichtBesuchtSql(eb = 'eb') {
  return `(${eb}.attendance_status = 'present')`;
}

/**
 * WITH-Bausteine fuer Listen: je Konfi der Gemeinde <org> pflicht_faellig und
 * pflicht_besucht als ganze Zahlen. Der Aufrufer setzt den Text hinter
 * "WITH" und joint `LEFT JOIN pflicht_stand ps ON ps.user_id = u.id`; eine
 * Konfi ohne faellige Pflicht-Events hat dort keine Zeile (COALESCE auf 0).
 *
 * Eine Abfrage fuer die ganze Liste. Die Sichtregel wird je Jahrgang und
 * Termin geprueft, nicht je Konfi und Termin -- gemessen am 13.10.2026 mit
 * 212 Konfis in 3 Jahrgaengen und 125 vergangenen Pflicht-Events (Median aus
 * 25 Laeufen, EXPLAIN ANALYZE): Liste ohne Zaehler 0,6 ms, mit einer
 * LATERAL-Unterabfrage je Konfi 25,9 ms, mit diesen Bausteinen 8,1 ms.
 *
 * @param {object} opt
 * @param {string} opt.org  SQL-Ausdruck fuer die Gemeinde (z. B. '$1')
 * @returns {string}  zwei CTE-Definitionen: pflicht_faellig_je_jahrgang, pflicht_stand
 */
function pflichtStandCteSql({ org }) {
  // Die Jahrgaenge der Konfis dieser Gemeinde, NULL fuer "ohne Jahrgang".
  // COALESCE(..., 0) im Join: Jahrgangs-IDs sind positiv, 0 steht fuer
  // "ohne Jahrgang" -- so bleibt der Join ein Gleichheits-Join.
  return `pflicht_faellig_je_jahrgang AS MATERIALIZED (
      SELECT jg.jahrgang_id, e_pflicht.id AS event_id
        FROM (SELECT DISTINCT kp_pflicht.jahrgang_id
                FROM konfi_profiles kp_pflicht
                JOIN users u_pflicht ON u_pflicht.id = kp_pflicht.user_id
               WHERE u_pflicht.organization_id = ${org}) jg
        JOIN events e_pflicht ON ${pflichtFaelligSql({ jahrgang: 'jg.jahrgang_id', org, e: 'e_pflicht' })}
    ),
    pflicht_stand AS (
      SELECT kp_stand.user_id,
             COUNT(*)::int AS pflicht_faellig,
             (COUNT(*) FILTER (WHERE ${pflichtBesuchtSql('eb_pflicht')}))::int AS pflicht_besucht
        FROM konfi_profiles kp_stand
        JOIN users u_stand ON u_stand.id = kp_stand.user_id AND u_stand.organization_id = ${org}
        JOIN pflicht_faellig_je_jahrgang pf
          ON COALESCE(pf.jahrgang_id, 0) = COALESCE(kp_stand.jahrgang_id, 0)
        LEFT JOIN event_bookings eb_pflicht
               ON eb_pflicht.event_id = pf.event_id AND eb_pflicht.user_id = kp_stand.user_id
       GROUP BY kp_stand.user_id
    )`;
}

module.exports = { pflichtFaelligSql, pflichtBesuchtSql, pflichtStandCteSql };
