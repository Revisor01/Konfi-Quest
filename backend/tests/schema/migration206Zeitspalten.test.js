// MIGRATION 206: Die letzten 24 Zeitspalten ohne Zeitzone werden timestamptz
// (09.10.2026, Datenbank BF-11, Rest).
//
// Der Bestand ist UTC -- bis auf das, was in Produktion nachweislich in
// Berliner Zeit geschrieben wurde: alles mit NOW() vom 21. bis 23.08.2026
// (alle Sitzungen der Backends liefen da in Berliner Zeit) und einige von
// Hand per psql geschriebene Zeilen. Die Messung steht in der Migration.
//
// Geprueft wird auf dem Stand, auf den 206 beim Deploy trifft (eigene
// Datenbank bis vor 206): jeder Wert steht danach fuer den richtigen
// Zeitpunkt, die Antwort der App an die ausgelieferten Apps bleibt Zeichen
// fuer Zeichen dieselbe, Vorgaben und View bleiben, ein zweiter Lauf aendert
// nichts. Dazu das gemeinsame Test-Schema (Deploy-Weg).
const {
  dbAnlegen, dbWegraeumen, produktionAufbauen, migrationLesen,
} = require('../helpers/schemaAufbau');
const { getTestPool, closePool } = require('../helpers/db');

const MIGRATION = '206_zeitspalten_mit_zeitzone.sql';
const DB = 'konfi_test_mig206';

const OHNE_ZONE = `
  SELECT table_name || '.' || column_name AS spalte FROM information_schema.columns
   WHERE table_schema = 'public' AND data_type = 'timestamp without time zone'
   ORDER BY 1`;

// Was res.json() aus einer Zeile macht: node-pg liefert ein Date, JSON
// schreibt toISOString(). In Produktion laeuft der Node-Prozess in UTC; so
// liest node-pg einen Wert ohne Zone als UTC-Wandzeit.
const alsJson = (wert) => JSON.parse(JSON.stringify({ wert })).wert;
async function inProzessZone(zone, fn) {
  const vorher = process.env.TZ;
  process.env.TZ = zone;
  try {
    return await fn();
  } finally {
    process.env.TZ = vorher;
  }
}

describe('Migration 206 auf dem Stand, auf den sie beim Deploy trifft', () => {
  let pool;
  let antwortVorher;
  let viewVorher;

  const werte = async () => {
    const q = async (sql) => (await pool.query(sql)).rows.map((r) => Object.fromEntries(
      Object.entries(r).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v])
    ));
    return {
      notifications: await q('SELECT id, created_at, read_at FROM notifications ORDER BY id'),
      refresh_tokens: await q('SELECT id, created_at, expires_at FROM refresh_tokens ORDER BY id'),
      levels: await q('SELECT id, created_at, updated_at FROM levels ORDER BY id'),
      user_organizations: await q('SELECT id, created_at FROM user_organizations ORDER BY id'),
      materials: await q('SELECT id, created_at FROM materials ORDER BY id'),
    };
  };

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool, { vor: MIGRATION });
    await pool.query(`INSERT INTO organizations (id, name, slug) VALUES (1, 'A', 'a'), (2, 'B', 'b')`);
    await pool.query(`INSERT INTO roles (id, name, display_name, organization_id) VALUES (901, 'konfi', 'Konfi', 1)`);
    await pool.query(`INSERT INTO users (id, username, display_name, password_hash, role_id, organization_id, deleted_at)
                      VALUES (1, 'k1', 'K 1', 'x', 901, 1, NULL), (2, 'k2', 'K 2', 'x', 901, 1, '2026-10-01 08:00')`);
    // Werte, wie sie in Produktion stehen (naive Wandzeit).
    await pool.query(`INSERT INTO notifications (id, user_id, title, organization_id, created_at, read_at) VALUES
      (1, 1, 'utc',            1, '2026-10-01 12:00:00.123456', '2026-10-01 12:05:00'),
      (2, 1, 'fenster',        1, '2026-08-22 12:17:10.786988', NULL),
      (3, 1, 'vor-fenster',    1, '2026-08-21 16:59:59',        NULL),
      (4, 1, 'nach-fenster',   1, '2026-08-23 22:10:01',        NULL),
      (5, 1, 'demo-psql',      1, '2026-09-25 21:55:49.365759', '2026-09-19 22:00:49.365759'),
      (6, 1, 'demo-nachbar',   1, '2026-09-25 21:55:49.365758', NULL)`);
    await pool.query(`INSERT INTO refresh_tokens (id, user_id, token_hash, created_at, expires_at) VALUES
      (1, 1, 'utc',     '2026-10-09 13:55:00.510673', '2027-01-07 13:55:00.51'),
      (2, 1, 'fenster', '2026-08-22 12:06:17.027843', '2026-11-20 10:06:17.027'),
      (3, 1, 'ablauf-im-fenster', '2026-05-24 12:00:00', '2026-08-22 12:00:00')`);
    await pool.query(`INSERT INTO levels (id, organization_id, name, title, points_required, created_at, updated_at) VALUES
      (1, 1, 'novize', 'Noviz:in', 2, '2026-09-25 20:55:59.354073', '2026-09-25 20:55:59.354073'),
      (2, 2, 'novize', 'Noviz:in', 2, '2026-10-07 18:29:00.748322', '2026-10-07 18:29:00.748322')`);
    await pool.query(`INSERT INTO user_organizations (id, user_id, organization_id, role_id, created_at) VALUES
      (1, 1, 2, 901, '2026-09-26 02:07:11.742477'),
      (2, 2, 2, 901, '2026-09-26 13:50:16.53778')`);
    await pool.query(`INSERT INTO materials (id, title, organization_id, created_at) VALUES
      (1, 'demo-psql', 1, '2026-09-04 10:26:59.662153'),
      (2, 'demo-rund', 1, '2026-09-08 09:30:00')`);
    await pool.query(`INSERT INTO events (id, name, event_date, organization_id) VALUES (1, 'T', NOW(), 1)`);
    await pool.query(`INSERT INTO event_bookings (event_id, user_id, organization_id, status)
                      VALUES (1, 1, 1, 'confirmed'), (1, 2, 1, 'confirmed')`);

    antwortVorher = await inProzessZone('UTC', async () => {
      const { rows } = await pool.query('SELECT created_at, read_at FROM notifications WHERE id = 1');
      return { created_at: alsJson(rows[0].created_at), read_at: alsJson(rows[0].read_at) };
    });
    viewVorher = (await pool.query("SELECT pg_get_viewdef('event_booking_stats'::regclass) AS d")).rows[0].d;

    await pool.query(migrationLesen(MIGRATION));
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  it('keine Zeitspalte ohne Zone mehr im ganzen Schema', async () => {
    expect((await pool.query(OHNE_ZONE)).rows).toEqual([]);
  });

  it('UTC-Bestand: derselbe Zeitpunkt; Berliner Fenster und psql-Zeilen: zwei Stunden frueher', async () => {
    const w = await werte();
    expect(w.notifications).toEqual([
      { id: 1, created_at: '2026-10-01T12:00:00.123Z', read_at: '2026-10-01T12:05:00.000Z' },
      { id: 2, created_at: '2026-08-22T10:17:10.786Z', read_at: null },
      { id: 3, created_at: '2026-08-21T16:59:59.000Z', read_at: null },
      { id: 4, created_at: '2026-08-23T22:10:01.000Z', read_at: null },
      { id: 5, created_at: '2026-09-25T19:55:49.365Z', read_at: '2026-09-19T20:00:49.365Z' },
      { id: 6, created_at: '2026-09-25T21:55:49.365Z', read_at: null },
    ]);
    expect(w.levels).toEqual([
      { id: 1, created_at: '2026-09-25T18:55:59.354Z', updated_at: '2026-09-25T18:55:59.354Z' },
      { id: 2, created_at: '2026-10-07T18:29:00.748Z', updated_at: '2026-10-07T18:29:00.748Z' },
    ]);
    expect(w.user_organizations).toEqual([
      { id: 1, created_at: '2026-09-26T00:07:11.742Z' },
      { id: 2, created_at: '2026-09-26T13:50:16.537Z' },
    ]);
    expect(w.materials).toEqual([
      { id: 1, created_at: '2026-09-04T08:26:59.662Z' },
      { id: 2, created_at: '2026-09-08T09:30:00.000Z' },
    ]);
  });

  it('refresh_tokens: created_at im Fenster wird korrigiert, expires_at kam aus Node und bleibt', async () => {
    const { rows } = await pool.query(`
      SELECT id, created_at, expires_at, expires_at - created_at AS laufzeit
        FROM refresh_tokens ORDER BY id`);
    expect(rows.map((r) => [r.id, r.created_at.toISOString(), r.expires_at.toISOString()])).toEqual([
      [1, '2026-10-09T13:55:00.510Z', '2027-01-07T13:55:00.510Z'],
      [2, '2026-08-22T10:06:17.027Z', '2026-11-20T10:06:17.027Z'],
      [3, '2026-05-24T12:00:00.000Z', '2026-08-22T12:00:00.000Z'],
    ]);
    // Das Fenster-Token laeuft jetzt wie jedes andere 90 Tage (vorher 89 Tage 22 Stunden).
    expect(rows[1].laufzeit).toEqual(expect.objectContaining({ days: 89, hours: 23, minutes: 59, seconds: 59 }));
  });

  it('die Antwort an die Apps bleibt Zeichen fuer Zeichen dieselbe (Node in UTC wie in Produktion)', async () => {
    const nachher = await inProzessZone('UTC', async () => {
      const { rows } = await pool.query('SELECT created_at, read_at FROM notifications WHERE id = 1');
      return { created_at: alsJson(rows[0].created_at), read_at: alsJson(rows[0].read_at) };
    });
    expect(antwortVorher).toEqual({ created_at: '2026-10-01T12:00:00.123Z', read_at: '2026-10-01T12:05:00.000Z' });
    expect(nachher).toEqual(antwortVorher);
  });

  it('und haengt jetzt nicht mehr an der Zone des Node-Prozesses', async () => {
    const berlin = await inProzessZone('Europe/Berlin', async () => {
      const { rows } = await pool.query('SELECT created_at FROM notifications WHERE id = 1');
      return alsJson(rows[0].created_at);
    });
    expect(berlin).toBe('2026-10-01T12:00:00.123Z');
  });

  it('Vorgaben bleiben; die Datumsvorgaben rechnen im Berliner Tag', async () => {
    const { rows } = await pool.query(`
      SELECT table_name || '.' || column_name AS spalte, column_default AS vorgabe
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND (table_name, column_name) IN (('notifications', 'created_at'), ('refresh_tokens', 'created_at'),
                                           ('event_reminders', 'sent_at'), ('refresh_tokens', 'expires_at'),
                                           ('bonus_points', 'completed_date'), ('user_activities', 'completed_date'))
       ORDER BY 1`);
    expect(rows).toEqual([
      { spalte: 'bonus_points.completed_date', vorgabe: "((now() AT TIME ZONE 'Europe/Berlin'::text))::date" },
      { spalte: 'event_reminders.sent_at', vorgabe: 'now()' },
      { spalte: 'notifications.created_at', vorgabe: 'CURRENT_TIMESTAMP' },
      { spalte: 'refresh_tokens.created_at', vorgabe: 'now()' },
      { spalte: 'refresh_tokens.expires_at', vorgabe: null },
      { spalte: 'user_activities.completed_date', vorgabe: "((now() AT TIME ZONE 'Europe/Berlin'::text))::date" },
    ]);
    await pool.query(`INSERT INTO notifications (id, user_id, title, organization_id) VALUES (7, 1, 'neu', 1)`);
    const { rows: [neu] } = await pool.query(
      'SELECT EXTRACT(EPOCH FROM (NOW() - created_at))::int AS alt FROM notifications WHERE id = 7'
    );
    expect(neu).toEqual({ alt: 0 });
  });

  it('die View event_booking_stats steht wieder, mit derselben Definition', async () => {
    const { rows: [v] } = await pool.query("SELECT pg_get_viewdef('event_booking_stats'::regclass) AS d");
    expect(v.d).toBe(viewVorher);
    // Konto 2 ist geloescht und zaehlt nicht mit.
    const { rows } = await pool.query('SELECT event_id, konfi_confirmed FROM event_booking_stats');
    expect(rows).toEqual([{ event_id: 1, konfi_confirmed: 1 }]);
  });

  it('ein zweiter Lauf scheitert nicht und aendert nichts', async () => {
    const vorher = await werte();
    await pool.query(migrationLesen(MIGRATION));
    expect(await werte()).toEqual(vorher);
    const { rows: [v] } = await pool.query("SELECT pg_get_viewdef('event_booking_stats'::regclass) AS d");
    expect(v.d).toBe(viewVorher);
  });
});

describe('Migration 206 im Test-Schema (Deploy-Weg)', () => {
  let db;
  beforeAll(() => { db = getTestPool(); });
  afterAll(async () => { await closePool(); });

  it('keine Zeitspalte ohne Zone', async () => {
    expect((await db.query(OHNE_ZONE)).rows).toEqual([]);
  });
});
