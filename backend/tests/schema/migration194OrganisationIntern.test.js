// MIGRATION 194: Interne Gemeinden (Simon, 03.10.2026;
// docs/planung/support-web.md, Entscheidung 5).
//
// Seit 10.10.2026 steht 194 im Schema-Dump (tests/schema/prod-schema.sql),
// die Datei ist aus backend/migrations/ entfernt; der Test der Migration auf
// dem Stand davor (vorhandene Gemeinden bleiben sichtbar, zweiter Lauf) liegt
// in der Git-Historie (zuletzt Commit 3b935178). Geprueft wird hier auf einer
// Wegwerf-Datenbank aus dem Dump: die Spalte ist BOOLEAN NOT NULL mit
// Vorgabe false; true laesst sich setzen, NULL nicht.
const { dbAnlegen, dbWegraeumen, produktionAufbauen } = require('../helpers/schemaAufbau');

const DB = 'konfi_test_mig194';

describe('Migration 194 im Schema-Dump', () => {
  let pool;

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool);
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  it('organizations.intern ist boolean NOT NULL mit Vorgabe false', async () => {
    const { rows } = await pool.query(
      `SELECT data_type, is_nullable, column_default FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'intern'`);
    expect(rows).toEqual([{ data_type: 'boolean', is_nullable: 'NO', column_default: 'false' }]);
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
});
