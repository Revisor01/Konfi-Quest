// backend/tests/services/appIconMehrereGemeinden.test.js
//
// Audit "Wer bekommt was" 27.09.2026, Befund BF-12 (Frage F-09): Die Zahl am
// App-Symbol bei Personen mit mehreren Gemeinden.
//
// Vorher gab es drei Rechnungen fuer dieselbe Zahl:
//
//   Push (berechneBadge, berechneBadgesFuerAlle) und Hintergrund-Lauf
//     rechneten jede Gemeinde mit der STAMM-Rolle (users.role_id) und zaehlten
//     das Postfach in jeder Gemeinde-Runde erneut.
//   Gemeinde-Umschalter (GET /notifications/badge-counts/je-organisation)
//     rechnete richtig: Rolle und Jahrgaenge je Gemeinde, Postfach einmal.
//   Offene App (BadgeContext) setzte nur die Summe der AKTIVEN Gemeinde.
//
// Gemessen im Audit (A11): Push und Hintergrund 5, Umschalter 2 + 0, App 2.
//
// Entscheidung F-09: Das Symbol zeigt die Summe ueber alle Gemeinden, je
// Gemeinde mit der dortigen Rolle und den dortigen Jahrgaengen -- dieselbe
// Rechnung wie der Umschalter. Diese Suite haelt fest, dass Push, Hintergrund
// und Umschalter dieselbe Zahl ergeben. Was die offene App daraus macht, steht
// in frontend/src/__tests__/contexts/badgeAppSymbolAlleGemeinden.test.tsx.
//
// Assertions auf konkrete Zahlen, kein toBeDefined auf einem Zaehler.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES, JAHRGAENGE, ACTIVITIES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');
const { berechneAppIconSumme } = require('../../utils/appIconBadge');

const firebase = require('../../push/firebase');
vi.spyOn(firebase, 'sendFirebasePushNotification').mockResolvedValue({ success: true });
vi.spyOn(firebase, 'sendFirebaseSilentPush').mockResolvedValue({ success: true });

const BackgroundService = require('../../services/backgroundService');
const PushService = require('../../services/pushService');

const PFAD = '/api/notifications/badge-counts/je-organisation';

// Eine Aktivitaet in Org 2, damit dort ein Antrag offen sein kann.
const AKTIVITAET_ORG2 = 99;

describe('App-Symbol bei mehreren Gemeinden (BF-12)', () => {
  let app;
  let db;

  beforeAll(() => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    await db.query(
      `INSERT INTO activities (id, name, points, type, organization_id)
       VALUES ($1, 'Org-2-Aktivitaet', 1, 'gottesdienst', $2)`,
      [AKTIVITAET_ORG2, ORGS.andereGemeinde.id]
    );
    // Ein Geraet, damit der Hintergrund-Lauf die Zahl ueberhaupt rechnet
    // und sich merkt (ohne Token gibt es kein Symbol).
    for (const u of [USERS.orgAdmin1, USERS.admin2, USERS.konfi1]) {
      await db.query(
        'INSERT INTO push_tokens (user_id, token, platform, device_id) VALUES ($1, $2, $3, $4)',
        [u.id, `tok-${u.id}`, 'ios', `dev-${u.id}`]
      );
    }
    BackgroundService.letzterZaehler.clear();
    BackgroundService.letzterAbzeichenAbdruck.clear();
    BackgroundService.zaehlerMerkerGefuellt = false;
    for (const u of Object.values(USERS)) invalidateUserCache(u.id);
  });

  afterAll(async () => {
    await closePool();
  });

  const zusatz = (userId, orgId, roleId) => db.query(
    'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
    [userId, orgId, roleId]
  );

  const offenerAntrag = (konfiId, activityId, orgId) => db.query(
    `INSERT INTO activity_requests (user_id, activity_id, requested_date, status, organization_id)
     VALUES ($1, $2, CURRENT_DATE, 'pending', $3)`,
    [konfiId, activityId, orgId]
  );

  const mitteilung = (userId, orgId, type = 'challenge_submission') => db.query(
    `INSERT INTO notifications (user_id, title, message, type, data, organization_id)
     VALUES ($1, 'T', 'M', $2, '{}'::jsonb, $3)`,
    [userId, type, orgId]
  );

  // Eine laufende Challenge fuer einen Jahrgang mit EINEM wartenden Beitrag.
  async function wartenderBeitrag(orgId, jahrgangId, einreicherId) {
    const { rows: [c] } = await db.query(
      `INSERT INTO challenges (organization_id, title, description, badge_name, starts_at, ends_at, is_draft, audience)
       VALUES ($1, 'Runde', 'B', 'A', NOW() - interval '1 day', NOW() + interval '7 days', false, 'konfis') RETURNING id`,
      [orgId]
    );
    await db.query(
      'INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id) VALUES ($1, $2)',
      [c.id, jahrgangId]
    );
    await db.query(
      `INSERT INTO challenge_submissions (challenge_id, user_id, organization_id, media_type, moderation_status)
       VALUES ($1, $2, $3, 'text', 'pending')`,
      [c.id, einreicherId, orgId]
    );
  }

  // Die drei Stellen, die die Zahl am Symbol setzen oder zeigen.
  const umschalter = async (tokenName) => {
    const res = await request(app).get(PFAD).set('Authorization', `Bearer ${generateToken(tokenName)}`);
    expect(res.status).toBe(200);
    const jeOrg = Object.fromEntries(
      Object.entries(res.body.jeOrganisation).map(([org, e]) => [org, e.offen])
    );
    const summe = Object.values(jeOrg).reduce((n, x) => n + x, 0);
    return { jeOrg, summe };
  };
  const hintergrund = async (user) => {
    // Der erste Lauf nach dem Start sendet nichts, merkt sich aber die Zahl
    // jeder Person mit Geraet -- genau die, die er senden wuerde.
    await BackgroundService.updateAllUserBadges(db, { nurZaehler: true });
    return BackgroundService.letzterZaehler.get(`${user.id}_${user.type}`);
  };
  const push = (user) => PushService.berechneBadge(db, user.id);
  const pushAnViele = async (user) => {
    const { badges } = await PushService.berechneBadgesFuerAlle(db, [user.id, USERS.konfi1.id]);
    return badges.get(user.id);
  };

  describe('Stamm-Gemeinde Org-Admin, Zweitgemeinde Teamer:in mit Jahrgang', () => {
    // orgAdmin1: zuhause org_admin in Org 1, in Org 2 Teamer:in mit
    // Zuweisung auf Jahrgang 2 (einem Jahrgang von Org 2).
    //
    // Org 1: zwei offene Antraege (org-weit sichtbar)         -> 2
    //        eine ungelesene Mitteilung aus Org 1             -> 1
    // Org 2: ein offener Antrag -- sieht eine Teamer:in NICHT -> 0
    //        ein wartender Beitrag im Jahrgang 2              -> 1
    //        eine ungelesene Mitteilung aus Org 2             -> 1
    //
    // Richtig: Org 1 = 3, Org 2 = 2, Symbol = 5.
    // Vorher am Push und im Hintergrund: Org 2 mit der Stamm-Rolle org_admin
    // (Antrag zaehlt mit) und das Postfach je Gemeinde ganz: (2+2) + (1+1+2) = 8.
    beforeEach(async () => {
      await zusatz(USERS.orgAdmin1.id, ORGS.andereGemeinde.id, ROLES.teamer2.id);
      await db.query(
        'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, false)',
        [USERS.orgAdmin1.id, JAHRGAENGE.jahrgang2.id]
      );
      await offenerAntrag(USERS.konfi1.id, ACTIVITIES.sonntagsgottesdienst.id, ORGS.testGemeinde.id);
      await offenerAntrag(USERS.konfi2.id, ACTIVITIES.sonntagsgottesdienst.id, ORGS.testGemeinde.id);
      await offenerAntrag(USERS.konfi3.id, AKTIVITAET_ORG2, ORGS.andereGemeinde.id);
      await wartenderBeitrag(ORGS.andereGemeinde.id, JAHRGAENGE.jahrgang2.id, USERS.konfi3.id);
      await mitteilung(USERS.orgAdmin1.id, ORGS.testGemeinde.id);
      await mitteilung(USERS.orgAdmin1.id, ORGS.andereGemeinde.id);
      invalidateUserCache(USERS.orgAdmin1.id);
    });

    it('der Umschalter zeigt je Gemeinde die Zahl mit der dortigen Rolle: 3 und 2', async () => {
      const { jeOrg, summe } = await umschalter('orgAdmin1');
      expect(jeOrg).toEqual({ 1: 3, 2: 2 });
      expect(summe).toBe(5);
    });

    it('Push an eine Person: 5 -- die Summe des Umschalters, nicht 8', async () => {
      expect(await push(USERS.orgAdmin1)).toBe(5);
    });

    it('Push an viele: 5', async () => {
      expect(await pushAnViele(USERS.orgAdmin1)).toBe(5);
    });

    it('Hintergrund-Lauf: 5', async () => {
      expect(await hintergrund(USERS.orgAdmin1)).toBe(5);
    });

    it('alle drei Stellen ergeben dieselbe Zahl', async () => {
      const { summe } = await umschalter('orgAdmin1');
      const werte = [await push(USERS.orgAdmin1), await pushAnViele(USERS.orgAdmin1), await hintergrund(USERS.orgAdmin1)];
      expect(werte).toEqual([summe, summe, summe]);
    });

    it('ohne Jahrgang in Org 2 zaehlt der Beitrag dort nirgends: 4', async () => {
      await db.query('DELETE FROM user_jahrgang_assignments WHERE user_id = $1', [USERS.orgAdmin1.id]);
      invalidateUserCache(USERS.orgAdmin1.id);
      const { jeOrg } = await umschalter('orgAdmin1');
      expect(jeOrg).toEqual({ 1: 3, 2: 1 });
      expect(await push(USERS.orgAdmin1)).toBe(4);
      expect(await hintergrund(USERS.orgAdmin1)).toBe(4);
    });

    it('die Summe entsteht in EINER Zaehlrunde, nicht einer je Gemeinde', async () => {
      // Vorher lief die ganze Zaehlrunde je Gemeinde der Person einmal --
      // mit zwei Gemeinden also zweimal die Chat-Abfrage.
      const sqls = [];
      const zaehlDb = {
        query: (text, params) => { sqls.push(String(text)); return db.query(text, params); },
        getClient: () => db.getClient(),
      };
      expect(await PushService.berechneBadge(zaehlDb, USERS.orgAdmin1.id)).toBe(5);
      expect(sqls.filter((q) => q.includes('FROM chat_messages m')).length).toBe(1);
    });
  });

  describe('Postfach genau einmal', () => {
    it('Org-Admin in zwei Gemeinden, eine Mitteilung: 1, nicht 2', async () => {
      await zusatz(USERS.orgAdmin1.id, ORGS.andereGemeinde.id, ROLES.orgAdmin2.id);
      await mitteilung(USERS.orgAdmin1.id, ORGS.andereGemeinde.id);
      invalidateUserCache(USERS.orgAdmin1.id);

      const { jeOrg } = await umschalter('orgAdmin1');
      expect(jeOrg).toEqual({ 1: 0, 2: 1 });
      expect(await push(USERS.orgAdmin1)).toBe(1);
      expect(await pushAnViele(USERS.orgAdmin1)).toBe(1);
      expect(await hintergrund(USERS.orgAdmin1)).toBe(1);
    });

    it('eine Mitteilung aus einer Gemeinde, der die Person nicht (mehr) angehoert, zaehlt einmal -- bei der Stamm-Gemeinde', async () => {
      // Das Postfach liest ueber alle Gemeinden des Kontos, die Glocke zeigt
      // sie also. Das Symbol zaehlt sie mit, genau einmal; im Umschalter steht
      // sie bei der Stamm-Gemeinde, damit dessen Summe die Zahl am Symbol ist.
      const ORG3 = 3;
      await db.query(
        "INSERT INTO organizations (id, name, slug, display_name, is_active) VALUES ($1, 'Dritte', 'dritte', 'Dritte', true)",
        [ORG3]
      );
      await zusatz(USERS.orgAdmin1.id, ORGS.andereGemeinde.id, ROLES.orgAdmin2.id);
      await mitteilung(USERS.orgAdmin1.id, ORG3);
      invalidateUserCache(USERS.orgAdmin1.id);

      const { jeOrg } = await umschalter('orgAdmin1');
      expect(jeOrg).toEqual({ 1: 1, 2: 0 });
      expect(await push(USERS.orgAdmin1)).toBe(1);
      expect(await hintergrund(USERS.orgAdmin1)).toBe(1);
    });

    it('eine gesperrte Zweitgemeinde zaehlt nicht mit, ihre Mitteilung schon (bei der Stamm-Gemeinde)', async () => {
      // Gesperrte Gemeinden fuehrt der Umschalter nicht (wie
      // GET /auth/my-organizations); oeffnen laesst sich dort nichts.
      await zusatz(USERS.orgAdmin1.id, ORGS.andereGemeinde.id, ROLES.orgAdmin2.id);
      await offenerAntrag(USERS.konfi3.id, AKTIVITAET_ORG2, ORGS.andereGemeinde.id);
      await mitteilung(USERS.orgAdmin1.id, ORGS.andereGemeinde.id);
      await db.query('UPDATE organizations SET is_active = false WHERE id = $1', [ORGS.andereGemeinde.id]);
      invalidateUserCache(USERS.orgAdmin1.id);

      const { jeOrg } = await umschalter('orgAdmin1');
      expect(jeOrg).toEqual({ 1: 1 });
      expect(await push(USERS.orgAdmin1)).toBe(1);
      expect(await hintergrund(USERS.orgAdmin1)).toBe(1);
    });
  });

  describe('eine Gemeinde: nichts aendert sich', () => {
    // Referenz ist die Rechnung fuer EINE Gemeinde (berechneAppIconSumme),
    // die appIconBadgeParitaet.test.js gegen die Reiter der App prueft.
    it('Konfi: Mitteilung und Challenge-Neuigkeit -- ueberall 2', async () => {
      const { rows: [c] } = await db.query(
        `INSERT INTO challenges (organization_id, title, description, badge_name, starts_at, ends_at, is_draft, audience)
         VALUES ($1, 'Neu', 'B', 'A', NOW() - interval '1 day', NOW() + interval '7 days', false, 'konfis') RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      await db.query('INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id) VALUES ($1, $2)',
        [c.id, JAHRGAENGE.jahrgang1.id]);
      await mitteilung(USERS.konfi1.id, ORGS.testGemeinde.id, 'bonus_points');

      const eineGemeinde = await berechneAppIconSumme(db, {
        id: USERS.konfi1.id, type: 'konfi', role_name: 'konfi',
        organization_id: ORGS.testGemeinde.id, assigned_jahrgaenge: []
      });
      expect(eineGemeinde).toBe(2);
      expect(await push(USERS.konfi1)).toBe(2);
      expect(await hintergrund(USERS.konfi1)).toBe(2);
      expect((await umschalter('konfi1')).summe).toBe(2);
    });

    it('Admin mit Mitteilung aus einer fremden Gemeinde: am Symbol wie bisher 2, der Umschalter zaehlt sie jetzt mit', async () => {
      // admin2 gehoert nur Org 2 an. Eine Mitteilung aus Org 1 (etwa aus
      // einer frueheren Mitgliedschaft) zeigt die Glocke -- sie zaehlte am
      // Symbol schon immer und bleibt dabei.
      await offenerAntrag(USERS.konfi3.id, AKTIVITAET_ORG2, ORGS.andereGemeinde.id);
      await db.query(
        'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
        [USERS.admin2.id, JAHRGAENGE.jahrgang2.id]
      );
      await mitteilung(USERS.admin2.id, ORGS.testGemeinde.id, 'event_opt_out');
      invalidateUserCache(USERS.admin2.id);

      const eineGemeinde = await berechneAppIconSumme(db, {
        id: USERS.admin2.id, type: 'admin', role_name: 'admin',
        organization_id: ORGS.andereGemeinde.id,
        assigned_jahrgaenge: [{ id: JAHRGAENGE.jahrgang2.id, can_view: true }]
      });
      expect(eineGemeinde).toBe(2);
      expect(await push(USERS.admin2)).toBe(2);
      expect(await pushAnViele(USERS.admin2)).toBe(2);
      expect(await hintergrund(USERS.admin2)).toBe(2);
      expect(await umschalter('admin2')).toEqual({ jeOrg: { 2: 2 }, summe: 2 });
    });
  });
});
