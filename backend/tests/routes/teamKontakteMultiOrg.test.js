// backend/tests/routes/teamKontakteMultiOrg.test.js
//
// Befund 25.09.2026 (Audit Pushes/Badges/Multi-Org): GET /chat/team-contacts
// fragte nur `u.organization_id = $1`, also die Stamm-Organisation. Wer eine
// Gemeinde als Zweit-Organisation betreut (user_organizations), fehlte dort
// in der Team-Kontaktliste -- und konnte selbst, in die Zweit-Gemeinde
// gewechselt, niemanden aus deren Team anschreiben, weil die Liste seine
// Stamm-Gemeinde zeigte.
//
// In Produktion gemessen: Organisation 2 hat ihre gesamte Leitung NUR ueber
// user_organizations (Nutzer 41). Fuer die eine Teamer:in dort war die
// Kontaktliste leer.
//
// Die Konfi-Kontaktliste (/chat/admins, /available-users) loest die Rolle seit
// dem 01.09.2026 ueber TEAM_MITGLIED_ROLLE auf -- dieselbe Aufloesung wie
// rbac.js beim Org-Wechsel. Die Team-Liste war die letzte Kontaktliste ohne.
//
// Assertions auf konkrete ID-Listen, kein "toBeDefined" auf einem Zaehler.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');

const zusatz = (db, userId, orgId, roleId) => db.query(
  'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
  [userId, orgId, roleId]
);

const ids = (liste) => liste.map((e) => Number(e.id)).sort((a, b) => a - b);

describe('GET /api/chat/team-contacts bei Mehrfachzugehoerigkeit', () => {
  let app, db;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    invalidateUserCache();
  });
  afterAll(async () => { await closePool(); });

  const teamKontakte = (tokenName, aktiveOrg = null) => {
    const req = request(app)
      .get('/api/chat/team-contacts')
      .set('Authorization', `Bearer ${generateToken(tokenName)}`);
    return aktiveOrg ? req.set('X-Active-Organization', String(aktiveOrg)) : req;
  };

  it('Regression Stamm-Organisation: das Team von Org 1 wie bisher (ohne den Aufrufer)', async () => {
    const res = await teamKontakte('admin1');
    expect(res.status).toBe(200);
    // teamer1, orgAdmin1, orgAdminSuper -- superAdmin (Rolle super_admin)
    // und admin1 selbst nicht.
    expect(ids(res.body)).toEqual([USERS.teamer1.id, USERS.orgAdmin1.id, USERS.orgAdminSuper.id]);
  });

  it('erlaubt: die Zusatz-Leitung steht im Team der Zweit-Gemeinde -- mit der Rolle DORT', async () => {
    await zusatz(db, USERS.orgAdmin1.id, ORGS.andereGemeinde.id, ROLES.orgAdmin2.id);

    const res = await teamKontakte('teamer2');
    expect(res.status).toBe(200);
    expect(ids(res.body)).toEqual([USERS.orgAdmin1.id, USERS.admin2.id, USERS.orgAdmin2.id]);

    const eintrag = res.body.find((e) => Number(e.id) === USERS.orgAdmin1.id);
    expect(eintrag.role_name).toBe('org_admin');
    expect(eintrag.display_name).toBe(USERS.orgAdmin1.display_name);
  });

  it('die Rolle gilt je Gemeinde: zuhause org_admin, in der Zweit-Gemeinde Teamer:in', async () => {
    await zusatz(db, USERS.orgAdmin1.id, ORGS.andereGemeinde.id, ROLES.teamer2.id);

    const res = await teamKontakte('teamer2');
    expect(res.status).toBe(200);
    const eintrag = res.body.find((e) => Number(e.id) === USERS.orgAdmin1.id);
    expect(eintrag).toBeTruthy();
    expect(eintrag.role_name).toBe('teamer');
    expect(eintrag.role_description).toBe('Teamer:in');
  });

  it('verboten: ohne Zugehoerigkeit zu Org 2 erscheint niemand aus Org 1', async () => {
    const res = await teamKontakte('teamer2');
    expect(res.status).toBe(200);
    expect(ids(res.body)).toEqual([USERS.admin2.id, USERS.orgAdmin2.id]);
  });

  it('gewechselt in die Zweit-Gemeinde sieht die Person DEREN Team, nicht das der Stamm-Gemeinde', async () => {
    await zusatz(db, USERS.orgAdmin1.id, ORGS.andereGemeinde.id, ROLES.orgAdmin2.id);

    const res = await teamKontakte('orgAdmin1', ORGS.andereGemeinde.id);
    expect(res.status).toBe(200);
    expect(ids(res.body)).toEqual([USERS.teamer2.id, USERS.admin2.id, USERS.orgAdmin2.id]);
  });

  it('gesperrte Konten der Zweit-Gemeinde fallen weiter heraus', async () => {
    await zusatz(db, USERS.orgAdmin1.id, ORGS.andereGemeinde.id, ROLES.orgAdmin2.id);
    await db.query('UPDATE users SET is_active = false WHERE id = $1', [USERS.orgAdmin1.id]);

    const res = await teamKontakte('teamer2');
    expect(res.status).toBe(200);
    expect(ids(res.body)).toEqual([USERS.admin2.id, USERS.orgAdmin2.id]);
  });
});
