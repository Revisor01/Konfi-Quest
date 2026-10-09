// backend/tests/routes/antragEinzelnUndJePerson.test.js
//
// Einen Antrag einzeln laden, die Antraege EINER Person laden (28.09.2026,
// Leitung BF-04).
//
// Vorher lud der Antragsdialog der Leitung beim Oeffnen EINES Antrags die
// ganze Antragsliste der Gemeinde (GET /admin/activities/requests, ohne
// LIMIT) und suchte darin per .find() den einen heraus; die Detailansicht
// einer Konfi lud dieselbe Gesamtliste, um die Antraege einer Person zu
// finden. Genehmigte Antraege werden nie geloescht -- die Liste waechst mit
// jedem Jahrgang.
//
// Jetzt additiv:
//   - GET /admin/activities/requests/:id  -- ein Antrag, dieselben Felder wie
//     ein Listeneintrag, dieselbe Sichtregel wie die Liste
//     (utils/antragLeitungSicht.js).
//   - ?user_id= an der Liste -- nur die Antraege dieser Person.
// Die Liste OHNE Parameter bleibt exakt, wie sie war: Store-Apps 2.2.x/2.3.0
// oeffnen den Antrag weiter ueber die Gesamtliste und .find().
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ACTIVITIES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-vitest';

// IDs oberhalb des Seed-Bereichs (wie jahrgangsBindungAdmin.test.js).
const JG_A = 101;
const JG_B = 102;
const KONFI_A = 201;
const KONFI_B = 202;
const ADMIN_MIT_JG = 203;
const ADMIN_OHNE_JG = 204;
const TEAMER_ZIEL = 205;
const TEAMER_AKTIVITAET = 301;

// Die Felder eines Listeneintrags (ar.* + Namen). Steht hier ausgeschrieben,
// damit eine Aenderung an der Form der Liste auffaellt -- alte Apps lesen sie.
// darf_entscheiden seit 09.10.2026 (Darf freigeben), additiv.
const LISTENFELDER = [
  'activity_id', 'activity_name', 'activity_points', 'activity_target_role',
  'activity_type', 'admin_comment', 'approved_by', 'approved_by_name',
  'client_id', 'comment', 'created_at', 'darf_entscheiden', 'id', 'konfi_name', 'organization_id',
  'photo_filename', 'requested_date', 'status', 'updated_at', 'user_id',
];

function tokenFuer(id, roleId, orgId = 1) {
  return jwt.sign(
    { id, type: 'admin', display_name: `User ${id}`, organization_id: orgId, role_id: roleId },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('Antrag einzeln und je Person (Leitung BF-04)', () => {
  let app;
  let db;
  let adminMitJgToken;
  let adminOhneJgToken;
  let orgAdminToken;
  let orgAdmin2Token;
  let teamerToken;

  beforeAll(() => {
    db = getTestPool();
    app = getTestApp(db);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);

    await db.query(
      `INSERT INTO jahrgaenge (id, name, organization_id, confirmation_date)
       VALUES ($1, '2026/2027 A', 1, '2027-05-01'), ($2, '2026/2027 B', 1, '2027-05-01')`,
      [JG_A, JG_B]
    );
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
    for (const [id, name] of [[ADMIN_MIT_JG, 'Admin mit Jahrgang'], [ADMIN_OHNE_JG, 'Admin ohne Jahrgang']]) {
      await db.query(
        `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
         VALUES ($1, $2, 'x', $3, 3, 1, true)`,
        [id, `admin_${id}`, name]
      );
    }
    await db.query(
      `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit)
       VALUES ($1, $2, true, true)`,
      [ADMIN_MIT_JG, JG_A]
    );
    await db.query(
      `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
       VALUES ($1, 'teamer_ziel', 'x', 'Teamer Ziel', 2, 1, true)`,
      [TEAMER_ZIEL]
    );
    await db.query(
      `INSERT INTO activities (id, name, points, type, organization_id, target_role)
       VALUES ($1, 'Teamer-Schulung', 0, NULL, 1, 'teamer')`,
      [TEAMER_AKTIVITAET]
    );

    adminMitJgToken = tokenFuer(ADMIN_MIT_JG, 3);
    adminOhneJgToken = tokenFuer(ADMIN_OHNE_JG, 3);
    orgAdminToken = generateToken('orgAdmin1');
    orgAdmin2Token = generateToken('orgAdmin2');
    teamerToken = generateToken('teamer1');

    for (const id of [ADMIN_MIT_JG, ADMIN_OHNE_JG, KONFI_A, KONFI_B, TEAMER_ZIEL]) invalidateUserCache(id);
    for (const u of Object.values(USERS)) invalidateUserCache(u.id);
  });

  async function antragAnlegen(userId, { status = 'pending', activityId = ACTIVITIES.sonntagsgottesdienst.id, orgId = 1 } = {}) {
    const { rows: [row] } = await db.query(
      `INSERT INTO activity_requests (user_id, activity_id, requested_date, status, organization_id, comment)
       VALUES ($1, $2, CURRENT_DATE, $3, $4, 'Nachweis') RETURNING id`,
      [userId, activityId, status, orgId]
    );
    return Number(row.id);
  }

  // ==================================================================
  // GET /api/admin/activities/requests/:id
  // ==================================================================
  describe('GET /requests/:id', () => {
    it('liefert genau den Listeneintrag des Antrags (gleiche Felder, gleiche Werte)', async () => {
      const id = await antragAnlegen(KONFI_A);
      await antragAnlegen(KONFI_B);

      const einzeln = await request(app)
        .get(`/api/admin/activities/requests/${id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);
      const liste = await request(app)
        .get('/api/admin/activities/requests')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(einzeln.status).toBe(200);
      expect(Array.isArray(einzeln.body)).toBe(false);
      expect(Object.keys(einzeln.body).sort()).toEqual(LISTENFELDER);
      expect(einzeln.body).toEqual(liste.body.find((r) => r.id === id));
      expect(einzeln.body.konfi_name).toBe('Konfi JG-A');
      expect(einzeln.body.activity_name).toBe(ACTIVITIES.sonntagsgottesdienst.name);
    });

    it('Admin mit Jahrgang: Antrag aus dem eigenen Jahrgang 200', async () => {
      const id = await antragAnlegen(KONFI_A);

      const res = await request(app)
        .get(`/api/admin/activities/requests/${id}`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
      expect(res.body.user_id).toBe(KONFI_A);
    });

    it('Admin mit Jahrgang: Antrag aus einem fremden Jahrgang 403 — die Liste zeigt ihn ebenso nicht', async () => {
      const id = await antragAnlegen(KONFI_B);

      const res = await request(app)
        .get(`/api/admin/activities/requests/${id}`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Kein Zugriff auf diesen Konfi' });

      const liste = await request(app)
        .get('/api/admin/activities/requests')
        .set('Authorization', `Bearer ${adminMitJgToken}`);
      expect(liste.body.map((r) => r.id)).not.toContain(id);
    });

    it('Admin ohne Jahrgang: Konfi-Antrag 403, Teamer-Antrag 200 (wie die Liste)', async () => {
      const konfiAntrag = await antragAnlegen(KONFI_A);
      const teamerAntrag = await antragAnlegen(TEAMER_ZIEL, { activityId: TEAMER_AKTIVITAET });

      const verboten = await request(app)
        .get(`/api/admin/activities/requests/${konfiAntrag}`)
        .set('Authorization', `Bearer ${adminOhneJgToken}`);
      expect(verboten.status).toBe(403);

      const erlaubt = await request(app)
        .get(`/api/admin/activities/requests/${teamerAntrag}`)
        .set('Authorization', `Bearer ${adminOhneJgToken}`);
      expect(erlaubt.status).toBe(200);
      expect(erlaubt.body.user_id).toBe(TEAMER_ZIEL);
      expect(erlaubt.body.activity_target_role).toBe('teamer');
    });

    it('Antrag einer fremden Gemeinde: 404 in beide Richtungen', async () => {
      const antragOrg2 = await antragAnlegen(USERS.konfi3.id, { activityId: ACTIVITIES.gottesdienst2.id, orgId: 2 });
      const antragOrg1 = await antragAnlegen(KONFI_A);

      const vonOrg1 = await request(app)
        .get(`/api/admin/activities/requests/${antragOrg2}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);
      expect(vonOrg1.status).toBe(404);
      expect(vonOrg1.body).toEqual({ error: 'Antrag nicht gefunden' });

      const vonOrg2 = await request(app)
        .get(`/api/admin/activities/requests/${antragOrg1}`)
        .set('Authorization', `Bearer ${orgAdmin2Token}`);
      expect(vonOrg2.status).toBe(404);

      // Gegenstueck: die eigene Gemeinde sieht ihren Antrag.
      const eigen = await request(app)
        .get(`/api/admin/activities/requests/${antragOrg2}`)
        .set('Authorization', `Bearer ${orgAdmin2Token}`);
      expect(eigen.status).toBe(200);
      expect(eigen.body.user_id).toBe(USERS.konfi3.id);
    });

    it('unbekannte Id 404, ungültige Id 400', async () => {
      const unbekannt = await request(app)
        .get('/api/admin/activities/requests/999999')
        .set('Authorization', `Bearer ${orgAdminToken}`);
      expect(unbekannt.status).toBe(404);

      const ungueltig = await request(app)
        .get('/api/admin/activities/requests/abc')
        .set('Authorization', `Bearer ${orgAdminToken}`);
      expect(ungueltig.status).toBe(400);
    });

    it('Teamer:innen sehen Anträge nicht — 403', async () => {
      const id = await antragAnlegen(USERS.konfi1.id);

      const res = await request(app)
        .get(`/api/admin/activities/requests/${id}`)
        .set('Authorization', `Bearer ${teamerToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ==================================================================
  // GET /api/admin/activities/requests?user_id=
  // ==================================================================
  describe('GET /requests?user_id=', () => {
    it('liefert nur die Anträge dieser Person — ein Array wie die Liste', async () => {
      const a1 = await antragAnlegen(KONFI_A);
      const a2 = await antragAnlegen(KONFI_A, { status: 'approved' });
      await antragAnlegen(KONFI_B);
      await antragAnlegen(USERS.konfi1.id);

      const res = await request(app)
        .get(`/api/admin/activities/requests?user_id=${KONFI_A}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.map((r) => r.id).sort((x, y) => x - y)).toEqual([a1, a2]);
      expect(Object.keys(res.body[0]).sort()).toEqual(LISTENFELDER);
    });

    it('lässt sich mit ?status= verbinden', async () => {
      const offen = await antragAnlegen(KONFI_A);
      await antragAnlegen(KONFI_A, { status: 'approved' });
      await antragAnlegen(KONFI_B);

      const res = await request(app)
        .get(`/api/admin/activities/requests?user_id=${KONFI_A}&status=pending`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.map((r) => r.id)).toEqual([offen]);
    });

    it('die Jahrgangsbindung gilt weiter: Person aus fremdem Jahrgang ergibt ein leeres Array', async () => {
      await antragAnlegen(KONFI_B);
      // Ein sichtbarer Antrag einer anderen Person: Er darf mit dem Filter
      // nicht auftauchen (ohne Filter staende er in der Antwort).
      await antragAnlegen(KONFI_A);

      const res = await request(app)
        .get(`/api/admin/activities/requests?user_id=${KONFI_B}`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('ungültige user_id ergibt 400 statt einer stillen Vollausgabe', async () => {
      await antragAnlegen(KONFI_A);

      for (const wert of ['abc', '0', '-3', '1.5']) {
        const res = await request(app)
          .get(`/api/admin/activities/requests?user_id=${wert}`)
          .set('Authorization', `Bearer ${orgAdminToken}`);
        expect(res.status).toBe(400);
      }
    });
  });

  // ==================================================================
  // Liste ohne Parameter: unveraendert (Vertrag mit den Store-Apps)
  // ==================================================================
  describe('GET /requests ohne Parameter', () => {
    it('liefert weiter alle Anträge der Gemeinde, neueste zuerst, mit denselben Feldern', async () => {
      const ids = [];
      ids.push(await antragAnlegen(KONFI_A));
      ids.push(await antragAnlegen(KONFI_B, { status: 'approved' }));
      ids.push(await antragAnlegen(USERS.konfi1.id, { status: 'rejected' }));
      ids.push(await antragAnlegen(TEAMER_ZIEL, { activityId: TEAMER_AKTIVITAET }));
      await antragAnlegen(USERS.konfi3.id, { activityId: ACTIVITIES.gottesdienst2.id, orgId: 2 });
      // created_at gestaffelt, damit die Reihenfolge feststeht.
      for (let i = 0; i < ids.length; i++) {
        await db.query(
          `UPDATE activity_requests SET created_at = NOW() - make_interval(mins => $2) WHERE id = $1`,
          [ids[i], 10 - i]
        );
      }

      const res = await request(app)
        .get('/api/admin/activities/requests')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.map((r) => r.id)).toEqual([...ids].reverse());
      for (const eintrag of res.body) {
        expect(Object.keys(eintrag).sort()).toEqual(LISTENFELDER);
      }
      expect(res.headers['x-kein-jahrgang-zugewiesen']).toBeUndefined();
    });
  });
});
