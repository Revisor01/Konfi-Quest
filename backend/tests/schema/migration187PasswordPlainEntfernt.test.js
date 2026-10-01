// MIGRATION 187: konfi_profiles.password_plain entfaellt (01.10.2026).
//
// Simon zu "password_plain mit dem naechsten Release entfernen?": "ja".
// Vorgeschichte: 165 hat die Klartext-Passwoerter geleert, 176 laesst nur
// noch NULL zu, und keine Code-Stelle nennt die Spalte mehr (Waechter in
// migration176KeinKlartext.test.js). Hier geht die Spalte selbst.
//
// Geprueft wird auf dem Stand, auf den 187 beim Deploy trifft (eigene
// Datenbank bis vor 187), und im gemeinsamen Test-Schema, das alle
// Migrationen durchlaufen hat.
const {
  dbAnlegen, dbWegraeumen, produktionAufbauen, migrationLesen,
} = require('../helpers/schemaAufbau');
const { getTestPool, closePool } = require('../helpers/db');

const MIGRATION = '187_password_plain_entfernen.sql';
const DB = 'konfi_test_mig187';

const spalte = (pool) => pool.query(`
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'konfi_profiles'
     AND column_name = 'password_plain'`);

describe('Migration 187 auf dem Stand, auf den sie beim Deploy trifft', () => {
  let pool;

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool, { vor: MIGRATION });
    await pool.query(`INSERT INTO organizations (id, name, slug) VALUES (1, 'A', 'a')`);
    await pool.query(`INSERT INTO roles (id, name, display_name, organization_id) VALUES (1, 'konfi', 'Konfi', 1)`);
    await pool.query(`INSERT INTO users (id, username, display_name, password_hash, role_id, organization_id)
                      VALUES (1, 'k1', 'K 1', 'x', 1, 1), (2, 'k2', 'K 2', 'x', 1, 1)`);
    await pool.query(`INSERT INTO konfi_profiles (user_id, organization_id, gottesdienst_points, gemeinde_points)
                      VALUES (1, 1, 4, 1), (2, 1, 2, 3)`);
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  it('Ausgangslage: Spalte und CHECK aus 176 stehen', async () => {
    expect((await spalte(pool)).rows).toHaveLength(1);
    const { rows } = await pool.query(
      "SELECT 1 FROM pg_constraint WHERE conname = 'konfi_profiles_password_plain_leer'"
    );
    expect(rows).toHaveLength(1);
  });

  it('entfernt die Spalte samt CHECK und laesst die Profile stehen', async () => {
    await pool.query(migrationLesen(MIGRATION));

    expect((await spalte(pool)).rows).toHaveLength(0);
    const { rows: check } = await pool.query(
      "SELECT 1 FROM pg_constraint WHERE conname = 'konfi_profiles_password_plain_leer'"
    );
    expect(check).toHaveLength(0);
    const { rows } = await pool.query(
      'SELECT user_id, gottesdienst_points, gemeinde_points FROM konfi_profiles ORDER BY user_id'
    );
    expect(rows).toEqual([
      { user_id: 1, gottesdienst_points: 4, gemeinde_points: 1 },
      { user_id: 2, gottesdienst_points: 2, gemeinde_points: 3 },
    ]);
  });

  it('ein zweiter Lauf scheitert nicht', async () => {
    await expect(pool.query(migrationLesen(MIGRATION))).resolves.toBeTruthy();
    expect((await spalte(pool)).rows).toHaveLength(0);
  });
});

describe('Migration 187 im Test-Schema (Deploy-Weg)', () => {
  let db;
  beforeAll(() => { db = getTestPool(); });
  afterAll(async () => { await closePool(); });

  it('die Spalte gibt es nicht mehr', async () => {
    expect((await spalte(db)).rows).toHaveLength(0);
  });

  it('verboten: kein Klartext laesst sich mehr ablegen -- es gibt keinen Ort dafuer', async () => {
    await expect(db.query(
      "UPDATE konfi_profiles SET password_plain = 'Psalm23,1' WHERE user_id = 0"
    )).rejects.toThrow(/column "password_plain" .*does not exist/);
  });

  it('die Folge fuer einen Server vor dem 29.09.2026: sein NULL-Setzen scheitert ebenfalls', async () => {
    // Genau die Anweisung aus regenerate-password bis zum 29.09.2026 (2.2.x,
    // backend-test vor dem Neubau). Sie laeuft dort in der Transaktion mit
    // dem neuen Passwort: 500, nichts geaendert. Deshalb muss backend-test
    // vor dem Deploy neu gebaut sein (Kommentar in der Migration).
    await expect(db.query(
      'UPDATE konfi_profiles SET password_plain = NULL WHERE user_id = $1', [0]
    )).rejects.toThrow(/does not exist/);
  });
});
