const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, EVENTS, ACTIVITIES, JAHRGAENGE, ORGS, CHAT_ROOMS, BADGES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Konfi Routes', () => {
  let app;
  let db;
  let konfiToken;
  let adminToken;
  let konfi3Token;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    konfiToken = generateToken('konfi1');
    adminToken = generateToken('admin1');
    konfi3Token = generateToken('konfi3');
  });

  afterAll(async () => {
    await closePool();
  });

  // ================================================================
  // GET /api/konfi/dashboard
  // ================================================================
  describe('GET /api/konfi/dashboard', () => {
    it('Konfi bekommt 200 + Dashboard-Daten mit Aggregation', async () => {
      const res = await request(app)
        .get('/api/konfi/dashboard')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      // Konfi-Objekt mit Punkten
      expect(res.body.konfi).toBeDefined();
      expect(res.body.konfi.gottesdienst_points).toBeDefined();
      expect(res.body.konfi.gemeinde_points).toBeDefined();
      expect(res.body.konfi.display_name).toBe(USERS.konfi1.display_name);
      // Aggregierte Felder
      expect(res.body.total_points).toBeDefined();
      expect(typeof res.body.total_points).toBe('number');
      expect(res.body.level_info).toBeDefined();
      expect(res.body.level_info.current_level).toBeDefined();
      expect(res.body.level_info.all_levels).toBeDefined();
      expect(Array.isArray(res.body.level_info.all_levels)).toBe(true);
      expect(res.body.ranking).toBeDefined();
      expect(Array.isArray(res.body.ranking)).toBe(true);
      expect(res.body.badge_count).toBeDefined();
      expect(typeof res.body.badge_count).toBe('number');
      expect(res.body.event_count).toBeDefined();
      expect(typeof res.body.event_count).toBe('number');
      // Dashboard-Config
      expect(res.body.point_config).toBeDefined();
      expect(res.body.dashboard_config).toBeDefined();
    });

    it('Admin bekommt 403 (type !== konfi)', async () => {
      const res = await request(app)
        .get('/api/konfi/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBeDefined();
    });

    it('Ohne Token gibt 401', async () => {
      const res = await request(app)
        .get('/api/konfi/dashboard');

      expect(res.status).toBe(401);
    });
  });

  // ================================================================
  // GET /api/konfi/profile
  // ================================================================
  describe('GET /api/konfi/profile', () => {
    it('Konfi bekommt 200 + Profil-Daten mit Punkte-Info', async () => {
      const res = await request(app)
        .get('/api/konfi/profile')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.display_name).toBe(USERS.konfi1.display_name);
      expect(res.body.username).toBe(USERS.konfi1.username);
      expect(res.body.gottesdienst_points).toBeDefined();
      expect(res.body.gemeinde_points).toBeDefined();
      expect(res.body.jahrgang_name).toBeDefined();
    });

    it('Admin bekommt 403', async () => {
      const res = await request(app)
        .get('/api/konfi/profile')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // GET /api/konfi/points-history
  // ================================================================
  describe('GET /api/konfi/points-history', () => {
    it('Konfi bekommt 200 + History mit Totals', async () => {
      const res = await request(app)
        .get('/api/konfi/points-history')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.history).toBeDefined();
      expect(Array.isArray(res.body.history)).toBe(true);
      expect(res.body.totals).toBeDefined();
      expect(res.body.totals.gottesdienst).toBeDefined();
      expect(res.body.totals.gemeinde).toBeDefined();
      expect(res.body.totals.total).toBeDefined();
    });

    it('Konfi1 hat mindestens 1 Bonus-Eintrag aus Seed', async () => {
      const res = await request(app)
        .get('/api/konfi/points-history')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      // Seed hat bonus_points fuer konfi1 (3 Punkte Sonderpunkte Weihnachten)
      const bonusEntries = res.body.history.filter(h => h.source_type === 'bonus');
      expect(bonusEntries.length).toBeGreaterThanOrEqual(1);
      expect(bonusEntries[0].title).toBe('Sonderpunkte Weihnachten');
    });

    it('Admin bekommt 403', async () => {
      const res = await request(app)
        .get('/api/konfi/points-history')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // GET /api/konfi/activities
  // ================================================================
  describe('GET /api/konfi/activities', () => {
    it('Konfi bekommt 200 + Aktivitaeten der eigenen Org', async () => {
      const res = await request(app)
        .get('/api/konfi/activities')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Org 1 hat 4 Aktivitaeten
      expect(res.body.length).toBe(4);
      const names = res.body.map(a => a.name);
      expect(names).toContain('Sonntagsgottesdienst');
      expect(names).toContain('Gemeindefest');
    });

    it('Konfi3 (Org 2) sieht nur Org-2-Aktivitaeten', async () => {
      const res = await request(app)
        .get('/api/konfi/activities')
        .set('Authorization', `Bearer ${konfi3Token}`);

      expect(res.status).toBe(200);
      // Org 2 hat 2 Aktivitaeten
      expect(res.body.length).toBe(2);
    });
  });

  // ================================================================
  // GET /api/konfi/badges
  // ================================================================
  describe('GET /api/konfi/badges', () => {
    it('Konfi bekommt 200 + Badge-Liste', async () => {
      const res = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      // Response hat available/earned oder Array
      expect(res.body).toBeDefined();
    });

    it('Admin bekommt 403', async () => {
      const res = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // GET /api/konfi/events
  // ================================================================
  describe('GET /api/konfi/events', () => {
    it('Konfi bekommt 200 + Event-Liste (leer ohne Jahrgang-Assignments)', async () => {
      // Ohne event_jahrgang_assignments: INNER JOIN liefert keine Events
      const res = await request(app)
        .get('/api/konfi/events')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Konfi bekommt Events nach Jahrgang-Assignment', async () => {
      // event_jahrgang_assignments manuell setzen
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
        [EVENTS.gottesdienstEvent.id, JAHRGAENGE.jahrgang1.id]
      );

      const res = await request(app)
        .get('/api/konfi/events')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].name).toBe(EVENTS.gottesdienstEvent.name);
    });

    it('Konfi3 sieht keine Events aus Org 1', async () => {
      // Event von Org 1 dem Jahrgang 1 zuweisen
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
        [EVENTS.gottesdienstEvent.id, JAHRGAENGE.jahrgang1.id]
      );

      const res = await request(app)
        .get('/api/konfi/events')
        .set('Authorization', `Bearer ${konfi3Token}`);

      expect(res.status).toBe(200);
      // Konfi3 (Org 2, Jahrgang 2) sieht dieses Event nicht
      const eventNames = res.body.map(e => e.name);
      expect(eventNames).not.toContain(EVENTS.gottesdienstEvent.name);
    });
  });
});
