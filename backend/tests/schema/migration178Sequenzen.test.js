// MIGRATION 178: Die Sequenzen von user_badges und user_activities tragen
// die Namen ihrer Tabellen (Audit Datenbank BF-12, 29.09.2026).
//
// Migration 076 hat konfi_badges und konfi_activities umbenannt, ihre
// Sequenzen nicht: user_badges.id lief ueber konfi_badges_id_seq,
// user_activities.id ueber konfi_activities_id_seq. Wer eine Sequenz nach
// dem Tabellennamen sucht (setval nach einem Import, pg_dump-Auswertung),
// fand sie nicht. Keine Code-Stelle nennt die alten Namen; der Default
// verweist per OID und zeigt nach dem Umbenennen von selbst den neuen.
//
// Seit 09.10.2026 steht 178 im Schema-Dump (tests/schema/prod-schema.sql),
// die Datei ist aus backend/migrations/ entfernt; der Test der Migration auf
// dem Stand davor (Umbenennen, Zaehlerstand, zweiter Lauf) liegt in der
// Git-Historie. Geprueft wird hier, dass der Dump die neuen Namen traegt.
const { dbAnlegen, dbWegraeumen, produktionAufbauen } = require('../helpers/schemaAufbau');
const { getTestPool, closePool } = require('../helpers/db');

const DB = 'konfi_test_mig178';

const SEQUENZ_DER_SPALTE = `
  SELECT pg_get_serial_sequence('user_badges', 'id') AS badges,
         pg_get_serial_sequence('user_activities', 'id') AS aktivitaeten`;

describe('Migration 178 im Schema-Dump', () => {
  let pool;

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool, { vor: '189_dateinamen_utf8_reparieren.sql' });
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  it('die Sequenzen tragen die Namen der Tabellen -- Besitz und Default folgen', async () => {
    const { rows: [r] } = await pool.query(SEQUENZ_DER_SPALTE);
    expect(r).toEqual({ badges: 'public.user_badges_id_seq', aktivitaeten: 'public.user_activities_id_seq' });
    const { rows } = await pool.query(`
      SELECT table_name, column_default FROM information_schema.columns
      WHERE column_name = 'id' AND table_name IN ('user_badges', 'user_activities') ORDER BY 1`);
    expect(rows).toEqual([
      { table_name: 'user_activities', column_default: "nextval('user_activities_id_seq'::regclass)" },
      { table_name: 'user_badges', column_default: "nextval('user_badges_id_seq'::regclass)" },
    ]);
  });

  it('die alten Namen gibt es nicht mehr', async () => {
    const { rows } = await pool.query(`
      SELECT relname FROM pg_class
      WHERE relkind = 'S' AND relname IN ('konfi_badges_id_seq', 'konfi_activities_id_seq')`);
    expect(rows).toEqual([]);
  });
});

describe('Sequenzen im Test-Schema (Deploy-Weg)', () => {
  let db;
  beforeAll(() => { db = getTestPool(); });
  afterAll(async () => { await closePool(); });

  it('jede Sequenz, die einer Spalte gehoert, heisst <tabelle>_<spalte>_seq', async () => {
    // Waechter gegen den naechsten Fall: eine umbenannte Tabelle, deren
    // Sequenz den alten Namen behaelt.
    const { rows } = await db.query(`
      SELECT s.relname AS sequenz, t.relname || '_' || a.attname || '_seq' AS erwartet
      FROM pg_class s
      JOIN pg_depend d ON d.objid = s.oid AND d.deptype = 'a' AND d.classid = 'pg_class'::regclass
      JOIN pg_class t ON t.oid = d.refobjid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
      WHERE s.relkind = 'S' AND s.relnamespace = 'public'::regnamespace
        AND s.relname <> t.relname || '_' || a.attname || '_seq'
      ORDER BY 1`);
    expect(rows).toEqual([]);
  });
});
