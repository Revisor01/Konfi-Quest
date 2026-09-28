// backend/tests/routes/teamerDashboardRueckblick.test.js
//
// Der Rueckblick-Hinweis auf der Teamer-Startseite laesst sich PRO AUSGABE
// wegklicken (28.09.2026, Screens Konfi/Teamer BF-07).
//
// Die App baut den Merker aus `wrapped_ausgabe_id`
// (`wrapped_hinweis_t_<user>_<ausgabe>`) -- seit dem 04.09.2026, auch in den
// Store-Apps 2.2.x/2.3.0. GET /teamer/dashboard lieferte das Feld aber nie:
// Der Schluessel endete immer auf `_alt`. Wer den Hinweis 2026 wegklickte,
// sah den Team-Rueckblick 2027 (Cron am 6. Januar) auf der Startseite nie.
//
// Jetzt additiv `wrapped_ausgabe_id` und `wrapped_titel`, wie im
// Konfi-Dashboard (konfi.js) -- und zwar die Ausgabe, die GET /wrapped/me
// oeffnet: der zuletzt freigegebene Rueckblick der AKTIVEN Gemeinde.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');

describe('GET /teamer/dashboard: Rueckblick je Ausgabe (BF-07)', () => {
  let app;
  let db;
  let teamerToken;

  beforeAll(() => {
    db = getTestPool();
    app = getTestApp(db);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    for (const u of Object.values(USERS)) invalidateUserCache(u.id);
    teamerToken = generateToken('teamer1');
  });

  async function ausgabeAnlegen({ titel, jahr, orgId = ORGS.testGemeinde.id, freigegebenVorTagen = 0 }) {
    const { rows: [row] } = await db.query(
      `INSERT INTO wrapped_ausgaben
         (organization_id, wrapped_type, jahrgang_id, titel, zeitraum_start, zeitraum_ende,
          freigegeben_at, erstellt_von)
       VALUES ($1, 'teamer', NULL, $2, make_date($3, 1, 1), make_date($3, 12, 31),
               NOW() - make_interval(days => $4), $5)
       RETURNING id`,
      [orgId, titel, jahr, freigegebenVorTagen, USERS.orgAdmin1.id]
    );
    return row.id;
  }

  async function snapshotAnlegen({ jahr, ausgabeId = null, orgId = ORGS.testGemeinde.id }) {
    await db.query(
      `INSERT INTO wrapped_snapshots (user_id, organization_id, wrapped_type, jahrgang_id, year, data, computed_at, ausgabe_id)
       VALUES ($1, $2, 'teamer', NULL, $3, '{}'::jsonb, NOW(), $4)`,
      [USERS.teamer1.id, orgId, jahr, ausgabeId]
    );
  }

  async function dashboard() {
    const res = await request(app)
      .get('/api/teamer/dashboard')
      .set('Authorization', `Bearer ${teamerToken}`);
    expect(res.status).toBe(200);
    return res.body;
  }

  it('nennt Id und Titel der Ausgabe', async () => {
    const ausgabeId = await ausgabeAnlegen({ titel: 'Team-Rückblick 2026', jahr: 2026 });
    await snapshotAnlegen({ jahr: 2026, ausgabeId });

    const body = await dashboard();
    expect(body.has_wrapped).toBe(true);
    expect(body.wrapped_ausgabe_id).toBe(ausgabeId);
    expect(body.wrapped_titel).toBe('Team-Rückblick 2026');
  });

  it('der naechste Rueckblick bringt eine neue Id -- der Hinweis meldet sich wieder', async () => {
    const alt = await ausgabeAnlegen({ titel: 'Team-Rückblick 2026', jahr: 2026, freigegebenVorTagen: 365 });
    await snapshotAnlegen({ jahr: 2026, ausgabeId: alt });
    const neu = await ausgabeAnlegen({ titel: 'Team-Rückblick 2027', jahr: 2027 });
    await snapshotAnlegen({ jahr: 2027, ausgabeId: neu });

    const body = await dashboard();
    expect(body.wrapped_ausgabe_id).toBe(neu);
    expect(body.wrapped_titel).toBe('Team-Rückblick 2027');
  });

  it('nur die aktive Gemeinde: ein Rueckblick aus einer anderen Gemeinde zaehlt nicht', async () => {
    const fremd = await ausgabeAnlegen({ titel: 'Team-Rückblick 2026', jahr: 2026, orgId: ORGS.andereGemeinde.id });
    await snapshotAnlegen({ jahr: 2026, ausgabeId: fremd, orgId: ORGS.andereGemeinde.id });

    const body = await dashboard();
    expect(body.has_wrapped).toBe(false);
    expect(body.wrapped_ausgabe_id).toBeNull();
    expect(body.wrapped_titel).toBeNull();
  });

  it('Alt-Snapshots ohne Ausgabe liefern null statt einer erfundenen Id', async () => {
    await snapshotAnlegen({ jahr: 2025 });

    const body = await dashboard();
    expect(body.has_wrapped).toBe(true);
    expect(body.wrapped_ausgabe_id).toBeNull();
    expect(body.wrapped_titel).toBeNull();
  });

  it('ohne Rueckblick bleiben beide Felder leer', async () => {
    const body = await dashboard();
    expect(body.has_wrapped).toBe(false);
    expect(body.wrapped_ausgabe_id).toBeNull();
    expect(body.wrapped_titel).toBeNull();
  });

  it('die bisherigen Felder bleiben alle da (Vertrag mit den Store-Apps)', async () => {
    const body = await dashboard();
    expect(Object.keys(body).sort()).toEqual([
      'badges', 'certificates', 'config', 'events', 'greeting', 'has_wrapped',
      'konfspruch', 'wrapped_ausgabe_id', 'wrapped_titel',
    ]);
    expect(Array.isArray(body.certificates)).toBe(true);
    expect(Array.isArray(body.events)).toBe(true);
    expect(typeof body.has_wrapped).toBe('boolean');
  });
});
