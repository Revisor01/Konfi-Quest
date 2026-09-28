// Teamer-Aktivitaet nur an Personen der eigenen Gemeinde (Audit 26.09.2026,
// Punkte/Termine BF-07)
//
// DER BEFUND: POST /admin/konfis/:id/activities prueft im Konfi-Zweig die
// Zielperson ueber darfKonfi (Gemeinde und Jahrgang). Fuer Aktivitaeten mit
// target_role 'teamer' gibt es keine Punkte und keinen Jahrgang -- deshalb
// wurde die Zielperson gar nicht geprueft. Eine Leitung der Gemeinde A konnte
// einer Teamer:in der Gemeinde B eine Zuordnung mit organization_id A
// anhaengen und einen Abzeichenlauf fuer die fremde Person ausloesen.
// Gemessen im Audit: teamer2 (Org 2) mit einer Teamer-Aktivitaet aus Org 1 ->
// 201. Das Gegenstueck assign-activity (activities.js) antwortet dort 404.
//
// DIE REGEL: Die Zielperson muss Mitglied der aktiven Gemeinde sein -- ueber
// BEIDE Quellen der Zugehoerigkeit (users.organization_id und
// user_organizations, utils/orgMitglieder.js). Eine Teamer:in, die in der
// Gemeinde nur ueber eine Zweitmitgliedschaft mitarbeitet, bekommt ihre
// Aktivitaet also weiterhin.

const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Teamer-Aktivitaet: Zielperson muss zur Gemeinde gehoeren', () => {
  let app;
  let db;
  let adminToken;
  let aktivitaetId;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    adminToken = generateToken('orgAdmin1');
    const { rows: [a] } = await db.query(
      `INSERT INTO activities (name, points, type, target_role, organization_id)
       VALUES ('Freizeit begleitet', 0, 'gemeinde', 'teamer', $1) RETURNING id`,
      [ORGS.testGemeinde.id]
    );
    aktivitaetId = a.id;
  });

  afterEach(async () => {
    await warteAufNachwehen(app);
  });

  const vergeben = (personId) => request(app)
    .post(`/api/admin/konfis/${personId}/activities`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ activity_id: aktivitaetId, completed_date: '2026-09-20', comment: 'Danke!' });

  const zuordnungen = async (personId) => {
    const { rows } = await db.query(
      'SELECT organization_id FROM user_activities WHERE user_id = $1 AND activity_id = $2',
      [personId, aktivitaetId]
    );
    return rows.map((r) => Number(r.organization_id));
  };

  it('VERBOTEN: Teamer:in einer fremden Gemeinde -> 404, nichts geschrieben', async () => {
    const res = await vergeben(USERS.teamer2.id);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Person nicht gefunden');
    expect(await zuordnungen(USERS.teamer2.id)).toEqual([]);
  });

  it('VERBOTEN: eine unbekannte ID -> 404', async () => {
    const res = await vergeben(999999);
    expect(res.status).toBe(404);
  });

  it('VERBOTEN: geloeschtes Konto der eigenen Gemeinde -> 404', async () => {
    await db.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [USERS.teamer1.id]);

    const res = await vergeben(USERS.teamer1.id);

    expect(res.status).toBe(404);
    expect(await zuordnungen(USERS.teamer1.id)).toEqual([]);
  });

  it('ERLAUBT: Teamer:in der eigenen Gemeinde -> 201', async () => {
    const res = await vergeben(USERS.teamer1.id);

    expect(res.status).toBe(201);
    expect(await zuordnungen(USERS.teamer1.id)).toEqual([ORGS.testGemeinde.id]);
  });

  it('ERLAUBT: Teamer:in mit Zweitmitgliedschaft in dieser Gemeinde -> 201', async () => {
    // teamer2 ist in Org 2 zuhause und arbeitet ueber user_organizations in
    // Org 1 als Teamer:in mit.
    await db.query(
      'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
      [USERS.teamer2.id, ORGS.testGemeinde.id, ROLES.teamer.id]
    );

    const res = await vergeben(USERS.teamer2.id);

    expect(res.status).toBe(201);
    expect(await zuordnungen(USERS.teamer2.id)).toEqual([ORGS.testGemeinde.id]);
  });
});
