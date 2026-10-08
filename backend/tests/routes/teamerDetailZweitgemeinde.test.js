// backend/tests/routes/teamerDetailZweitgemeinde.test.js
//
// GET /api/admin/konfis/:id fuer eine Teamer:in aus einer anderen Gemeinde
// (Simon, 08.10.2026; docs/planung/mehrfach-konten.md, Punkt 4): Die Leitung
// von B sieht Rolle und Daten in B -- nichts aus A. Weder Konfi-Zeit,
// Zertifikate und Termine aus A noch die Kennungen der Stamm-Gemeinde
// (organization_id, role_id). Die Antwortform bleibt: dieselben Felder,
// dieselben Typen.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ROLES, ORGS, EVENTS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');

const ORG_C = 3;
const ROLLE_C = 301;

describe('GET /api/admin/konfis/:id: Teamer:in aus einer anderen Gemeinde', () => {
  let app;
  let db;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    invalidateUserCache();
    // teamer1: Stamm Org 1 (A), dort ehemalige Konfi mit Punkten, Zertifikat
    // und Termin; in Org 2 (B) Teamer:in.
    await db.query(
      'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
      [USERS.teamer1.id, ORGS.andereGemeinde.id, ROLES.teamer2.id]
    );
    await db.query(
      `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
       VALUES ($1, $2, 7, 3, $3)`,
      [USERS.teamer1.id, JAHRGAENGE.jahrgang1.id, ORGS.testGemeinde.id]
    );
    const { rows: [ct] } = await db.query(
      "INSERT INTO certificate_types (name, organization_id) VALUES ('Juleica A', $1) RETURNING id",
      [ORGS.testGemeinde.id]
    );
    await db.query(
      "INSERT INTO user_certificates (user_id, certificate_type_id, organization_id, issued_date) VALUES ($1, $2, $3, '2026-01-01')",
      [USERS.teamer1.id, ct.id, ORGS.testGemeinde.id]
    );
    for (const [eventId, orgId] of [[EVENTS.gottesdienstEvent.id, ORGS.testGemeinde.id], [EVENTS.event2.id, ORGS.andereGemeinde.id]]) {
      await db.query(
        "INSERT INTO event_bookings (event_id, user_id, status, organization_id) VALUES ($1, $2, 'confirmed', $3)",
        [eventId, USERS.teamer1.id, orgId]
      );
    }
    // Gemeinde C: orgAdmin1 leitet sie zusaetzlich.
    await db.query(
      "INSERT INTO organizations (id, name, slug, display_name) VALUES ($1, 'Gemeinde C', 'gemeinde-c', 'Gemeinde C')",
      [ORG_C]
    );
    await db.query(
      "INSERT INTO roles (id, organization_id, name, display_name) VALUES ($1, $2, 'org_admin', 'Org-Admin')",
      [ROLLE_C, ORG_C]
    );
    await db.query(
      'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
      [USERS.orgAdmin1.id, ORG_C, ROLLE_C]
    );
  });

  it('erlaubt: Leitung B bekommt 200 mit Rolle und Daten in B, nichts aus A', async () => {
    const res = await request(app)
      .get(`/api/admin/konfis/${USERS.teamer1.id}`)
      .set('Authorization', `Bearer ${generateToken('orgAdmin2')}`);
    expect(res.status).toBe(200);
    expect(res.body.role_name).toBe('teamer');
    // Kennungen der Gemeinde B, als Zahl wie bisher.
    expect(res.body.organization_id).toBe(ORGS.andereGemeinde.id);
    expect(res.body.role_id).toBe(ROLES.teamer2.id);
    // Konfi-Zeit, Zertifikat und Termin aus A fehlen.
    expect(res.body.gottesdienst_points).toBe(null);
    expect(res.body.jahrgang_id).toBe(null);
    expect(res.body.konfiHistory).toBe(null);
    expect(res.body.certificates).toEqual([]);
    expect(res.body.teamerEvents.map((e) => Number(e.id))).toEqual([EVENTS.event2.id]);
  });

  it('Stamm-Gemeinde: Leitung A bekommt die Rolle und Kennungen von A samt Konfi-Zeit', async () => {
    const res = await request(app)
      .get(`/api/admin/konfis/${USERS.teamer1.id}`)
      .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
    expect(res.status).toBe(200);
    expect(res.body.role_name).toBe('teamer');
    expect(res.body.organization_id).toBe(ORGS.testGemeinde.id);
    expect(res.body.role_id).toBe(ROLES.teamer.id);
    expect(res.body.konfiHistory.totals).toEqual({ gottesdienst: 7, gemeinde: 3, total: 10 });
    expect(res.body.certificates).toHaveLength(1);
    expect(res.body.teamerEvents.map((e) => Number(e.id))).toEqual([EVENTS.gottesdienstEvent.id]);
  });

  it('verboten: Leitung einer dritten Gemeinde C bekommt 404', async () => {
    const res = await request(app)
      .get(`/api/admin/konfis/${USERS.teamer1.id}`)
      .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`)
      .set('X-Active-Organization', String(ORG_C));
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Benutzer nicht gefunden' });
  });
});
