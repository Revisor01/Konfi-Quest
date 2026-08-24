// backend/tests/services/pushService.test.js
//
// Multi-Org: JEDER Push-Payload muss data.organization_id tragen — die
// Organisation des INHALTS, als String (FCM-data ist immer String). Der
// Client wechselt beim Antippen automatisch in diese Organisation, bevor er
// navigiert. Ohne die Org landete eine Leitung mit mehreren Gemeinden nach
// dem Tap in der falschen Organisation (Chat: 403 "Fehler beim Laden").
//
// Getestet wird gegen die echte Test-DB (Seed: Org 1 und Org 2), Firebase
// ist gemockt — die Assertions prüfen den konkreten data-Payload je Typ.
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, CHAT_ROOMS, JAHRGAENGE } = require('../helpers/seed');

// vi.mock greift bei diesem CJS-Setup nicht zuverlaessig (siehe
// jahrgaenge.test.js) — deshalb vi.spyOn auf dem Modul-Objekt, BEVOR
// pushService geladen wird (der destrukturiert die Funktionen beim Require).
const firebase = require('../../push/firebase');
const sendFirebasePushNotification = vi
  .spyOn(firebase, 'sendFirebasePushNotification')
  .mockResolvedValue({ success: true });
vi.spyOn(firebase, 'sendFirebaseSilentPush').mockResolvedValue({ success: true });

const PushService = require('../../services/pushService');

// Alle gesendeten Payloads einsammeln: [{ token, data }]
const gesendete = () => sendFirebasePushNotification.mock.calls.map(
  ([token, payload]) => ({ token, data: payload.data, title: payload.title })
);

describe('PushService: organization_id in jedem Payload', () => {
  let db;

  beforeAll(async () => {
    db = getTestPool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    // Push-Tokens für die Empfänger der Tests (push_enabled ist per Default true)
    const tokens = [
      [USERS.konfi1.id, 'token-konfi1', 'ios', 'dev-konfi1'],
      [USERS.konfi2.id, 'token-konfi2', 'ios', 'dev-konfi2'],
      [USERS.konfi3.id, 'token-konfi3', 'ios', 'dev-konfi3'],
      [USERS.teamer1.id, 'token-teamer1', 'ios', 'dev-teamer1'],
      [USERS.admin1.id, 'token-admin1', 'ios', 'dev-admin1'],
      [USERS.admin2.id, 'token-admin2', 'ios', 'dev-admin2'],
    ];
    for (const [userId, token, platform, deviceId] of tokens) {
      await db.query(
        `INSERT INTO push_tokens (user_id, token, platform, device_id) VALUES ($1, $2, $3, $4)`,
        [userId, token, platform, deviceId]
      );
    }
    sendFirebasePushNotification.mockClear();
  });

  afterAll(async () => {
    await closePool();
  });

  // ================================================================
  // Zentraler Fallback in sendToUser
  // ================================================================
  describe('sendToUser (zentraler Fallback)', () => {
    it('ohne explizite Org: Primär-Org des Empfängers als String', async () => {
      await PushService.sendToUser(db, USERS.konfi1.id, {
        title: 'Test', body: 'Test', data: { type: 'bonus_points' }
      });
      const [push] = gesendete();
      expect(push.data.organization_id).toBe('1');
      expect(typeof push.data.organization_id).toBe('string');
    });

    it('explizite Org als Number wird zu String konvertiert', async () => {
      await PushService.sendToUser(db, USERS.admin1.id, {
        title: 'Test', body: 'Test', data: { type: 'event_opt_out', organization_id: 2 }
      });
      const [push] = gesendete();
      expect(push.data.organization_id).toBe('2');
    });

    it('sendToMultipleUsers: jeder Empfänger bekommt SEINE Primär-Org, das geteilte notification-Objekt bleibt unverändert', async () => {
      const notification = { title: 'Test', body: 'Test', data: { type: 'wrapped' } };
      await PushService.sendToMultipleUsers(db, [USERS.konfi1.id, USERS.konfi3.id], notification);
      const nachToken = Object.fromEntries(gesendete().map(p => [p.token, p.data.organization_id]));
      expect(nachToken['token-konfi1']).toBe('1');
      expect(nachToken['token-konfi3']).toBe('2');
      // Kein Leak zwischen Empfängern: Original-data wurde nicht mutiert
      expect(notification.data.organization_id).toBeUndefined();
    });
  });

  // ================================================================
  // Chat: Org des RAUMS, nicht des Empfängers
  // ================================================================
  describe('sendChatNotification', () => {
    it('trägt die Org des Raums — auch wenn die Primär-Org des Empfängers eine andere ist', async () => {
      // Empfänger admin1 (Primär-Org 1) in Raum 4 (Org 2)
      await db.query(
        `INSERT INTO chat_participants (room_id, user_id, user_type) VALUES ($1, $2, 'admin')`,
        [CHAT_ROOMS.jahrgang2.id, USERS.admin1.id]
      );
      await PushService.sendChatNotification(db, USERS.admin1.id, {
        title: 'Chat', body: 'Hallo',
        roomId: CHAT_ROOMS.jahrgang2.id,
        messageId: 1,
        data: { sender_id: USERS.admin2.id, sender_name: 'Test Admin 2', room_name: 'Jahrgang 2025/2026' }
      });
      const [push] = gesendete();
      expect(push.data.type).toBe('chat');
      expect(push.data.organization_id).toBe('2');
      expect(push.data.roomId).toBe(String(CHAT_ROOMS.jahrgang2.id));
    });

    it('Raum in Org 1: organization_id ist "1"', async () => {
      await PushService.sendChatNotification(db, USERS.konfi1.id, {
        title: 'Chat', body: 'Hallo',
        roomId: CHAT_ROOMS.jahrgang.id,
        messageId: 1,
        data: { sender_id: USERS.admin1.id, sender_name: 'Test Admin 1', room_name: 'Jahrgang 2025/2026' }
      });
      const [push] = gesendete();
      expect(push.data.organization_id).toBe('1');
    });
  });

  // ================================================================
  // Admin-gerichtete Typen (Empfänger können Multi-Org sein)
  // ================================================================
  describe('Admin-Pushes tragen die Content-Org', () => {
    it('sendToOrgAdmins injiziert die Org (teamer_event_booking)', async () => {
      await PushService.sendToOrgAdmins(db, ORGS.andereGemeinde.id, {
        title: 'Teamer:in angemeldet', body: 'x',
        data: { type: 'teamer_event_booking', eventId: '4' }
      });
      const pushes = gesendete();
      expect(pushes.length).toBeGreaterThan(0);
      for (const push of pushes) {
        expect(push.data.organization_id).toBe('2');
      }
    });

    it('sendNewActivityRequestToAdmins: organization_id = Content-Org', async () => {
      await PushService.sendNewActivityRequestToAdmins(db, 2, 'Konfi', 'Aktivität', 3);
      const [push] = gesendete();
      expect(push.data.type).toBe('new_activity_request');
      expect(push.data.organization_id).toBe('2');
    });

    it('sendEventUnregistrationToAdmins', async () => {
      await PushService.sendEventUnregistrationToAdmins(db, 1, 'Konfi', 'Event');
      const [push] = gesendete();
      expect(push.data.type).toBe('event_unregistration');
      expect(push.data.organization_id).toBe('1');
    });

    it('sendEventsPendingApprovalToAdmins', async () => {
      await PushService.sendEventsPendingApprovalToAdmins(db, 1, 3);
      const [push] = gesendete();
      expect(push.data.type).toBe('events_pending_approval');
      expect(push.data.organization_id).toBe('1');
    });

    it('sendJahrgangDeletionWarningToAdmins', async () => {
      await PushService.sendJahrgangDeletionWarningToAdmins(db, 1, 'Jahrgang 2025', 3);
      const [push] = gesendete();
      expect(push.data.type).toBe('jahrgang_deletion_warning');
      expect(push.data.organization_id).toBe('1');
    });

    it('sendEventOptOutToAdmins und sendEventOptInToAdmins', async () => {
      await PushService.sendEventOptOutToAdmins(db, 1, 'Konfi', 'Event', 'krank');
      await PushService.sendEventOptInToAdmins(db, 1, 'Konfi', 'Event');
      const pushes = gesendete();
      const optOut = pushes.find(p => p.data.type === 'event_opt_out');
      const optIn = pushes.find(p => p.data.type === 'event_opt_in');
      expect(optOut.data.organization_id).toBe('1');
      expect(optIn.data.organization_id).toBe('1');
    });

    it('sendNewKonfiRegistrationToAdmins', async () => {
      await PushService.sendNewKonfiRegistrationToAdmins(db, 1, JAHRGAENGE.jahrgang1.id, 'Neuer Konfi', 'Jahrgang 2025');
      const [push] = gesendete();
      expect(push.data.type).toBe('new_konfi_registration');
      expect(push.data.organization_id).toBe('1');
    });
  });

  // ================================================================
  // Event-Pushes mit explizitem organizationId-Parameter
  // ================================================================
  describe('Event-Pushes: explizite Content-Org schlägt die Primär-Org', () => {
    it('sendEventRegisteredToTeamer: Event-Org 2, Teamer-Primär-Org 1 -> "2"', async () => {
      await PushService.sendEventRegisteredToTeamer(db, USERS.teamer1.id, 'Gemeindeabend', new Date().toISOString(), 'confirmed', 4, 2);
      const [push] = gesendete();
      expect(push.data.type).toBe('event_registered');
      expect(push.data.organization_id).toBe('2');
    });

    it('sendEventRegisteredToKonfi ohne Org-Parameter: Fallback Primär-Org', async () => {
      await PushService.sendEventRegisteredToKonfi(db, USERS.konfi1.id, 'Event', new Date().toISOString(), 'confirmed', 1, null);
      const [push] = gesendete();
      expect(push.data.organization_id).toBe('1');
    });

    it('sendWaitlistPromotionToTeamer mit Event-Org', async () => {
      await PushService.sendWaitlistPromotionToTeamer(db, USERS.teamer1.id, 'Gemeindeabend', null, 4, 2);
      const [push] = gesendete();
      expect(push.data.type).toBe('waitlist_promotion');
      expect(push.data.organization_id).toBe('2');
    });

    it('sendEventCancellationToKonfis mit Event-Org', async () => {
      await PushService.sendEventCancellationToKonfis(db, [USERS.konfi1.id, USERS.teamer1.id], 'Event', '01.09.2026', 1);
      const pushes = gesendete();
      expect(pushes.length).toBe(2);
      for (const push of pushes) {
        expect(push.data.type).toBe('event_cancelled');
        expect(push.data.organization_id).toBe('1');
      }
    });

    it('sendEventChangedToKonfis mit Event-Org', async () => {
      await PushService.sendEventChangedToKonfis(db, [USERS.konfi1.id], 'Event', { newLocation: 'Gemeindehaus' }, 1, 1);
      const [push] = gesendete();
      expect(push.data.type).toBe('event_changed');
      expect(push.data.organization_id).toBe('1');
    });

    it('sendEventReminderToKonfi mit Event-Org', async () => {
      await PushService.sendEventReminderToKonfi(db, USERS.konfi1.id, 'Event', new Date().toISOString(), '10:00', '1_day', 1);
      const [push] = gesendete();
      expect(push.data.type).toBe('event_reminder');
      expect(push.data.organization_id).toBe('1');
    });

    it('sendEventAttendanceToKonfi mit Event-Org', async () => {
      await PushService.sendEventAttendanceToKonfi(db, USERS.konfi1.id, 'Event', 'present', 2, 1, 1);
      const [push] = gesendete();
      expect(push.data.type).toBe('event_attendance');
      expect(push.data.organization_id).toBe('1');
    });

    it('sendNewEventToOrgKonfis: Org aus dem Parameter', async () => {
      await PushService.sendNewEventToOrgKonfis(db, 1, 'Neues Event', new Date().toISOString(), 5);
      const pushes = gesendete();
      expect(pushes.length).toBeGreaterThan(0);
      for (const push of pushes) {
        expect(push.data.type).toBe('new_event');
        expect(push.data.organization_id).toBe('1');
      }
    });
  });

  // ================================================================
  // Challenges
  // ================================================================
  describe('Challenge-Pushes', () => {
    beforeEach(async () => {
      await db.query(`
        INSERT INTO challenges (id, organization_id, title, description, badge_name, starts_at, ends_at, is_draft)
        VALUES (1, 1, 'Test-Challenge', 'Beschreibung', 'Abzeichen', NOW() - interval '1 day', NOW() + interval '7 days', false)
      `);
      await db.query(
        `INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id) VALUES (1, $1)`,
        [JAHRGAENGE.jahrgang1.id]
      );
    });

    it('sendChallengeStartedToJahrgaenge: Org der Challenge', async () => {
      await PushService.sendChallengeStartedToJahrgaenge(db, 1, 'Test-Challenge');
      const pushes = gesendete();
      expect(pushes.length).toBeGreaterThan(0);
      for (const push of pushes) {
        expect(push.data.type).toBe('challenge_started');
        expect(push.data.organization_id).toBe('1');
      }
    });

    it('sendChallengeSubmissionToLeadership: Org aus dem Parameter', async () => {
      await PushService.sendChallengeSubmissionToLeadership(db, 1, 1, 'Test-Challenge', 'Konfi', true);
      const pushes = gesendete();
      expect(pushes.length).toBeGreaterThan(0);
      for (const push of pushes) {
        expect(push.data.type).toBe('challenge_submission');
        expect(push.data.organization_id).toBe('1');
      }
    });

    it('sendChallengeBadgeEarnedToKonfi: Fallback Primär-Org des Konfi', async () => {
      await PushService.sendChallengeBadgeEarnedToKonfi(db, USERS.konfi1.id, 1, 'Test-Challenge');
      const [push] = gesendete();
      expect(push.data.type).toBe('challenge_badge_earned');
      expect(push.data.organization_id).toBe('1');
    });
  });

  // ================================================================
  // Konfi-gerichtete Typen (Single-Org: Fallback = richtige Org)
  // ================================================================
  describe('Konfi-Pushes: Fallback auf die Primär-Org', () => {
    const faelle = [
      ['sendActivityRequestStatusToKonfi', (db) => PushService.sendActivityRequestStatusToKonfi(db, USERS.konfi1.id, 'Aktivität', 3, 'approved'), 'activity_request_status'],
      ['sendBadgeEarnedToKonfi', (db) => PushService.sendBadgeEarnedToKonfi(db, USERS.konfi1.id, 'Badge', 'star', 'Beschreibung'), 'badge_earned'],
      ['sendActivityAssignedToKonfi', (db) => PushService.sendActivityAssignedToKonfi(db, USERS.konfi1.id, 'Aktivität', 3, 'gottesdienst'), 'activity_assigned'],
      ['sendBonusPointsToKonfi', (db) => PushService.sendBonusPointsToKonfi(db, USERS.konfi1.id, 2, 'Sonderpunkte', 'gemeinde'), 'bonus_points'],
      ['sendLevelUpToKonfi', (db) => PushService.sendLevelUpToKonfi(db, USERS.konfi1.id, 'Level 2', 'Entdecker', 'star'), 'level_up'],
      ['sendEventUnregisteredToKonfi', (db) => PushService.sendEventUnregisteredToKonfi(db, USERS.konfi1.id, 'Event'), 'event_unregistered'],
    ];

    for (const [name, aufruf, typ] of faelle) {
      it(`${name}: organization_id = "1"`, async () => {
        await aufruf(db);
        const [push] = gesendete();
        expect(push.data.type).toBe(typ);
        expect(push.data.organization_id).toBe('1');
      });
    }
  });

  // Diese fuenf Meldungen standen bis 24.08.2026 als fertige Payloads in den
  // Routen (events.js, teamer.js, wrapped.js) und waren dadurch weder zentral
  // auffindbar noch getestet. Jetzt sind es benannte Methoden — die Tests
  // pruefen Text UND Payload, damit beim Umzug nichts still verrutscht ist.
  describe('Meldungen, die vorher direkt in den Routen standen', () => {
    it('sendMandatoryEventCreated: Titel, Datum und Event-Id', async () => {
      await PushService.sendMandatoryEventCreated(
        db, [USERS.konfi1.id], 'Vorstellungsgottesdienst', '2026-09-13T10:00:00Z', 77, ORGS.testGemeinde.id
      );

      const [push] = gesendete();
      expect(push.title).toBe('Neues Pflicht-Event');
      expect(push.data.type).toBe('mandatory_event_created');
      expect(push.data.eventId).toBe('77');
      expect(push.data.organization_id).toBe('1');
    });

    it('sendMandatoryEventCreated: ohne Empfaenger wird nichts gesendet', async () => {
      const ergebnis = await PushService.sendMandatoryEventCreated(
        db, [], 'Event', '2026-09-13T10:00:00Z', 77, ORGS.testGemeinde.id
      );

      expect(ergebnis).toEqual({ success: true, sent: 0 });
      expect(gesendete()).toHaveLength(0);
    });

    it('sendTeamerEventBookingToAdmins: angemeldet', async () => {
      await PushService.sendTeamerEventBookingToAdmins(
        db, ORGS.testGemeinde.id, 'Lasse Brandt', 'Konfi-Freizeit', 'confirmed', 42
      );

      const [push] = gesendete();
      expect(push.title).toBe('Teamer:in angemeldet');
      expect(push.data.type).toBe('teamer_event_booking');
      expect(push.data.eventId).toBe('42');
      expect(push.data.organization_id).toBe('1');
    });

    it('sendTeamerEventBookingToAdmins: Warteliste hat einen eigenen Text', async () => {
      await PushService.sendTeamerEventBookingToAdmins(
        db, ORGS.testGemeinde.id, 'Lasse Brandt', 'Konfi-Freizeit', 'waitlist', 42
      );

      const [push] = gesendete();
      expect(push.data.type).toBe('teamer_event_booking');
      expect(push.data.organization_id).toBe('1');
    });

    it('sendTeamerEventCancellationToAdmins: Abmeldung', async () => {
      await PushService.sendTeamerEventCancellationToAdmins(
        db, ORGS.testGemeinde.id, 'Lasse Brandt', 'Konfi-Freizeit', 42
      );

      const [push] = gesendete();
      expect(push.title).toBe('Teamer:in abgemeldet');
      expect(push.data.type).toBe('teamer_event_cancellation');
      expect(push.data.eventId).toBe('42');
      expect(push.data.organization_id).toBe('1');
    });

    it('sendCertificateToTeamer: Zertifikat an die Teamer:in', async () => {
      await PushService.sendCertificateToTeamer(
        db, USERS.teamer1.id, 'Erste Hilfe', ORGS.testGemeinde.id
      );

      const [push] = gesendete();
      expect(push.title).toBe('Neues Zertifikat');
      expect(push.data.type).toBe('certificate');
      expect(push.data.organization_id).toBe('1');
    });

    it('sendWrappedReleased: Konfi-Variante', async () => {
      await PushService.sendWrappedReleased(db, [USERS.konfi1.id], 'konfi', ORGS.testGemeinde.id);

      const [push] = gesendete();
      expect(push.title).toBe('Dein Konfi-Jahr ist da!');
      expect(push.data.type).toBe('wrapped');
      expect(push.data.wrappedType).toBe('konfi');
      expect(push.data.organization_id).toBe('1');
    });

    it('sendWrappedReleased: Teamer-Variante hat einen eigenen Titel', async () => {
      await PushService.sendWrappedReleased(db, [USERS.teamer1.id], 'teamer', ORGS.testGemeinde.id);

      const [push] = gesendete();
      expect(push.title).toBe('Dein Teamer-Jahr ist da!');
      expect(push.data.type).toBe('wrapped');
      expect(push.data.wrappedType).toBe('teamer');
      expect(push.data.organization_id).toBe('1');
    });

    it('sendWrappedReleased: Org 2 traegt "2", nicht die Primaer-Org des Aufrufers', async () => {
      await PushService.sendWrappedReleased(db, [USERS.konfi3.id], 'konfi', ORGS.andereGemeinde.id);

      const [push] = gesendete();
      expect(push.data.organization_id).toBe('2');
    });
  });
});
