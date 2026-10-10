// MIGRATION 212: konfspruch_wahlen entfaellt (10.10.2026).
//
// Simon, 10.10.2026: „Raus aus der App. Nur Umami!" Die Auswertung der
// Konfisprueche laeuft ueber die Nutzungsmessung (docs/messung/umami.md, S1);
// die Tabelle aus 207/208 und die Route GET /api/metrics/konfisprueche gehen.
//
// Geprueft auf dem Stand, auf den 212 beim Deploy trifft (Dump mit 207/208,
// darin eine Zeile): danach ist die Tabelle samt Sequenz weg, die Sprueche
// selbst (konfsprueche) bleiben, ein zweiter Lauf geht durch. Dazu: kein
// Code ausserhalb der Migrationen nennt die Tabelle noch -- ein Rest
// schriebe ins Leere und fiele nur im Log auf.
const fs = require('fs');
const path = require('path');
const {
  dbAnlegen, dbWegraeumen, produktionAufbauen, migrationLesen,
} = require('../helpers/schemaAufbau');
const { getTestPool, closePool } = require('../helpers/db');

const MIGRATION = '212_konfspruch_wahlen_entfernen.sql';
const DB = 'konfi_test_mig212';
const BACKEND = path.join(__dirname, '..', '..');

const da = async (pool, name) => (await pool.query(
  'SELECT to_regclass($1) IS NOT NULL AS da', [`public.${name}`])).rows[0].da;

describe('Migration 212 auf dem Stand, auf den sie beim Deploy trifft', () => {
  let pool;

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool, { vor: MIGRATION });
    const { rows: [spruch] } = await pool.query(
      `INSERT INTO konfsprueche (reference, book, chapter, verse) VALUES ('Josua 1,9', 'Josua', 1, 9) RETURNING id`);
    await pool.query(
      `INSERT INTO konfspruch_wahlen (quelle, konfspruch_id, stelle, translation) VALUES ('vorschlag', $1, 'Josua 1,9', 'bigs')`,
      [spruch.id]);
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  it('vorher steht die Tabelle mit ihrer Zeile da', async () => {
    expect(await da(pool, 'konfspruch_wahlen')).toBe(true);
    const { rows: [{ n }] } = await pool.query('SELECT COUNT(*)::int AS n FROM konfspruch_wahlen');
    expect(n).toBe(1);
  });

  it('danach sind Tabelle und Sequenz weg, die Sprueche bleiben', async () => {
    await pool.query(migrationLesen(MIGRATION));
    expect(await da(pool, 'konfspruch_wahlen')).toBe(false);
    expect(await da(pool, 'konfspruch_wahlen_id_seq')).toBe(false);
    const { rows: [{ n }] } = await pool.query('SELECT COUNT(*)::int AS n FROM konfsprueche');
    expect(n).toBe(1);
  });

  it('ein zweiter Lauf geht durch', async () => {
    await pool.query(migrationLesen(MIGRATION));
    expect(await da(pool, 'konfspruch_wahlen')).toBe(false);
  });
});

describe('Migration 212 im gemeinsamen Test-Schema', () => {
  afterAll(async () => { await closePool(); });

  it('die Tabelle gibt es nicht', async () => {
    expect(await da(getTestPool(), 'konfspruch_wahlen')).toBe(false);
  });
});

describe('kein Code nennt konfspruch_wahlen noch', () => {
  // Alle .js unter backend/ ausser Abhaengigkeiten, Tests und Migrationen.
  function jsDateien(ordner) {
    return fs.readdirSync(ordner, { withFileTypes: true }).flatMap((e) => {
      if (['node_modules', 'tests', 'migrations', 'uploads', 'coverage'].includes(e.name)) return [];
      const voll = path.join(ordner, e.name);
      if (e.isDirectory()) return jsDateien(voll);
      return e.name.endsWith('.js') ? [voll] : [];
    });
  }

  it('weder Routen noch Hilfen schreiben oder lesen die Tabelle', () => {
    const treffer = jsDateien(BACKEND)
      .filter((f) => fs.readFileSync(f, 'utf8').includes('konfspruch_wahlen'))
      .map((f) => path.relative(BACKEND, f));
    expect(treffer).toEqual([]);
  });

  it('die Route GET /api/metrics/konfisprueche ist nicht mehr eingehaengt', () => {
    const app = fs.readFileSync(path.join(BACKEND, 'createApp.js'), 'utf8');
    expect(app.includes('/api/metrics/konfisprueche')).toBe(false);
    expect(fs.existsSync(path.join(BACKEND, 'routes', 'metrikKonfisprueche.js'))).toBe(false);
  });
});
