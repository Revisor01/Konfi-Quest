// backend/tests/routes/usersDoppelMount.test.js
//
// routes/users.js haengt in createApp.js unter ZWEI Praefixen (:480 und :483):
//   /api/admin/users
//   /api/users
//
// Die Oberflaeche mischte beide fuer denselben Router. Seit 01.09.2026 ruft
// sie durchgaengig /users; /admin/users bleibt nur stehen, weil ausgelieferte
// Apps es rufen (docs/api/ABRISS.md, Abschnitt D).
//
// Diese Datei haelt fest, dass die Umstellung der Oberflaeche nichts
// verschiebt: Beide Praefixe liefern dieselbe Antwort und setzen dieselben
// Berechtigungen durch. Faellt einer der Mounts versehentlich weg oder driften
// die Guards auseinander, brechen hier Tests -- und nicht erst die Apps auf
// den Geraeten.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('users.js unter beiden Praefixen', () => {
  let app;
  let db;
  let adminToken;
  let teamerToken;
  let konfiToken;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    adminToken = generateToken('admin1');
    teamerToken = generateToken('teamer1');
    konfiToken = generateToken('konfi1');
  });

  afterAll(async () => {
    await closePool();
  });

  // Die Liste ist der Aufruf, den die Oberflaeche umgestellt hat
  // (MembersModal, AdminUsersPage).
  describe('GET /users und GET /admin/users', () => {
    it('liefern fuer die Leitung dieselbe Liste', async () => {
      const neu = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);
      const alt = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(neu.status).toBe(200);
      expect(alt.status).toBe(200);
      expect(Array.isArray(neu.body)).toBe(true);
      expect(neu.body).toEqual(alt.body);
    });

    it('schliessen Konfis serverseitig aus -- unter beiden Praefixen', async () => {
      const neu = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(neu.status).toBe(200);
      expect(neu.body.length).toBeGreaterThan(0);
      expect(neu.body.filter(u => u.role_name === 'konfi')).toEqual([]);
      expect(neu.body.filter(u => u.role_name === 'super_admin')).toEqual([]);
    });

    it('sperren Konfis unter beiden Praefixen mit 403', async () => {
      const neu = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${konfiToken}`);
      const alt = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(neu.status).toBe(403);
      expect(alt.status).toBe(403);
    });

    it('sperren Teamer unter beiden Praefixen mit 403', async () => {
      const neu = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${teamerToken}`);
      const alt = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(neu.status).toBe(403);
      expect(alt.status).toBe(403);
    });
  });

  // Der zweite umgestellte Aufruf (MembersModal, SimpleCreateChatModal).
  // Anders als die Liste steht er ALLEN angemeldeten Rollen offen -- er
  // liefert die eigenen Jahrgaenge, nicht fremde Daten.
  describe('GET /users/me/jahrgaenge und GET /admin/users/me/jahrgaenge', () => {
    it('liefern fuer die Leitung dieselbe Antwort', async () => {
      const neu = await request(app)
        .get('/api/users/me/jahrgaenge')
        .set('Authorization', `Bearer ${adminToken}`);
      const alt = await request(app)
        .get('/api/admin/users/me/jahrgaenge')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(neu.status).toBe(200);
      expect(alt.status).toBe(200);
      expect(Array.isArray(neu.body)).toBe(true);
      expect(neu.body).toEqual(alt.body);
    });

    it('liefern fuer Teamer dieselbe Antwort', async () => {
      const neu = await request(app)
        .get('/api/users/me/jahrgaenge')
        .set('Authorization', `Bearer ${teamerToken}`);
      const alt = await request(app)
        .get('/api/admin/users/me/jahrgaenge')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(neu.status).toBe(200);
      expect(alt.status).toBe(200);
      expect(neu.body).toEqual(alt.body);
    });

    it('ohne Anmeldung: beide 401', async () => {
      const neu = await request(app).get('/api/users/me/jahrgaenge');
      const alt = await request(app).get('/api/admin/users/me/jahrgaenge');

      expect(neu.status).toBe(401);
      expect(alt.status).toBe(401);
    });
  });
});
