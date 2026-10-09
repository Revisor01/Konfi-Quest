// MIGRATION 187: konfi_profiles.password_plain entfaellt (01.10.2026).
//
// Simon zu "password_plain mit dem naechsten Release entfernen?": "ja".
// Vorgeschichte: 165 hat die Klartext-Passwoerter geleert, 176 laesst nur
// noch NULL zu, und keine Code-Stelle nennt die Spalte mehr (Waechter in
// migration176KeinKlartext.test.js). Hier geht die Spalte selbst.
//
// Seit 09.10.2026 steht 187 im Schema-Dump (tests/schema/prod-schema.sql),
// die Datei ist aus backend/migrations/ entfernt; der Test der Migration auf
// dem Stand davor (Spalte und CHECK aus 176 vorher, Profile bleiben, zweiter
// Lauf) liegt in der Git-Historie. Geprueft wird hier der Dump und das
// gemeinsame Test-Schema, das alle Migrationen durchlaufen hat.
const { dbAnlegen, dbWegraeumen, produktionAufbauen } = require('../helpers/schemaAufbau');
const { getTestPool, closePool } = require('../helpers/db');

const DB = 'konfi_test_mig187';

const spalte = (pool) => pool.query(`
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'konfi_profiles'
     AND column_name = 'password_plain'`);

describe('Migration 187 im Schema-Dump', () => {
  let pool;

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool, { vor: '189_dateinamen_utf8_reparieren.sql' });
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  it('der Dump kennt weder die Spalte noch den CHECK aus 176', async () => {
    expect((await spalte(pool)).rows).toHaveLength(0);
    const { rows } = await pool.query(
      "SELECT 1 FROM pg_constraint WHERE conname = 'konfi_profiles_password_plain_leer'"
    );
    expect(rows).toHaveLength(0);
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
