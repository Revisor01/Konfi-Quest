// Die Seite einer Teamer:in (Konfis -> Team -> Person) fragt Event-Punkte und
// Anwesenheit ab -- auch in der Store-App 2.3.0. Beide Routen suchten die
// Person nur unter den Konfis (darfKonfi -> konfi_profiles) und antworteten
// mit 404 „Konfi nicht gefunden": je Öffnen zwei 404 im Performance-Dashboard
// (Simon, 14.10.2026: „Routen die abgerufen aber nicht gefunden werden";
// gemessen: 27 Öffnungen, 54 x 404). Für eine Teamer:in der eigenen Gemeinde
// antworten sie jetzt 200 ohne Inhalt: Event-Punkte [] und Anwesenheit null --
// genau das, was die Apps bei der 404 schon zeigten (nichts). Wer eine
// Teamer:in sehen darf, entscheidet wie bei GET /admin/konfis/:id die
// Gemeinde (Stamm oder Einladung); Konfis bleiben an den Jahrgang gebunden.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Event-Punkte und Anwesenheit einer Teamer:in', () => {
  let app;
  let db;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    for (const u of Object.values(USERS)) require('../../middleware/rbac').invalidateUserCache(u.id);
  });

  afterAll(async () => {
    await closePool();
  });

  const hole = (wer, id, was) => request(app)
    .get(`/api/admin/konfis/${id}/${was}`)
    .set('Authorization', `Bearer ${generateToken(wer)}`);

  describe('ERLAUBT', () => {
    it('Org-Admin, Teamer:in der eigenen Gemeinde: Event-Punkte 200 []', async () => {
      const res = await hole('orgAdmin1', USERS.teamer1.id, 'event-points');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('Org-Admin, Teamer:in der eigenen Gemeinde: Anwesenheit 200 null', async () => {
      const res = await hole('orgAdmin1', USERS.teamer1.id, 'attendance-stats');
      expect(res.status).toBe(200);
      expect(res.body).toBe(null);
    });

    it('Admin ohne Jahrgang: Teamer:innen der Gemeinde wie beim Detail (Gemeinde genügt)', async () => {
      expect((await hole('admin1', USERS.teamer1.id, 'event-points')).status).toBe(200);
      expect((await hole('admin1', USERS.teamer1.id, 'attendance-stats')).status).toBe(200);
    });

    it('Teamer:in per Einladung in der Gemeinde (user_organizations): 200', async () => {
      await db.query(
        `INSERT INTO user_organizations (user_id, organization_id, role_id, is_active)
         VALUES ($1, 1, (SELECT id FROM roles WHERE organization_id = 1 AND name = 'teamer'), true)`,
        [USERS.teamer2.id]
      );
      const res = await hole('orgAdmin1', USERS.teamer2.id, 'event-points');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('Konfis unverändert: Event-Punkte als Liste, Anwesenheit als Objekt', async () => {
      const ep = await hole('orgAdmin1', USERS.konfi1.id, 'event-points');
      expect(ep.status).toBe(200);
      expect(Array.isArray(ep.body)).toBe(true);
      const an = await hole('orgAdmin1', USERS.konfi1.id, 'attendance-stats');
      expect(an.status).toBe(200);
      expect(typeof an.body.total_mandatory).toBe('number');
      expect(Array.isArray(an.body.missed_events)).toBe(true);
    });
  });

  describe('VERBOTEN', () => {
    it('Teamer:in einer anderen Gemeinde: weiter 404', async () => {
      expect((await hole('orgAdmin1', USERS.teamer2.id, 'event-points')).status).toBe(404);
      expect((await hole('orgAdmin1', USERS.teamer2.id, 'attendance-stats')).status).toBe(404);
    });

    it('Leitung (kein Teamer, keine Konfi): weiter 404', async () => {
      expect((await hole('orgAdmin1', USERS.admin1.id, 'event-points')).status).toBe(404);
      expect((await hole('orgAdmin1', USERS.admin1.id, 'attendance-stats')).status).toBe(404);
    });

    it('Konfi als Aufrufer: 403', async () => {
      expect((await hole('konfi1', USERS.teamer1.id, 'event-points')).status).toBe(403);
      expect((await hole('konfi1', USERS.teamer1.id, 'attendance-stats')).status).toBe(403);
    });

    it('Konfi ohne Zugriff auf den Jahrgang: weiter 403 (Admin ohne Zuweisung)', async () => {
      expect((await hole('admin1', USERS.konfi1.id, 'event-points')).status).toBe(403);
      expect((await hole('admin1', USERS.konfi1.id, 'attendance-stats')).status).toBe(403);
    });
  });
});
