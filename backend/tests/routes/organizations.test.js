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
  // GET /api/organizations/current (wird von /:id gefangen - Route-Reihenfolge)
  // In Produktion funktioniert /current nur fuer OrgAdmin (eigene Org) und SuperAdmin.
  // ================================================================
  describe('GET /api/organizations/current', () => {
    it('OrgAdmin bekommt eigene Org ueber /current -> greift /:id Route', async () => {
      // /current wird von /:id Route gefangen, parseInt("current") = NaN
      // OrgAdmin bekommt 403 weil isOwnOrg = false (NaN !== org_id)
      // Daher: /current ist in der Route-Definition nicht erreichbar
      const res = await request(app)
        .get('/api/organizations/current')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      // Route /:id faengt "current" -> parseInt("current") = NaN -> isOwnOrg = false
      // SuperAdmin-Check false -> 403
      expect(res.status).toBe(403);
    });

    it('SuperAdmin bekommt 500 weil "current" kein gueltiger Integer ist', async () => {
      const res = await request(app)
        .get('/api/organizations/current')
        .set('Authorization', `Bearer ${superAdminToken}`);

      // SuperAdmin passiert die Zugangspruefung, aber DB-Query mit id="current" schlaegt fehl
      expect(res.status).toBe(500);
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
});
