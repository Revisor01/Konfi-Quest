// backend/tests/routes/punktartAmBeleg.test.js
//
// Punktart am Beleg (offene Befunde, Punkte/Termine BF-02, Rest): Seit
// Migration 163 traegt jede Zuordnung (user_activities) den Punktwert der
// Vergabe, die Art (Gottesdienst/Gemeinde) aber nicht. Aenderte die Leitung
// die Art einer Aktivitaet, landeten Ruecknahme, Detailliste und Historie in
// der anderen Saeule: Die Summe stimmte, die Verteilung nicht -- und die
// Ruecknahme zog von der Saeule ab, auf die nie etwas gebucht wurde.
//
// Seit Migration 200 traegt jede Zuordnung auch ihre Art (user_activities.type).
// Die Art einer Aktivitaet gilt fuer kuenftige Vergaben; was schon gebucht
// ist, bleibt in seiner Saeule. Bestand ohne Art (NULL) liest wie vorher die
// Art der Aktivitaet.
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ACTIVITIES, JAHRGAENGE, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Punktart am Beleg', () => {
  let app;
  let db;
  let adminToken;
  let konfiToken;

  const KONFI = USERS.konfi1.id;
  const ORG = ORGS.testGemeinde.id;
  const AKTIVITAET = ACTIVITIES.sonntagsgottesdienst.id;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    adminToken = generateToken('admin1');
    konfiToken = generateToken('konfi1');
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
    );
    const { invalidateUserCache } = require('../../middleware/rbac');
    invalidateUserCache(USERS.admin1.id);
    // Beide Saeulen mit Stand, damit ein falscher Abzug sichtbar wird und
    // nicht an GREATEST(0, ...) haengen bleibt.
    await db.query('UPDATE konfi_profiles SET gottesdienst_points = 0, gemeinde_points = 10 WHERE user_id = $1', [KONFI]);
  });

  afterAll(async () => {
    await closePool();
  });

  // ---------------------------------------------------------------- Helfer

  const artSetzen = async (type) => {
    const res = await request(app)
      .put(`/api/admin/activities/${AKTIVITAET}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Sonntagsgottesdienst', points: 4, type });
    expect(res.status).toBe(200);
  };

  const saeulen = async () => {
    const { rows: [p] } = await db.query(
      'SELECT gottesdienst_points, gemeinde_points FROM konfi_profiles WHERE user_id = $1', [KONFI]
    );
    return p;
  };

  const direktZuschreiben = async (completed_date) => {
    const res = await request(app)
      .post(`/api/admin/konfis/${KONFI}/activities`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ activity_id: AKTIVITAET, completed_date, comment: '' });
    expect(res.status).toBe(201);
    await warteAufNachwehen(app);
  };

  const zuweisen = async (completed_date) => {
    const res = await request(app)
      .post('/api/admin/activities/assign-activity')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ konfiId: KONFI, activityId: AKTIVITAET, completed_date });
    expect(res.status).toBe(200);
    await warteAufNachwehen(app);
  };

  const antragGenehmigen = async (requested_date) => {
    const { rows: [r] } = await db.query(
      `INSERT INTO activity_requests (user_id, activity_id, status, organization_id, requested_date)
       VALUES ($1, $2, 'pending', $3, $4) RETURNING id`,
      [KONFI, AKTIVITAET, ORG, requested_date]
    );
    const res = await request(app)
      .put(`/api/admin/activities/requests/${r.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' });
    expect(res.status).toBe(200);
    await warteAufNachwehen(app);
    return r.id;
  };

  const belege = async () => (await db.query(
    'SELECT id, type FROM user_activities WHERE user_id = $1 ORDER BY completed_date, id', [KONFI]
  )).rows;

  // ---------------------------------------------------------------- Tests

  it('die Vergabe speichert die Art der Aktivität — auf allen drei Wegen', async () => {
    await artSetzen('gottesdienst');
    await direktZuschreiben('2026-03-01');
    await artSetzen('gemeinde');
    await zuweisen('2026-03-02');
    await artSetzen('gottesdienst');
    await antragGenehmigen('2026-03-03');

    expect((await belege()).map((b) => b.type)).toEqual(['gottesdienst', 'gemeinde', 'gottesdienst']);
    expect(await saeulen()).toEqual({ gottesdienst_points: 8, gemeinde_points: 14 });
  });

  it('nach einer Änderung der Art bleiben Detailliste und Historie in der Säule der Vergabe', async () => {
    await artSetzen('gottesdienst');
    await direktZuschreiben('2026-03-01');
    await artSetzen('gemeinde');

    const detail = await request(app)
      .get(`/api/admin/konfis/${KONFI}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.activities.map((a) => a.type)).toEqual(['gottesdienst']);

    const historie = await request(app)
      .get('/api/konfi/points-history')
      .set('Authorization', `Bearer ${konfiToken}`);
    expect(historie.status).toBe(200);
    const aktivitaeten = historie.body.history.filter((e) => e.source_type === 'activity');
    expect(aktivitaeten.map((e) => e.category)).toEqual(['gottesdienst']);
  });

  it('die Rücknahme zieht von der Säule der Vergabe ab, nicht von der aktuellen Art', async () => {
    await artSetzen('gottesdienst');
    await direktZuschreiben('2026-03-01');
    expect(await saeulen()).toEqual({ gottesdienst_points: 4, gemeinde_points: 10 });
    await artSetzen('gemeinde');

    const [beleg] = await belege();
    const res = await request(app)
      .delete(`/api/admin/konfis/${KONFI}/activities/${beleg.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    await warteAufNachwehen(app);

    // Mit der aktuellen Art: Gottesdienst bliebe 4, Gemeinde fiele auf 6.
    expect(await saeulen()).toEqual({ gottesdienst_points: 0, gemeinde_points: 10 });
  });

  it('der Antrags-Reset zieht von der Säule der Vergabe ab', async () => {
    await artSetzen('gottesdienst');
    const antragId = await antragGenehmigen('2026-03-01');
    expect(await saeulen()).toEqual({ gottesdienst_points: 4, gemeinde_points: 10 });
    await artSetzen('gemeinde');

    const res = await request(app)
      .put(`/api/admin/activities/requests/${antragId}/reset`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    await warteAufNachwehen(app);

    expect(await saeulen()).toEqual({ gottesdienst_points: 0, gemeinde_points: 10 });
    expect(await belege()).toEqual([]);
  });

  it('Bestand ohne gespeicherte Art liest die Art der Aktivität — wie vor der Migration', async () => {
    await artSetzen('gemeinde');
    const { rows: [alt] } = await db.query(
      `INSERT INTO user_activities (user_id, activity_id, admin_id, completed_date, organization_id, points, type)
       VALUES ($1, $2, $3, '2025-12-24', $4, 4, NULL) RETURNING id`,
      [KONFI, AKTIVITAET, USERS.admin1.id, ORG]
    );

    const detail = await request(app)
      .get(`/api/admin/konfis/${KONFI}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detail.body.activities.map((a) => a.type)).toEqual(['gemeinde']);

    const res = await request(app)
      .delete(`/api/admin/konfis/${KONFI}/activities/${alt.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    await warteAufNachwehen(app);
    expect(await saeulen()).toEqual({ gottesdienst_points: 0, gemeinde_points: 6 });
  });
});
