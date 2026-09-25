// backend/tests/routes/badgeJeOrganisation.test.js
//
// GET /api/notifications/badge-counts/je-organisation (25.09.2026)
//
// Simon: "Koennen wir an den Switcher der Orgs an jede Org einen Indikator
// haengen? Das wuerde helfen, wenn was offen ist." Die Route liefert dafuer je
// Gemeinde der Person, was dort offen ist -- mit der Rolle und den Jahrgaengen,
// die sie DORT hat.
//
// Audit-Befund B1 (25.09.2026): Der Server rechnet die App-Icon-Zahl ueber
// ALLE Gemeinden (an Simons Konto: Push setzt 4), die App ueberschreibt sie
// beim Oeffnen mit der aktiven Gemeinde (1). Diese Route ist die Aufteilung
// dieser Summe -- dieselben Bausteine (utils/appIconBadge.js), je Gemeinde.
//
// Assertions auf konkrete Zahlen, kein toBeDefined auf einem Zaehler.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES, JAHRGAENGE, ACTIVITIES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');

const PFAD = '/api/notifications/badge-counts/je-organisation';

// Eine dritte Gemeinde, die der Seed nicht kennt -- mit eigenen Rollen, wie
// in Produktion (roles.organization_id).
const ORG3 = { id: 3, name: 'Dritte Gemeinde', slug: 'dritte-gemeinde' };
const ROLLE_ORG_ADMIN_3 = 14;
const ROLLE_TEAMER_3 = 15;

const zusatz = (db, userId, orgId, roleId) => db.query(
  'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
  [userId, orgId, roleId]
);

const offenerAntrag = (db, konfiId, activityId, orgId) => db.query(
  `INSERT INTO activity_requests (user_id, activity_id, requested_date, status, organization_id)
   VALUES ($1, $2, CURRENT_DATE, 'pending', $3)`,
  [konfiId, activityId, orgId]
);

// Eine laufende Challenge mit EINEM wartenden Beitrag. audience 'nur_team'
// zaehlt fuer jede:n Teamer:in der Gemeinde, 'konfis' nur bei Zuweisung auf
// den zugeordneten Jahrgang (Migration 121, Befund H4).
async function challengeMitOffenemBeitrag(db, orgId, audience, jahrgangId = null, einreicherId) {
  const { rows: [c] } = await db.query(
    `INSERT INTO challenges (organization_id, title, description, badge_name, starts_at, ends_at, is_draft, audience)
     VALUES ($1, 'Runde', 'B', 'A', NOW() - interval '1 day', NOW() + interval '7 days', false, $2) RETURNING id`,
    [orgId, audience]
  );
  if (jahrgangId) {
    await db.query(
      'INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id) VALUES ($1, $2)',
      [c.id, jahrgangId]
    );
  }
  await db.query(
    `INSERT INTO challenge_submissions (challenge_id, user_id, organization_id, media_type, moderation_status)
     VALUES ($1, $2, $3, 'text', 'pending')`,
    [c.id, einreicherId, orgId]
  );
  return c.id;
}

const hole = (app, token) => request(app).get(PFAD).set('Authorization', `Bearer ${token}`);

describe('GET /api/notifications/badge-counts/je-organisation', () => {
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
      'INSERT INTO organizations (id, name, slug, display_name, is_active) VALUES ($1, $2, $3, $2, true)',
      [ORG3.id, ORG3.name, ORG3.slug]
    );
    await db.query(
      `INSERT INTO roles (id, name, display_name, organization_id) VALUES
       ($1, 'org_admin', 'Org-Admin', $3), ($2, 'teamer', 'Teamer:in', $3)`,
      [ROLLE_ORG_ADMIN_3, ROLLE_TEAMER_3, ORG3.id]
    );
    // Eine Aktivitaet in Org 2, damit dort ein Antrag offen sein kann.
    await db.query(
      `INSERT INTO activities (id, name, points, type, organization_id) VALUES (99, 'Org-2-Aktivitaet', 1, 'gottesdienst', $1)`,
      [ORGS.andereGemeinde.id]
    );
    for (const u of Object.values(USERS)) invalidateUserCache(u.id);
  });

  afterAll(async () => {
    await closePool();
  });

  it('ohne Token -> 401', async () => {
    const res = await request(app).get(PFAD);
    expect(res.status).toBe(401);
  });

  describe('eine Person in drei Gemeinden', () => {
    // orgAdmin1: zuhause org_admin in Org 1, Teamer:in in Org 2, org_admin in
    // Org 3 -- Simons Konstellation, nur mit einer Teamer-Rolle dazwischen,
    // damit die Rolle je Gemeinde sichtbar geprueft wird.
    beforeEach(async () => {
      await zusatz(db, USERS.orgAdmin1.id, ORGS.andereGemeinde.id, ROLES.teamer2.id);
      await zusatz(db, USERS.orgAdmin1.id, ORG3.id, ROLLE_ORG_ADMIN_3);

      // Org 1: zwei offene Antraege -> org_admin zaehlt org-weit: 2.
      await offenerAntrag(db, USERS.konfi1.id, ACTIVITIES.sonntagsgottesdienst.id, ORGS.testGemeinde.id);
      await offenerAntrag(db, USERS.konfi2.id, ACTIVITIES.sonntagsgottesdienst.id, ORGS.testGemeinde.id);

      // Org 2: ein offener Antrag (zaehlt NUR fuer die Leitung) und ein
      // wartender Team-Beitrag (zaehlt fuer Teamer:innen).
      await offenerAntrag(db, USERS.konfi3.id, 99, ORGS.andereGemeinde.id);
      await challengeMitOffenemBeitrag(db, ORGS.andereGemeinde.id, 'nur_team', null, USERS.teamer2.id);

      // Org 3: nichts.
    });

    it('liefert je Gemeinde die richtige Zahl -- und genau diese drei Gemeinden', async () => {
      const res = await hole(app, generateToken('orgAdmin1'));
      expect(res.status).toBe(200);
      expect(Object.keys(res.body.jeOrganisation).map(Number).sort()).toEqual([1, 2, 3]);
      expect(res.body.jeOrganisation[1]).toEqual({ offen: 2 });
      // Als Teamer:in in Org 2: der Team-Beitrag (1), NICHT der Antrag.
      expect(res.body.jeOrganisation[2]).toEqual({ offen: 1 });
      // Gemeinde ohne Offenes steht drin, mit 0 -- die App zeigt dann nichts.
      expect(res.body.jeOrganisation[3]).toEqual({ offen: 0 });
    });

    it('die Rolle gilt je Gemeinde: als org_admin in Org 2 zaehlt auch der Antrag', async () => {
      // Gegenstueck zum Fall oben: gleiche Daten, andere Rolle in Org 2.
      await db.query(
        'UPDATE user_organizations SET role_id = $1 WHERE user_id = $2 AND organization_id = $3',
        [ROLES.orgAdmin2.id, USERS.orgAdmin1.id, ORGS.andereGemeinde.id]
      );
      const res = await hole(app, generateToken('orgAdmin1'));
      expect(res.status).toBe(200);
      // Antrag (1) + Freigabe (1) -- org_admin sieht beides org-weit.
      expect(res.body.jeOrganisation[2]).toEqual({ offen: 2 });
      // Die anderen beiden Gemeinden bleiben, wie sie waren.
      expect(res.body.jeOrganisation[1]).toEqual({ offen: 2 });
      expect(res.body.jeOrganisation[3]).toEqual({ offen: 0 });
    });

    it('die Zahlen haengen nicht an der gerade aktiven Gemeinde', async () => {
      // In Org 2 gewechselt (X-Active-Organization) muss dieselbe Aufteilung
      // kommen -- die Liste zeigt ja gerade die ANDEREN Gemeinden.
      const res = await request(app)
        .get(PFAD)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`)
        .set('X-Active-Organization', String(ORGS.andereGemeinde.id));
      expect(res.status).toBe(200);
      expect(res.body.jeOrganisation).toEqual({
        1: { offen: 2 },
        2: { offen: 1 },
        3: { offen: 0 }
      });
    });
  });

  describe('Jahrgangsbindung je Gemeinde', () => {
    // admin1 ist in Org 1 gebundener Admin und zusaetzlich Teamer:in in Org 2.
    // In Org 2 wartet ein Konfi-Beitrag zu einer Challenge von Jahrgang 2.
    beforeEach(async () => {
      await zusatz(db, USERS.admin1.id, ORGS.andereGemeinde.id, ROLES.teamer2.id);
      await challengeMitOffenemBeitrag(db, ORGS.andereGemeinde.id, 'konfis', JAHRGAENGE.jahrgang2.id, USERS.konfi3.id);
    });

    it('verboten: ohne Zuweisung auf Jahrgang 2 zaehlt der Beitrag in Org 2 nicht', async () => {
      const res = await hole(app, generateToken('admin1'));
      expect(res.status).toBe(200);
      expect(res.body.jeOrganisation[2]).toEqual({ offen: 0 });
    });

    it('verboten: eine Zuweisung in Org 1 oeffnet nichts in Org 2', async () => {
      // Jahrgang 1 gehoert Org 1. Wer nur ihn hat, sieht in Org 2 weiter nichts.
      await db.query(
        'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
        [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
      );
      const res = await hole(app, generateToken('admin1'));
      expect(res.status).toBe(200);
      expect(res.body.jeOrganisation[2]).toEqual({ offen: 0 });
    });

    it('erlaubt: mit Zuweisung auf Jahrgang 2 zaehlt der Beitrag in Org 2', async () => {
      await db.query(
        'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, false)',
        [USERS.admin1.id, JAHRGAENGE.jahrgang2.id]
      );
      const res = await hole(app, generateToken('admin1'));
      expect(res.status).toBe(200);
      expect(res.body.jeOrganisation[2]).toEqual({ offen: 1 });
    });

    it('gebundener Admin zuhause: Konfi-Antrag nur aus dem zugewiesenen Jahrgang', async () => {
      // Derselbe Filter wie badge-counts.pendingRequests (01.09.2026).
      await offenerAntrag(db, USERS.konfi1.id, ACTIVITIES.sonntagsgottesdienst.id, ORGS.testGemeinde.id);
      const ohne = await hole(app, generateToken('admin1'));
      expect(ohne.body.jeOrganisation[1]).toEqual({ offen: 0 });

      await db.query(
        'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
        [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
      );
      const mit = await hole(app, generateToken('admin1'));
      expect(mit.body.jeOrganisation[1]).toEqual({ offen: 1 });
    });
  });

  describe('ohne Zugehoerigkeit', () => {
    it('eine Gemeinde, der die Person nicht angehoert, taucht nicht auf -- auch wenn dort etwas offen ist', async () => {
      await offenerAntrag(db, USERS.konfi1.id, ACTIVITIES.sonntagsgottesdienst.id, ORGS.testGemeinde.id);
      const res = await hole(app, generateToken('orgAdmin2'));
      expect(res.status).toBe(200);
      expect(res.body.jeOrganisation).toEqual({ 2: { offen: 0 } });
    });

    it('eine gesperrte Gemeinde faellt heraus, wie in GET /auth/my-organizations', async () => {
      await zusatz(db, USERS.orgAdmin1.id, ORG3.id, ROLLE_ORG_ADMIN_3);
      await db.query('UPDATE organizations SET is_active = false WHERE id = $1', [ORG3.id]);
      const res = await hole(app, generateToken('orgAdmin1'));
      expect(res.status).toBe(200);
      expect(Object.keys(res.body.jeOrganisation)).toEqual(['1']);
    });
  });

  describe('Paritaet mit dem App-Symbol', () => {
    it('Konfi mit einer Gemeinde: dieselbe Zahl wie am Symbol (2 ungelesene Nachrichten)', async () => {
      await db.query(
        `INSERT INTO chat_messages (room_id, user_id, user_type, content) VALUES
         (1, $1, 'admin', 'Eins'), (1, $1, 'admin', 'Zwei')`,
        [USERS.admin1.id]
      );
      const res = await hole(app, generateToken('konfi1'));
      expect(res.status).toBe(200);
      expect(res.body.jeOrganisation).toEqual({ 1: { offen: 2 } });
    });
  });
});
