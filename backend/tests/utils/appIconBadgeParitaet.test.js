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
  //
  // Seit 25.09.2026 fuer ALLE Rollen plus die ungelesenen Postfach-
  // Mitteilungen (Simon: "lass es dagegen zaehlen"). Bewusst ohne Fallback
  // -- fehlt das Feld, soll der Test fallen, nicht 0 addieren.
  const clientSumme = (body, rolle) => {
    const postfach = body.postfach.ungelesen;
    if (rolle === 'admin') {
      return body.chat.total + body.pendingRequests + body.pendingEvents + body.pendingChallenges + postfach;
    }
    if (rolle === 'teamer') {
      return body.chat.total + body.pendingChallenges + body.newBadges + postfach;
    }
    // Konfi (seit 24.09.2026): plus Challenge-Neuigkeiten.
    return body.chat.total + body.newBadges + body.challengeUpdates.total + postfach;
  };

  /** Eine Postfach-Mitteilung, wie die Schreibstellen sie anlegen. */
  const mitteilung = async (userId, type, data = {}, gelesen = false) => {
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type, data, organization_id, read_at)
       VALUES ($1, 'T', 'M', $2, $3::jsonb, $4, $5)`,
      [userId, type, JSON.stringify(data), ORGS.testGemeinde.id, gelesen ? new Date() : null]
    );
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

    return { server, client: clientSumme(res.body, rolle), body: res.body };
  };

  it('Konfi: mit Challenge-Neuigkeiten (24.09.2026)', async () => {
    // Laufende Challenge fuer konfi1s Jahrgang, nie geoeffnet -> zaehlt 1.
    const { rows: [{ id }] } = await db.query(
      `INSERT INTO challenges (organization_id, title, description, badge_name,
                               starts_at, ends_at, is_draft, audience)
       VALUES ($1, 'Neuigkeit', 'B', 'Stempel', NOW() - interval '1 day',
               NOW() + interval '7 days', false, 'konfis') RETURNING id`,
      [ORGS.testGemeinde.id]
    );
    await db.query(
      'INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id) VALUES ($1, $2)',
      [id, JAHRGAENGE.jahrgang1.id]
    );

    const { server, client, body } = await vergleiche(USERS.konfi1, 'konfi', 'konfi1');
    expect(body.challengeUpdates.total).toBe(1);
    expect(server).toBe(client);
    expect(server).toBeGreaterThan(0);
  });

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

  // ------------------------------------------------------------------
  // Postfach am App-Symbol (25.09.2026)
  // ------------------------------------------------------------------

  it('Simons Messung (Leitung, Konto 41): Postfach 23 + Challenges 9 + Chat 3 = 35, nicht 12', async () => {
    // Vorher zeigte das Symbol 12 -- die 23 fehlten vollstaendig, weil
    // totalBadgeCount das Postfach in keinem Zweig addierte. Nachgestellt
    // mit orgAdmin1 (org-weit, wie Konto 41).
    // 23 ungelesene Mitteilungen zu laengst entschiedenen Antraegen: keine
    // davon ist noch offen, pendingRequests bleibt 0 -- genau wie gemessen.
    for (let i = 0; i < 23; i++) {
      await mitteilung(USERS.orgAdmin1.id, 'new_activity_request', { request_id: 1000 + i });
    }
    // 9 offene Freigaben in einer Challenge der Organisation.
    const { rows: [{ id: challengeId }] } = await db.query(
      `INSERT INTO challenges (organization_id, title, description, badge_name,
                               starts_at, ends_at, is_draft, audience, moderated)
       VALUES ($1, 'Freigaben', 'B', 'Stempel', NOW() - interval '1 day',
               NOW() + interval '7 days', false, 'konfis', true) RETURNING id`,
      [ORGS.testGemeinde.id]
    );
    for (let i = 0; i < 9; i++) {
      await db.query(
        `INSERT INTO challenge_submissions (challenge_id, user_id, organization_id, media_type, moderation_status)
         VALUES ($1, $2, $3, 'text', 'pending')`,
        [challengeId, i % 2 === 0 ? USERS.konfi1.id : USERS.konfi2.id, ORGS.testGemeinde.id]
      );
    }
    // 3 ungelesene Chat-Nachrichten von jemand anderem in einem Raum, in dem
    // orgAdmin1 sitzt.
    await db.query(
      `INSERT INTO chat_participants (room_id, user_id, user_type) VALUES (3, $1, 'admin')`,
      [USERS.orgAdmin1.id]
    );
    await db.query(
      `INSERT INTO chat_messages (room_id, user_id, user_type, content) VALUES
       (3, $1, 'teamer', 'A'), (3, $1, 'teamer', 'B'), (3, $1, 'teamer', 'C')`,
      [USERS.teamer1.id]
    );

    const res = await request(app)
      .get('/api/notifications/badge-counts')
      .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
    expect(res.status).toBe(200);
    expect(res.body.postfach.ungelesen).toBe(23);
    expect(res.body.pendingChallenges).toBe(9);
    expect(res.body.chat.total).toBe(3);
    expect(res.body.pendingRequests).toBe(0);
    expect(res.body.pendingEvents).toBe(0);

    const server = await berechneAppIconSumme(db, {
      id: USERS.orgAdmin1.id, type: 'admin', role_name: 'org_admin',
      organization_id: ORGS.testGemeinde.id, assigned_jahrgaenge: []
    });
    expect(clientSumme(res.body, 'admin')).toBe(35);
    expect(server).toBe(35);
  });

  it('Postfach: gelesene Mitteilungen zaehlen auf keiner Seite', async () => {
    await mitteilung(USERS.konfi1.id, 'bonus_points', { points: '2' }, true);
    await mitteilung(USERS.konfi1.id, 'bonus_points', { points: '3' }, false);

    const { server, client, body } = await vergleiche(USERS.konfi1, 'konfi', 'konfi1');
    expect(body.postfach.ungelesen).toBe(1);
    expect(server).toBe(client);
    expect(server).toBe(1);
  });

  it('Konfi: "Punkte erhalten" zaehlt am Symbol -- vorher gab es dafuer nur den Push', async () => {
    await mitteilung(USERS.konfi1.id, 'bonus_points', { points: '5' });
    await mitteilung(USERS.konfi1.id, 'event_attendance', { event_id: '1', points: '2' });
    await mitteilung(USERS.konfi1.id, 'level_up', { level_id: '2' });

    const { server, client, body } = await vergleiche(USERS.konfi1, 'konfi', 'konfi1');
    expect(body.newBadges).toBe(0);
    expect(body.challengeUpdates.total).toBe(0);
    expect(server).toBe(client);
    expect(server).toBe(3);
  });

  it('Leitung: offener Antrag UND seine ungelesene Mitteilung -> 2 auf beiden Seiten (Reiter + Glocke, bewusst)', async () => {
    // Die Ueberlappung besteht, solange der Antrag offen UND die Mitteilung
    // ungelesen ist -- dann zeigt die App auch zwei Zahlen (Reiter 1,
    // Glocke 1), und das Symbol verspricht nicht mehr als das. Warum kein
    // Ausschluss je Art: utils/postfachArten.js.
    const { rows: [{ id: requestId }] } = await db.query(
      `INSERT INTO activity_requests (user_id, activity_id, requested_date, status, organization_id)
       VALUES ($1, $2, '2026-08-27', 'pending', $3) RETURNING id`,
      [USERS.konfi1.id, ACTIVITIES.sonntagsgottesdienst.id, ORGS.testGemeinde.id]
    );
    await mitteilung(USERS.admin1.id, 'new_activity_request', { request_id: requestId });

    const { server, client, body } = await vergleiche(USERS.admin1, 'admin', 'admin1');
    expect(body.pendingRequests).toBe(1);
    expect(body.postfach.ungelesen).toBe(1);
    expect(server).toBe(client);
    expect(server).toBe(2);
  });

  it('Postfach zaehlt ueber alle Gemeinden -- auf beiden Seiten', async () => {
    // orgAdmin1 bekommt eine Mitteilung aus Org 2 (Zweit-Gemeinde).
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type, data, organization_id)
       VALUES ($1, 'T', 'M', 'event_opt_out', '{}', $2)`,
      [USERS.orgAdmin1.id, ORGS.andereGemeinde.id]
    );
    await mitteilung(USERS.orgAdmin1.id, 'event_opt_out', {});

    const res = await request(app)
      .get('/api/notifications/badge-counts')
      .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
    expect(res.body.postfach.ungelesen).toBe(2);

    const server = await berechneAppIconSumme(db, {
      id: USERS.orgAdmin1.id, type: 'admin', role_name: 'org_admin',
      organization_id: ORGS.testGemeinde.id, assigned_jahrgaenge: []
    });
    expect(server).toBe(clientSumme(res.body, 'admin'));
    expect(server).toBe(2);
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
