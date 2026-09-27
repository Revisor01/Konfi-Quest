// Wer aus der Leitung eine Challenge sieht, sie zaehlt und Mitteilungen zu
// ihr bekommt -- EINE Regel fuer alle Stellen (27.09.2026).
//
// Simon: "Admins sehen nur und kriegen auch nur Infos zu Challenges, an denen
// sie beteiligt sind, aber Admins sind ja theoretisch an jeder Team-Challenge
// beteiligt. Also immer wenn Konfi und Team oder nur Team ausgewaehlt ist,
// dann kriegen die Admins das. Wenn es nur Konfis sind, mit Jahrgangsbindung,
// und die sind da nicht drin, dann kriegen sie es auch nicht."
//
//   org_admin  jede Challenge der Gemeinde
//   admin      'konfis_und_team' und 'nur_team' immer (das Team ist
//              beteiligt, und Admins gehoeren zum Team); 'konfis' nur mit
//              einem zugewiesenen Jahrgang der Challenge
//   teamer     'nur_team' immer (Migration 121, Befund H4); sonst nur mit
//              einem zugewiesenen Jahrgang der Challenge
//
// Bis dahin stand die Regel an sieben Stellen einzeln (Sichtpruefung,
// Leitungsliste, Teilnehmerliste, Dateiauslieferung, Reiter-Zaehler,
// App-Symbol-Zaehler, Mitteilungsempfaenger) -- und die Mitteilung kannte
// gar keine Bindung: Jeder Admin bekam zu jeder Challenge eine Nachricht,
// sah sie aber in Liste und Reiter nicht.

/** Teilnahmekreise, an denen ein Admin ohne Jahrgang beteiligt ist. */
const ADMIN_ORGWEITE_AUDIENCES = ['konfis_und_team', 'nur_team'];

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
    OR (${rolle} = 'admin' AND ${c}.audience = 'konfis_und_team')
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
  if (rolle === 'admin' && audience === 'konfis_und_team') return true;
  const eigene = new Set((eigeneJahrgaenge || []).map(Number));
  return (challengeJahrgaenge || []).some((id) => eigene.has(Number(id)));
}

module.exports = { leitungSiehtChallengeSql, leitungSiehtChallenge, ADMIN_ORGWEITE_AUDIENCES };
