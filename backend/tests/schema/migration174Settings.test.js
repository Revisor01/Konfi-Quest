// MIGRATION 174: settings bekommt einen Primaerschluessel (Audit Datenbank
// BF-10, 29.09.2026).
//
// settings hatte keinen Primaerschluessel, nur zwei gleiche UNIQUE auf
// (organization_id, key) bei nullbarer organization_id. Ein UNIQUE behandelt
// NULL als verschieden: Zeilen ohne Gemeinde konnten sich beliebig oft
// wiederholen. Gelesen wird settings nur je Gemeinde (organization_id = $1 in
// settings.js, konfi.js, teamer.js, losungService.js), geschrieben ebenso;
// users.organization_id ist NOT NULL. Zeilen ohne Gemeinde sieht also keine
// Stelle -- die Migration entfernt sie und fuehrt (organization_id, key) als
// Primaerschluessel.
//
// Geprueft wird die Migration auf genau dem Stand, auf den sie beim Deploy
// trifft (Deploy-Weg bis vor 174), mit kuenstlich angelegten Doppelungen.
const {
  dbAnlegen, dbWegraeumen, produktionAufbauen, migrationLesen,
} = require('../helpers/schemaAufbau');
const { getTestPool, closePool } = require('../helpers/db');

const MIGRATION = '174_settings_primaerschluessel.sql';
const DB = 'konfi_test_mig174';

describe('Migration 174: settings mit Primaerschluessel', () => {
  let pool;

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool, { vor: MIGRATION });
    await pool.query(`INSERT INTO organizations (id, name, slug) VALUES (1, 'A', 'a'), (2, 'B', 'b')`);
    await pool.query(`
      INSERT INTO settings (organization_id, key, value) VALUES
        (1, 'dashboard_show_ranking', 'false'),
        (1, 'dashboard_section_order', '["events"]'),
        (2, 'dashboard_show_ranking', 'true'),
        (NULL, 'dashboard_show_ranking', 'true'),
        (NULL, 'dashboard_show_ranking', 'false'),
        (NULL, 'waitlist_enabled', 'true')`);
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  it('Ausgangslage: Doppelungen ohne Gemeinde sind moeglich, kein Primaerschluessel', async () => {
    const { rows: [{ n }] } = await pool.query(
      "SELECT count(*)::int AS n FROM settings WHERE organization_id IS NULL AND key = 'dashboard_show_ranking'"
    );
    expect(n).toBe(2);
    const { rows } = await pool.query(
      "SELECT 1 FROM pg_constraint WHERE conrelid = 'settings'::regclass AND contype = 'p'"
    );
    expect(rows).toHaveLength(0);
  });

  it('laeuft durch und laesst die Zeilen der Gemeinden unangetastet', async () => {
    await pool.query(migrationLesen(MIGRATION));
    const { rows } = await pool.query(
      'SELECT organization_id, key, value FROM settings ORDER BY organization_id, key'
    );
    expect(rows).toEqual([
      { organization_id: 1, key: 'dashboard_section_order', value: '["events"]' },
      { organization_id: 1, key: 'dashboard_show_ranking', value: 'false' },
      { organization_id: 2, key: 'dashboard_show_ranking', value: 'true' },
    ]);
  });

  it('Primaerschluessel (organization_id, key), organization_id NOT NULL', async () => {
    const { rows: [pk] } = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conrelid = 'settings'::regclass AND contype = 'p'`);
    expect(pk).toEqual({ conname: 'settings_pkey', def: 'PRIMARY KEY (organization_id, key)' });
    const { rows: [spalte] } = await pool.query(`
      SELECT is_nullable FROM information_schema.columns
      WHERE table_name = 'settings' AND column_name = 'organization_id'`);
    expect(spalte.is_nullable).toBe('NO');
  });

  it('kein zweiter eindeutiger Index mehr auf denselben Spalten', async () => {
    const { rows } = await pool.query(`
      SELECT indexname FROM pg_indexes WHERE tablename = 'settings' AND indexdef LIKE 'CREATE UNIQUE%'
      ORDER BY indexname`);
    expect(rows.map((r) => r.indexname)).toEqual(['settings_pkey']);
  });

  it('der verbotene Fall: keine Zeile ohne Gemeinde, kein Doppel', async () => {
    await expect(pool.query(
      "INSERT INTO settings (organization_id, key, value) VALUES (NULL, 'x', 'y')"
    )).rejects.toThrow(/null value in column "organization_id"/);
    await expect(pool.query(
      "INSERT INTO settings (organization_id, key, value) VALUES (1, 'dashboard_show_ranking', 'true')"
    )).rejects.toThrow(/duplicate key value violates unique constraint "settings_pkey"/);
  });

  it('der erlaubte Fall: das Speichern der App (ON CONFLICT) geht weiter', async () => {
    // Genau die Anweisung aus routes/settings.js -- auch die einer laufenden
    // alten Server-Fassung waehrend des Deploys.
    await pool.query(
      `INSERT INTO settings (organization_id, key, value) VALUES ($1, $2, $3)
       ON CONFLICT (organization_id, key) DO UPDATE SET value = EXCLUDED.value`,
      [1, 'dashboard_show_ranking', 'true']
    );
    const { rows: [{ value }] } = await pool.query(
      "SELECT value FROM settings WHERE organization_id = 1 AND key = 'dashboard_show_ranking'"
    );
    expect(value).toBe('true');
  });

  it('ein zweiter Lauf aendert nichts und scheitert nicht', async () => {
    await pool.query(migrationLesen(MIGRATION));
    const { rows: [{ n }] } = await pool.query('SELECT count(*)::int AS n FROM settings');
    expect(n).toBe(3);
  });
});

describe('Migration 174 im Test-Schema (Deploy-Weg)', () => {
  let db;
  beforeAll(() => { db = getTestPool(); });
  afterAll(async () => { await closePool(); });

  it('settings hat den Primaerschluessel', async () => {
    const { rows } = await db.query(
      "SELECT conname FROM pg_constraint WHERE conrelid = 'settings'::regclass AND contype = 'p'"
    );
    expect(rows.map((r) => r.conname)).toEqual(['settings_pkey']);
  });
});
