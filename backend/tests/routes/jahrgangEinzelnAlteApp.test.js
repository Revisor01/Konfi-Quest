// GET /api/admin/jahrgaenge/:id -- fuer ausgelieferte Apps 2.2.x.
//
// Bei der Suche nach Aufrufen, die mit 404 enden (Simon, 14.10.2026:
// „Außerdem gibt es Routen die abgerufen aber nicht gefunden werden"), fiel
// auf: Die App 2.2.x ruft nach „Konfi anlegen" GET /admin/jahrgaenge/<id>,
// um den Namen des Jahrgangs fuer den Jahrgangs-Chat zu holen
// (AdminKonfisPage, createOrJoinJahrgangChat). Diese Route gab es nie --
// jede so angelegte Konfi ergab eine 404, der Jahrgangs-Chat wurde von dieser
// App nicht angelegt. Ab 2.3.0 ruft die App sie nicht mehr; eine Mindestversion
// ist nicht gesetzt (GET /api/app-version: min_version null), also laufen
// 2.2.x-Apps weiter. Die Route liefert eine Zeile wie die Liste und nach
// derselben Regel: Org-Admin jeden Jahrgang der Gemeinde, Admin und
// Teamer:in nur zugewiesene (can_view).
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('GET /api/admin/jahrgaenge/:id (Apps 2.2.x)', () => {
  let app;
  let db;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    // Die Rechte haengen im Cache der Middleware -- ohne Leeren saehe admin1
    // die Zuweisung aus dem vorigen Fall noch.
    for (const u of [USERS.admin1, USERS.teamer1, USERS.orgAdmin1, USERS.konfi1]) {
      require('../../middleware/rbac').invalidateUserCache(u.id);
    }
  });

  afterAll(async () => {
    await closePool();
  });

  const hole = (wer, id) => request(app)
    .get(`/api/admin/jahrgaenge/${id}`)
    .set('Authorization', `Bearer ${generateToken(wer)}`);

  const weiseZu = async (user, canView) => {
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, $3, false)',
      [user.id, JAHRGAENGE.jahrgang1.id, canView]
    );
    require('../../middleware/rbac').invalidateUserCache(user.id);
  };

  describe('ERLAUBT', () => {
    it('Org-Admin: der Jahrgang der eigenen Gemeinde, dieselbe Zeile wie in der Liste', async () => {
      const res = await hole('orgAdmin1', JAHRGAENGE.jahrgang1.id);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(JAHRGAENGE.jahrgang1.id);
      expect(res.body.name).toBe(JAHRGAENGE.jahrgang1.name);
      const liste = await request(app).get('/api/admin/jahrgaenge').set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
      expect(liste.status).toBe(200);
      expect(res.body).toEqual(liste.body.find((j) => j.id === JAHRGAENGE.jahrgang1.id));
    });

    it('Admin mit Zuweisung (can_view)', async () => {
      await weiseZu(USERS.admin1, true);
      const res = await hole('admin1', JAHRGAENGE.jahrgang1.id);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe(JAHRGAENGE.jahrgang1.name);
    });

    it('Teamer:in mit Zuweisung (Seed: teamer1 -> jahrgang1)', async () => {
      const res = await hole('teamer1', JAHRGAENGE.jahrgang1.id);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe(JAHRGAENGE.jahrgang1.name);
    });
  });

  describe('VERBOTEN', () => {
    it('Admin ohne Zuweisung: 403, kein Name', async () => {
      const res = await hole('admin1', JAHRGAENGE.jahrgang1.id);
      expect(res.status).toBe(403);
      expect(res.body.name).toBeUndefined();
    });

    it('Admin mit Zuweisung ohne can_view: 403', async () => {
      await weiseZu(USERS.admin1, false);
      const res = await hole('admin1', JAHRGAENGE.jahrgang1.id);
      expect(res.status).toBe(403);
      expect(res.body.name).toBeUndefined();
    });

    it('Konfi: 403', async () => {
      const res = await hole('konfi1', JAHRGAENGE.jahrgang1.id);
      expect(res.status).toBe(403);
      expect(res.body.name).toBeUndefined();
    });

    it('Org-Admin, Jahrgang einer anderen Gemeinde: 404, kein Name', async () => {
      const res = await hole('orgAdmin1', JAHRGAENGE.jahrgang2.id);
      expect(res.status).toBe(404);
      expect(res.body.name).toBeUndefined();
    });

    it('unbekannte Nummer: 404; keine Zahl: 400', async () => {
      expect((await hole('orgAdmin1', 999999)).status).toBe(404);
      expect((await hole('orgAdmin1', 'abc')).status).toBe(400);
    });
  });
});
