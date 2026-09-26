// Die Rolle beim Gemeindewechsel: was sie darf und was sie NICHT darf
//
// SIMONS FRAGE (26.09.2026): "Ist das dann jetzt nicht quasi ein Typ
// switcher. Waere ich in der App Review jetzt Teamer koennte ich doch einen
// role Wechsel machen, oder?"
//
// Die Antwort ist zweigeteilt, und beide Haelften stehen hier als Test:
//
// JA, ein Rollenwechsel ist gebaut -- und das ist gewollt. Wer in Gemeinde A
// Leitung und in Gemeinde B Teamer:in ist, arbeitet nach dem Wechsel in B
// wirklich als Teamer:in. rbac.js schreibt role_name auf die Rolle DIESER
// Gemeinde um (Migration 101).
//
// NEIN, es ist keine Rechteausweitung. Die Rolle kommt aus
// user_organizations.role_id in der Datenbank -- nicht aus dem Token, nicht
// aus einem Header, nicht aus einer Angabe der App. Man bekommt, was dort
// eingetragen ist, und sonst nichts:
//   - eine Gemeinde ohne eigenen Eintrag -> 403, kein stilles Zurueckfallen
//   - eine niedrigere Rolle in der Zweitgemeinde -> sie gilt dort auch
//   - die Rolle am Nutzerkonto hebt das NICHT auf
//
// Gemessen in Produktion am 26.09.2026: Nutzer 41 ist in den Organisationen
// 1, 2 und 4 org_admin -- heute also ueberall dieselbe Rolle. Die Tests hier
// halten den Fall fest, der entsteht, sobald das einmal nicht so ist.

const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ROLES } = require('../helpers/seed');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-vitest';

// IDs oberhalb des Seed-Bereichs
const DOPPELROLLE = 241; // Org 1 org_admin, Org 2 nur teamer

function tokenFuer(id, roleId, orgId) {
  return jwt.sign(
    { id, type: 'admin', display_name: `User ${id}`, organization_id: orgId, role_id: roleId },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('Gemeindewechsel: die Rolle gilt je Gemeinde', () => {
  let app;
  let db;

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

    // Am Konto org_admin (Org 1), in Org 2 aber nur Teamer:in.
    await db.query(
      `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
       VALUES ($1, 'doppelrolle', 'x', 'Doppel Rolle', $2, 1, true)`,
      [DOPPELROLLE, ROLES.orgAdmin.id]
    );
    await db.query(
      `INSERT INTO user_organizations (user_id, organization_id, role_id)
       VALUES ($1, 1, $2), ($1, 2, $3)`,
      [DOPPELROLLE, ROLES.orgAdmin.id, ROLES.teamer2.id]
    );
  });

  const ich = (token, orgId) => {
    const req = request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    return orgId ? req.set('X-Active-Organization', String(orgId)) : req;
  };

  // ---- der gewollte Wechsel ---------------------------------------------

  it('in der Stamm-Gemeinde gilt die Rolle am Konto', async () => {
    const res = await ich(tokenFuer(DOPPELROLLE, ROLES.orgAdmin.id, 1), 1);
    expect(res.status).toBe(200);
    expect(res.body.role_name).toBe('org_admin');
  });

  it('in der Zweitgemeinde gilt die DORTIGE, niedrigere Rolle', async () => {
    // Das ist der "Rollenwechsel", nach dem Simon gefragt hat: dieselbe
    // Person, dieselbe Anmeldung -- in Gemeinde 2 aber Teamer:in.
    const res = await ich(tokenFuer(DOPPELROLLE, ROLES.orgAdmin.id, 1), 2);
    expect(res.status).toBe(200);
    expect(res.body.role_name).toBe('teamer');
    // organization_id liefert /auth/me nicht (Antwortform unveraendert seit
    // jeher); die aktive Gemeinde steht in my-organizations.
    expect(res.body.role_display_name).toBe('Teamer:in');
  });

  // ---- die Grenzen ------------------------------------------------------

  it('die Rolle am Konto hebt die der Gemeinde NICHT auf', async () => {
    // Der Kern: org_admin am Konto macht in Gemeinde 2 trotzdem keinen
    // org_admin. Wer das aufweicht, baut eine Rechteausweitung ein.
    const res = await ich(tokenFuer(DOPPELROLLE, ROLES.orgAdmin.id, 1), 2);
    expect(res.body.role_name).not.toBe('org_admin');
  });

  it('eine role_id im Token aendert die Rolle nicht', async () => {
    // Selbst wenn jemand ein Token mit der Org-Admin-Rolle baut: gelesen wird
    // user_organizations, nicht der Token-Claim.
    const gefaelscht = tokenFuer(DOPPELROLLE, ROLES.orgAdmin.id, 2);
    const res = await ich(gefaelscht, 2);
    expect(res.status).toBe(200);
    expect(res.body.role_name).toBe('teamer');
  });

  it('eine Gemeinde ohne eigenen Eintrag wird mit 403 abgewiesen', async () => {
    // teamer1 arbeitet nur in Org 1 -- Org 2 per Header zu verlangen, geht
    // nicht. Kein stilles Zurueckfallen auf die Stamm-Gemeinde.
    const res = await ich(tokenFuer(USERS.teamer1.id, ROLES.teamer.id, 1), 2);
    expect(res.status).toBe(403);
  });

  it('ein Konfi wird durch den Wechsel nicht zur Leitung', async () => {
    // Die Gegenrichtung: Hochstufen gibt es nicht. konfi1 hat keinen Eintrag
    // fuer Org 2 und bleibt in seiner eigenen Gemeinde Konfi.
    const konfiToken = jwt.sign(
      { id: USERS.konfi1.id, type: 'konfi', display_name: 'Konfi', organization_id: 1, role_id: ROLES.konfi.id },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    expect((await ich(konfiToken, 2)).status).toBe(403);

    const eigene = await ich(konfiToken, 1);
    expect(eigene.status).toBe(200);
    expect(eigene.body.role_name).toBe('konfi');
  });
});
