const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Settings Routes', () => {
  let app;
  let db;
  let orgAdminToken;
  let adminToken;
  let teamerToken;
  let konfiToken;
  let orgAdmin2Token;

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
  });

  afterAll(async () => {
    await closePool();
  });

  // ================================================================
  // GET /api/settings
  // ================================================================
  describe('GET /api/settings', () => {
    it('Jeder authentifizierte User bekommt 200 + Settings-Objekt', async () => {
      const res = await request(app)
        .get('/api/settings')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(typeof res.body).toBe('object');
    });

    it('Ohne Token -> 401', async () => {
      const res = await request(app).get('/api/settings');
      expect(res.status).toBe(401);
    });

    it('Settings enthaelt gespeicherte Werte', async () => {
      // Setting speichern
      await db.query(
        `INSERT INTO settings (organization_id, key, value) VALUES ($1, 'max_waitlist_size', '50')
         ON CONFLICT (organization_id, key) DO UPDATE SET value = EXCLUDED.value`,
        [ORGS.testGemeinde.id]
      );

      const res = await request(app)
        .get('/api/settings')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.max_waitlist_size).toBe(50); // Wird als Integer geparsed
    });
  });

  // ================================================================
  // PUT /api/settings
  // ================================================================
  describe('PUT /api/settings', () => {
    it('OrgAdmin aktualisiert Settings -> 200', async () => {
      const res = await request(app)
        .put('/api/settings')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({
          max_waitlist_size: 25,
          dashboard_show_events: true,
          dashboard_show_badges: false
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('aktualisiert');

      // Verifizieren
      const getRes = await request(app)
        .get('/api/settings')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(getRes.body.max_waitlist_size).toBe(25);
      expect(getRes.body.dashboard_show_events).toBe(true);
      expect(getRes.body.dashboard_show_badges).toBe(false);
    });

    it('Admin bekommt 403 (nur org_admin erlaubt)', async () => {
      const res = await request(app)
        .put('/api/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ max_waitlist_size: 10 });

      expect(res.status).toBe(403);
    });

    it('Teamer bekommt 403', async () => {
      const res = await request(app)
        .put('/api/settings')
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({ max_waitlist_size: 10 });

      expect(res.status).toBe(403);
    });

    it('Konfi bekommt 403', async () => {
      const res = await request(app)
        .put('/api/settings')
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ max_waitlist_size: 10 });

      expect(res.status).toBe(403);
    });

    it('Ungueltiger konfi_chat_permissions Wert -> 400', async () => {
      const res = await request(app)
        .put('/api/settings')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ konfi_chat_permissions: 'invalid_value' });

      expect(res.status).toBe(400);
    });

    it('Dashboard section_order als JSON speichern', async () => {
      const order = JSON.stringify(['events', 'badges', 'ranking', 'konfirmation', 'losung']);
      const res = await request(app)
        .put('/api/settings')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ dashboard_section_order: order });

      expect(res.status).toBe(200);

      const getRes = await request(app)
        .get('/api/settings')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(Array.isArray(getRes.body.dashboard_section_order)).toBe(true);
      expect(getRes.body.dashboard_section_order[0]).toBe('events');
    });
  });

  // ================================================================
  // Org-Isolation
  // ================================================================
  describe('Org-Isolation: Settings pro Organisation getrennt', () => {
    it('OrgAdmin1 und OrgAdmin2 haben getrennte Settings', async () => {
      // Org 1: Settings setzen
      await request(app)
        .put('/api/settings')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ max_waitlist_size: 100 });

      // Org 2: Settings setzen
      await request(app)
        .put('/api/settings')
        .set('Authorization', `Bearer ${orgAdmin2Token}`)
        .send({ max_waitlist_size: 50 });

      // Org 1 lesen
      const res1 = await request(app)
        .get('/api/settings')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      // Org 2 lesen
      const res2 = await request(app)
        .get('/api/settings')
        .set('Authorization', `Bearer ${orgAdmin2Token}`);

      expect(res1.body.max_waitlist_size).toBe(100);
      expect(res2.body.max_waitlist_size).toBe(50);
    });
  });
});
