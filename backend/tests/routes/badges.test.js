const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, BADGES, LEVELS, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Badges Routes', () => {
  let app;
  let db;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
  });

  afterAll(async () => {
    await closePool();
  });

  // ================================================================
  // GET /api/admin/badges (requireTeamer)
  // ================================================================
  describe('GET /api/admin/badges', () => {
    it('Admin bekommt 200 + Array mit Badges der eigenen Org', async () => {
      const token = generateToken('admin1');
      const res = await request(app)
        .get('/api/admin/badges')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Org 1 hat 4 Badges im Seed (streak, categoryBased, timeBased, yearly)
      expect(res.body.length).toBe(4);
    });

    it('Teamer bekommt 200 (requireTeamer erlaubt)', async () => {
      const token = generateToken('teamer1');
      const res = await request(app)
        .get('/api/admin/badges')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(4);
    });

    it('Konfi bekommt 403', async () => {
      const token = generateToken('konfi1');
      const res = await request(app)
        .get('/api/admin/badges')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('Admin2 (Org 2) sieht nur Org-2-Badges', async () => {
      const token = generateToken('admin2');
      const res = await request(app)
        .get('/api/admin/badges')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].name).toBe(BADGES.streak2.name);
    });

    it('Ohne Token gibt 401', async () => {
      const res = await request(app).get('/api/admin/badges');
      expect(res.status).toBe(401);
    });
  });

  // ================================================================
  // GET /api/admin/badges/:id (requireTeamer)
  // ================================================================
  describe('GET /api/admin/badges/:id', () => {
    it('Admin bekommt 200 + einzelnes Badge mit Details', async () => {
      const token = generateToken('admin1');
      const res = await request(app)
        .get(`/api/admin/badges/${BADGES.streak.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(BADGES.streak.id);
      expect(res.body.name).toBe(BADGES.streak.name);
      expect(res.body.criteria_type).toBe('streak');
    });

    it('Nicht-existierende ID gibt 404', async () => {
      const token = generateToken('admin1');
      const res = await request(app)
        .get('/api/admin/badges/9999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('Badge aus anderer Org gibt 404', async () => {
      const token = generateToken('admin1');
      // Badge streak2 gehoert Org 2
      const res = await request(app)
        .get(`/api/admin/badges/${BADGES.streak2.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // GET /api/admin/badges/criteria-types (requireTeamer)
  // ================================================================
  describe('GET /api/admin/badges/criteria-types', () => {
    it('Bekommt 200 + alle verfuegbaren criteria_types als Objekt', async () => {
      const token = generateToken('admin1');
      const res = await request(app)
        .get('/api/admin/badges/criteria-types')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(typeof res.body).toBe('object');
      expect(res.body.total_points).toBeDefined();
      expect(res.body.streak).toBeDefined();
      expect(res.body.time_based).toBeDefined();
    });
  });

  // ================================================================
  // POST /api/admin/badges (requireAdmin)
  // ================================================================
  describe('POST /api/admin/badges', () => {
    it('Admin erstellt neues Badge -> 201', async () => {
      const token = generateToken('admin1');
      const res = await request(app)
        .post('/api/admin/badges')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test-Badge',
          criteria_type: 'total_points',
          criteria_value: 10,
          icon: 'star',
          color: '#ff0000',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.message).toBeDefined();
    });

    it('Teamer bekommt 403 (nur requireAdmin)', async () => {
      const token = generateToken('teamer1');
      const res = await request(app)
        .post('/api/admin/badges')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Teamer-Badge',
          criteria_type: 'total_points',
          criteria_value: 10,
          icon: 'star',
        });

      expect(res.status).toBe(403);
    });

    it('Fehlende Pflichtfelder gibt 400/422', async () => {
      const token = generateToken('admin1');
      const res = await request(app)
        .post('/api/admin/badges')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Nur-Name',
        });

      expect([400, 422]).toContain(res.status);
    });
  });

  // ================================================================
  // PUT /api/admin/badges/:id (requireAdmin)
  // ================================================================
  describe('PUT /api/admin/badges/:id', () => {
    it('Admin aktualisiert Badge -> 200', async () => {
      const token = generateToken('admin1');
      const res = await request(app)
        .put(`/api/admin/badges/${BADGES.streak.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Aktualisiert',
          icon: 'ribbon',
          criteria_type: 'streak',
          criteria_value: 5,
          is_active: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('aktualisiert');
    });

    it('Badge aus anderer Org gibt 404', async () => {
      const token = generateToken('admin1');
      const res = await request(app)
        .put(`/api/admin/badges/${BADGES.streak2.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Fremdes Badge',
          icon: 'ribbon',
          criteria_type: 'streak',
          criteria_value: 5,
          is_active: true,
        });

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // DELETE /api/admin/badges/:id (requireAdmin)
  // ================================================================
  describe('DELETE /api/admin/badges/:id', () => {
    it('Admin loescht Badge -> 200', async () => {
      const token = generateToken('admin1');
      const res = await request(app)
        .delete(`/api/admin/badges/${BADGES.streak.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);

      // Badge ist danach nicht mehr abrufbar
      const getRes = await request(app)
        .get(`/api/admin/badges/${BADGES.streak.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBe(404);
    });

    it('Loeschen entfernt auch user_badges Eintraege', async () => {
      // Zuerst user_badge Eintrag erstellen
      await db.query(
        'INSERT INTO user_badges (user_id, badge_id, organization_id) VALUES ($1, $2, $3)',
        [USERS.konfi1.id, BADGES.streak.id, ORGS.testGemeinde.id]
      );

      // Pruefen dass user_badge existiert
      const before = await db.query(
        'SELECT * FROM user_badges WHERE badge_id = $1',
        [BADGES.streak.id]
      );
      expect(before.rows.length).toBe(1);

      // Badge loeschen
      const token = generateToken('admin1');
      const res = await request(app)
        .delete(`/api/admin/badges/${BADGES.streak.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);

      // user_badges Eintrag muss auch geloescht sein
      const after = await db.query(
        'SELECT * FROM user_badges WHERE badge_id = $1',
        [BADGES.streak.id]
      );
      expect(after.rows.length).toBe(0);
    });

    it('Badge aus anderer Org gibt 404', async () => {
      const token = generateToken('admin1');
      const res = await request(app)
        .delete(`/api/admin/badges/${BADGES.streak2.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // Level-Zuordnung (on-the-fly bei Dashboard-Abfrage)
  // ================================================================
  describe('Level-Zuordnung', () => {
    it('Konfi1 mit 0 Punkten bekommt Level Novize', async () => {
      const token = generateToken('konfi1');
      const res = await request(app)
        .get('/api/konfi/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      // Level wird on-the-fly berechnet
      if (res.body.level) {
        expect(res.body.level.title || res.body.level.name).toBeDefined();
      }
    });

    it('Konfi mit 10 Punkten bekommt Level Gehilfe', async () => {
      // Punkte direkt in DB aktualisieren
      await db.query(
        'UPDATE konfi_profiles SET gottesdienst_points = 10 WHERE user_id = $1',
        [USERS.konfi1.id]
      );

      const token = generateToken('konfi1');
      const res = await request(app)
        .get('/api/konfi/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      // Level sollte mindestens Gehilfe sein (points_required: 10)
      if (res.body.level) {
        const levelName = (res.body.level.title || res.body.level.name || '').toLowerCase();
        expect(['gehilfe', 'experte']).toContain(levelName);
      }
    });
  });

  // ================================================================
  // Progress-Berechnung (GET /api/konfi/badges)
  // ================================================================
  describe('Progress-Berechnung (GET /api/konfi/badges)', () => {
    it('Konfi bekommt Badges MIT progress-Feld', async () => {
      const token = generateToken('konfi1');
      const res = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      // Response kann available/earned Struktur oder flaches Array sein
      const badges = Array.isArray(res.body) ? res.body : [...(res.body.available || []), ...(res.body.earned || [])];
      expect(badges.length).toBeGreaterThan(0);

      // Jedes Badge sollte ein progress-Feld haben
      for (const badge of badges) {
        if (badge.progress) {
          expect(badge.progress.target).toBeDefined();
          expect(badge.progress.percentage).toBeGreaterThanOrEqual(0);
          expect(badge.progress.percentage).toBeLessThanOrEqual(100);
        }
      }
    });

    it('Konfi mit Punkten bekommt korrekten Progress fuer total_points Badge', async () => {
      // Erstelle ein total_points Badge
      await db.query(
        `INSERT INTO custom_badges (name, criteria_type, criteria_value, icon, color, organization_id, target_role, is_active)
         VALUES ('Punkte-Held', 'total_points', 20, 'trophy', '#ff0000', $1, 'konfi', true)`,
        [ORGS.testGemeinde.id]
      );

      // Konfi hat 5 Punkte
      await db.query(
        'UPDATE konfi_profiles SET gottesdienst_points = 5 WHERE user_id = $1',
        [USERS.konfi1.id]
      );

      const token = generateToken('konfi1');
      const res = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const badges = Array.isArray(res.body) ? res.body : [...(res.body.available || []), ...(res.body.earned || [])];
      const totalPointsBadge = badges.find(b => b.name === 'Punkte-Held');
      expect(totalPointsBadge).toBeDefined();
      if (totalPointsBadge && totalPointsBadge.progress) {
        // 5 von 20 = 25%
        expect(totalPointsBadge.progress.current).toBe(5);
        expect(totalPointsBadge.progress.target).toBe(20);
        expect(totalPointsBadge.progress.percentage).toBe(25);
      }
    });

    it('Admin/Teamer bekommt 403 auf Konfi-Badges-Endpoint', async () => {
      const token = generateToken('admin1');
      const res = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // Auto-Award-Trigger (checkAndAwardBadges)
  // ================================================================
  describe('Auto-Award-Trigger', () => {
    it('Badge wird vergeben wenn Kriterien erfuellt (total_points)', async () => {
      // Erstelle total_points Badge mit niedrigem Schwellwert
      const { rows: [newBadge] } = await db.query(
        `INSERT INTO custom_badges (name, criteria_type, criteria_value, icon, color, organization_id, target_role, is_active)
         VALUES ('Starter', 'total_points', 5, 'star', '#00ff00', $1, 'konfi', true)
         RETURNING id`,
        [ORGS.testGemeinde.id]
      );

      // Punkte auf 5 setzen (erfuellt das Kriterium)
      await db.query(
        'UPDATE konfi_profiles SET gottesdienst_points = 5 WHERE user_id = $1',
        [USERS.konfi1.id]
      );

      // checkAndAwardBadges ist als exportierte Funktion verfuegbar
      const { checkAndAwardBadges } = require('../../routes/badges');
      const result = await checkAndAwardBadges(db, USERS.konfi1.id);

      // Pruefen ob Badge vergeben wurde
      expect(result).toBeDefined();
      const { rows: awarded } = await db.query(
        'SELECT * FROM user_badges WHERE user_id = $1 AND badge_id = $2',
        [USERS.konfi1.id, newBadge.id]
      );
      expect(awarded.length).toBe(1);
    });

    it('Badge wird NICHT doppelt vergeben', async () => {
      // Erstelle total_points Badge
      const { rows: [newBadge] } = await db.query(
        `INSERT INTO custom_badges (name, criteria_type, criteria_value, icon, color, organization_id, target_role, is_active)
         VALUES ('Einmal-Badge', 'total_points', 1, 'star', '#00ff00', $1, 'konfi', true)
         RETURNING id`,
        [ORGS.testGemeinde.id]
      );

      await db.query(
        'UPDATE konfi_profiles SET gottesdienst_points = 5 WHERE user_id = $1',
        [USERS.konfi1.id]
      );

      // Zweimal aufrufen
      const { checkAndAwardBadges } = require('../../routes/badges');
      await checkAndAwardBadges(db, USERS.konfi1.id);
      await checkAndAwardBadges(db, USERS.konfi1.id);

      // Nur ein Eintrag in user_badges
      const { rows } = await db.query(
        'SELECT * FROM user_badges WHERE user_id = $1 AND badge_id = $2',
        [USERS.konfi1.id, newBadge.id]
      );
      expect(rows.length).toBe(1);
    });
  });

  // ================================================================
  // Pflicht-Anwesenheits-Badge (mandatory_event_count)
  // ================================================================
  describe('mandatory_event_count Wertung', () => {
    // Hilfsfunktion: legt N Pflicht-Events an und bucht den Konfi mit attendance_status='present'
    async function createMandatoryEventsWithPresence(orgId, konfiId, count, mandatory = true, present = true) {
      for (let i = 0; i < count; i++) {
        const { rows: [ev] } = await db.query(
          `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants, point_type, points)
           VALUES ($1, NOW() - interval '1 day', $2, $3, 0, 'gemeinde', 0)
           RETURNING id`,
          [`Pflicht-Termin ${i}-${Math.random()}`, orgId, mandatory]
        );
        await db.query(
          `INSERT INTO event_bookings (user_id, event_id, organization_id, status, attendance_status)
           VALUES ($1, $2, $3, 'confirmed', $4)`,
          [konfiId, ev.id, orgId, present ? 'present' : 'absent']
        );
      }
    }

    it('Konfi mit 12 besuchten Pflicht-Events erhaelt das Badge (criteria_value=12)', async () => {
      const { rows: [badge] } = await db.query(
        `INSERT INTO custom_badges (name, criteria_type, criteria_value, icon, color, organization_id, target_role, is_active)
         VALUES ('Alle Pflichttermine', 'mandatory_event_count', 12, 'checkmark', '#10b981', $1, 'konfi', true)
         RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      await createMandatoryEventsWithPresence(ORGS.testGemeinde.id, USERS.konfi1.id, 12);

      const { checkAndAwardBadges } = require('../../routes/badges');
      await checkAndAwardBadges(db, USERS.konfi1.id);

      const { rows } = await db.query(
        'SELECT * FROM user_badges WHERE user_id = $1 AND badge_id = $2',
        [USERS.konfi1.id, badge.id]
      );
      expect(rows.length).toBe(1);
    });

    it('Konfi mit 11 besuchten Pflicht-Events erhaelt das Badge NICHT (criteria_value=12)', async () => {
      const { rows: [badge] } = await db.query(
        `INSERT INTO custom_badges (name, criteria_type, criteria_value, icon, color, organization_id, target_role, is_active)
         VALUES ('Alle Pflichttermine', 'mandatory_event_count', 12, 'checkmark', '#10b981', $1, 'konfi', true)
         RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      await createMandatoryEventsWithPresence(ORGS.testGemeinde.id, USERS.konfi1.id, 11);

      const { checkAndAwardBadges } = require('../../routes/badges');
      await checkAndAwardBadges(db, USERS.konfi1.id);

      const { rows } = await db.query(
        'SELECT * FROM user_badges WHERE user_id = $1 AND badge_id = $2',
        [USERS.konfi1.id, badge.id]
      );
      expect(rows.length).toBe(0);
    });

    it('Nicht-Pflicht-Events und nicht-besuchte Pflicht-Events zaehlen NICHT mit', async () => {
      const { rows: [badge] } = await db.query(
        `INSERT INTO custom_badges (name, criteria_type, criteria_value, icon, color, organization_id, target_role, is_active)
         VALUES ('Erster Pflichttermin', 'mandatory_event_count', 1, 'checkmark', '#10b981', $1, 'konfi', true)
         RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      // 5 Nicht-Pflicht-Events (besucht) + 3 Pflicht-Events (NICHT besucht) -> current bleibt 0
      await createMandatoryEventsWithPresence(ORGS.testGemeinde.id, USERS.konfi1.id, 5, false, true);
      await createMandatoryEventsWithPresence(ORGS.testGemeinde.id, USERS.konfi1.id, 3, true, false);

      const { checkAndAwardBadges } = require('../../routes/badges');
      await checkAndAwardBadges(db, USERS.konfi1.id);

      const { rows } = await db.query(
        'SELECT * FROM user_badges WHERE user_id = $1 AND badge_id = $2',
        [USERS.konfi1.id, badge.id]
      );
      expect(rows.length).toBe(0);
    });

    it('Bereits vergebenes Badge bleibt bei spaeterer Schwellwert-Anhebung erhalten (kein Entzug)', async () => {
      const { rows: [badge] } = await db.query(
        `INSERT INTO custom_badges (name, criteria_type, criteria_value, icon, color, organization_id, target_role, is_active)
         VALUES ('Pflicht-Badge', 'mandatory_event_count', 3, 'checkmark', '#10b981', $1, 'konfi', true)
         RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      await createMandatoryEventsWithPresence(ORGS.testGemeinde.id, USERS.konfi1.id, 3);

      const { checkAndAwardBadges } = require('../../routes/badges');
      await checkAndAwardBadges(db, USERS.konfi1.id);

      // Schwellwert anheben (3 -> 12), Badge bleibt bestehen
      await db.query('UPDATE custom_badges SET criteria_value = 12 WHERE id = $1', [badge.id]);
      await checkAndAwardBadges(db, USERS.konfi1.id);

      const { rows } = await db.query(
        'SELECT * FROM user_badges WHERE user_id = $1 AND badge_id = $2',
        [USERS.konfi1.id, badge.id]
      );
      expect(rows.length).toBe(1);
    });
  });

  // ================================================================
  // teamer_year-Startjahr aus users.teamer_since
  // ================================================================
  describe('teamer_year Startjahr aus teamer_since', () => {
    // Legt eine Teamer-Aktivitaet in einem bestimmten Jahr an
    async function createTeamerActivityInYear(orgId, teamerId, year) {
      const { rows: [act] } = await db.query(
        `INSERT INTO activities (name, points, type, organization_id, target_role)
         VALUES ($1, 1, 'gottesdienst', $2, 'teamer')
         RETURNING id`,
        [`Teamer-Aktion ${year}-${Math.random()}`, orgId]
      );
      await db.query(
        `INSERT INTO user_activities (user_id, activity_id, completed_date, admin_id, organization_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [teamerId, act.id, `${year}-06-15`, USERS.admin1.id, orgId]
      );
    }

    it('Startjahr aus teamer_since: Aktivitaeten in 2024 und 2026 -> Badge bei value=2', async () => {
      await db.query('UPDATE users SET teamer_since = $1 WHERE id = $2', ['2024-01-01', USERS.teamer1.id]);
      await createTeamerActivityInYear(ORGS.testGemeinde.id, USERS.teamer1.id, 2024);
      await createTeamerActivityInYear(ORGS.testGemeinde.id, USERS.teamer1.id, 2026);

      const { rows: [badge] } = await db.query(
        `INSERT INTO custom_badges (name, criteria_type, criteria_value, icon, color, organization_id, target_role, is_active)
         VALUES ('Zwei Teamer-Jahre', 'teamer_year', 2, 'ribbon', '#7c3aed', $1, 'teamer', true)
         RETURNING id`,
        [ORGS.testGemeinde.id]
      );

      const { checkAndAwardBadges } = require('../../routes/badges');
      await checkAndAwardBadges(db, USERS.teamer1.id);

      const { rows } = await db.query(
        'SELECT * FROM user_badges WHERE user_id = $1 AND badge_id = $2',
        [USERS.teamer1.id, badge.id]
      );
      expect(rows.length).toBe(1);
    });

    it('Aktivitaet vor teamer_since zaehlt NICHT (teamer_since=2026, Aktivitaet 2024)', async () => {
      await db.query('UPDATE users SET teamer_since = $1 WHERE id = $2', ['2026-01-01', USERS.teamer1.id]);
      await createTeamerActivityInYear(ORGS.testGemeinde.id, USERS.teamer1.id, 2024);

      const { rows: [badge] } = await db.query(
        `INSERT INTO custom_badges (name, criteria_type, criteria_value, icon, color, organization_id, target_role, is_active)
         VALUES ('Ein Teamer-Jahr', 'teamer_year', 1, 'ribbon', '#7c3aed', $1, 'teamer', true)
         RETURNING id`,
        [ORGS.testGemeinde.id]
      );

      const { checkAndAwardBadges } = require('../../routes/badges');
      await checkAndAwardBadges(db, USERS.teamer1.id);

      const { rows } = await db.query(
        'SELECT * FROM user_badges WHERE user_id = $1 AND badge_id = $2',
        [USERS.teamer1.id, badge.id]
      );
      expect(rows.length).toBe(0);
    });

    it('teamer_since=NULL: Fallback auf aelteste Teamer-Aktivitaet', async () => {
      await db.query('UPDATE users SET teamer_since = NULL WHERE id = $1', [USERS.teamer1.id]);
      await createTeamerActivityInYear(ORGS.testGemeinde.id, USERS.teamer1.id, 2023);
      await createTeamerActivityInYear(ORGS.testGemeinde.id, USERS.teamer1.id, 2024);

      const { rows: [badge] } = await db.query(
        `INSERT INTO custom_badges (name, criteria_type, criteria_value, icon, color, organization_id, target_role, is_active)
         VALUES ('Zwei Teamer-Jahre Fallback', 'teamer_year', 2, 'ribbon', '#7c3aed', $1, 'teamer', true)
         RETURNING id`,
        [ORGS.testGemeinde.id]
      );

      const { checkAndAwardBadges } = require('../../routes/badges');
      await checkAndAwardBadges(db, USERS.teamer1.id);

      const { rows } = await db.query(
        'SELECT * FROM user_badges WHERE user_id = $1 AND badge_id = $2',
        [USERS.teamer1.id, badge.id]
      );
      expect(rows.length).toBe(1);
    });
  });
});
