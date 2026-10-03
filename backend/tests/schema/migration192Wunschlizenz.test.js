// MIGRATION 192: Wunschlizenz in der Anfrage vom Formular (Simon, 03.10.2026).
//
// Geprueft auf dem Stand, auf den die Migration beim Deploy trifft (nach 191,
// mit einer vorhandenen Anfrage): die Spalte kommt nullbar dazu, die
// vorhandene Anfrage behaelt NULL, der CHECK laesst genau die Schluessel aus
// utils/lizenzen.js zu, und ein zweiter Lauf aendert nichts.
const {
  dbAnlegen, dbWegraeumen, produktionAufbauen, migrationLesen,
} = require('../helpers/schemaAufbau');
const { LIZENZ_SCHLUESSEL } = require('../../utils/lizenzen');

const MIGRATION = '192_anfrage_wunschlizenz.sql';
const DB = 'konfi_test_mig192';

describe('Migration 192 auf dem Stand, auf den sie beim Deploy trifft', () => {
  let pool;

  const anfrage = (gemeinde, lizenz) => pool.query(
    `INSERT INTO gemeinde_anfragen (gemeinde, kontakt_name, email, einwilligung_am, wunsch_lizenz)
     VALUES ($1, 'K', 'k@example.test', NOW(), $2)`, [gemeinde, lizenz]);

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool, { vor: MIGRATION });
    await pool.query(
      `INSERT INTO gemeinde_anfragen (gemeinde, kontakt_name, email, einwilligung_am)
       VALUES ('vorher', 'K', 'k@example.test', NOW())`);
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  it('Ausgangslage: keine Spalte wunsch_lizenz', async () => {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM information_schema.columns
        WHERE table_name = 'gemeinde_anfragen' AND column_name = 'wunsch_lizenz'`);
    expect(rows[0].n).toBe(0);
  });

  it('legt die Spalte nullbar an; die vorhandene Anfrage behält NULL', async () => {
    await pool.query(migrationLesen(MIGRATION));
    const { rows: [spalte] } = await pool.query(
      `SELECT data_type, is_nullable FROM information_schema.columns
        WHERE table_name = 'gemeinde_anfragen' AND column_name = 'wunsch_lizenz'`);
    expect(spalte).toEqual({ data_type: 'text', is_nullable: 'YES' });
    const { rows } = await pool.query("SELECT wunsch_lizenz FROM gemeinde_anfragen WHERE gemeinde = 'vorher'");
    expect(rows).toEqual([{ wunsch_lizenz: null }]);
  });

  it('nimmt jede Lizenz aus utils/lizenzen.js an (erlaubt)', async () => {
    for (const lizenz of LIZENZ_SCHLUESSEL) await anfrage(`mit-${lizenz}`, lizenz);
    const { rows } = await pool.query("SELECT wunsch_lizenz FROM gemeinde_anfragen WHERE gemeinde LIKE 'mit-%' ORDER BY id");
    expect(rows.map((r) => r.wunsch_lizenz)).toEqual([...LIZENZ_SCHLUESSEL]);
  });

  it.each(['unbegrenzt', 'Standard', ''])('weist %j ab (verboten, CHECK)', async (wert) => {
    await expect(anfrage('falsch', wert)).rejects.toMatchObject({ code: '23514' });
  });

  it('ein zweiter Lauf ändert nichts', async () => {
    await pool.query(migrationLesen(MIGRATION));
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM pg_constraint
        WHERE conrelid = 'public.gemeinde_anfragen'::regclass AND conname = 'gemeinde_anfragen_wunsch_lizenz_gueltig'`);
    expect(rows[0].n).toBe(1);
  });
});
