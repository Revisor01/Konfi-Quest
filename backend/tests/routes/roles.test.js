const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ROLES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Roles Routes', () => {
  let app;
  let db;
  let orgAdminToken;
  let superAdminToken;
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
    orgAdminToken = generateToken('orgAdmin1');
    superAdminToken = generateToken('superAdmin');
    adminToken = generateToken('admin1');
    teamerToken = generateToken('teamer1');
    konfiToken = generateToken('konfi1');
  });

  afterAll(async () => {
    await closePool();
  });

  // ================================================================
  // GET /api/roles
  // ================================================================
  describe('GET /api/roles', () => {
    it('OrgAdmin bekommt 200 + Rollen-Array mit user_count', async () => {
      const res = await request(app)
        .get('/api/roles')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      // Jede Rolle hat die erwartete Struktur
      const role = res.body[0];
      expect(role.id).toBeDefined();
      expect(role.name).toBeDefined();
      expect(role.display_name).toBeDefined();
      expect(typeof role.user_count).toBe('number');
    });

    it('SuperAdmin bekommt 200 + Rollen-Array', async () => {
      const res = await request(app)
        .get('/api/roles')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Admin bekommt 403 (nur org_admin/super_admin erlaubt)', async () => {
      const res = await request(app)
        .get('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });

    it('Teamer bekommt 403', async () => {
      const res = await request(app)
        .get('/api/roles')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(403);
    });

    it('Konfi bekommt 403', async () => {
      const res = await request(app)
        .get('/api/roles')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });

    it('Ohne Token -> 401', async () => {
      const res = await request(app).get('/api/roles');
      expect(res.status).toBe(401);
    });
  });

  // ================================================================
  // GET /api/roles/:id
  // ================================================================
  describe('GET /api/roles/:id', () => {
    it('OrgAdmin bekommt 200 + Rolle mit permissions', async () => {
      const res = await request(app)
        .get(`/api/roles/${ROLES.orgAdmin.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(ROLES.orgAdmin.id);
      expect(res.body.name).toBe('org_admin');
      expect(res.body.permissions).toBeDefined();
      expect(Array.isArray(res.body.permissions)).toBe(true);
    });

    it('Nicht-existierende Rollen-ID -> 404', async () => {
      const res = await request(app)
        .get('/api/roles/9999')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(404);
    });

    it('Admin bekommt 403', async () => {
      const res = await request(app)
        .get(`/api/roles/${ROLES.admin.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // GET /api/roles/list/assignable
  // ================================================================
  describe('GET /api/roles/list/assignable', () => {
    it('OrgAdmin bekommt 200 + zuweisbare Rollen (admin, teamer, konfi)', async () => {
      const res = await request(app)
        .get('/api/roles/list/assignable')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const roleNames = res.body.map(r => r.name);
      expect(roleNames).toContain('admin');
      expect(roleNames).toContain('teamer');
      expect(roleNames).toContain('konfi');
      // OrgAdmin sollte org_admin NICHT zuweisen koennen
      expect(roleNames).not.toContain('org_admin');
    });

    it('Admin bekommt 200 + zuweisbare Rollen (teamer, konfi)', async () => {
      const res = await request(app)
        .get('/api/roles/list/assignable')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const roleNames = res.body.map(r => r.name);
      expect(roleNames).toContain('teamer');
      expect(roleNames).toContain('konfi');
      expect(roleNames).not.toContain('admin');
    });

    it('Teamer bekommt 403 (nicht in erlaubter Liste)', async () => {
      const res = await request(app)
        .get('/api/roles/list/assignable')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(403);
    });

    it('Konfi bekommt 403', async () => {
      const res = await request(app)
        .get('/api/roles/list/assignable')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });
  });
});
