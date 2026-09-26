// Deaktivierung und Loeschung wirken sofort, nicht erst nach 30 Sekunden
// (Audit 26.09.2026, Sicherheit BF-10, MITTEL).
//
// verifyTokenRBAC haelt das Benutzerobjekt 30 Sekunden im Cache. PUT
// /users/:id leerte ihn nur beim Rollenwechsel, DELETE /users/:id, DELETE
// /admin/konfis/:id und POST /auth/delete-account gar nicht. Wer deaktiviert
// oder geloescht wurde, arbeitete mit seiner laufenden Sitzung bis zu 30
// Sekunden weiter (reproduziert: PUT is_active=false, direkt danach GET mit
// der alten Sitzung -> 200 statt 401). Sockets wurden getrennt, HTTP nicht.
//
// Jede Aenderung an einem Konto und jede Loeschung leert jetzt den Cache
// dieser Person. Das wirkt auf der Replica, die den Aufruf bearbeitet; die
// uebrigen laufen weiterhin in den TTL (S-10, anderes Paket).
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, PASSWORD } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');

describe('Deaktivierung und Loeschung leeren den Rechte-Cache sofort', () => {
  let app;
  let db;
  let orgAdmin;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    Object.values(USERS).forEach(u => invalidateUserCache(u.id));
    orgAdmin = generateToken('orgAdmin1');
  });

  afterAll(async () => {
    await closePool();
  });

  const me = (token) => request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

  // Die Sitzung einmal benutzen, damit sie im Cache liegt -- genau der
  // Zustand, in dem der Befund auftrat.
  const sitzungAufwaermen = async (token) => {
    const res = await me(token);
    expect(res.status).toBe(200);
  };

  describe('verboten -- die alte Sitzung darf nicht weiterarbeiten', () => {
    it('PUT is_active=false: der naechste Aufruf mit der alten Sitzung ist 401', async () => {
      const teamer = generateToken('teamer1');
      await sitzungAufwaermen(teamer);

      const res = await request(app)
        .put(`/api/admin/users/${USERS.teamer1.id}`)
        .set('Authorization', `Bearer ${orgAdmin}`)
        .send({ is_active: false });
      expect(res.status).toBe(200);

      const danach = await me(teamer);
      expect(danach.status).toBe(401);
      expect(danach.body).toEqual({ error: 'User account is inactive' });
    });

    it('DELETE /admin/users/:id: die Sitzung der geloeschten Person ist sofort 401', async () => {
      const teamer = generateToken('teamer1');
      await sitzungAufwaermen(teamer);

      const res = await request(app)
        .delete(`/api/admin/users/${USERS.teamer1.id}`)
        .set('Authorization', `Bearer ${orgAdmin}`);
      expect(res.status).toBe(200);

      const danach = await me(teamer);
      expect(danach.status).toBe(401);
      expect(danach.body).toEqual({ error: 'User not found' });
    });

    it('DELETE /admin/konfis/:id: die Sitzung des geloeschten Konfis ist sofort 401', async () => {
      const konfi = generateToken('konfi1');
      await sitzungAufwaermen(konfi);

      const res = await request(app)
        .delete(`/api/admin/konfis/${USERS.konfi1.id}`)
        .set('Authorization', `Bearer ${orgAdmin}`);
      expect(res.status).toBe(200);

      const danach = await me(konfi);
      expect(danach.status).toBe(401);
      expect(danach.body).toEqual({ error: 'User not found' });
    });

    it('POST /auth/delete-account: das eigene Token gilt danach nicht mehr', async () => {
      const konfi = generateToken('konfi1');
      await sitzungAufwaermen(konfi);

      const res = await request(app)
        .post('/api/auth/delete-account')
        .set('Authorization', `Bearer ${konfi}`)
        .send({ password: PASSWORD });
      expect(res.status).toBe(200);

      const danach = await me(konfi);
      expect(danach.status).toBe(401);
      expect(danach.body).toEqual({ error: 'User not found' });
    });
  });

  describe('erlaubt -- aktive Konten arbeiten weiter', () => {
    it('eine Namensaenderung laesst die Sitzung bestehen', async () => {
      const teamer = generateToken('teamer1');
      await sitzungAufwaermen(teamer);

      const res = await request(app)
        .put(`/api/admin/users/${USERS.teamer1.id}`)
        .set('Authorization', `Bearer ${orgAdmin}`)
        .send({ display_name: 'Neuer Name' });
      expect(res.status).toBe(200);

      const danach = await me(teamer);
      expect(danach.status).toBe(200);
      expect(danach.body.display_name).toBe('Neuer Name');
    });

    it('is_active=true auf ein aktives Konto aendert an der Sitzung nichts', async () => {
      const teamer = generateToken('teamer1');
      await sitzungAufwaermen(teamer);

      const res = await request(app)
        .put(`/api/admin/users/${USERS.teamer1.id}`)
        .set('Authorization', `Bearer ${orgAdmin}`)
        .send({ is_active: true });
      expect(res.status).toBe(200);
      expect((await me(teamer)).status).toBe(200);
    });

    it('die Sitzung einer ANDEREN Person bleibt von Deaktivierung und Loeschung unberuehrt', async () => {
      const konfi = generateToken('konfi1');
      await sitzungAufwaermen(konfi);

      await request(app)
        .put(`/api/admin/users/${USERS.teamer1.id}`)
        .set('Authorization', `Bearer ${orgAdmin}`)
        .send({ is_active: false });
      await request(app)
        .delete(`/api/admin/konfis/${USERS.konfi2.id}`)
        .set('Authorization', `Bearer ${orgAdmin}`);

      expect((await me(konfi)).status).toBe(200);
    });
  });
});
