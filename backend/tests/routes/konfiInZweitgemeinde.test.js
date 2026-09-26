// Konfi-Ansicht fuer eine Person, die das nur in EINER ihrer Gemeinden ist
//
// SIMONS BEFUND AM GERAET (26.09.2026): "Konfi Dashboard kann in Testgemeinde
// nicht geladen werden. Und keine Badges werden angezeigt als Konfi."
//
// Sein Konto ist in der Stamm-Gemeinde org_admin und in der Testgemeinde
// ueber user_organizations Konfi. Die Konfi-Routen pruefen aber die Rolle am
// KONTO:
//   konfi.js:100  WHERE u.id = $1 AND r.name = 'konfi'   (Dashboard)
//   konfi.js:428  dieselbe Zeile im Profil
//   konfi.js:473  dieselbe Zeile in der Badge-Liste des Profils
// `r` kommt jeweils aus `JOIN roles r ON u.role_id = r.id`. Fuer sein Konto
// ergibt das 'org_admin' -> kein Treffer -> 404 beim Dashboard und eine leere
// Abzeichen-Liste.
//
// Dasselbe Muster wie ueberall heute: users.role_id gilt fuer die
// Stamm-Gemeinde, die Rolle DIESER Gemeinde steht in user_organizations.
// rbacVerifier loest sie laengst auf (req.user.role_name) -- die Abfragen
// lasen das Ergebnis nur nicht.
//
// NICHT betroffen und bewusst unveraendert: die Jahrgangslisten
// (konfi.js:144/160/530). Sie zaehlen die Konfis EINES Jahrgangs; dort ist
// die Rolle am Konto die richtige Quelle, weil ein Jahrgang zu genau einer
// Gemeinde gehoert.

const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE, ROLES } = require('../helpers/seed');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-vitest';

// Am Konto org_admin in Org 1, ueber user_organizations Konfi in Org 2.
const DOPPEL = 261;

function tokenFuer(id, roleId, orgId, type) {
  return jwt.sign(
    { id, type, display_name: `User ${id}`, organization_id: orgId, role_id: roleId },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('Konfi-Ansicht in der Zweitgemeinde', () => {
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
       VALUES ($1, 'doppel-konfi', 'x', 'Doppel Konfi', $2, 1, true)`,
      [DOPPEL, ROLES.orgAdmin.id]
    );
    await db.query(
      `INSERT INTO user_organizations (user_id, organization_id, role_id)
       VALUES ($1, 1, $2), ($1, 2, $3)`,
      [DOPPEL, ROLES.orgAdmin.id, ROLES.konfi2.id]
    );
    // Konfi-Profil in Org 2 -- jahrgang2 gehoert dorthin.
    await db.query(
      `INSERT INTO konfi_profiles (user_id, organization_id, jahrgang_id, gottesdienst_points, gemeinde_points)
       VALUES ($1, 2, $2, 5, 15)`,
      [DOPPEL, JAHRGAENGE.jahrgang2.id]
    );
  });

  const alsKonfiInOrg2 = (pfad) =>
    request(app)
      .get(pfad)
      .set('Authorization', `Bearer ${tokenFuer(DOPPEL, ROLES.orgAdmin.id, 1, 'konfi')}`)
      .set('X-Active-Organization', '2');

  it('laedt das Konfi-Dashboard in der Gemeinde, in der die Person Konfi ist', async () => {
    const res = await alsKonfiInOrg2('/api/konfi/dashboard');
    expect(res.status).toBe(200);
    // Harte Zahlen statt toBeDefined: Das Profil traegt 5 + 15.
    // Die Werte stehen unter `konfi` (Antwortform der Route, unveraendert).
    expect(res.body.konfi.gottesdienst_points).toBe(5);
    expect(res.body.konfi.gemeinde_points).toBe(15);
  });

  it('liefert das Konfi-Profil mit den Punkten dieser Gemeinde', async () => {
    const res = await alsKonfiInOrg2('/api/konfi/profile');
    expect(res.status).toBe(200);
    expect(res.body.gottesdienst_points).toBe(5);
    expect(res.body.gemeinde_points).toBe(15);
    expect(res.body.total_points).toBe(20);
  });

  it('zaehlt verliehene Abzeichen DIESER Gemeinde mit', async () => {
    const { rows: [badge] } = await db.query(
      `INSERT INTO custom_badges
         (organization_id, name, description, icon, criteria_type, criteria_value, is_active)
       VALUES (2, 'Erster Schritt', 'Die ersten Punkte', 'trophy', 'total_points', 1, true)
       RETURNING id`
    );
    await db.query(
      `INSERT INTO user_badges (user_id, badge_id, organization_id, awarded_date)
       VALUES ($1, $2, 2, NOW())`,
      [DOPPEL, badge.id]
    );

    // Die Abzeichen selbst kommen ueber /konfi/badges/v2; das Profil traegt
    // nur ihre Zahl.
    const profil = await alsKonfiInOrg2('/api/konfi/profile');
    expect(profil.status).toBe(200);
    expect(profil.body.badge_count).toBe(1);

    const liste = await alsKonfiInOrg2('/api/konfi/badges/v2');
    expect(liste.status).toBe(200);
    const alle = [...(liste.body.available || []), ...(liste.body.earned || [])];
    expect(alle.map((b) => b.name)).toContain('Erster Schritt');
  });

  it('bleibt in der Gemeinde ohne Konfi-Rolle verschlossen (der verbotene Fall)', async () => {
    // In Org 1 ist die Person org_admin, kein Konfi -- dort gibt es kein
    // Konfi-Dashboard. Die Route weist das VOR der Abfrage ab
    // (`req.user.type !== 'konfi'` -> 403); req.user.type leitet rbacVerifier
    // aus der Rolle DIESER Gemeinde ab. Genau deshalb konnte die
    // SQL-Bedingung `r.name = 'konfi'` entfallen: Sie prüfte dasselbe noch
    // einmal, nur an der falschen Quelle (der Rolle am Konto).
    const res = await request(app)
      .get('/api/konfi/dashboard')
      .set('Authorization', `Bearer ${tokenFuer(DOPPEL, ROLES.orgAdmin.id, 1, 'admin')}`)
      .set('X-Active-Organization', '1');
    expect(res.status).toBe(403);
  });

  it('eine gewoehnliche Konfi bleibt unveraendert erreichbar', async () => {
    // Gegenprobe: Der Normalfall (Rolle am Konto = Rolle der Gemeinde) darf
    // durch die Umstellung nicht kaputtgehen.
    const res = await request(app)
      .get('/api/konfi/dashboard')
      .set('Authorization', `Bearer ${tokenFuer(USERS.konfi1.id, ROLES.konfi.id, 1, 'konfi')}`);
    expect(res.status).toBe(200);
  });
});
