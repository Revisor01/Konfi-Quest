// Ein Passwort-Reset durch die Leitung muss die fremde Sitzung beenden
// (Befund 14.09.2026).
//
// Die Selbstbedienungs-Route (PUT /auth/change-password) beschreibt die
// Bedrohung woertlich und handelt korrekt: "Wer sein Passwort aendert, weil
// jemand Zugriff hat, sperrte den Fremdzugriff damit NICHT aus." Sie setzt
// token_invalidated_at, widerruft die Refresh-Tokens und loescht die
// Push-Tokens.
//
// Die beiden LEITUNGS-Routen taten nichts davon:
//   PUT  /api/users/:id/reset-password        (users.js)
//   POST /api/admin/konfis/:id/regenerate-password  (konfi-management.js)
//
// Genau diese Routen sind aber der Weg, den jemand geht, wenn ein Konto
// uebernommen wurde und die Person selbst nicht mehr hineinkommt. Der
// Angreifer blieb drin: Access-Token bis zu 15 Minuten, Refresh-Token 90 Tage
// mit Rotation auf immer neue Access-Tokens. users.js trennte immerhin die
// Sockets — das beendet die Sitzung aber nicht, der naechste HTTP-Request
// ging durch.

const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS } = require('../helpers/seed');
const { generateToken, generateTokenMitAlter } = require('../helpers/auth');

describe('Passwort-Reset durch die Leitung beendet fremde Sitzungen', () => {
  let app;
  let db;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    const { invalidateUserCache } = require('../../middleware/rbac');
    Object.values(USERS).forEach(u => invalidateUserCache(u.id));
  });

  // Legt einen gueltigen Refresh-Token fuer eine Person an.
  async function refreshTokenAnlegen(userId) {
    const { rows: [row] } = await db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '90 days') RETURNING id`,
      [userId, 'hash-' + userId]
    );
    return row.id;
  }

  describe('PUT /api/users/:id/reset-password', () => {
    it('das alte Token der Zielperson gilt danach NICHT mehr', async () => {
      // Bestehende Sitzung der Zielperson, vor dem Reset ausgestellt.
      const altesToken = generateTokenMitAlter('konfi1', 60);

      // Gegenprobe: vorher kommt sie durch.
      const vorher = await request(app)
        .get('/api/konfi/profile')
        .set('Authorization', `Bearer ${altesToken}`);
      expect(vorher.status).toBe(200);

      const res = await request(app)
        .put(`/api/users/${USERS.konfi1.id}/reset-password`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`)
        .send({ password: 'NeuesPasswort123!' });
      expect(res.status).toBe(200);

      const { invalidateUserCache } = require('../../middleware/rbac');
      invalidateUserCache(USERS.konfi1.id);

      const nachher = await request(app)
        .get('/api/konfi/profile')
        .set('Authorization', `Bearer ${altesToken}`);
      expect(nachher.status).toBe(401);
    });

    it('setzt token_invalidated_at', async () => {
      await request(app)
        .put(`/api/users/${USERS.konfi1.id}/reset-password`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`)
        .send({ password: 'NeuesPasswort123!' });

      const { rows: [user] } = await db.query(
        'SELECT token_invalidated_at FROM users WHERE id = $1',
        [USERS.konfi1.id]
      );
      expect(user.token_invalidated_at).not.toBeNull();
    });

    it('widerruft die Refresh-Tokens — sonst holt sich der Angreifer neue', async () => {
      const tokenId = await refreshTokenAnlegen(USERS.konfi1.id);

      await request(app)
        .put(`/api/users/${USERS.konfi1.id}/reset-password`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`)
        .send({ password: 'NeuesPasswort123!' });

      const { rows: [rt] } = await db.query(
        'SELECT revoked_at FROM refresh_tokens WHERE id = $1',
        [tokenId]
      );
      expect(rt.revoked_at).not.toBeNull();
    });

    it('laesst die Sitzungen ANDERER Personen unberuehrt', async () => {
      const fremdesToken = generateTokenMitAlter('konfi3', 60);
      const fremderRefresh = await refreshTokenAnlegen(USERS.konfi3.id);

      await request(app)
        .put(`/api/users/${USERS.konfi1.id}/reset-password`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`)
        .send({ password: 'NeuesPasswort123!' });

      const { invalidateUserCache } = require('../../middleware/rbac');
      invalidateUserCache(USERS.konfi3.id);

      const res = await request(app)
        .get('/api/konfi/profile')
        .set('Authorization', `Bearer ${fremdesToken}`);
      expect(res.status).toBe(200);

      const { rows: [rt] } = await db.query(
        'SELECT revoked_at FROM refresh_tokens WHERE id = $1',
        [fremderRefresh]
      );
      expect(rt.revoked_at).toBeNull();
    });
  });

  describe('POST /api/admin/konfis/:id/regenerate-password', () => {
    it('das alte Token der Konfi gilt danach NICHT mehr', async () => {
      const altesToken = generateTokenMitAlter('konfi1', 60);

      const vorher = await request(app)
        .get('/api/konfi/profile')
        .set('Authorization', `Bearer ${altesToken}`);
      expect(vorher.status).toBe(200);

      const res = await request(app)
        .post(`/api/admin/konfis/${USERS.konfi1.id}/regenerate-password`)
        // orgAdmin1, nicht admin1: Letzterer hat im Seed keine
        // Jahrgangszuweisung und faellt korrekt an darfKonfi aus (403) —
        // das wuerde die Sitzungspruefung gar nicht erst erreichen.
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
      expect(res.status).toBe(200);

      const { invalidateUserCache } = require('../../middleware/rbac');
      invalidateUserCache(USERS.konfi1.id);

      const nachher = await request(app)
        .get('/api/konfi/profile')
        .set('Authorization', `Bearer ${altesToken}`);
      expect(nachher.status).toBe(401);
    });

    it('widerruft die Refresh-Tokens', async () => {
      const tokenId = await refreshTokenAnlegen(USERS.konfi1.id);

      await request(app)
        .post(`/api/admin/konfis/${USERS.konfi1.id}/regenerate-password`)
        // orgAdmin1, nicht admin1: Letzterer hat im Seed keine
        // Jahrgangszuweisung und faellt korrekt an darfKonfi aus (403) —
        // das wuerde die Sitzungspruefung gar nicht erst erreichen.
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);

      const { rows: [rt] } = await db.query(
        'SELECT revoked_at FROM refresh_tokens WHERE id = $1',
        [tokenId]
      );
      expect(rt.revoked_at).not.toBeNull();
    });

    it('das neue Passwort funktioniert weiterhin — der Reset bleibt brauchbar', async () => {
      const res = await request(app)
        .post(`/api/admin/konfis/${USERS.konfi1.id}/regenerate-password`)
        // orgAdmin1, nicht admin1: Letzterer hat im Seed keine
        // Jahrgangszuweisung und faellt korrekt an darfKonfi aus (403) —
        // das wuerde die Sitzungspruefung gar nicht erst erreichen.
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);

      expect(res.status).toBe(200);
      expect(typeof res.body.temporaryPassword).toBe('string');

      const login = await request(app)
        .post('/api/auth/login')
        .send({ username: USERS.konfi1.username, password: res.body.temporaryPassword });

      expect(login.status).toBe(200);
      expect(typeof login.body.token).toBe('string');
    });
  });
});
