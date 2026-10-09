// „Darf freigeben" (Simon, 09.10.2026; docs/planung/darf-freigeben.md):
// drei Rechte je Jahrgangs-Zuweisung (Migration 204), einzeln festlegbar.
//
//   antraege    darf_antraege_entscheiden   Antraege genehmigen/ablehnen/zuruecksetzen
//   verbuchen   darf_events_verbuchen       Anwesenheit an Terminen eintragen
//   challenges  darf_challenges_freigeben   Challenge-Beitraege moderieren
//
// Diese Datei haelt die MECHANIK des Rechts -- welche Jahrgaenge einer
// Person es tragen und ob sie Vorgaenge ohne Jahrgang darf. WELCHER Vorgang
// an welchem Jahrgang haengt, steht je Vorgang an seiner Regel-Stelle:
//   antraege    utils/antragLeitungSicht.js    (gebundeneLeitungSiehtAntragSql)
//   verbuchen   utils/terminLeitungSicht.js    (gebundeneLeitungSiehtTerminSql)
//   challenges  utils/challengeLeitungSicht.js (leitungSiehtChallengeSql)
// Dort wird dieselbe Bedingung mit den Jahrgaengen DES RECHTS ausgewertet,
// die fuer die Sicht mit den can_view-Jahrgaengen gilt. Liste (Feld darf_...),
// Zaehler, App-Symbol, Push- und Postfach-Empfaenger und Server-Pruefung
// lesen so dieselbe Stelle; tests/utils/freigabeRechteWaechter.test.js haelt
// fest, dass keine davon die Regel umgeht.
//
// WER:
//   org_admin, super_admin    alle drei Rechte immer (Simon: "Org-Admin hat
//   (Rolle oder Merkmal)      alle drei Rechte immer") -- wie der Vollzugriff
//                             in darfJahrgang (utils/jahrgangsZugriff.js)
//   admin                     je zugewiesenem Jahrgang (nur Zuweisungen mit
//                             can_view: ein Jahrgang, den die Person nicht
//                             sieht, kann ihr kein Recht geben)
//   teamer                    je zugewiesenem Jahrgang wie admin (Simon,
//                             09.10.2026: "dasselbe Rechtemanagement je
//                             Jahrgang ... bezogen auf Challenges"). Wirksam
//                             ist fuer sie nur "challenges": Antraege
//                             entscheiden und Verbuchen duerfen Teamer:innen
//                             gar nicht (requireAdmin an
//                             routes/activities.js PUT /requests/:id und
//                             /reset, routes/events/anwesenheit.js) -- daran
//                             aendert das Recht nichts, es gibt keine neue
//                             Befugnis. Die beiden Spalten stehen an ihren
//                             Zuweisungen mit der Vorgabe true und bleiben
//                             ohne Folge.
//
// CAN_VIEW UND CAN_EDIT: Das Recht kommt OBENDRAUF. Es zaehlt nur an
// Zuweisungen mit can_view (ohne Sicht kein Recht); can_edit spielt keine
// Rolle -- es steuert weiter nur das Zuordnen und Bearbeiten an Jahrgang und
// Konfis (utils/jahrgangsZugriff.js) und ist bei Teamer:innen meist false.
//
// VORGAENGE OHNE JAHRGANG (Antraege von Teamer:innen, Termine "Nur Team" und
// ohne Jahrgang, Challenges "Nur das Team"): Ein Admin -- und ebenso eine
// Teamer:in bei "Nur das Team" -- darf sie, wenn er das
// Recht in MINDESTENS EINEM seiner Jahrgaenge hat -- oder keinem Jahrgang
// zugewiesen ist. Dann gibt es nichts, woran es fehlen koennte, und er
// behaelt, was er heute darf (Vorgabe: niemand bekommt nach dem Deploy
// weniger). Ein Admin, dem die Gemeindeleitung das Recht in allen Jahrgaengen
// genommen hat, bekommt auch die Vorgaenge ohne Jahrgang nicht mehr.

/** Die drei Rechte und ihre Spalte an user_jahrgang_assignments. */
const RECHTE = Object.freeze({
  antraege: 'darf_antraege_entscheiden',
  verbuchen: 'darf_events_verbuchen',
  challenges: 'darf_challenges_freigeben'
});

function spalte(recht) {
  const name = RECHTE[recht];
  if (!name) throw new Error(`Unbekanntes Recht: ${recht}`);
  return name;
}

/** Hat diese Person das Recht ueberall (Org-Leitung)? */
function hatAlleRechte(user) {
  if (!user) return false;
  return user.is_super_admin === true
    || user.role_name === 'org_admin'
    || user.role_name === 'super_admin';
}

/**
 * Das Recht einer Person in ihrer aktiven Gemeinde, aus req.user bzw. einem
 * Eintrag von ladeMitgliedschaftenVieler ({ role_name, assigned_jahrgaenge }).
 * assigned_jahrgaenge kommt in beiden Faellen schon auf die Gemeinde
 * beschraenkt (rbac.js, orgMitglieder.js).
 *
 * Fehlt das Feld an einer Zuweisung (Cache aus der Zeit vor Migration 204),
 * gilt es als gesetzt -- wie die Vorgabe der Spalte.
 *
 * @param {object} user
 * @param {'antraege'|'verbuchen'|'challenges'} recht
 * @returns {{ voll: boolean, jahrgaenge: number[], ohneJahrgang: boolean }}
 *   voll: ohne jede Grenze (die Sicht ist das Recht); jahrgaenge: die
 *   Jahrgaenge mit Recht (bei voll: die can_view-Jahrgaenge); ohneJahrgang:
 *   darf Vorgaenge ohne Jahrgang
 */
function rechtFuer(user, recht) {
  const feld = spalte(recht);
  const sichtbar = ((user && user.assigned_jahrgaenge) || []).filter((j) => j.can_view);
  // Volles Recht: Die Jahrgaenge sind dann die der Sicht -- wer die Regel des
  // Vorgangs damit auswertet, bekommt genau, was die Person sieht.
  if (hatAlleRechte(user)) {
    return { voll: true, jahrgaenge: sichtbar.map((j) => Number(j.id)), ohneJahrgang: true };
  }
  // admin und teamer: die Zuweisungen mit Sicht UND Recht (siehe oben).
  const mitRecht = sichtbar.filter((j) => j[feld] !== false);
  return {
    voll: false,
    jahrgaenge: mitRecht.map((j) => Number(j.id)),
    ohneJahrgang: sichtbar.length === 0 || mitRecht.length > 0
  };
}

/**
 * SQL: die Jahrgaenge der Person <userExpr>, an denen sie das Recht hat
 * (int[]). Ein Jahrgang gehoert genau einer Gemeinde -- eine Zuweisung aus
 * einer anderen Gemeinde trifft die Jahrgaenge des Vorgangs nie.
 */
function rechtJahrgaengeSql(recht, userExpr) {
  return `ARRAY(
    SELECT uja_recht.jahrgang_id::int FROM user_jahrgang_assignments uja_recht
     WHERE uja_recht.user_id = ${userExpr}
       AND uja_recht.can_view = true
       AND uja_recht.${spalte(recht)} = true
  )`;
}

/**
 * SQL: darf die Person <userExpr> in der Gemeinde <orgExpr> Vorgaenge ohne
 * Jahrgang? Gleiche Regel wie rechtFuer().ohneJahrgang -- hier je Gemeinde
 * ueber jahrgaenge.organization_id, weil die Person in mehreren Gemeinden
 * Zuweisungen haben kann.
 */
function rechtOhneJahrgangSql(recht, userExpr, orgExpr) {
  return `(
    NOT EXISTS (
      SELECT 1 FROM user_jahrgang_assignments uja_oj
        JOIN jahrgaenge j_oj ON j_oj.id = uja_oj.jahrgang_id
       WHERE uja_oj.user_id = ${userExpr}
         AND j_oj.organization_id = ${orgExpr}
         AND uja_oj.can_view = true
    )
    OR EXISTS (
      SELECT 1 FROM user_jahrgang_assignments uja_oj
        JOIN jahrgaenge j_oj ON j_oj.id = uja_oj.jahrgang_id
       WHERE uja_oj.user_id = ${userExpr}
         AND j_oj.organization_id = ${orgExpr}
         AND uja_oj.can_view = true
         AND uja_oj.${spalte(recht)} = true
    )
  )`;
}

/** Die Rechte-Felder einer Zuweisung als Objekt (Antworten, Vorgabe true). */
function rechteFelder(zuweisung) {
  const felder = {};
  for (const name of Object.values(RECHTE)) felder[name] = zuweisung ? zuweisung[name] !== false : true;
  return felder;
}

module.exports = {
  RECHTE,
  hatAlleRechte,
  rechtFuer,
  rechtJahrgaengeSql,
  rechtOhneJahrgangSql,
  rechteFelder
};
