// Jahrgangs-Zuweisung fuer Personen, die ueber user_organizations in der
// Gemeinde sind (POST /api/admin/users/:id/jahrgaenge)
//
// BEFUND (26.09.2026): Wer in zwei Gemeinden arbeitet, war in der zweiten
// nicht verwaltbar. Zwei Stellen suchten die Zielperson allein ueber die
// Stamm-Gemeinde:
//   roleHierarchy.js:95  WHERE u.id = $1 AND u.organization_id = $2
//   users.js:657         SELECT id FROM users WHERE id = $1 AND organization_id = $2
// Eine Teamer:in mit Stamm-Gemeinde A, die ueber user_organizations auch in B
// arbeitet, existierte fuer beide Pruefungen in B nicht -> 404. Ein Admin,
// dessen Stamm-Gemeinde B ist, konnte dieselbe Zuweisung vornehmen; wer aus A
// kam, nicht. Das Handbuch beschrieb einen Vorgang, den niemand ausfuehren
// konnte.
//
// DASSELBE MUSTER wie bei den Push-Empfaengern (25.09.2026, orgMitglieder.js):
// users.organization_id ist nur die Stamm-Gemeinde, die Zugehoerigkeit steht
// in user_organizations -- mit eigener role_id je Gemeinde.
//
// DIE ROLLE GILT JE GEMEINDE: Die Hierarchiepruefung (canManageRole) muss
// gegen die Rolle greifen, die die Zielperson IN DIESER Gemeinde hat, nicht
// gegen die an ihrem Konto. Wer in A Teamer:in und in B Org-Admin ist, darf in
// B nicht von einem Admin verwaltet werden.

const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE, ROLES } = require('../helpers/seed');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-vitest';

// IDs oberhalb des Seed-Bereichs
const GAST = 221;       // Stamm-Gemeinde Org 1, arbeitet zusaetzlich in Org 2
const GAST_CHEF = 222;  // Stamm-Gemeinde Org 1, in Org 2 org_admin

function tokenFuer(id, roleId, orgId) {
  return jwt.sign(
    { id, type: 'admin', display_name: `User ${id}`, organization_id: orgId, role_id: roleId },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('POST /users/:id/jahrgaenge — Personen aus user_organizations', () => {
  let app;
  let db;
  let orgAdmin2Token;

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

    // Teamer:in mit Stamm-Gemeinde Org 1, die zusaetzlich in Org 2 arbeitet.
    // In Org 2 traegt sie die Teamer-Rolle DIESER Gemeinde (role_id 7).
    await db.query(
      `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
       VALUES ($1, 'gast-teamer', 'x', 'Gast Teamer', $2, 1, true)`,
      [GAST, ROLES.teamer.id]
    );
    await db.query(
      `INSERT INTO user_organizations (user_id, organization_id, role_id)
       VALUES ($1, 2, $2)`,
      [GAST, ROLES.teamer2.id]
    );

    // Dieselbe Konstellation, aber in Org 2 als org_admin: ein Admin aus Org 2
    // darf diese Person dort NICHT verwalten (canManageRole: admin -> nur
    // teamer und konfi).
    await db.query(
      `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
       VALUES ($1, 'gast-chef', 'x', 'Gast Chef', $2, 1, true)`,
      [GAST_CHEF, ROLES.teamer.id]
    );
    await db.query(
      `INSERT INTO user_organizations (user_id, organization_id, role_id)
       VALUES ($1, 2, $2)`,
      [GAST_CHEF, ROLES.orgAdmin2.id]
    );

    orgAdmin2Token = tokenFuer(USERS.orgAdmin2.id, USERS.orgAdmin2.role_id, 2);
  });

  const zuweisungenVon = async (userId) => {
    const { rows } = await db.query(
      `SELECT jahrgang_id FROM user_jahrgang_assignments WHERE user_id = $1 ORDER BY jahrgang_id`,
      [userId]
    );
    return rows.map(r => Number(r.jahrgang_id));
  };

  // ---- der erlaubte Fall -------------------------------------------------

  it('weist einer Person aus user_organizations den Jahrgang DIESER Gemeinde zu', async () => {
    const res = await request(app)
      .post(`/api/admin/users/${GAST}/jahrgaenge`)
      .set('Authorization', `Bearer ${orgAdmin2Token}`)
      .send({ jahrgang_assignments: [{ jahrgang_id: JAHRGAENGE.jahrgang2.id, can_view: true, can_edit: false }] });

    expect(res.status).toBe(200);
    expect(await zuweisungenVon(GAST)).toEqual([JAHRGAENGE.jahrgang2.id]);
  });

  it('laesst die Zuweisungen der Stamm-Gemeinde dabei unberuehrt', async () => {
    // Ausgangslage: In ihrer Stamm-Gemeinde (Org 1) haengt sie an jahrgang1.
    await db.query(
      `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit)
       VALUES ($1, $2, true, false)`,
      [GAST, JAHRGAENGE.jahrgang1.id]
    );

    const res = await request(app)
      .post(`/api/admin/users/${GAST}/jahrgaenge`)
      .set('Authorization', `Bearer ${orgAdmin2Token}`)
      .send({ jahrgang_assignments: [{ jahrgang_id: JAHRGAENGE.jahrgang2.id, can_view: true, can_edit: false }] });

    expect(res.status).toBe(200);
    // Beide stehen da: die alte aus Org 1, die neue aus Org 2. Das DELETE ist
    // an die Organisation gebunden (jahrgangsZuweisungOrgGrenze.test.js).
    expect(await zuweisungenVon(GAST)).toEqual([
      JAHRGAENGE.jahrgang1.id, JAHRGAENGE.jahrgang2.id,
    ]);
  });

  // ---- die verbotenen Faelle --------------------------------------------

  it('weist einen Jahrgang einer FREMDEN Gemeinde ab', async () => {
    // jahrgang1 gehoert zu Org 1, der Aufrufer sitzt in Org 2.
    const res = await request(app)
      .post(`/api/admin/users/${GAST}/jahrgaenge`)
      .set('Authorization', `Bearer ${orgAdmin2Token}`)
      .send({ jahrgang_assignments: [{ jahrgang_id: JAHRGAENGE.jahrgang1.id, can_view: true, can_edit: false }] });

    expect(res.status).toBe(400);
    expect(await zuweisungenVon(GAST)).toEqual([]);
  });

  it('weist eine Person ab, die in dieser Gemeinde gar nicht arbeitet', async () => {
    // teamer1 hat Stamm-Gemeinde Org 1 und KEINEN user_organizations-Eintrag
    // fuer Org 2 -> fuer den Aufrufer aus Org 2 nicht sichtbar.
    // Aus dem Seed haengt sie an jahrgang1 (Org 1); genau diese Zuweisung darf
    // der abgewiesene Aufruf nicht anfassen.
    expect(await zuweisungenVon(USERS.teamer1.id)).toEqual([JAHRGAENGE.jahrgang1.id]);

    const res = await request(app)
      .post(`/api/admin/users/${USERS.teamer1.id}/jahrgaenge`)
      .set('Authorization', `Bearer ${orgAdmin2Token}`)
      .send({ jahrgang_assignments: [{ jahrgang_id: JAHRGAENGE.jahrgang2.id, can_view: true, can_edit: false }] });

    expect(res.status).toBe(404);
    expect(await zuweisungenVon(USERS.teamer1.id)).toEqual([JAHRGAENGE.jahrgang1.id]);
  });

  // ---- die Detailansicht, die davor geladen wird ------------------------

  it('zeigt die Person in der Detailansicht mit der Rolle DIESER Gemeinde', async () => {
    // Die Oberflaeche laedt GET /:id, bevor sie Jahrgaenge zuweisen laesst.
    // Blieb diese Route bei der Stamm-Gemeinde, waere die Person zwar
    // verwaltbar, aber nicht anzeigbar.
    const res = await request(app)
      .get(`/api/admin/users/${GAST_CHEF}`)
      .set('Authorization', `Bearer ${orgAdmin2Token}`);

    expect(res.status).toBe(200);
    expect(Number(res.body.id)).toBe(GAST_CHEF);
    // Am Konto Teamer:in (Org 1), in Org 2 org_admin -- angezeigt wird Org 2.
    expect(res.body.role_name).toBe('org_admin');
    expect(Number(res.body.role_id)).toBe(ROLES.orgAdmin2.id);
  });

  it('zeigt in der Detailansicht nur die Jahrgaenge DIESER Gemeinde', async () => {
    await db.query(
      `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit)
       VALUES ($1, $2, true, false), ($1, $3, true, false)`,
      [GAST, JAHRGAENGE.jahrgang1.id, JAHRGAENGE.jahrgang2.id]
    );

    const res = await request(app)
      .get(`/api/admin/users/${GAST}`)
      .set('Authorization', `Bearer ${orgAdmin2Token}`);

    expect(res.status).toBe(200);
    // jahrgang1 gehoert zu Org 1 und darf hier nicht auftauchen.
    expect(res.body.assigned_jahrgaenge.map(j => Number(j.id))).toEqual([JAHRGAENGE.jahrgang2.id]);
  });

  it('prueft die Hierarchie gegen die Rolle DIESER Gemeinde, nicht die am Konto', async () => {
    // GAST_CHEF ist am Konto Teamer:in (Org 1), in Org 2 aber org_admin.
    // Ein admin aus Org 2 darf sie dort NICHT verwalten -- wer die Rolle am
    // Konto liest, sieht faelschlich 'teamer' und laesst es durch.
    const admin2Token = tokenFuer(USERS.admin2.id, USERS.admin2.role_id, 2);

    const res = await request(app)
      .post(`/api/admin/users/${GAST_CHEF}/jahrgaenge`)
      .set('Authorization', `Bearer ${admin2Token}`)
      .send({ jahrgang_assignments: [{ jahrgang_id: JAHRGAENGE.jahrgang2.id, can_view: true, can_edit: false }] });

    expect(res.status).toBe(403);
    expect(await zuweisungenVon(GAST_CHEF)).toEqual([]);
  });
});
