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

    it('Aktiver Konfi traegt das Level -> 409 mit verstaendlicher Meldung', async () => {
      await db.query(
        'UPDATE konfi_profiles SET current_level_id = $1 WHERE user_id = $2',
        [LEVELS.novize.id, USERS.konfi1.id]
      );

      const res = await request(app)
        .delete(`/api/levels/${LEVELS.novize.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Dieses Level ist noch vergeben — benenne es um oder ordne die betroffenen Konfis um.');
      expect(res.body.usage_count).toBe(1);
    });

    it('SOFT-GELOESCHTER Konfi traegt das Level -> 409 statt 500 (Befund M4)', async () => {
      // Auto-Deletion (Tag 60-120) setzt deleted_at, das Profil samt
      // current_level_id bleibt. Vorher filterte der Verwendungs-Check
      // deleted_at IS NULL, das DELETE lief in den FK-Fehler -> 500er.
      await db.query(
        'UPDATE konfi_profiles SET current_level_id = $1 WHERE user_id = $2',
        [LEVELS.novize.id, USERS.konfi1.id]
      );
      await db.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [USERS.konfi1.id]);

      const res = await request(app)
        .delete(`/api/levels/${LEVELS.novize.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Dieses Level ist noch vergeben — benenne es um oder ordne die betroffenen Konfis um.');
      expect(res.body.usage_count).toBe(1);

      // Das Level existiert weiterhin
      const { rows } = await db.query('SELECT 1 FROM levels WHERE id = $1', [LEVELS.novize.id]);
      expect(rows.length).toBe(1);
    });

    it('Umbenennen eines vergebenen Levels funktioniert: Konfi sieht sofort den neuen Namen (ID-Bindung)', async () => {
      // Beleg fuer die 409-Empfehlung "benenne es um": vergebene Level
      // haengen an konfi_profiles.current_level_id (Join per ID), nicht am
      // Namen — nach dem PUT zeigt der Konfi-Endpoint den neuen Titel.
      await db.query(
        'UPDATE konfi_profiles SET current_level_id = $1 WHERE user_id = $2',
        [LEVELS.novize.id, USERS.konfi1.id]
      );

      const put = await request(app)
        .put(`/api/levels/${LEVELS.novize.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'anfaengerin', title: 'Anfängerin', points_required: 0, is_active: true });
      expect(put.status).toBe(200);
      expect(put.body.title).toBe('Anfängerin');

      const res = await request(app)
        .get(`/api/levels/konfi/${USERS.konfi1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      // konfi1 hat 0 Punkte -> aktuelles Level ist das umbenannte Einstiegs-Level
      expect(res.body.current_level.id).toBe(LEVELS.novize.id);
      expect(res.body.current_level.title).toBe('Anfängerin');
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

    // Befund 23.08.2026: Die Route pruefte nur die Organisation — jeder Konfi
    // konnte Namen, Punktestand und Level jedes anderen Konfis seiner Gemeinde
    // abrufen (gegen Produktion nachgewiesen).
    it('Konfi darf die Daten eines ANDEREN Konfis nicht abrufen -> 403', async () => {
      const res = await request(app)
        .get(`/api/levels/konfi/${USERS.konfi2.id}`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Du kannst nur deine eigenen Punkte abrufen');
    });

    it('Konfi darf die EIGENEN Daten abrufen -> 200', async () => {
      const res = await request(app)
        .get(`/api/levels/konfi/${USERS.konfi1.id}`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.konfi_id).toBe(USERS.konfi1.id);
    });

    it('Teamer:in darf fremde Konfi-Daten abrufen -> 200', async () => {
      const res = await request(app)
        .get(`/api/levels/konfi/${USERS.konfi1.id}`)
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
    });

    it('Soft-geloeschter Konfi gibt 404', async () => {
      await db.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [USERS.konfi1.id]);

      const res = await request(app)
        .get(`/api/levels/konfi/${USERS.konfi1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });
});
