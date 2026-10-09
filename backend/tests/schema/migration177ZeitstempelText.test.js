// MIGRATION 177: event_bookings.created_at und event_timeslots.created_at
// werden von TEXT zu timestamptz (Audit Datenbank BF-11, 29.09.2026).
//
// Beide Spalten stammen aus der SQLite-Uebernahme: TEXT mit dem Default
// CURRENT_TIMESTAMP, gespeichert als Zeichenkette in der Zeitzone der
// schreibenden Sitzung ("2026-09-26 13:53:58.597731+02" aus psql,
// "...+00" aus den Backends, ohne Zone aus SQLite). Sortiert wurde danach
// lexikalisch -- nach Uhrzeit, nicht nach Zeitpunkt: Zeilen aus Sitzungen mit
// verschiedener Zone und die doppelte Stunde der Zeitumstellung kamen in
// falscher Reihenfolge (routes/events/anwesenheit.js, "Alle verbuchen").
//
// In der Antwort von GET /events/:id bleibt created_at eine Zeichenkette
// (jetzt ISO wie alle anderen Zeitfelder); keine App liest es (geprueft:
// Store 2.2.0 und heute).
//
// Seit 09.10.2026 steht 177 im Schema-Dump (tests/schema/prod-schema.sql),
// die Datei ist aus backend/migrations/ entfernt; der Test der Migration auf
// dem Stand davor (Umrechnung der Altwerte, zweiter Lauf) liegt in der
// Git-Historie. Geprueft wird hier, dass der Dump die Spalten als timestamptz
// traegt und danach sortiert.
const { dbAnlegen, dbWegraeumen, produktionAufbauen } = require('../helpers/schemaAufbau');
const { getTestPool, closePool } = require('../helpers/db');

const DB = 'konfi_test_mig177';

describe('Migration 177 im Schema-Dump', () => {
  let pool;

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool, { vor: '178_sequenzen_nach_tabellen.sql' });
    await pool.query(`INSERT INTO organizations (id, name, slug) VALUES (1, 'A', 'a')`);
    await pool.query(`INSERT INTO roles (id, name, display_name, organization_id) VALUES (1, 'konfi', 'Konfi', 1)`);
    await pool.query(`INSERT INTO users (id, username, display_name, password_hash, role_id, organization_id)
                      SELECT g, 'k' || g, 'K ' || g, 'x', 1, 1 FROM generate_series(1, 3) g`);
    await pool.query(`INSERT INTO events (id, name, event_date, organization_id) VALUES (1, 'T', NOW(), 1)`);
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  it('beide Spalten sind timestamptz mit Default now()', async () => {
    const { rows } = await pool.query(`
      SELECT table_name, data_type, column_default FROM information_schema.columns
      WHERE column_name = 'created_at' AND table_name IN ('event_bookings', 'event_timeslots')
      ORDER BY table_name`);
    expect(rows).toEqual([
      { table_name: 'event_bookings', data_type: 'timestamp with time zone', column_default: 'now()' },
      { table_name: 'event_timeslots', data_type: 'timestamp with time zone', column_default: 'now()' },
    ]);
  });

  it('sortiert nach Zeitpunkt, nicht nach Uhrzeit', async () => {
    // Als TEXT kaeme 2 vor 1 (13:45 > 12:00 als Zeichenkette), obwohl
    // 13:45+02 (11:45 UTC) frueher ist als 12:00+00.
    await pool.query(`INSERT INTO event_bookings (id, event_id, user_id, organization_id, status, created_at)
                      VALUES (1, 1, 1, 1, 'confirmed', '2026-09-26 13:45:00+02'),
                             (2, 1, 2, 1, 'confirmed', '2026-09-26 12:00:00+00')`);
    const { rows } = await pool.query('SELECT id FROM event_bookings ORDER BY created_at, id');
    expect(rows.map((r) => r.id)).toEqual([1, 2]);
  });

  it('neue Buchungen bekommen den Zeitpunkt von selbst', async () => {
    await pool.query(`INSERT INTO event_bookings (id, event_id, user_id, organization_id, status)
                      VALUES (3, 1, 3, 1, 'waitlist')`);
    const { rows } = await pool.query(
      'SELECT EXTRACT(EPOCH FROM (NOW() - created_at))::int AS alt FROM event_bookings WHERE user_id = 3'
    );
    expect(rows).toEqual([{ alt: 0 }]);
  });
});

describe('Migration 177 im Test-Schema (Deploy-Weg)', () => {
  let db;
  beforeAll(() => { db = getTestPool(); });
  afterAll(async () => { await closePool(); });

  it('keine Zeitspalte mehr als TEXT', async () => {
    const { rows } = await db.query(`
      SELECT table_name || '.' || column_name AS spalte FROM information_schema.columns
      WHERE table_schema = 'public' AND data_type = 'text'
        AND (column_name LIKE '%\\_at' OR column_name LIKE '%\\_date' OR column_name LIKE '%zeit%')
      ORDER BY 1`);
    expect(rows.map((r) => r.spalte)).toEqual([]);
  });
});
