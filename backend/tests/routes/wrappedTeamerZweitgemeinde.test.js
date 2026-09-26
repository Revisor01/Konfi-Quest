// Team-Rueckblick fuer Teamer:innen, die in mehreren Gemeinden arbeiten
// (POST /api/wrapped/generate-teamer)
//
// BEFUND (26.09.2026): Die Empfaengerliste las allein die Stamm-Gemeinde:
//   WHERE r.name = 'teamer' AND u.organization_id = $1
// Wer ueber user_organizations in einer zweiten Gemeinde arbeitet, bekam dort
// keinen Rueckblick -- obwohl die Zahlen darin laengst je Gemeinde gerechnet
// werden (generateTeamerSnapshot nimmt orgId und filtert durchgehend danach).
// Es fehlte also nur die Empfaengerliste, nicht die Auswertung.
//
// DASSELBE MUSTER wie bei den Push-Empfaengern (25.09.2026) und bei der
// Jahrgangs-Zuweisung (26.09.2026): users.organization_id ist nur die
// Stamm-Gemeinde, die Zugehoerigkeit steht in user_organizations.
//
// DIE ROLLE GILT JE GEMEINDE: Wer in der Zweitgemeinde org_admin ist und in
// der Stamm-Gemeinde Teamer:in, gehoert dort NICHT in den Team-Rueckblick.

const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ROLES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

// IDs oberhalb des Seed-Bereichs
const GAST = 231;       // Stamm-Gemeinde Org 1, Teamer:in auch in Org 2
const GAST_CHEF = 232;  // Stamm-Gemeinde Org 1, in Org 2 org_admin

describe('POST /generate-teamer — Teamer:innen aus user_organizations', () => {
  let app;
  let db;
  let orgAdmin2Token;

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
    orgAdmin2Token = generateToken('orgAdmin2');

    // Teamer:in mit Stamm-Gemeinde Org 1, die zusaetzlich in Org 2 arbeitet.
    await db.query(
      `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
       VALUES ($1, 'gast-teamer-w', 'x', 'Gast Teamer W', $2, 1, true)`,
      [GAST, ROLES.teamer.id]
    );
    await db.query(
      `INSERT INTO user_organizations (user_id, organization_id, role_id)
       VALUES ($1, 2, $2)`,
      [GAST, ROLES.teamer2.id]
    );

    // Dieselbe Konstellation, in Org 2 aber als org_admin -- gehoert dort
    // nicht in den TEAM-Rueckblick.
    await db.query(
      `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
       VALUES ($1, 'gast-chef-w', 'x', 'Gast Chef W', $2, 1, true)`,
      [GAST_CHEF, ROLES.teamer.id]
    );
    await db.query(
      `INSERT INTO user_organizations (user_id, organization_id, role_id)
       VALUES ($1, 2, $2)`,
      [GAST_CHEF, ROLES.orgAdmin2.id]
    );
  });

  const empfaenger = async (orgId) => {
    const { rows } = await db.query(
      `SELECT user_id FROM wrapped_snapshots
        WHERE organization_id = $1 AND wrapped_type = 'teamer'
        ORDER BY user_id`,
      [orgId]
    );
    return rows.map(r => Number(r.user_id));
  };

  it('nimmt Teamer:innen aus user_organizations in den Rueckblick auf', async () => {
    const res = await request(app)
      .post('/api/wrapped/generate-teamer')
      .set('Authorization', `Bearer ${orgAdmin2Token}`);

    expect(res.status).toBe(200);
    // Org 2 hat aus dem Seed teamer2 (Stamm-Gemeinde) plus GAST ueber
    // user_organizations. GAST_CHEF ist dort org_admin und bleibt draussen.
    expect(res.body.errors).toBe(0);
    expect(res.body.generated).toBe(2);
    expect(await empfaenger(2)).toEqual([USERS.teamer2.id, GAST].sort((a, b) => a - b));
  });

  it('laesst org_admins der Zweitgemeinde aussen vor', async () => {
    await request(app)
      .post('/api/wrapped/generate-teamer')
      .set('Authorization', `Bearer ${orgAdmin2Token}`)
      .expect(200);

    expect(await empfaenger(2)).not.toContain(GAST_CHEF);
  });

  it('rechnet den Rueckblick fuer die Gemeinde, die ihn erzeugt', async () => {
    // Der Snapshot der Gastperson haengt an Org 2 -- nicht an ihrer
    // Stamm-Gemeinde. Sonst ueberschriebe der eine Lauf den anderen.
    await request(app)
      .post('/api/wrapped/generate-teamer')
      .set('Authorization', `Bearer ${orgAdmin2Token}`)
      .expect(200);

    const { rows } = await db.query(
      `SELECT organization_id FROM wrapped_snapshots
        WHERE user_id = $1 AND wrapped_type = 'teamer'`,
      [GAST]
    );
    expect(rows.map(r => Number(r.organization_id))).toEqual([2]);
  });

  it('laesst gesperrte und geloeschte Teamer:innen aus', async () => {
    // Nebenwirkung der Umstellung auf orgMitglieder.js (26.09.2026): Die
    // frühere Auswahl filterte weder is_active noch deleted_at -- ein
    // geloeschtes Konto bekam weiterhin einen Snapshot. Die API-Doku führte
    // das als offenen Punkt.
    await db.query(`UPDATE users SET is_active = false WHERE id = $1`, [GAST]);
    await db.query(`UPDATE users SET deleted_at = NOW() WHERE id = $1`, [USERS.teamer2.id]);

    const res = await request(app)
      .post('/api/wrapped/generate-teamer')
      .set('Authorization', `Bearer ${orgAdmin2Token}`);

    // Niemand bleibt uebrig -> kein Rueckblick, aber auch kein Fehlschlag.
    expect(res.status).toBe(200);
    expect(res.body.generated).toBe(0);
    expect(await empfaenger(2)).toEqual([]);
  });

  it('erzeugt in BEIDEN Gemeinden je einen eigenen Rueckblick', async () => {
    // Der Kern der Sache: dieselbe Person, zwei Gemeinden, zwei Rueckblicke
    // mit je eigener ausgabe_id. Vorher gab es nur den der Stamm-Gemeinde.
    const orgAdmin1Token = generateToken('orgAdmin1');

    await request(app)
      .post('/api/wrapped/generate-teamer')
      .set('Authorization', `Bearer ${orgAdmin1Token}`)
      .expect(200);
    await request(app)
      .post('/api/wrapped/generate-teamer')
      .set('Authorization', `Bearer ${orgAdmin2Token}`)
      .expect(200);

    const { rows } = await db.query(
      `SELECT organization_id, ausgabe_id FROM wrapped_snapshots
        WHERE user_id = $1 AND wrapped_type = 'teamer'
        ORDER BY organization_id`,
      [GAST]
    );
    expect(rows.map(r => Number(r.organization_id))).toEqual([1, 2]);
    // Zwei verschiedene Ausgaben, nicht zweimal dieselbe.
    expect(new Set(rows.map(r => String(r.ausgabe_id))).size).toBe(2);
  });
});
