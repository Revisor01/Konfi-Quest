// backend/tests/routes/challengeUrheberZweitgemeinde.test.js
//
// Challenge-Urheber:innen aus beiden Quellen der Zugehoerigkeit, mit der
// Rolle DIESER Gemeinde (Simon, 08.10.2026; docs/planung/mehrfach-konten.md,
// Punkt 3).
//
// Bis dahin lasen GET /challenges/admin/authors und die Urheber-Pruefung in
// POST/PUT /challenges/admin nur users.organization_id: Eine Teamer:in aus A,
// die in B mitarbeitet, stand in B nicht zur Auswahl; ueber die Kennung
// gesetzt, antwortete B mit 400 "Urheber nicht gefunden".
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ROLES, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');

describe('Challenge-Urheber:innen aus einer weiteren Gemeinde', () => {
  let app;
  let db;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    invalidateUserCache();
    // teamer1: Stamm Org 1, in Org 2 als Teamer:in.
    await db.query(
      'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
      [USERS.teamer1.id, ORGS.andereGemeinde.id, ROLES.teamer2.id]
    );
  });

  const token = () => generateToken('orgAdmin2');
  const anlegen = (autor) => request(app)
    .post('/api/challenges/admin')
    .set('Authorization', `Bearer ${token()}`)
    .send({
      title: 'Urheber-Probe',
      description: 'Beschreibung der Urheber-Probe',
      badge_name: 'Testabzeichen',
      starts_at: new Date(Date.now() + 3600000).toISOString(),
      ends_at: new Date(Date.now() + 7 * 24 * 3600000).toISOString(),
      jahrgang_ids: [JAHRGAENGE.jahrgang2.id],
      author_user_id: autor,
    });
  const sortiert = (ids) => ids.map(Number).sort((a, b) => a - b);

  it('GET /admin/authors: die Teamer:in aus A steht in B mit der Rolle in B, Konfis aus A nicht', async () => {
    const res = await request(app)
      .get('/api/challenges/admin/authors')
      .set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(200);
    expect(sortiert(res.body.map((u) => u.id))).toEqual(sortiert([
      USERS.teamer1.id, USERS.konfi3.id, USERS.teamer2.id, USERS.admin2.id, USERS.orgAdmin2.id,
    ]));
    const gast = res.body.find((u) => Number(u.id) === USERS.teamer1.id);
    expect(gast).toEqual({ id: USERS.teamer1.id, display_name: USERS.teamer1.display_name, role_name: 'teamer' });
  });

  it('GET /admin/authors: in der Stamm-Gemeinde gilt die Rolle am Konto, auch mit abweichender Stamm-Zeile', async () => {
    await db.query(
      'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
      [USERS.admin1.id, ORGS.testGemeinde.id, ROLES.teamer.id]
    );
    const res = await request(app)
      .get('/api/challenges/admin/authors')
      .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
    expect(res.status).toBe(200);
    const admin = res.body.filter((u) => Number(u.id) === USERS.admin1.id);
    expect(admin).toEqual([{ id: USERS.admin1.id, display_name: USERS.admin1.display_name, role_name: 'admin' }]);
  });

  it('erlaubt: POST mit der Teamer:in aus A als Urheber:in -> 201', async () => {
    const res = await anlegen(USERS.teamer1.id);
    expect(res.status).toBe(201);
    const { rows: [c] } = await db.query('SELECT author_user_id, organization_id FROM challenges WHERE id = $1', [res.body.id]);
    expect(Number(c.author_user_id)).toBe(USERS.teamer1.id);
    expect(Number(c.organization_id)).toBe(ORGS.andereGemeinde.id);
  });

  it('verboten: POST mit einem Konto ohne Mitgliedschaft in B -> 400', async () => {
    const res = await anlegen(USERS.admin1.id);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Urheber nicht gefunden');
  });

  it('PUT: Konto ohne Mitgliedschaft verboten (400), Teamer:in aus A erlaubt (200)', async () => {
    const angelegt = await anlegen(null);
    expect(angelegt.status).toBe(201);
    const put = (autor) => request(app)
      .put(`/api/challenges/admin/${angelegt.body.id}`)
      .set('Authorization', `Bearer ${token()}`)
      .send({ author_user_id: autor });

    const fremd = await put(USERS.konfi1.id);
    expect(fremd.status).toBe(400);
    expect(fremd.body.error).toBe('Urheber nicht gefunden');

    const ok = await put(USERS.teamer1.id);
    expect(ok.status).toBe(200);
    const { rows: [c] } = await db.query('SELECT author_user_id FROM challenges WHERE id = $1', [angelegt.body.id]);
    expect(Number(c.author_user_id)).toBe(USERS.teamer1.id);
  });

  it('verboten: geloeschtes Konto als Urheber:in -> 400', async () => {
    await db.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [USERS.teamer2.id]);
    const res = await anlegen(USERS.teamer2.id);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Urheber nicht gefunden');
  });
});
