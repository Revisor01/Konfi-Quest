// Ein gesperrtes Super-Admin-Konto meldet sich nicht mehr an (03.10.2026).
//
// Anmeldung und Refresh pruefen die Sperre des KONTOS (users.is_active) und
// die der GEMEINDE (gesperrt, Testphase abgelaufen). Super-Admins waren von
// BEIDEN ausgenommen -- gemeint war nur die Gemeinde: Ein Super-Admin
// verwaltet auch gesperrte Gemeinden, und ein Support-Konto hat gar keine.
// Folge: Ein gesperrtes Super-Admin-Konto bekam bei der Anmeldung 200 samt
// Tokens, rbac.js wies danach jede Anfrage mit 401 ab. Fuer Support-Konten
// (docs/planung/web-version.md, Punkt 12) ist die Sperre der Weg, ein Konto
// stillzulegen -- sie muss greifen.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, PASSWORD } = require('../helpers/seed');
const { invalidateUserCache } = require('../../middleware/rbac');
const {
  SUPPORT, PASSWORT_SUPPORT, supportKontoAnlegen, refreshTokenAnlegen,
} = require('../helpers/kontoOhneGemeinde');

const DEAKTIVIERT = 'Dein Zugang wurde deaktiviert. Bitte wende dich an deine Gemeinde.';

describe('Gesperrtes Super-Admin-Konto: Anmeldung und Refresh', () => {
  let app, db;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    await supportKontoAnlegen(db);
    for (const u of [...Object.values(USERS), SUPPORT]) invalidateUserCache(u.id);
  });

  // Das Support-Konto meldet sich nur aus der Web-Version an
  // (kann_ohne_gemeinde, Schritt 2); das Feld schadet bei anderen Konten nicht.
  const anmelden = (username, password) => request(app)
    .post('/api/auth/login')
    .send({ username, password, kann_ohne_gemeinde: true });
  const erneuern = (token) => request(app)
    .post('/api/auth/refresh')
    .send({ refresh_token: token, kann_ohne_gemeinde: true });

  describe('verboten: das Konto ist gesperrt', () => {
    it('Super-Admin mit Gemeinde: Anmeldung 403 user_inactive', async () => {
      await db.query('UPDATE users SET is_active = false WHERE id = $1', [USERS.superAdmin.id]);
      const res = await anmelden(USERS.superAdmin.username, PASSWORD);
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: DEAKTIVIERT, error_code: 'user_inactive' });
    });

    it('Gemeindeleitung mit Super-Admin-Merkmal: Anmeldung 403 user_inactive', async () => {
      await db.query('UPDATE users SET is_active = false WHERE id = $1', [USERS.orgAdminSuper.id]);
      const res = await anmelden(USERS.orgAdminSuper.username, PASSWORD);
      expect(res.status).toBe(403);
      expect(res.body.error_code).toBe('user_inactive');
    });

    it('Super-Admin mit Gemeinde: Refresh 403 user_inactive', async () => {
      const token = await refreshTokenAnlegen(db, USERS.superAdmin.id);
      await db.query('UPDATE users SET is_active = false WHERE id = $1', [USERS.superAdmin.id]);
      const res = await erneuern(token);
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: DEAKTIVIERT, error_code: 'user_inactive' });
    });

    it('Support-Konto ohne Gemeinde: Anmeldung und Refresh 403 user_inactive', async () => {
      const token = await refreshTokenAnlegen(db, SUPPORT.id);
      await db.query('UPDATE users SET is_active = false WHERE id = $1', [SUPPORT.id]);
      const login = await anmelden(SUPPORT.username, PASSWORT_SUPPORT);
      expect(login.status).toBe(403);
      expect(login.body.error_code).toBe('user_inactive');
      const refresh = await erneuern(token);
      expect(refresh.status).toBe(403);
      expect(refresh.body.error_code).toBe('user_inactive');
    });
  });

  describe('erlaubt', () => {
    it('Super-Admin in einer GESPERRTEN Gemeinde meldet sich weiter an (die Gemeinde-Sperre entfaellt)', async () => {
      await db.query('UPDATE organizations SET is_active = false WHERE id = $1', [ORGS.testGemeinde.id]);
      const res = await anmelden(USERS.superAdmin.username, PASSWORD);
      expect(res.status).toBe(200);
      expect(res.body.user.is_super_admin).toBe(true);
    });

    it('Super-Admin in einer Gemeinde mit abgelaufener Testphase: Refresh 200', async () => {
      await db.query("UPDATE organizations SET trial_ends_at = NOW() - INTERVAL '1 day' WHERE id = $1", [ORGS.testGemeinde.id]);
      const token = await refreshTokenAnlegen(db, USERS.superAdmin.id);
      const res = await erneuern(token);
      expect(res.status).toBe(200);
      expect(typeof res.body.token).toBe('string');
    });

    it('aktives Support-Konto: Anmeldung und Refresh 200', async () => {
      const login = await anmelden(SUPPORT.username, PASSWORT_SUPPORT);
      expect(login.status).toBe(200);
      const refresh = await erneuern(login.body.refresh_token);
      expect(refresh.status).toBe(200);
    });

    it('gegenueber: eine gesperrte Teamer:in bleibt gesperrt wie bisher', async () => {
      await db.query('UPDATE users SET is_active = false WHERE id = $1', [USERS.teamer1.id]);
      const res = await anmelden(USERS.teamer1.username, PASSWORD);
      expect(res.status).toBe(403);
      expect(res.body.error_code).toBe('user_inactive');
    });
  });
});
