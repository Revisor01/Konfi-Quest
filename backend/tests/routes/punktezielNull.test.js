// Punkteziel 0: die Schnittstelle nimmt nur, was die App darstellen kann
// (Audit 26.09.2026, Fachlogik Punkte/Termine BF-10).
//
// Die Validierung liess target_gottesdienst/target_gemeinde = 0 zu, das
// Dashboard der Konfi lieferte daraus aber `target || 10` -- in point_config
// eine 10, im selben Objekt unter konfi die 0. Nachgesehen, was die
// ausgelieferten Apps tun: Der Regler der Leitung reicht in 2.0.0, 2.2.0 und
// 2.3.0 von 1 bis 20, eine 0 schickt keine App; und alle drei Stellen, die das
// Ziel anzeigen (Dashboard der Konfi, Konfi-Liste und Detail der Leitung),
// rechnen selbst `|| 10`. Eine 0 kam also nur ueber die Schnittstelle hinein
// und hiess in jeder App-Fassung 10. Die Schnittstelle lehnt sie deshalb ab
// (400), wie der Regler; gespeicherte Werte ab 1 kommen unveraendert an.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');

describe('Punkteziel: 0 wird abgelehnt, 1 bis 20 kommen an', () => {
  let app;
  let db;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    Object.values(USERS).forEach(u => invalidateUserCache(u.id));
  });

  afterAll(async () => {
    await closePool();
  });

  const leitung = () => `Bearer ${generateToken('orgAdmin1')}`;

  describe('verboten', () => {
    it('Anlegen mit Ziel 0: 400, kein Jahrgang', async () => {
      for (const feld of ['target_gottesdienst', 'target_gemeinde']) {
        const res = await request(app)
          .post('/api/admin/jahrgaenge')
          .set('Authorization', leitung())
          .send({ name: `Ziel-null-${feld}`, [feld]: 0 });

        expect(res.status).toBe(400);
        const { rowCount } = await db.query('SELECT 1 FROM jahrgaenge WHERE name = $1', [`Ziel-null-${feld}`]);
        expect(rowCount).toBe(0);
      }
    });

    it('Bearbeiten auf Ziel 0: 400, der alte Wert bleibt', async () => {
      await db.query('UPDATE jahrgaenge SET target_gottesdienst = 8 WHERE id = $1', [JAHRGAENGE.jahrgang1.id]);

      const res = await request(app)
        .put(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', leitung())
        .send({ name: JAHRGAENGE.jahrgang1.name, target_gottesdienst: 0 });

      expect(res.status).toBe(400);
      const { rows: [j] } = await db.query('SELECT target_gottesdienst FROM jahrgaenge WHERE id = $1', [JAHRGAENGE.jahrgang1.id]);
      expect(j.target_gottesdienst).toBe(8);
    });
  });

  describe('erlaubt', () => {
    it('Anlegen mit Ziel 1: gespeichert wie gesendet', async () => {
      const res = await request(app)
        .post('/api/admin/jahrgaenge')
        .set('Authorization', leitung())
        .send({ name: 'Ziel-eins', target_gottesdienst: 1, target_gemeinde: 20 });

      expect(res.status).toBe(201);
      const { rows: [j] } = await db.query('SELECT target_gottesdienst, target_gemeinde FROM jahrgaenge WHERE id = $1', [res.body.id]);
      expect(j).toEqual({ target_gottesdienst: 1, target_gemeinde: 20 });
    });

    it('Bearbeiten auf Ziel 3: das Dashboard der Konfi rechnet mit 3', async () => {
      const put = await request(app)
        .put(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', leitung())
        .send({ name: JAHRGAENGE.jahrgang1.name, target_gottesdienst: 3, target_gemeinde: 4 });
      expect(put.status).toBe(200);

      const dash = await request(app)
        .get('/api/konfi/dashboard')
        .set('Authorization', `Bearer ${generateToken('konfi1')}`);

      expect(dash.status).toBe(200);
      expect(dash.body.point_config.target_gottesdienst).toBe(3);
      expect(dash.body.point_config.target_gemeinde).toBe(4);
    });
  });
});
