const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Organizations Routes', () => {
  let app;
  let db;
  let superAdminToken;
  let orgAdminToken;
  let orgAdmin2Token;
  let adminToken;
  let teamerToken;
  let konfiToken;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    superAdminToken = generateToken('superAdmin');
    orgAdminToken = generateToken('orgAdmin1');
    orgAdmin2Token = generateToken('orgAdmin2');
    adminToken = generateToken('admin1');
    teamerToken = generateToken('teamer1');
    konfiToken = generateToken('konfi1');
  });

  afterAll(async () => {
    await closePool();
  });

  // ================================================================
  // GET /api/organizations
  // ================================================================
  describe('GET /api/organizations', () => {
    it('SuperAdmin bekommt 200 + alle Organisationen', async () => {
      const res = await request(app)
        .get('/api/organizations')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2); // 2 Orgs im Seed
    });

    it('OrgAdmin bekommt 403 (nur super_admin erlaubt)', async () => {
      const res = await request(app)
        .get('/api/organizations')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(403);
    });

    it('Admin bekommt 403', async () => {
      const res = await request(app)
        .get('/api/organizations')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });

    it('OrgAdmin MIT is_super_admin-Flag bekommt 200 (Org-Verwaltung im eigenen Admin)', async () => {
      // Flag auf org_admin setzen + User-Cache invalidieren (rbac.js cached 30s)
      const { invalidateUserCache } = require('../../middleware/rbac');
      await db.query('UPDATE users SET is_super_admin = true WHERE id = 5');
      invalidateUserCache(5);

      const res = await request(app)
        .get('/api/organizations')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      // Cleanup: Flag zuruecksetzen + Cache invalidieren (Test-Isolation)
      await db.query('UPDATE users SET is_super_admin = false WHERE id = 5');
      invalidateUserCache(5);
    });

    it('Konfi bekommt 403', async () => {
      const res = await request(app)
        .get('/api/organizations')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });

    it('Ohne Token -> 401', async () => {
      const res = await request(app).get('/api/organizations');
      expect(res.status).toBe(401);
    });

    it('user_count zaehlt Multi-Org-Mitglieder mit (nicht nur Primaer-User)', async () => {
      // Org 2 hat 3 Primaer-Team-User (teamer2, admin2, orgAdmin2).
      const before = await request(app).get('/api/organizations')
        .set('Authorization', `Bearer ${superAdminToken}`);
      const org2Before = before.body.find(o => o.id === 2).user_count;

      // admin1 (Primaer Org 1) zusaetzlich Org 2 zuweisen -> user_count +1
      await db.query(`INSERT INTO user_organizations (user_id, organization_id, role_id)
        VALUES (4, 2, 8) ON CONFLICT DO NOTHING`);

      const after = await request(app).get('/api/organizations')
        .set('Authorization', `Bearer ${superAdminToken}`);
      const org2After = after.body.find(o => o.id === 2).user_count;
      expect(Number(org2After)).toBe(Number(org2Before) + 1);
    });

    it('user_count zaehlt Primaer+Mapping desselben Users nicht doppelt', async () => {
      const before = await request(app).get('/api/organizations')
        .set('Authorization', `Bearer ${superAdminToken}`);
      const org2Before = before.body.find(o => o.id === 2).user_count;

      // admin2 ist bereits Primaer in Org 2; zusaetzliches Mapping darf NICHT zaehlen
      await db.query(`INSERT INTO user_organizations (user_id, organization_id, role_id)
        VALUES (8, 2, 8) ON CONFLICT DO NOTHING`);

      const after = await request(app).get('/api/organizations')
        .set('Authorization', `Bearer ${superAdminToken}`);
      const org2After = after.body.find(o => o.id === 2).user_count;
      expect(Number(org2After)).toBe(Number(org2Before));
    });
  });

  // ================================================================
  // GET /api/organizations/:id
  // ================================================================
  describe('GET /api/organizations/:id', () => {
    it('SuperAdmin sieht jede Org -> 200', async () => {
      const res = await request(app)
        .get(`/api/organizations/${ORGS.testGemeinde.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(ORGS.testGemeinde.id);
      expect(res.body.name).toBe(ORGS.testGemeinde.name);
    });

    it('OrgAdmin sieht eigene Org -> 200', async () => {
      const res = await request(app)
        .get(`/api/organizations/${ORGS.testGemeinde.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(ORGS.testGemeinde.id);
    });

    it('OrgAdmin sieht fremde Org -> 403', async () => {
      const res = await request(app)
        .get(`/api/organizations/${ORGS.andereGemeinde.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(403);
    });

    it('Nicht-existierende Org -> 404', async () => {
      const res = await request(app)
        .get('/api/organizations/9999')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // GET /api/organizations/current
  // /current steht jetzt VOR /:id, wird korrekt aufgeloest.
  // ================================================================
  describe('GET /api/organizations/current', () => {
    it('OrgAdmin bekommt eigene Org ueber /current -> 200', async () => {
      const res = await request(app)
        .get('/api/organizations/current')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBeDefined();
    });

    it('SuperAdmin bekommt eigene Org ueber /current -> 200', async () => {
      const res = await request(app)
        .get('/api/organizations/current')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
    });
  });

  // ================================================================
  // POST /api/organizations
  // ================================================================
  describe('POST /api/organizations', () => {
    it('SuperAdmin erstellt neue Org mit Admin-User -> 201', async () => {
      const res = await request(app)
        .post('/api/organizations')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Neue Gemeinde',
          slug: 'neue-gemeinde',
          display_name: 'Neue Gemeinde Hamburg',
          admin_username: 'neue_admin',
          admin_password: 'Sicher!Passwort1',
          admin_display_name: 'Admin Neue Gemeinde'
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.admin_user_id).toBeDefined();
      expect(res.body.default_badges_created).toBeGreaterThan(0);
      expect(res.body.default_levels_created).toBeGreaterThan(0);

      // Alle 4 System-Rollen muessen existieren — insbesondere 'konfi',
      // sonst kann die neue Org keine Konfis anlegen (Bug bis 06/2026).
      const { rows: roles } = await db.query(
        'SELECT name FROM roles WHERE organization_id = $1 ORDER BY name',
        [res.body.id]
      );
      expect(roles.map(r => r.name)).toEqual(['admin', 'konfi', 'org_admin', 'teamer']);

      // Default-Levels angelegt
      const { rows: levels } = await db.query(
        'SELECT COUNT(*)::int AS c FROM levels WHERE organization_id = $1',
        [res.body.id]
      );
      expect(levels[0].c).toBe(6);
    });

    it('Neue Org kann sofort Konfis anlegen (konfi-Rolle vorhanden)', async () => {
      // Org anlegen
      const orgRes = await request(app)
        .post('/api/organizations')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Konfi-Test-Gemeinde',
          slug: 'konfi-test-gemeinde',
          display_name: 'Konfi-Test-Gemeinde',
          admin_username: 'kt_admin',
          admin_password: 'Sicher!Passwort1',
          admin_display_name: 'KT Admin'
        });
      expect(orgRes.status).toBe(201);

      // Als neuer Org-Admin einloggen
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'kt_admin', password: 'Sicher!Passwort1' });
      expect(loginRes.status).toBe(200);
      const newAdminToken = loginRes.body.token;

      // Jahrgang anlegen
      const jgRes = await request(app)
        .post('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${newAdminToken}`)
        .send({ name: '2027/28' });
      expect(jgRes.status).toBe(201);

      // Konfi anlegen — scheiterte vor dem Fix mit 500 "Konfi-Rolle nicht gefunden"
      const konfiRes = await request(app)
        .post('/api/admin/konfis')
        .set('Authorization', `Bearer ${newAdminToken}`)
        .send({ name: 'Erster Konfi', jahrgang_id: jgRes.body.id });
      expect(konfiRes.status).toBe(201);
    });

    it('OrgAdmin bekommt 403', async () => {
      const res = await request(app)
        .post('/api/organizations')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({
          name: 'Verboten',
          slug: 'verboten',
          display_name: 'Verbotene Gemeinde',
          admin_username: 'admin_verboten',
          admin_password: 'Sicher!123',
          admin_display_name: 'Admin'
        });

      expect(res.status).toBe(403);
    });

    it('Fehlender name/slug -> 400 Validierungsfehler', async () => {
      const res = await request(app)
        .post('/api/organizations')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          admin_username: 'admin_test',
          admin_password: 'Sicher!123',
          admin_display_name: 'Admin'
        });

      expect(res.status).toBe(400);
    });

    it('Duplikat-Slug -> 409', async () => {
      const res = await request(app)
        .post('/api/organizations')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Duplikat',
          slug: ORGS.testGemeinde.slug, // existiert bereits
          display_name: 'Duplikat Gemeinde',
          admin_username: 'dup_admin',
          admin_password: 'Sicher!123',
          admin_display_name: 'Dup Admin'
        });

      expect(res.status).toBe(409);
    });
  });

  // ================================================================
  // PUT /api/organizations/:id
  // ================================================================
  describe('PUT /api/organizations/:id', () => {
    it('SuperAdmin aktualisiert Org -> 200', async () => {
      const res = await request(app)
        .put(`/api/organizations/${ORGS.testGemeinde.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Aktualisiert',
          slug: 'aktualisiert',
          display_name: 'Aktualisierte Gemeinde'
        });

      expect(res.status).toBe(200);
    });

    it('OrgAdmin aktualisiert eigene Org -> 200', async () => {
      const res = await request(app)
        .put(`/api/organizations/${ORGS.testGemeinde.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({
          name: 'Aktualisiert von OA',
          slug: 'aktualisiert-oa',
          display_name: 'Aktualisiert OA'
        });

      expect(res.status).toBe(200);
    });

    it('OrgAdmin kann fremde Org nicht aktualisieren -> 403', async () => {
      const res = await request(app)
        .put(`/api/organizations/${ORGS.andereGemeinde.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({
          name: 'Manipuliert',
          slug: 'manipuliert',
          display_name: 'Manipuliert'
        });

      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // DELETE /api/organizations/:id
  // ================================================================
  describe('DELETE /api/organizations/:id', () => {
    it('SuperAdmin loescht Org -> 200', async () => {
      const res = await request(app)
        .delete(`/api/organizations/${ORGS.andereGemeinde.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);

      // Verifizieren: Org nicht mehr vorhanden
      const checkRes = await request(app)
        .get(`/api/organizations/${ORGS.andereGemeinde.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(checkRes.status).toBe(404);
    });

    it('OrgAdmin bekommt 403', async () => {
      const res = await request(app)
        .delete(`/api/organizations/${ORGS.testGemeinde.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(403);
    });

    it('Nicht-existierende Org -> 404', async () => {
      const res = await request(app)
        .delete('/api/organizations/9999')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(404);
    });

    it('loescht ALLE Org-Daten restlos (keine Waisen in abhaengigen Tabellen)', async () => {
      // Org 2 hat im Seed User, Chat, Events, Badges etc.
      const res = await request(app)
        .delete(`/api/organizations/2`)
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(200);

      // Stichprobe ueber org-isolierte + user-abhaengige Tabellen: 0 Reste
      const checks = [
        ['users', 'SELECT count(*)::int c FROM users WHERE organization_id=2'],
        ['roles', 'SELECT count(*)::int c FROM roles WHERE organization_id=2'],
        ['jahrgaenge', 'SELECT count(*)::int c FROM jahrgaenge WHERE organization_id=2'],
        ['events', 'SELECT count(*)::int c FROM events WHERE organization_id=2'],
        ['activities', 'SELECT count(*)::int c FROM activities WHERE organization_id=2'],
        ['categories', 'SELECT count(*)::int c FROM categories WHERE organization_id=2'],
        ['custom_badges', 'SELECT count(*)::int c FROM custom_badges WHERE organization_id=2'],
        ['levels', 'SELECT count(*)::int c FROM levels WHERE organization_id=2'],
        ['chat_rooms', 'SELECT count(*)::int c FROM chat_rooms WHERE organization_id=2'],
        ['user_organizations', 'SELECT count(*)::int c FROM user_organizations WHERE organization_id=2'],
        // Chat-Nachrichten der Org-2-Rooms (room_id-Join)
        ['chat_messages', 'SELECT count(*)::int c FROM chat_messages WHERE room_id IN (SELECT id FROM chat_rooms WHERE organization_id=2)']
      ];
      for (const [label, sql] of checks) {
        const { rows: [row] } = await db.query(sql);
        expect(`${label}=${row.c}`).toBe(`${label}=0`);
      }
    });

    it('Multi-Org: Gast-User aus anderer Org bleibt erhalten, nur Mitgliedschaft weg', async () => {
      // admin1 (Org 1) als Gast in Org 2 aufnehmen
      const { invalidateUserCache } = require('../../middleware/rbac');
      await db.query(`INSERT INTO user_organizations (user_id, organization_id, role_id)
        VALUES (4, 2, 7) ON CONFLICT DO NOTHING`);
      invalidateUserCache(4);

      const res = await request(app)
        .delete(`/api/organizations/2`)
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(200);

      // admin1 existiert noch (gehoert Org 1)
      const { rows: [user] } = await db.query('SELECT id FROM users WHERE id=4');
      expect(user).toBeDefined();
      // Aber seine Gast-Mitgliedschaft in Org 2 ist weg
      const { rows: membership } = await db.query(
        'SELECT 1 FROM user_organizations WHERE user_id=4 AND organization_id=2'
      );
      expect(membership.length).toBe(0);
    });
  });

  // ================================================================
  // GET /api/organizations/:id/users
  // ================================================================
  describe('GET /api/organizations/:id/users', () => {
    it('SuperAdmin sieht User-Liste -> 200', async () => {
      const res = await request(app)
        .get(`/api/organizations/${ORGS.testGemeinde.id}/users`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('OrgAdmin sieht User-Liste eigener Org -> 200', async () => {
      const res = await request(app)
        .get(`/api/organizations/${ORGS.testGemeinde.id}/users`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Admin bekommt 403 (nur org_admin/super_admin)', async () => {
      const res = await request(app)
        .get(`/api/organizations/${ORGS.testGemeinde.id}/users`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // GET /api/organizations/:id/admins
  // ================================================================
  describe('GET /api/organizations/:id/admins', () => {
    it('SuperAdmin sieht Admin-Liste -> 200', async () => {
      const res = await request(app)
        .get(`/api/organizations/${ORGS.testGemeinde.id}/admins`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('OrgAdmin sieht Admin-Liste eigener Org -> 200', async () => {
      const res = await request(app)
        .get(`/api/organizations/${ORGS.testGemeinde.id}/admins`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
    });

    it('OrgAdmin fremde Org -> 403', async () => {
      const res = await request(app)
        .get(`/api/organizations/${ORGS.andereGemeinde.id}/admins`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // POST /api/organizations/:id/admins
  // ================================================================
  describe('POST /api/organizations/:id/admins', () => {
    it('SuperAdmin erstellt Admin fuer Org -> 201', async () => {
      const res = await request(app)
        .post(`/api/organizations/${ORGS.testGemeinde.id}/admins`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          username: 'neuer_admin',
          display_name: 'Neuer Admin',
          password: 'Sicher!123'
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.username).toBe('neuer_admin');
    });

    it('Duplikat-Username -> 409', async () => {
      const res = await request(app)
        .post(`/api/organizations/${ORGS.testGemeinde.id}/admins`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          username: USERS.admin1.username, // existiert bereits
          display_name: 'Duplikat',
          password: 'Sicher!123'
        });

      expect(res.status).toBe(409);
    });

    it('Admin bekommt 403', async () => {
      const res = await request(app)
        .post(`/api/organizations/${ORGS.testGemeinde.id}/admins`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'verboten_admin',
          display_name: 'Verboten',
          password: 'Sicher!123'
        });

      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // GET /api/organizations/:id/stats
  // ================================================================
  describe('GET /api/organizations/:id/stats', () => {
    it('SuperAdmin bekommt Org-Statistiken -> 200', async () => {
      const res = await request(app)
        .get(`/api/organizations/${ORGS.testGemeinde.id}/stats`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(typeof res.body.konfis).toBe('number');
      expect(typeof res.body.activities).toBe('number');
      expect(typeof res.body.events).toBe('number');
      expect(typeof res.body.badges).toBe('number');
    });

    it('OrgAdmin bekommt eigene Org-Stats -> 200', async () => {
      const res = await request(app)
        .get(`/api/organizations/${ORGS.testGemeinde.id}/stats`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.konfis).toBeGreaterThan(0); // Seed hat Konfis
    });

    it('OrgAdmin fremde Org -> 403', async () => {
      const res = await request(app)
        .get(`/api/organizations/${ORGS.andereGemeinde.id}/stats`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // PATCH /api/organizations/:id/limit (super_admin-only Konfi-Limit)
  // ================================================================
  describe('PATCH /api/organizations/:id/limit', () => {
    async function readLimit(orgId) {
      const { rows } = await db.query('SELECT max_konfis FROM organizations WHERE id = $1', [orgId]);
      return rows[0].max_konfis;
    }

    it('SuperAdmin setzt max_konfis -> 200 und DB-Wert stimmt', async () => {
      const res = await request(app)
        .patch(`/api/organizations/${ORGS.testGemeinde.id}/limit`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ max_konfis: 50 });

      expect(res.status).toBe(200);
      expect(await readLimit(ORGS.testGemeinde.id)).toBe(50);
    });

    it('OrgAdmin auf eigene Org -> 403 (requireSuperAdmin)', async () => {
      const res = await request(app)
        .patch(`/api/organizations/${ORGS.testGemeinde.id}/limit`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ max_konfis: 999 });

      expect(res.status).toBe(403);
      // Limit darf nicht veraendert worden sein.
      expect(await readLimit(ORGS.testGemeinde.id)).toBeNull();
    });

    it('max_konfis = null -> Spalte wird NULL (unbegrenzt)', async () => {
      // Erst auf 10 setzen, dann auf null zuruecksetzen.
      await db.query('UPDATE organizations SET max_konfis = 10 WHERE id = $1', [ORGS.testGemeinde.id]);
      const res = await request(app)
        .patch(`/api/organizations/${ORGS.testGemeinde.id}/limit`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ max_konfis: null });

      expect(res.status).toBe(200);
      expect(await readLimit(ORGS.testGemeinde.id)).toBeNull();
    });

    it('Negativer Wert -> 400 (Validierung)', async () => {
      const res = await request(app)
        .patch(`/api/organizations/${ORGS.testGemeinde.id}/limit`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ max_konfis: -1 });

      expect(res.status).toBe(400);
    });

    it('Nicht-ganzzahliger Wert -> 400 (Validierung)', async () => {
      const res = await request(app)
        .patch(`/api/organizations/${ORGS.testGemeinde.id}/limit`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ max_konfis: 'viele' });

      expect(res.status).toBe(400);
    });

    it('Nicht-existierende Org -> 404', async () => {
      const res = await request(app)
        .patch('/api/organizations/9999/limit')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ max_konfis: 50 });

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // PUT /api/organizations/:id ignoriert max_konfis (D-03)
  // ================================================================
  describe('PUT /api/organizations/:id ignoriert max_konfis', () => {
    it('OrgAdmin kann max_konfis NICHT ueber PUT hochsetzen', async () => {
      const res = await request(app)
        .put(`/api/organizations/${ORGS.testGemeinde.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({
          name: 'Test-Gemeinde',
          slug: 'test-gemeinde',
          display_name: 'Test-Gemeinde',
          max_konfis: 9999
        });

      expect(res.status).toBe(200);
      // Spalte bleibt NULL — PUT verwirft das Feld.
      const { rows } = await db.query('SELECT max_konfis FROM organizations WHERE id = $1', [ORGS.testGemeinde.id]);
      expect(rows[0].max_konfis).toBeNull();
    });

    it('SuperAdmin-PUT laesst zuvor gesetztes max_konfis unveraendert', async () => {
      await db.query('UPDATE organizations SET max_konfis = 15 WHERE id = $1', [ORGS.testGemeinde.id]);
      const res = await request(app)
        .put(`/api/organizations/${ORGS.testGemeinde.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Test-Gemeinde',
          slug: 'test-gemeinde',
          display_name: 'Test-Gemeinde',
          max_konfis: 9999
        });

      expect(res.status).toBe(200);
      const { rows } = await db.query('SELECT max_konfis FROM organizations WHERE id = $1', [ORGS.testGemeinde.id]);
      expect(rows[0].max_konfis).toBe(15); // unveraendert, PUT fasst die Spalte nicht an
    });
  });

  // ================================================================
  // GET /api/organizations/:id liefert max_konfis (fuer Plan 03)
  // ================================================================
  describe('GET /api/organizations/:id enthaelt max_konfis', () => {
    it('Response enthaelt das Feld max_konfis', async () => {
      await db.query('UPDATE organizations SET max_konfis = 30 WHERE id = $1', [ORGS.testGemeinde.id]);
      const res = await request(app)
        .get(`/api/organizations/${ORGS.testGemeinde.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('max_konfis', 30);
      // konfi_count fuer die "X von Y"-Anzeige ist ebenfalls vorhanden.
      expect(res.body).toHaveProperty('konfi_count');
    });

    it('Bei NULL-Limit ist max_konfis im Response null', async () => {
      const res = await request(app)
        .get(`/api/organizations/${ORGS.testGemeinde.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('max_konfis', null);
    });
  });

  // ================================================================
  // MULTI-ORG: Mitgliedschaften + Switcher
  // ================================================================
  describe('Multi-Org Mitgliedschaften', () => {
    // admin1 (id 4, Primaer-Org 1) wird Org 2 zugewiesen. teamer-Rolle in Org 2 = role_id 7.
    describe('POST /api/organizations/:id/members', () => {
      it('SuperAdmin weist bestehenden Admin einer zweiten Org zu -> 201', async () => {
        const res = await request(app)
          .post(`/api/organizations/2/members`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ user_id: 4, role_name: 'teamer' });

        expect(res.status).toBe(201);

        const { rows } = await db.query(
          'SELECT role_id FROM user_organizations WHERE user_id = 4 AND organization_id = 2'
        );
        expect(rows.length).toBe(1);
        expect(rows[0].role_id).toBe(7); // teamer-Rolle der Org 2
      });

      it('Upsert: erneutes Zuweisen aktualisiert die Rolle', async () => {
        await request(app).post(`/api/organizations/2/members`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ user_id: 4, role_name: 'teamer' });
        const res = await request(app).post(`/api/organizations/2/members`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ user_id: 4, role_name: 'admin' });

        expect(res.status).toBe(201);
        const { rows } = await db.query(
          'SELECT role_id FROM user_organizations WHERE user_id = 4 AND organization_id = 2'
        );
        expect(rows.length).toBe(1);
        expect(rows[0].role_id).toBe(8); // admin-Rolle der Org 2
      });

      it('Konfi kann NICHT zugewiesen werden -> 400', async () => {
        const res = await request(app)
          .post(`/api/organizations/2/members`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ user_id: 1, role_name: 'teamer' }); // user 1 = konfi
        expect(res.status).toBe(400);
      });

      it('Rolle konfi als role_name -> 400', async () => {
        const res = await request(app)
          .post(`/api/organizations/2/members`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ user_id: 4, role_name: 'konfi' });
        expect(res.status).toBe(400);
      });

      it('OrgAdmin (kein super_admin) bekommt 403', async () => {
        const res = await request(app)
          .post(`/api/organizations/2/members`)
          .set('Authorization', `Bearer ${orgAdminToken}`)
          .send({ user_id: 4, role_name: 'teamer' });
        expect(res.status).toBe(403);
      });
    });

    describe('GET /api/organizations/:id/members', () => {
      it('listet zugewiesene Mitglieder (inkl. Primaer-Mitglieder aus Migration)', async () => {
        await request(app).post(`/api/organizations/2/members`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ user_id: 4, role_name: 'teamer' });

        const res = await request(app)
          .get(`/api/organizations/2/members`)
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(200);
        const ids = res.body.map(m => m.id);
        expect(ids).toContain(4);
      });

      it('listet Primaer-Admins der Org auch OHNE user_organizations-Mapping', async () => {
        // Org 2 hat als Primaer-User teamer2(7), admin2(8), orgAdmin2(9) — keiner
        // hat einen user_organizations-Eintrag. Sie muessen trotzdem erscheinen.
        const res = await request(app)
          .get(`/api/organizations/2/members`)
          .set('Authorization', `Bearer ${superAdminToken}`);
        expect(res.status).toBe(200);
        const ids = res.body.map(m => m.id);
        expect(ids).toEqual(expect.arrayContaining([7, 8, 9]));
        // Konfi der Org (id 6) ist ausgenommen
        expect(ids).not.toContain(6);
        // Primaer-User sind als is_primary markiert
        const admin2 = res.body.find(m => m.id === 8);
        expect(admin2.is_primary).toBe(true);
      });

      it('dedupliziert: Primaer-User mit zusaetzlichem Mapping erscheint nur einmal', async () => {
        // admin2 (Primaer Org 2) zusaetzlich als Mapping in Org 2 -> nur 1 Eintrag
        await db.query(`INSERT INTO user_organizations (user_id, organization_id, role_id)
          VALUES (8, 2, 8) ON CONFLICT DO NOTHING`);
        const res = await request(app)
          .get(`/api/organizations/2/members`)
          .set('Authorization', `Bearer ${superAdminToken}`);
        expect(res.status).toBe(200);
        const occurrences = res.body.filter(m => m.id === 8).length;
        expect(occurrences).toBe(1);
        expect(res.body.find(m => m.id === 8).is_primary).toBe(true);
      });
    });

    describe('DELETE /api/organizations/:id/members/:userId', () => {
      it('entfernt eine zusaetzliche Mitgliedschaft -> 200', async () => {
        await request(app).post(`/api/organizations/2/members`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ user_id: 4, role_name: 'teamer' });

        const res = await request(app)
          .delete(`/api/organizations/2/members/4`)
          .set('Authorization', `Bearer ${superAdminToken}`);
        expect(res.status).toBe(200);

        const { rows } = await db.query(
          'SELECT 1 FROM user_organizations WHERE user_id = 4 AND organization_id = 2'
        );
        expect(rows.length).toBe(0);
      });

      it('Primaer-Org kann NICHT entfernt werden -> 400', async () => {
        // admin1 Primaer-Org = 1, durch Migration in user_organizations vorhanden
        await db.query(`INSERT INTO user_organizations (user_id, organization_id, role_id)
          VALUES (4, 1, 3) ON CONFLICT DO NOTHING`);
        const res = await request(app)
          .delete(`/api/organizations/1/members/4`)
          .set('Authorization', `Bearer ${superAdminToken}`);
        expect(res.status).toBe(400);
      });
    });

    describe('GET /api/organizations/search-users', () => {
      it('findet bestehende Admins, keine Konfis', async () => {
        const res = await request(app)
          .get(`/api/organizations/search-users?q=admin`)
          .set('Authorization', `Bearer ${superAdminToken}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        // Kein Eintrag mit Konfi-Rolle
        expect(res.body.every(u => u.primary_role_name !== 'konfi')).toBe(true);
      });

      it('zu kurze Query -> leeres Array', async () => {
        const res = await request(app)
          .get(`/api/organizations/search-users?q=a`)
          .set('Authorization', `Bearer ${superAdminToken}`);
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
      });
    });
  });
});
