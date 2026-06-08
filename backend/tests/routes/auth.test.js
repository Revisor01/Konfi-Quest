const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, PASSWORD, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Auth Routes', () => {
  let app;
  let db;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
  });

  afterAll(async () => {
    await closePool();
  });

  // ================================================================
  // POST /api/auth/login
  // ================================================================
  describe('POST /api/auth/login', () => {
    it('Login mit gueltigem Konfi gibt 200 + token + refresh_token + user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: USERS.konfi1.username, password: PASSWORD });

      expect(res.status).toBe(200);
      expect(typeof res.body.token).toBe('string');
      expect(typeof res.body.refresh_token).toBe('string');
      expect(res.body.user.id).toBe(USERS.konfi1.id);
      expect(res.body.user.type).toBe('konfi');
      expect(res.body.user.display_name).toBeDefined();
      expect(res.body.user.organization).toBeDefined();
      expect(res.body.user.gottesdienst_points).toBeDefined();
    });

    it('Login mit gueltigem Admin gibt 200 + admin-Typ', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: USERS.admin1.username, password: PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.user.type).toBe('admin');
      expect(res.body.user.role_name).toBe('admin');
      // Admin hat keine Konfi-spezifischen Felder
      expect(res.body.user.gottesdienst_points).toBeUndefined();
      expect(res.body.user.jahrgang).toBeUndefined();
    });

    it('Login mit falschem Passwort gibt 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: USERS.konfi1.username, password: 'falsch' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('Login mit nicht-existentem User gibt 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'gibtesnicht', password: 'egal' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('Login ohne Body gibt Validation Error', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect([400, 422]).toContain(res.status);
    });
  });

  // ================================================================
  // POST /api/auth/refresh
  // ================================================================
  describe('POST /api/auth/refresh', () => {
    it('Refresh mit gueltigem Token gibt neuen token + neuen refresh_token', async () => {
      // Zuerst Login um refresh_token zu bekommen
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: USERS.konfi1.username, password: PASSWORD });

      const oldRefreshToken = loginRes.body.refresh_token;

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refresh_token: oldRefreshToken });

      expect(res.status).toBe(200);
      expect(typeof res.body.token).toBe('string');
      expect(typeof res.body.refresh_token).toBe('string');
      // Neuer Refresh-Token muss anders sein (Rotation)
      expect(res.body.refresh_token).not.toBe(oldRefreshToken);
    });

    it('Refresh mit gerade rotiertem Token gibt 200 (Grace-Window gegen Race)', async () => {
      // Ein in den letzten 30s rotiertes Token wird bewusst akzeptiert, damit
      // parallele Requests (Dashboard + langsames Netz) nicht zum Logout fuehren.
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: USERS.konfi1.username, password: PASSWORD });

      const oldRefreshToken = loginRes.body.refresh_token;

      // Erster Refresh - rotiert den Token
      await request(app)
        .post('/api/auth/refresh')
        .send({ refresh_token: oldRefreshToken });

      // Zweiter Refresh mit dem gerade rotierten Token -> Grace-Window -> 200
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refresh_token: oldRefreshToken });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.refresh_token).toBeDefined();
    });

    it('Refresh ohne Token gibt 400', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(res.status).toBe(400);
    });

    it('Refresh mit ungueltigem Token gibt 401', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refresh_token: 'gibts-nicht-diesen-token' });

      expect(res.status).toBe(401);
    });
  });

  // ================================================================
  // POST /api/auth/logout
  // ================================================================
  describe('POST /api/auth/logout', () => {
    it('Logout revoked den refresh_token', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: USERS.konfi1.username, password: PASSWORD });

      const { token, refresh_token } = loginRes.body;

      // Logout ausfuehren
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({ refresh_token });

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.message).toBe('Logout erfolgreich');

      // Refresh mit dem revoked Token muss 401 geben
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refresh_token });

      expect(refreshRes.status).toBe(401);
    });

    it('Logout ohne refresh_token im Body gibt 200 (best-effort)', async () => {
      const token = generateToken('konfi1');

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logout erfolgreich');
    });

    it('Logout ohne Auth-Header gibt 401', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .send({});

      expect(res.status).toBe(401);
    });
  });

  // ================================================================
  // GET /api/auth/me
  // ================================================================
  describe('GET /api/auth/me', () => {
    it('Profil mit gueltigem Token gibt User-Daten', async () => {
      const token = generateToken('konfi1');

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(USERS.konfi1.id);
      expect(res.body.username).toBe(USERS.konfi1.username);
      expect(res.body.display_name).toBe(USERS.konfi1.display_name);
      expect(res.body.role_name).toBeDefined();
    });

    it('Profil ohne Token gibt 401', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
    });
  });

  // ================================================================
  // POST /api/auth/change-password
  // ================================================================
  describe('POST /api/auth/change-password', () => {
    it('Passwort aendern mit korrektem altem Passwort', async () => {
      const token = generateToken('konfi1');
      const neuesPasswort = 'NeuesPasswort123!';

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: PASSWORD, newPassword: neuesPasswort });

      expect(res.status).toBe(200);

      // Login mit neuem Passwort muss funktionieren
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: USERS.konfi1.username, password: 'NeuesPasswort123!' });

      expect(loginRes.status).toBe(200);
    });

    it('Passwort aendern mit falschem altem Passwort gibt 400', async () => {
      const token = generateToken('konfi1');

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'falsch', newPassword: 'NeuesPasswort123!' });

      expect(res.status).toBe(400);
    });

    it('Passwort zu kurz gibt 400', async () => {
      const token = generateToken('konfi1');

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: PASSWORD, newPassword: 'kurz' });

      expect(res.status).toBe(400);
    });
  });

  // ================================================================
  // POST /api/auth/register-konfi
  // ================================================================
  describe('POST /api/auth/register-konfi', () => {
    it('Registrierung mit gueltigem Invite-Code erstellt User', async () => {
      // 1. Invite-Code erstellen (als orgAdmin)
      const orgAdminToken = generateToken('orgAdmin1');
      const inviteRes = await request(app)
        .post('/api/auth/invite-code')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ jahrgang_id: JAHRGAENGE.jahrgang1.id });

      expect(inviteRes.status).toBe(200);
      const inviteCode = inviteRes.body.invite_code;
      expect(inviteCode).toBeDefined();

      // 2. Konfi registrieren
      const res = await request(app)
        .post('/api/auth/register-konfi')
        .send({
          invite_code: inviteCode,
          display_name: 'Neuer Konfi',
          username: 'neukonfi',
          password: 'TestPasswort123!',
        });

      expect(res.status).toBe(200);
      expect(typeof res.body.token).toBe('string');
      expect(res.body.user).toBeDefined();
      expect(res.body.user.type).toBe('konfi');
      expect(res.body.user.display_name).toBe('Neuer Konfi');
    });

    it('Registrierung mit ungueltigem Invite-Code gibt Fehler', async () => {
      const res = await request(app)
        .post('/api/auth/register-konfi')
        .send({
          invite_code: 'INVALID123',
          display_name: 'Test Konfi',
          username: 'testkonfi',
          password: 'TestPasswort123!',
        });

      expect([400, 404]).toContain(res.status);
    });
  });

  // ================================================================
  // POST /api/auth/register-konfi — Konfi-Limit (Weg 2, Hard-Block, Plan 02)
  // ================================================================
  describe('POST /api/auth/register-konfi — Konfi-Limit (Weg 2)', () => {
    // Org 1 hat im Seed 2 aktive Konfis. Invite-Code wird via API erzeugt.
    const setLimit = async (max) => {
      await db.query('UPDATE organizations SET max_konfis = $1 WHERE id = 1', [max]);
    };
    const addKonfis = async (n) => {
      for (let i = 0; i < n; i++) {
        await db.query(
          `INSERT INTO users (username, display_name, password_hash, role_id, organization_id, is_active)
           VALUES ($1, $2, 'x', 1, 1, true)`,
          [`fillkonfi${i}`, `Fill Konfi ${i}`]
        );
      }
    };
    const makeInvite = async () => {
      const orgAdminToken = generateToken('orgAdmin1');
      const inviteRes = await request(app)
        .post('/api/auth/invite-code')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ jahrgang_id: JAHRGAENGE.jahrgang1.id });
      return inviteRes.body.invite_code;
    };
    const countKonfis = async () => {
      const { rows } = await db.query(
        `SELECT COUNT(*)::int AS c FROM users u JOIN roles r ON u.role_id = r.id
         WHERE r.name = 'konfi' AND u.organization_id = 1 AND u.deleted_at IS NULL`
      );
      return rows[0].c;
    };

    it('Grace-Bereich -> Registrierung gelingt OHNE confirm (kein 409)', async () => {
      await setLimit(2); // 2 Konfis == Limit -> Grace
      const code = await makeInvite();
      const res = await request(app)
        .post('/api/auth/register-konfi')
        .send({ invite_code: code, display_name: 'Grace Konfi', username: 'gracekonfi', password: 'TestPasswort123!' });

      expect(res.status).toBe(200);
      expect(typeof res.body.token).toBe('string');
    });

    it('Hard-Block (count >= limit+5) -> 403 mit error_code limit_exceeded, kein neuer User', async () => {
      await setLimit(2);
      await addKonfis(5); // 2 + 5 = 7 >= 2+5
      const before = await countKonfis();
      const code = await makeInvite();
      const res = await request(app)
        .post('/api/auth/register-konfi')
        .send({ invite_code: code, display_name: 'Block Konfi', username: 'blockkonfi', password: 'TestPasswort123!' });

      expect(res.status).toBe(403);
      expect(res.body.error_code).toBe('limit_exceeded');
      const after = await countKonfis();
      expect(after).toBe(before); // kein neuer User
    });

    it('max_konfis NULL -> Registrierung normal erfolgreich', async () => {
      // Seed setzt max_konfis nicht -> NULL.
      const code = await makeInvite();
      const res = await request(app)
        .post('/api/auth/register-konfi')
        .send({ invite_code: code, display_name: 'Null Konfi', username: 'nullkonfi', password: 'TestPasswort123!' });

      expect(res.status).toBe(200);
    });
  });

  // ================================================================
  // POST /api/auth/delete-account (Self-Delete, D-01/D-02/D-03)
  // ================================================================
  describe('POST /api/auth/delete-account', () => {
    it('Konfi mit korrektem Passwort wird geloescht (200, danach nicht mehr in DB)', async () => {
      const token = generateToken('konfi1');

      const res = await request(app)
        .post('/api/auth/delete-account')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: PASSWORD });

      expect(res.status).toBe(200);

      const { rows } = await db.query('SELECT id FROM users WHERE id = $1', [USERS.konfi1.id]);
      expect(rows.length).toBe(0);
    });

    it('Falsches Passwort gibt 400 und loescht nicht', async () => {
      const token = generateToken('konfi1');

      const res = await request(app)
        .post('/api/auth/delete-account')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'falsch' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Aktuelles Passwort ist falsch');

      const { rows } = await db.query('SELECT id FROM users WHERE id = $1', [USERS.konfi1.id]);
      expect(rows.length).toBe(1);
    });

    it('Ohne password im Body gibt 400', async () => {
      const token = generateToken('konfi1');

      const res = await request(app)
        .post('/api/auth/delete-account')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);

      const { rows } = await db.query('SELECT id FROM users WHERE id = $1', [USERS.konfi1.id]);
      expect(rows.length).toBe(1);
    });

    it('Teamer kann sich selbst loeschen (rollen-unabhaengig, 200)', async () => {
      const token = generateToken('teamer1');

      const res = await request(app)
        .post('/api/auth/delete-account')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: PASSWORD });

      expect(res.status).toBe(200);

      const { rows } = await db.query('SELECT id FROM users WHERE id = $1', [USERS.teamer1.id]);
      expect(rows.length).toBe(0);
    });

    it('Admin kann sich selbst loeschen (rollen-unabhaengig, 200)', async () => {
      const token = generateToken('admin1');

      const res = await request(app)
        .post('/api/auth/delete-account')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: PASSWORD });

      expect(res.status).toBe(200);

      const { rows } = await db.query('SELECT id FROM users WHERE id = $1', [USERS.admin1.id]);
      expect(rows.length).toBe(0);
    });

    it('Loeschung kaskadiert (konfi_profiles + bonus_points des Konfis danach leer)', async () => {
      const token = generateToken('konfi1');

      const res = await request(app)
        .post('/api/auth/delete-account')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: PASSWORD });

      expect(res.status).toBe(200);

      const profile = await db.query('SELECT user_id FROM konfi_profiles WHERE user_id = $1', [USERS.konfi1.id]);
      expect(profile.rows.length).toBe(0);

      const bonus = await db.query('SELECT id FROM bonus_points WHERE konfi_id = $1', [USERS.konfi1.id]);
      expect(bonus.rows.length).toBe(0);
    });

    it('Ohne Auth-Header gibt 401', async () => {
      const res = await request(app)
        .post('/api/auth/delete-account')
        .send({ password: PASSWORD });

      expect(res.status).toBe(401);
    });
  });
});
