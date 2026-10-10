// Rangliste des Jahrgangs mit Mischkonten (10.10.2026)
//
// BEFUND, in Produktion gemessen: Ein Konto, am Konto org_admin in seiner
// Stamm-Gemeinde, ist ueber user_organizations in einer anderen Gemeinde
// Konfi, hat dort ein Konfi-Profil im Jahrgang und 20 Punkte. In seiner
// Konfi-Ansicht zeigte die Rangliste "1/1", und eine Konfi mit 16 Punkten
// stand auf Platz 1.
//
// Ursache: GET /konfi/dashboard und GET /konfi/profile bestimmten die Konfis
// des Jahrgangs ueber `JOIN roles r ON u.role_id = r.id ... r.name =
// 'konfi'`, also ueber die Rolle am KONTO. Die Rolle gilt aber je Gemeinde
// (users.role_id nur fuer die Stamm-Gemeinde, sonst user_organizations.
// role_id). Das Mischkonto fiel aus Top 3 und Zaehlung heraus; den eigenen
// Rang suchte die Abfrage ueber Punktgleichheit (`total_points = $2`), fand
// keine Zeile und lieferte null -- die App zeigt dafuer "1/1".
//
// Gegenprobe: Mit der alten Abfrage fallen die Tests "Mischkonto" und
// "Stamm-Konfi anderswo" (das Mischkonto fehlt, die Leitung mit Profil und
// Konfi-Rolle nur in ihrer Stamm-Gemeinde zaehlt mit).

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE, ROLES, ORGS } = require('../helpers/seed');
const { invalidateUserCache } = require('../../middleware/rbac');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-vitest';

const ORG1 = ORGS.testGemeinde.id;
const ORG2 = ORGS.andereGemeinde.id;
const JG2 = JAHRGAENGE.jahrgang2.id;

// Am Konto org_admin in Org 1, ueber user_organizations Konfi in Org 2.
const MISCH = 271;
// Am Konto Konfi in Org 1, in Org 2 ueber user_organizations org_admin --
// mit (Alt-)Profil im Jahrgang von Org 2. In Org 2 ist sie KEINE Konfi.
const LEITUNG_MIT_PROFIL = 272;
// Am Konto org_admin in Org 2 selbst, mit Profil im Jahrgang von Org 2.
const STAMM_LEITUNG_MIT_PROFIL = 273;

function tokenFuer(id, roleId, orgId, type) {
  return jwt.sign(
    { id, type, organization_id: orgId, role_id: roleId },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function legeKontoAn(db, id, name, roleId, orgId) {
  await db.query(
    `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
     VALUES ($1, $2, 'x', $3, $4, $5, true)`,
    [id, name, name, roleId, orgId]
  );
}

async function setzePunkte(db, userId, gottesdienst, gemeinde) {
  await db.query(
    `INSERT INTO konfi_profiles (user_id, organization_id, jahrgang_id, gottesdienst_points, gemeinde_points)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE
       SET jahrgang_id = EXCLUDED.jahrgang_id,
           gottesdienst_points = EXCLUDED.gottesdienst_points,
           gemeinde_points = EXCLUDED.gemeinde_points`,
    [userId, ORG2, JG2, gottesdienst, gemeinde]
  );
}

describe('Rangliste des Jahrgangs: Konfi ist, wer es in der Gemeinde des Jahrgangs ist', () => {
  let app;
  let db;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    Object.values(USERS).forEach((u) => invalidateUserCache(u.id));
    [MISCH, LEITUNG_MIT_PROFIL, STAMM_LEITUNG_MIT_PROFIL].forEach((id) => invalidateUserCache(id));

    // konfi3: gewoehnliche Konfi in Org 2, Jahrgang 2, 16 Punkte.
    await setzePunkte(db, USERS.konfi3.id, 6, 10);

    await legeKontoAn(db, MISCH, 'misch-konto', ROLES.orgAdmin.id, ORG1);
    await db.query(
      `INSERT INTO user_organizations (user_id, organization_id, role_id)
       VALUES ($1, $2, $3), ($1, $4, $5)`,
      [MISCH, ORG1, ROLES.orgAdmin.id, ORG2, ROLES.konfi2.id]
    );
    await setzePunkte(db, MISCH, 5, 15);
  });

  const alsMischkonto = (pfad) =>
    request(app)
      .get(pfad)
      .set('Authorization', `Bearer ${tokenFuer(MISCH, ROLES.orgAdmin.id, ORG1, 'konfi')}`)
      .set('X-Active-Organization', String(ORG2));

  const alsKonfi3 = (pfad) =>
    request(app)
      .get(pfad)
      .set('Authorization', `Bearer ${tokenFuer(USERS.konfi3.id, ROLES.konfi2.id, ORG2, 'konfi')}`);

  it('Mischkonto: steht mit den meisten Punkten auf Platz 1 der Rangliste (Dashboard)', async () => {
    const res = await alsMischkonto('/api/konfi/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.ranking.map((r) => [Number(r.id), Number(r.points)])).toEqual([
      [MISCH, 20],
      [USERS.konfi3.id, 16],
    ]);
    expect(Number(res.body.rank_in_jahrgang)).toBe(1);
    expect(Number(res.body.total_in_jahrgang)).toBe(2);
  });

  it('Mischkonto: Rang und Zahl im Profil', async () => {
    const res = await alsMischkonto('/api/konfi/profile');
    expect(res.status).toBe(200);
    expect(Number(res.body.rank_in_jahrgang)).toBe(1);
    expect(Number(res.body.total_in_jahrgang)).toBe(2);
  });

  it('die gewoehnliche Konfi sieht das Mischkonto vor sich (Platz 2 von 2)', async () => {
    const dash = await alsKonfi3('/api/konfi/dashboard');
    expect(dash.status).toBe(200);
    expect(Number(dash.body.ranking[0].id)).toBe(MISCH);
    expect(Number(dash.body.rank_in_jahrgang)).toBe(2);
    expect(Number(dash.body.total_in_jahrgang)).toBe(2);

    const profil = await alsKonfi3('/api/konfi/profile');
    expect(profil.status).toBe(200);
    expect(Number(profil.body.rank_in_jahrgang)).toBe(2);
    expect(Number(profil.body.total_in_jahrgang)).toBe(2);
  });

  it('Leitung mit Konfi-Profil, aber ohne Konfi-Rolle in dieser Gemeinde, zaehlt nicht mit', async () => {
    // Am Konto Konfi -- aber in Org 1. In Org 2 ist sie org_admin.
    await legeKontoAn(db, LEITUNG_MIT_PROFIL, 'leitung-mit-profil', ROLES.konfi.id, ORG1);
    await db.query(
      'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
      [LEITUNG_MIT_PROFIL, ORG2, ROLES.orgAdmin2.id]
    );
    await setzePunkte(db, LEITUNG_MIT_PROFIL, 10, 30);
    // Am Konto org_admin in Org 2 selbst.
    await legeKontoAn(db, STAMM_LEITUNG_MIT_PROFIL, 'stamm-leitung-mit-profil', ROLES.orgAdmin2.id, ORG2);
    await setzePunkte(db, STAMM_LEITUNG_MIT_PROFIL, 20, 30);

    const dash = await alsMischkonto('/api/konfi/dashboard');
    expect(dash.status).toBe(200);
    expect(dash.body.ranking.map((r) => Number(r.id))).toEqual([MISCH, USERS.konfi3.id]);
    expect(Number(dash.body.rank_in_jahrgang)).toBe(1);
    expect(Number(dash.body.total_in_jahrgang)).toBe(2);

    const profil = await alsKonfi3('/api/konfi/profile');
    expect(Number(profil.body.rank_in_jahrgang)).toBe(2);
    expect(Number(profil.body.total_in_jahrgang)).toBe(2);
  });

  it('eigener Rang ueber die eigene Person, nicht ueber Punktgleichheit', async () => {
    // Gleichstand: beide 20 Punkte -> beide Platz 1 (RANK), beide sehen 1/2.
    await setzePunkte(db, USERS.konfi3.id, 10, 10);
    const misch = await alsMischkonto('/api/konfi/dashboard');
    const k3 = await alsKonfi3('/api/konfi/dashboard');
    expect(Number(misch.body.rank_in_jahrgang)).toBe(1);
    expect(Number(k3.body.rank_in_jahrgang)).toBe(1);
    expect(Number(misch.body.total_in_jahrgang)).toBe(2);

    // Ein geloeschtes Konto mit denselben Punkten zaehlt nicht und liefert
    // dem eigenen Rang keine fremde Zeile.
    await db.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [USERS.konfi3.id]);
    const allein = await alsMischkonto('/api/konfi/profile');
    expect(Number(allein.body.rank_in_jahrgang)).toBe(1);
    expect(Number(allein.body.total_in_jahrgang)).toBe(1);
  });
});
