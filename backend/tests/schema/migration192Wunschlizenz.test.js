// MIGRATION 192: Wunschlizenz in der Anfrage vom Formular (Simon, 03.10.2026).
//
// Seit 10.10.2026 steht 192 im Schema-Dump (tests/schema/prod-schema.sql),
// die Datei ist aus backend/migrations/ entfernt; der Test der Migration auf
// dem Stand davor (vorhandene Anfrage behaelt NULL, zweiter Lauf) liegt in
// der Git-Historie (zuletzt Commit 3b935178). Geprueft wird hier auf einer
// Wegwerf-Datenbank aus dem Dump: die Spalte ist nullbar, und der CHECK
// laesst genau die Schluessel aus utils/lizenzen.js zu.
const { dbAnlegen, dbWegraeumen, produktionAufbauen } = require('../helpers/schemaAufbau');
const { LIZENZ_SCHLUESSEL } = require('../../utils/lizenzen');

const DB = 'konfi_test_mig192';

describe('Migration 192 im Schema-Dump', () => {
  let pool;

  const anfrage = (gemeinde, lizenz) => pool.query(
    `INSERT INTO gemeinde_anfragen (gemeinde, kontakt_name, email, einwilligung_am, wunsch_lizenz)
     VALUES ($1, 'K', 'k@example.test', NOW(), $2)`, [gemeinde, lizenz]);

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool);
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  it('die Spalte ist text und nullbar; ohne Angabe bleibt sie NULL', async () => {
    const { rows: [spalte] } = await pool.query(
      `SELECT data_type, is_nullable FROM information_schema.columns
        WHERE table_name = 'gemeinde_anfragen' AND column_name = 'wunsch_lizenz'`);
    expect(spalte).toEqual({ data_type: 'text', is_nullable: 'YES' });
    await pool.query(
      `INSERT INTO gemeinde_anfragen (gemeinde, kontakt_name, email, einwilligung_am)
       VALUES ('ohne', 'K', 'k@example.test', NOW())`);
    const { rows } = await pool.query("SELECT wunsch_lizenz FROM gemeinde_anfragen WHERE gemeinde = 'ohne'");
    expect(rows).toEqual([{ wunsch_lizenz: null }]);
  });

  it('nimmt jede Lizenz aus utils/lizenzen.js an (erlaubt)', async () => {
    for (const lizenz of LIZENZ_SCHLUESSEL) await anfrage(`mit-${lizenz}`, lizenz);
    const { rows } = await pool.query("SELECT wunsch_lizenz FROM gemeinde_anfragen WHERE gemeinde LIKE 'mit-%' ORDER BY id");
    expect(rows.map((r) => r.wunsch_lizenz)).toEqual([...LIZENZ_SCHLUESSEL]);
  });

  it.each(['unbegrenzt', 'Standard', ''])('weist %j ab (verboten, CHECK)', async (wert) => {
    await expect(anfrage('falsch', wert)).rejects.toMatchObject({
      code: '23514', constraint: 'gemeinde_anfragen_wunsch_lizenz_gueltig',
    });
  });
});
