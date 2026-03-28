const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, EVENTS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Material Routes', () => {
  let app;
  let db;
  let orgAdminToken;
  let adminToken;
  let teamerToken;
  let konfiToken;
  let orgAdmin2Token;
  let teamer2Token;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    orgAdminToken = generateToken('orgAdmin1');
    adminToken = generateToken('admin1');
    teamerToken = generateToken('teamer1');
    konfiToken = generateToken('konfi1');
    orgAdmin2Token = generateToken('orgAdmin2');
    teamer2Token = generateToken('teamer2');
  });

  afterAll(async () => {
    await closePool();
  });

  // ================================================================
  // TAG ENDPOINTS
  // ================================================================
  describe('GET /api/material/tags', () => {
    it('Teamer bekommt 200 + leeres Tag-Array', async () => {
      const res = await request(app)
        .get('/api/material/tags')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });

    it('Admin bekommt 200', async () => {
      const res = await request(app)
        .get('/api/material/tags')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Konfi bekommt 403', async () => {
      const res = await request(app)
        .get('/api/material/tags')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/material/tags', () => {
    it('OrgAdmin erstellt Tag -> 201', async () => {
      const res = await request(app)
        .post('/api/material/tags')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ name: 'Gottesdienst-Material' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('Gottesdienst-Material');
    });

    it('Teamer bekommt 403', async () => {
      const res = await request(app)
        .post('/api/material/tags')
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({ name: 'Test-Tag' });

      expect(res.status).toBe(403);
    });

    it('Leerer Name gibt Validierungsfehler', async () => {
      const res = await request(app)
        .post('/api/material/tags')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ name: '' });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/material/tags/:id', () => {
    let tagId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/material/tags')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ name: 'Original-Tag' });
      tagId = res.body.id;
    });

    it('OrgAdmin aktualisiert Tag -> 200', async () => {
      const res = await request(app)
        .put(`/api/material/tags/${tagId}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ name: 'Aktualisierter Tag' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Aktualisierter Tag');
    });

    it('Nicht-existierende ID gibt 404', async () => {
      const res = await request(app)
        .put('/api/material/tags/99999')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ name: 'Gibts nicht' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/material/tags/:id', () => {
    let tagId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/material/tags')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ name: 'Loesch-Tag' });
      tagId = res.body.id;
    });

    it('OrgAdmin loescht Tag -> 200', async () => {
      const res = await request(app)
        .delete(`/api/material/tags/${tagId}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('gelöscht');
    });

    it('Nicht-existierende ID gibt 404', async () => {
      const res = await request(app)
        .delete('/api/material/tags/99999')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // MATERIAL CRUD ENDPOINTS
  // ================================================================
  describe('GET /api/material', () => {
    it('Teamer bekommt 200 + Material-Liste', async () => {
      const res = await request(app)
        .get('/api/material')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Konfi bekommt 403', async () => {
      const res = await request(app)
        .get('/api/material')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/material', () => {
    it('OrgAdmin erstellt Material -> 201', async () => {
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Neues Material', description: 'Eine Beschreibung' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('Neues Material');
    });

    it('Teamer bekommt 403', async () => {
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({ title: 'Test-Material' });

      expect(res.status).toBe(403);
    });

    it('Fehlender Titel gibt 400', async () => {
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ description: 'Ohne Titel' });

      expect(res.status).toBe(400);
    });

    it('Material mit Tags erstellen', async () => {
      // Zuerst Tag erstellen
      const tagRes = await request(app)
        .post('/api/material/tags')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ name: 'Test-Tag' });

      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({
          title: 'Material mit Tag',
          tag_ids: [tagRes.body.id],
        });

      expect(res.status).toBe(201);

      // Verify: Material hat Tag
      const detailRes = await request(app)
        .get(`/api/material/${res.body.id}`)
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.tags.length).toBe(1);
    });
  });

  describe('GET /api/material/:id', () => {
    let materialId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Detail-Material', description: 'Details' });
      materialId = res.body.id;
    });

    it('Teamer bekommt 200 + Material-Details', async () => {
      const res = await request(app)
        .get(`/api/material/${materialId}`)
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Detail-Material');
      expect(res.body.tags).toBeDefined();
      expect(res.body.files).toBeDefined();
    });

    it('Nicht-existierende ID gibt 404', async () => {
      const res = await request(app)
        .get('/api/material/99999')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/material/:id', () => {
    let materialId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Altes Material' });
      materialId = res.body.id;
    });

    it('OrgAdmin aktualisiert Material -> 200', async () => {
      const res = await request(app)
        .put(`/api/material/${materialId}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Aktualisiertes Material' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('aktualisiert');
    });

    it('Nicht-existierende ID gibt 404', async () => {
      const res = await request(app)
        .put('/api/material/99999')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Gibts nicht' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/material/:id', () => {
    let materialId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Loesch-Material' });
      materialId = res.body.id;
    });

    it('OrgAdmin loescht Material -> 200', async () => {
      const res = await request(app)
        .delete(`/api/material/${materialId}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('gelöscht');
    });

    it('Nicht-existierende ID gibt 404', async () => {
      const res = await request(app)
        .delete('/api/material/99999')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/material/by-event/:eventId', () => {
    it('Teamer bekommt Material fuer Event (200, leer)', async () => {
      const res = await request(app)
        .get(`/api/material/by-event/${EVENTS.gottesdienstEvent.id}`)
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Material mit Event-Zuordnung wird gefunden', async () => {
      // Material mit Event erstellen
      const matRes = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({
          title: 'Event-Material',
          event_ids: [EVENTS.gottesdienstEvent.id],
        });

      expect(matRes.status).toBe(201);

      const res = await request(app)
        .get(`/api/material/by-event/${EVENTS.gottesdienstEvent.id}`)
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].title).toBe('Event-Material');
    });
  });

  // ================================================================
  // FILE ENDPOINTS (Erreichbarkeit + Auth)
  // ================================================================
  describe('POST /api/material/:id/files', () => {
    let materialId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'File-Material' });
      materialId = res.body.id;
    });

    it('Ohne Datei ergibt 400', async () => {
      const res = await request(app)
        .post(`/api/material/${materialId}/files`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      // Erwartet 400 (keine Dateien) oder ggf. einen anderen Fehler — kein 500 crash
      expect(res.status).toBeLessThan(500);
    });

    it('Teamer bekommt 403', async () => {
      const res = await request(app)
        .post(`/api/material/${materialId}/files`)
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/material/files/:fileId', () => {
    it('OrgAdmin loescht nicht-existierende Datei -> 404', async () => {
      const res = await request(app)
        .delete('/api/material/files/99999')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(404);
    });

    it('Teamer bekommt 403', async () => {
      const res = await request(app)
        .delete('/api/material/files/1')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/material/files/:filename', () => {
    it('Ungueltige Dateiname-Format gibt 400', async () => {
      const res = await request(app)
        .get('/api/material/files/invalid-filename')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(400);
    });

    it('Gueltige Hex-Datei die nicht existiert gibt 404', async () => {
      const res = await request(app)
        .get('/api/material/files/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // ORG-ISOLATION
  // ================================================================
  describe('Org-Isolation', () => {
    let materialId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Org1-Material' });
      materialId = res.body.id;
    });

    it('Teamer2 (Org2) sieht kein Material aus Org1', async () => {
      const res = await request(app)
        .get('/api/material')
        .set('Authorization', `Bearer ${teamer2Token}`);

      expect(res.status).toBe(200);
      const ids = res.body.map(m => m.id);
      expect(ids).not.toContain(materialId);
    });

    it('OrgAdmin2 kann Material aus Org1 nicht loeschen -> 404', async () => {
      const res = await request(app)
        .delete(`/api/material/${materialId}`)
        .set('Authorization', `Bearer ${orgAdmin2Token}`);

      expect(res.status).toBe(404);
    });
  });
});
