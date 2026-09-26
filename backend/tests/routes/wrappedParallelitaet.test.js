// backend/tests/routes/wrappedParallelitaet.test.js
//
// Konfi-Rueckblick fuer einen ganzen Jahrgang darf den Verbindungspool nicht
// fuellen (Audit 26.09.2026, Betrieb BF-06).
//
// BEFUND: POST /wrapped/generate/:jahrgangId startete fuer JEDEN Konfi
// gleichzeitig eine Kette mit eigenem Pool-Client (Promise.allSettled). Bei
// 58 Konfis und Pool 20 war der Pool die ganze Zeit voll (wartend 20); ein
// gleichzeitiger Dashboard-Aufruf brauchte 754 ms statt 17 ms.
//
// MESSPUNKT: pool.waitingCount, abgetastet waehrend des Laufs. Der Test-Pool
// hat 5 Plaetze; die Route belegt einen aeusseren Client plus WRAPPED_PARALLEL
// (3) Arbeiter -- vier von fuenf, niemand wartet. Mit unbegrenzter
// Parallelitaet stehen bei 50 Konfis rund 45 Ketten an.
//
// GEGENPROBE: begrenztParallel in wrapped.js wieder durch Promise.allSettled
// ersetzt -> "hoechstens ... wartend" faellt mit einer Spitze von ~46.
const request = require('supertest');
const bcrypt = require('bcrypt');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE, ORGS, ROLES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

const KONFIS_GESAMT = 50;

describe('Wrapped-Erzeugung mit begrenzter Parallelitaet', () => {
  let app;
  let db;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
    );
    require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);

    // Den Jahrgang auf 50 Konfis auffuellen (2 aus dem Seed + 48 neue).
    const hash = bcrypt.hashSync('x', 4);
    for (let i = 3; i <= KONFIS_GESAMT; i++) {
      const id = 1000 + i;
      await db.query(
        `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [id, `lastkonfi${i}`, hash, `Last Konfi ${i}`, ROLES.konfi.id, ORGS.testGemeinde.id]
      );
      await db.query(
        `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id, created_at)
         VALUES ($1, $2, 0, 0, $3, NOW() - INTERVAL '2 years')`,
        [id, JAHRGAENGE.jahrgang1.id, ORGS.testGemeinde.id]
      );
    }
  });

  afterAll(async () => {
    await closePool();
  });

  it('erzeugt alle 50 Snapshots, ohne dass jemand auf eine Pool-Verbindung wartet', async () => {
    let spitzeWartend = 0;
    let spitzeGesamt = 0;
    const abtaster = setInterval(() => {
      const z = db.poolZustand();
      spitzeWartend = Math.max(spitzeWartend, z.wartend);
      spitzeGesamt = Math.max(spitzeGesamt, z.gesamt);
    }, 1);

    let res;
    try {
      res = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${generateToken('admin1')}`)
        .send({});
    } finally {
      clearInterval(abtaster);
    }
    await warteAufNachwehen(app);

    expect(res.status).toBe(200);
    expect(res.body.generated).toBe(KONFIS_GESAMT);
    expect(res.body.errors).toBe(0);

    const { rows: [n] } = await db.query(
      `SELECT COUNT(*)::int AS anzahl FROM wrapped_snapshots
        WHERE wrapped_type = 'konfi' AND jahrgang_id = $1`,
      [JAHRGAENGE.jahrgang1.id]
    );
    expect(n.anzahl).toBe(KONFIS_GESAMT);

    // Der Messpunkt: Mit drei Arbeitern plus aeusserem Client bleiben vier
    // von fuenf Plaetzen belegt -- niemand steht an.
    expect(spitzeWartend).toBe(0);
    expect(spitzeGesamt).toBeLessThanOrEqual(db.poolZustand().max);
  }, 60000);
});
