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
});
