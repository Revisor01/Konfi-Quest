// Konten ohne Gemeinde melden sich nur in der Web-Version an (Simon,
// 03.10.2026; docs/planung/web-version.md Punkt 13: "Support arbeitet nur im
// Browser. Meldet sich ein Konto ohne Gemeinde in einer App an, alt oder
// neu, kommt ein klarer Hinweis auf die Support-Ansicht im Browser.").
//
// Die Web-Version schickt bei Anmeldung und Refresh `kann_ohne_gemeinde:
// true`; die Apps auf iPhone und Android schicken es nie, die ausgelieferten
// (1.5.3 bis 2.3.0) kennen das Feld nicht. Ohne das Feld antwortet der Server
// einem Konto ohne Gemeinde mit 403 user_inactive und dem Hinweis -- der
// error_code, den jede ausgelieferte App als Sperre behandelt (2.3.0 zeigt den
// Text des Servers), dazu `grund: 'konto_ohne_gemeinde'` (neu, additiv).
//
// Das ist Bedienkomfort, keine Sicherheitsgrenze: Die Rechte haelt weiter
// rbac.js. Fuer Konten MIT Gemeinde aendert das Feld nichts.
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES, PASSWORD } = require('../helpers/seed');
const { invalidateUserCache } = require('../../middleware/rbac');
const {
  SUPPORT, PASSWORT_SUPPORT, kontoOhneGemeindeErmoeglichen, supportKontoAnlegen, refreshTokenAnlegen,
} = require('../helpers/kontoOhneGemeinde');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-vitest';
const HINWEIS = {
  error: 'Dieses Konto gehört zu keiner Gemeinde und ist für die Support-Ansicht im Browser bestimmt. Bitte melde dich auf konfi-quest.de an.',
  error_code: 'user_inactive',
  grund: 'konto_ohne_gemeinde',
};

describe('Konto ohne Gemeinde: Anmeldung nur aus der Web-Version', () => {
  let app, db, wiederherstellen;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
    wiederherstellen = await kontoOhneGemeindeErmoeglichen(db);
  });
  afterAll(async () => {
    await truncateAll(db);
    await wiederherstellen();
    await closePool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    await supportKontoAnlegen(db);
    for (const u of [...Object.values(USERS), SUPPORT]) invalidateUserCache(u.id);
  });

  const anmelden = (body) => request(app).post('/api/auth/login').send(body);
  const erneuern = (body, kopf = {}) => request(app).post('/api/auth/refresh').set(kopf).send(body);

  describe('POST /auth/login', () => {
    it('verboten: ohne kann_ohne_gemeinde (jede App) -> 403 mit Hinweis und grund, keine Tokens', async () => {
      const res = await anmelden({ username: SUPPORT.username, password: PASSWORT_SUPPORT });
      expect(res.status).toBe(403);
      expect(res.body).toEqual(HINWEIS);
      const { rows } = await db.query('SELECT 1 FROM refresh_tokens WHERE user_id = $1', [SUPPORT.id]);
      expect(rows).toHaveLength(0);
    });

    it.each([false, 'true', 1])('verboten: kann_ohne_gemeinde = %j zaehlt nicht als Zusage', async (wert) => {
      const res = await anmelden({ username: SUPPORT.username, password: PASSWORT_SUPPORT, kann_ohne_gemeinde: wert });
      expect(res.status).toBe(403);
      expect(res.body.grund).toBe('konto_ohne_gemeinde');
    });

    it('verboten bleibt verboten: falsches Passwort ist 401 wie immer, ohne Hinweis auf das Konto', async () => {
      const res = await anmelden({ username: SUPPORT.username, password: 'Falsch-Passwort1!' });
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Ungültige Anmeldedaten' });
    });

    it('erlaubt: mit kann_ohne_gemeinde (Web-Version) -> 200, organization null, Rolle super_admin', async () => {
      const res = await anmelden({ username: SUPPORT.username, password: PASSWORT_SUPPORT, kann_ohne_gemeinde: true });
      expect(res.status).toBe(200);
      expect(res.body.user).toEqual({
        id: SUPPORT.id, display_name: SUPPORT.display_name, username: SUPPORT.username, email: null,
        organization: null, role_name: 'super_admin', type: 'admin', is_super_admin: true,
        trial_ends_at: null, is_trial: false,
      });
      expect(jwt.verify(res.body.token, JWT_SECRET)).toMatchObject({ id: SUPPORT.id, organization_id: null, is_super_admin: true });
      expect(typeof res.body.refresh_token).toBe('string');
    });

    it('Konten mit Gemeinde: das Feld aendert nichts (mit und ohne 200)', async () => {
      const ohne = await anmelden({ username: USERS.orgAdmin1.username, password: PASSWORD });
      const mit = await anmelden({ username: USERS.orgAdmin1.username, password: PASSWORD, kann_ohne_gemeinde: true });
      expect(ohne.status).toBe(200);
      expect(mit.status).toBe(200);
      expect(mit.body.user).toEqual(ohne.body.user);
      expect(ohne.body.user.organization).toBe(ORGS.testGemeinde.name);
    });
  });

  describe('POST /auth/refresh', () => {
    it('verboten: Refresh eines Kontos ohne Gemeinde ohne kann_ohne_gemeinde (App) -> 403 mit Hinweis, kein neues Token', async () => {
      const token = await refreshTokenAnlegen(db, SUPPORT.id);
      const res = await erneuern({ refresh_token: token });
      expect(res.status).toBe(403);
      expect(res.body).toEqual(HINWEIS);
      // Das eingereichte Token ist rotiert und widerrufen (wie bei jeder
      // Sperre im Refresh); ein neues gibt es nicht.
      const { rows: offen } = await db.query(
        'SELECT 1 FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL', [SUPPORT.id]);
      expect(offen).toHaveLength(0);
    });

    it('erlaubt: mit kann_ohne_gemeinde -> neues Token-Paar ohne Gemeinde-Claim', async () => {
      const token = await refreshTokenAnlegen(db, SUPPORT.id);
      const res = await erneuern({ refresh_token: token, kann_ohne_gemeinde: true });
      expect(res.status).toBe(200);
      const claims = jwt.verify(res.body.token, JWT_SECRET);
      expect(claims.organization_id).toBeNull();
      expect(claims.active_organization_id).toBeUndefined();
    });

    it('Gast in einer Gemeinde: Refresh mit Kopfzeile traegt den Claim, ohne Kopfzeile keinen (Rueckweg "ohne Gemeinde")', async () => {
      await db.query('INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
        [SUPPORT.id, ORGS.testGemeinde.id, ROLES.orgAdmin.id]);
      const erstes = await refreshTokenAnlegen(db, SUPPORT.id);
      const mitKopf = await erneuern({ refresh_token: erstes, kann_ohne_gemeinde: true },
        { 'X-Active-Organization': String(ORGS.testGemeinde.id) });
      expect(mitKopf.status).toBe(200);
      expect(jwt.verify(mitKopf.body.token, JWT_SECRET).active_organization_id).toBe(ORGS.testGemeinde.id);

      const ohneKopf = await erneuern({ refresh_token: mitKopf.body.refresh_token, kann_ohne_gemeinde: true });
      expect(ohneKopf.status).toBe(200);
      expect(jwt.verify(ohneKopf.body.token, JWT_SECRET).active_organization_id).toBeUndefined();
    });

    it('Konten mit Gemeinde: Refresh ohne das Feld wie bisher (200)', async () => {
      const token = await refreshTokenAnlegen(db, USERS.teamer1.id);
      const res = await erneuern({ refresh_token: token });
      expect(res.status).toBe(200);
    });
  });
});
