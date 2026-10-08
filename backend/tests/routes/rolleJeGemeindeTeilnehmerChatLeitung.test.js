// backend/tests/routes/rolleJeGemeindeTeilnehmerChatLeitung.test.js
//
// Drei Stellen, die die Rolle der STAMM-Gemeinde lasen statt der Rolle in
// der Gemeinde des Inhalts (offene Befunde, 02.10.2026; Simon, 08.10.2026,
// docs/planung/mehrfach-konten.md):
//
//   1. GET /events/:id -- Teilnehmerliste (role_name, Konfi/Team-Zaehler,
//      Jahrgaenge einer Teamer:in)
//   2. GET /chat/rooms/:roomId/messages -- sender_role_name und
//      sender_role_display_name
//   3. GET /organizations/:id/admins -- Gemeindeleitung nur aus
//      users.organization_id
//
// Regel wie ladeRolleInGemeinde (utils/orgMitglieder.js): in der
// Stamm-Gemeinde users.role_id, in jeder weiteren user_organizations.role_id.
// Die Antwortformen bleiben: dieselben Felder, dieselben Typen.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ROLES, ORGS, EVENTS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const chatSyncCache = require('../../utils/chatSyncCache');
const { invalidateUserCache } = require('../../middleware/rbac');

describe('Rolle je Gemeinde in Teilnehmerliste, Chat-Nachrichten und Gemeindeleitung', () => {
  let app;
  let db;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    chatSyncCache.clear();
    invalidateUserCache();
    // teamer1: zuhause (Org 1) Teamer:in, in Org 2 Gemeindeleitung.
    await db.query(
      'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
      [USERS.teamer1.id, ORGS.andereGemeinde.id, ROLES.orgAdmin2.id]
    );
    // orgAdmin1: zuhause (Org 1) Gemeindeleitung, in Org 2 Teamer:in.
    await db.query(
      'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
      [USERS.orgAdmin1.id, ORGS.andereGemeinde.id, ROLES.teamer2.id]
    );
  });

  describe('GET /api/events/:id: Teilnehmerliste', () => {
    beforeEach(async () => {
      // orgAdmin1 betreut in Org 1 einen eigenen Jahrgang, in Org 2 jahrgang2.
      const { rows: [jgA] } = await db.query(
        "INSERT INTO jahrgaenge (name, organization_id, confirmation_date) VALUES ('Jahrgang A', $1, '2027-05-01') RETURNING id",
        [ORGS.testGemeinde.id]
      );
      for (const jg of [jgA.id, JAHRGAENGE.jahrgang2.id]) {
        await db.query(
          'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, false)',
          [USERS.orgAdmin1.id, jg]
        );
      }
      for (const userId of [USERS.teamer1.id, USERS.orgAdmin1.id, USERS.konfi3.id]) {
        await db.query(
          "INSERT INTO event_bookings (event_id, user_id, status, organization_id) VALUES ($1, $2, 'confirmed', $3)",
          [EVENTS.event2.id, userId, ORGS.andereGemeinde.id]
        );
      }
    });

    it('in der weiteren Gemeinde: Rolle dort, Jahrgaenge nur von dort', async () => {
      const res = await request(app)
        .get(`/api/events/${EVENTS.event2.id}`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin2')}`);
      expect(res.status).toBe(200);
      const p = (id) => res.body.participants.find((x) => Number(x.user_id) === id);
      expect(p(USERS.teamer1.id).role_name).toBe('org_admin');
      expect(p(USERS.orgAdmin1.id).role_name).toBe('teamer');
      expect(p(USERS.orgAdmin1.id).jahrgang_name).toBe(JAHRGAENGE.jahrgang2.name);
      expect(p(USERS.konfi3.id).role_name).toBe('konfi');
    });

    it('in der Stamm-Gemeinde: Rolle am Konto', async () => {
      await db.query(
        "INSERT INTO event_bookings (event_id, user_id, status, organization_id) VALUES ($1, $2, 'confirmed', $3)",
        [EVENTS.gottesdienstEvent.id, USERS.orgAdmin1.id, ORGS.testGemeinde.id]
      );
      const res = await request(app)
        .get(`/api/events/${EVENTS.gottesdienstEvent.id}`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
      expect(res.status).toBe(200);
      const p = res.body.participants.find((x) => Number(x.user_id) === USERS.orgAdmin1.id);
      expect(p.role_name).toBe('org_admin');
    });
  });

  describe('GET /api/chat/rooms/:roomId/messages: Rolle hinter dem Namen', () => {
    let raumB;
    let raumA;

    beforeEach(async () => {
      ({ rows: [raumB] } = await db.query(
        "INSERT INTO chat_rooms (name, type, created_by, organization_id) VALUES ('Team B', 'group', $1, $2) RETURNING id",
        [USERS.admin2.id, ORGS.andereGemeinde.id]
      ));
      ({ rows: [raumA] } = await db.query(
        "INSERT INTO chat_rooms (name, type, created_by, organization_id) VALUES ('Team A', 'group', $1, $2) RETURNING id",
        [USERS.admin1.id, ORGS.testGemeinde.id]
      ));
      for (const [room, userId, typ] of [
        [raumB.id, USERS.admin2.id, 'admin'], [raumB.id, USERS.orgAdmin1.id, 'teamer'],
        [raumA.id, USERS.admin1.id, 'admin'], [raumA.id, USERS.orgAdmin1.id, 'admin'],
      ]) {
        await db.query('INSERT INTO chat_participants (room_id, user_id, user_type) VALUES ($1, $2, $3)', [room, userId, typ]);
        await db.query(
          "INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content) VALUES ($1, $2, $3, 'text', 'Hallo')",
          [room, userId, typ]
        );
      }
    });

    const nachrichten = async (token, roomId) => {
      const res = await request(app)
        .get(`/api/chat/rooms/${roomId}/messages`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      return res.body;
    };

    it('weitere Gemeinde: die Rolle dort (teamer statt org_admin)', async () => {
      const liste = await nachrichten(generateToken('admin2'), raumB.id);
      const von = liste.find((m) => Number(m.sender_id) === USERS.orgAdmin1.id);
      expect(von.sender_role_name).toBe('teamer');
      expect(von.sender_role_display_name).toBe(ROLES.teamer2.display_name);
      expect(liste.find((m) => Number(m.sender_id) === USERS.admin2.id).sender_role_name).toBe('admin');
    });

    it('Stamm-Gemeinde: die Rolle am Konto', async () => {
      const liste = await nachrichten(generateToken('admin1'), raumA.id);
      const von = liste.find((m) => Number(m.sender_id) === USERS.orgAdmin1.id);
      expect(von.sender_role_name).toBe('org_admin');
    });
  });

  describe('GET /api/organizations/:id/admins', () => {
    it('Gemeindeleitung ueber user_organizations steht in der Liste, Teamer:in dort nicht', async () => {
      const res = await request(app)
        .get(`/api/organizations/${ORGS.andereGemeinde.id}/admins`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin2')}`);
      expect(res.status).toBe(200);
      expect(res.body.map((a) => Number(a.id)).sort((a, b) => a - b))
        .toEqual([USERS.teamer1.id, USERS.orgAdmin2.id].sort((a, b) => a - b));
      expect(Object.keys(res.body[0]).sort()).toEqual(
        ['created_at', 'display_name', 'email', 'id', 'is_active', 'last_login_at', 'username']
      );
    });

    it('Stamm-Gemeinde: zuhause Gemeindeleitung bleibt drin, wer nur anderswo leitet, nicht', async () => {
      const res = await request(app)
        .get(`/api/organizations/${ORGS.testGemeinde.id}/admins`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
      expect(res.status).toBe(200);
      expect(res.body.map((a) => Number(a.id)).sort((a, b) => a - b))
        .toEqual([USERS.orgAdmin1.id, USERS.orgAdminSuper.id].sort((a, b) => a - b));
    });

    it('verboten: Gemeindeleitung einer anderen Gemeinde -> 403', async () => {
      const res = await request(app)
        .get(`/api/organizations/${ORGS.andereGemeinde.id}/admins`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
      expect(res.status).toBe(403);
    });
  });
});
