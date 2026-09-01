// backend/tests/utils/appIconBadgeParitaet.test.js
//
// Befund B2b: Die Server-Summe fuers App-Icon muss mit dem uebereinstimmen,
// was der Client in den Reitern anzeigt. Beide leiten sich aus DERSELBEN
// Semantik ab, stehen aber in zwei Sprachen an zwei Orten:
//
//   Server: utils/appIconBadge.js        (fuer Pushes, App geschlossen)
//   Client: contexts/BadgeContext.tsx    (waehrend die App laeuft)
//
// Der eigentliche Vergleich laeuft ueber den Endpunkt badge-counts: Er
// liefert exakt die fuenf Zahlen, aus denen der Client die Summe bildet.
// Stimmt die Server-Summe mit deren Summe ueberein, stimmt sie auch mit dem
// Client -- und das Icon widerspricht den Reitern nicht mehr.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ACTIVITIES, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { berechneAppIconSumme } = require('../../utils/appIconBadge');

describe('App-Icon-Summe deckt sich mit badge-counts (B2b)', () => {
  let app, db;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    // Jahrgangs-Bindung (01.09.2026): Die Rolle 'admin' zaehlt Antraege,
    // Termine und Freigaben nur noch fuer zugewiesene Jahrgaenge — auf
    // beiden Seiten des Vergleichs (badge-counts UND appIconBadge). admin1
    // hat im Seed bewusst keine Zuweisung; fuer den Paritaets-Test mit
    // Zaehlern > 0 bekommt er jahrgang1. Der Fall OHNE Zuweisung steht in
    // jahrgangsBindungAdmin.test.js.
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
    );
    require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);
  });
  afterAll(async () => { await closePool(); });

  // Bildet totalBadgeCount aus BadgeContext.tsx nach.
  const clientSumme = (body, rolle) => {
    if (rolle === 'admin') {
      return body.chat.total + body.pendingRequests + body.pendingEvents + body.pendingChallenges;
    }
    if (rolle === 'teamer') {
      return body.chat.total + body.pendingChallenges + body.newBadges;
    }
    return body.chat.total + body.newBadges;
  };

  const vergleiche = async (user, rolle, tokenName) => {
    const res = await request(app)
      .get('/api/notifications/badge-counts')
      .set('Authorization', `Bearer ${generateToken(tokenName)}`);
    expect(res.status).toBe(200);

    // Zuweisungen wie in ladeEmpfaengerFuerBadge aus der DB — seit der
    // Jahrgangs-Bindung braucht sie auch die Rolle 'admin', nicht nur Teamer.
    const { rows: zuweisungen } = await db.query(
      'SELECT jahrgang_id AS id, can_view FROM user_jahrgang_assignments WHERE user_id = $1',
      [user.id]
    );

    const server = await berechneAppIconSumme(db, {
      id: user.id,
      type: user.type,
      role_name: rolle === 'admin' ? 'admin' : rolle,
      organization_id: ORGS.testGemeinde.id,
      assigned_jahrgaenge: zuweisungen
    });

    return { server, client: clientSumme(res.body, rolle) };
  };

  it('Konfi: leer', async () => {
    const { server, client } = await vergleiche(USERS.konfi1, 'konfi', 'konfi1');
    expect(server).toBe(client);
  });

  it('Konfi: mit Chat und Abzeichen', async () => {
    await db.query(
      `INSERT INTO chat_messages (room_id, user_id, user_type, content) VALUES
       (1, $1, 'admin', 'A'), (1, $1, 'admin', 'B'), (2, $1, 'admin', 'C')`,
      [USERS.admin1.id]
    );
    const { rows: [badge] } = await db.query(
      `INSERT INTO custom_badges (name, icon, criteria_type, criteria_value, organization_id, is_active, target_role)
       VALUES ('Paritaet', 'star', 'total_points', 1, $1, true, 'konfi') RETURNING id`,
      [ORGS.testGemeinde.id]
    );
    await db.query(
      `INSERT INTO user_badges (user_id, badge_id, organization_id, seen) VALUES ($1, $2, $3, false)`,
      [USERS.konfi1.id, badge.id, ORGS.testGemeinde.id]
    );

    const { server, client } = await vergleiche(USERS.konfi1, 'konfi', 'konfi1');
    expect(server).toBe(client);
    // Und zwar nicht zufaellig beide 0:
    expect(server).toBeGreaterThan(0);
  });

  it('Leitung: mit offenen Antraegen', async () => {
    await db.query(
      `INSERT INTO activity_requests (user_id, activity_id, requested_date, status, organization_id)
       VALUES ($1, $2, '2026-08-27', 'pending', $3)`,
      [USERS.konfi1.id, ACTIVITIES.sonntagsgottesdienst.id, ORGS.testGemeinde.id]
    );

    const { server, client } = await vergleiche(USERS.admin1, 'admin', 'admin1');
    expect(server).toBe(client);
    expect(server).toBeGreaterThan(0);
  });

  it('Leitung: Antrag im FREMDEN Jahrgang zaehlt auf keiner Seite (Bindung 01.09.2026)', async () => {
    // Konfi in einem Jahrgang, der admin1 NICHT zugewiesen ist.
    await db.query(
      `INSERT INTO jahrgaenge (id, name, organization_id, confirmation_date)
       VALUES (901, 'Fremd 2027', 1, '2027-05-01')`
    );
    await db.query(
      `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
       VALUES (902, 'konfi_fremd', 'x', 'Konfi Fremd', 1, 1, true)`
    );
    await db.query(
      `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
       VALUES (902, 901, 0, 0, 1)`
    );
    await db.query(
      `INSERT INTO activity_requests (user_id, activity_id, requested_date, status, organization_id)
       VALUES (902, $1, '2026-08-27', 'pending', 1)`,
      [ACTIVITIES.sonntagsgottesdienst.id]
    );

    const { server, client } = await vergleiche(USERS.admin1, 'admin', 'admin1');
    expect(server).toBe(client);
    // Und zwar beide 0 — der fremde Antrag zaehlt weder am Icon noch am Reiter.
    expect(server).toBe(0);
  });

  it('Teamer: mit Chat', async () => {
    await db.query(
      `INSERT INTO chat_messages (room_id, user_id, user_type, content) VALUES (3, $1, 'admin', 'Team')`,
      [USERS.admin1.id]
    );

    const { server, client } = await vergleiche(USERS.teamer1, 'teamer', 'teamer1');
    expect(server).toBe(client);
  });
});
