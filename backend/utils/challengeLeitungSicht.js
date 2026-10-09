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

// DARF FREIGEBEN (09.10.2026, "Darf freigeben", utils/freigabeRechte.js):
// Beitraege moderieren (freigeben, ausblenden, wieder einblenden, anonym
// stellen) darf, wer die Challenge mit den Jahrgaengen SEINES RECHTS sieht --
// dieselbe Bedingung (leitungSiehtChallengeSql), ausgewertet mit
// rechtFuer(user, 'challenges'); "Nur das Team", wenn das Recht fuer
// Vorgaenge ohne Jahrgang besteht. Org-Admin immer; Admins UND Teamer:innen
// nach dem Recht an ihren Jahrgaengen (Teamer:innen seit 09.10.2026, Simon:
// "dasselbe Rechtemanagement je Jahrgang"). Daran haengen:
//   - Server-Pruefung: PUT /challenges/admin/submissions/:id/moderate
//     (darfChallengeFreigeben, 403 ohne Recht)
//   - Feld darf_freigeben an der Challenge (GET /challenges/admin/:id)
//   - Zaehler: badge-counts.pendingChallenges/challengeApprovals,
//     App-Symbol, Gemeinde-Umschalter (utils/appIconBadge.js)
//   - Push "Neuer Challenge-Beitrag" (ladeLeitungZumChallengeBeitrag): bei
//     moderierten Challenges an, wer freigeben darf; dazu die
//     Kennzahlen-Wahl (Bereich 'challenges'), die Leitung und Teamer:innen
//     gleich haben
// Liste, Galerie und Neuigkeiten bleiben bei der Sicht.

/** Teilnahmekreis, den das ganze Team ohne Jahrgang sieht. */
const { nichtGesperrtIn, ladeMitgliederDerOrganisation } = require('./orgMitglieder');
const { abfragenBuendeln } = require('./abfragenBuendeln');
const { rechtFuer, rechtJahrgaengeSql, rechtOhneJahrgangSql } = require('./freigabeRechte');
const TEAM_ORGWEITE_AUDIENCES = ['nur_team'];

/**
 * SQL-Bedingung "diese Leitungsrolle sieht Challenge <c>".
 *
 * @param {object} opt
 * @param {string} opt.rolle       SQL-Ausdruck fuer den Rollennamen (z. B. '$2', 'z.rolle')
 * @param {string} opt.jahrgaenge  SQL-Ausdruck fuer die can_view-Jahrgaenge als int[]
 *   (fuer "darf freigeben": die Jahrgaenge des Rechts)
 * @param {string} [opt.ohneJahrgang='true']  SQL-Ausdruck (boolean): zaehlt
 *   "Nur das Team"? Fuer die Sicht immer, fuer "darf freigeben" das Recht
 *   ohne Jahrgang (utils/freigabeRechte.js)
 * @param {string} [opt.c='c']     Alias der challenges-Tabelle
 * @returns {string}
 */
function leitungSiehtChallengeSql({ rolle, jahrgaenge, ohneJahrgang = 'true', c = 'c' }) {
  return `(
    ${rolle} = 'org_admin'
    OR (${c}.audience = 'nur_team' AND ${ohneJahrgang})
    OR EXISTS (
      SELECT 1 FROM challenge_jahrgang_assignments cja_sicht
       WHERE cja_sicht.challenge_id = ${c}.id
         AND cja_sicht.jahrgang_id = ANY(${jahrgaenge})
    )
  )`;
}

// --------------------------------------------------------------------
// WER AUS DEM TEAM MITMACHT (27.09.2026, Audit "Wer bekommt was", BF-07 /
// F-04).
//
// Mitmachen = die Challenge in der eigenen Teilnahme-Liste haben und
// einreichen duerfen: GET /api/challenges/konfi fuer Team-Rollen und
// maySubmit in routes/challenges.js. Das Team macht bei 'konfis_und_team'
// und 'nur_team' mit, bei 'konfis' nicht (dort liest es nur mit). Welche
// dieser Challenges eine Person sieht, sagt die Regel oben.
//
// Dieselbe Bedingung bestimmt
//   - die Teilnahme-Liste des Teams (GET /api/challenges/konfi),
//   - die Empfaenger der Start-Mitteilung "Neue Challenge" im Team
//     (ladeTeamDasMitmacht, pushService.sendChallengeStartedToJahrgaenge),
//   - "neue Challenge" im Neuigkeiten-Zaehler des Teams
//     (utils/challengeNeuigkeiten.js).
// Bis dahin bekam das Team beim Start nichts -- bei 'nur_team' also
// niemand -- und hatte fuer eine neue Challenge keine Zahl.
// --------------------------------------------------------------------

/** Teilnahmekreise, in denen das Team selbst einreicht. */
const TEAM_MACHT_MIT_AUDIENCES = ['konfis_und_team', 'nur_team'];

/**
 * SQL-Bedingung "diese Team-Rolle macht bei Challenge <c> mit".
 * Parameter wie leitungSiehtChallengeSql.
 */
function teamMachtMitSql({ rolle, jahrgaenge, c = 'c' }) {
  return `(
    ${c}.audience IN (${TEAM_MACHT_MIT_AUDIENCES.map((a) => `'${a}'`).join(', ')})
    AND ${leitungSiehtChallengeSql({ rolle, jahrgaenge, c })}
  )`;
}

/**
 * Alle aus dem Team der Gemeinde, die bei Challenge <challengeId>
 * mitmachen: Rollen org_admin, admin, teamer; beide Quellen der
 * Zugehoerigkeit (Stamm-Gemeinde mit users.role_id, weitere mit
 * user_organizations.role_id -- fuehrt user_organizations die
 * Stamm-Gemeinde doppelt, gilt die Rolle am Konto, wie in
 * orgMitglieder.ladeMitgliedschaftenDerPerson). Jahrgaenge wie in Liste und
 * Zaehler nur mit can_view. Gesperrte und geloeschte Konten nicht.
 *
 * @param {object} db
 * @param {number} challengeId
 * @returns {Promise<Array<number>>} Nutzer-IDs ohne Doppelte
 */
async function ladeTeamDasMitmacht(db, challengeId) {
  const { rows } = await db.query(
    `WITH mitglieder AS (
       SELECT DISTINCT ON (m.user_id) m.user_id, m.rolle
         FROM (
           SELECT u.id AS user_id, r.name AS rolle, 0 AS rang
             FROM challenges ch
             JOIN users u ON u.organization_id = ch.organization_id
             JOIN roles r ON r.id = u.role_id
            WHERE ch.id = $1
              AND u.is_active = true
              AND u.deleted_at IS NULL
              AND ${nichtGesperrtIn('u', 'ch.organization_id')}
           UNION ALL
           SELECT u.id, r.name, 1
             FROM challenges ch
             JOIN user_organizations uo ON uo.organization_id = ch.organization_id
             JOIN users u ON u.id = uo.user_id
             JOIN roles r ON r.id = uo.role_id
            WHERE ch.id = $1
              AND u.is_active = true
              AND uo.is_active = true
              AND u.deleted_at IS NULL
         ) m
        ORDER BY m.user_id, m.rang
     )
     SELECT m.user_id
       FROM mitglieder m
       JOIN challenges c ON c.id = $1
      WHERE m.rolle IN ('org_admin', 'admin', 'teamer')
        AND ${teamMachtMitSql({
          rolle: 'm.rolle',
          jahrgaenge: `ARRAY(SELECT uja.jahrgang_id FROM user_jahrgang_assignments uja
                              WHERE uja.user_id = m.user_id AND uja.can_view = true)`
        })}
      ORDER BY m.user_id`,
    [challengeId]
  );
  return rows.map((r) => r.user_id);
}

/**
 * Das Recht "challenges" des Aufrufers als SQL-Bedingung ueber
 * leitungSiehtChallengeSql. Parameter an `params`.
 */
function darfFreigebenBedingung(user, params, { c = 'c' } = {}) {
  const recht = rechtFuer(user, 'challenges');
  params.push(user.role_name);
  const rolle = `$${params.length}`;
  params.push(recht.jahrgaenge);
  return leitungSiehtChallengeSql({
    rolle,
    jahrgaenge: `$${params.length}::int[]`,
    ohneJahrgang: recht.ohneJahrgang ? 'true' : 'false',
    c
  });
}

/**
 * Darf der Aufrufer Beitraege dieser Challenge moderieren?
 *
 * @param {object} db
 * @param {object} req
 * @param {number|string} challengeId
 * @returns {Promise<boolean>}
 */
async function darfChallengeFreigeben(db, req, challengeId) {
  if (req.user.role_name === 'org_admin') return true;
  const params = [challengeId];
  const bedingung = darfFreigebenBedingung(req.user, params);
  const { rows: [treffer] } = await db.query(
    `SELECT 1 FROM challenges c WHERE c.id = $1 AND ${bedingung}`,
    params
  );
  return !!treffer;
}

/**
 * Wer die Mitteilung "Neuer Challenge-Beitrag" bekommt (Push).
 *
 *   org_admin        immer
 *   admin, teamer    moderierte Challenge: wer freigeben darf; sonst wer sieht
 * Alle zusaetzlich nur mit Kennzahl 'challenges' an
 * (utils/leitungKennzahlen.js) -- das filtert die Aufrufstelle nicht,
 * sondern diese Funktion, damit Push und Zahl nicht auseinanderlaufen.
 *
 * Beide Quellen der Zugehoerigkeit ueber ladeMitgliederDerOrganisation.
 *
 * @param {object} db
 * @param {number} challengeId
 * @param {object} [opt]
 * @param {boolean} [opt.moderiert=false]
 * @param {number|null} [opt.ausser]  wer eingereicht hat
 * @returns {Promise<number[]>} aufsteigend, ohne Doppelte
 */
async function ladeLeitungZumChallengeBeitrag(db, challengeId, { moderiert = false, ausser = null } = {}) {
  const { rows: [challenge] } = await db.query(
    'SELECT organization_id FROM challenges WHERE id = $1',
    [challengeId]
  );
  if (!challenge) return [];
  const orgId = challenge.organization_id;

  const [orgAdmins, admins, teamer] = await abfragenBuendeln(db, [
    () => ladeMitgliederDerOrganisation(db, orgId, ['org_admin']),
    () => ladeMitgliederDerOrganisation(db, orgId, ['admin']),
    () => ladeMitgliederDerOrganisation(db, orgId, ['teamer'])
  ]);

  const SICHT = `ARRAY(SELECT uja.jahrgang_id::int FROM user_jahrgang_assignments uja
                        WHERE uja.user_id = u.id AND uja.can_view = true)`;
  const filtern = async (ids, { jahrgaenge, ohneJahrgang, rolle }) => {
    if (ids.length === 0) return [];
    const { rows } = await db.query(
      `SELECT u.id FROM users u JOIN challenges c ON c.id = $2
        WHERE u.id = ANY($1::bigint[])
          AND ${leitungSiehtChallengeSql({ rolle: `'${rolle}'`, jahrgaenge, ohneJahrgang })}`,
      [ids, challengeId]
    );
    return rows.map((r) => r.id);
  };

  // Admins und Teamer:innen nach derselben Regel: bei moderierten
  // Challenges die Jahrgaenge des Rechts, sonst die der Sicht.
  const nachRegel = (rolle) => (moderiert
    ? {
        rolle,
        jahrgaenge: rechtJahrgaengeSql('challenges', 'u.id'),
        ohneJahrgang: rechtOhneJahrgangSql('challenges', 'u.id', 'c.organization_id')
      }
    : { rolle, jahrgaenge: SICHT, ohneJahrgang: 'true' });
  const [adminsMit, teamerMit] = await abfragenBuendeln(db, [
    () => filtern(admins, nachRegel('admin')),
    () => filtern(teamer, nachRegel('teamer'))
  ]);

  // Kennzahlen-Wahl (Bereich 'challenges') -- Leitung und Teamer:innen.
  const kandidaten = [...new Set([...orgAdmins, ...adminsMit, ...teamerMit].map(Number))];
  const { rows: abgewaehlt } = kandidaten.length > 0
    ? await db.query(
        `SELECT user_id FROM leitung_kennzahlen
          WHERE organization_id = $1 AND user_id = ANY($2::bigint[]) AND challenges = false`,
        [orgId, kandidaten]
      )
    : { rows: [] };
  const aus = new Set(abgewaehlt.map((r) => Number(r.user_id)));

  const empfaenger = new Set();
  for (const id of kandidaten.filter((x) => !aus.has(x))) {
    if (ausser != null && id === Number(ausser)) continue;
    empfaenger.add(id);
  }
  return [...empfaenger].sort((x, y) => x - y);
}

module.exports = {
  darfFreigebenBedingung,
  darfChallengeFreigeben,
  ladeLeitungZumChallengeBeitrag,
  leitungSiehtChallengeSql,
  TEAM_ORGWEITE_AUDIENCES,
  TEAM_MACHT_MIT_AUDIENCES,
  teamMachtMitSql,
  ladeTeamDasMitmacht
};
