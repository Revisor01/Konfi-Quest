// Jahrgangs-Bindung fuer die Rolle 'admin' (Simons Regel vom 31.08.2026).
//
// Regel:
//   - org_admin / super_admin: von ALLEN Jahrgangsbeschraenkungen ausgenommen.
//   - admin: an seine zugewiesenen Jahrgaenge gebunden (Ausnahme: Teamer:innen,
//     die sieht er alle — betrifft Personenlisten, nicht diese Routen).
//   - admin ohne Zuweisung: sieht keine Konfis.
//
// Fixtures BEWUSST hier statt im gemeinsamen Seed: Dort liegen alle Konfis der
// Org 1 in jahrgang1 (seed.js:178-183) und admin1 hat gar keine Zuweisung —
// der Fall "Admin mit Jahrgang A greift auf Konfi in Jahrgang B" laesst sich
// damit nicht stellen. Der Seed bleibt unangetastet (er traegt ~30 andere
// Testdateien); die Zusatzdaten entstehen pro Test in beforeEach.

const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ACTIVITIES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-vitest';

// IDs oberhalb des Seed-Bereichs, damit nichts kollidiert.
const JG_A = 101;           // Jahrgang des Admins
const JG_B = 102;           // fremder Jahrgang
const KONFI_A = 201;        // Konfi in JG_A  -> erlaubt
const KONFI_B = 202;        // Konfi in JG_B  -> verboten
const ADMIN_MIT_JG = 203;   // admin, JG_A zugewiesen
const ADMIN_OHNE_JG = 204;  // admin, keine Zuweisung
const TEAMER_AKTIVITAET = 301;
const TEAMER_ZIEL = 205;    // Teamer:in als Ziel einer Teamer-Aktivitaet

function tokenFuer(id, roleId, orgId = 1, type = 'admin') {
  return jwt.sign(
    { id, type, display_name: `User ${id}`, organization_id: orgId, role_id: roleId },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('Jahrgangs-Bindung fuer admin (31.08.2026)', () => {
  let app;
  let db;
  let adminMitJgToken;
  let adminOhneJgToken;
  let orgAdminToken;
  let teamerToken;

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

    // Zwei zusaetzliche Jahrgaenge in Org 1
    await db.query(
      `INSERT INTO jahrgaenge (id, name, organization_id, confirmation_date)
       VALUES ($1, '2026/2027 A', 1, '2027-05-01'), ($2, '2026/2027 B', 1, '2027-05-01')`,
      [JG_A, JG_B]
    );

    // Zwei Konfis, je einer pro Jahrgang (role_id 1 = konfi in Org 1)
    for (const [id, jg, name] of [[KONFI_A, JG_A, 'Konfi JG-A'], [KONFI_B, JG_B, 'Konfi JG-B']]) {
      await db.query(
        `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
         VALUES ($1, $2, 'x', $3, 1, 1, true)`,
        [id, `konfi_${id}`, name]
      );
      await db.query(
        `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
         VALUES ($1, $2, 0, 0, 1)`,
        [id, jg]
      );
    }

    // Zwei Admins (role_id 3 = admin in Org 1)
    for (const [id, name] of [[ADMIN_MIT_JG, 'Admin mit Jahrgang'], [ADMIN_OHNE_JG, 'Admin ohne Jahrgang']]) {
      await db.query(
        `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
         VALUES ($1, $2, 'x', $3, 3, 1, true)`,
        [id, `admin_${id}`, name]
      );
    }
    // Nur der eine Admin bekommt JG_A
    await db.query(
      `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit)
       VALUES ($1, $2, true, true)`,
      [ADMIN_MIT_JG, JG_A]
    );

    // Teamer:in als Ziel fuer Teamer-Aktivitaeten (role_id 2 = teamer in Org 1)
    await db.query(
      `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
       VALUES ($1, 'teamer_ziel', 'x', 'Teamer Ziel', 2, 1, true)`,
      [TEAMER_ZIEL]
    );

    // Eine Teamer-Aktivitaet (target_role='teamer') — muss von der Bindung
    // ausgenommen bleiben.
    await db.query(
      `INSERT INTO activities (id, name, points, type, organization_id, target_role)
       VALUES ($1, 'Teamer-Schulung', 0, NULL, 1, 'teamer')`,
      [TEAMER_AKTIVITAET]
    );

    adminMitJgToken  = tokenFuer(ADMIN_MIT_JG, 3);
    adminOhneJgToken = tokenFuer(ADMIN_OHNE_JG, 3);
    orgAdminToken    = generateToken('orgAdmin1');
    teamerToken      = generateToken('teamer1');
  });

  // Legt einen Antrag fuer eine Konfi an und gibt die ID zurueck.
  async function antragAnlegen(konfiId, status = 'pending', activityId = ACTIVITIES.sonntagsgottesdienst.id) {
    const { rows: [row] } = await db.query(
      `INSERT INTO activity_requests (user_id, activity_id, requested_date, status, organization_id)
       VALUES ($1, $2, CURRENT_DATE, $3, 1) RETURNING id`,
      [konfiId, activityId, status]
    );
    return row.id;
  }

  // ================================================================
  // POST /api/admin/activities/assign-activity
  // ================================================================
  describe('POST assign-activity', () => {
    it('Admin DARF einer Konfi im eigenen Jahrgang Punkte geben', async () => {
      const res = await request(app)
        .post('/api/admin/activities/assign-activity')
        .set('Authorization', `Bearer ${adminMitJgToken}`)
        .send({ konfiId: KONFI_A, activityId: ACTIVITIES.sonntagsgottesdienst.id });

      expect(res.status).toBe(200);

      const { rows } = await db.query(
        'SELECT gottesdienst_points FROM konfi_profiles WHERE user_id = $1', [KONFI_A]
      );
      expect(rows[0].gottesdienst_points).toBe(1);
    });

    it('Admin DARF NICHT in einen fremden Jahrgang — 403, keine Punkte', async () => {
      const res = await request(app)
        .post('/api/admin/activities/assign-activity')
        .set('Authorization', `Bearer ${adminMitJgToken}`)
        .send({ konfiId: KONFI_B, activityId: ACTIVITIES.sonntagsgottesdienst.id });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Kein Zugriff auf diesen Konfi');

      const { rows } = await db.query(
        'SELECT gottesdienst_points FROM konfi_profiles WHERE user_id = $1', [KONFI_B]
      );
      expect(rows[0].gottesdienst_points).toBe(0);
      const { rows: eintraege } = await db.query(
        'SELECT COUNT(*)::int AS c FROM user_activities WHERE user_id = $1', [KONFI_B]
      );
      expect(eintraege[0].c).toBe(0);
    });

    it('Admin OHNE Jahrgang kommt an keine Konfi heran — 403', async () => {
      const res = await request(app)
        .post('/api/admin/activities/assign-activity')
        .set('Authorization', `Bearer ${adminOhneJgToken}`)
        .send({ konfiId: KONFI_A, activityId: ACTIVITIES.sonntagsgottesdienst.id });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Kein Zugriff auf diesen Konfi');
    });

    // REGRESSION: der wichtigste Test der Datei.
    it('REGRESSION org_admin darf weiterhin ALLES — beide Jahrgaenge', async () => {
      const resA = await request(app)
        .post('/api/admin/activities/assign-activity')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ konfiId: KONFI_A, activityId: ACTIVITIES.sonntagsgottesdienst.id });
      expect(resA.status).toBe(200);

      const resB = await request(app)
        .post('/api/admin/activities/assign-activity')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ konfiId: KONFI_B, activityId: ACTIVITIES.sonntagsgottesdienst.id });
      expect(resB.status).toBe(200);

      const { rows } = await db.query(
        'SELECT user_id, gottesdienst_points FROM konfi_profiles WHERE user_id = ANY($1::int[]) ORDER BY user_id',
        [[KONFI_A, KONFI_B]]
      );
      expect(rows[0].gottesdienst_points).toBe(1);
      expect(rows[1].gottesdienst_points).toBe(1);
    });

    it('Teamer bleibt an seinen Jahrgang gebunden (unveraendert) — 403', async () => {
      const res = await request(app)
        .post('/api/admin/activities/assign-activity')
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({ konfiId: KONFI_A, activityId: ACTIVITIES.sonntagsgottesdienst.id });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Kein Zugriff auf diesen Konfi');
    });

    it('Teamer-Aktivitaet an eine Teamer:in bleibt erlaubt (Ausnahme der Regel)', async () => {
      const res = await request(app)
        .post('/api/admin/activities/assign-activity')
        .set('Authorization', `Bearer ${adminMitJgToken}`)
        .send({ konfiId: TEAMER_ZIEL, activityId: TEAMER_AKTIVITAET });

      expect(res.status).toBe(200);

      const { rows } = await db.query(
        'SELECT COUNT(*)::int AS c FROM user_activities WHERE user_id = $1', [TEAMER_ZIEL]
      );
      expect(rows[0].c).toBe(1);
    });
  });

  // ================================================================
  // POST /api/admin/konfis/:id/bonus-points
  // ================================================================
  describe('POST bonus-points', () => {
    it('Admin DARF Bonuspunkte im eigenen Jahrgang vergeben', async () => {
      const res = await request(app)
        .post(`/api/admin/konfis/${KONFI_A}/bonus-points`)
        .set('Authorization', `Bearer ${adminMitJgToken}`)
        .send({ points: 3, type: 'gemeinde', description: 'Sehr engagiert' });

      // 201: die Route legt einen bonus_points-Eintrag an (unveraendert).
      expect(res.status).toBe(201);

      const { rows } = await db.query(
        'SELECT gemeinde_points FROM konfi_profiles WHERE user_id = $1', [KONFI_A]
      );
      expect(rows[0].gemeinde_points).toBe(3);
    });

    it('Admin DARF NICHT im fremden Jahrgang — 403, keine Punkte, kein Eintrag', async () => {
      const res = await request(app)
        .post(`/api/admin/konfis/${KONFI_B}/bonus-points`)
        .set('Authorization', `Bearer ${adminMitJgToken}`)
        .send({ points: 3, type: 'gemeinde', description: 'Sehr engagiert' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Kein Zugriff auf diesen Konfi');

      const { rows } = await db.query(
        'SELECT gemeinde_points FROM konfi_profiles WHERE user_id = $1', [KONFI_B]
      );
      expect(rows[0].gemeinde_points).toBe(0);
      const { rows: bonus } = await db.query(
        'SELECT COUNT(*)::int AS c FROM bonus_points WHERE konfi_id = $1', [KONFI_B]
      );
      expect(bonus[0].c).toBe(0);
    });

    it('REGRESSION org_admin vergibt Bonuspunkte in JEDEM Jahrgang', async () => {
      const resA = await request(app)
        .post(`/api/admin/konfis/${KONFI_A}/bonus-points`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ points: 2, type: 'gemeinde', description: 'Gut gemacht' });
      expect(resA.status).toBe(201);

      const resB = await request(app)
        .post(`/api/admin/konfis/${KONFI_B}/bonus-points`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ points: 2, type: 'gemeinde', description: 'Gut gemacht' });
      expect(resB.status).toBe(201);

      const { rows } = await db.query(
        'SELECT COUNT(*)::int AS c FROM bonus_points WHERE konfi_id = ANY($1::int[])',
        [[KONFI_A, KONFI_B]]
      );
      expect(rows[0].c).toBe(2);
    });
  });

  // ================================================================
  // GET /api/admin/activities/requests  (Filter statt 403)
  // ================================================================
  describe('GET requests', () => {
    it('Admin sieht nur Antraege aus seinem Jahrgang — Array bleibt Array', async () => {
      await antragAnlegen(KONFI_A);
      await antragAnlegen(KONFI_B);

      const res = await request(app)
        .get('/api/admin/activities/requests')
        .set('Authorization', `Bearer ${adminMitJgToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].user_id).toBe(KONFI_A);
    });

    it('Admin ohne Jahrgang sieht keine Konfi-Antraege — leeres Array, kein 403', async () => {
      await antragAnlegen(KONFI_A);
      await antragAnlegen(KONFI_B);

      const res = await request(app)
        .get('/api/admin/activities/requests')
        .set('Authorization', `Bearer ${adminOhneJgToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });

    it('REGRESSION org_admin sieht ALLE Antraege der Organisation', async () => {
      await antragAnlegen(KONFI_A);
      await antragAnlegen(KONFI_B);

      const res = await request(app)
        .get('/api/admin/activities/requests')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
    });

    it('Teamer-Antraege bleiben fuer den Admin sichtbar (Ausnahme der Regel)', async () => {
      await antragAnlegen(TEAMER_ZIEL, 'pending', TEAMER_AKTIVITAET);

      const res = await request(app)
        .get('/api/admin/activities/requests')
        .set('Authorization', `Bearer ${adminOhneJgToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].user_id).toBe(TEAMER_ZIEL);
    });
  });

  // ================================================================
  // PUT /api/admin/activities/requests/:id  (genehmigen/ablehnen)
  // ================================================================
  describe('PUT requests/:id', () => {
    it('Admin DARF einen Antrag im eigenen Jahrgang genehmigen', async () => {
      const id = await antragAnlegen(KONFI_A);

      const res = await request(app)
        .put(`/api/admin/activities/requests/${id}`)
        .set('Authorization', `Bearer ${adminMitJgToken}`)
        .send({ status: 'approved' });

      expect(res.status).toBe(200);

      const { rows } = await db.query('SELECT status FROM activity_requests WHERE id = $1', [id]);
      expect(rows[0].status).toBe('approved');
    });

    it('Admin DARF NICHT im fremden Jahrgang genehmigen — 403, Status bleibt pending', async () => {
      const id = await antragAnlegen(KONFI_B);

      const res = await request(app)
        .put(`/api/admin/activities/requests/${id}`)
        .set('Authorization', `Bearer ${adminMitJgToken}`)
        .send({ status: 'approved' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Kein Zugriff auf diesen Konfi');

      const { rows } = await db.query('SELECT status FROM activity_requests WHERE id = $1', [id]);
      expect(rows[0].status).toBe('pending');
      const { rows: punkte } = await db.query(
        'SELECT gottesdienst_points FROM konfi_profiles WHERE user_id = $1', [KONFI_B]
      );
      expect(punkte[0].gottesdienst_points).toBe(0);
    });

    it('REGRESSION org_admin genehmigt in JEDEM Jahrgang', async () => {
      const id = await antragAnlegen(KONFI_B);

      const res = await request(app)
        .put(`/api/admin/activities/requests/${id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ status: 'approved' });

      expect(res.status).toBe(200);
      const { rows } = await db.query('SELECT status FROM activity_requests WHERE id = $1', [id]);
      expect(rows[0].status).toBe('approved');
    });
  });

  // ================================================================
  // PUT /api/admin/activities/requests/:id/reset
  // ================================================================
  describe('PUT requests/:id/reset', () => {
    it('Admin DARF im eigenen Jahrgang zuruecksetzen', async () => {
      const id = await antragAnlegen(KONFI_A, 'rejected');

      const res = await request(app)
        .put(`/api/admin/activities/requests/${id}/reset`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);

      expect(res.status).toBe(200);
      const { rows } = await db.query('SELECT status FROM activity_requests WHERE id = $1', [id]);
      expect(rows[0].status).toBe('pending');
    });

    it('Admin DARF NICHT im fremden Jahrgang zuruecksetzen — 403, Status unveraendert', async () => {
      const id = await antragAnlegen(KONFI_B, 'rejected');

      const res = await request(app)
        .put(`/api/admin/activities/requests/${id}/reset`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Kein Zugriff auf diesen Konfi');

      const { rows } = await db.query('SELECT status FROM activity_requests WHERE id = $1', [id]);
      expect(rows[0].status).toBe('rejected');
    });

    it('REGRESSION org_admin setzt in JEDEM Jahrgang zurueck', async () => {
      const id = await antragAnlegen(KONFI_B, 'rejected');

      const res = await request(app)
        .put(`/api/admin/activities/requests/${id}/reset`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      const { rows } = await db.query('SELECT status FROM activity_requests WHERE id = $1', [id]);
      expect(rows[0].status).toBe('pending');
    });
  });

  // ================================================================
  // DELETE /api/admin/activities/requests/:id
  // ================================================================
  describe('DELETE requests/:id', () => {
    it('Admin DARF einen abgelehnten Antrag im eigenen Jahrgang loeschen', async () => {
      const id = await antragAnlegen(KONFI_A, 'rejected');

      const res = await request(app)
        .delete(`/api/admin/activities/requests/${id}`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);

      expect(res.status).toBe(200);
      const { rows } = await db.query('SELECT COUNT(*)::int AS c FROM activity_requests WHERE id = $1', [id]);
      expect(rows[0].c).toBe(0);
    });

    it('Admin DARF NICHT im fremden Jahrgang loeschen — 403, Antrag bleibt', async () => {
      const id = await antragAnlegen(KONFI_B, 'rejected');

      const res = await request(app)
        .delete(`/api/admin/activities/requests/${id}`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Kein Zugriff auf diesen Konfi');

      const { rows } = await db.query('SELECT COUNT(*)::int AS c FROM activity_requests WHERE id = $1', [id]);
      expect(rows[0].c).toBe(1);
    });

    it('REGRESSION org_admin loescht in JEDEM Jahrgang', async () => {
      const id = await antragAnlegen(KONFI_B, 'rejected');

      const res = await request(app)
        .delete(`/api/admin/activities/requests/${id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      const { rows } = await db.query('SELECT COUNT(*)::int AS c FROM activity_requests WHERE id = $1', [id]);
      expect(rows[0].c).toBe(0);
    });
  });

  // ================================================================
  // Foto-Routen
  // ================================================================
  describe('Foto-Routen', () => {
    it('Admin bekommt das Foto einer fremden Konfi NICHT — 403', async () => {
      const id = await antragAnlegen(KONFI_B);
      await db.query("UPDATE activity_requests SET photo_filename = 'test.jpg' WHERE id = $1", [id]);

      const res = await request(app)
        .get(`/api/admin/activities/requests/${id}/photo`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Kein Zugriff auf diesen Konfi');
    });

    it('Admin DARF das Foto einer fremden Konfi NICHT loeschen — 403, Referenz bleibt', async () => {
      const id = await antragAnlegen(KONFI_B);
      await db.query("UPDATE activity_requests SET photo_filename = 'test.jpg' WHERE id = $1", [id]);

      const res = await request(app)
        .delete(`/api/admin/activities/requests/${id}/photo`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Kein Zugriff auf diesen Konfi');

      const { rows } = await db.query('SELECT photo_filename FROM activity_requests WHERE id = $1', [id]);
      expect(rows[0].photo_filename).toBe('test.jpg');
    });

    it('REGRESSION org_admin kommt an das Foto heran (404 = Datei fehlt, nicht 403)', async () => {
      const id = await antragAnlegen(KONFI_B);
      await db.query("UPDATE activity_requests SET photo_filename = 'test.jpg' WHERE id = $1", [id]);

      const res = await request(app)
        .get(`/api/admin/activities/requests/${id}/photo`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      // Die Berechtigung greift durch; erst die fehlende Datei stoppt.
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Foto-Datei nicht gefunden');
    });

    it('REGRESSION org_admin darf das Foto loeschen', async () => {
      const id = await antragAnlegen(KONFI_B);
      await db.query("UPDATE activity_requests SET photo_filename = 'test.jpg' WHERE id = $1", [id]);

      const res = await request(app)
        .delete(`/api/admin/activities/requests/${id}/photo`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      const { rows } = await db.query('SELECT photo_filename FROM activity_requests WHERE id = $1', [id]);
      expect(rows[0].photo_filename).toBe(null);
    });
  });
});
