// /api/organizations/support-konten -- Support-Konten ohne Gemeinde anlegen,
// auflisten, sperren, Passwort setzen, loeschen (03.10.2026; Simon,
// docs/planung/web-version.md Punkt 10 bis 15). Nur Super-Admins.
//
// Schutz: Das letzte aktive Super-Admin-Konto laesst sich weder sperren noch
// loeschen -- auch nicht ueber POST /auth/delete-account
// (utils/superAdminKonten.js).
const request = require('supertest');
const bcrypt = require('bcrypt');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES, PASSWORD } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');
const {
  SUPPORT, SYSTEMROLLE_ID, PASSWORT_SUPPORT, systemrolleAnlegen, supportKontoAnlegen, supportToken, refreshTokenAnlegen,
} = require('../helpers/kontoOhneGemeinde');

const PFAD = '/api/organizations/support-konten';
const NEU = { username: 'Support.Zwei', display_name: 'Support Zwei', password: 'Hilfe-Passwort3!', email: 'support@example.test' };
const VERGEBEN = 'Benutzername existiert bereits (muss systemweit eindeutig sein)';
const LETZTES_SPERREN = 'Das letzte aktive Super-Admin-Konto lässt sich nicht sperren. Lege zuerst ein weiteres an.';
const LETZTES_LOESCHEN = 'Das letzte aktive Super-Admin-Konto lässt sich nicht löschen. Lege zuerst ein weiteres an.';

describe('Support-Konten (nur Super-Admins)', () => {
  let app, db;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    await systemrolleAnlegen(db);
    for (const u of [...Object.values(USERS), SUPPORT]) invalidateUserCache(u.id);
  });

  const als = (key) => `Bearer ${generateToken(key)}`;
  const anlegen = (token = als('superAdmin'), daten = NEU) =>
    request(app).post(PFAD).set('Authorization', token).send(daten);
  const anmelden = (username, password, web = true) => request(app).post('/api/auth/login')
    .send({ username, password, ...(web ? { kann_ohne_gemeinde: true } : {}) });
  const nurSupportAktiv = async () => {
    await db.query('UPDATE users SET is_active = false WHERE id = ANY($1)', [[USERS.superAdmin.id, USERS.orgAdminSuper.id]]);
    for (const u of Object.values(USERS)) invalidateUserCache(u.id);
  };

  describe('Rechte', () => {
    it.each(['orgAdmin1', 'admin1', 'teamer1', 'konfi1'])('verboten: %s -- jede Route 403, nichts angelegt oder geaendert', async (wer) => {
      await supportKontoAnlegen(db);
      const token = als(wer);
      const antworten = await Promise.all([
        request(app).get(PFAD).set('Authorization', token),
        anlegen(token),
        request(app).patch(`${PFAD}/${SUPPORT.id}`).set('Authorization', token).send({ is_active: false }),
        request(app).put(`${PFAD}/${SUPPORT.id}/passwort`).set('Authorization', token).send({ password: 'Fremd-Passwort4!' }),
        request(app).delete(`${PFAD}/${SUPPORT.id}`).set('Authorization', token),
      ]);
      expect(antworten.map((r) => r.status)).toEqual([403, 403, 403, 403, 403]);
      const { rows } = await db.query('SELECT id, is_active, password_hash FROM users WHERE organization_id IS NULL');
      expect(rows).toHaveLength(1);
      expect(rows[0].is_active).toBe(true);
      expect(await bcrypt.compare(PASSWORT_SUPPORT, rows[0].password_hash)).toBe(true);
    });

    it.each(['superAdmin', 'orgAdminSuper'])('erlaubt: %s (Rolle oder Merkmal) liest die Liste', async (wer) => {
      await supportKontoAnlegen(db);
      const res = await request(app).get(PFAD).set('Authorization', als(wer));
      expect(res.status).toBe(200);
      expect(res.body.map((k) => k.id)).toEqual([SUPPORT.id]);
    });

    it('erlaubt: ein Support-Konto verwaltet Support-Konten (ohne aktive Gemeinde)', async () => {
      await supportKontoAnlegen(db);
      const res = await anlegen(`Bearer ${supportToken()}`);
      expect(res.status).toBe(201);
    });
  });

  describe('Anlegen (POST)', () => {
    it('legt ein Konto ohne Gemeinde mit Systemrolle und Merkmal an', async () => {
      const res = await anlegen();
      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: expect.any(Number), username: NEU.username, display_name: NEU.display_name, email: NEU.email,
        is_active: true, created_at: expect.any(String), gemeinden: [],
      });
      const { rows: [konto] } = await db.query(
        'SELECT organization_id, role_id, is_super_admin, password_hash FROM users WHERE id = $1', [res.body.id]);
      expect(konto).toMatchObject({ organization_id: null, role_id: SYSTEMROLLE_ID, is_super_admin: true });
      expect(await bcrypt.compare(NEU.password, konto.password_hash)).toBe(true);
    });

    it('das neue Konto meldet sich in der Web-Version an, in einer App nicht', async () => {
      await anlegen();
      const web = await anmelden('support.zwei', NEU.password);
      expect(web.status).toBe(200);
      expect(web.body.user).toMatchObject({ organization: null, role_name: 'super_admin', is_super_admin: true });
      const app_ = await anmelden('support.zwei', NEU.password, false);
      expect(app_.status).toBe(403);
      expect(app_.body.grund).toBe('konto_ohne_gemeinde');
    });

    it('Benutzername systemweit eindeutig, ohne Gross/klein (409)', async () => {
      const res = await anlegen(als('superAdmin'), { ...NEU, username: 'OrgAdmin1' });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe(VERGEBEN);
    });

    it.each([
      ['zu schwaches Passwort', { password: 'kurz' }],
      ['Leerzeichen im Benutzernamen', { username: 'support zwei' }],
      ['ohne Anzeigename', { display_name: '' }],
      ['ungueltige E-Mail', { email: 'keine-adresse' }],
    ])('400: %s', async (_fall, aenderung) => {
      const res = await anlegen(als('superAdmin'), { ...NEU, ...aenderung });
      expect(res.status).toBe(400);
      const { rows } = await db.query('SELECT 1 FROM users WHERE organization_id IS NULL');
      expect(rows).toHaveLength(0);
    });

    it('ohne Systemrolle (Migration 190 fehlt): 500 mit Hinweis, nichts angelegt', async () => {
      await db.query('DELETE FROM roles WHERE organization_id IS NULL');
      const res = await anlegen();
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Die Rolle für Support-Konten fehlt. Bitte den Migrationsstand prüfen.');
    });
  });

  describe('Liste (GET)', () => {
    it('nur Konten ohne Gemeinde, mit den Gemeinden, in denen sie Gast sind', async () => {
      await supportKontoAnlegen(db);
      await db.query('INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
        [SUPPORT.id, ORGS.testGemeinde.id, ROLES.orgAdmin.id]);
      const res = await request(app).get(PFAD).set('Authorization', als('superAdmin'));
      expect(res.status).toBe(200);
      expect(res.body).toEqual([{
        id: SUPPORT.id, username: SUPPORT.username, display_name: SUPPORT.display_name, email: null,
        is_active: true, last_login_at: null, created_at: expect.any(String),
        gemeinden: [{ id: ORGS.testGemeinde.id, name: ORGS.testGemeinde.name, display_name: ORGS.testGemeinde.display_name, role_name: 'org_admin' }],
      }]);
    });
  });

  describe('Sperren und entsperren (PATCH)', () => {
    it('sperren beendet alle Sitzungen; Anmeldung 403; entsperren gibt den Zugang zurueck', async () => {
      await supportKontoAnlegen(db);
      const refresh = await refreshTokenAnlegen(db, SUPPORT.id);
      const vorher = supportToken();

      const res = await request(app).patch(`${PFAD}/${SUPPORT.id}`).set('Authorization', als('superAdmin')).send({ is_active: false });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: SUPPORT.id, is_active: false });

      const { rows: offen } = await db.query(
        'SELECT 1 FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL', [SUPPORT.id]);
      expect(offen).toHaveLength(0);
      expect((await request(app).get(PFAD).set('Authorization', `Bearer ${vorher}`)).status).toBe(401);
      expect((await anmelden(SUPPORT.username, PASSWORT_SUPPORT)).body.error_code).toBe('user_inactive');
      expect((await request(app).post('/api/auth/refresh').send({ refresh_token: refresh, kann_ohne_gemeinde: true })).status).toBe(401);

      const auf = await request(app).patch(`${PFAD}/${SUPPORT.id}`).set('Authorization', als('superAdmin')).send({ is_active: true });
      expect(auf.status).toBe(200);
      expect((await anmelden(SUPPORT.username, PASSWORT_SUPPORT)).status).toBe(200);
    });

    it('404 fuer ein Konto mit Gemeinde -- das bleibt unveraendert', async () => {
      const res = await request(app).patch(`${PFAD}/${USERS.orgAdmin1.id}`).set('Authorization', als('superAdmin')).send({ is_active: false });
      expect(res.status).toBe(404);
      const { rows: [konto] } = await db.query('SELECT is_active FROM users WHERE id = $1', [USERS.orgAdmin1.id]);
      expect(konto.is_active).toBe(true);
    });

    it('400 ohne echten Boolean', async () => {
      await supportKontoAnlegen(db);
      const res = await request(app).patch(`${PFAD}/${SUPPORT.id}`).set('Authorization', als('superAdmin')).send({ is_active: 'false' });
      expect(res.status).toBe(400);
    });
  });

  describe('Passwort setzen (PUT /:id/passwort)', () => {
    it('setzt das Passwort, beendet die Sitzungen; das neue gilt', async () => {
      await supportKontoAnlegen(db);
      await refreshTokenAnlegen(db, SUPPORT.id);
      const res = await request(app).put(`${PFAD}/${SUPPORT.id}/passwort`).set('Authorization', als('superAdmin')).send({ password: 'Neues-Passwort5!' });
      expect(res.status).toBe(200);
      const { rows: offen } = await db.query('SELECT 1 FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL', [SUPPORT.id]);
      expect(offen).toHaveLength(0);
      expect((await anmelden(SUPPORT.username, 'Neues-Passwort5!')).status).toBe(200);
      expect((await anmelden(SUPPORT.username, PASSWORT_SUPPORT)).status).toBe(401);
    });

    it('400 bei zu schwachem Passwort, 404 fuer ein Konto mit Gemeinde', async () => {
      await supportKontoAnlegen(db);
      expect((await request(app).put(`${PFAD}/${SUPPORT.id}/passwort`).set('Authorization', als('superAdmin')).send({ password: 'kurz' })).status).toBe(400);
      expect((await request(app).put(`${PFAD}/${USERS.teamer1.id}/passwort`).set('Authorization', als('superAdmin')).send({ password: 'Neues-Passwort5!' })).status).toBe(404);
      const { rows: [teamer] } = await db.query('SELECT password_hash FROM users WHERE id = $1', [USERS.teamer1.id]);
      expect(await bcrypt.compare(PASSWORD, teamer.password_hash)).toBe(true);
    });
  });

  describe('Loeschen (DELETE)', () => {
    it('loescht das Konto samt Gast-Mitgliedschaften', async () => {
      await supportKontoAnlegen(db);
      await db.query('INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
        [SUPPORT.id, ORGS.testGemeinde.id, ROLES.orgAdmin.id]);
      const res = await request(app).delete(`${PFAD}/${SUPPORT.id}`).set('Authorization', als('superAdmin'));
      await warteAufNachwehen(app);
      expect(res.status).toBe(200);
      expect((await db.query('SELECT 1 FROM users WHERE id = $1', [SUPPORT.id])).rows).toHaveLength(0);
      expect((await db.query('SELECT 1 FROM user_organizations WHERE user_id = $1', [SUPPORT.id])).rows).toHaveLength(0);
    });

    it('404 fuer ein Konto mit Gemeinde -- es bleibt', async () => {
      const res = await request(app).delete(`${PFAD}/${USERS.teamer1.id}`).set('Authorization', als('superAdmin'));
      expect(res.status).toBe(404);
      expect((await db.query('SELECT 1 FROM users WHERE id = $1', [USERS.teamer1.id])).rows).toHaveLength(1);
    });
  });

  describe('Das letzte aktive Super-Admin-Konto bleibt', () => {
    it('verboten: sich selbst sperren, wenn kein anderes aktiv ist (409)', async () => {
      await supportKontoAnlegen(db);
      await nurSupportAktiv();
      const res = await request(app).patch(`${PFAD}/${SUPPORT.id}`).set('Authorization', `Bearer ${supportToken()}`).send({ is_active: false });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe(LETZTES_SPERREN);
      expect((await db.query('SELECT is_active FROM users WHERE id = $1', [SUPPORT.id])).rows[0].is_active).toBe(true);
    });

    it('verboten: sich selbst loeschen, wenn kein anderes aktiv ist (409)', async () => {
      await supportKontoAnlegen(db);
      await nurSupportAktiv();
      const res = await request(app).delete(`${PFAD}/${SUPPORT.id}`).set('Authorization', `Bearer ${supportToken()}`);
      expect(res.status).toBe(409);
      expect(res.body.error).toBe(LETZTES_LOESCHEN);
      expect((await db.query('SELECT 1 FROM users WHERE id = $1', [SUPPORT.id])).rows).toHaveLength(1);
    });

    it('verboten: auch nicht ueber POST /auth/delete-account (409)', async () => {
      await supportKontoAnlegen(db);
      await nurSupportAktiv();
      const res = await request(app).post('/api/auth/delete-account')
        .set('Authorization', `Bearer ${supportToken()}`).send({ password: PASSWORT_SUPPORT });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe(LETZTES_LOESCHEN);
      expect((await db.query('SELECT 1 FROM users WHERE id = $1', [SUPPORT.id])).rows).toHaveLength(1);
    });

    it('verboten: der letzte Super-Admin MIT Gemeinde loescht sich nicht selbst (409)', async () => {
      await db.query('UPDATE users SET is_active = false WHERE id = $1', [USERS.orgAdminSuper.id]);
      const res = await request(app).post('/api/auth/delete-account')
        .set('Authorization', als('superAdmin')).send({ password: PASSWORD });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe(LETZTES_LOESCHEN);
    });

    it('erlaubt: mit einem weiteren aktiven Super-Admin sperrt und loescht das Support-Konto sich selbst', async () => {
      await supportKontoAnlegen(db);
      const sperre = await request(app).patch(`${PFAD}/${SUPPORT.id}`).set('Authorization', `Bearer ${supportToken()}`).send({ is_active: false });
      expect(sperre.status).toBe(200);
      await db.query('UPDATE users SET is_active = true WHERE id = $1', [SUPPORT.id]);
      invalidateUserCache(SUPPORT.id);
      const weg = await request(app).post('/api/auth/delete-account')
        .set('Authorization', `Bearer ${supportToken()}`).send({ password: PASSWORT_SUPPORT });
      await warteAufNachwehen(app);
      expect(weg.status).toBe(200);
      expect((await db.query('SELECT 1 FROM users WHERE id = $1', [SUPPORT.id])).rows).toHaveLength(0);
    });

    it('erlaubt: Selbstloeschung eines Kontos ohne Super-Admin-Recht wie bisher', async () => {
      const res = await request(app).post('/api/auth/delete-account')
        .set('Authorization', als('teamer1')).send({ password: PASSWORD });
      await warteAufNachwehen(app);
      expect(res.status).toBe(200);
    });
  });

  describe('Gast in einer Gemeinde ueber POST /organizations/:id/members', () => {
    it('ein neu angelegtes Support-Konto wird Gemeindeleitung als Gast; die Gemeinde sieht es', async () => {
      const neu = await anlegen();
      const gast = await request(app).post(`/api/organizations/${ORGS.testGemeinde.id}/members`)
        .set('Authorization', als('superAdmin')).send({ user_id: neu.body.id, role_name: 'org_admin' });
      await warteAufNachwehen(app);
      expect(gast.status).toBe(201);
      const liste = await request(app).get('/api/users').set('Authorization', als('orgAdmin1'));
      expect(liste.body.find((u) => u.id === neu.body.id)).toMatchObject({ role_name: 'org_admin', mitgliedschaft: 'weitere' });
      const support = await request(app).get(PFAD).set('Authorization', als('superAdmin'));
      expect(support.body.find((k) => k.id === neu.body.id).gemeinden.map((g) => g.id)).toEqual([ORGS.testGemeinde.id]);
    });
  });
});
