// backend/tests/routes/gemeindeFelderDetailUndChat.test.js
//
// Funktionsbezeichnung, "Teamer:in seit" und Sperre JE GEMEINDE (Simon,
// 08.10.2026; docs/planung/mehrfach-konten.md, Punkt 6) in der
// Detailansicht der Leitung und im Chat:
//
//   - GET /admin/konfis/:id: role_title, teamer_since, is_active der
//     aktiven Gemeinde (Stamm: am Konto, sonst user_organizations)
//   - GET /chat/rooms/:roomId/messages: sender_role_title der Gemeinde des
//     Raums
//   - GET /chat/team-contacts: wer in DIESER Gemeinde gesperrt ist, fehlt;
//     die Bezeichnung ist die dieser Gemeinde
//
// Antwortformen unveraendert: dieselben Felder, dieselben Typen.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ROLES, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const chatSyncCache = require('../../utils/chatSyncCache');
const { invalidateUserCache } = require('../../middleware/rbac');

describe('Gemeindefelder in Detailansicht und Chat', () => {
  let app;
  let db;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    chatSyncCache.clear();
    invalidateUserCache();
    // teamer1: Stamm Org 1 ("Pastorin", seit 2020), in Org 2 Teamer:in
    // ("Jugendmitarbeiterin", seit 2024).
    await db.query(
      "UPDATE users SET role_title = 'Pastorin', teamer_since = '2020-01-01' WHERE id = $1",
      [USERS.teamer1.id]
    );
    await db.query(
      `INSERT INTO user_organizations (user_id, organization_id, role_id, role_title, teamer_since)
       VALUES ($1, $2, $3, 'Jugendmitarbeiterin', '2024-01-01')`,
      [USERS.teamer1.id, ORGS.andereGemeinde.id, ROLES.teamer2.id]
    );
  });

  const datum = (wert) => (wert === null ? null : new Date(wert).toISOString().slice(0, 10));

  describe('GET /api/admin/konfis/:id', () => {
    it('weitere Gemeinde: Bezeichnung, seit und Sperre von dort', async () => {
      await db.query(
        'UPDATE user_organizations SET is_active = false WHERE user_id = $1 AND organization_id = $2',
        [USERS.teamer1.id, ORGS.andereGemeinde.id]
      );
      const res = await request(app)
        .get(`/api/admin/konfis/${USERS.teamer1.id}`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin2')}`);
      expect(res.status).toBe(200);
      expect(res.body.role_title).toBe('Jugendmitarbeiterin');
      expect(datum(res.body.teamer_since)).toBe(datum('2024-01-01T00:00:00'));
      expect(res.body.is_active).toBe(false);
    });

    it('Stamm-Gemeinde: die Werte am Konto, die Sperre in B gilt dort nicht', async () => {
      await db.query(
        'UPDATE user_organizations SET is_active = false WHERE user_id = $1 AND organization_id = $2',
        [USERS.teamer1.id, ORGS.andereGemeinde.id]
      );
      const res = await request(app)
        .get(`/api/admin/konfis/${USERS.teamer1.id}`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
      expect(res.status).toBe(200);
      expect(res.body.role_title).toBe('Pastorin');
      expect(datum(res.body.teamer_since)).toBe(datum('2020-01-01T00:00:00'));
      expect(res.body.is_active).toBe(true);
    });
  });

  describe('GET /api/chat/rooms/:roomId/messages', () => {
    it('sender_role_title ist die Bezeichnung in der Gemeinde des Raums', async () => {
      const raeume = {};
      for (const [org, admin] of [[ORGS.andereGemeinde.id, USERS.admin2.id], [ORGS.testGemeinde.id, USERS.admin1.id]]) {
        const { rows: [raum] } = await db.query(
          "INSERT INTO chat_rooms (name, type, created_by, organization_id) VALUES ('Team', 'group', $1, $2) RETURNING id",
          [admin, org]
        );
        raeume[org] = raum.id;
        for (const userId of [admin, USERS.teamer1.id]) {
          await db.query("INSERT INTO chat_participants (room_id, user_id, user_type) VALUES ($1, $2, 'admin')", [raum.id, userId]);
        }
        await db.query(
          "INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content) VALUES ($1, $2, 'teamer', 'text', 'Hallo')",
          [raum.id, USERS.teamer1.id]
        );
      }
      const titel = async (token, roomId) => {
        const res = await request(app)
          .get(`/api/chat/rooms/${roomId}/messages`)
          .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        return res.body.filter((m) => Number(m.sender_id) === USERS.teamer1.id).map((m) => m.sender_role_title);
      };
      expect(await titel(generateToken('admin2'), raeume[ORGS.andereGemeinde.id])).toEqual(['Jugendmitarbeiterin']);
      expect(await titel(generateToken('admin1'), raeume[ORGS.testGemeinde.id])).toEqual(['Pastorin']);
    });
  });

  describe('GET /api/chat/team-contacts', () => {
    const kontakte = async () => {
      const res = await request(app)
        .get('/api/chat/team-contacts')
        .set('Authorization', `Bearer ${generateToken('admin2')}`);
      expect(res.status).toBe(200);
      return res.body;
    };

    it('erlaubt: in B aktiv -> steht drin, mit der Bezeichnung in B', async () => {
      const gast = (await kontakte()).filter((k) => Number(k.id) === USERS.teamer1.id);
      expect(gast).toEqual([{
        id: USERS.teamer1.id, display_name: USERS.teamer1.display_name,
        role_name: 'teamer', role_description: 'Jugendmitarbeiterin',
      }]);
    });

    it('verboten: in B gesperrt -> fehlt in B', async () => {
      await db.query(
        'UPDATE user_organizations SET is_active = false WHERE user_id = $1 AND organization_id = $2',
        [USERS.teamer1.id, ORGS.andereGemeinde.id]
      );
      const ids = (await kontakte()).map((k) => Number(k.id));
      expect(ids).not.toContain(USERS.teamer1.id);
      expect(ids).toContain(USERS.teamer2.id);
    });
  });
});
