// MIGRATION 202: Warteschlange fuer die Arbeit nach der Antwort
// (utils/warteschlange.js).
//
// Geprueft auf dem Stand, auf den die Migration beim Deploy trifft: Die
// Tabelle kommt dazu, mit den Vorgaben, die der Arbeiter voraussetzt; der
// Status ist auf die vier Werte begrenzt, ein Schluessel ist eindeutig (ohne
// Schluessel beliebig oft), und ein zweiter Lauf aendert nichts -- auch keine
// vorhandene Zeile.
const {
  dbAnlegen, dbWegraeumen, produktionAufbauen, migrationLesen,
} = require('../helpers/schemaAufbau');

const MIGRATION = '202_nachlauf_warteschlange.sql';
const DB = 'konfi_test_mig202';

describe('Migration 202 auf dem Stand, auf den sie beim Deploy trifft', () => {
  let pool;

  const tabelle = async () => (await pool.query(
    "SELECT to_regclass('public.nachlauf_auftraege') IS NOT NULL AS da")).rows[0].da;

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool, { vor: MIGRATION });
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  it('Ausgangslage: keine Tabelle', async () => {
    expect(await tabelle()).toBe(false);
  });

  it('legt die Tabelle mit den Vorgaben des Arbeiters an', async () => {
    await pool.query(migrationLesen(MIGRATION));
    expect(await tabelle()).toBe(true);
    const { rows: [z] } = await pool.query(
      "INSERT INTO nachlauf_auftraege (art) VALUES ('x') RETURNING status, versuche, max_versuche, parameter, erledigte_schritte, faellig_ab IS NOT NULL AS faellig, gesperrt_bis");
    expect(z).toEqual({
      status: 'offen', versuche: 0, max_versuche: 5, parameter: {}, erledigte_schritte: [], faellig: true, gesperrt_bis: null,
    });
    const { rows: zeiten } = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns
        WHERE table_name = 'nachlauf_auftraege' AND data_type LIKE 'timestamp%' ORDER BY column_name`);
    expect(zeiten).toEqual([
      { column_name: 'erledigt_am', data_type: 'timestamp with time zone' },
      { column_name: 'erstellt_am', data_type: 'timestamp with time zone' },
      { column_name: 'faellig_ab', data_type: 'timestamp with time zone' },
      { column_name: 'gesperrt_bis', data_type: 'timestamp with time zone' },
    ]);
  });

  it('Status nur offen/laeuft/erledigt/fehlgeschlagen', async () => {
    await expect(pool.query("INSERT INTO nachlauf_auftraege (art, status) VALUES ('x', 'kaputt')"))
      .rejects.toMatchObject({ code: '23514' });
    for (const s of ['laeuft', 'erledigt', 'fehlgeschlagen']) {
      await pool.query("INSERT INTO nachlauf_auftraege (art, status) VALUES ('x', $1)", [s]);
    }
  });

  it('Schluessel eindeutig, ohne Schluessel beliebig oft', async () => {
    await pool.query("INSERT INTO nachlauf_auftraege (art, schluessel) VALUES ('x', 'k1')");
    await expect(pool.query("INSERT INTO nachlauf_auftraege (art, schluessel) VALUES ('x', 'k1')"))
      .rejects.toMatchObject({ code: '23505' });
    await pool.query("INSERT INTO nachlauf_auftraege (art) VALUES ('x'), ('x')");
  });

  it('ein zweiter Lauf aendert nichts: kein Fehler, vorhandene Zeilen bleiben', async () => {
    const vorher = (await pool.query('SELECT count(*)::int AS n FROM nachlauf_auftraege')).rows[0].n;
    await pool.query(migrationLesen(MIGRATION));
    const nachher = (await pool.query('SELECT count(*)::int AS n FROM nachlauf_auftraege')).rows[0].n;
    expect(nachher).toBe(vorher);
    expect(nachher).toBe(7);
  });
});
