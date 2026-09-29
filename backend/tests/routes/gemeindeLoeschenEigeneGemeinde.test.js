// DELETE /api/organizations/:id -- die eigene Gemeinde des Super-Admins
// (Nebenbefund Paket E, 29.09.2026; Paket I2)
//
// Die Route hatte keine Sperre gegen das Loeschen der Gemeinde, in der der
// ausfuehrende Super-Admin selbst zuhause ist (users.organization_id). Was
// dann geschah, haengt an seinen Mitgliedschaften (utils/mitgliedschaftEnde.js,
// utils/kontoLoeschen.js):
//
//   - NUR dort Mitglied: Sein Konto geht mit der Gemeinde -- er loescht sich
//     selbst und ist ausgesperrt. Ist er der einzige Super-Admin, kann danach
//     niemand mehr Gemeinden anlegen oder verwalten.
//   - AUCH anderswo Mitglied: Das Konto zieht in die weitere Gemeinde um und
//     behaelt das Super-Admin-Recht -- kein Aussperren.
//
// Gesperrt wird deshalb genau der erste Fall: 409 mit einem Satz, der sagt,
// warum und was stattdessen geht.
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');

describe('Gemeinde löschen: die eigene Gemeinde des Super-Admins', () => {
  let app, db;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    for (const u of Object.values(USERS)) invalidateUserCache(u.id);
  });

  const loesche = async (orgId, token = generateToken('superAdmin')) => {
    const res = await request(app)
      .delete(`/api/organizations/${orgId}`)
      .set('Authorization', `Bearer ${token}`);
    await warteAufNachwehen(app);
    return res;
  };

  const gibt = async (sql, params) => (await db.query(sql, params)).rows.length;

  it('sperrt das Löschen der eigenen Gemeinde, wenn das Konto nur dort Mitglied ist (409)', async () => {
    // Ausgangslage: Der Super-Admin des Seeds ist in Gemeinde 1 zuhause und
    // nirgends sonst Mitglied.
    expect(await gibt('SELECT 1 FROM users WHERE id = $1 AND organization_id = $2', [USERS.superAdmin.id, ORGS.testGemeinde.id])).toBe(1);
    expect(await gibt('SELECT 1 FROM user_organizations WHERE user_id = $1 AND organization_id <> $2', [USERS.superAdmin.id, ORGS.testGemeinde.id])).toBe(0);

    const res = await loesche(ORGS.testGemeinde.id);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(
      'Deine eigene Gemeinde kannst du nicht löschen: Dein Konto ist nur dort Mitglied und würde mitgelöscht. ' +
      'Lass die Löschung von einer anderen Person mit Super-Admin-Recht ausführen.'
    );
    expect(await gibt('SELECT 1 FROM organizations WHERE id = $1', [ORGS.testGemeinde.id])).toBe(1);
    expect(await gibt('SELECT 1 FROM users WHERE id = $1', [USERS.superAdmin.id])).toBe(1);
  });

  it('lässt eine andere Person mit Super-Admin-Recht dieselbe Gemeinde löschen (200)', async () => {
    // Ein zweiter Super-Admin, zuhause in Gemeinde 2.
    await db.query('UPDATE users SET is_super_admin = true WHERE id = $1', [USERS.orgAdmin2.id]);
    invalidateUserCache(USERS.orgAdmin2.id);

    const res = await loesche(ORGS.testGemeinde.id, generateToken('orgAdmin2'));

    expect(res.status).toBe(200);
    expect(await gibt('SELECT 1 FROM organizations WHERE id = $1', [ORGS.testGemeinde.id])).toBe(0);
    expect(await gibt('SELECT 1 FROM users WHERE id = $1', [USERS.orgAdmin2.id])).toBe(1);
  });

  it('lässt eine fremde Gemeinde weiter löschen (200)', async () => {
    const res = await loesche(ORGS.andereGemeinde.id);

    expect(res.status).toBe(200);
    expect(await gibt('SELECT 1 FROM organizations WHERE id = $1', [ORGS.andereGemeinde.id])).toBe(0);
  });

  it('erlaubt die eigene Gemeinde, wenn das Konto auch anderswo Mitglied ist -- es zieht um und bleibt Super-Admin', async () => {
    await db.query(
      'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
      [USERS.superAdmin.id, ORGS.andereGemeinde.id, ROLES.orgAdmin2.id]
    );
    invalidateUserCache(USERS.superAdmin.id);

    const res = await loesche(ORGS.testGemeinde.id);

    expect(res.status).toBe(200);
    const { rows: [konto] } = await db.query(
      'SELECT organization_id, is_super_admin FROM users WHERE id = $1', [USERS.superAdmin.id]
    );
    expect(konto.organization_id).toBe(ORGS.andereGemeinde.id);
    expect(konto.is_super_admin).toBe(true);
  });
});
