// MIGRATION 202: Warteschlange fuer die Arbeit nach der Antwort
// (utils/warteschlange.js).
//
// Seit 10.10.2026 steht 202 im Schema-Dump (tests/schema/prod-schema.sql),
// die Datei ist aus backend/migrations/ entfernt; der Test der Migration auf
// dem Stand davor (Ausgangslage, zweiter Lauf) liegt in der Git-Historie
// (zuletzt Commit 3b935178). Geprueft wird hier auf einer Wegwerf-Datenbank
// aus dem Dump: die Tabelle hat die Vorgaben, die der Arbeiter voraussetzt;
// der Status ist auf die vier Werte begrenzt, ein Schluessel ist eindeutig
// (ohne Schluessel beliebig oft).
const { dbAnlegen, dbWegraeumen, produktionAufbauen } = require('../helpers/schemaAufbau');

const DB = 'konfi_test_mig202';

describe('Migration 202 im Schema-Dump', () => {
  let pool;

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool);
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  it('die Tabelle hat die Vorgaben des Arbeiters, alle Zeitspalten mit Zone', async () => {
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
    expect((await pool.query('SELECT count(*)::int AS n FROM nachlauf_auftraege')).rows[0].n).toBe(4);
  });

  it('Schluessel eindeutig, ohne Schluessel beliebig oft', async () => {
    await pool.query("INSERT INTO nachlauf_auftraege (art, schluessel) VALUES ('x', 'k1')");
    await expect(pool.query("INSERT INTO nachlauf_auftraege (art, schluessel) VALUES ('x', 'k1')"))
      .rejects.toMatchObject({ code: '23505' });
    await pool.query("INSERT INTO nachlauf_auftraege (art) VALUES ('x'), ('x')");
    expect((await pool.query('SELECT count(*)::int AS n FROM nachlauf_auftraege')).rows[0].n).toBe(7);
  });
});
