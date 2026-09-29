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
//
// MATERIAL WIRD GLOBAL (Simon, 28.09.2026: "Material wird global ja.")
// Material wird nicht geloescht. Haengt es nur an diesem Jahrgang, wird es
// in derselben Transaktion ausdruecklich global (materials.ist_global =
// true) und steht danach dem ganzen Team offen. Vorher verlor es per
// Kaskade nur die Zuordnung und rutschte stillschweigend in den Zweig
// "kein Jahrgang zugeordnet" der Lese-Schranke (routes/material.js) --
// dasselbe Ergebnis, aber ohne dass es jemand gesagt oder gesehen hat.
// Material mit weiteren Jahrgaengen verliert nur die Zuordnung.

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

// wird_global: kein weiterer Jahrgang. war_global: stand schon vorher dem
// ganzen Team offen -- dann aendert sich fuer niemanden etwas.
const MATERIAL_SQL = `
  SELECT m.id, m.ist_global AS war_global,
         NOT EXISTS (SELECT 1 FROM material_jahrgaenge andere
                      WHERE andere.material_id = m.id AND andere.jahrgang_id <> $1) AS wird_global
    FROM materials m
   WHERE m.organization_id = $2
     AND EXISTS (SELECT 1 FROM material_jahrgaenge mj
                  WHERE mj.material_id = m.id AND mj.jahrgang_id = $1)
   ORDER BY m.id`;

/**
 * Welche Termine und Challenges gehen mit dem Jahrgang, welche verlieren nur
 * die Zuordnung? Welches Material wird global?
 *
 * @param {{query: Function}} db  Pool oder Transaktions-Client
 * @param {number|string} jahrgangId
 * @param {number|string} organizationId
 * @returns {Promise<{termineLoeschen: Array<{id:number, event_date:Date}>, termineBehalten: number[],
 *   challengesLoeschen: number[], challengesBehalten: number[],
 *   materialGlobal: number[], materialNeuFuerAlle: number[]}>}
 *   materialGlobal: Material, das seinen letzten Jahrgang verliert;
 *   materialNeuFuerAlle: davon das, was bisher NICHT global war -- das
 *   sieht nach dem Loeschen das ganze Team zum ersten Mal.
 */
async function ladeLoeschumfang(db, jahrgangId, organizationId) {
  // Nacheinander statt Promise.all: db kann ein Transaktions-Client sein,
  // und der nimmt ohnehin nur eine Abfrage zur Zeit.
  const { rows: termine } = await db.query(TERMINE_SQL, [jahrgangId, organizationId]);
  const { rows: challenges } = await db.query(CHALLENGES_SQL, [jahrgangId, organizationId]);
  const { rows: material } = await db.query(MATERIAL_SQL, [jahrgangId, organizationId]);
  const materialGlobal = material.filter((m) => m.wird_global);
  return {
    termineLoeschen: termine.filter((t) => t.loeschen).map((t) => ({ id: Number(t.id), event_date: t.event_date })),
    termineBehalten: termine.filter((t) => !t.loeschen).map((t) => Number(t.id)),
    challengesLoeschen: challenges.filter((c) => c.loeschen).map((c) => Number(c.id)),
    challengesBehalten: challenges.filter((c) => !c.loeschen).map((c) => Number(c.id)),
    materialGlobal: materialGlobal.map((m) => Number(m.id)),
    materialNeuFuerAlle: materialGlobal.filter((m) => !m.war_global).map((m) => Number(m.id))
  };
}

/**
 * Macht das Material, das mit dem Jahrgang seinen letzten Jahrgang verliert,
 * ausdruecklich global. Im Transaktions-Client VOR dem DELETE FROM
 * jahrgaenge aufrufen -- danach hat die Kaskade die Zuordnungen schon
 * genommen und die Auswahl waere leer.
 *
 * @param {{query: Function}} db  Transaktions-Client
 * @param {{materialGlobal: number[]}} umfang  aus ladeLoeschumfang
 * @returns {Promise<number>} wie viele Materialien umgestellt wurden
 */
async function materialGlobalMachen(db, umfang) {
  if (umfang.materialGlobal.length === 0) return 0;
  const { rowCount } = await db.query(
    `UPDATE materials SET ist_global = true, updated_at = NOW()
      WHERE id = ANY($1::int[]) AND ist_global IS NOT TRUE`,
    [umfang.materialGlobal]
  );
  return rowCount;
}

module.exports = { ladeLoeschumfang, materialGlobalMachen };
