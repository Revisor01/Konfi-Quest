// Von Hand eintragen und von der Warteliste bestaetigen: bei vollem Event
// nachfragen, dann ueberbuchen -- fuer Konfis UND Team (Simon, 28.09.2026).
//
// Am Morgen des 28.09. hat Simon fuer das Bestaetigen einer Wartenden
// Variante c gewaehlt (nachfragen, dann bestaetigen;
// bestaetigenUeberbuchen.test.js) und gleich danach: "Die sollten wir auch
// einfügen, wenn wir Konfi hinzufügen ... oder auch bei Teamern."
//
// POST /events/:id/participants mit status 'confirmed' ueberbucht seit jeher
// still (Simon, 28.09.: "Überbuchen ist gewollt"). Die Store-Apps 2.2.x/2.3.0
// bauen darauf -- sie schicken 'confirmed' ohne weiteres Feld und bekommen
// 201. Das bleibt. Die neue App schickt zuerst `ueberbuchen: false`; ist das
// Kontingent voll, antwortet die Route mit derselben Ablehnung wie das
// Bestaetigen (400, error_code 'event_voll', max, belegt, seite), die App
// fragt, und nach dem Ja kommt `ueberbuchen: true`.
//
// Das Kontingent ist die Seite der Person: Konfis zaehlen gegen die
// Konfi-Plaetze bzw. ihr Zeitfenster, alle anderen (Team, Leitung) gegen die
// Team-Plaetze -- dieselbe Weiche wie beim Nachruecken.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE, ROLES, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

const VOLL_TEXT = 'Das Event ist voll. Erhöhe die Teilnehmerzahl, um weitere Plätze zu vergeben.';
const EVENT_DATUM = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

describe('Von Hand und von der Warteliste: nachfragen, dann ueberbuchen', () => {
  let app;
  let db;
  let adminToken;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    adminToken = generateToken('admin1');
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
    );
    require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);
  });

  afterAll(async () => {
    await closePool();
  });

  /** Weitere Person derselben Gemeinde im Jahrgang 1 (Konfi oder Team). */
  async function person(username, rolle) {
    const roleId = rolle === 'konfi' ? ROLES.konfi.id : ROLES.teamer.id;
    const { rows: [u] } = await db.query(
      `INSERT INTO users (username, display_name, password_hash, role_id, organization_id, is_active)
       VALUES ($1, $2, 'x', $3, $4, true) RETURNING id`,
      [username, `Person ${username}`, roleId, ORGS.testGemeinde.id]
    );
    if (rolle === 'konfi') {
      await db.query(
        `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
         VALUES ($1, $2, 0, 0, $3)`,
        [u.id, JAHRGAENGE.jahrgang1.id, ORGS.testGemeinde.id]
      );
    } else {
      await db.query(
        'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, false)',
        [u.id, JAHRGAENGE.jahrgang1.id]
      );
    }
    require('../../middleware/rbac').invalidateUserCache(u.id);
    return u.id;
  }

  async function event({ max = 1, teamerMax = 0, zeitfenster = false } = {}) {
    const { rows: [e] } = await db.query(
      `INSERT INTO events (name, event_date, organization_id, max_participants, waitlist_enabled,
                           max_waitlist_size, teamer_needed, teamer_max_participants,
                           teamer_waitlist_enabled, teamer_max_waitlist_size, points, point_type,
                           has_timeslots)
       VALUES ('Konfifahrt', $2, $1, $3, true, 10, true, $4, true, 10, 0, 'gemeinde', $5)
       RETURNING id`,
      [ORGS.testGemeinde.id, EVENT_DATUM, max, teamerMax, zeitfenster]
    );
    await db.query(
      'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
      [e.id, JAHRGAENGE.jahrgang1.id]
    );
    return e.id;
  }

  async function fenster(eventId, max) {
    const { rows: [ts] } = await db.query(
      `INSERT INTO event_timeslots (event_id, start_time, end_time, max_participants, organization_id)
       VALUES ($1, NOW() + interval '14 days', NOW() + interval '14 days' + interval '2 hours', $2, $3)
       RETURNING id`,
      [eventId, max, ORGS.testGemeinde.id]
    );
    return ts.id;
  }

  async function bucht(eventId, userId, status, timeslotId = null) {
    const { rows: [b] } = await db.query(
      `INSERT INTO event_bookings (user_id, event_id, status, organization_id, booking_date, timeslot_id)
       VALUES ($1, $2, $3, $4, NOW(), $5) RETURNING id`,
      [userId, eventId, status, ORGS.testGemeinde.id, timeslotId]
    );
    return b.id;
  }

  const eintragen = (eventId, felder) => request(app)
    .post(`/api/events/${eventId}/participants`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ status: 'confirmed', ...felder });

  const bestaetige = (eventId, bookingId, extra = {}) => request(app)
    .put(`/api/events/${eventId}/participants/${bookingId}/status`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ status: 'confirmed', ...extra });

  const status = async (eventId, userId) => (await db.query(
    'SELECT status FROM event_bookings WHERE event_id = $1 AND user_id = $2', [eventId, userId]
  )).rows[0]?.status;

  describe('Konfi von Hand eintragen', () => {
    it('voll und ueberbuchen: false -> 400 event_voll mit Zahlen und Seite, keine Buchung', async () => {
      const eventId = await event({ max: 1 });
      await bucht(eventId, USERS.konfi1.id, 'confirmed');

      const res = await eintragen(eventId, { user_id: USERS.konfi2.id, ueberbuchen: false });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: VOLL_TEXT, error_code: 'event_voll', max: 1, belegt: 1, seite: 'konfi' });
      expect(await status(eventId, USERS.konfi2.id)).toBeUndefined();
    });

    it('voll und ueberbuchen: true -> 201, bestaetigt ueber die Grenze', async () => {
      const eventId = await event({ max: 1 });
      await bucht(eventId, USERS.konfi1.id, 'confirmed');

      const res = await eintragen(eventId, { user_id: USERS.konfi2.id, ueberbuchen: true });

      expect(res.status).toBe(201);
      expect(await status(eventId, USERS.konfi2.id)).toBe('confirmed');
    });

    it('Store-App ohne das Feld: ueberbucht wie bisher still (201)', async () => {
      const eventId = await event({ max: 1 });
      await bucht(eventId, USERS.konfi1.id, 'confirmed');

      const res = await eintragen(eventId, { user_id: USERS.konfi2.id });

      expect(res.status).toBe(201);
      expect(await status(eventId, USERS.konfi2.id)).toBe('confirmed');
    });

    it('Platz frei: ueberbuchen: false traegt ohne Rueckfrage ein', async () => {
      const eventId = await event({ max: 2 });
      await bucht(eventId, USERS.konfi1.id, 'confirmed');

      const res = await eintragen(eventId, { user_id: USERS.konfi2.id, ueberbuchen: false });

      expect(res.status).toBe(201);
      expect(await status(eventId, USERS.konfi2.id)).toBe('confirmed');
    });

    it('volles Zeitfenster zaehlt das Fenster, nicht das Event', async () => {
      const eventId = await event({ max: 10, zeitfenster: true });
      const slot = await fenster(eventId, 1);
      await bucht(eventId, USERS.konfi1.id, 'confirmed', slot);

      const res = await eintragen(eventId, { user_id: USERS.konfi2.id, timeslot_id: slot, ueberbuchen: false });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error_code: 'event_voll', max: 1, belegt: 1, seite: 'konfi' });
    });
  });

  describe('Teamer:in von Hand eintragen', () => {
    it('Team-Plaetze voll -> 400 mit seite team, auch wenn Konfi-Plaetze frei sind', async () => {
      const eventId = await event({ max: 5, teamerMax: 1 });
      const t2 = await person('team-zwei', 'teamer');
      await bucht(eventId, t2, 'confirmed');

      const res = await eintragen(eventId, { user_id: USERS.teamer1.id, ueberbuchen: false });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: VOLL_TEXT, error_code: 'event_voll', max: 1, belegt: 1, seite: 'team' });
      expect(await status(eventId, USERS.teamer1.id)).toBeUndefined();
    });

    it('nach dem Ja: 201, zwei im Team bei einem Platz', async () => {
      const eventId = await event({ max: 5, teamerMax: 1 });
      const t2 = await person('team-zwei', 'teamer');
      await bucht(eventId, t2, 'confirmed');

      const res = await eintragen(eventId, { user_id: USERS.teamer1.id, ueberbuchen: true });

      expect(res.status).toBe(201);
      expect(await status(eventId, USERS.teamer1.id)).toBe('confirmed');
    });

    it('volle Konfi-Plaetze halten das Team nicht auf', async () => {
      const eventId = await event({ max: 1, teamerMax: 2 });
      await bucht(eventId, USERS.konfi1.id, 'confirmed');

      const res = await eintragen(eventId, { user_id: USERS.teamer1.id, ueberbuchen: false });

      expect(res.status).toBe(201);
    });
  });

  describe('Teamer:in von der Warteliste bestaetigen', () => {
    it('Team voll -> 400 mit seite team; nach dem Ja bestaetigt', async () => {
      const eventId = await event({ max: 5, teamerMax: 1 });
      const t2 = await person('team-zwei', 'teamer');
      await bucht(eventId, t2, 'confirmed');
      const wartend = await bucht(eventId, USERS.teamer1.id, 'waitlist');

      const nein = await bestaetige(eventId, wartend);
      expect(nein.status).toBe(400);
      expect(nein.body).toEqual({ error: VOLL_TEXT, error_code: 'event_voll', max: 1, belegt: 1, seite: 'team' });
      expect(await status(eventId, USERS.teamer1.id)).toBe('waitlist');

      const ja = await bestaetige(eventId, wartend, { ueberbuchen: true });
      expect(ja.status).toBe(200);
      expect(await status(eventId, USERS.teamer1.id)).toBe('confirmed');
    });

    it('Konfi im vollen Zeitfenster: 400 mit dem Fenster als max', async () => {
      const eventId = await event({ max: 10, zeitfenster: true });
      const slot = await fenster(eventId, 1);
      await bucht(eventId, USERS.konfi1.id, 'confirmed', slot);
      const wartend = await bucht(eventId, USERS.konfi2.id, 'waitlist', slot);

      const res = await bestaetige(eventId, wartend);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error_code: 'event_voll', max: 1, belegt: 1, seite: 'konfi' });
    });
  });
});
