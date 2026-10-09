// Wer aus der Leitung einen Aktivitaets-Antrag sieht, ihn zaehlt und die
// Mitteilung "Neuer Antrag eingegangen" bekommt -- EINE Regel fuer alle
// Stellen (27.09.2026).
//
// Simon, 27.09.2026: "Antraege duerfen auch nur an Admins des Jahrgangs
// gehen." Derselbe Grundsatz wie bei den Challenges (utils/
// challengeLeitungSicht.js): Org-Admins sehen und bekommen alles ihrer
// Gemeinde; Admins nur, was einen Bezug zu ihren zugewiesenen Jahrgaengen
// hat. Eine Mitteilung bekommt, wer den Vorgang in seiner Liste sieht und
// bearbeiten darf -- nicht mehr und nicht weniger.
//
//   org_admin, super_admin    jeder Antrag der Gemeinde
//   (Rolle ODER Merkmal
//   users.is_super_admin)
//   admin                     Antraege von Teamer:innen immer (Simons Regel
//                             vom 31.08.2026: "admin sieht jahrgang und alle
//                             teamer"); Konfi-Antraege nur, wenn der
//                             Jahrgang des Konfis (konfi_profiles.jahrgang_id)
//                             unter seinen can_view-Zuweisungen steht
//   teamer                    keine -- GET/PUT /admin/activities/requests
//                             stehen hinter requireAdmin (rbac.js: nur
//                             org_admin und admin). In Beschreibung und Foto
//                             kann Privates stehen; Teamer:innen sehen
//                             Antraege nicht und bekommen deshalb auch keine
//                             Mitteilung.
//
// KONFI OHNE JAHRGANG: kp.jahrgang_id IS NULL trifft kein `= ANY(...)` --
// den Antrag sieht nur die org-weite Leitung, also bekommt nur sie die
// Mitteilung. Genauso entscheidet darfKonfi (utils/jahrgangsZugriff.js) beim
// Genehmigen: ohne Jahrgang kommt nur der Vollzugriff durch.
//
// VORHER stand die Regel an drei Stellen einzeln (Antragsliste in
// activities.js, pendingRequests in badge-counts, antragZaehlerGebunden im
// App-Symbol) -- und die Mitteilung kannte gar keine: konfi.js und teamer.js
// schrieben "Neuer Antrag eingegangen" an ladeLeitungDerOrganisation, also an
// JEDEN Admin der Gemeinde, und PushService.sendNewActivityRequestToAdmins
// schickte den Push an dieselben. Ein Admin ohne passende Zuweisung bekam
// damit eine Mitteilung (die an Glocke, Gemeinde-Umschalter und App-Symbol
// mitzaehlte) zu einem Antrag, den er nirgends oeffnen konnte.
//
// BEKANNTE ABWEICHUNG, unveraendert: utils/appIconBadge.js kennt das
// Merkmal is_super_admin nicht und zaehlt einen admin mit Merkmal wie einen
// gebundenen (Begruendung dort: in Produktion tragen es nur
// org_admin-Konten, gemessen 31.08.2026).

// DARF ENTSCHEIDEN (09.10.2026, "Darf freigeben", utils/freigabeRechte.js):
// Wer einen Antrag sieht, darf ueber ihn noch nicht entscheiden. Entscheiden
// darf, wer ihn mit den Jahrgaengen SEINES RECHTS sieht -- dieselbe Bedingung
// unten (gebundeneLeitungSiehtAntragSql), ausgewertet mit
// rechtFuer(user, 'antraege'): Konfi-Antraege ueber den Jahrgang des Konfis,
// Teamer-Antraege, wenn das Recht fuer Vorgaenge ohne Jahrgang besteht.
// Die Org-Leitung darf immer. Daran haengen:
//   - Server-Pruefung: PUT /admin/activities/requests/:id und /:id/reset
//     (darfAntragEntscheiden, 403 ohne Recht)
//   - Liste und Einzelabruf: Feld darf_entscheiden je Antrag
//     (darfAntragEntscheidenSpalte) -- additiv, die Store-Apps ignorieren es
//   - Zaehler: badge-counts.pendingRequests, App-Symbol und
//     Gemeinde-Umschalter (utils/appIconBadge.js)
//   - Empfaenger von "Neuer Antrag eingegangen", Postfach und Push
//     (ladeLeitungZumAntrag); den Push filtert zusaetzlich die
//     Kennzahlen-Wahl (utils/leitungKennzahlen.js, Bereich 'antraege')
// Die LISTE selbst bleibt bei der Sicht: Wer nicht entscheiden darf, sieht
// die Antraege weiter, nur lesend.

const { ladeMitgliederDerOrganisation } = require('./orgMitglieder');
const { abfragenBuendeln } = require('./abfragenBuendeln');
const { rechtFuer, rechtJahrgaengeSql, rechtOhneJahrgangSql } = require('./freigabeRechte');

/**
 * Sieht diese Person ALLE Antraege ihrer aktiven Gemeinde?
 * Dieselbe Definition wie der Vollzugriff in darfJahrgang
 * (utils/jahrgangsZugriff.js).
 *
 * @param {{ role_name?: string, is_super_admin?: boolean }} user  req.user
 * @returns {boolean}
 */
function leitungSiehtAlleAntraege(user) {
  if (!user) return false;
  return user.is_super_admin === true
    || user.role_name === 'org_admin'
    || user.role_name === 'super_admin';
}

/**
 * SQL-Bedingung "ein jahrgangsgebundener Admin mit diesen Jahrgaengen sieht
 * Antrag <ar> zur Aktivitaet <a>".
 *
 * Teamer-Antraege immer, Konfi-Antraege ueber den Jahrgang des Konfis. Ein
 * leeres Array trifft nichts: ohne Zuweisung bleiben nur Teamer-Antraege.
 *
 * @param {object} opt
 * @param {string} opt.jahrgaenge  SQL-Ausdruck fuer die can_view-Jahrgaenge als int[]
 *   (fuer "darf entscheiden": die Jahrgaenge des Rechts)
 * @param {string} [opt.ohneJahrgang='true']  SQL-Ausdruck (boolean): zaehlen
 *   Antraege ohne Jahrgang (Teamer-Antraege)? Fuer die Sicht immer true, fuer
 *   "darf entscheiden" das Recht ohne Jahrgang (utils/freigabeRechte.js)
 * @param {string} [opt.a='a']     Alias der activities-Tabelle
 * @param {string} [opt.ar='ar']   Alias der activity_requests-Tabelle
 * @returns {string}
 */
function gebundeneLeitungSiehtAntragSql({ jahrgaenge, ohneJahrgang = 'true', a = 'a', ar = 'ar' }) {
  return `(
    (${a}.target_role = 'teamer' AND ${ohneJahrgang})
    OR EXISTS (
      SELECT 1 FROM konfi_profiles kp_sicht
       WHERE kp_sicht.user_id = ${ar}.user_id
         AND kp_sicht.jahrgang_id = ANY(${jahrgaenge})
    )
  )`;
}

/**
 * Die Leitung, die ueber diesen Antrag entscheiden darf -- die Empfaenger von
 * "Neuer Antrag eingegangen" (Postfach und Push; den Push filtert die
 * Aufrufstelle zusaetzlich nach der Kennzahlen-Wahl).
 *
 * Beide Quellen der Zugehoerigkeit (users.organization_id UND
 * user_organizations, Rolle je Gemeinde) ueber ladeMitgliederDerOrganisation
 * -- dasselbe Muster wie sendChallengeSubmissionToLeadership. Gesperrte und
 * geloeschte Konten fallen dort schon heraus. Keine Person doppelt; die
 * antragstellende Person nie.
 *
 * @param {object} db
 * @param {number} antragId  activity_requests.id
 * @returns {Promise<number[]>} Nutzer-IDs in aufsteigender Reihenfolge
 */
async function ladeLeitungZumAntrag(db, antragId) {
  const { rows: [antrag] } = await db.query(
    `SELECT ar.user_id, a.organization_id
       FROM activity_requests ar
       JOIN activities a ON a.id = ar.activity_id
      WHERE ar.id = $1`,
    [antragId]
  );
  if (!antrag) return [];

  // Auf dem Client einer Transaktion nacheinander (utils/abfragenBuendeln.js).
  const [orgWeit, admins] = await abfragenBuendeln(db, [
    () => ladeMitgliederDerOrganisation(db, antrag.organization_id, ['org_admin']),
    () => ladeMitgliederDerOrganisation(db, antrag.organization_id, ['admin'])
  ]);

  // Die Rolle admin durch DIESELBE Bedingung wie Zaehler und
  // Server-Pruefung: das Merkmal is_super_admin wie org_admin, sonst die
  // Jahrgaenge, an denen die Person ENTSCHEIDEN darf (seit 09.10.2026, vorher
  // die can_view-Jahrgaenge -- mit der Vorgabe true dieselben). Ein Jahrgang
  // gehoert genau einer Gemeinde -- eine Zuweisung aus einer anderen Gemeinde
  // trifft den Konfi-Jahrgang nie.
  let gebunden = [];
  if (admins.length > 0) {
    const { rows } = await db.query(
      `SELECT u.id
         FROM users u
         JOIN activity_requests ar ON ar.id = $2
         JOIN activities a ON a.id = ar.activity_id
        WHERE u.id = ANY($1::int[])
          AND (
            u.is_super_admin IS TRUE
            OR ${gebundeneLeitungSiehtAntragSql({
              jahrgaenge: rechtJahrgaengeSql('antraege', 'u.id'),
              ohneJahrgang: rechtOhneJahrgangSql('antraege', 'u.id', 'a.organization_id')
            })}
          )`,
      [admins, antragId]
    );
    gebunden = rows.map((r) => r.id);
  }

  const empfaenger = new Set();
  for (const id of [...orgWeit, ...gebunden]) {
    const zahl = Number(id);
    if (zahl === Number(antrag.user_id)) continue;
    empfaenger.add(zahl);
  }
  return [...empfaenger].sort((x, y) => x - y);
}

/**
 * SQL-Ausdruck (boolean) "der Aufrufer darf ueber Antrag <ar> entscheiden"
 * -- fuer das Feld darf_entscheiden in Liste und Einzelabruf. Haengt die
 * Parameter an `params` an (die Abfrage muss activities als `a` und
 * activity_requests als `ar` fuehren).
 *
 * @param {object} user    req.user
 * @param {Array} params   Parameterliste der Abfrage (wird erweitert)
 * @returns {string}
 */
function darfAntragEntscheidenSpalte(user, params) {
  if (leitungSiehtAlleAntraege(user)) return 'true';
  const recht = rechtFuer(user, 'antraege');
  params.push(recht.jahrgaenge);
  const jahrgaenge = `$${params.length}::int[]`;
  return gebundeneLeitungSiehtAntragSql({ jahrgaenge, ohneJahrgang: recht.ohneJahrgang ? 'true' : 'false' });
}

/**
 * Darf der Aufrufer ueber diesen Antrag entscheiden? Server-Pruefung fuer
 * Genehmigen, Ablehnen und Zuruecksetzen. Dieselbe Bedingung wie das Feld
 * darf_entscheiden und die Zaehler.
 *
 * @param {object} db
 * @param {object} req
 * @param {number|string} antragId
 * @returns {Promise<boolean>}
 */
async function darfAntragEntscheiden(db, req, antragId) {
  if (leitungSiehtAlleAntraege(req.user)) return true;
  const params = [antragId, req.user.organization_id];
  const bedingung = darfAntragEntscheidenSpalte(req.user, params);
  const { rows: [treffer] } = await db.query(
    `SELECT 1
       FROM activity_requests ar
       JOIN activities a ON a.id = ar.activity_id
      WHERE ar.id = $1 AND a.organization_id = $2
        AND ${bedingung}`,
    params
  );
  return !!treffer;
}

module.exports = {
  leitungSiehtAlleAntraege,
  gebundeneLeitungSiehtAntragSql,
  ladeLeitungZumAntrag,
  darfAntragEntscheidenSpalte,
  darfAntragEntscheiden
};
