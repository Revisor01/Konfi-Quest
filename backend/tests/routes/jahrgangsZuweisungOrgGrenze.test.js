// Org-Grenze beim Ersetzen der Jahrgangs-Zuweisungen
// (POST /api/admin/users/:id/jahrgaenge)
//
// Die Route ersetzt die Zuweisungen eines Benutzers: erst loeschen, dann neu
// einfuegen. Der Insert-Pfad prueft die Organisation des Jahrgangs
// (`WHERE organization_id = $1 AND id IN (...)`), das DELETE tat es nicht — es
// loeschte allein ueber user_id.
//
// Das war KEINE ausnutzbare Luecke: Der Zielbenutzer wird zweifach an die
// Organisation des Aufrufers gebunden (userHierarchyMiddleware und die
// Existenzpruefung in der Route selbst), und eine org-fremde Zuweisung kann
// ueber die API gar nicht entstehen. Die Tests halten die Grenze trotzdem fest,
// damit sie nicht allein von den Aufrufern weiter oben abhaengt.

const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE } = require('../helpers/seed');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-vitest';

// IDs oberhalb des Seed-Bereichs
const JG_EIGEN = 111;   // zweiter Jahrgang in Org 1
const ZIEL = 211;       // Teamer:in in Org 1, deren Zuweisungen ersetzt werden

function tokenFuer(id, roleId, orgId) {
  return jwt.sign(
    { id, type: 'admin', display_name: `User ${id}`, organization_id: orgId, role_id: roleId },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('POST /users/:id/jahrgaenge — DELETE bleibt an die Organisation gebunden', () => {
  let app;
  let db;
  let orgAdminToken;

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

    // Zweiter Jahrgang in Org 1
    await db.query(
      `INSERT INTO jahrgaenge (id, name, organization_id, confirmation_date)
       VALUES ($1, '2026/2027', 1, '2027-05-01')`,
      [JG_EIGEN]
    );

    // Zielbenutzer: Teamer:in in Org 1 (org_admin darf teamer verwalten)
    await db.query(
      `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
       VALUES ($1, 'ziel-teamer', 'x', 'Ziel Teamer', 2, 1, true)`,
      [ZIEL]
    );

    orgAdminToken = tokenFuer(USERS.orgAdmin1.id, USERS.orgAdmin1.role_id, 1);
  });

  const zuweisungenVon = async (userId) => {
    const { rows } = await db.query(
      `SELECT jahrgang_id FROM user_jahrgang_assignments WHERE user_id = $1 ORDER BY jahrgang_id`,
      [userId]
    );
    return rows.map(r => Number(r.jahrgang_id));
  };

  it('ersetzt die Zuweisungen der EIGENEN Organisation (der erlaubte Fall)', async () => {
    // Ausgangslage: Ziel haengt an jahrgang1 (Org 1)
    await db.query(
      `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit)
       VALUES ($1, $2, true, false)`,
      [ZIEL, JAHRGAENGE.jahrgang1.id]
    );

    const res = await request(app)
      .post(`/api/admin/users/${ZIEL}/jahrgaenge`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ jahrgang_assignments: [{ jahrgang_id: JG_EIGEN, can_view: true, can_edit: false }] });

    expect(res.status).toBe(200);
    // Die alte Zuweisung ist weg, die neue steht — genau eine Zeile.
    expect(await zuweisungenVon(ZIEL)).toEqual([JG_EIGEN]);
  });

  it('laesst eine org-fremde Zuweisung unberuehrt (der verbotene Fall)', async () => {
    // Kuenstlich eingefuegt: ueber die API entsteht so etwas nicht.
    // jahrgang2 gehoert zu Org 2, der Aufrufer sitzt in Org 1.
    await db.query(
      `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit)
       VALUES ($1, $2, true, false), ($1, $3, true, false)`,
      [ZIEL, JAHRGAENGE.jahrgang1.id, JAHRGAENGE.jahrgang2.id]
    );
    expect(await zuweisungenVon(ZIEL)).toEqual([
      JAHRGAENGE.jahrgang1.id, JAHRGAENGE.jahrgang2.id,
    ]);

    const res = await request(app)
      .post(`/api/admin/users/${ZIEL}/jahrgaenge`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ jahrgang_assignments: [{ jahrgang_id: JG_EIGEN, can_view: true, can_edit: false }] });

    expect(res.status).toBe(200);
    // Die eigene Zuweisung wurde ersetzt, die fremde steht unveraendert da.
    expect(await zuweisungenVon(ZIEL)).toEqual([
      JAHRGAENGE.jahrgang2.id, JG_EIGEN,
    ].sort((a, b) => a - b));
  });

  it('eine leere Liste raeumt nur die eigene Organisation ab', async () => {
    // Der else-Zweig des DELETE (behaltenIds leer) — ohne Org-Bindung haette er
    // die fremde Zeile ebenfalls mitgenommen.
    await db.query(
      `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit)
       VALUES ($1, $2, true, false), ($1, $3, true, false)`,
      [ZIEL, JAHRGAENGE.jahrgang1.id, JAHRGAENGE.jahrgang2.id]
    );

    const res = await request(app)
      .post(`/api/admin/users/${ZIEL}/jahrgaenge`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ jahrgang_assignments: [] });

    expect(res.status).toBe(200);
    expect(await zuweisungenVon(ZIEL)).toEqual([JAHRGAENGE.jahrgang2.id]);
  });
});
