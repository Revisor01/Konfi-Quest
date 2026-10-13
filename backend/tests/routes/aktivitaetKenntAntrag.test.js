// Eine verbuchte Aktivitaet kennt ihren Antrag (Migration 214, 13.10.2026).
//
// Simon, Seiten-Interview 13.10.2026 (Detailseite einer Konfi): „klick auf
// eine aktivität sollte den antrag öffnen". Die Genehmigung schreibt dafuer
// user_activities.request_id, GET /admin/konfis/:id liefert es je Aktivitaet
// mit (activities[].request_id, sonst null). Was die Leitung selbst eintraegt,
// hat keinen Antrag. Das Zuruecksetzen eines Antrags nimmt seitdem genau seine
// Zeile zurueck -- vorher die juengste zu Person und Aktivitaet, auch wenn sie
// zu einem ANDEREN Antrag gehoerte.
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ACTIVITIES, JAHRGAENGE, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');

const KONFI = USERS.konfi1.id;
const ORG = ORGS.testGemeinde.id;
const AKTIVITAET = ACTIVITIES.sonntagsgottesdienst.id;

describe('user_activities.request_id: Genehmigen, Detailantwort, Zuruecksetzen', () => {
  let app;
  let db;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
    );
    invalidateUserCache(USERS.admin1.id);
  });

  const antrag = async (requestedDate, { status = 'pending' } = {}) => {
    const { rows: [r] } = await db.query(
      `INSERT INTO activity_requests (user_id, activity_id, status, organization_id, requested_date, comment)
       VALUES ($1, $2, $3, $4, $5, 'War schön') RETURNING id`,
      [KONFI, AKTIVITAET, status, ORG, requestedDate]
    );
    return r.id;
  };
  const genehmigen = async (id) => {
    const res = await request(app)
      .put(`/api/admin/activities/requests/${id}`)
      .set('Authorization', `Bearer ${generateToken('admin1')}`)
      .send({ status: 'approved' });
    expect(res.status).toBe(200);
    await warteAufNachwehen(app);
  };
  const zuruecksetzen = async (id) => {
    const res = await request(app)
      .put(`/api/admin/activities/requests/${id}/reset`)
      .set('Authorization', `Bearer ${generateToken('admin1')}`);
    expect(res.status).toBe(200);
    await warteAufNachwehen(app);
  };
  const detail = (wer = 'admin1') => request(app)
    .get(`/api/admin/konfis/${KONFI}`)
    .set('Authorization', `Bearer ${generateToken(wer)}`);
  const zeilen = async () => (await db.query(
    `SELECT request_id, to_char(completed_date, 'YYYY-MM-DD') AS tag
       FROM user_activities WHERE user_id = $1 ORDER BY completed_date, id`, [KONFI]
  )).rows.map((z) => [z.tag, z.request_id === null ? null : Number(z.request_id)]);

  it('Genehmigen schreibt den Antrag an die Zeile, die Detailantwort liefert ihn je Aktivitaet', async () => {
    const id = await antrag('2026-09-27');
    await genehmigen(id);
    expect(await zeilen()).toEqual([['2026-09-27', id]]);

    const res = await detail();
    expect(res.status).toBe(200);
    expect(res.body.activities).toHaveLength(1);
    expect(Number(res.body.activities[0].request_id)).toBe(id);
    expect(res.body.activities[0].name).toBe('Sonntagsgottesdienst');
  });

  it('von der Leitung eingetragen: kein Antrag, request_id null', async () => {
    const res = await request(app)
      .post('/api/admin/activities/assign-activity')
      .set('Authorization', `Bearer ${generateToken('admin1')}`)
      .send({ konfiId: KONFI, activityId: AKTIVITAET, completed_date: '2026-09-20' });
    expect(res.status).toBe(200);
    await warteAufNachwehen(app);

    const d = await detail();
    expect(d.status).toBe(200);
    expect(d.body.activities).toHaveLength(1);
    expect(d.body.activities[0].request_id).toBeNull();
  });

  it('fremde Gemeinde: 404 und keine Aktivitaet, kein Antrag', async () => {
    await genehmigen(await antrag('2026-09-27'));
    const res = await detail('orgAdmin2');
    expect(res.status).toBe(404);
    expect(res.body.activities).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('request_id');
  });

  // VERBOTEN: Das Zuruecksetzen des AELTEREN Antrags nahm bis 13.10.2026 die
  // juengste Zeile -- die des anderen Antrags. Die Punkte stimmten in Summe,
  // aber der juengere Antrag stand danach "genehmigt" ohne Aktivitaet da.
  it('Zuruecksetzen des aelteren von zwei Antraegen nimmt SEINE Zeile, die des juengeren bleibt', async () => {
    const alt = await antrag('2026-09-06');
    const neu = await antrag('2026-09-27');
    await genehmigen(alt);
    await genehmigen(neu);
    expect(await zeilen()).toEqual([['2026-09-06', alt], ['2026-09-27', neu]]);

    await zuruecksetzen(alt);
    expect(await zeilen()).toEqual([['2026-09-27', neu]]);
    const { rows: [a] } = await db.query('SELECT status FROM activity_requests WHERE id = $1', [alt]);
    expect(a.status).toBe('pending');
  });

  // ERLAUBT: der eigene Antrag wird zurueckgenommen, mit seinem Punkt.
  it('Zuruecksetzen des juengeren Antrags nimmt seine Zeile und seinen Punkt zurueck', async () => {
    const alt = await antrag('2026-09-06');
    const neu = await antrag('2026-09-27');
    await genehmigen(alt);
    await genehmigen(neu);
    const vorher = (await db.query('SELECT gottesdienst_points AS p FROM konfi_profiles WHERE user_id = $1', [KONFI])).rows[0].p;

    await zuruecksetzen(neu);
    expect(await zeilen()).toEqual([['2026-09-06', alt]]);
    const nachher = (await db.query('SELECT gottesdienst_points AS p FROM konfi_profiles WHERE user_id = $1', [KONFI])).rows[0].p;
    expect(Number(nachher)).toBe(Number(vorher) - 1);
  });

  it('Altbestand ohne Antrag: das Zuruecksetzen nimmt wie bisher die juengste Zeile ohne Antrag', async () => {
    const id = await antrag('2026-09-27', { status: 'approved' });
    // Wie vor Migration 214 genehmigt: die Zeile ohne request_id.
    await db.query(
      `INSERT INTO user_activities (user_id, activity_id, admin_id, completed_date, organization_id, points, type)
       VALUES ($1, $2, $3, '2026-09-27', $4, 1, 'gottesdienst')`,
      [KONFI, AKTIVITAET, USERS.admin1.id, ORG]
    );
    await zuruecksetzen(id);
    expect(await zeilen()).toEqual([]);
  });

  it('der Antrag wird geloescht: die Aktivitaet bleibt, ohne Antrag (ON DELETE SET NULL)', async () => {
    const id = await antrag('2026-09-27');
    await genehmigen(id);
    await db.query('DELETE FROM activity_requests WHERE id = $1', [id]);
    expect(await zeilen()).toEqual([['2026-09-27', null]]);
  });
});
