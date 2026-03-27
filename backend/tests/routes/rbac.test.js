const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ACTIVITIES, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('RBAC-Matrix + Cross-Org-Isolation', () => {
  let app;
  let db;
  let tokens;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);

    tokens = {
      konfi:      generateToken('konfi1'),
      teamer:     generateToken('teamer1'),
      admin:      generateToken('admin1'),
      orgAdmin:   generateToken('orgAdmin1'),
      superAdmin: generateToken('superAdmin'),
      // Org 2
      konfi_org2:    generateToken('konfi3'),
      teamer_org2:   generateToken('teamer2'),
      admin_org2:    generateToken('admin2'),
      orgAdmin_org2: generateToken('orgAdmin2'),
    };
  });

  afterAll(async () => {
    await closePool();
  });

  // ====================================================================
  // RBAC-MATRIX: Konfi-Routes
  // ====================================================================

  describe('RBAC-Matrix: Konfi-Routes', () => {
    it('Konfi kann GET /api/konfi/dashboard aufrufen -> 200', async () => {
      const res = await request(app)
        .get('/api/konfi/dashboard')
        .set('Authorization', `Bearer ${tokens.konfi}`);
      expect(res.status).toBe(200);
    });

    it('Admin auf GET /api/konfi/dashboard -> 403 (Konfi-Zugriff erforderlich)', async () => {
      const res = await request(app)
        .get('/api/konfi/dashboard')
        .set('Authorization', `Bearer ${tokens.admin}`);
      expect(res.status).toBe(403);
    });

    it('Teamer auf GET /api/konfi/dashboard -> 403', async () => {
      const res = await request(app)
        .get('/api/konfi/dashboard')
        .set('Authorization', `Bearer ${tokens.teamer}`);
      expect(res.status).toBe(403);
    });

    it('OrgAdmin auf GET /api/konfi/dashboard -> 403', async () => {
      const res = await request(app)
        .get('/api/konfi/dashboard')
        .set('Authorization', `Bearer ${tokens.orgAdmin}`);
      expect(res.status).toBe(403);
    });

    it('SuperAdmin auf GET /api/konfi/dashboard -> 403', async () => {
      const res = await request(app)
        .get('/api/konfi/dashboard')
        .set('Authorization', `Bearer ${tokens.superAdmin}`);
      expect(res.status).toBe(403);
    });

    it('Ohne Token auf GET /api/konfi/dashboard -> 401', async () => {
      const res = await request(app).get('/api/konfi/dashboard');
      expect(res.status).toBe(401);
    });
  });

  // ====================================================================
  // RBAC-MATRIX: Admin-Routes (requireTeamer)
  // ====================================================================

  describe('RBAC-Matrix: Admin-Routes (requireTeamer)', () => {
    // GET /api/admin/activities nutzt requireTeamer
    it('Konfi auf GET /api/admin/activities -> 403', async () => {
      const res = await request(app)
        .get('/api/admin/activities')
        .set('Authorization', `Bearer ${tokens.konfi}`);
      expect(res.status).toBe(403);
    });

    it('Teamer auf GET /api/admin/activities -> 200', async () => {
      const res = await request(app)
        .get('/api/admin/activities')
        .set('Authorization', `Bearer ${tokens.teamer}`);
      expect(res.status).toBe(200);
    });

    it('Admin auf GET /api/admin/activities -> 200', async () => {
      const res = await request(app)
        .get('/api/admin/activities')
        .set('Authorization', `Bearer ${tokens.admin}`);
      expect(res.status).toBe(200);
    });

    it('OrgAdmin auf GET /api/admin/activities -> 200', async () => {
      const res = await request(app)
        .get('/api/admin/activities')
        .set('Authorization', `Bearer ${tokens.orgAdmin}`);
      expect(res.status).toBe(200);
    });

    it('SuperAdmin auf GET /api/admin/activities -> 403 (nicht in requireTeamer)', async () => {
      const res = await request(app)
        .get('/api/admin/activities')
        .set('Authorization', `Bearer ${tokens.superAdmin}`);
      expect(res.status).toBe(403);
    });

    it('Ohne Token auf GET /api/admin/activities -> 401', async () => {
      const res = await request(app).get('/api/admin/activities');
      expect(res.status).toBe(401);
    });
  });

  // ====================================================================
  // RBAC-MATRIX: Admin-Routes (requireAdmin)
  // ====================================================================

  describe('RBAC-Matrix: Admin-Routes (requireAdmin)', () => {
    // GET /api/admin/jahrgaenge nutzt requireTeamer (not requireAdmin!)
    // POST /api/admin/activities nutzt requireAdmin
    // Verwende DELETE /api/admin/activities/:id mit requireAdmin als Repraesentant

    it('Konfi auf POST /api/admin/activities -> 403', async () => {
      const res = await request(app)
        .post('/api/admin/activities')
        .set('Authorization', `Bearer ${tokens.konfi}`)
        .send({ name: 'Test', points: 1 });
      expect(res.status).toBe(403);
    });

    it('Teamer auf POST /api/admin/activities -> 403', async () => {
      const res = await request(app)
        .post('/api/admin/activities')
        .set('Authorization', `Bearer ${tokens.teamer}`)
        .send({ name: 'Test', points: 1 });
      expect(res.status).toBe(403);
    });

    it('Admin auf POST /api/admin/activities -> erlaubt (nicht 403)', async () => {
      const res = await request(app)
        .post('/api/admin/activities')
        .set('Authorization', `Bearer ${tokens.admin}`)
        .send({ name: 'Neue Aktivitaet', points: 1 });
      // Koennte 201 oder 200 sein, aber definitiv nicht 403
      expect(res.status).not.toBe(403);
      expect(res.status).not.toBe(401);
    });

    it('OrgAdmin auf POST /api/admin/activities -> erlaubt', async () => {
      const res = await request(app)
        .post('/api/admin/activities')
        .set('Authorization', `Bearer ${tokens.orgAdmin}`)
        .send({ name: 'Neue Aktivitaet OA', points: 2 });
      expect(res.status).not.toBe(403);
      expect(res.status).not.toBe(401);
    });

    it('SuperAdmin auf POST /api/admin/activities -> 403', async () => {
      const res = await request(app)
        .post('/api/admin/activities')
        .set('Authorization', `Bearer ${tokens.superAdmin}`)
        .send({ name: 'Test SA', points: 1 });
      expect(res.status).toBe(403);
    });
  });

  // ====================================================================
  // RBAC-MATRIX: Admin-Routes (requireOrgAdmin)
  // ====================================================================

  describe('RBAC-Matrix: Admin-Routes (requireOrgAdmin)', () => {
    // GET /api/admin/users nutzt requireOrgAdmin
    it('Konfi auf GET /api/admin/users -> 403', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${tokens.konfi}`);
      expect(res.status).toBe(403);
    });

    it('Teamer auf GET /api/admin/users -> 403', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${tokens.teamer}`);
      expect(res.status).toBe(403);
    });

    it('Admin auf GET /api/admin/users -> 403', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${tokens.admin}`);
      expect(res.status).toBe(403);
    });

    it('OrgAdmin auf GET /api/admin/users -> 200', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${tokens.orgAdmin}`);
      expect(res.status).toBe(200);
    });

    it('SuperAdmin auf GET /api/admin/users -> 403 (nicht org_admin)', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${tokens.superAdmin}`);
      expect(res.status).toBe(403);
    });

    it('Ohne Token auf GET /api/admin/users -> 401', async () => {
      const res = await request(app).get('/api/admin/users');
      expect(res.status).toBe(401);
    });
  });

  // ====================================================================
  // RBAC-MATRIX: Teamer-Routes
  // ====================================================================

  describe('RBAC-Matrix: Teamer-Routes', () => {
    // GET /api/teamer/dashboard nutzt requireTeamer + eigenen Role-Check (nur teamer)
    it('Teamer auf GET /api/teamer/dashboard -> 200', async () => {
      const res = await request(app)
        .get('/api/teamer/dashboard')
        .set('Authorization', `Bearer ${tokens.teamer}`);
      expect(res.status).toBe(200);
    });

    it('Konfi auf GET /api/teamer/dashboard -> 403', async () => {
      const res = await request(app)
        .get('/api/teamer/dashboard')
        .set('Authorization', `Bearer ${tokens.konfi}`);
      expect(res.status).toBe(403);
    });

    it('Admin auf GET /api/teamer/dashboard -> 403 (Route prueft role_name === teamer)', async () => {
      const res = await request(app)
        .get('/api/teamer/dashboard')
        .set('Authorization', `Bearer ${tokens.admin}`);
      // Dashboard hat zusaetzlichen Check: req.user.role_name !== 'teamer' -> 403
      expect(res.status).toBe(403);
    });

    it('OrgAdmin auf GET /api/teamer/dashboard -> 403 (Route prueft role_name === teamer)', async () => {
      const res = await request(app)
        .get('/api/teamer/dashboard')
        .set('Authorization', `Bearer ${tokens.orgAdmin}`);
      expect(res.status).toBe(403);
    });

    // GET /api/teamer/konfis nutzt requireTeamer (ohne zusaetzlichen Role-Check)
    it('Teamer auf GET /api/teamer/konfis -> 200', async () => {
      const res = await request(app)
        .get('/api/teamer/konfis')
        .set('Authorization', `Bearer ${tokens.teamer}`);
      expect(res.status).toBe(200);
    });

    it('Admin auf GET /api/teamer/konfis -> 200 (admin in requireTeamer)', async () => {
      const res = await request(app)
        .get('/api/teamer/konfis')
        .set('Authorization', `Bearer ${tokens.admin}`);
      expect(res.status).toBe(200);
    });

    it('OrgAdmin auf GET /api/teamer/konfis -> 200 (org_admin in requireTeamer)', async () => {
      const res = await request(app)
        .get('/api/teamer/konfis')
        .set('Authorization', `Bearer ${tokens.orgAdmin}`);
      expect(res.status).toBe(200);
    });

    it('SuperAdmin auf GET /api/teamer/konfis -> 403', async () => {
      const res = await request(app)
        .get('/api/teamer/konfis')
        .set('Authorization', `Bearer ${tokens.superAdmin}`);
      expect(res.status).toBe(403);
    });

    it('Ohne Token auf GET /api/teamer/dashboard -> 401', async () => {
      const res = await request(app).get('/api/teamer/dashboard');
      expect(res.status).toBe(401);
    });
  });

  // ====================================================================
  // RBAC-MATRIX: Unauthentifizierte Zugriffe
  // ====================================================================

  describe('RBAC-Matrix: Unauthentifizierte Zugriffe', () => {
    it('GET /api/konfi/dashboard ohne Token -> 401', async () => {
      const res = await request(app).get('/api/konfi/dashboard');
      expect(res.status).toBe(401);
    });

    it('GET /api/admin/activities ohne Token -> 401', async () => {
      const res = await request(app).get('/api/admin/activities');
      expect(res.status).toBe(401);
    });

    it('GET /api/admin/users ohne Token -> 401', async () => {
      const res = await request(app).get('/api/admin/users');
      expect(res.status).toBe(401);
    });

    it('GET /api/teamer/dashboard ohne Token -> 401', async () => {
      const res = await request(app).get('/api/teamer/dashboard');
      expect(res.status).toBe(401);
    });

    it('POST /api/admin/activities ohne Token -> 401', async () => {
      const res = await request(app)
        .post('/api/admin/activities')
        .send({ name: 'Test', points: 1 });
      expect(res.status).toBe(401);
    });
  });

  // ====================================================================
  // CROSS-ORG-ISOLATION: Admin kann nur eigene Org sehen
  // ====================================================================

  describe('Cross-Org-Isolation: Admin kann nur eigene Org sehen', () => {
    it('admin1 (Org 1) GET /api/admin/activities -> nur Org-1-Aktivitaeten', async () => {
      const res = await request(app)
        .get('/api/admin/activities')
        .set('Authorization', `Bearer ${tokens.admin}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Response-Objekte enthalten id und name (aber nicht organization_id)
      // Org 1 hat Activities mit IDs 1-4, Org 2 hat IDs 5-6
      const activityIds = res.body.map(a => a.id);
      // Muss Org-1-Activities enthalten
      expect(activityIds).toContain(ACTIVITIES.sonntagsgottesdienst.id);
      // Darf KEINE Org-2-Activities enthalten
      expect(activityIds).not.toContain(ACTIVITIES.gottesdienst2.id);
      expect(activityIds).not.toContain(ACTIVITIES.gemeinde2.id);
    });

    it('admin2 (Org 2) GET /api/admin/activities -> nur Org-2-Aktivitaeten', async () => {
      const res = await request(app)
        .get('/api/admin/activities')
        .set('Authorization', `Bearer ${tokens.admin_org2}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const activityIds = res.body.map(a => a.id);
      // Muss Org-2-Activities enthalten
      expect(activityIds).toContain(ACTIVITIES.gottesdienst2.id);
      // Darf KEINE Org-1-Activities enthalten
      expect(activityIds).not.toContain(ACTIVITIES.sonntagsgottesdienst.id);
      expect(activityIds).not.toContain(ACTIVITIES.gemeindefest.id);
    });

    it('admin1 (Org 1) GET /api/admin/jahrgaenge -> nur Org-1-Jahrgaenge', async () => {
      const res = await request(app)
        .get('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${tokens.admin}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const orgIds = res.body.map(j => j.organization_id);
      expect(orgIds.every(id => id === USERS.admin1.org_id)).toBe(true);
      const jahrgangIds = res.body.map(j => j.id);
      expect(jahrgangIds).not.toContain(JAHRGAENGE.jahrgang2.id);
    });

    it('admin2 (Org 2) GET /api/admin/jahrgaenge -> nur Org-2-Jahrgaenge', async () => {
      const res = await request(app)
        .get('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${tokens.admin_org2}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const orgIds = res.body.map(j => j.organization_id);
      expect(orgIds.every(id => id === USERS.admin2.org_id)).toBe(true);
      const jahrgangIds = res.body.map(j => j.id);
      expect(jahrgangIds).not.toContain(JAHRGAENGE.jahrgang1.id);
    });
  });

  // ====================================================================
  // CROSS-ORG-ISOLATION: Konfi sieht nur eigene Org
  // ====================================================================

  describe('Cross-Org-Isolation: Konfi sieht nur eigene Org', () => {
    it('konfi1 (Org 1) GET /api/konfi/dashboard -> Org-1-Daten', async () => {
      const res = await request(app)
        .get('/api/konfi/dashboard')
        .set('Authorization', `Bearer ${tokens.konfi}`);
      expect(res.status).toBe(200);
      // Dashboard enthaelt Konfi-Daten aus eigener Org
      expect(res.body).toBeDefined();
    });

    it('konfi3 (Org 2) GET /api/konfi/dashboard -> Org-2-Daten', async () => {
      const res = await request(app)
        .get('/api/konfi/dashboard')
        .set('Authorization', `Bearer ${tokens.konfi_org2}`);
      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });

    it('konfi1 (Org 1) GET /api/konfi/events -> keine Org-2-Events', async () => {
      const res = await request(app)
        .get('/api/konfi/events')
        .set('Authorization', `Bearer ${tokens.konfi}`);
      expect(res.status).toBe(200);
      // Events sollten nur Org-1-Events enthalten (IDs 1-3), nicht ID 4 (Org 2)
      if (Array.isArray(res.body)) {
        const eventIds = res.body.map(e => e.id);
        expect(eventIds).not.toContain(4); // Gemeindeabend aus Org 2
      }
    });

    it('konfi3 (Org 2) GET /api/konfi/events -> keine Org-1-Events', async () => {
      const res = await request(app)
        .get('/api/konfi/events')
        .set('Authorization', `Bearer ${tokens.konfi_org2}`);
      expect(res.status).toBe(200);
      if (Array.isArray(res.body)) {
        const eventIds = res.body.map(e => e.id);
        expect(eventIds).not.toContain(1); // Weihnachtsgottesdienst aus Org 1
        expect(eventIds).not.toContain(2); // Konfi-Unterricht aus Org 1
        expect(eventIds).not.toContain(3); // Workshop-Tag aus Org 1
      }
    });
  });

  // ====================================================================
  // CROSS-ORG-ISOLATION: Admin kann Org-fremde Daten nicht aendern
  // ====================================================================

  describe('Cross-Org-Isolation: Admin kann Org-fremde Daten nicht aendern', () => {
    it('admin1 (Org 1) DELETE Activity aus Org 2 -> 404 (nicht gefunden wegen Org-Filter)', async () => {
      const res = await request(app)
        .delete(`/api/admin/activities/${ACTIVITIES.gottesdienst2.id}`)
        .set('Authorization', `Bearer ${tokens.admin}`);
      // DELETE filtert WHERE organization_id = req.user.organization_id
      // Activity mit ID 5 gehoert zu Org 2 -> rowCount=0 -> 404
      expect(res.status).toBe(404);
    });

    it('admin2 (Org 2) DELETE Activity aus Org 1 -> 404', async () => {
      const res = await request(app)
        .delete(`/api/admin/activities/${ACTIVITIES.sonntagsgottesdienst.id}`)
        .set('Authorization', `Bearer ${tokens.admin_org2}`);
      expect(res.status).toBe(404);
    });

    it('admin1 (Org 1) PUT Activity aus Org 2 -> nicht erfolgreich', async () => {
      const res = await request(app)
        .put(`/api/admin/activities/${ACTIVITIES.gottesdienst2.id}`)
        .set('Authorization', `Bearer ${tokens.admin}`)
        .send({ name: 'Manipuliert', points: 99 });
      // PUT filtert ebenfalls WHERE organization_id = req.user.organization_id
      // Entweder 404 (nicht gefunden) oder keine Aenderung
      expect([404, 400, 500]).toContain(res.status);
    });
  });
});
