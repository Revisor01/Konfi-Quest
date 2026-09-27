// Eigener Rueckblick in der AKTIVEN Gemeinde
// (GET /api/wrapped/me, GET /api/wrapped/meine, has_wrapped im Teamer-Dashboard)
//
// BEFUND (Audit 26.09.2026, Chat BF-06): Die drei Stellen filterten allein
// `s.user_id = $1 AND s.wrapped_type = $2` -- ohne organization_id. Eine
// Teamer:in in zwei Gemeinden tippte in Gemeinde B auf "Dein Team-Jahr ist
// da" und sah die Zahlen von Gemeinde A, wenn deren Ausgabe juenger war.
// GET /history/:userId war seit dem 26.09. bereits auf die aktive Gemeinde
// begrenzt; /me, /meine und das Dashboard nicht.
//
// req.user.organization_id ist bereits die AKTIVE Gemeinde (rbac.js loest
// X-Active-Organization bzw. den Token-Claim gegen user_organizations auf).
// Eigene Daten bleiben es in jedem Fall -- falsch war nur die Zuordnung.

const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ROLES, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');

describe('Rueckblick der aktiven Gemeinde', () => {
  let app;
  let db;
  let teamer1Token;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  afterAll(async () => {
    await closePool();
  });

  /** Eine freigegebene Team-Ausgabe mit Snapshot fuer teamer1 in orgId. */
  async function rueckblickIn(orgId, { freigegebenVorTagen, jahr = 2025 }) {
    const { rows: [ausgabe] } = await db.query(
      `INSERT INTO wrapped_ausgaben
         (organization_id, wrapped_type, jahrgang_id, titel, zeitraum_start, zeitraum_ende, freigegeben_at)
       VALUES ($1, 'teamer', NULL, $2, $3::date, $4::date, NOW() - ($5 || ' days')::interval)
       RETURNING id`,
      [orgId, `Team-Rückblick ${jahr} Gemeinde ${orgId}`, `${jahr}-01-01`, `${jahr}-12-31`, String(freigegebenVorTagen)]
    );
    await db.query(
      `INSERT INTO wrapped_snapshots (user_id, organization_id, wrapped_type, year, ausgabe_id, data, computed_at)
       VALUES ($1, $2, 'teamer', $3, $4, $5, NOW())`,
      [USERS.teamer1.id, orgId, jahr, ausgabe.id, JSON.stringify({ gemeinde: orgId })]
    );
    return ausgabe.id;
  }

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    teamer1Token = generateToken('teamer1');

    // teamer1 (Stamm-Gemeinde Org 1) arbeitet zusaetzlich in Org 2 als Teamer:in.
    await db.query(
      `INSERT INTO user_organizations (user_id, organization_id, role_id)
       VALUES ($1, 2, $2)`,
      [USERS.teamer1.id, ROLES.teamer2.id]
    );
    invalidateUserCache(USERS.teamer1.id);
  });

  const inGemeinde = (req, orgId) => (orgId === ORGS.testGemeinde.id ? req : req.set('X-Active-Organization', String(orgId)));

  describe('GET /wrapped/me', () => {
    beforeEach(async () => {
      // Wie im Befund: Ausgabe der Stamm-Gemeinde ist JUENGER als die der
      // Zweitgemeinde -- ohne Org-Filter gewinnt sie ueberall.
      await rueckblickIn(ORGS.testGemeinde.id, { freigegebenVorTagen: 1 });
      await rueckblickIn(ORGS.andereGemeinde.id, { freigegebenVorTagen: 2 });
    });

    it('liefert in der Zweitgemeinde den Rueckblick DIESER Gemeinde', async () => {
      const res = await inGemeinde(
        request(app).get('/api/wrapped/me').set('Authorization', `Bearer ${teamer1Token}`),
        ORGS.andereGemeinde.id
      );

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ gemeinde: ORGS.andereGemeinde.id });
      // Additiv: die App kann erkennen, welchen Rueckblick sie zeigt.
      expect(res.body.organization_id).toBe(ORGS.andereGemeinde.id);
    });

    it('liefert in der Stamm-Gemeinde weiterhin deren Rueckblick', async () => {
      const res = await request(app)
        .get('/api/wrapped/me')
        .set('Authorization', `Bearer ${teamer1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ gemeinde: ORGS.testGemeinde.id });
      expect(res.body.organization_id).toBe(ORGS.testGemeinde.id);
      expect(res.body.wrapped_type).toBe('teamer');
    });

    it('ohne Rueckblick in der aktiven Gemeinde 404 -- nicht der einer anderen', async () => {
      await db.query('DELETE FROM wrapped_ausgaben WHERE organization_id = $1', [ORGS.andereGemeinde.id]);

      const res = await inGemeinde(
        request(app).get('/api/wrapped/me').set('Authorization', `Bearer ${teamer1Token}`),
        ORGS.andereGemeinde.id
      );

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Kein Wrapped-Snapshot vorhanden');
    });
  });

  describe('GET /wrapped/meine', () => {
    beforeEach(async () => {
      await rueckblickIn(ORGS.testGemeinde.id, { freigegebenVorTagen: 1, jahr: 2025 });
      await rueckblickIn(ORGS.testGemeinde.id, { freigegebenVorTagen: 400, jahr: 2024 });
      await rueckblickIn(ORGS.andereGemeinde.id, { freigegebenVorTagen: 2, jahr: 2025 });
    });

    it('listet in der Zweitgemeinde nur deren Rueckblicke, mit Gemeindeangabe', async () => {
      const res = await inGemeinde(
        request(app).get('/api/wrapped/meine').set('Authorization', `Bearer ${teamer1Token}`),
        ORGS.andereGemeinde.id
      );

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].year).toBe(2025);
      expect(res.body[0].organization_id).toBe(ORGS.andereGemeinde.id);
      expect(res.body[0].organization_name).toBe(ORGS.andereGemeinde.name);
    });

    it('listet in der Stamm-Gemeinde deren zwei Rueckblicke, nicht den der anderen', async () => {
      const res = await request(app)
        .get('/api/wrapped/meine')
        .set('Authorization', `Bearer ${teamer1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.map(r => r.year)).toEqual([2025, 2024]);
      expect(res.body.map(r => r.organization_id)).toEqual([ORGS.testGemeinde.id, ORGS.testGemeinde.id]);
      // Bestehende Felder bleiben (Antwortform ist Vertrag).
      expect(res.body[0]).toEqual(expect.objectContaining({
        snapshot_id: expect.any(Number),
        ausgabe_id: expect.any(Number),
        titel: 'Team-Rückblick 2025 Gemeinde 1',
        year: 2025
      }));
    });
  });

  describe('GET /teamer/dashboard has_wrapped', () => {
    it('ist in der Zweitgemeinde false, solange dort kein Rueckblick liegt', async () => {
      await rueckblickIn(ORGS.testGemeinde.id, { freigegebenVorTagen: 1 });

      const res = await inGemeinde(
        request(app).get('/api/teamer/dashboard').set('Authorization', `Bearer ${teamer1Token}`),
        ORGS.andereGemeinde.id
      );

      expect(res.status).toBe(200);
      expect(res.body.has_wrapped).toBe(false);
    });

    it('ist in der Zweitgemeinde true, sobald dort ein Rueckblick liegt', async () => {
      await rueckblickIn(ORGS.andereGemeinde.id, { freigegebenVorTagen: 1 });

      const res = await inGemeinde(
        request(app).get('/api/teamer/dashboard').set('Authorization', `Bearer ${teamer1Token}`),
        ORGS.andereGemeinde.id
      );

      expect(res.status).toBe(200);
      expect(res.body.has_wrapped).toBe(true);
    });

    it('ist in der Stamm-Gemeinde true wie bisher', async () => {
      await rueckblickIn(ORGS.testGemeinde.id, { freigegebenVorTagen: 1 });

      const res = await request(app)
        .get('/api/teamer/dashboard')
        .set('Authorization', `Bearer ${teamer1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.has_wrapped).toBe(true);
    });
  });
});
