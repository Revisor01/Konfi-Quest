// MIGRATION 208: Konfisprueche je Kirchenkreis und Landeskirche
// (docs/messung/umami.md, S1; Simon, 09.10.2026: Auswertung nach Gemeinde,
// Kirchenkreis und Landeskirche).
//
// Geprueft auf dem Stand, auf den die Migration beim Deploy trifft (207 ist
// gelaufen, Wahlen ohne Ebenen liegen vor): Zeilen mit zugeordneter Gemeinde
// bekommen deren heutigen Kirchenkreis und dessen Landeskirche; Zeilen ohne
// Gemeinde oder mit nicht zugeordneter Gemeinde bleiben leer; schon gesetzte
// Ebenen bleiben. Faellt Kirchenkreis oder Landeskirche weg, wird nur die
// Spalte leer, die Wahl bleibt. Ein zweiter Lauf aendert nichts.
const {
  dbAnlegen, dbWegraeumen, produktionAufbauen, migrationLesen,
} = require('../helpers/schemaAufbau');

const MIGRATION = '208_konfspruch_wahlen_ebenen.sql';
const DB = 'konfi_test_mig208';

describe('Migration 208 auf dem Stand, auf den sie beim Deploy trifft', () => {
  let pool;
  let lk;
  let kk;
  let kkAnders;
  let mitKreis;
  let ohneKreis;

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool, { vor: MIGRATION });
    ({ rows: [{ id: lk }] } = await pool.query("INSERT INTO landeskirchen (name) VALUES ('Nordkirche') RETURNING id::int AS id"));
    ({ rows: [{ id: kk }] } = await pool.query(
      "INSERT INTO kirchenkreise (name, landeskirche_id) VALUES ('Dithmarschen', $1) RETURNING id::int AS id", [lk]));
    ({ rows: [{ id: kkAnders }] } = await pool.query(
      "INSERT INTO kirchenkreise (name, landeskirche_id) VALUES ('Ohne Landeskirche', NULL) RETURNING id::int AS id"));
    ({ rows: [{ id: mitKreis }] } = await pool.query(
      `INSERT INTO organizations (name, slug, display_name, kirchenkreis_id)
       VALUES ('M208', 'm208', 'M208', $1) RETURNING id::int AS id`, [kk]));
    ({ rows: [{ id: ohneKreis }] } = await pool.query(
      `INSERT INTO organizations (name, slug, display_name) VALUES ('O208', 'o208', 'O208') RETURNING id::int AS id`));
    await pool.query(
      `INSERT INTO konfspruch_wahlen (organization_id, quelle, stelle, monat)
       VALUES ($1, 'vorschlag', 'Josua 1,9', NULL),
              ($2, 'vorschlag', 'Psalm 23,1', NULL),
              (NULL, 'vorschlag', 'Jes 43,1', NULL)`,
      [mitKreis, ohneKreis]);
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  const zeilen = async () => (await pool.query(
    `SELECT stelle, kirchenkreis_id::int AS kk, landeskirche_id::int AS lk
       FROM konfspruch_wahlen ORDER BY id`)).rows;

  it('traegt die heutige Zuordnung der Gemeinde nach, nur wo es eine gibt', async () => {
    await pool.query(migrationLesen(MIGRATION));
    expect(await zeilen()).toEqual([
      { stelle: 'Josua 1,9', kk, lk },
      { stelle: 'Psalm 23,1', kk: null, lk: null },
      { stelle: 'Jes 43,1', kk: null, lk: null },
    ]);
  });

  it('ein zweiter Lauf aendert nichts, auch nicht nach neuer Zuordnung', async () => {
    // Die Gemeinde zieht um: Die schon nachgetragene Zeile behaelt den Stand.
    await pool.query('UPDATE organizations SET kirchenkreis_id = $1 WHERE id = $2', [kkAnders, mitKreis]);
    const vorher = await zeilen();
    await pool.query(migrationLesen(MIGRATION));
    expect(await zeilen()).toEqual(vorher);
    expect(vorher[0]).toEqual({ stelle: 'Josua 1,9', kk, lk });
  });

  it('faellt der Kirchenkreis weg, bleibt die Landeskirche; faellt die Landeskirche weg, bleibt die Wahl', async () => {
    await pool.query('DELETE FROM kirchenkreise WHERE id = $1', [kk]);
    expect((await zeilen())[0]).toEqual({ stelle: 'Josua 1,9', kk: null, lk });
    await pool.query('DELETE FROM landeskirchen WHERE id = $1', [lk]);
    expect((await zeilen())[0]).toEqual({ stelle: 'Josua 1,9', kk: null, lk: null });
    expect((await zeilen()).length).toBe(3);
  });
});
