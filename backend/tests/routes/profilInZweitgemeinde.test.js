// Das Profil in der Zweitgemeinde
//
// SIMONS FRAGE (26.09.2026): "Das Problem ist dann das Profil? Oder? Welche
// Infos holt er da?"
//
// Beide Profil-Ansichten laden GET /auth/me (die Rolle -- seit heute die der
// aktiven Gemeinde) und dazu rollenspezifische Daten. Zwei davon lasen die
// STAMM-Gemeinde, nicht die aktive:
//
//   teamer.js: SELECT ... o.name FROM users u
//              LEFT JOIN organizations o ON u.organization_id = o.id
//     -> zeigte in der Zweitgemeinde den Namen der Stamm-Gemeinde.
//
//   wrapped.js /history/:userId:
//     if (targetUser.organization_id !== req.user.organization_id) -> 403
//     -> eine Leitung sah die Rueckblick-Historie einer Person nicht, die
//        ueber user_organizations in ihrer Gemeinde arbeitet.
//
// Dasselbe Muster wie bei den Push-Empfaengern (utils/orgMitglieder.js) und
// der Jahrgangs-Zuweisung: users.organization_id ist nur die Stamm-Gemeinde.

const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ROLES } = require('../helpers/seed');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-vitest';

const GAST_TEAMER = 251; // Stamm-Gemeinde Org 1, Teamer:in auch in Org 2

function tokenFuer(id, roleId, orgId, type = 'admin') {
  return jwt.sign(
    { id, type, display_name: `User ${id}`, organization_id: orgId, role_id: roleId },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('Profil in der Zweitgemeinde', () => {
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

    await db.query(
      `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
       VALUES ($1, 'gast-profil', 'x', 'Gast Profil', $2, 1, true)`,
      [GAST_TEAMER, ROLES.teamer.id]
    );
    await db.query(
      `INSERT INTO user_organizations (user_id, organization_id, role_id)
       VALUES ($1, 1, $2), ($1, 2, $3)`,
      [GAST_TEAMER, ROLES.teamer.id, ROLES.teamer2.id]
    );
  });

  const mitOrg = (req, orgId) => (orgId ? req.set('X-Active-Organization', String(orgId)) : req);

  it('nennt im Teamer-Profil die AKTIVE Gemeinde, nicht die Stamm-Gemeinde', async () => {
    const token = tokenFuer(GAST_TEAMER, ROLES.teamer.id, 1, 'teamer');

    const daheim = await mitOrg(
      request(app).get('/api/teamer/profile').set('Authorization', `Bearer ${token}`), 1
    );
    expect(daheim.status).toBe(200);
    expect(daheim.body.user.organization_name).toBe('Test-Gemeinde');

    const zweit = await mitOrg(
      request(app).get('/api/teamer/profile').set('Authorization', `Bearer ${token}`), 2
    );
    expect(zweit.status).toBe(200);
    expect(zweit.body.user.organization_name).toBe('Andere Gemeinde');
  });

  it('die Leitung sieht die Rueckblick-Historie einer Person aus user_organizations', async () => {
    // orgAdmin2 leitet Org 2. GAST_TEAMER arbeitet dort ueber
    // user_organizations -- die Historie muss einsehbar sein.
    const res = await mitOrg(
      request(app)
        .get(`/api/wrapped/history/${GAST_TEAMER}`)
        .set('Authorization', `Bearer ${tokenFuer(USERS.orgAdmin2.id, ROLES.orgAdmin2.id, 2)}`),
      2
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('zeigt nur die Rueckblicke DIESER Gemeinde', async () => {
    // SIMONS REGEL (26.09.2026): "Profil nur den Rückblick der aktuellen
    // Gemeinde." Die Abfrage filterte bis dahin allein auf user_id -- wer in
    // zwei Gemeinden einen Rueckblick hat, sah im Profil beide untereinander,
    // ohne Hinweis, welcher woher stammt.
    const ausgabe = async (orgId, jahr, titel) => {
      const { rows: [a] } = await db.query(
        `INSERT INTO wrapped_ausgaben
           (organization_id, wrapped_type, jahrgang_id, titel,
            zeitraum_start, zeitraum_ende, freigegeben_at, freigegeben_von, erstellt_von)
         VALUES ($1, 'teamer', NULL, $2, $3::date, $4::date, NOW(), $5, $5)
         RETURNING id`,
        [orgId, titel, `${jahr}-01-01`, `${jahr}-12-31`, USERS.orgAdmin1.id]
      );
      await db.query(
        `INSERT INTO wrapped_snapshots
           (user_id, organization_id, wrapped_type, year, ausgabe_id, data, computed_at)
         VALUES ($1, $2, 'teamer', $3, $4, '{}'::jsonb, NOW())`,
        [GAST_TEAMER, orgId, jahr, a.id]
      );
    };
    await ausgabe(1, 2024, 'Rückblick Stamm-Gemeinde');
    await ausgabe(2, 2025, 'Rückblick Zweitgemeinde');

    const inOrg2 = await mitOrg(
      request(app)
        .get(`/api/wrapped/history/${GAST_TEAMER}`)
        .set('Authorization', `Bearer ${tokenFuer(GAST_TEAMER, ROLES.teamer.id, 1, 'teamer')}`),
      2
    );
    expect(inOrg2.status).toBe(200);
    expect(inOrg2.body.map((r) => r.titel)).toEqual(['Rückblick Zweitgemeinde']);

    const inOrg1 = await mitOrg(
      request(app)
        .get(`/api/wrapped/history/${GAST_TEAMER}`)
        .set('Authorization', `Bearer ${tokenFuer(GAST_TEAMER, ROLES.teamer.id, 1, 'teamer')}`),
      1
    );
    expect(inOrg1.body.map((r) => r.titel)).toEqual(['Rückblick Stamm-Gemeinde']);
  });

  it('eine fremde Person bleibt auch dann gesperrt (der verbotene Fall)', async () => {
    // teamer1 arbeitet NUR in Org 1 -- fuer die Leitung von Org 2 unsichtbar.
    const res = await mitOrg(
      request(app)
        .get(`/api/wrapped/history/${USERS.teamer1.id}`)
        .set('Authorization', `Bearer ${tokenFuer(USERS.orgAdmin2.id, ROLES.orgAdmin2.id, 2)}`),
      2
    );
    expect(res.status).toBe(403);
  });

  it('die eigene Historie bleibt ohne Leitungsrolle abrufbar', async () => {
    const res = await mitOrg(
      request(app)
        .get(`/api/wrapped/history/${GAST_TEAMER}`)
        .set('Authorization', `Bearer ${tokenFuer(GAST_TEAMER, ROLES.teamer.id, 1, 'teamer')}`),
      2
    );
    expect(res.status).toBe(200);
  });
});
