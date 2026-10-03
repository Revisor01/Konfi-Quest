// MIGRATION 194: Interne Gemeinden (Simon, 03.10.2026;
// docs/planung/support-web.md, Entscheidung 5).
//
// Geprueft auf dem Stand, auf den die Migration beim Deploy trifft (nach 193,
// mit zwei vorhandenen Gemeinden): die Spalte kommt als BOOLEAN NOT NULL mit
// Vorgabe false dazu, jede vorhandene Gemeinde bleibt sichtbar (false), true
// laesst sich setzen, NULL nicht, und ein zweiter Lauf aendert nichts -- auch
// keinen gesetzten Wert.
const {
  dbAnlegen, dbWegraeumen, produktionAufbauen, migrationLesen,
} = require('../helpers/schemaAufbau');

const MIGRATION = '194_organisation_intern.sql';
const DB = 'konfi_test_mig194';

describe('Migration 194 auf dem Stand, auf den sie beim Deploy trifft', () => {
  let pool;

  const spalte = async () => (await pool.query(
    `SELECT data_type, is_nullable, column_default FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'intern'`)).rows;

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool, { vor: MIGRATION });
    await pool.query(
      `INSERT INTO organizations (name, slug, display_name) VALUES
         ('vorhanden-a', 'vorhanden-a', 'Vorhandene Gemeinde A'),
         ('vorhanden-b', 'vorhanden-b', 'Vorhandene Gemeinde B')`);
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  it('Ausgangslage: keine Spalte intern', async () => {
    expect(await spalte()).toEqual([]);
  });

  it('legt die Spalte als boolean NOT NULL mit Vorgabe false an; vorhandene Gemeinden bleiben sichtbar', async () => {
    await pool.query(migrationLesen(MIGRATION));
    expect(await spalte()).toEqual([{ data_type: 'boolean', is_nullable: 'NO', column_default: 'false' }]);
    const { rows } = await pool.query('SELECT name, intern FROM organizations ORDER BY name');
    expect(rows).toEqual([{ name: 'vorhanden-a', intern: false }, { name: 'vorhanden-b', intern: false }]);
  });

  it('eine neue Gemeinde ist ohne Angabe nicht intern; true lässt sich setzen, NULL nicht', async () => {
    const { rows: [neu] } = await pool.query(
      "INSERT INTO organizations (name, slug, display_name) VALUES ('neu', 'neu', 'Neue Gemeinde') RETURNING intern");
    expect(neu.intern).toBe(false);
    await pool.query("UPDATE organizations SET intern = true WHERE name = 'neu'");
    expect((await pool.query("SELECT intern FROM organizations WHERE name = 'neu'")).rows).toEqual([{ intern: true }]);
    await expect(pool.query("UPDATE organizations SET intern = NULL WHERE name = 'neu'"))
      .rejects.toMatchObject({ code: '23502' });
  });

  it('ein zweiter Lauf ändert nichts: kein Fehler, ein gesetzter Wert bleibt', async () => {
    await pool.query(migrationLesen(MIGRATION));
    expect(await spalte()).toEqual([{ data_type: 'boolean', is_nullable: 'NO', column_default: 'false' }]);
    const { rows } = await pool.query('SELECT name, intern FROM organizations ORDER BY name');
    expect(rows).toEqual([
      { name: 'neu', intern: true },
      { name: 'vorhanden-a', intern: false },
      { name: 'vorhanden-b', intern: false },
    ]);
  });
});
