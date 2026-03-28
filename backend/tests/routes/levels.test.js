const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, LEVELS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Levels Routes', () => {
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
  // GET /api/levels
  // ================================================================
  describe('GET /api/levels', () => {
    it('Jeder authentifizierte User bekommt 200 + Array', async () => {
      const res = await request(app)
        .get('/api/levels')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Org 1 hat 4 Levels (novize, lehrling, gehilfe, experte)
      expect(res.body.length).toBe(4);
      // Sortiert nach points_required ASC
      expect(res.body[0].points_required).toBeLessThanOrEqual(res.body[1].points_required);
    });

    it('Teamer bekommt 200', async () => {
      const res = await request(app)
        .get('/api/levels')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(4);
    });

    it('Ohne Token bekommt 401', async () => {
      const res = await request(app)
        .get('/api/levels');

      expect(res.status).toBe(401);
    });

    it('Admin aus Org 2 sieht nur eigene Levels', async () => {
      const res = await request(app)
        .get('/api/levels')
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(res.status).toBe(200);
      // Org 2 hat 1 Level (novize2)
      expect(res.body.length).toBe(1);
      expect(res.body[0].id).toBe(LEVELS.novize2.id);
    });
  });

  // ================================================================
  // POST /api/levels
  // ================================================================
  describe('POST /api/levels', () => {
    it('Admin erstellt Level -> 201', async () => {
      const res = await request(app)
        .post('/api/levels')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'meister',
          title: 'Meister',
          points_required: 50,
          color: '#ff0000',
          icon: 'star',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('meister');
    });

    it('Konfi bekommt 403 auf POST', async () => {
      const res = await request(app)
        .post('/api/levels')
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({
          name: 'test',
          title: 'Test',
          points_required: 100,
        });

      expect(res.status).toBe(403);
    });

    it('Teamer bekommt 403 auf POST', async () => {
      const res = await request(app)
        .post('/api/levels')
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({
          name: 'test',
          title: 'Test',
          points_required: 100,
        });

      expect(res.status).toBe(403);
    });

    it('Doppelte Punktzahl gibt 400', async () => {
      const res = await request(app)
        .post('/api/levels')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'duplikat',
          title: 'Duplikat',
          points_required: 0, // novize hat bereits 0
        });

      expect(res.status).toBe(400);
    });

    it('Fehlende Pflichtfelder geben 400', async () => {
      const res = await request(app)
        .post('/api/levels')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'test' });

      expect(res.status).toBe(400);
    });
  });

  // ================================================================
  // PUT /api/levels/:id
  // ================================================================
  describe('PUT /api/levels/:id', () => {
    it('Admin aktualisiert Level -> 200', async () => {
      const res = await request(app)
        .put(`/api/levels/${LEVELS.lehrling.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'lehrling-neu',
          title: 'Lehrling Neu',
          points_required: 7,
        });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('lehrling-neu');
    });

    it('Nicht-existierende ID gibt 404', async () => {
      const res = await request(app)
        .put('/api/levels/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'test',
          title: 'Test',
          points_required: 100,
        });

      expect(res.status).toBe(404);
    });

    it('Admin aus Org 2 kann Level aus Org 1 NICHT aendern -> 404', async () => {
      const res = await request(app)
        .put(`/api/levels/${LEVELS.lehrling.id}`)
        .set('Authorization', `Bearer ${admin2Token}`)
        .send({
          name: 'versuch',
          title: 'Versuch',
          points_required: 7,
        });

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // DELETE /api/levels/:id
  // ================================================================
  describe('DELETE /api/levels/:id', () => {
    it('Admin loescht Level -> 200', async () => {
      // Experte hat keine Konfis auf diesem Level
      const res = await request(app)
        .delete(`/api/levels/${LEVELS.experte.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('gelöscht');
    });

    it('Nicht-existierende ID gibt 404', async () => {
      const res = await request(app)
        .delete('/api/levels/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('Konfi bekommt 403 auf DELETE', async () => {
      const res = await request(app)
        .delete(`/api/levels/${LEVELS.experte.id}`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // GET /api/levels/konfi/:userId
  // ================================================================
  describe('GET /api/levels/konfi/:userId', () => {
    it('Konfi-Level abfragen -> 200', async () => {
      const res = await request(app)
        .get(`/api/levels/konfi/${USERS.konfi1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.konfi_id).toBe(USERS.konfi1.id);
      expect(res.body.total_points).toBeDefined();
      expect(res.body.all_levels).toBeDefined();
      expect(Array.isArray(res.body.all_levels)).toBe(true);
      expect(res.body.progress_percentage).toBeDefined();
    });

    it('Nicht-existierender Konfi gibt 404', async () => {
      const res = await request(app)
        .get('/api/levels/konfi/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('Konfi aus anderer Org gibt 404', async () => {
      const res = await request(app)
        .get(`/api/levels/konfi/${USERS.konfi3.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });
});
