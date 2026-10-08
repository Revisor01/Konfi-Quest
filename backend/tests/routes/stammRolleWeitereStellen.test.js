// backend/tests/routes/stammRolleWeitereStellen.test.js
//
// Stamm-Rolle an weiteren Stellen (Mehrfach-Konten), docs/offene-befunde.md,
// erledigt am 08.10.2026. Rolle, Funktion und Sperre gelten je Gemeinde
// (user_organizations, Migration 196); users.organization_id und
// users.role_id beschreiben nur die Stamm-Gemeinde. Die folgenden Routen
// lasen bis dahin nur die Stamm-Seite:
//
//   1. Schutz "letzte Gemeindeleitung" (DELETE /admin/users/:id,
//      POST /auth/delete-account) -- Simon: gezaehlt wird aus BEIDEN Quellen.
//   2. Passwort setzen (PUT /admin/users/:id/reset-password,
//      POST /admin/konfis/:id/regenerate-password) -- Simon: jede Gemeinde,
//      in der die Person Mitglied ist, darf es.
//   4. POST /admin/jahrgaenge mit Zuweisungen.
//   6. Teilnehmende eines Termins in der Konfi-Sicht.
//
// Je Stelle der erlaubte und der verbotene Fall.

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ROLES, ORGS, EVENTS, PASSWORD } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');
const { gemeindenOhneWeitereLeitung } = require('../../utils/orgMitglieder');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-vitest';
const ORG1 = ORGS.testGemeinde.id;
const ORG2 = ORGS.andereGemeinde.id;

// Oberhalb des Seed-Bereichs.
const GAST = 261;

describe('Stamm-Rolle an weiteren Stellen (Mehrfach-Konten)', () => {
  let app;
  let db;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    invalidateUserCache();
  });

  // Ein Konto mit Stamm-Gemeinde und Rolle dort, Passwort wie im Seed.
  const kontoAnlegen = async (id, { org, rolle }) => {
    await db.query(
      `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
       SELECT $1::int, 'gast' || $1::text, password_hash, 'Gast Person', $2, $3, true FROM users WHERE id = $4`,
      [id, rolle, org, USERS.teamer1.id]
    );
  };
  const mitgliedschaft = (userId, org, rolle, { aktiv = true } = {}) => db.query(
    'INSERT INTO user_organizations (user_id, organization_id, role_id, is_active) VALUES ($1, $2, $3, $4)',
    [userId, org, rolle, aktiv]
  );
  const tokenFuer = (id, org, rolle, type) => jwt.sign(
    { id, type, organization_id: org, role_id: rolle }, JWT_SECRET, { expiresIn: '1h' }
  );
  const gibtEs = async (id) => {
    const { rows } = await db.query('SELECT 1 FROM users WHERE id = $1', [id]);
    return rows.length === 1;
  };
  const passwortHash = async (id) => {
    const { rows: [u] } = await db.query('SELECT password_hash FROM users WHERE id = $1', [id]);
    return u.password_hash;
  };

  // ==========================================================================
  // 1. Letzte Gemeindeleitung
  // ==========================================================================
  describe('Schutz der letzten Gemeindeleitung zaehlt beide Quellen', () => {
    // Die Regel steht einmal (utils/orgMitglieder.js); DELETE /users/:id und
    // die Selbstloeschung fragen sie. Ueber DELETE /users/:id ist der
    // verbotene Fall seither nicht mehr erreichbar: Wer dort loescht, ist
    // selbst aktive Gemeindeleitung dieser Gemeinde (requireAdmin plus
    // Hierarchie) und zaehlt mit. Deshalb hier gegen die Regel selbst.
    it('verboten (Regel): wer nur ueber user_organizations die letzte aktive Gemeindeleitung ist, wird gemeldet', async () => {
      // GAST: zuhause Teamer:in in Org 2, in Org 1 Gemeindeleitung -- die
      // einzige: Die beiden Org-Admins der Stamm-Seite werden Admins.
      await kontoAnlegen(GAST, { org: ORG2, rolle: ROLES.teamer2.id });
      await mitgliedschaft(GAST, ORG1, ROLES.orgAdmin.id);
      await db.query('UPDATE users SET role_id = $1 WHERE id = ANY($2::int[])',
        [ROLES.admin.id, [USERS.orgAdmin1.id, USERS.orgAdminSuper.id]]);

      expect(await gemeindenOhneWeitereLeitung(db, GAST)).toEqual([ORG1]);
      expect(await gemeindenOhneWeitereLeitung(db, GAST, [ORG1])).toEqual([ORG1]);
      expect(await gemeindenOhneWeitereLeitung(db, GAST, [ORG2])).toEqual([]);
    });

    it('erlaubt (Regel): mit einer weiteren aktiven Gemeindeleitung aus einer der beiden Quellen nichts', async () => {
      await kontoAnlegen(GAST, { org: ORG2, rolle: ROLES.teamer2.id });
      await mitgliedschaft(GAST, ORG1, ROLES.orgAdmin.id);
      // Stamm-Seite: orgAdmin1 und orgAdminSuper leiten Org 1.
      expect(await gemeindenOhneWeitereLeitung(db, GAST)).toEqual([]);
      // Nur noch user_organizations-Seite: orgAdmin2 leitet Org 1 mit.
      await db.query('UPDATE users SET role_id = $1 WHERE id = ANY($2::int[])',
        [ROLES.admin.id, [USERS.orgAdmin1.id, USERS.orgAdminSuper.id]]);
      await mitgliedschaft(USERS.orgAdmin2.id, ORG1, ROLES.orgAdmin.id);
      expect(await gemeindenOhneWeitereLeitung(db, GAST)).toEqual([]);
    });

    it('erlaubt: gibt es eine weitere aktive Gemeindeleitung, endet die Mitgliedschaft', async () => {
      await kontoAnlegen(GAST, { org: ORG2, rolle: ROLES.teamer2.id });
      await mitgliedschaft(GAST, ORG1, ROLES.orgAdmin.id);

      const res = await request(app)
        .delete(`/api/admin/users/${GAST}`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);

      expect(res.status).toBe(200);
      expect(res.body.konto_bleibt).toBe(true);
      const { rows } = await db.query('SELECT 1 FROM user_organizations WHERE user_id = $1', [GAST]);
      expect(rows).toHaveLength(0);
    });

    it('verboten: Selbstloeschung der letzten Gemeindeleitung einer weiteren Gemeinde', async () => {
      // GAST: zuhause Teamer:in in Org 1, in Org 2 einzige Gemeindeleitung.
      await kontoAnlegen(GAST, { org: ORG1, rolle: ROLES.teamer.id });
      await mitgliedschaft(GAST, ORG2, ROLES.orgAdmin2.id);
      await db.query('UPDATE users SET role_id = $1 WHERE id = $2', [ROLES.admin2.id, USERS.orgAdmin2.id]);

      const res = await request(app)
        .post('/api/auth/delete-account')
        .set('Authorization', `Bearer ${tokenFuer(GAST, ORG1, ROLES.teamer.id, 'teamer')}`)
        .send({ password: PASSWORD });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/letzte Person mit Verwaltungsrechten/);
      expect(await gibtEs(GAST)).toBe(true);
    });

    it('erlaubt: Selbstloeschung, wenn die zweite Gemeindeleitung nur ueber user_organizations dabei ist', async () => {
      // orgAdmin1 ist in Org 1 Gemeindeleitung; die andere Stamm-Leitung wird
      // Admin, GAST (zuhause Org 2) leitet Org 1 ueber user_organizations mit.
      await db.query('UPDATE users SET role_id = $1 WHERE id = $2', [ROLES.admin.id, USERS.orgAdminSuper.id]);
      await kontoAnlegen(GAST, { org: ORG2, rolle: ROLES.teamer2.id });
      await mitgliedschaft(GAST, ORG1, ROLES.orgAdmin.id);

      const res = await request(app)
        .post('/api/auth/delete-account')
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`)
        .send({ password: PASSWORD });

      expect(res.status).toBe(200);
      expect(await gibtEs(USERS.orgAdmin1.id)).toBe(false);
    });

    it('verboten: eine in dieser Gemeinde gesperrte zweite Leitung zaehlt nicht', async () => {
      await db.query('UPDATE users SET role_id = $1 WHERE id = $2', [ROLES.admin.id, USERS.orgAdminSuper.id]);
      await kontoAnlegen(GAST, { org: ORG2, rolle: ROLES.teamer2.id });
      await mitgliedschaft(GAST, ORG1, ROLES.orgAdmin.id, { aktiv: false });

      const res = await request(app)
        .post('/api/auth/delete-account')
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`)
        .send({ password: PASSWORD });

      expect(res.status).toBe(409);
      expect(await gibtEs(USERS.orgAdmin1.id)).toBe(true);
    });
  });

  // ==========================================================================
  // 2. Passwort setzen
  // ==========================================================================
  describe('Passwort setzen fuer Mitglieder einer weiteren Gemeinde', () => {
    it('erlaubt: PUT /users/:id/reset-password fuer eine Teamer:in, die nur ueber user_organizations hier ist', async () => {
      await mitgliedschaft(USERS.teamer2.id, ORG1, ROLES.teamer.id);
      const vorher = await passwortHash(USERS.teamer2.id);

      const res = await request(app)
        .put(`/api/admin/users/${USERS.teamer2.id}/reset-password`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`)
        .send({ password: 'Neues!Pw123' });

      expect(res.status).toBe(200);
      expect(await passwortHash(USERS.teamer2.id)).not.toBe(vorher);
    });

    it('verboten: PUT /users/:id/reset-password fuer ein Konto, das nicht zur Gemeinde gehoert', async () => {
      const vorher = await passwortHash(USERS.teamer2.id);

      const res = await request(app)
        .put(`/api/admin/users/${USERS.teamer2.id}/reset-password`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`)
        .send({ password: 'Neues!Pw123' });

      expect(res.status).toBe(403);
      expect(await passwortHash(USERS.teamer2.id)).toBe(vorher);
    });

    it('erlaubt: Einmalpasswort fuer eine Teamer:in, die nur ueber user_organizations hier ist', async () => {
      await mitgliedschaft(USERS.teamer2.id, ORG1, ROLES.teamer.id);
      const vorher = await passwortHash(USERS.teamer2.id);

      const res = await request(app)
        .post(`/api/admin/konfis/${USERS.teamer2.id}/regenerate-password`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);

      expect(res.status).toBe(200);
      expect(typeof res.body.temporaryPassword).toBe('string');
      expect(await passwortHash(USERS.teamer2.id)).not.toBe(vorher);
    });

    it('verboten: Einmalpasswort fuer ein Konto, das nicht zur Gemeinde gehoert', async () => {
      const vorher = await passwortHash(USERS.teamer2.id);

      const res = await request(app)
        .post(`/api/admin/konfis/${USERS.teamer2.id}/regenerate-password`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);

      expect(res.status).toBe(404);
      expect(await passwortHash(USERS.teamer2.id)).toBe(vorher);
    });

    it('verboten: Einmalpasswort fuer ein Konto, das hier Leitung ist (Rolle in DIESER Gemeinde)', async () => {
      // Zuhause Teamer:in, hier Admin: Leitungspasswoerter laufen ueber die
      // Benutzerverwaltung.
      await mitgliedschaft(USERS.teamer2.id, ORG1, ROLES.admin.id);
      const vorher = await passwortHash(USERS.teamer2.id);

      const res = await request(app)
        .post(`/api/admin/konfis/${USERS.teamer2.id}/regenerate-password`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);

      expect(res.status).toBe(404);
      expect(await passwortHash(USERS.teamer2.id)).toBe(vorher);
    });
  });

  // ==========================================================================
  // 4. Jahrgang mit Zuweisungen anlegen
  // ==========================================================================
  describe('POST /admin/jahrgaenge mit Team aus einer anderen Stamm-Gemeinde', () => {
    it('erlaubt: Teamer:in, die ueber user_organizations Mitglied ist, wird zugewiesen', async () => {
      await mitgliedschaft(USERS.teamer2.id, ORG1, ROLES.teamer.id);

      const res = await request(app)
        .post('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`)
        .send({ name: '2027/2028', user_assignments: [{ user_id: USERS.teamer2.id }] });

      expect(res.status).toBe(201);
      expect(res.body.assigned_user_ids).toEqual([USERS.teamer2.id]);
      const { rows } = await db.query(
        'SELECT user_id FROM user_jahrgang_assignments WHERE jahrgang_id = $1', [res.body.id]);
      expect(rows.map((r) => Number(r.user_id))).toEqual([USERS.teamer2.id]);
    });

    it('verboten: Konto, das nicht zur Gemeinde gehoert -> 404, kein Jahrgang', async () => {
      const res = await request(app)
        .post('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`)
        .send({ name: '2027/2028', user_assignments: [{ user_id: USERS.teamer2.id }] });

      expect(res.status).toBe(404);
      const { rows } = await db.query("SELECT 1 FROM jahrgaenge WHERE name = '2027/2028'");
      expect(rows).toHaveLength(0);
    });

    it('verboten: die Hierarchie prueft die Rolle in DIESER Gemeinde (hier Gemeindeleitung)', async () => {
      // Zuhause Teamer:in, hier Gemeindeleitung: Ein Admin darf sie nicht zuweisen.
      await mitgliedschaft(USERS.teamer2.id, ORG1, ROLES.orgAdmin.id);

      const res = await request(app)
        .post('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${generateToken('admin1')}`)
        .send({ name: '2027/2028', user_assignments: [{ user_id: USERS.teamer2.id }] });

      expect(res.status).toBe(403);
    });
  });

  // ==========================================================================
  // 6. Teilnehmende eines Termins in der Konfi-Sicht
  // ==========================================================================
  describe('GET /konfi/events/:id/participants filtert Teamer:innen nach der Rolle in der Gemeinde des Termins', () => {
    const buchen = (userId) => db.query(
      "INSERT INTO event_bookings (event_id, user_id, status, organization_id) VALUES ($1, $2, 'confirmed', $3)",
      [EVENTS.gottesdienstEvent.id, userId, ORG1]
    );
    const teilnehmende = async () => {
      const res = await request(app)
        .get(`/api/konfi/events/${EVENTS.gottesdienstEvent.id}/participants`)
        .set('Authorization', `Bearer ${generateToken('konfi1')}`);
      expect(res.status).toBe(200);
      return res.body.map((p) => Number(p.id));
    };

    it('verboten: zuhause Admin, hier Teamer:in -- erscheint nicht unter den Teilnehmenden', async () => {
      await mitgliedschaft(USERS.admin2.id, ORG1, ROLES.teamer.id);
      await buchen(USERS.admin2.id);
      await buchen(USERS.konfi1.id);

      expect(await teilnehmende()).toEqual([USERS.konfi1.id]);
    });

    it('erlaubt: zuhause Teamer:in, hier Admin -- erscheint wie jede Leitung', async () => {
      await mitgliedschaft(USERS.teamer2.id, ORG1, ROLES.admin.id);
      await buchen(USERS.teamer2.id);
      await buchen(USERS.konfi1.id);

      expect((await teilnehmende()).sort((a, b) => a - b)).toEqual([USERS.konfi1.id, USERS.teamer2.id]);
    });
  });
});
