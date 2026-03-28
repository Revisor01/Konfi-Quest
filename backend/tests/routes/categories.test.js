const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, CATEGORIES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Categories Routes', () => {
  let app;
  let db;
  let adminToken;
  let teamerToken;
  let konfiToken;
  let admin2Token;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    adminToken = generateToken('admin1');
    teamerToken = generateToken('teamer1');
    konfiToken = generateToken('konfi1');
    admin2Token = generateToken('admin2');
  });

  afterAll(async () => {
    await closePool();
  });

  // ================================================================
  // GET /api/admin/categories
  // ================================================================
  describe('GET /api/admin/categories', () => {
    it('Admin bekommt 200 + Array mit Kategorien der eigenen Org', async () => {
      const res = await request(app)
        .get('/api/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Org 1 hat 2 Kategorien (Gottesdienst, Gemeinde)
      expect(res.body.length).toBe(2);
      expect(res.body[0].name).toBeDefined();
    });

    it('Teamer bekommt 200 (requireTeamer erlaubt Teamer)', async () => {
      const res = await request(app)
        .get('/api/admin/categories')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Konfi bekommt 403', async () => {
      const res = await request(app)
        .get('/api/admin/categories')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });

    it('Ohne Token bekommt 401', async () => {
      const res = await request(app)
        .get('/api/admin/categories');

      expect(res.status).toBe(401);
    });

    it('Admin aus Org 2 sieht nur eigene Kategorien', async () => {
      const res = await request(app)
        .get('/api/admin/categories')
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(res.status).toBe(200);
      // Org 2 hat 2 Kategorien (Gottesdienst, Gemeinde)
      expect(res.body.length).toBe(2);
      const ids = res.body.map(c => c.id);
      expect(ids).not.toContain(CATEGORIES.gottesdienst1.id);
      expect(ids).not.toContain(CATEGORIES.gemeinde1.id);
    });
  });

  // ================================================================
  // POST /api/admin/categories
  // ================================================================
  describe('POST /api/admin/categories', () => {
    it('Admin erstellt Kategorie -> 201', async () => {
      const res = await request(app)
        .post('/api/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Neue Kategorie', type: 'both' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.message).toContain('erstellt');
    });

    it('Teamer bekommt 403 auf POST', async () => {
      const res = await request(app)
        .post('/api/admin/categories')
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({ name: 'Test', type: 'both' });

      expect(res.status).toBe(403);
    });

    it('Leerer Name gibt 400', async () => {
      const res = await request(app)
        .post('/api/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '', type: 'both' });

      expect(res.status).toBe(400);
    });
  });

  // ================================================================
  // PUT /api/admin/categories/:id
  // ================================================================
  describe('PUT /api/admin/categories/:id', () => {
    it('Admin aktualisiert Kategorie -> 200', async () => {
      const res = await request(app)
        .put(`/api/admin/categories/${CATEGORIES.gottesdienst1.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Aktualisiert' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('aktualisiert');
    });

    it('Nicht-existierende ID gibt 404', async () => {
      const res = await request(app)
        .put('/api/admin/categories/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test' });

      expect(res.status).toBe(404);
    });

    it('Admin aus Org 2 kann Kategorie aus Org 1 NICHT aendern -> 404', async () => {
      const res = await request(app)
        .put(`/api/admin/categories/${CATEGORIES.gottesdienst1.id}`)
        .set('Authorization', `Bearer ${admin2Token}`)
        .send({ name: 'Versuch' });

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // DELETE /api/admin/categories/:id
  // ================================================================
  describe('DELETE /api/admin/categories/:id', () => {
    it('Admin loescht unbenutzte Kategorie -> 200', async () => {
      // Neue Kategorie erstellen (ohne Activities)
      const createRes = await request(app)
        .post('/api/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Zum Loeschen', type: 'both' });

      const newId = createRes.body.id;

      const res = await request(app)
        .delete(`/api/admin/categories/${newId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('gelöscht');
    });

    it('Kategorie mit Activities gibt 409 (in Benutzung)', async () => {
      // Gottesdienst-Kategorie hat activity_categories Zuordnungen
      const res = await request(app)
        .delete(`/api/admin/categories/${CATEGORIES.gottesdienst1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
    });

    it('Nicht-existierende ID gibt 404', async () => {
      const res = await request(app)
        .delete('/api/admin/categories/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('Admin aus Org 2 kann Kategorie aus Org 1 NICHT loeschen -> 404', async () => {
      // Erst neue unbenutzte Kategorie in Org 1 erstellen
      const createRes = await request(app)
        .post('/api/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Org1 Kategorie', type: 'both' });

      const res = await request(app)
        .delete(`/api/admin/categories/${createRes.body.id}`)
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(res.status).toBe(404);
    });
  });
});
