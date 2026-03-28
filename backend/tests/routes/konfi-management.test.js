const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE, ACTIVITIES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Konfi-Management Routes', () => {
  let app;
  let db;
  let adminToken;
  let orgAdminToken;
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
    orgAdminToken = generateToken('orgAdmin1');
    teamerToken = generateToken('teamer1');
    konfiToken = generateToken('konfi1');
    admin2Token = generateToken('admin2');
    // Admins brauchen Jahrgang-Zuordnung fuer konfi-management GET
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
    );
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
      [USERS.admin2.id, JAHRGAENGE.jahrgang2.id]
    );
  });

  afterAll(async () => {
    await closePool();
  });

  // ================================================================
  // GET /api/admin/konfis
  // ================================================================
  describe('GET /api/admin/konfis', () => {
    it('Admin bekommt 200 + Konfi-Liste der eigenen Org', async () => {
      const res = await request(app)
        .get('/api/admin/konfis')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Org 1 hat 2 Konfis (konfi1, konfi2)
      expect(res.body.length).toBe(2);
      expect(res.body[0].name).toBeDefined();
      expect(res.body[0].jahrgang_name).toBeDefined();
    });

    it('Teamer bekommt 200', async () => {
      const res = await request(app)
        .get('/api/admin/konfis')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Konfi bekommt 403', async () => {
      const res = await request(app)
        .get('/api/admin/konfis')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });

    it('Ohne Token bekommt 401', async () => {
      const res = await request(app)
        .get('/api/admin/konfis');

      expect(res.status).toBe(401);
    });

    it('Admin aus Org 2 sieht nur eigene Konfis', async () => {
      const res = await request(app)
        .get('/api/admin/konfis')
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(res.status).toBe(200);
      // Org 2 hat 1 Konfi (konfi3)
      expect(res.body.length).toBe(1);
    });
  });

  // ================================================================
  // GET /api/admin/konfis/teamer
  // ================================================================
  describe('GET /api/admin/konfis/teamer', () => {
    it('Admin bekommt 200 + Teamer-Liste', async () => {
      const res = await request(app)
        .get('/api/admin/konfis/teamer')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Org 1 hat 1 Teamer (teamer1)
      expect(res.body.length).toBe(1);
    });

    it('Teamer bekommt 200', async () => {
      const res = await request(app)
        .get('/api/admin/konfis/teamer')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
    });

    it('Konfi bekommt 403', async () => {
      const res = await request(app)
        .get('/api/admin/konfis/teamer')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // GET /api/admin/konfis/:id
  // ================================================================
  describe('GET /api/admin/konfis/:id', () => {
    it('Admin bekommt 200 + Konfi-Details mit Activities und BonusPoints', async () => {
      const res = await request(app)
        .get(`/api/admin/konfis/${USERS.konfi1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(USERS.konfi1.id);
      expect(res.body.activities).toBeDefined();
      expect(Array.isArray(res.body.activities)).toBe(true);
      expect(res.body.bonusPoints).toBeDefined();
      expect(Array.isArray(res.body.bonusPoints)).toBe(true);
      expect(res.body.badgeCount).toBeDefined();
    });

    it('Teamer bekommt 200', async () => {
      const res = await request(app)
        .get(`/api/admin/konfis/${USERS.konfi1.id}`)
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
    });

    it('Konfi bekommt 403', async () => {
      const res = await request(app)
        .get(`/api/admin/konfis/${USERS.konfi1.id}`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });

    it('Nicht-existierender Konfi gibt 404', async () => {
      const res = await request(app)
        .get('/api/admin/konfis/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('Admin aus Org 2 kann Konfi aus Org 1 NICHT sehen -> 404', async () => {
      const res = await request(app)
        .get(`/api/admin/konfis/${USERS.konfi1.id}`)
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // POST /api/admin/konfis (Konfi erstellen)
  // ================================================================
  describe('POST /api/admin/konfis', () => {
    it('Admin erstellt neuen Konfi -> 201', async () => {
      const res = await request(app)
        .post('/api/admin/konfis')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Neuer Konfi',
          jahrgang_id: JAHRGAENGE.jahrgang1.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.username).toBeDefined();
      expect(res.body.temporaryPassword).toBeDefined();
      expect(res.body.message).toContain('erstellt');
    });

    it('Teamer bekommt 403 auf POST', async () => {
      const res = await request(app)
        .post('/api/admin/konfis')
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({
          name: 'Test Konfi',
          jahrgang_id: JAHRGAENGE.jahrgang1.id,
        });

      expect(res.status).toBe(403);
    });

    it('Fehlender Name gibt 400', async () => {
      const res = await request(app)
        .post('/api/admin/konfis')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          jahrgang_id: JAHRGAENGE.jahrgang1.id,
        });

      expect(res.status).toBe(400);
    });

    it('Fehlender Jahrgang gibt 400', async () => {
      const res = await request(app)
        .post('/api/admin/konfis')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Konfi',
        });

      expect(res.status).toBe(400);
    });
  });

  // ================================================================
  // PUT /api/admin/konfis/:id
  // ================================================================
  describe('PUT /api/admin/konfis/:id', () => {
    it('Admin aktualisiert Konfi -> 200', async () => {
      const res = await request(app)
        .put(`/api/admin/konfis/${USERS.konfi1.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Neuer Name',
          jahrgang_id: JAHRGAENGE.jahrgang1.id,
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('aktualisiert');
    });

    it('Nicht-existierender Konfi gibt 404', async () => {
      const res = await request(app)
        .put('/api/admin/konfis/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test',
          jahrgang_id: JAHRGAENGE.jahrgang1.id,
        });

      expect(res.status).toBe(404);
    });

    it('Admin aus Org 2 kann Konfi aus Org 1 NICHT aendern -> 404', async () => {
      const res = await request(app)
        .put(`/api/admin/konfis/${USERS.konfi1.id}`)
        .set('Authorization', `Bearer ${admin2Token}`)
        .send({
          name: 'Versuch',
          jahrgang_id: JAHRGAENGE.jahrgang2.id,
        });

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // DELETE /api/admin/konfis/:id
  // ================================================================
  describe('DELETE /api/admin/konfis/:id', () => {
    it('Admin loescht Konfi -> 200', async () => {
      const res = await request(app)
        .delete(`/api/admin/konfis/${USERS.konfi2.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('gelöscht');

      // Verify: Konfi existiert nicht mehr
      const checkRes = await request(app)
        .get(`/api/admin/konfis/${USERS.konfi2.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(checkRes.status).toBe(404);
    });

    it('Nicht-existierender Konfi gibt 404', async () => {
      const res = await request(app)
        .delete('/api/admin/konfis/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('Admin aus Org 2 kann Konfi aus Org 1 NICHT loeschen -> 404', async () => {
      const res = await request(app)
        .delete(`/api/admin/konfis/${USERS.konfi1.id}`)
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // POST /api/admin/konfis/:id/bonus-points
  // ================================================================
  describe('POST /api/admin/konfis/:id/bonus-points', () => {
    it('Teamer vergibt Bonus -> 201', async () => {
      const res = await request(app)
        .post(`/api/admin/konfis/${USERS.konfi1.id}/bonus-points`)
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({
          points: 5,
          type: 'gottesdienst',
          description: 'Sonderpunkte Test',
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toContain('Bonuspunkte');

      // Punkte pruefen
      const after = await db.query(
        'SELECT gottesdienst_points FROM konfi_profiles WHERE user_id = $1',
        [USERS.konfi1.id]
      );
      expect(after.rows[0].gottesdienst_points).toBe(5);
    });

    it('Konfi bekommt 403 auf Bonus', async () => {
      const res = await request(app)
        .post(`/api/admin/konfis/${USERS.konfi1.id}/bonus-points`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({
          points: 5,
          type: 'gottesdienst',
          description: 'Test',
        });

      expect(res.status).toBe(403);
    });

    it('Fehlende Beschreibung gibt 400', async () => {
      const res = await request(app)
        .post(`/api/admin/konfis/${USERS.konfi1.id}/bonus-points`)
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({
          points: 5,
          type: 'gottesdienst',
        });

      expect(res.status).toBe(400);
    });
  });

  // ================================================================
  // DELETE /api/admin/konfis/:id/bonus-points/:bonusId
  // ================================================================
  describe('DELETE /api/admin/konfis/:id/bonus-points/:bonusId', () => {
    it('Admin loescht Bonus -> 200', async () => {
      // Erst Bonus-ID finden (seed hat einen Bonus fuer konfi1)
      const bonusRes = await db.query(
        'SELECT id FROM bonus_points WHERE konfi_id = $1',
        [USERS.konfi1.id]
      );
      const bonusId = bonusRes.rows[0].id;

      const res = await request(app)
        .delete(`/api/admin/konfis/${USERS.konfi1.id}/bonus-points/${bonusId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('gelöscht');
    });

    it('Nicht-existierende Bonus-ID gibt 404', async () => {
      const res = await request(app)
        .delete(`/api/admin/konfis/${USERS.konfi1.id}/bonus-points/99999`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // POST /api/admin/konfis/:id/activities
  // ================================================================
  describe('POST /api/admin/konfis/:id/activities', () => {
    it('Admin weist Activity zu -> 201', async () => {
      const res = await request(app)
        .post(`/api/admin/konfis/${USERS.konfi1.id}/activities`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          activity_id: ACTIVITIES.sonntagsgottesdienst.id,
          completed_date: '2026-03-28',
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toContain('Aktivität');

      // Punkte pruefen
      const after = await db.query(
        'SELECT gottesdienst_points FROM konfi_profiles WHERE user_id = $1',
        [USERS.konfi1.id]
      );
      expect(after.rows[0].gottesdienst_points).toBe(ACTIVITIES.sonntagsgottesdienst.gp);
    });

    it('Activity aus anderer Org gibt 404', async () => {
      const res = await request(app)
        .post(`/api/admin/konfis/${USERS.konfi1.id}/activities`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          activity_id: ACTIVITIES.gottesdienst2.id,
          completed_date: '2026-03-28',
        });

      expect(res.status).toBe(404);
    });

    it('Fehlende Activity-ID gibt 400', async () => {
      const res = await request(app)
        .post(`/api/admin/konfis/${USERS.konfi1.id}/activities`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          completed_date: '2026-03-28',
        });

      expect(res.status).toBe(400);
    });
  });

  // ================================================================
  // DELETE /api/admin/konfis/:id/activities/:activityId
  // ================================================================
  describe('DELETE /api/admin/konfis/:id/activities/:activityId', () => {
    it('Admin entfernt Activity -> 200', async () => {
      // Erst Activity zuweisen
      await request(app)
        .post(`/api/admin/konfis/${USERS.konfi1.id}/activities`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          activity_id: ACTIVITIES.sonntagsgottesdienst.id,
          completed_date: '2026-03-28',
        });

      // user_activities ID finden
      const actRes = await db.query(
        'SELECT id FROM user_activities WHERE user_id = $1 AND activity_id = $2',
        [USERS.konfi1.id, ACTIVITIES.sonntagsgottesdienst.id]
      );
      const userActivityId = actRes.rows[0].id;

      const res = await request(app)
        .delete(`/api/admin/konfis/${USERS.konfi1.id}/activities/${userActivityId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('gelöscht');
    });

    it('Nicht-existierende Activity-ID gibt 404', async () => {
      const res = await request(app)
        .delete(`/api/admin/konfis/${USERS.konfi1.id}/activities/99999`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // POST /api/admin/konfis/:id/regenerate-password
  // ================================================================
  describe('POST /api/admin/konfis/:id/regenerate-password', () => {
    it('Admin regeneriert Passwort -> 200', async () => {
      // password_plain Spalte in Test-Schema ergaenzen (existiert nur in Produktion)
      await db.query('ALTER TABLE konfi_profiles ADD COLUMN IF NOT EXISTS password_plain TEXT');

      const res = await request(app)
        .post(`/api/admin/konfis/${USERS.konfi1.id}/regenerate-password`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.temporaryPassword).toBeDefined();
      expect(res.body.message).toContain('Passwort');
    });

    it('Nicht-existierender Konfi gibt 404', async () => {
      await db.query('ALTER TABLE konfi_profiles ADD COLUMN IF NOT EXISTS password_plain TEXT');

      const res = await request(app)
        .post('/api/admin/konfis/99999/regenerate-password')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // GET /api/admin/konfis/:id/event-points
  // ================================================================
  describe('GET /api/admin/konfis/:id/event-points', () => {
    it('Teamer bekommt Event-Punkte -> 200', async () => {
      const res = await request(app)
        .get(`/api/admin/konfis/${USERS.konfi1.id}/event-points`)
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Konfi bekommt 403', async () => {
      const res = await request(app)
        .get(`/api/admin/konfis/${USERS.konfi1.id}/event-points`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // GET /api/admin/konfis/:id/attendance-stats
  // ================================================================
  describe('GET /api/admin/konfis/:id/attendance-stats', () => {
    it('Admin bekommt Anwesenheitsstatistik -> 200', async () => {
      const res = await request(app)
        .get(`/api/admin/konfis/${USERS.konfi1.id}/attendance-stats`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.total_mandatory).toBeDefined();
      expect(res.body.attended).toBeDefined();
      expect(res.body.percentage).toBeDefined();
      expect(res.body.missed_events).toBeDefined();
    });

    it('Nicht-existierender Konfi gibt 404', async () => {
      const res = await request(app)
        .get('/api/admin/konfis/99999/attendance-stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // POST /api/admin/konfis/:id/promote-teamer
  // ================================================================
  describe('POST /api/admin/konfis/:id/promote-teamer', () => {
    it('Admin befoerdert Konfi zum Teamer -> 200', async () => {
      // Neuen Konfi erstellen (ohne Chat-Teilnahme, da user_type-Constraint)
      const createRes = await request(app)
        .post('/api/admin/konfis')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Promote Test', jahrgang_id: JAHRGAENGE.jahrgang1.id });

      const newKonfiId = createRes.body.id;
      // Chat-Teilnahme entfernen (automatisch durch create angelegt)
      await db.query('DELETE FROM chat_participants WHERE user_id = $1', [newKonfiId]);

      const res = await request(app)
        .post(`/api/admin/konfis/${newKonfiId}/promote-teamer`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Teamer');
      expect(res.body.user.role_name).toBe('teamer');
    });

    it('Bereits Teamer gibt 400', async () => {
      // Teamer1 ist schon ein Teamer - Promote-Versuch sollte 400 geben
      const res = await request(app)
        .post(`/api/admin/konfis/${USERS.teamer1.id}/promote-teamer`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('Nicht-existierender User gibt 404', async () => {
      const res = await request(app)
        .post('/api/admin/konfis/99999/promote-teamer')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('Teamer bekommt 403 auf Promote', async () => {
      const res = await request(app)
        .post(`/api/admin/konfis/${USERS.konfi1.id}/promote-teamer`)
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(403);
    });

    it('Admin aus Org 2 kann Konfi aus Org 1 NICHT befoerdern -> 404', async () => {
      const res = await request(app)
        .post(`/api/admin/konfis/${USERS.konfi1.id}/promote-teamer`)
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(res.status).toBe(404);
    });
  });
});
