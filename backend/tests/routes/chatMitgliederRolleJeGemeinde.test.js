// backend/tests/routes/chatMitgliederRolleJeGemeinde.test.js
//
// GET /api/chat/rooms/:roomId/participants -- die Rolle der Mitglieder in
// DIESER Gemeinde (02.10.2026, Paket 2.4.0, Punkt 6 "Rollenfarben").
//
// Simon, 02.10.2026: In der Chat-Mitgliederliste ist die Eck-Marke "auch noch
// falsch", beim Hinzufuegen dagegen "die richtige Farbe". Nachgestellt: Die
// Mitgliederliste las die Rolle ueber `users.role_id` -- also die Rolle in der
// STAMM-Gemeinde. Wer eine Gemeinde ueber user_organizations betreut (in
// Produktion: Organisation 2 hat ihre ganze Leitung nur dort), stand in deren
// Chats mit der Rolle seiner Heimat da: zuhause Teamer:in, hier
// Gemeindeleitung -> Beere statt Indigo. Die Liste zum Hinzufuegen
// (GET /users) zieht die Rolle seit dem 26.09.2026 je Gemeinde, deshalb stimmte
// die Farbe dort.
//
// Dieselbe Regel wie utils/orgMitglieder.js (ladeRolleInGemeinde) und
// TEAM_MITGLIED_ROLLE in routes/chat.js: In der Stamm-Gemeinde gilt
// users.role_id -- auch wenn user_organizations sie noch einmal fuehrt --, in
// jeder weiteren user_organizations.role_id. Wer nicht (mehr) Mitglied der
// Gemeinde ist, behaelt den bisherigen Wert (Rolle am Konto).
//
// Die Antwortform bleibt: dieselben Felder, derselbe Typ. role_name und
// role_display_name tragen jetzt die Rolle der Gemeinde, in der der Chat liegt.

const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ROLES, ORGS, CHAT_ROOMS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const chatSyncCache = require('../../utils/chatSyncCache');
const { invalidateUserCache } = require('../../middleware/rbac');

// Oberhalb des Seed-Bereichs: Stamm-Gemeinde Org 2 als Teamer:in, in Org 1
// als Gemeindeleitung eingeladen (Simons Konstellation in Organisation 2,
// spiegelbildlich).
const GAST = 251;

describe('GET /api/chat/rooms/:roomId/participants: Rolle je Gemeinde', () => {
  let app;
  let db;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    chatSyncCache.clear();
    invalidateUserCache();
  });

  const mitglieder = async (tokenName, roomId, aktiveOrg = null) => {
    const req = request(app)
      .get(`/api/chat/rooms/${roomId}/participants`)
      .set('Authorization', `Bearer ${generateToken(tokenName)}`);
    const res = await (aktiveOrg ? req.set('X-Active-Organization', String(aktiveOrg)) : req);
    expect(res.status).toBe(200);
    return res.body;
  };
  const rolleVon = (liste, userId) => {
    const eintrag = liste.find((p) => Number(p.user_id) === Number(userId));
    expect(eintrag, `Mitglied ${userId}`).toBeTruthy();
    return [eintrag.role_name, eintrag.role_display_name];
  };

  it('Stamm-Gemeinde: Gemeindeleitung, Leitung und Teamer:in je mit ihrer Rolle', async () => {
    // Raum 3 ist die Team-Gruppe in Org 1 (teamer1 + admin1); die
    // Gemeindeleitung kommt dazu.
    await db.query(
      "INSERT INTO chat_participants (room_id, user_id, user_type) VALUES ($1, $2, 'admin')",
      [CHAT_ROOMS.group.id, USERS.orgAdmin1.id]
    );

    const liste = await mitglieder('admin1', CHAT_ROOMS.group.id);
    expect(liste.map((p) => Number(p.user_id)).sort((a, b) => a - b))
      .toEqual([USERS.teamer1.id, USERS.admin1.id, USERS.orgAdmin1.id]);
    expect(rolleVon(liste, USERS.orgAdmin1.id)[0]).toBe('org_admin');
    expect(rolleVon(liste, USERS.admin1.id)[0]).toBe('admin');
    expect(rolleVon(liste, USERS.teamer1.id)[0]).toBe('teamer');
  });

  it('weitere Gemeinde: zuhause Teamer:in, hier Gemeindeleitung -> org_admin', async () => {
    await db.query(
      `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
       VALUES ($1, 'gast-leitung', 'x', 'Gast Leitung', $2, $3, true)`,
      [GAST, ROLES.teamer2.id, ORGS.andereGemeinde.id]
    );
    await db.query(
      'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
      [GAST, ORGS.testGemeinde.id, ROLES.orgAdmin.id]
    );
    await db.query(
      "INSERT INTO chat_participants (room_id, user_id, user_type) VALUES ($1, $2, 'admin')",
      [CHAT_ROOMS.group.id, GAST]
    );

    const liste = await mitglieder('admin1', CHAT_ROOMS.group.id);
    expect(rolleVon(liste, GAST)).toEqual(['org_admin', ROLES.orgAdmin.display_name]);
    // Die anderen bleiben, wie sie sind.
    expect(rolleVon(liste, USERS.admin1.id)[0]).toBe('admin');
    expect(rolleVon(liste, USERS.teamer1.id)[0]).toBe('teamer');
  });

  it('umgekehrt: zuhause Gemeindeleitung, in der Zweit-Gemeinde Teamer:in -> teamer', async () => {
    await db.query(
      'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
      [USERS.orgAdmin1.id, ORGS.andereGemeinde.id, ROLES.teamer2.id]
    );
    const { rows: [raum] } = await db.query(
      `INSERT INTO chat_rooms (name, type, created_by, organization_id)
       VALUES ('Team Org 2', 'group', $1, $2) RETURNING id`,
      [USERS.admin2.id, ORGS.andereGemeinde.id]
    );
    for (const [userId, typ] of [
      [USERS.admin2.id, 'admin'], [USERS.orgAdmin2.id, 'admin'], [USERS.orgAdmin1.id, 'teamer'],
    ]) {
      await db.query(
        'INSERT INTO chat_participants (room_id, user_id, user_type) VALUES ($1, $2, $3)',
        [raum.id, userId, typ]
      );
    }

    const liste = await mitglieder('admin2', raum.id);
    expect(rolleVon(liste, USERS.orgAdmin1.id)).toEqual(['teamer', ROLES.teamer2.display_name]);
    expect(rolleVon(liste, USERS.orgAdmin2.id)[0]).toBe('org_admin');
    expect(rolleVon(liste, USERS.admin2.id)[0]).toBe('admin');
  });

  it('in der Stamm-Gemeinde gilt die Rolle am Konto, auch wenn user_organizations sie noch einmal fuehrt', async () => {
    // Altbestand aus Migration 101: Stamm-Gemeinde doppelt, mit anderer Rolle.
    await db.query(
      'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
      [USERS.admin1.id, ORGS.testGemeinde.id, ROLES.teamer.id]
    );
    const liste = await mitglieder('teamer1', CHAT_ROOMS.group.id);
    expect(rolleVon(liste, USERS.admin1.id)[0]).toBe('admin');
  });

  it('kein Mitglied der Gemeinde mehr: der bisherige Wert bleibt (Rolle am Konto)', async () => {
    // teamer2 (Org 2) steht noch in einem Raum von Org 1, gehoert aber nicht
    // (mehr) dazu -- etwa nach dem Entfernen aus der Gemeinde.
    await db.query(
      "INSERT INTO chat_participants (room_id, user_id, user_type) VALUES ($1, $2, 'teamer')",
      [CHAT_ROOMS.group.id, USERS.teamer2.id]
    );
    const liste = await mitglieder('admin1', CHAT_ROOMS.group.id);
    expect(rolleVon(liste, USERS.teamer2.id)[0]).toBe('teamer');
    expect(liste).toHaveLength(3);
  });

  it('die Antwortform bleibt: dieselben Felder wie bisher', async () => {
    const liste = await mitglieder('admin1', CHAT_ROOMS.group.id);
    for (const eintrag of liste) {
      expect(Object.keys(eintrag).sort()).toEqual([
        'jahrgang_id', 'jahrgang_name', 'joined_at', 'name', 'role_display_name',
        'role_name', 'role_title', 'user_id', 'user_type',
      ]);
    }
  });
});
