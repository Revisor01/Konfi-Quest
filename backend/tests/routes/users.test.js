const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Users Routes', () => {
  let app;
  let db;
  let orgAdminToken;
  let orgAdmin2Token;
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
    orgAdmin2Token = generateToken('orgAdmin2');
    superAdminToken = generateToken('superAdmin');
    adminToken = generateToken('admin1');
    teamerToken = generateToken('teamer1');
    konfiToken = generateToken('konfi1');
  });

  afterAll(async () => {
    await closePool();
  });

  // ================================================================
  // GET /api/admin/users
  // ================================================================
  describe('GET /api/admin/users', () => {
    it('OrgAdmin bekommt 200 + User-Liste der eigenen Org', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      // Route filtert konfi und super_admin heraus
      const roleNames = res.body.map(u => u.role_name);
      expect(roleNames).not.toContain('konfi');
      expect(roleNames).not.toContain('super_admin');
    });

    it('Admin bekommt 403 (nur org_admin erlaubt)', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });

    it('Teamer bekommt 403', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(403);
    });

    it('Konfi bekommt 403', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });

    it('Ohne Token -> 401', async () => {
      const res = await request(app).get('/api/admin/users');
      expect(res.status).toBe(401);
    });
  });

  // ================================================================
  // GET /api/admin/users/:id
  // ================================================================
  describe('GET /api/admin/users/:id', () => {
    it('OrgAdmin bekommt 200 + User-Details', async () => {
      const res = await request(app)
        .get(`/api/admin/users/${USERS.admin1.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(USERS.admin1.id);
      expect(res.body.username).toBe(USERS.admin1.username);
      expect(res.body.assigned_jahrgaenge).toBeDefined();
    });

    it('Nicht-existierender User -> 404', async () => {
      const res = await request(app)
        .get('/api/admin/users/9999')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // POST /api/admin/users
  // ================================================================
  describe('POST /api/admin/users', () => {
    it('OrgAdmin erstellt User -> 201', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({
          username: 'neuer_teamer',
          display_name: 'Neuer Teamer',
          password: 'Sicher!123',
          role_id: ROLES.teamer.id
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.username).toBe('neuer_teamer');
    });

    it('Fehlender username -> 400 Validierungsfehler', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({
          display_name: 'Ohne Username',
          password: 'Sicher!123',
          role_id: ROLES.teamer.id
        });

      expect(res.status).toBe(400);
    });

    it('Duplikat-Username -> 409', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({
          username: USERS.admin1.username, // existiert bereits
          display_name: 'Duplikat',
          password: 'Sicher!123',
          role_id: ROLES.teamer.id
        });

      expect(res.status).toBe(409);
    });

    it('Admin bekommt 403', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'admin_erstellt',
          display_name: 'Von Admin',
          password: 'Sicher!123',
          role_id: ROLES.teamer.id
        });

      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // PUT /api/admin/users/:id
  // ================================================================
  describe('PUT /api/admin/users/:id', () => {
    it('OrgAdmin aktualisiert User -> 200', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${USERS.teamer1.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ display_name: 'Aktualisierter Teamer' });

      expect(res.status).toBe(200);
    });

    it('Nicht-existierender User -> 404', async () => {
      const res = await request(app)
        .put('/api/admin/users/9999')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ display_name: 'Nichtexistent' });

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // DELETE /api/admin/users/:id
  // ================================================================
  describe('DELETE /api/admin/users/:id', () => {
    it('OrgAdmin loescht User -> 200', async () => {
      const res = await request(app)
        .delete(`/api/admin/users/${USERS.teamer1.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
    });

    it('Nicht-existierender User -> 404', async () => {
      const res = await request(app)
        .delete('/api/admin/users/9999')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(404);
    });

    it('Selbstloeschung verboten -> 400', async () => {
      const res = await request(app)
        .delete(`/api/admin/users/${USERS.orgAdmin1.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('eigenes Konto');
    });
  });

  // ================================================================
  // POST /api/admin/users/:id/jahrgaenge
  // ================================================================
  describe('POST /api/admin/users/:id/jahrgaenge', () => {
    it('OrgAdmin weist Jahrgaenge zu -> 200', async () => {
      const res = await request(app)
        .post(`/api/admin/users/${USERS.admin1.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({
          jahrgang_assignments: [
            { jahrgang_id: JAHRGAENGE.jahrgang1.id, can_view: true, can_edit: true }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.assignments_count).toBe(1);
    });

    it('Leere Zuweisung entfernt alle Jahrgaenge -> 200', async () => {
      const res = await request(app)
        .post(`/api/admin/users/${USERS.teamer1.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ jahrgang_assignments: [] });

      expect(res.status).toBe(200);
      expect(res.body.assignments_count).toBe(0);
    });

    it('Nicht-existierender User -> 404', async () => {
      const res = await request(app)
        .post('/api/admin/users/9999/jahrgaenge')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ jahrgang_assignments: [] });

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // GET /api/users/me/jahrgaenge
  // ================================================================
  describe('GET /api/users/me/jahrgaenge', () => {
    it('Authentifizierter User sieht eigene Jahrgaenge -> 200', async () => {
      const res = await request(app)
        .get('/api/users/me/jahrgaenge')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Teamer1 hat jahrgang1 zugewiesen (per Seed)
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('Ohne Token -> 401', async () => {
      const res = await request(app).get('/api/users/me/jahrgaenge');
      expect(res.status).toBe(401);
    });
  });

  // ================================================================
  // GET /api/admin/users/:id/jahrgaenge
  // ================================================================
  describe('GET /api/admin/users/:id/jahrgaenge', () => {
    it('OrgAdmin sieht User-Jahrgaenge -> 200', async () => {
      const res = await request(app)
        .get(`/api/admin/users/${USERS.teamer1.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ================================================================
  // PUT /api/admin/users/:id/reset-password
  // ================================================================
  describe('PUT /api/admin/users/:id/reset-password', () => {
    it('OrgAdmin setzt Passwort zurueck -> 200', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${USERS.teamer1.id}/reset-password`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ password: 'Neues!Pw123' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Passwort');
    });

    it('SuperAdmin setzt Passwort zurueck -> 200', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${USERS.admin1.id}/reset-password`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ password: 'Neues!Pw456' });

      expect(res.status).toBe(200);
    });

    it('Admin bekommt 403 (nur org_admin/super_admin)', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${USERS.teamer1.id}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ password: 'Neues!Pw789' });

      expect(res.status).toBe(403);
    });

    it('Zu kurzes Passwort -> 400', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${USERS.teamer1.id}/reset-password`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ password: 'kurz' });

      expect(res.status).toBe(400);
    });

    it('Nicht-existierender User -> 404', async () => {
      const res = await request(app)
        .put('/api/admin/users/9999/reset-password')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ password: 'Neues!Pw123' });

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // Org-Isolation
  // ================================================================
  describe('Org-Isolation: OrgAdmin2 kann keine User aus Org 1 sehen/bearbeiten', () => {
    it('OrgAdmin2 sieht nur Org-2-Users', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${orgAdmin2Token}`);

      expect(res.status).toBe(200);
      // Keine Org-1-User enthalten
      const userIds = res.body.map(u => u.id);
      expect(userIds).not.toContain(USERS.admin1.id);
      expect(userIds).not.toContain(USERS.teamer1.id);
    });

    it('OrgAdmin2 kann User aus Org 1 nicht sehen -> 404', async () => {
      const res = await request(app)
        .get(`/api/admin/users/${USERS.admin1.id}`)
        .set('Authorization', `Bearer ${orgAdmin2Token}`);

      expect(res.status).toBe(404);
    });

    it('OrgAdmin2 kann User aus Org 1 nicht aktualisieren -> 404', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${USERS.teamer1.id}`)
        .set('Authorization', `Bearer ${orgAdmin2Token}`)
        .send({ display_name: 'Manipuliert' });

      expect(res.status).toBe(404);
    });

    it('OrgAdmin2 Passwort-Reset fuer Org-1-User -> 403', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${USERS.teamer1.id}/reset-password`)
        .set('Authorization', `Bearer ${orgAdmin2Token}`)
        .send({ password: 'Manipul!123' });

      expect(res.status).toBe(403);
    });
  });
});
