// Vertragstest: Konten ohne Gemeinde aendern fuer BESTEHENDE Konten keine
// Antwortform (CLAUDE.md, "Ausgelieferte Apps nie brechen"; Simon,
// 03.10.2026, docs/planung/web-version.md Punkt 12 bis 15).
//
// Fuer Konten ohne Gemeinde aendern sich Anmeldung, Refresh, Benutzerliste,
// Mitgliederliste und mehr. Die Store-Apps 1.5.3 bis 2.3.0 lesen dieselben
// Routen fuer alle anderen Konten -- dort darf kein Feld verschwinden, kein
// Typ wechseln und kein Array zum Objekt werden. Diese Datei haelt die Form
// (Schluessel und Typ je Feld) der Routen fest, die eine App direkt nach dem
// Anmelden liest, dazu die Mitgliederliste mit is_primary als Boolean.
// Neue Felder waeren erlaubt -- dann gehoert die Erwartung hier erweitert,
// nie gekuerzt.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES, PASSWORD } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');

/** Schluessel -> Typ ('string', 'number', 'boolean', 'null', 'array', 'object'). */
const form = (wert) => Object.fromEntries(Object.entries(wert).map(([k, v]) => [
  k, v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v,
]));

const LOGIN_USER_LEITUNG = {
  id: 'number', display_name: 'string', username: 'string', email: 'null',
  organization: 'string', role_name: 'string', type: 'string',
  is_super_admin: 'boolean', trial_ends_at: 'null', is_trial: 'boolean',
};

describe('Antwortformen bestehender Konten bleiben, wie sie sind', () => {
  let app, db;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    for (const u of Object.values(USERS)) invalidateUserCache(u.id);
  });

  const anmelden = (key) => request(app).post('/api/auth/login')
    .send({ username: USERS[key].username, password: PASSWORD });

  describe('POST /auth/login (ohne kann_ohne_gemeinde, wie jede ausgelieferte App)', () => {
    it('Gemeindeleitung', async () => {
      const res = await anmelden('orgAdmin1');
      expect(res.status).toBe(200);
      expect(form(res.body)).toEqual({ token: 'string', refresh_token: 'string', user: 'object' });
      expect(form(res.body.user)).toEqual(LOGIN_USER_LEITUNG);
      expect(res.body.user.organization).toBe(ORGS.testGemeinde.name);
    });

    it('Leitung (admin) mit Jahrgangs-Zuweisungen', async () => {
      const res = await anmelden('admin1');
      expect(res.status).toBe(200);
      expect(form(res.body.user)).toEqual({ ...LOGIN_USER_LEITUNG, assigned_jahrgaenge: 'array' });
    });

    it('Konfi', async () => {
      const res = await anmelden('konfi1');
      expect(res.status).toBe(200);
      expect(form(res.body.user)).toEqual({
        ...LOGIN_USER_LEITUNG,
        jahrgang: 'string', gottesdienst_points: 'number', gemeinde_points: 'number',
      });
    });

    it('Super-Admin mit Gemeinde (Simons Konstellation: Gemeindeleitung mit Merkmal)', async () => {
      const res = await anmelden('orgAdminSuper');
      expect(res.status).toBe(200);
      expect(form(res.body.user)).toEqual(LOGIN_USER_LEITUNG);
      expect(res.body.user).toMatchObject({ is_super_admin: true, role_name: 'org_admin', organization: ORGS.testGemeinde.name });
    });
  });

  it('POST /auth/refresh: Token-Paar wie bisher', async () => {
    const login = await anmelden('teamer1');
    const res = await request(app).post('/api/auth/refresh').send({ refresh_token: login.body.refresh_token });
    expect(res.status).toBe(200);
    expect(form(res.body)).toEqual({ token: 'string', refresh_token: 'string' });
  });

  it('GET /auth/me', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
    expect(res.status).toBe(200);
    expect(form(res.body)).toEqual({
      id: 'number', username: 'string', display_name: 'string', email: 'null', role_title: 'null',
      role_name: 'string', role_display_name: 'string', is_super_admin: 'boolean',
      trial_ends_at: 'null', is_trial: 'boolean', assigned_jahrgaenge: 'array',
    });
  });

  it('GET /auth/my-organizations: ein Array, je Gemeinde dieselben Felder', async () => {
    await db.query('INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
      [USERS.orgAdmin1.id, ORGS.andereGemeinde.id, ROLES.teamer2.id]);
    const res = await request(app).get('/api/auth/my-organizations').set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    for (const eintrag of res.body) {
      expect(form(eintrag)).toEqual({
        id: 'number', name: 'string', slug: 'string', display_name: 'string',
        role_name: 'string', role_display_name: 'string', is_active: 'boolean',
        // Hinzugefuegt am 03.10.2026 (Stamm-Gemeinde fuer den Umschalter);
        // ein neues Feld ist erlaubt, die alten bleiben.
        is_primary: 'boolean',
      });
    }
  });

  it('GET /organizations/:id/members: is_primary ist immer ein Boolean', async () => {
    await db.query('INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
      [USERS.teamer2.id, ORGS.testGemeinde.id, ROLES.teamer.id]);
    const res = await request(app).get(`/api/organizations/${ORGS.testGemeinde.id}/members`)
      .set('Authorization', `Bearer ${generateToken('superAdmin')}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(1);
    for (const eintrag of res.body) {
      expect(form(eintrag)).toEqual({
        id: 'number', username: 'string', display_name: 'string', email: 'null',
        role_name: 'string', role_display_name: 'string', is_primary: 'boolean', created_at: 'string',
      });
    }
    expect(res.body.find((m) => m.id === USERS.teamer2.id).is_primary).toBe(false);
    expect(res.body.find((m) => m.id === USERS.teamer1.id).is_primary).toBe(true);
  });
});
