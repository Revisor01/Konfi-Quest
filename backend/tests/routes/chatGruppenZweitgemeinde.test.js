// Gruppenchat-Teilnehmer aus einer zweiten Gemeinde
// (POST /api/chat/rooms mit participants, POST /api/chat/rooms/:roomId/participants)
//
// BEFUND (Audit 26.09.2026, Chat BF-08): Beide Stellen loesten die
// Teilnehmenden allein ueber `u.organization_id = $2` auf -- also nur die
// Stamm-Gemeinde. Wer ueber user_organizations in dieser Gemeinde mitarbeitet,
// stand in der Team-Kontaktliste (GET /chat/team-contacts, seit 25.09. beide
// Quellen) und bekam Push aus dieser Gemeinde, liess sich aber nicht in eine
// Gruppe eintragen: POST /rooms liess die Person STILL weg, das nachtraegliche
// Hinzufuegen antwortete 404 "nicht in deiner Organisation".
//
// DASSELBE MUSTER wie bei den Push-Empfaengern (utils/orgMitglieder.js), bei
// GET /users (26.09.) und bei der Kontaktliste selbst (TEAM_MITGLIED_ROLLE in
// routes/chat.js): users.organization_id ist nur die Stamm-Gemeinde, die
// Zugehoerigkeit steht in user_organizations.
//
// DIE ROLLE GILT JE GEMEINDE: Wer in der Stamm-Gemeinde Teamer:in ist und hier
// org_admin, landet hier als 'admin' im Raum (user_type), nicht als 'teamer'.

const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ROLES, CHAT_ROOMS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const chatSyncCache = require('../../utils/chatSyncCache');
const { invalidateUserCache } = require('../../middleware/rbac');

// ID oberhalb des Seed-Bereichs: Stamm-Gemeinde Org 2 als Teamer:in, in Org 1
// als org_admin eingeladen.
const GAST_CHEF = 241;

describe('Gruppenchat mit Teamer:innen aus user_organizations', () => {
  let app;
  let db;
  let orgAdmin1Token;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    chatSyncCache.clear();
    orgAdmin1Token = generateToken('orgAdmin1');

    // teamer2 (Stamm-Gemeinde Org 2) arbeitet zusaetzlich in Org 1 als Teamer:in.
    await db.query(
      `INSERT INTO user_organizations (user_id, organization_id, role_id)
       VALUES ($1, 1, $2)`,
      [USERS.teamer2.id, ROLES.teamer.id]
    );
    // GAST_CHEF: Stamm-Gemeinde Org 2 (Teamer:in), in Org 1 org_admin.
    await db.query(
      `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
       VALUES ($1, 'gast-chef-c', 'x', 'Gast Chef C', $2, 2, true)`,
      [GAST_CHEF, ROLES.teamer2.id]
    );
    await db.query(
      `INSERT INTO user_organizations (user_id, organization_id, role_id)
       VALUES ($1, 1, $2)`,
      [GAST_CHEF, ROLES.orgAdmin.id]
    );
    invalidateUserCache(USERS.teamer2.id);
    invalidateUserCache(GAST_CHEF);
  });

  const teilnehmer = async (roomId) => {
    const { rows } = await db.query(
      'SELECT user_id, user_type FROM chat_participants WHERE room_id = $1 ORDER BY user_id',
      [roomId]
    );
    return rows.map(r => ({ user_id: Number(r.user_id), user_type: r.user_type }));
  };

  const gruppeAnlegen = (participants) =>
    request(app)
      .post('/api/chat/rooms')
      .set('Authorization', `Bearer ${orgAdmin1Token}`)
      .send({ type: 'group', name: 'Gemeinsam', participants });

  const hinzufuegen = (roomId, user_id) =>
    request(app)
      .post(`/api/chat/rooms/${roomId}/participants`)
      .set('Authorization', `Bearer ${orgAdmin1Token}`)
      .send({ user_id });

  describe('POST /rooms (Gruppe anlegen)', () => {
    it('nimmt eine Teamer:in aus user_organizations in die Gruppe auf', async () => {
      const res = await gruppeAnlegen([USERS.teamer2.id]);

      expect(res.status).toBe(200);
      expect(await teilnehmer(res.body.room_id)).toEqual([
        { user_id: USERS.orgAdmin1.id, user_type: 'admin' },
        { user_id: USERS.teamer2.id, user_type: 'teamer' }
      ]);
    });

    it('vergibt user_type nach der Rolle in DIESER Gemeinde', async () => {
      const res = await gruppeAnlegen([GAST_CHEF]);

      expect(res.status).toBe(200);
      // Stamm-Rolle Teamer:in, hier aber org_admin -> 'admin'.
      expect(await teilnehmer(res.body.room_id)).toContainEqual(
        { user_id: GAST_CHEF, user_type: 'admin' }
      );
    });

    it('Stamm-Mitglieder kommen unveraendert hinein', async () => {
      const res = await gruppeAnlegen([USERS.teamer1.id, USERS.konfi1.id]);

      expect(res.status).toBe(200);
      expect(await teilnehmer(res.body.room_id)).toEqual([
        { user_id: USERS.konfi1.id, user_type: 'konfi' },
        { user_id: USERS.teamer1.id, user_type: 'teamer' },
        { user_id: USERS.orgAdmin1.id, user_type: 'admin' }
      ]);
    });

    it('wer in KEINER der beiden Quellen zur Gemeinde gehoert, bleibt draussen', async () => {
      await db.query('DELETE FROM user_organizations WHERE user_id = $1', [USERS.teamer2.id]);
      invalidateUserCache(USERS.teamer2.id);

      const res = await gruppeAnlegen([USERS.teamer2.id, USERS.admin2.id]);

      expect(res.status).toBe(200);
      expect(await teilnehmer(res.body.room_id)).toEqual([
        { user_id: USERS.orgAdmin1.id, user_type: 'admin' }
      ]);
    });
  });

  describe('POST /rooms/:roomId/participants (nachtraeglich hinzufuegen)', () => {
    it('Teamer:in aus user_organizations -> 201', async () => {
      const res = await hinzufuegen(CHAT_ROOMS.group.id, USERS.teamer2.id);

      expect(res.status).toBe(201);
      expect(await teilnehmer(CHAT_ROOMS.group.id)).toContainEqual(
        { user_id: USERS.teamer2.id, user_type: 'teamer' }
      );
    });

    it('user_type nach der Rolle in DIESER Gemeinde', async () => {
      const res = await hinzufuegen(CHAT_ROOMS.group.id, GAST_CHEF);

      expect(res.status).toBe(201);
      expect(await teilnehmer(CHAT_ROOMS.group.id)).toContainEqual(
        { user_id: GAST_CHEF, user_type: 'admin' }
      );
    });

    it('Stamm-Mitglied -> 201 wie bisher', async () => {
      const res = await hinzufuegen(CHAT_ROOMS.group.id, USERS.konfi1.id);

      expect(res.status).toBe(201);
      expect(await teilnehmer(CHAT_ROOMS.group.id)).toContainEqual(
        { user_id: USERS.konfi1.id, user_type: 'konfi' }
      );
    });

    it('fremde Gemeinde ohne Mitgliedschaft -> 404', async () => {
      const res = await hinzufuegen(CHAT_ROOMS.group.id, USERS.admin2.id);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Benutzer nicht in deiner Organisation gefunden');
      expect(await teilnehmer(CHAT_ROOMS.group.id)).not.toContainEqual(
        expect.objectContaining({ user_id: USERS.admin2.id })
      );
    });
  });
});
