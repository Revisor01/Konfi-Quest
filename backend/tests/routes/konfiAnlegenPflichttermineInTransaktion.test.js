// Konfi anlegen: Einschreibung in Pflicht-Events gehoert zur Transaktion
// (Audit 26.09.2026, Fachlogik Punkte/Termine BF-13).
//
// POST /admin/konfis legte die Konfi an, beendete die Transaktion und buchte
// ERST DANACH die kuenftigen Pflicht-Events ihres Jahrgangs -- auf dem Pool,
// Fehler nur ins Log. Scheiterte die Einschreibung, gab es die Konfi, aber in
// keinem Pflicht-Event, und die Leitung bekam trotzdem 201 samt Passwort. Der
// Jahrgangswechsel (PUT) macht dasselbe seit August innerhalb der
// Transaktion; das Anlegen jetzt auch: ganz oder gar nicht.
//
// Den Fehlschlag stellt ein Trigger nach, der jede neue Buchung fuer den
// Test-Termin ablehnt (nach dem Test wieder entfernt).
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');

describe('POST /admin/konfis: Pflicht-Events in derselben Transaktion', () => {
  let app;
  let db;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    Object.values(USERS).forEach(u => invalidateUserCache(u.id));
  });

  afterEach(async () => {
    await db.query('DROP TRIGGER IF EXISTS test_buchung_ablehnen ON event_bookings');
    await db.query('DROP FUNCTION IF EXISTS test_buchung_ablehnen()');
  });

  afterAll(async () => {
    await closePool();
  });

  const pflichtEvent = async ({ name = 'Pflicht-Gottesdienst', tage = 14, abgesagt = false } = {}) => {
    const { rows: [e] } = await db.query(
      `INSERT INTO events (name, event_date, organization_id, mandatory, cancelled, point_type, points)
       VALUES ($1, NOW() + ($2 || ' days')::interval, $3, true, $4, 'gottesdienst', 1)
       RETURNING id`,
      [name, String(tage), ORGS.testGemeinde.id, abgesagt]
    );
    await db.query(
      'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
      [e.id, JAHRGAENGE.jahrgang1.id]
    );
    return e.id;
  };

  const anlegen = (name) =>
    request(app)
      .post('/api/admin/konfis')
      .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`)
      .send({ name, jahrgang_id: JAHRGAENGE.jahrgang1.id });

  const konfiNamens = async (name) =>
    (await db.query('SELECT id FROM users WHERE display_name = $1', [name])).rows;

  it('scheitert die Einschreibung, entsteht keine Konfi -- und die Leitung erfaehrt es', async () => {
    const eventId = await pflichtEvent();
    await db.query(`
      CREATE FUNCTION test_buchung_ablehnen() RETURNS trigger AS $$
      BEGIN
        IF NEW.event_id = ${eventId} THEN RAISE EXCEPTION 'Buchung abgelehnt (Test)'; END IF;
        RETURN NEW;
      END $$ LANGUAGE plpgsql`);
    await db.query(`
      CREATE TRIGGER test_buchung_ablehnen BEFORE INSERT ON event_bookings
      FOR EACH ROW EXECUTE FUNCTION test_buchung_ablehnen()`);
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await anlegen('Kim Halbfertig');
    fehler.mockRestore();

    expect(res.status).toBe(500);
    expect(res.body.temporaryPassword).toBeUndefined();
    expect(await konfiNamens('Kim Halbfertig')).toEqual([]);
  });

  it('erlaubt: die neue Konfi steht in jedem kuenftigen Pflicht-Event und in dessen Chat', async () => {
    const eventId = await pflichtEvent();
    const { rows: [raum] } = await db.query(
      `INSERT INTO chat_rooms (name, type, event_id, created_by, organization_id)
       VALUES ('Pflicht-Chat', 'group', $1, $2, $3) RETURNING id`,
      [eventId, USERS.orgAdmin1.id, ORGS.testGemeinde.id]
    );

    const res = await anlegen('Kim Vollstaendig');

    expect(res.status).toBe(201);
    const { rows: buchungen } = await db.query(
      'SELECT event_id, status FROM event_bookings WHERE user_id = $1 AND event_id = $2',
      [res.body.id, eventId]
    );
    expect(buchungen).toEqual([{ event_id: eventId, status: 'confirmed' }]);
    const { rows: teilnahme } = await db.query(
      'SELECT user_type FROM chat_participants WHERE room_id = $1 AND user_id = $2',
      [raum.id, res.body.id]
    );
    expect(teilnahme).toEqual([{ user_type: 'konfi' }]);
  });

  it('Gegenprobe: abgesagte und vergangene Pflicht-Events bucht das Anlegen nicht', async () => {
    const abgesagt = await pflichtEvent({ name: 'Abgesagt', abgesagt: true });
    const vorbei = await pflichtEvent({ name: 'Vorbei', tage: -3 });

    const res = await anlegen('Kim Ohne');

    expect(res.status).toBe(201);
    const { rowCount } = await db.query(
      'SELECT 1 FROM event_bookings WHERE user_id = $1 AND event_id = ANY($2::int[])',
      [res.body.id, [abgesagt, vorbei]]
    );
    expect(rowCount).toBe(0);
  });
});
