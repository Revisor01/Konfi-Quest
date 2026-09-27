// backend/tests/routes/punktwertAmZuordnungsdatensatz.test.js
//
// Audit 26.09.2026, Punkte/Termine BF-02 (HOCH): user_activities speicherte
// keinen Punktwert. Vergeben wurde der Wert der Aktivität zum Zeitpunkt der
// Zuordnung; Historie, Detailansicht und jede Rücknahme lasen dagegen den
// AKTUELLEN Wert der Aktivität. Änderte die Leitung den Punktwert, stimmte
// nichts mehr zusammen: Die Historie zeigte Punkte, die es nie gab, und eine
// Rücknahme zog mehr (oder weniger) ab, als gutgeschrieben war.
//
// Seit Migration 163 trägt jede Zuordnung ihren Wert (user_activities.points).
// Diese Suite hält die Regel fest: Der Wert einer Aktivität gilt für künftige
// Vergaben; was schon gutgeschrieben ist, bleibt — in Summe, Historie, Liste
// und bei der Rücknahme. Bestand ohne Wert (NULL) verhält sich wie vorher.
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ACTIVITIES, JAHRGAENGE, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Punktwert am Zuordnungsdatensatz (BF-02)', () => {
  let app;
  let db;
  let adminToken;
  let konfiToken;

  const KONFI = USERS.konfi1.id;
  const ORG = ORGS.testGemeinde.id;
  // Gottesdienst-Aktivität aus dem Seed (dort 1 Punkt); der Wert wird in
  // jedem Test zuerst über die echte Route gesetzt.
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
    // admin1 ist an seine Jahrgänge gebunden; der Seed weist ihm keinen zu.
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
    );
    const { invalidateUserCache } = require('../../middleware/rbac');
    invalidateUserCache(USERS.admin1.id);
  });

  afterAll(async () => {
    await closePool();
  });

  // ---------------------------------------------------------------- Helfer

  // Punktwert der Aktivität über die echte Route der Leitung setzen.
  const punktwertSetzen = async (points) => {
    const res = await request(app)
      .put(`/api/admin/activities/${AKTIVITAET}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Sonntagsgottesdienst', points, type: 'gottesdienst' });
    expect(res.status).toBe(200);
  };

  const gottesdienstPunkte = async () => {
    const { rows: [p] } = await db.query(
      'SELECT gottesdienst_points FROM konfi_profiles WHERE user_id = $1', [KONFI]
    );
    return p.gottesdienst_points;
  };

  // Weg 1: Leitung schreibt die Aktivität in der Konfi-Verwaltung direkt zu.
  const direktZuschreiben = async (completed_date) => {
    const res = await request(app)
      .post(`/api/admin/konfis/${KONFI}/activities`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ activity_id: AKTIVITAET, completed_date, comment: '' });
    expect(res.status).toBe(201);
    await warteAufNachwehen(app);
  };

  // Weg 2: Direktvergabe über die Aktivitäten-Route (auch für Teamer:innen).
  const zuweisen = async (completed_date) => {
    const res = await request(app)
      .post('/api/admin/activities/assign-activity')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ konfiId: KONFI, activityId: AKTIVITAET, completed_date });
    expect(res.status).toBe(200);
    await warteAufNachwehen(app);
  };

  // Weg 3: Konfi meldet, Leitung genehmigt.
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

  const zuordnungen = async () => {
    const { rows } = await db.query(
      `SELECT id, points, to_char(completed_date, 'YYYY-MM-DD') AS tag
         FROM user_activities WHERE user_id = $1 ORDER BY completed_date, id`,
      [KONFI]
    );
    return rows;
  };

  const historieAktivitaeten = async () => {
    const res = await request(app)
      .get('/api/konfi/points-history')
      .set('Authorization', `Bearer ${konfiToken}`);
    expect(res.status).toBe(200);
    return {
      totals: res.body.totals,
      eintraege: res.body.history.filter((e) => e.source_type === 'activity'),
    };
  };

  const detailAktivitaeten = async () => {
    const res = await request(app)
      .get(`/api/admin/konfis/${KONFI}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    return res.body.activities;
  };

  // ---------------------------------------------------------------- Tests

  it('die Vergabe speichert den Wert der Aktivität zu diesem Zeitpunkt — auf allen drei Wegen', async () => {
    await punktwertSetzen(5);
    await direktZuschreiben('2026-03-01');
    await punktwertSetzen(6);
    await zuweisen('2026-03-02');
    await punktwertSetzen(7);
    await antragGenehmigen('2026-03-03');

    expect((await zuordnungen()).map((z) => z.points)).toEqual([5, 6, 7]);
    expect(await gottesdienstPunkte()).toBe(18);
  });

  it('wird die Aktivität später mehr wert, behält der Konfi den alten Wert in Summe, Historie und Liste', async () => {
    await punktwertSetzen(5);
    await direktZuschreiben('2026-03-01');
    expect(await gottesdienstPunkte()).toBe(5);

    await punktwertSetzen(8);

    expect(await gottesdienstPunkte()).toBe(5);

    const { totals, eintraege } = await historieAktivitaeten();
    expect(totals.gottesdienst).toBe(5);
    expect(eintraege).toHaveLength(1);
    expect(eintraege[0].points).toBe(5);
    expect(eintraege[0].title).toBe('Sonntagsgottesdienst');

    const liste = await detailAktivitaeten();
    expect(liste).toHaveLength(1);
    expect(liste[0].points).toBe(5);
  });

  it('eine neue Vergabe nach der Änderung bringt den neuen Wert; die Historie summiert sich zum Stand', async () => {
    await punktwertSetzen(5);
    await direktZuschreiben('2026-03-01');
    await punktwertSetzen(8);
    await zuweisen('2026-03-02');

    expect(await gottesdienstPunkte()).toBe(13);

    const { totals, eintraege } = await historieAktivitaeten();
    expect(totals.gottesdienst).toBe(13);
    // neueste zuerst
    expect(eintraege.map((e) => e.points)).toEqual([8, 5]);
    expect(eintraege.reduce((s, e) => s + e.points, 0)).toBe(totals.gottesdienst);

    const liste = await detailAktivitaeten();
    expect(liste.map((a) => a.points)).toEqual([8, 5]);
  });

  it('die Rücknahme zieht den vergebenen Wert ab, nicht den aktuellen der Aktivität', async () => {
    await punktwertSetzen(5);
    await direktZuschreiben('2026-03-01');
    await punktwertSetzen(8);
    await zuweisen('2026-03-02');
    expect(await gottesdienstPunkte()).toBe(13);

    const [alteZeile] = await zuordnungen(); // die mit 5
    expect(alteZeile.points).toBe(5);

    const res = await request(app)
      .delete(`/api/admin/konfis/${KONFI}/activities/${alteZeile.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    await warteAufNachwehen(app);

    // 13 - 5 = 8. Mit dem aktuellen Wert wären es 13 - 8 = 5.
    expect(await gottesdienstPunkte()).toBe(8);
    expect((await zuordnungen()).map((z) => z.points)).toEqual([8]);
  });

  it('der Antrags-Reset entfernt die Zuordnung des Antrags und zieht genau ihren Wert ab', async () => {
    // Ältere Direktvergabe, dann Antrag mit 5 genehmigt, dann Aktivität auf 8.
    await punktwertSetzen(3);
    await direktZuschreiben('2026-02-01');
    await punktwertSetzen(5);
    const antragId = await antragGenehmigen('2026-03-01');
    await punktwertSetzen(8);
    expect(await gottesdienstPunkte()).toBe(8); // 3 + 5

    const res = await request(app)
      .put(`/api/admin/activities/requests/${antragId}/reset`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.oldStatus).toBe('approved');
    await warteAufNachwehen(app);

    // 8 - 5 = 3. Mit dem aktuellen Wert: GREATEST(0, 8 - 8) = 0.
    expect(await gottesdienstPunkte()).toBe(3);
    const rest = await zuordnungen();
    expect(rest).toHaveLength(1);
    expect(rest[0].points).toBe(3);
    expect(rest[0].tag).toBe('2026-02-01');

    const { rows: [antrag] } = await db.query('SELECT status FROM activity_requests WHERE id = $1', [antragId]);
    expect(antrag.status).toBe('pending');
  });

  it('Bestand ohne gespeicherten Wert liest den Wert der Aktivität — wie vor der Migration', async () => {
    await punktwertSetzen(5);
    // Eine Zuordnung, wie sie vor Migration 163 entstand: kein Wert am Beleg.
    const { rows: [alt] } = await db.query(
      `INSERT INTO user_activities (user_id, activity_id, admin_id, completed_date, organization_id, points)
       VALUES ($1, $2, $3, '2025-12-24', $4, NULL) RETURNING id`,
      [KONFI, AKTIVITAET, USERS.admin1.id, ORG]
    );
    await db.query('UPDATE konfi_profiles SET gottesdienst_points = 5 WHERE user_id = $1', [KONFI]);

    const { eintraege } = await historieAktivitaeten();
    expect(eintraege).toHaveLength(1);
    expect(eintraege[0].points).toBe(5);
    expect((await detailAktivitaeten())[0].points).toBe(5);

    const res = await request(app)
      .delete(`/api/admin/konfis/${KONFI}/activities/${alt.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    await warteAufNachwehen(app);
    expect(await gottesdienstPunkte()).toBe(0);
  });

  it('Migration 163 füllt den Bestand aus der Aktivität nach und lässt gesetzte Werte stehen', async () => {
    await punktwertSetzen(5);
    const { rows: [ohne] } = await db.query(
      `INSERT INTO user_activities (user_id, activity_id, completed_date, organization_id, points)
       VALUES ($1, $2, '2025-12-24', $3, NULL) RETURNING id`,
      [KONFI, AKTIVITAET, ORG]
    );
    const { rows: [mit] } = await db.query(
      `INSERT INTO user_activities (user_id, activity_id, completed_date, organization_id, points)
       VALUES ($1, $2, '2025-12-25', $3, 2) RETURNING id`,
      [KONFI, AKTIVITAET, ORG]
    );

    // Die Migration ist idempotent (ADD COLUMN IF NOT EXISTS, UPDATE nur auf
    // NULL) — sie lässt sich hier auf dem fertigen Schema noch einmal fahren.
    const sql = fs.readFileSync(
      path.join(__dirname, '..', '..', 'migrations', '163_user_activities_points.sql'), 'utf8'
    );
    await db.query(sql);

    const { rows } = await db.query(
      'SELECT id, points FROM user_activities WHERE id IN ($1, $2) ORDER BY id', [ohne.id, mit.id]
    );
    expect(rows).toEqual([{ id: ohne.id, points: 5 }, { id: mit.id, points: 2 }]);
  });
});
