// Ein Konto ohne Gemeinde (Support-Konto, Simon 03.10.2026,
// docs/planung/web-version.md Punkt 12 bis 14): Super-Admin-Merkmal,
// gemeindefreie Systemrolle super_admin, users.organization_id NULL.
//
// Am Code geprueft am 03.10.2026: NULL faellt fast ueberall sicher aus --
// `organization_id = $1` trifft nichts, die Rolle super_admin steht in keiner
// Rollenliste von requireAdmin/requireTeamer. Falsch rechneten die Stellen,
// die mit `<>` oder `= Spalte` vergleichen: NULL <> 1 ist nicht wahr, sondern
// NULL. Diese Datei zeigt jede dieser Stellen am Verhalten:
//
//   - GET /users der Gemeinde: Ein Gast ohne Gemeinde fehlte (Punkt 14 sagt:
//     sichtbar als Gemeindeleitung), weitere_gemeinden war falsch.
//   - GET /users/:id: 404 statt der Person.
//   - checkUserHierarchy: 404 statt 403 "Super-Admin-Konten ...".
//   - GET /wrapped/history/:id: 403 fuer die Leitung der Gastgemeinde.
//   - PUT /users/:id/reset-password: 200 "erfolgreich", geaendert wurde nichts.
//   - POST /chat/rooms: 500 (chat_rooms.organization_id ist NOT NULL).
//   - GET /organizations/:id/members: is_primary null statt false.
//
// Rechte bleiben bei rbac.js: ohne aktive Gemeinde 403 an allen
// Gemeinde-Routen, leere Listen an den lesenden.
const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');
const {
  SUPPORT, SYSTEMROLLE_ID, supportKontoAnlegen, supportToken,
} = require('../helpers/kontoOhneGemeinde');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-vitest';
const SUPER_ADMIN_TEXT = 'Super-Admin-Konten kann nur ein Super-Admin bearbeiten.';

describe('Konto ohne Gemeinde', () => {
  let app, db;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    await supportKontoAnlegen(db);
    for (const u of [...Object.values(USERS), SUPPORT]) invalidateUserCache(u.id);
  });

  const alsGast = async (orgId, rolle = 'org_admin') => {
    const res = await request(app)
      .post(`/api/organizations/${orgId}/members`)
      .set('Authorization', `Bearer ${generateToken('superAdmin')}`)
      .send({ user_id: SUPPORT.id, role_name: rolle });
    expect(res.status).toBe(201);
    await warteAufNachwehen(app);
    invalidateUserCache(SUPPORT.id);
  };

  describe('Rechte ohne aktive Gemeinde', () => {
    const support = () => `Bearer ${supportToken()}`;

    it('erlaubt: Gemeinden verwalten (GET /organizations)', async () => {
      const res = await request(app).get('/api/organizations').set('Authorization', support());
      expect(res.status).toBe(200);
      expect(res.body.map((o) => o.id).sort()).toEqual([ORGS.testGemeinde.id, ORGS.andereGemeinde.id]);
    });

    it.each([
      ['GET', '/api/admin/konfis'],
      ['GET', '/api/users'],
      ['POST', '/api/admin/jahrgaenge'],
    ])('verboten: %s %s ohne Gemeinde (403)', async (methode, pfad) => {
      const anfrage = methode === 'GET' ? request(app).get(pfad) : request(app).post(pfad).send({ name: 'X', confirmation_date: '2027-05-01' });
      const res = await anfrage.set('Authorization', support());
      expect(res.status).toBe(403);
    });

    it('Termine: leere Liste statt fremder Daten', async () => {
      const res = await request(app).get('/api/events').set('Authorization', support());
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it.each(['group', 'jahrgang', 'direct'])('POST /chat/rooms (%s) ohne Gemeinde: 403, kein 500, kein Raum', async (typ) => {
      const res = await request(app)
        .post('/api/chat/rooms')
        .set('Authorization', support())
        .send({ type: typ, name: 'Support-Gruppe', participants: [USERS.orgAdmin1.id], jahrgang_id: 1 });
      expect(res.status).toBe(403);
      expect(res.body.error_code).toBe('keine_aktive_gemeinde');
      const { rows } = await db.query("SELECT 1 FROM chat_rooms WHERE name = 'Support-Gruppe'");
      expect(rows).toHaveLength(0);
    });

    it('erlaubt: POST /chat/rooms mit aktiver Gemeinde (Gast) legt die Gruppe an', async () => {
      await alsGast(ORGS.testGemeinde.id);
      const res = await request(app)
        .post('/api/chat/rooms')
        .set('Authorization', support())
        .set('X-Active-Organization', String(ORGS.testGemeinde.id))
        .send({ type: 'group', name: 'Support-Gruppe', participants: [USERS.orgAdmin1.id] });
      await warteAufNachwehen(app);
      expect(res.status).toBe(200);
      const { rows: [raum] } = await db.query("SELECT organization_id FROM chat_rooms WHERE name = 'Support-Gruppe'");
      expect(raum.organization_id).toBe(ORGS.testGemeinde.id);
    });

    it('Zaehler am App-Symbol: 200, alles null', async () => {
      const res = await request(app).get('/api/notifications/badge-counts').set('Authorization', support());
      expect(res.status).toBe(200);
      expect(res.body.chat).toEqual({ total: 0, byRoom: {} });
      expect(res.body.pendingRequests).toBe(0);
      expect(res.body.pendingEvents).toBe(0);
      expect(res.body.pendingChallenges).toBe(0);
    });
  });

  describe('Gast in einer Gemeinde (Punkt 14)', () => {
    it('steht in der Benutzerliste der Gemeinde, als Gemeindeleitung aus einer weiteren Gemeinde', async () => {
      await alsGast(ORGS.testGemeinde.id);
      const res = await request(app).get('/api/users').set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
      expect(res.status).toBe(200);
      const gast = res.body.find((u) => u.id === SUPPORT.id);
      expect(gast).toMatchObject({ role_name: 'org_admin', mitgliedschaft: 'weitere', weitere_gemeinden: 0, can_edit: true });
    });

    it('weitere_gemeinden zaehlt nur echte Gemeinden (Gast in zweien: 1)', async () => {
      await alsGast(ORGS.testGemeinde.id);
      await alsGast(ORGS.andereGemeinde.id);
      const res = await request(app).get('/api/users').set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
      expect(res.body.find((u) => u.id === SUPPORT.id).weitere_gemeinden).toBe(1);
    });

    it('bestehende Konten: weitere_gemeinden unveraendert (Stamm 0, Gast aus Gemeinde 2: 1)', async () => {
      await db.query('INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
        [USERS.teamer2.id, ORGS.testGemeinde.id, ROLES.teamer.id]);
      const res = await request(app).get('/api/users').set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
      expect(res.body.find((u) => u.id === USERS.teamer1.id)).toMatchObject({ mitgliedschaft: 'stamm', weitere_gemeinden: 0 });
      expect(res.body.find((u) => u.id === USERS.teamer2.id)).toMatchObject({ mitgliedschaft: 'weitere', weitere_gemeinden: 1 });
    });

    it('erlaubt: GET /users/:id zeigt den Gast der Gemeindeleitung mit Super-Admin-Merkmal (200 statt 404)', async () => {
      await alsGast(ORGS.testGemeinde.id);
      const res = await request(app).get(`/api/users/${SUPPORT.id}`).set('Authorization', `Bearer ${generateToken('orgAdminSuper')}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: SUPPORT.id, role_name: 'org_admin', mitgliedschaft: 'weitere', assigned_jahrgaenge: [] });
    });

    it('verboten: die Detailansicht fuer die Gemeindeleitung ist wie bei jedem Super-Admin-Konto gesperrt (403 statt 404)', async () => {
      await alsGast(ORGS.testGemeinde.id);
      const res = await request(app).get(`/api/users/${SUPPORT.id}`).set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe(SUPER_ADMIN_TEXT);
    });

    it('verboten: die Gemeindeleitung bearbeitet das Support-Konto nicht (403 statt 404)', async () => {
      await alsGast(ORGS.testGemeinde.id);
      const res = await request(app)
        .put(`/api/users/${SUPPORT.id}`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`)
        .send({ display_name: 'Uebernommen' });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe(SUPER_ADMIN_TEXT);
    });

    it('Rueckblick-Verlauf des Gasts: die Leitung der Gastgemeinde liest ihn (200, leer)', async () => {
      await alsGast(ORGS.testGemeinde.id);
      const res = await request(app).get(`/api/wrapped/history/${SUPPORT.id}`).set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('verboten: die Leitung einer Gemeinde ohne den Gast liest den Verlauf nicht', async () => {
      await alsGast(ORGS.testGemeinde.id);
      const res = await request(app).get(`/api/wrapped/history/${SUPPORT.id}`).set('Authorization', `Bearer ${generateToken('orgAdmin2')}`);
      expect(res.status).toBe(403);
    });

    it('GET /organizations/:id/members: is_primary ist false, nicht null', async () => {
      await alsGast(ORGS.testGemeinde.id);
      const res = await request(app).get(`/api/organizations/${ORGS.testGemeinde.id}/members`).set('Authorization', `Bearer ${generateToken('superAdmin')}`);
      expect(res.status).toBe(200);
      expect(res.body.find((m) => m.id === SUPPORT.id).is_primary).toBe(false);
      expect(res.body.find((m) => m.id === USERS.orgAdmin1.id).is_primary).toBe(true);
    });

    it('switch-org in die Gastgemeinde: 200 mit Claim; in eine fremde: 403', async () => {
      await alsGast(ORGS.testGemeinde.id);
      const gut = await request(app).post('/api/auth/switch-org')
        .set('Authorization', `Bearer ${supportToken()}`).send({ organization_id: ORGS.testGemeinde.id });
      expect(gut.status).toBe(200);
      expect(gut.body).toMatchObject({ active_organization_id: ORGS.testGemeinde.id, is_primary: false, role_name: 'org_admin' });
      expect(jwt.verify(gut.body.token, JWT_SECRET)).toMatchObject({ active_organization_id: ORGS.testGemeinde.id, organization_id: null });

      const fremd = await request(app).post('/api/auth/switch-org')
        .set('Authorization', `Bearer ${supportToken()}`).send({ organization_id: ORGS.andereGemeinde.id });
      expect(fremd.status).toBe(403);
    });

    it('mit Kopfzeile der Gastgemeinde arbeitet das Konto dort als Gemeindeleitung; fremde Gemeinde: org_kein_zugriff', async () => {
      await alsGast(ORGS.testGemeinde.id);
      const dort = await request(app).get('/api/users')
        .set('Authorization', `Bearer ${supportToken()}`).set('X-Active-Organization', String(ORGS.testGemeinde.id));
      expect(dort.status).toBe(200);
      expect(dort.body.map((u) => u.id)).toContain(USERS.orgAdmin1.id);

      const fremd = await request(app).get('/api/auth/me')
        .set('Authorization', `Bearer ${supportToken()}`).set('X-Active-Organization', String(ORGS.andereGemeinde.id));
      expect(fremd.status).toBe(403);
      expect(fremd.body.error_code).toBe('org_kein_zugriff');
    });
  });

  // Simon, 03.10.2026: Die Gemeindeleitung darf einen Support-Gast selbst
  // aus IHRER Gemeinde nehmen. Es endet nur die Mitgliedschaft
  // (user_organizations), das Konto bleibt; bearbeiten, Passwort und
  // Loeschen bleiben gesperrt. Bis dahin lehnte checkUserHierarchy
  // DELETE /users/:id mit 403 "Super-Admin-Konten kann nur ein Super-Admin
  // bearbeiten." ab -- herausnehmen konnte den Gast nur ein Super-Admin.
  describe('Support-Gast aus der Gemeinde nehmen (DELETE /users/:id)', () => {
    const entfernen = (token, userId = SUPPORT.id) => request(app)
      .delete(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${token}`);
    const mitgliedschaften = async (userId = SUPPORT.id) => (await db.query(
      'SELECT organization_id FROM user_organizations WHERE user_id = $1 ORDER BY organization_id', [userId]
    )).rows.map((r) => Number(r.organization_id));
    const konto = async (userId = SUPPORT.id) => (await db.query(
      'SELECT id, organization_id, is_active, deleted_at, is_super_admin FROM users WHERE id = $1', [userId]
    )).rows[0];

    it('erlaubt: die Gemeindeleitung der Gastgemeinde -- nur die Mitgliedschaft endet, das Konto bleibt', async () => {
      await alsGast(ORGS.testGemeinde.id);
      await alsGast(ORGS.andereGemeinde.id);
      const res = await entfernen(generateToken('orgAdmin1'));
      await warteAufNachwehen(app);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Mitgliedschaft in dieser Gemeinde beendet', konto_bleibt: true });
      expect(await mitgliedschaften()).toEqual([ORGS.andereGemeinde.id]);
      expect(await konto()).toEqual({ id: SUPPORT.id, organization_id: null, is_active: true, deleted_at: null, is_super_admin: true });
    });

    it('danach: Konto unverändert -- die Anmeldung im Browser geht weiter, die Benutzerliste der Gemeinde zeigt es nicht mehr', async () => {
      await alsGast(ORGS.testGemeinde.id);
      expect((await entfernen(generateToken('orgAdmin1'))).status).toBe(200);
      await warteAufNachwehen(app);
      invalidateUserCache(SUPPORT.id);
      const login = await request(app).post('/api/auth/login')
        .send({ username: SUPPORT.username, password: 'Support-Passwort1!', kann_ohne_gemeinde: true });
      expect(login.status).toBe(200);
      const liste = await request(app).get('/api/users').set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
      expect(liste.body.map((u) => u.id)).not.toContain(SUPPORT.id);
    });

    it('verboten: die Gemeindeleitung einer fremden Gemeinde (404, Mitgliedschaft bleibt)', async () => {
      await alsGast(ORGS.testGemeinde.id);
      const res = await entfernen(generateToken('orgAdmin2'));
      expect(res.status).toBe(404);
      expect(await mitgliedschaften()).toEqual([ORGS.testGemeinde.id]);
    });

    it.each([
      ['Leitung (admin)', 'admin1', 403],
      ['Teamer:in', 'teamer1', 403],
    ])('verboten: %s der Gastgemeinde (%i, Mitgliedschaft bleibt)', async (_wer, nutzer, status) => {
      await alsGast(ORGS.testGemeinde.id);
      const res = await entfernen(generateToken(nutzer));
      expect(res.status).toBe(status);
      expect(await mitgliedschaften()).toEqual([ORGS.testGemeinde.id]);
    });

    it('verboten: die Leitung (admin), auch wenn der Gast dort nur Teamer:in ist (403, Mitgliedschaft bleibt)', async () => {
      // Ohne die Grenze auf die Gemeindeleitung duerfte eine Leitung eine
      // Teamer:in verwalten -- und damit auch den Support-Gast in dieser Rolle.
      await alsGast(ORGS.testGemeinde.id, 'teamer');
      const res = await entfernen(generateToken('admin1'));
      expect(res.status).toBe(403);
      expect(res.body.error).toBe(SUPER_ADMIN_TEXT);
      expect(await mitgliedschaften()).toEqual([ORGS.testGemeinde.id]);
    });

    it('verboten: ein Super-Admin-Konto MIT Gemeinde, das in einer anderen Gemeinde mitarbeitet (403, Mitgliedschaft bleibt)', async () => {
      // Simons Konstellation: Gemeindeleitung mit Merkmal in Gemeinde 1, dazu
      // Gemeindeleitung in Gemeinde 2.
      await db.query('INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
        [USERS.orgAdminSuper.id, ORGS.andereGemeinde.id, ROLES.orgAdmin2.id]);
      const res = await entfernen(generateToken('orgAdmin2'), USERS.orgAdminSuper.id);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe(SUPER_ADMIN_TEXT);
      expect(await mitgliedschaften(USERS.orgAdminSuper.id)).toEqual([ORGS.andereGemeinde.id]);
    });

    it('verboten: bearbeiten und Passwort setzen bleiben für die Gemeindeleitung gesperrt, auch nach dem Entfernen kein Löschen', async () => {
      await alsGast(ORGS.testGemeinde.id);
      const token = generateToken('orgAdmin1');
      const bearbeiten = await request(app).put(`/api/users/${SUPPORT.id}`).set('Authorization', `Bearer ${token}`)
        .send({ display_name: 'Übernommen' });
      expect(bearbeiten.status).toBe(403);
      const passwort = await request(app).put(`/api/users/${SUPPORT.id}/reset-password`).set('Authorization', `Bearer ${token}`)
        .send({ password: 'Neues-Passwort2!' });
      expect(passwort.status).toBe(403);
      expect((await entfernen(token)).status).toBe(200);
      await warteAufNachwehen(app);
      // Ein zweites Entfernen findet den Gast nicht mehr -- und loescht nichts.
      expect((await entfernen(token)).status).toBe(404);
      expect(await konto()).toMatchObject({ id: SUPPORT.id, is_active: true, deleted_at: null });
      const { rows: [{ display_name: name }] } = await db.query('SELECT display_name FROM users WHERE id = $1', [SUPPORT.id]);
      expect(name).toBe(SUPPORT.display_name);
    });
  });

  describe('Passwort setzen (PUT /users/:id/reset-password)', () => {
    const setze = (token) => request(app)
      .put(`/api/users/${SUPPORT.id}/reset-password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'Neues-Passwort2!' });

    it('erlaubt: ein Super-Admin setzt das Passwort -- und es ist danach gesetzt', async () => {
      const res = await setze(generateToken('superAdmin'));
      await warteAufNachwehen(app);
      expect(res.status).toBe(200);
      const { rows: [konto] } = await db.query('SELECT password_hash FROM users WHERE id = $1', [SUPPORT.id]);
      expect(await bcrypt.compare('Neues-Passwort2!', konto.password_hash)).toBe(true);
    });

    it('verboten: die Gemeindeleitung der Gastgemeinde (403, Passwort unveraendert)', async () => {
      await alsGast(ORGS.testGemeinde.id);
      const res = await setze(generateToken('orgAdmin1'));
      expect(res.status).toBe(403);
      const { rows: [konto] } = await db.query('SELECT password_hash FROM users WHERE id = $1', [SUPPORT.id]);
      expect(await bcrypt.compare('Neues-Passwort2!', konto.password_hash)).toBe(false);
    });
  });

  describe('Systemrolle super_admin ohne Gemeinde (Migration 190)', () => {
    it('GET /roles der Gemeinde listet sie nicht', async () => {
      const res = await request(app).get('/api/roles').set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
      expect(res.status).toBe(200);
      expect(res.body.map((r) => r.id)).not.toContain(SYSTEMROLLE_ID);
      expect(res.body.map((r) => r.id)).toContain(ROLES.orgAdmin.id);
    });

    it.each(['orgAdmin1', 'orgAdminSuper'])('verboten: %s legt kein Konto mit der Systemrolle an (403)', async (wer) => {
      const res = await request(app).post('/api/users')
        .set('Authorization', `Bearer ${generateToken(wer)}`)
        .send({ display_name: 'Neuer Support', username: 'neuer.support', password: 'Support-Passwort1!', role_id: SYSTEMROLLE_ID });
      expect(res.status).toBe(403);
      const { rows } = await db.query("SELECT 1 FROM users WHERE username = 'neuer.support'");
      expect(rows).toHaveLength(0);
    });

    it.each(['orgAdmin1', 'orgAdminSuper'])('verboten: %s gibt einer Teamer:in die Systemrolle nicht (403)', async (wer) => {
      const res = await request(app).put(`/api/users/${USERS.teamer1.id}`)
        .set('Authorization', `Bearer ${generateToken(wer)}`)
        .send({ role_id: SYSTEMROLLE_ID });
      expect(res.status).toBe(403);
      const { rows: [konto] } = await db.query('SELECT role_id FROM users WHERE id = $1', [USERS.teamer1.id]);
      expect(konto.role_id).toBe(ROLES.teamer.id);
    });

    it('verboten: als Mitglieds-Rolle einer Gemeinde (POST /organizations/:id/members, 400)', async () => {
      const res = await request(app).post(`/api/organizations/${ORGS.testGemeinde.id}/members`)
        .set('Authorization', `Bearer ${generateToken('superAdmin')}`)
        .send({ user_id: USERS.teamer2.id, role_name: 'super_admin' });
      expect(res.status).toBe(400);
    });
  });

  describe('Gemeinde loeschen, in der das Support-Konto Gast ist', () => {
    it('die Mitgliedschaft endet, das Konto bleibt; Zaehler danach ohne Fehler', async () => {
      await alsGast(ORGS.andereGemeinde.id);
      const res = await request(app)
        .delete(`/api/organizations/${ORGS.andereGemeinde.id}`)
        .set('Authorization', `Bearer ${generateToken('superAdmin')}`);
      await warteAufNachwehen(app);
      expect(res.status).toBe(200);
      // konfi3, teamer2, admin2, orgadmin2 -- das Support-Konto nicht
      expect(res.body.konten_geloescht).toBe(4);

      const { rows: [konto] } = await db.query('SELECT organization_id, is_super_admin FROM users WHERE id = $1', [SUPPORT.id]);
      expect(konto).toEqual({ organization_id: null, is_super_admin: true });
      const { rows: mitgliedschaften } = await db.query('SELECT 1 FROM user_organizations WHERE user_id = $1', [SUPPORT.id]);
      expect(mitgliedschaften).toHaveLength(0);

      invalidateUserCache(SUPPORT.id);
      const zaehler = await request(app).get('/api/notifications/badge-counts').set('Authorization', `Bearer ${supportToken()}`);
      expect(zaehler.status).toBe(200);
      expect(zaehler.body.chat).toEqual({ total: 0, byRoom: {} });
    });

    it('der Zaehler- und Abzeichenlauf laeuft mit einem Konto ohne Gemeinde durch und laesst es aus', async () => {
      const BackgroundService = require('../../services/backgroundService');
      const ergebnis = await BackgroundService.updateAllUserBadges(db);
      // Gezaehlt werden die aktiven Konfis, Teamer:innen und Leitungen der
      // beiden Seed-Gemeinden; die Rolle super_admin laeuft nicht mit
      // (backgroundService.js), ein Konto ohne Gemeinde schon gar nicht.
      const { rows: [{ anzahl }] } = await db.query(
        `SELECT COUNT(*)::int AS anzahl FROM users u JOIN roles r ON r.id = u.role_id
          WHERE r.name IN ('konfi', 'teamer', 'admin', 'org_admin') AND u.organization_id IS NOT NULL`
      );
      expect(ergebnis.total).toBe(anzahl);
    });
  });
});
