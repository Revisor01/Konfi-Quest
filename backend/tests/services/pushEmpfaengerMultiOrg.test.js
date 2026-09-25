// backend/tests/services/pushEmpfaengerMultiOrg.test.js
//
// Befund 25.09.2026, in Produktion gemessen: Push-Benachrichtigungen an die
// Leitung erreichten nur die Stamm-Organisation. Nutzer 41 (Stamm-Org 1,
// org_admin in 1, 2 und 4 laut user_organizations) bekam aus Organisation 4
// nichts -- die App zeigte ihm die Gemeinde, der Payload trug schon die
// organization_id des Inhalts fuer den Org-Wechsel beim Antippen, nur die
// Empfaengerabfrage fragte `u.organization_id = $1`.
//
// Getestet wird gegen die echte Test-DB, Firebase ist gemockt. Die
// Assertions pruefen auf die KONKRETE Empfaengerliste (sortierte Tokens),
// nicht auf "enthaelt" allein -- sonst faellt nicht auf, wenn jemand
// dazukommt, der nichts bekommen soll (der Text nennt Namen von Konfis).
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES, JAHRGAENGE } = require('../helpers/seed');

const firebase = require('../../push/firebase');
const sendFirebasePushNotification = vi
  .spyOn(firebase, 'sendFirebasePushNotification')
  .mockResolvedValue({ success: true });
vi.spyOn(firebase, 'sendFirebaseSilentPush').mockResolvedValue({ success: true });

const PushService = require('../../services/pushService');

const gesendete = () => sendFirebasePushNotification.mock.calls.map(
  ([token, payload]) => ({ token, data: payload.data })
);
const tokens = () => gesendete().map(p => p.token).sort();

const zusatz = (db, userId, orgId, roleId) => db.query(
  'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
  [userId, orgId, roleId]
);

const ORG2 = ORGS.andereGemeinde.id;
const CHALLENGE_ORG2 = 7;

describe('Push-Empfaenger bei mehreren Organisationen', () => {
  let db;

  beforeAll(() => { db = getTestPool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    const geraete = [
      [USERS.teamer1.id, 'token-teamer1'],
      [USERS.admin1.id, 'token-admin1'],
      [USERS.orgAdmin1.id, 'token-orgadmin1'],
      [USERS.teamer2.id, 'token-teamer2'],
      [USERS.admin2.id, 'token-admin2'],
      [USERS.orgAdmin2.id, 'token-orgadmin2'],
    ];
    for (const [userId, token] of geraete) {
      await db.query(
        `INSERT INTO push_tokens (user_id, token, platform, device_id) VALUES ($1, $2, 'ios', $3)`,
        [userId, token, `dev-${token}`]
      );
    }
    // Eine Challenge in Org 2 fuer Jahrgang 2.
    await db.query(`
      INSERT INTO challenges (id, organization_id, title, description, badge_name, starts_at, ends_at, is_draft)
      VALUES ($1, $2, 'Challenge Org 2', 'Beschreibung', 'Abzeichen', NOW() - interval '1 day', NOW() + interval '7 days', false)
    `, [CHALLENGE_ORG2, ORG2]);
    await db.query(
      'INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id) VALUES ($1, $2)',
      [CHALLENGE_ORG2, JAHRGAENGE.jahrgang2.id]
    );
    sendFirebasePushNotification.mockClear();
  });

  afterAll(async () => { await closePool(); });

  describe('Leitungs-Push in der Zusatz-Organisation', () => {
    it('erlaubt: org_admin der Zusatz-Organisation bekommt den Challenge-Push -- mit der Org des Inhalts im Payload', async () => {
      await zusatz(db, USERS.orgAdmin1.id, ORG2, ROLES.orgAdmin2.id);

      await PushService.sendChallengeSubmissionToLeadership(db, ORG2, CHALLENGE_ORG2, 'Challenge Org 2', 'Emilia', true);

      // Leitung Org 2 + orgAdmin1 (Zusatz) + teamer2 (Seed-Zuweisung auf Jahrgang 2).
      expect(tokens()).toEqual(['token-admin2', 'token-orgadmin1', 'token-orgadmin2', 'token-teamer2']);
      // Der Tap muss in Org 2 wechseln, nicht in die Stamm-Org 1 des Empfaengers.
      const anOrgAdmin1 = gesendete().find(p => p.token === 'token-orgadmin1');
      expect(anOrgAdmin1.data.organization_id).toBe(String(ORG2));
      expect(anOrgAdmin1.data.type).toBe('challenge_submission');
    });

    it('verboten: ohne Zugehoerigkeit zu Org 2 bekommt admin1 nichts', async () => {
      await PushService.sendChallengeSubmissionToLeadership(db, ORG2, CHALLENGE_ORG2, 'Challenge Org 2', 'Emilia', true);
      expect(tokens()).toEqual(['token-admin2', 'token-orgadmin2', 'token-teamer2']);
    });

    it('verboten: wer in Org 2 nur Teamer:in ist, bekommt den Leitungs-Push dort NICHT', async () => {
      // orgAdmin1 ist zuhause org_admin, in Org 2 aber nur Teamer:in (ohne
      // Jahrgangs-Zuweisung). Die Rolle gilt je Organisation.
      await zusatz(db, USERS.orgAdmin1.id, ORG2, ROLES.teamer2.id);

      await PushService.sendEventOptOutToAdmins(db, ORG2, 'Emilia', 'Gemeindeabend', 'krank');
      expect(tokens()).toEqual(['token-admin2', 'token-orgadmin2']);
    });

    it('sendToOrgAdmins (Teamer-Buchung, -Absage, Challenge): erreicht die Zusatz-Leitung', async () => {
      await zusatz(db, USERS.orgAdmin1.id, ORG2, ROLES.orgAdmin2.id);
      await PushService.sendTeamerEventBookingToAdmins(db, ORG2, 'Team-Person', 'Gemeindeabend', 'confirmed', 4);
      expect(tokens()).toEqual(['token-admin2', 'token-orgadmin1', 'token-orgadmin2']);
      expect(gesendete().find(p => p.token === 'token-orgadmin1').data.organization_id).toBe(String(ORG2));
    });

    it('alle uebrigen Leitungs-Meldungen erreichen die Zusatz-Leitung ebenfalls', async () => {
      await zusatz(db, USERS.orgAdmin1.id, ORG2, ROLES.orgAdmin2.id);
      const erwartet = ['token-admin2', 'token-orgadmin1', 'token-orgadmin2'];

      const faelle = [
        ['sendNewActivityRequestToAdmins', () => PushService.sendNewActivityRequestToAdmins(db, ORG2, 'Emilia', 'Gottesdienst', 2)],
        ['sendEventUnregistrationToAdmins', () => PushService.sendEventUnregistrationToAdmins(db, ORG2, 'Emilia', 'Gemeindeabend')],
        ['sendEventsPendingApprovalToAdmins', () => PushService.sendEventsPendingApprovalToAdmins(db, ORG2, 2)],
        ['sendJahrgangDeletionWarningToAdmins', () => PushService.sendJahrgangDeletionWarningToAdmins(db, ORG2, '2025/2026', 3)],
        ['sendEventOptInToAdmins', () => PushService.sendEventOptInToAdmins(db, ORG2, 'Emilia', 'Gemeindeabend')],
        ['sendTeamerEventCancellationToAdmins', () => PushService.sendTeamerEventCancellationToAdmins(db, ORG2, 'Team-Person', 'Gemeindeabend', 4)],
      ];
      for (const [name, senden] of faelle) {
        sendFirebasePushNotification.mockClear();
        await senden();
        expect(tokens(), name).toEqual(erwartet);
        for (const p of gesendete()) {
          expect(p.data.organization_id, name).toBe(String(ORG2));
        }
      }
    });
  });

  describe('Jahrgangs-Admins bei neuer Registrierung', () => {
    it('erlaubt: Zusatz-org_admin mit Zuweisung auf den Jahrgang ist der einzige Jahrgangs-Admin', async () => {
      await zusatz(db, USERS.orgAdmin1.id, ORG2, ROLES.orgAdmin2.id);
      await db.query(
        'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id) VALUES ($1, $2)',
        [USERS.orgAdmin1.id, JAHRGAENGE.jahrgang2.id]
      );
      await PushService.sendNewKonfiRegistrationToAdmins(db, ORG2, JAHRGAENGE.jahrgang2.id, 'Emilia', '2025/2026');
      expect(tokens()).toEqual(['token-orgadmin1']);
      expect(gesendete()[0].data.organization_id).toBe(String(ORG2));
    });

    it('ohne Jahrgangs-Admin greift der Rueckfall auf die ganze Leitung -- samt Zusatz-Leitung', async () => {
      await zusatz(db, USERS.orgAdmin1.id, ORG2, ROLES.orgAdmin2.id);
      await PushService.sendNewKonfiRegistrationToAdmins(db, ORG2, JAHRGAENGE.jahrgang2.id, 'Emilia', '2025/2026');
      expect(tokens()).toEqual(['token-admin2', 'token-orgadmin1', 'token-orgadmin2']);
    });
  });

  describe('Teamer:innen der Challenge-Jahrgaenge', () => {
    it('erlaubt: Teamer:in nur ueber user_organizations in Org 2, dem Jahrgang zugewiesen -> bekommt den Beitrags-Push', async () => {
      await zusatz(db, USERS.teamer1.id, ORG2, ROLES.teamer2.id);
      await db.query(
        'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id) VALUES ($1, $2)',
        [USERS.teamer1.id, JAHRGAENGE.jahrgang2.id]
      );
      await PushService.sendChallengeSubmissionToLeadership(db, ORG2, CHALLENGE_ORG2, 'Challenge Org 2', 'Emilia', false);
      // Leitung Org 2 + teamer2 (Seed-Zuweisung auf Jahrgang 2) + teamer1.
      expect(tokens()).toEqual(['token-admin2', 'token-orgadmin2', 'token-teamer1', 'token-teamer2']);
    });

    it('verboten: Zuweisung auf den Jahrgang OHNE Zugehoerigkeit zu Org 2 reicht nicht', async () => {
      await db.query(
        'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id) VALUES ($1, $2)',
        [USERS.teamer1.id, JAHRGAENGE.jahrgang2.id]
      );
      await PushService.sendChallengeSubmissionToLeadership(db, ORG2, CHALLENGE_ORG2, 'Challenge Org 2', 'Emilia', false);
      expect(tokens()).toEqual(['token-admin2', 'token-orgadmin2', 'token-teamer2']);
    });
  });

  describe('Simons Konstellation (Nutzer 41)', () => {
    it('Stamm-Org 1, org_admin laut user_organizations auch in 1 und 2: Leitungs-Push aus Org 2 kommt an, aus Org 1 genau einmal', async () => {
      // Migration 101 hat fuer jeden Nutzer auch die Stamm-Org in
      // user_organizations angelegt -- so sieht das Konto in Produktion aus.
      await zusatz(db, USERS.orgAdmin1.id, ORGS.testGemeinde.id, ROLES.orgAdmin.id);
      await zusatz(db, USERS.orgAdmin1.id, ORG2, ROLES.orgAdmin2.id);

      await PushService.sendChallengeSubmissionToLeadership(db, ORG2, CHALLENGE_ORG2, 'Challenge Org 2', 'Emilia', true);
      expect(tokens()).toEqual(['token-admin2', 'token-orgadmin1', 'token-orgadmin2', 'token-teamer2']);

      sendFirebasePushNotification.mockClear();
      await PushService.sendEventOptOutToAdmins(db, ORGS.testGemeinde.id, 'Konfi', 'Termin', 'krank');
      // Genau einmal, nicht doppelt (orgAdminSuper hat kein Geraet).
      expect(tokens()).toEqual(['token-admin1', 'token-orgadmin1']);
    });
  });
});
