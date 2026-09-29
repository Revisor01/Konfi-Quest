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
const {
  dbAnlegen, dbWegraeumen, produktionAufbauen, migrationLesen,
} = require('../helpers/schemaAufbau');
const { getTestPool, closePool } = require('../helpers/db');

const MIGRATION = '177_zeitstempel_statt_text.sql';
const DB = 'konfi_test_mig177';

// Buchungen mit den Formaten, die in der Spalte vorkommen koennen. id =
// chronologische Reihenfolge (1 = frueheste).
const BUCHUNGEN = [
  { id: 1, text: '2025-12-01 10:00:00' },         // SQLite, ohne Zone (UTC)
  { id: 2, text: '2026-09-26 13:45:00.25+02' },   // psql-Sitzung Berlin: 11:45 UTC
  { id: 3, text: '2026-09-26 12:00:00.5+00' },    // Backend-Sitzung UTC: 12:00 UTC, also SPAETER
  { id: 4, text: '2026-10-25 02:30:00+02' },      // 02:30 vor der Umstellung
  { id: 5, text: '2026-10-25 02:10:00+01' },      // 02:10 nach der Umstellung: 40 Minuten SPAETER
];

describe('Migration 177 auf dem Stand, auf den sie beim Deploy trifft', () => {
  let pool;

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool, { vor: MIGRATION });
    await pool.query(`INSERT INTO organizations (id, name, slug) VALUES (1, 'A', 'a')`);
    await pool.query(`INSERT INTO roles (id, name, display_name, organization_id) VALUES (1, 'konfi', 'Konfi', 1)`);
    await pool.query(`INSERT INTO users (id, username, display_name, password_hash, role_id, organization_id)
                      SELECT g, 'k' || g, 'K ' || g, 'x', 1, 1 FROM generate_series(1, 7) g`);
    await pool.query(`INSERT INTO events (id, name, event_date, organization_id) VALUES (1, 'T', NOW(), 1)`);
    for (const b of BUCHUNGEN) {
      await pool.query(
        `INSERT INTO event_bookings (id, event_id, user_id, organization_id, status, created_at)
         VALUES ($1, 1, $1, 1, 'confirmed', $2)`,
        [b.id, b.text]
      );
    }
    // Ein unbrauchbarer Wert: wird NULL statt die Migration scheitern zu lassen.
    await pool.query(`INSERT INTO event_bookings (id, event_id, user_id, organization_id, status, created_at)
                      VALUES (6, 1, 6, 1, 'confirmed', 'kein Datum')`);
    await pool.query(`INSERT INTO event_timeslots (id, event_id, start_time, end_time, organization_id, created_at)
                      VALUES (1, 1, NOW(), NOW() + interval '1 hour', 1, '2026-09-26 13:45:00+02')`);
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  const reihenfolge = async () => (await pool.query(
    'SELECT id FROM event_bookings WHERE id <= 5 ORDER BY created_at, id'
  )).rows.map((r) => r.id);

  it('Ausgangslage: TEXT sortiert nach Uhrzeit, nicht nach Zeitpunkt', async () => {
    // Chronologisch waere 1, 2, 3, 4, 5 -- zweimal vertauscht.
    expect(await reihenfolge()).toEqual([1, 3, 2, 5, 4]);
  });

  it('danach sind beide Spalten timestamptz mit Default now()', async () => {
    await pool.query(migrationLesen(MIGRATION));
    const { rows } = await pool.query(`
      SELECT table_name, data_type, column_default FROM information_schema.columns
      WHERE column_name = 'created_at' AND table_name IN ('event_bookings', 'event_timeslots')
      ORDER BY table_name`);
    expect(rows).toEqual([
      { table_name: 'event_bookings', data_type: 'timestamp with time zone', column_default: 'now()' },
      { table_name: 'event_timeslots', data_type: 'timestamp with time zone', column_default: 'now()' },
    ]);
  });

  it('jeder Wert steht fuer denselben Zeitpunkt wie vorher', async () => {
    const { rows } = await pool.query(
      'SELECT id, created_at FROM event_bookings ORDER BY id'
    );
    expect(rows.map((r) => [r.id, r.created_at && r.created_at.toISOString()])).toEqual([
      [1, '2025-12-01T10:00:00.000Z'],
      [2, '2026-09-26T11:45:00.250Z'],
      [3, '2026-09-26T12:00:00.500Z'],
      [4, '2026-10-25T00:30:00.000Z'],
      [5, '2026-10-25T01:10:00.000Z'],
      [6, null],
    ]);
    const { rows: [slot] } = await pool.query('SELECT created_at FROM event_timeslots WHERE id = 1');
    expect(slot.created_at.toISOString()).toBe('2026-09-26T11:45:00.000Z');
  });

  it('sortiert jetzt nach Zeitpunkt', async () => {
    expect(await reihenfolge()).toEqual([1, 2, 3, 4, 5]);
  });

  it('neue Buchungen bekommen den Zeitpunkt von selbst', async () => {
    await pool.query(`INSERT INTO event_bookings (id, event_id, user_id, organization_id, status)
                      VALUES (7, 1, 7, 1, 'waitlist')`);
    const { rows } = await pool.query(
      'SELECT EXTRACT(EPOCH FROM (NOW() - created_at))::int AS alt FROM event_bookings WHERE user_id = 7'
    );
    expect(rows).toEqual([{ alt: 0 }]);
  });

  it('ein zweiter Lauf scheitert nicht und aendert nichts', async () => {
    await pool.query(migrationLesen(MIGRATION));
    expect(await reihenfolge()).toEqual([1, 2, 3, 4, 5]);
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
