// Was geht mit, wenn ein Jahrgang geloescht wird? -- EINE Stelle fuer die
// Vorschau (GET /admin/jahrgaenge/:id/loeschvorschau) und das Loeschen selbst
// (DELETE /admin/jahrgaenge/:id), damit die Zahlen im Bestaetigungsdialog und
// das, was dann tatsaechlich verschwindet, nie auseinanderlaufen.
//
// SIMONS ENTSCHEIDUNG (28.09.2026, woertlich): "Events die im Jahrgang
// liegen muessen mit dem Jahrgang geloescht werden. Event mit zwei Jahrgaenge
// bleiben, der eine verschwindet dann nur aus dem Event. Loeschen muss auch
// challenges mit umfassen."
//
// Bis dahin nahm das Loeschen eines Jahrgangs per Kaskade nur die
// Zuordnungen mit (Audit 26.09.2026, BF-08): Termine des Jahrgangs wurden zu
// "allgemeinen" Terminen fuer die ganze Gemeinde, ein Pflichttermin stand
// danach genau in dem Zustand, den der Riegel beim Anlegen verbietet
// ("Pflicht ohne Jahrgang"). Challenges fielen still aus jeder Konfi-Liste.
//
// DIE REGEL:
//   - Termine und Challenges, die NUR an diesem Jahrgang haengen, gehen mit
//     (utils/terminLoeschen.js, utils/challengeLoeschen.js -- dieselben Wege
//     wie beim Einzel-Loeschen).
//   - Haengen sie zusaetzlich an einem anderen Jahrgang, bleiben sie; nur
//     die Zuordnung zu diesem faellt weg (ON DELETE CASCADE).
//   - Was ausdruecklich nur fuers Team ist, gehoert keinem Jahrgang (Regel
//     "Wer sieht und bekommt was", CLAUDE.md): Termine "Nur Team"
//     (teamer_only) und Challenges "Nur das Team" (audience 'nur_team')
//     bleiben, auch wenn sie eine Zuordnung zu diesem Jahrgang tragen.
//   - Termine und Challenges ohne jeden Jahrgang sind nicht betroffen.

const TERMINE_SQL = `
  SELECT e.id, e.event_date,
         (e.teamer_only IS NOT TRUE
          AND NOT EXISTS (SELECT 1 FROM event_jahrgang_assignments andere
                           WHERE andere.event_id = e.id AND andere.jahrgang_id <> $1)) AS loeschen
    FROM events e
   WHERE e.organization_id = $2
     AND EXISTS (SELECT 1 FROM event_jahrgang_assignments eja
                  WHERE eja.event_id = e.id AND eja.jahrgang_id = $1)
   ORDER BY e.id`;

const CHALLENGES_SQL = `
  SELECT c.id,
         (c.audience <> 'nur_team'
          AND NOT EXISTS (SELECT 1 FROM challenge_jahrgang_assignments andere
                           WHERE andere.challenge_id = c.id AND andere.jahrgang_id <> $1)) AS loeschen
    FROM challenges c
   WHERE c.organization_id = $2
     AND EXISTS (SELECT 1 FROM challenge_jahrgang_assignments cja
                  WHERE cja.challenge_id = c.id AND cja.jahrgang_id = $1)
   ORDER BY c.id`;

/**
 * Welche Termine und Challenges gehen mit dem Jahrgang, welche verlieren nur
 * die Zuordnung?
 *
 * @param {{query: Function}} db  Pool oder Transaktions-Client
 * @param {number|string} jahrgangId
 * @param {number|string} organizationId
 * @returns {Promise<{termineLoeschen: Array<{id:number, event_date:Date}>, termineBehalten: number[],
 *   challengesLoeschen: number[], challengesBehalten: number[]}>}
 */
async function ladeLoeschumfang(db, jahrgangId, organizationId) {
  const [{ rows: termine }, { rows: challenges }] = await Promise.all([
    db.query(TERMINE_SQL, [jahrgangId, organizationId]),
    db.query(CHALLENGES_SQL, [jahrgangId, organizationId])
  ]);
  return {
    termineLoeschen: termine.filter((t) => t.loeschen).map((t) => ({ id: Number(t.id), event_date: t.event_date })),
    termineBehalten: termine.filter((t) => !t.loeschen).map((t) => Number(t.id)),
    challengesLoeschen: challenges.filter((c) => c.loeschen).map((c) => Number(c.id)),
    challengesBehalten: challenges.filter((c) => !c.loeschen).map((c) => Number(c.id))
  };
}

module.exports = { ladeLoeschumfang };
