// Neuigkeiten-Zaehler fuer Challenges (Konfi-Sicht) -- das Gegenstueck zum
// Ungelesen-Zaehler des Chats.
//
// WAS "OFFEN" HEISST (Entscheid 24.09.2026, Simon: "genau wie beim Chat"):
// Im Chat zaehlt jede fremde Nachricht, die nach dem letzten Oeffnen des
// Raums hereinkam. Uebertragen auf eine Challenge zaehlt alles, was sich
// dort seit dem letzten Oeffnen der Detailansicht getan hat und von dem
// die Person sonst nur per Push erfaehrt:
//
//   1. Die Challenge selbst, wenn sie noch nie geoeffnet wurde
//      (Pendant zum Push "Neue Challenge gestartet").
//   2. Fremde Beitraege, die seit dem letzten Oeffnen in der Galerie
//      erschienen sind (Pendant zum Feed-Push). Erschienen heisst
//      freigegeben: approved_at, bei unmoderierten Challenges created_at,
//      weil dort approved_at bewusst NULL bleibt (routes/challenges.js).
//      Gezaehlt wird NUR, was die Person auch sehen darf --
//      PUBLIC_SUBMISSION_SQL, dieselbe Bedingung wie die Galerie. Ein
//      Beitrag "nur fuer die Leitung" erzeugt bei anderen keine Zahl.
//   3. Eigene Beitraege, die seit dem letzten Oeffnen von JEMAND ANDEREM
//      freigegeben oder ausgeblendet wurden (Pendant zu Stempel- und
//      Ausgeblendet-Push). Die eigene Einreichung zaehlt nicht -- wie im
//      Chat die eigene Nachricht.
//
// NUR LAUFENDE CHALLENGES. Nach dem Ende gibt es nichts mehr zu tun, und
// die Zahl staende an einem ausgegrauten Archiv-Eintrag, den man nur durch
// Oeffnen loswuerde. Dieselbe Ueberlegung wie bei abgesagten Terminen im
// Verbuchen-Zaehler: keine Zahl vor einer Liste, in der man nicht handeln
// kann.
//
// NUR KONFIS. Fuer Teamer:innen und die Leitung zaehlt der Challenge-Reiter
// bereits die offenen Freigaben -- ihre Arbeitsliste. Beides in EINER Zahl
// waere fuer sie unlesbar (7 = 3 Freigaben + 4 neue Galerie-Beitraege?).
// Ein Reiter, eine Bedeutung je Rolle.
//
// SICHTBARKEIT. Ein Konfi sieht Challenges seines Jahrgangs, nie 'nur_team',
// nie Entwuerfe, nie ungestartete -- exakt der Scope von GET /challenges/konfi.
// Wer die Challenge nicht oeffnen darf, bekommt auch keine Zahl dafuer.
//
// EINE SQL-FASSUNG fuer beide Abnehmer: GET /notifications/badge-counts
// (Zahl je Challenge fuer Reiter und Listeneintrag) und utils/appIconBadge.js
// (Summe je Person fuers App-Icon im Push). Zwei getrennte Fassungen
// derselben Regel waren der Fehler von Befund B2b -- sie laufen auseinander.
const { PUBLIC_SUBMISSION_SQL } = require('./challengeSichtbarkeit');

/**
 * Neuigkeiten je Challenge fuer viele Konfis in EINER Abfrage.
 *
 * @param {object} db  Pool oder Client
 * @param {Array<{id:number,type:string,organization_id:number}>} konfis
 *        Nur Personen vom Typ 'konfi' werden gezaehlt; andere liefern keine Zeilen.
 * @returns {Promise<Array<{user_id:number,user_type:string,challenge_id:number,c:number}>>}
 *          Nur Challenges mit c > 0.
 */
async function challengeNeuigkeitenJeChallenge(db, konfis) {
  const nurKonfis = (konfis || []).filter((p) => p.type === 'konfi');
  if (nurKonfis.length === 0) return [];

  const { rows } = await db.query(
    `WITH z AS (
       SELECT * FROM unnest($1::int[], $2::text[], $3::int[])
         AS z(user_id, user_type, organization_id)
     ),
     sichtbar AS (
       -- Laufende Challenges des eigenen Jahrgangs, nie 'nur_team'
       -- (derselbe Scope wie GET /challenges/konfi fuer Konfis).
       SELECT z.user_id, z.user_type, c.id AS challenge_id,
              COALESCE(crs.last_read_at, '1970-01-01'::timestamptz) AS gelesen_bis,
              (crs.challenge_id IS NULL) AS nie_geoeffnet
         FROM z
         JOIN konfi_profiles kp ON kp.user_id = z.user_id
         JOIN challenge_jahrgang_assignments cja ON cja.jahrgang_id = kp.jahrgang_id
         JOIN challenges c
           ON c.id = cja.challenge_id
          AND c.organization_id = z.organization_id
          AND c.audience <> 'nur_team'
          AND c.is_draft = false
          AND c.starts_at <= NOW()
          AND c.ends_at >= NOW()
         LEFT JOIN challenge_read_status crs
           ON crs.challenge_id = c.id
          AND crs.user_id = z.user_id
          AND crs.user_type = z.user_type
     )
     SELECT s.user_id, s.user_type, s.challenge_id,
            (
              -- 1. Die Challenge selbst, wenn nie geoeffnet
              CASE WHEN s.nie_geoeffnet THEN 1 ELSE 0 END
              -- 2. Fremde Beitraege, seit dem letzten Oeffnen in der Galerie erschienen
              + (SELECT COUNT(*)
                   FROM challenge_submissions cs
                   JOIN challenges c ON c.id = cs.challenge_id
                  WHERE cs.challenge_id = s.challenge_id
                    AND cs.user_id <> s.user_id
                    AND ${PUBLIC_SUBMISSION_SQL}
                    AND COALESCE(cs.approved_at, cs.created_at) > s.gelesen_bis)
              -- 3. Eigene Beitraege, seit dem letzten Oeffnen von anderen moderiert
              + (SELECT COUNT(*)
                   FROM challenge_submissions cs
                  WHERE cs.challenge_id = s.challenge_id
                    AND cs.user_id = s.user_id
                    AND (
                      (cs.moderation_status = 'approved'
                       AND cs.approved_by IS NOT NULL
                       AND cs.approved_by <> s.user_id
                       AND cs.approved_at > s.gelesen_bis)
                      OR
                      (cs.moderation_status = 'hidden'
                       AND cs.hidden_by IS DISTINCT FROM s.user_id
                       AND cs.hidden_at > s.gelesen_bis)
                    ))
            )::int AS c
       FROM sichtbar s`,
    [
      nurKonfis.map((p) => p.id),
      nurKonfis.map((p) => p.type),
      nurKonfis.map((p) => p.organization_id)
    ]
  );
  return rows.filter((r) => r.c > 0);
}

module.exports = { challengeNeuigkeitenJeChallenge };
