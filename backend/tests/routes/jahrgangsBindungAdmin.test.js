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
const { seed, USERS, ACTIVITIES, JAHRGAENGE } = require('../helpers/seed');
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

    // Der rbac-Cache haelt req.user samt assigned_jahrgaenge bis zu 30 s.
    // Tests, die Zuweisungen veraendern (z.B. can_edit=false), wuerden sonst
    // in den NAECHSTEN Test nachwirken — genau so sind am 01.09.2026 zwei
    // Tests nur in der Datei-Reihenfolge rot geworden, einzeln aber gruen.
    const { invalidateUserCache } = require('../../middleware/rbac');
    invalidateUserCache(ADMIN_MIT_JG);
    invalidateUserCache(ADMIN_OHNE_JG);
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

  // ================================================================
  // Ab hier: Routen, die am 01.09.2026 an die Regel angeschlossen
  // wurden (vorher galt dort nur requireAdmin/requireTeamer + Org).
  // ================================================================

  // ================================================================
  // GET /api/teamer/konfis (Chat-Auswahl)
  // ================================================================
  describe('GET /api/teamer/konfis', () => {
    it('Admin sieht nur Konfis seiner Jahrgaenge — Array bleibt Array', async () => {
      const res = await request(app)
        .get('/api/teamer/konfis')
        .set('Authorization', `Bearer ${adminMitJgToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].id).toBe(KONFI_A);
    });

    it('Admin ohne Jahrgang sieht KEINE Konfis — leeres Array mit Grund-Header, kein 403', async () => {
      const res = await request(app)
        .get('/api/teamer/konfis')
        .set('Authorization', `Bearer ${adminOhneJgToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
      expect(res.headers['x-kein-jahrgang-zugewiesen']).toBe('true');
    });

    it('REGRESSION org_admin sieht ALLE Konfis der Organisation', async () => {
      const res = await request(app)
        .get('/api/teamer/konfis')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      // Seed: konfi1 + konfi2 (jahrgang1) plus KONFI_A + KONFI_B
      expect(res.body.length).toBe(4);
    });
  });

  // ================================================================
  // GET /api/events (Terminliste)
  // ================================================================
  describe('GET /api/events', () => {
    const EVENT_JG_A = 401;
    const EVENT_JG_B = 402;
    const EVENT_OHNE_JG = 403;
    const EVENT_TEAMER = 404;

    beforeEach(async () => {
      // Vier Termine: je einer pro Jahrgang, einer ohne Jahrgang, einer
      // teamer_only (immer sichtbar fuer die Leitung und Teamer:innen).
      for (const [id, name] of [
        [EVENT_JG_A, 'Termin JG-A'], [EVENT_JG_B, 'Termin JG-B'],
        [EVENT_OHNE_JG, 'Termin ohne Jahrgang'], [EVENT_TEAMER, 'Teamer-Termin']
      ]) {
        await db.query(
          `INSERT INTO events (id, name, event_date, organization_id, teamer_only)
           VALUES ($1, $2, NOW() + interval '3 days', 1, $3)`,
          [id, name, id === EVENT_TEAMER]
        );
      }
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2), ($3, $4)',
        [EVENT_JG_A, JG_A, EVENT_JG_B, JG_B]
      );
    });

    it('Admin sieht eigenen Jahrgang, allgemeine und Teamer-Termine — nicht den fremden Jahrgang', async () => {
      const res = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${adminMitJgToken}`);

      expect(res.status).toBe(200);
      const ids = res.body.map(e => e.id);
      expect(ids).toContain(EVENT_JG_A);
      expect(ids).toContain(EVENT_OHNE_JG);
      expect(ids).toContain(EVENT_TEAMER);
      expect(ids).not.toContain(EVENT_JG_B);
    });

    it('Admin ohne Jahrgang sieht nur allgemeine und Teamer-Termine — mit Grund-Header', async () => {
      const res = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${adminOhneJgToken}`);

      expect(res.status).toBe(200);
      const ids = res.body.map(e => e.id);
      expect(ids).toContain(EVENT_OHNE_JG);
      expect(ids).toContain(EVENT_TEAMER);
      expect(ids).not.toContain(EVENT_JG_A);
      expect(ids).not.toContain(EVENT_JG_B);
      expect(res.headers['x-kein-jahrgang-zugewiesen']).toBe('true');
    });

    it('REGRESSION org_admin sieht weiterhin ALLE Termine', async () => {
      const res = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      const ids = res.body.map(e => e.id);
      for (const id of [EVENT_JG_A, EVENT_JG_B, EVENT_OHNE_JG, EVENT_TEAMER]) {
        expect(ids).toContain(id);
      }
    });
  });

  // ================================================================
  // GET/POST/PUT/DELETE /api/admin/jahrgaenge
  // ================================================================
  describe('Jahrgaenge-Verwaltung', () => {
    it('GET: Admin sieht nur seine Jahrgaenge', async () => {
      const res = await request(app)
        .get('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${adminMitJgToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].id).toBe(JG_A);
    });

    it('GET: Admin ohne Jahrgang bekommt ein leeres Array mit Grund-Header, kein 403', async () => {
      const res = await request(app)
        .get('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${adminOhneJgToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
      expect(res.headers['x-kein-jahrgang-zugewiesen']).toBe('true');
    });

    it('GET: REGRESSION org_admin sieht alle Jahrgaenge der Org', async () => {
      const res = await request(app)
        .get('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      // Seed-jahrgang1 + JG_A + JG_B
      expect(res.body.length).toBe(3);
    });

    it('PUT: Admin DARF den eigenen Jahrgang bearbeiten', async () => {
      const res = await request(app)
        .put(`/api/admin/jahrgaenge/${JG_A}`)
        .set('Authorization', `Bearer ${adminMitJgToken}`)
        .send({ name: '2026/2027 A neu' });

      expect(res.status).toBe(200);
      const { rows } = await db.query('SELECT name FROM jahrgaenge WHERE id = $1', [JG_A]);
      expect(rows[0].name).toBe('2026/2027 A neu');
    });

    it('PUT: Admin DARF NICHT den fremden Jahrgang bearbeiten — 403, Name bleibt', async () => {
      const res = await request(app)
        .put(`/api/admin/jahrgaenge/${JG_B}`)
        .set('Authorization', `Bearer ${adminMitJgToken}`)
        .send({ name: 'Gekapert' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Kein Zugriff auf diesen Jahrgang');
      const { rows } = await db.query('SELECT name FROM jahrgaenge WHERE id = $1', [JG_B]);
      expect(rows[0].name).toBe('2026/2027 B');
    });

    it('PUT: fremde Organisation sieht 404, nicht 403', async () => {
      const admin2Token = generateToken('admin2');
      const res = await request(app)
        .put(`/api/admin/jahrgaenge/${JG_A}`)
        .set('Authorization', `Bearer ${admin2Token}`)
        .send({ name: 'Fremdzugriff' });

      expect(res.status).toBe(404);
    });

    it('DELETE: Admin DARF NICHT den fremden Jahrgang loeschen — 403, Jahrgang bleibt', async () => {
      const res = await request(app)
        .delete(`/api/admin/jahrgaenge/${JG_B}`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);

      expect(res.status).toBe(403);
      const { rows } = await db.query('SELECT COUNT(*)::int AS c FROM jahrgaenge WHERE id = $1', [JG_B]);
      expect(rows[0].c).toBe(1);
    });

    it('POST: Admin darf KEINEN Jahrgang anlegen — 403, nichts entsteht (01.09.2026: nur org_admin)', async () => {
      // Bis 01.09.2026 durfte ein gebundener Admin anlegen und bekam eine
      // Auto-Selbstzuweisung. Simons Entscheidung vom selben Tag dreht das um:
      // "Admin darf keine Jahrgänge anlegen. Das darf nur org Admin. Der
      // weist dann direkt zu." — Erwartung deshalb 403 statt 201.
      const createRes = await request(app)
        .post('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${adminMitJgToken}`)
        .send({ name: '2027/2028 C' });

      expect(createRes.status).toBe(403);
      const { rows: jgRows } = await db.query(
        "SELECT COUNT(*)::int AS c FROM jahrgaenge WHERE name = '2027/2028 C'"
      );
      expect(jgRows[0].c).toBe(0);
      // Auch keine liegen gebliebene (Selbst-)Zuweisung.
      const { rows: zuRows } = await db.query(
        'SELECT COUNT(*)::int AS c FROM user_jahrgang_assignments WHERE user_id = $1 AND jahrgang_id != $2',
        [ADMIN_MIT_JG, JG_A]
      );
      expect(zuRows[0].c).toBe(0);
    });

    it('POST als org_admin mit Direkt-Zuweisung: Admin darf den neuen Jahrgang sofort loeschen', async () => {
      // Ersetzt den frueheren Auto-Selbstzuweisungs-Fall: Der org_admin weist
      // beim Anlegen direkt zu, danach hat der Admin view+edit und darf loeschen.
      const createRes = await request(app)
        .post('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({
          name: '2027/2028 C',
          user_assignments: [{ user_id: ADMIN_MIT_JG, can_view: true, can_edit: true }]
        });

      expect(createRes.status).toBe(201);
      const neueId = createRes.body.id;

      const { rows: [zuweisung] } = await db.query(
        'SELECT can_view, can_edit FROM user_jahrgang_assignments WHERE user_id = $1 AND jahrgang_id = $2',
        [ADMIN_MIT_JG, neueId]
      );
      expect(zuweisung.can_view).toBe(true);
      expect(zuweisung.can_edit).toBe(true);

      const deleteRes = await request(app)
        .delete(`/api/admin/jahrgaenge/${neueId}`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);
      expect(deleteRes.status).toBe(200);
    });

    it('REGRESSION org_admin bearbeitet und loescht ohne Zuweisung', async () => {
      const putRes = await request(app)
        .put(`/api/admin/jahrgaenge/${JG_B}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ name: '2026/2027 B neu' });
      expect(putRes.status).toBe(200);

      // JG_B haengt an KONFI_B — erst Konfi entfernen, dann loeschen.
      await db.query('DELETE FROM konfi_profiles WHERE user_id = $1', [KONFI_B]);
      await db.query('DELETE FROM users WHERE id = $1', [KONFI_B]);
      const delRes = await request(app)
        .delete(`/api/admin/jahrgaenge/${JG_B}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);
      expect(delRes.status).toBe(200);
    });
  });

  // ================================================================
  // Jahrgangs-Auswertungen (Matrix, Sprueche, Versand)
  // ================================================================
  describe('Jahrgangs-Auswertungen', () => {
    it('attendance-matrix: eigener Jahrgang 200, fremder 403', async () => {
      const eigene = await request(app)
        .get(`/api/admin/jahrgaenge/${JG_A}/attendance-matrix`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);
      expect(eigene.status).toBe(200);
      expect(eigene.body.jahrgang.id).toBe(JG_A);

      const fremde = await request(app)
        .get(`/api/admin/jahrgaenge/${JG_B}/attendance-matrix`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);
      expect(fremde.status).toBe(403);
      expect(fremde.body.error).toBe('Kein Zugriff auf diesen Jahrgang');
    });

    it('sprueche: eigener Jahrgang 200, fremder 403', async () => {
      const eigene = await request(app)
        .get(`/api/admin/jahrgaenge/${JG_A}/sprueche`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);
      expect(eigene.status).toBe(200);
      expect(Array.isArray(eigene.body)).toBe(true);

      const fremde = await request(app)
        .get(`/api/admin/jahrgaenge/${JG_B}/sprueche`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);
      expect(fremde.status).toBe(403);
    });

    it('matrix-email: fremder Jahrgang 403; eigener kommt durch die Schranke (400 = fehlende E-Mail, nicht 403)', async () => {
      const fremde = await request(app)
        .post(`/api/admin/jahrgaenge/${JG_B}/matrix-email`)
        .set('Authorization', `Bearer ${adminMitJgToken}`)
        .send({ type: 'anwesenheit' });
      expect(fremde.status).toBe(403);

      // Seed-User haben keine E-Mail-Adresse — die Berechtigung greift durch,
      // erst die fehlende Adresse stoppt (gleiches Muster wie beim Foto-Test).
      const eigene = await request(app)
        .post(`/api/admin/jahrgaenge/${JG_A}/matrix-email`)
        .set('Authorization', `Bearer ${adminMitJgToken}`)
        .send({ type: 'anwesenheit' });
      expect(eigene.status).toBe(400);
      expect(eigene.body.error).toBe('Keine E-Mail-Adresse hinterlegt');
    });

    it('REGRESSION org_admin kommt an beide Jahrgaenge', async () => {
      const a = await request(app)
        .get(`/api/admin/jahrgaenge/${JG_A}/attendance-matrix`)
        .set('Authorization', `Bearer ${orgAdminToken}`);
      const b = await request(app)
        .get(`/api/admin/jahrgaenge/${JG_B}/attendance-matrix`)
        .set('Authorization', `Bearer ${orgAdminToken}`);
      expect(a.status).toBe(200);
      expect(b.status).toBe(200);
    });
  });

  // ================================================================
  // Wrapped: Freigabe (POST /generate/:jahrgangId) und Historie
  // ================================================================
  describe('Wrapped', () => {
    it('generate: Admin DARF den eigenen Jahrgang freigeben', async () => {
      const res = await request(app)
        .post(`/api/wrapped/generate/${JG_A}`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);

      expect(res.status).toBe(200);
      const { rows } = await db.query(
        'SELECT wrapped_released_at FROM jahrgaenge WHERE id = $1', [JG_A]
      );
      expect(rows[0].wrapped_released_at).not.toBe(null);
    });

    it('generate: Admin DARF NICHT den fremden Jahrgang freigeben — 403, keine Freigabe, kein Snapshot', async () => {
      const res = await request(app)
        .post(`/api/wrapped/generate/${JG_B}`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Kein Zugriff auf diesen Jahrgang');
      const { rows } = await db.query(
        'SELECT wrapped_released_at FROM jahrgaenge WHERE id = $1', [JG_B]
      );
      expect(rows[0].wrapped_released_at).toBe(null);
      const { rows: snaps } = await db.query(
        'SELECT COUNT(*)::int AS c FROM wrapped_snapshots WHERE jahrgang_id = $1', [JG_B]
      );
      expect(snaps[0].c).toBe(0);
    });

    it('generate: Admin ohne Jahrgang bekommt 403', async () => {
      const res = await request(app)
        .post(`/api/wrapped/generate/${JG_A}`)
        .set('Authorization', `Bearer ${adminOhneJgToken}`);

      expect(res.status).toBe(403);
    });

    it('generate: REGRESSION org_admin gibt jeden Jahrgang frei; fremde Org sieht 404', async () => {
      const res = await request(app)
        .post(`/api/wrapped/generate/${JG_B}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);
      expect(res.status).toBe(200);

      const fremd = await request(app)
        .post(`/api/wrapped/generate/${JG_A}`)
        .set('Authorization', `Bearer ${generateToken('admin2')}`);
      expect(fremd.status).toBe(404);
    });

    it('history: Admin liest die Historie im eigenen Jahrgang, nicht im fremden', async () => {
      const eigene = await request(app)
        .get(`/api/wrapped/history/${KONFI_A}`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);
      expect(eigene.status).toBe(200);
      expect(Array.isArray(eigene.body)).toBe(true);

      const fremde = await request(app)
        .get(`/api/wrapped/history/${KONFI_B}`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);
      expect(fremde.status).toBe(403);
      expect(fremde.body.error).toBe('Keine Berechtigung');
    });

    it('history: Teamer:in als Ziel bleibt fuer jeden Admin lesbar (Teamer-Ausnahme)', async () => {
      const res = await request(app)
        .get(`/api/wrapped/history/${TEAMER_ZIEL}`)
        .set('Authorization', `Bearer ${adminOhneJgToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('history: REGRESSION org_admin liest jede Historie', async () => {
      const res = await request(app)
        .get(`/api/wrapped/history/${KONFI_B}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);
      expect(res.status).toBe(200);
    });
  });

  // ================================================================
  // Konfi-Detaildaten (event-points, badges, attendance-stats)
  // ================================================================
  describe('Konfi-Detaildaten', () => {
    it('event-points: eigener Jahrgang 200 (Array), fremder 403', async () => {
      const eigene = await request(app)
        .get(`/api/admin/konfis/${KONFI_A}/event-points`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);
      expect(eigene.status).toBe(200);
      expect(Array.isArray(eigene.body)).toBe(true);

      const fremde = await request(app)
        .get(`/api/admin/konfis/${KONFI_B}/event-points`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);
      expect(fremde.status).toBe(403);
      expect(fremde.body.error).toBe('Kein Zugriff auf diesen Konfi');
    });

    it('badges: eigener Jahrgang 200, fremder 403', async () => {
      const eigene = await request(app)
        .get(`/api/admin/konfis/${KONFI_A}/badges`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);
      expect(eigene.status).toBe(200);

      const fremde = await request(app)
        .get(`/api/admin/konfis/${KONFI_B}/badges`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);
      expect(fremde.status).toBe(403);
    });

    it('attendance-stats: eigener Jahrgang 200, fremder 403', async () => {
      const eigene = await request(app)
        .get(`/api/admin/konfis/${KONFI_A}/attendance-stats`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);
      expect(eigene.status).toBe(200);
      expect(eigene.body.total_mandatory).toBe(0);

      const fremde = await request(app)
        .get(`/api/admin/konfis/${KONFI_B}/attendance-stats`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);
      expect(fremde.status).toBe(403);
    });

    it('REGRESSION org_admin liest alle drei Ansichten des fremden Jahrgangs', async () => {
      for (const pfad of ['event-points', 'badges', 'attendance-stats']) {
        const res = await request(app)
          .get(`/api/admin/konfis/${KONFI_B}/${pfad}`)
          .set('Authorization', `Bearer ${orgAdminToken}`);
        expect(res.status).toBe(200);
      }
    });
  });

  // ================================================================
  // Konfi-Verwaltung (loeschen, Passwort, Punkte-Eingriffe)
  // ================================================================
  describe('Konfi-Verwaltung', () => {
    it('DELETE Konfi: fremder Jahrgang 403, Konfi bleibt; eigener 200, Konfi weg', async () => {
      const fremde = await request(app)
        .delete(`/api/admin/konfis/${KONFI_B}`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);
      expect(fremde.status).toBe(403);
      const { rows: nochDa } = await db.query(
        'SELECT COUNT(*)::int AS c FROM users WHERE id = $1 AND deleted_at IS NULL', [KONFI_B]
      );
      expect(nochDa[0].c).toBe(1);

      const eigene = await request(app)
        .delete(`/api/admin/konfis/${KONFI_A}`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);
      expect(eigene.status).toBe(200);
    });

    it('DELETE Konfi: view ohne edit reicht NICHT — 403', async () => {
      await db.query(
        'UPDATE user_jahrgang_assignments SET can_edit = false WHERE user_id = $1 AND jahrgang_id = $2',
        [ADMIN_MIT_JG, JG_A]
      );
      require('../../middleware/rbac').invalidateUserCache(ADMIN_MIT_JG);

      const res = await request(app)
        .delete(`/api/admin/konfis/${KONFI_A}`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);
      expect(res.status).toBe(403);
    });

    it('regenerate-password: fremder Jahrgang 403, Hash unveraendert; eigener 200', async () => {
      const { rows: [vorher] } = await db.query('SELECT password_hash FROM users WHERE id = $1', [KONFI_B]);

      const fremde = await request(app)
        .post(`/api/admin/konfis/${KONFI_B}/regenerate-password`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);
      expect(fremde.status).toBe(403);
      const { rows: [nachher] } = await db.query('SELECT password_hash FROM users WHERE id = $1', [KONFI_B]);
      expect(nachher.password_hash).toBe(vorher.password_hash);

      const eigene = await request(app)
        .post(`/api/admin/konfis/${KONFI_A}/regenerate-password`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);
      expect(eigene.status).toBe(200);
      expect(typeof eigene.body.temporaryPassword).toBe('string');
    });

    it('regenerate-password: Teamer:in als Ziel gibt 404 — die Route ist nur fuer Konfis', async () => {
      const res = await request(app)
        .post(`/api/admin/konfis/${TEAMER_ZIEL}/regenerate-password`)
        .set('Authorization', `Bearer ${orgAdminToken}`);
      expect(res.status).toBe(404);
    });

    it('Bonuspunkte loeschen: fremder Jahrgang 403, Punkte bleiben', async () => {
      // Bonus direkt anlegen (der POST-Weg ist fuer den Admin ja gesperrt).
      const { rows: [bonus] } = await db.query(
        `INSERT INTO bonus_points (konfi_id, points, type, description, admin_id, organization_id, created_at)
         VALUES ($1, 2, 'gemeinde', 'Test', $2, 1, NOW()) RETURNING id`,
        [KONFI_B, ADMIN_MIT_JG]
      );
      await db.query('UPDATE konfi_profiles SET gemeinde_points = 2 WHERE user_id = $1', [KONFI_B]);

      const res = await request(app)
        .delete(`/api/admin/konfis/${KONFI_B}/bonus-points/${bonus.id}`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);
      expect(res.status).toBe(403);
      const { rows } = await db.query('SELECT gemeinde_points FROM konfi_profiles WHERE user_id = $1', [KONFI_B]);
      expect(rows[0].gemeinde_points).toBe(2);
      const { rows: eintraege } = await db.query('SELECT COUNT(*)::int AS c FROM bonus_points WHERE id = $1', [bonus.id]);
      expect(eintraege[0].c).toBe(1);
    });

    it('Aktivitaet vergeben (POST /:id/activities): eigener Jahrgang 200, fremder 403', async () => {
      const eigene = await request(app)
        .post(`/api/admin/konfis/${KONFI_A}/activities`)
        .set('Authorization', `Bearer ${adminMitJgToken}`)
        .send({ activity_id: ACTIVITIES.sonntagsgottesdienst.id, completed_date: '2026-08-30' });
      expect(eigene.status).toBe(201);

      const fremde = await request(app)
        .post(`/api/admin/konfis/${KONFI_B}/activities`)
        .set('Authorization', `Bearer ${adminMitJgToken}`)
        .send({ activity_id: ACTIVITIES.sonntagsgottesdienst.id, completed_date: '2026-08-30' });
      expect(fremde.status).toBe(403);
      const { rows } = await db.query('SELECT COUNT(*)::int AS c FROM user_activities WHERE user_id = $1', [KONFI_B]);
      expect(rows[0].c).toBe(0);
    });

    it('Aktivitaet loeschen: fremder Jahrgang 403, Punkte bleiben', async () => {
      // Vergabe als org_admin, damit der Eintrag existiert.
      const anlegen = await request(app)
        .post(`/api/admin/konfis/${KONFI_B}/activities`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ activity_id: ACTIVITIES.sonntagsgottesdienst.id, completed_date: '2026-08-30' });
      expect(anlegen.status).toBe(201);
      const { rows: [eintrag] } = await db.query(
        'SELECT id FROM user_activities WHERE user_id = $1', [KONFI_B]
      );

      const res = await request(app)
        .delete(`/api/admin/konfis/${KONFI_B}/activities/${eintrag.id}`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);
      expect(res.status).toBe(403);
      const { rows } = await db.query('SELECT gottesdienst_points FROM konfi_profiles WHERE user_id = $1', [KONFI_B]);
      expect(rows[0].gottesdienst_points).toBe(1);
    });
  });

  // ================================================================
  // Befoerderung zum Teamer
  // ================================================================
  describe('POST /api/admin/konfis/:id/promote-teamer', () => {
    it('Admin befoerdert im eigenen Jahrgang — OHNE automatische Jahrgangs-Zuweisung', async () => {
      const res = await request(app)
        .post(`/api/admin/konfis/${KONFI_A}/promote-teamer`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.role_name).toBe('teamer');

      // Simons Regel: Teamer:innen existieren auch ohne Jahrgang, die
      // Zuweisung kommt bewusst spaeter. Der fruehere Automatik-Eintrag
      // (view+edit auf den eigenen alten Jahrgang!) darf nicht mehr entstehen.
      const { rows } = await db.query(
        'SELECT COUNT(*)::int AS c FROM user_jahrgang_assignments WHERE user_id = $1', [KONFI_A]
      );
      expect(rows[0].c).toBe(0);

      // Die eingefrorenen Konfi-Daten bleiben (konfi_profiles haengt nicht an
      // der Zuweisung).
      const { rows: profil } = await db.query(
        'SELECT COUNT(*)::int AS c FROM konfi_profiles WHERE user_id = $1', [KONFI_A]
      );
      expect(profil[0].c).toBe(1);
    });

    it('Admin DARF NICHT im fremden Jahrgang befoerdern — 403, Rolle bleibt konfi', async () => {
      const res = await request(app)
        .post(`/api/admin/konfis/${KONFI_B}/promote-teamer`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Kein Zugriff auf diesen Konfi');
      const { rows } = await db.query(
        `SELECT r.name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1`, [KONFI_B]
      );
      expect(rows[0].name).toBe('konfi');
    });

    it('REGRESSION org_admin befoerdert in jedem Jahrgang — ebenfalls ohne Automatik-Zuweisung', async () => {
      const res = await request(app)
        .post(`/api/admin/konfis/${KONFI_B}/promote-teamer`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      const { rows } = await db.query(
        'SELECT COUNT(*)::int AS c FROM user_jahrgang_assignments WHERE user_id = $1', [KONFI_B]
      );
      expect(rows[0].c).toBe(0);
    });
  });

  // ================================================================
  // Material (GET /api/material)
  // ================================================================
  describe('GET /api/material', () => {
    // Drei Materialien: eines im eigenen Jahrgang, eines im fremden,
    // eines ohne Jahrgang (= fuer alle).
    let matEigen, matFremd, matOhne;

    beforeEach(async () => {
      const anlegen = async (title) => {
        const { rows: [m] } = await db.query(
          `INSERT INTO materials (title, organization_id, created_by) VALUES ($1, 1, $2) RETURNING id`,
          [title, USERS.orgAdmin1.id]
        );
        return m.id;
      };
      matEigen = await anlegen('Material JG-A');
      matFremd = await anlegen('Material JG-B');
      matOhne = await anlegen('Material ohne Jahrgang');
      await db.query(
        'INSERT INTO material_jahrgaenge (material_id, jahrgang_id) VALUES ($1, $2), ($3, $4)',
        [matEigen, JG_A, matFremd, JG_B]
      );
    });

    it('Admin sieht eigenes und allgemeines Material, nicht das fremde', async () => {
      const res = await request(app)
        .get('/api/material')
        .set('Authorization', `Bearer ${adminMitJgToken}`);

      expect(res.status).toBe(200);
      const titel = res.body.map(m => m.title);
      expect(titel).toContain('Material JG-A');
      expect(titel).toContain('Material ohne Jahrgang');
      expect(titel).not.toContain('Material JG-B');
    });

    it('Admin ohne Jahrgang sieht nur das allgemeine Material', async () => {
      const res = await request(app)
        .get('/api/material')
        .set('Authorization', `Bearer ${adminOhneJgToken}`);

      expect(res.status).toBe(200);
      const titel = res.body.map(m => m.title);
      expect(titel).toEqual(['Material ohne Jahrgang']);
    });

    it('REGRESSION org_admin sieht weiterhin alles', async () => {
      const res = await request(app)
        .get('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(3);
    });
  });

  // ================================================================
  // Challenges-Verwaltungsliste (GET /api/challenges/admin)
  // ================================================================
  describe('GET /api/challenges/admin ohne Jahrgang', () => {
    it("'nur_team'-Challenges bleiben ohne Zuweisung sichtbar (Widerspruch zu leadershipMayAccess behoben)", async () => {
      const { rows: [team] } = await db.query(
        `INSERT INTO challenges (organization_id, title, description, badge_name,
                                 starts_at, ends_at, is_draft, audience)
         VALUES (1, 'Team-Runde', 'B', 'A', NOW() - interval '1 day',
                 NOW() + interval '7 days', false, 'nur_team') RETURNING id`
      );
      await db.query(
        `INSERT INTO challenges (organization_id, title, description, badge_name,
                                 starts_at, ends_at, is_draft, audience)
         VALUES (1, 'Konfi-Runde JG-B', 'B', 'A', NOW() - interval '1 day',
                 NOW() + interval '7 days', false, 'konfis') RETURNING id`
      );

      const res = await request(app)
        .get('/api/challenges/admin')
        .set('Authorization', `Bearer ${adminOhneJgToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].id).toBe(team.id);
      // Der Grund-Header bleibt: keine Zuweisung, nur der Team-Anteil ist da.
      expect(res.headers['x-kein-jahrgang-zugewiesen']).toBe('true');
    });
  });

  // ================================================================
  // Badge-Zaehler (GET /api/notifications/badge-counts)
  // ================================================================
  describe('GET /api/notifications/badge-counts', () => {
    it('Admin zaehlt nur Antraege aus seinen Jahrgaengen', async () => {
      await antragAnlegen(KONFI_A);
      await antragAnlegen(KONFI_B);

      const res = await request(app)
        .get('/api/notifications/badge-counts')
        .set('Authorization', `Bearer ${adminMitJgToken}`);

      expect(res.status).toBe(200);
      expect(res.body.pendingRequests).toBe(1);
    });

    it('Admin ohne Jahrgang zaehlt nur Teamer-Antraege', async () => {
      await antragAnlegen(KONFI_A);
      await antragAnlegen(TEAMER_ZIEL, 'pending', TEAMER_AKTIVITAET);

      const res = await request(app)
        .get('/api/notifications/badge-counts')
        .set('Authorization', `Bearer ${adminOhneJgToken}`);

      expect(res.status).toBe(200);
      expect(res.body.pendingRequests).toBe(1);
    });

    it('Admin zaehlt nur unverbuchte Termine seiner Jahrgaenge', async () => {
      // Vergangener Termin im fremden Jahrgang mit offener Buchung.
      await db.query(
        `INSERT INTO events (id, name, event_date, organization_id)
         VALUES (405, 'Vergangener Termin JG-B', NOW() - interval '2 days', 1)`
      );
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES (405, $1)', [JG_B]
      );
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, status, organization_id)
         VALUES ($1, 405, 'confirmed', 1)`,
        [KONFI_B]
      );

      const gebunden = await request(app)
        .get('/api/notifications/badge-counts')
        .set('Authorization', `Bearer ${adminMitJgToken}`);
      expect(gebunden.status).toBe(200);
      expect(gebunden.body.pendingEvents).toBe(0);

      const orgWeit = await request(app)
        .get('/api/notifications/badge-counts')
        .set('Authorization', `Bearer ${orgAdminToken}`);
      expect(orgWeit.status).toBe(200);
      expect(orgWeit.body.pendingEvents).toBe(1);
    });

    it('REGRESSION org_admin zaehlt Antraege org-weit', async () => {
      await antragAnlegen(KONFI_A);
      await antragAnlegen(KONFI_B);

      const res = await request(app)
        .get('/api/notifications/badge-counts')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.pendingRequests).toBe(2);
    });
  });
});
