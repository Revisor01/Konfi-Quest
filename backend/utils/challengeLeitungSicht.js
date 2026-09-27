// Wer aus der Leitung eine Challenge sieht, sie zaehlt und Mitteilungen zu
// ihr bekommt -- EINE Regel fuer alle Stellen (27.09.2026).
//
// Simon, 27.09.2026 -- drei Zielgruppen:
//   "nur Team (ohne Jahrgang alle im Team, Teamer, Admins, org Admins)
//    Team und Konfi (jahrgangsgebunden, mehrere moeglich: alle Konfis,
//      Teamer, Admins, org Admins)
//    Konfis (jahrgangsgebunden, mehrere moeglich: alle Konfis, Teamer,
//      Admins, org Admins) -- Konfis, weil wir damit arbeiten und die
//      Teamer das auch sehen muessen."
//
//   org_admin        jede Challenge der Gemeinde
//   admin, teamer    'nur_team' immer; 'konfis_und_team' und 'konfis' nur
//                    mit einem zugewiesenen Jahrgang der Challenge
//
// Eine erste Fassung am selben Tag liess Admins 'konfis_und_team' auch ohne
// Jahrgang sehen; Simon hat das korrigiert ("Konfis und Team darf auch nur
// ein Admin sehen und ein Teamer, der in dem Jahrgang ist").
//
// Bis dahin stand die Regel an sieben Stellen einzeln (Sichtpruefung,
// Leitungsliste, Teilnehmerliste, Dateiauslieferung, Reiter-Zaehler,
// App-Symbol-Zaehler, Mitteilungsempfaenger) -- und die Mitteilung kannte
// gar keine Bindung: Jeder Admin bekam zu jeder Challenge eine Nachricht,
// sah sie aber in Liste und Reiter nicht.

/** Teilnahmekreis, den das ganze Team ohne Jahrgang sieht. */
const TEAM_ORGWEITE_AUDIENCES = ['nur_team'];

/**
 * SQL-Bedingung "diese Leitungsrolle sieht Challenge <c>".
 *
 * @param {object} opt
 * @param {string} opt.rolle       SQL-Ausdruck fuer den Rollennamen (z. B. '$2', 'z.rolle')
 * @param {string} opt.jahrgaenge  SQL-Ausdruck fuer die can_view-Jahrgaenge als int[]
 * @param {string} [opt.c='c']     Alias der challenges-Tabelle
 * @returns {string}
 */
function leitungSiehtChallengeSql({ rolle, jahrgaenge, c = 'c' }) {
  return `(
    ${rolle} = 'org_admin'
    OR ${c}.audience = 'nur_team'
    OR EXISTS (
      SELECT 1 FROM challenge_jahrgang_assignments cja_sicht
       WHERE cja_sicht.challenge_id = ${c}.id
         AND cja_sicht.jahrgang_id = ANY(${jahrgaenge})
    )
  )`;
}

/**
 * Dieselbe Regel in JavaScript, fuer Stellen ohne passende Abfrage.
 *
 * @param {string} rolle
 * @param {string} audience
 * @param {number[]} challengeJahrgaenge  Jahrgaenge der Challenge
 * @param {number[]} eigeneJahrgaenge     can_view-Jahrgaenge der Person
 */
function leitungSiehtChallenge(rolle, audience, challengeJahrgaenge, eigeneJahrgaenge) {
  if (rolle === 'org_admin') return true;
  if (audience === 'nur_team') return true;
  const eigene = new Set((eigeneJahrgaenge || []).map(Number));
  return (challengeJahrgaenge || []).some((id) => eigene.has(Number(id)));
}

module.exports = { leitungSiehtChallengeSql, leitungSiehtChallenge, TEAM_ORGWEITE_AUDIENCES };
