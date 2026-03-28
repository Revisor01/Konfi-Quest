const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Jahrgaenge Routes', () => {
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
  // GET /api/admin/jahrgaenge
  // ================================================================
  describe('GET /api/admin/jahrgaenge', () => {
    it('Admin bekommt 200 + Array mit Jahrgaengen der eigenen Org', async () => {
      const res = await request(app)
        .get('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Org 1 hat 1 Jahrgang
      expect(res.body.length).toBe(1);
      expect(res.body[0].name).toBe(JAHRGAENGE.jahrgang1.name);
      // Aggregierte Felder pruefen
      expect(res.body[0].konfi_count).toBeDefined();
    });

    it('Teamer bekommt 200 (requireTeamer erlaubt Teamer)', async () => {
      const res = await request(app)
        .get('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Konfi bekommt 403', async () => {
      const res = await request(app)
        .get('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });

    it('Ohne Token bekommt 401', async () => {
      const res = await request(app)
        .get('/api/admin/jahrgaenge');

      expect(res.status).toBe(401);
    });

    it('Admin aus Org 2 sieht nur eigene Jahrgaenge', async () => {
      const res = await request(app)
        .get('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].id).toBe(JAHRGAENGE.jahrgang2.id);
    });
  });

  // ================================================================
  // POST /api/admin/jahrgaenge
  // ================================================================
  describe('POST /api/admin/jahrgaenge', () => {
    it('Admin erstellt Jahrgang -> 201', async () => {
      const res = await request(app)
        .post('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '2026/2027' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('2026/2027');
    });

    it('Teamer bekommt 403 auf POST', async () => {
      const res = await request(app)
        .post('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({ name: '2026/2027' });

      expect(res.status).toBe(403);
    });

    it('Leerer Name gibt 400', async () => {
      const res = await request(app)
        .post('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '' });

      expect(res.status).toBe(400);
    });

    it('Jahrgang mit optionalen Feldern erstellen', async () => {
      const res = await request(app)
        .post('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '2026/2027',
          gottesdienst_enabled: true,
          gemeinde_enabled: false,
          target_gottesdienst: 15,
          target_gemeinde: 0,
        });

      expect(res.status).toBe(201);
      expect(res.body.gottesdienst_enabled).toBe(true);
      expect(res.body.gemeinde_enabled).toBe(false);
    });
  });

  // ================================================================
  // PUT /api/admin/jahrgaenge/:id
  // ================================================================
  describe('PUT /api/admin/jahrgaenge/:id', () => {
    it('Admin aktualisiert Jahrgang -> 200', async () => {
      const res = await request(app)
        .put(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Umbenannt 2025/2026' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('aktualisiert');
    });

    it('Nicht-existierende ID gibt 404', async () => {
      const res = await request(app)
        .put('/api/admin/jahrgaenge/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test' });

      expect(res.status).toBe(404);
    });

    it('Admin aus Org 2 kann Jahrgang aus Org 1 NICHT aendern -> 404', async () => {
      const res = await request(app)
        .put(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${admin2Token}`)
        .send({ name: 'Versuch' });

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // DELETE /api/admin/jahrgaenge/:id
  // ================================================================
  describe('DELETE /api/admin/jahrgaenge/:id', () => {
    it('Jahrgang mit Konfis gibt 409 (in Benutzung)', async () => {
      // Jahrgang 1 hat Konfis zugeordnet
      const res = await request(app)
        .delete(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
    });

    it('Admin loescht leeren Jahrgang -> 200', async () => {
      // Neuen leeren Jahrgang erstellen
      const createRes = await request(app)
        .post('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Leerer Jahrgang' });

      const newId = createRes.body.id;

      const res = await request(app)
        .delete(`/api/admin/jahrgaenge/${newId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('gelöscht');
    });

    it('Nicht-existierende ID gibt 404', async () => {
      const res = await request(app)
        .delete('/api/admin/jahrgaenge/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('Admin aus Org 2 kann Jahrgang aus Org 1 NICHT loeschen', async () => {
      // Neuen leeren Jahrgang in Org 1 erstellen
      const createRes = await request(app)
        .post('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Org1 Jahrgang' });

      const res = await request(app)
        .delete(`/api/admin/jahrgaenge/${createRes.body.id}`)
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(res.status).toBe(404);
    });
  });
});
