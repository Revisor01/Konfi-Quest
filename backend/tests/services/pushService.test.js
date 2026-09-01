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
  ([token, payload]) => ({ token, data: payload.data, title: payload.title, body: payload.body })
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

    // Befund M5 (Push-Bericht 27.08.2026), gemessen: Die Empfaengerabfrage
    // filterte weder `deleted_at` noch `is_active`. Die Jahrgangs-
    // Archivierung setzt bei Konfis 60-120 Tage nach der Konfirmation nur
    // `deleted_at` und loescht keine Push-Tokens — ausgeschiedene Konten
    // bekamen bis zur 30-Tage-Token-Bereinigung weiter "Neues Event!" einer
    // Gemeinde, aus der sie laengst raus sind.
    it('M5: archivierte Konfis bekommen keinen new_event-Push mehr', async () => {
      const vorher = await (async () => {
        await PushService.sendNewEventToOrgKonfis(db, 1, 'Termin A', new Date().toISOString(), 5);
        const n = gesendete().length;
        sendFirebasePushNotification.mockClear();
        return n;
      })();
      // Erlaubter Fall: beide aktiven Konfis der Org 1 bekommen den Push
      // (konfi1 und konfi2; konfi3 gehoert zu Org 2, siehe seed.js).
      expect(vorher).toBe(2);

      // Verbotener Fall: ein archivierter Konfi faellt raus, obwohl sein
      // Token noch existiert.
      await db.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [USERS.konfi1.id]);
      await PushService.sendNewEventToOrgKonfis(db, 1, 'Termin B', new Date().toISOString(), 6);
      expect(gesendete().length).toBe(1);
      expect(gesendete().map(p => p.token)).not.toContain('token-konfi1');
      sendFirebasePushNotification.mockClear();

      // Dasselbe fuer ein deaktiviertes Konto.
      await db.query('UPDATE users SET deleted_at = NULL, is_active = false WHERE id = $1', [USERS.konfi1.id]);
      await PushService.sendNewEventToOrgKonfis(db, 1, 'Termin C', new Date().toISOString(), 7);
      expect(gesendete().length).toBe(1);
      expect(gesendete().map(p => p.token)).not.toContain('token-konfi1');
    });
  });

  // ================================================================
  // Zustellung haelt den Token am Leben (28.08.2026)
  //
  // Die Bereinigung entfernt Tokens, die 30 Tage nicht aktualisiert wurden.
  // Aktualisiert wurden sie vorher nur beim Oeffnen der App — wer ueber die
  // Ferien pausierte, verlor die Zustellung stillschweigend, obwohl sein
  // Geraet die ganze Zeit erreichbar war.
  // ================================================================
  describe('Token-Zeitstempel', () => {
    const alterStempel = async (userId) => {
      await db.query(
        "UPDATE push_tokens SET updated_at = NOW() - INTERVAL '25 days' WHERE user_id = $1",
        [userId]
      );
      const { rows: [row] } = await db.query(
        'SELECT updated_at FROM push_tokens WHERE user_id = $1', [userId]
      );
      return row.updated_at;
    };

    it('Ein zugestellter Push frischt updated_at auf', async () => {
      const vorher = await alterStempel(USERS.admin1.id);

      await PushService.sendToOrgAdmins(db, ORGS.testGemeinde.id, {
        title: 'Neu', body: 'Etwas ist passiert', data: { type: 'test' },
      });

      const { rows: [row] } = await db.query(
        'SELECT updated_at FROM push_tokens WHERE user_id = $1', [USERS.admin1.id]
      );
      expect(row.updated_at.getTime()).toBeGreaterThan(vorher.getTime());

      // Und damit ueberlebt der Token die Bereinigung.
      const { rowCount } = await db.query(
        "DELETE FROM push_tokens WHERE updated_at < NOW() - INTERVAL '30 days' AND user_id = $1",
        [USERS.admin1.id]
      );
      expect(rowCount).toBe(0);
    });

    it('Ohne Zustellung bleibt der Stempel alt — der Fall, den die Bereinigung meint', async () => {
      const vorher = await alterStempel(USERS.admin2.id);

      // Push geht an Org 1; admin2 gehoert zu Org 2 und bekommt nichts.
      await PushService.sendToOrgAdmins(db, ORGS.testGemeinde.id, {
        title: 'Neu', body: 'Etwas ist passiert', data: { type: 'test' },
      });

      const { rows: [row] } = await db.query(
        'SELECT updated_at FROM push_tokens WHERE user_id = $1', [USERS.admin2.id]
      );
      expect(row.updated_at.getTime()).toBe(vorher.getTime());
    });

    it('Erfolgreiche Zustellung setzt den Fehlerzaehler zurueck', async () => {
      await db.query(
        'UPDATE push_tokens SET error_count = 3, last_error_at = NOW() WHERE user_id = $1',
        [USERS.admin1.id]
      );

      await PushService.sendToOrgAdmins(db, ORGS.testGemeinde.id, {
        title: 'Neu', body: 'Etwas ist passiert', data: { type: 'test' },
      });

      const { rows: [row] } = await db.query(
        'SELECT error_count, last_error_at FROM push_tokens WHERE user_id = $1', [USERS.admin1.id]
      );
      expect(row.error_count).toBe(0);
      expect(row.last_error_at).toBeNull();
    });
  });

  // ================================================================
  // Von FCM abgelehnte Tokens werden beim Versand entsorgt (31.08.2026)
  //
  // Der Weg, auf dem ein Token ueberhaupt ungueltig wird, ist fast nie das
  // bewusste Abmelden — es ist die abgelaufene Sitzung, die deinstallierte App
  // oder das zurueckgesetzte Geraet. In all diesen Faellen ruft niemand mehr
  // DELETE /notifications/device-token, und der Eintrag bliebe stehen. Was ihn
  // entfernt, ist die Rueckmeldung von FCM beim naechsten Versand:
  // 'registration-token-not-registered'. Diese Auswertung existiert in
  // sendToUser, war aber ungetestet — ein stiller Pfad, an dem eine falsche
  // Bedingung niemandem aufgefallen waere.
  // ================================================================
  describe('Ungueltige Tokens beim Versand', () => {
    const tokenZeile = (userId) => db.query(
      'SELECT id, error_count FROM push_tokens WHERE user_id = $1', [userId]
    ).then(({ rows }) => rows[0] || null);

    afterEach(() => {
      // Der Default aus dem Modul-Setup gilt wieder fuer alle uebrigen Tests.
      // mockReset raeumt auch eine gesetzte mockImplementation weg — ohne das
      // wuerde sie in die folgenden Suiten durchschlagen. Hier statt im
      // Test-Rumpf, damit es auch nach einer fehlgeschlagenen Assertion laeuft.
      sendFirebasePushNotification.mockReset();
      sendFirebasePushNotification.mockResolvedValue({ success: true });
    });

    it("'registration-token-not-registered' loescht den Token", async () => {
      expect(await tokenZeile(USERS.konfi1.id)).not.toBeNull();

      sendFirebasePushNotification.mockResolvedValue({
        success: false,
        error: 'Requested entity was not found.',
        errorCode: 'messaging/registration-token-not-registered'
      });

      const ergebnis = await PushService.sendToUser(db, USERS.konfi1.id, {
        title: 'Test', body: 'Test', data: { type: 'bonus_points' }
      });

      expect(ergebnis.sent).toBe(0);
      expect(ergebnis.errors).toBe(1);
      expect(await tokenZeile(USERS.konfi1.id)).toBeNull();
    });

    it("'invalid-registration-token' loescht den Token ebenfalls", async () => {
      sendFirebasePushNotification.mockResolvedValue({
        success: false,
        error: 'The registration token is not a valid FCM registration token.',
        errorCode: 'messaging/invalid-registration-token'
      });

      await PushService.sendToUser(db, USERS.konfi1.id, {
        title: 'Test', body: 'Test', data: { type: 'bonus_points' }
      });

      expect(await tokenZeile(USERS.konfi1.id)).toBeNull();
    });

    it('Ein voruebergehender Fehler behaelt den Token und zaehlt hoch', async () => {
      sendFirebasePushNotification.mockResolvedValue({
        success: false,
        error: 'The service is currently unavailable.',
        errorCode: 'messaging/server-unavailable'
      });

      await PushService.sendToUser(db, USERS.konfi1.id, {
        title: 'Test', body: 'Test', data: { type: 'bonus_points' }
      });

      const zeile = await tokenZeile(USERS.konfi1.id);
      expect(zeile).not.toBeNull();
      expect(zeile.error_count).toBe(1);
    });

    it('Nur der abgelehnte Token faellt weg, die uebrigen Geraete bleiben', async () => {
      await db.query(
        `INSERT INTO push_tokens (user_id, token, platform, device_id) VALUES ($1, $2, $3, $4)`,
        [USERS.konfi1.id, 'token-konfi1-zweitgeraet', 'android', 'dev-konfi1-b']
      );

      sendFirebasePushNotification.mockImplementation(async (token) => (
        token === 'token-konfi1'
          ? { success: false, error: 'not found', errorCode: 'messaging/registration-token-not-registered' }
          : { success: true, messageId: 'ok' }
      ));

      const ergebnis = await PushService.sendToUser(db, USERS.konfi1.id, {
        title: 'Test', body: 'Test', data: { type: 'bonus_points' }
      });

      expect(ergebnis.sent).toBe(1);
      expect(ergebnis.errors).toBe(1);

      const { rows } = await db.query(
        'SELECT token FROM push_tokens WHERE user_id = $1 ORDER BY token', [USERS.konfi1.id]
      );
      expect(rows.map(r => r.token)).toEqual(['token-konfi1-zweitgeraet']);
    });
  });

  // ================================================================
  // Gesperrte und geloeschte Konten bekommen gar nichts (28.08.2026)
  //
  // Elf von fuenfzehn Empfaenger-Abfragen prueften weder `is_active` noch
  // `deleted_at` — darunter sendToOrgAdmins, sendNewActivityRequestToAdmins
  // und die Opt-in/Opt-out-Meldungen. Wer aus dem Team ausgeschieden und
  // deaktiviert war, wurde weiter ueber neue Antraege und Termine
  // informiert. Der Filter sitzt jetzt zentral in getTokensForUser, damit er
  // fuer alle Wege gilt; diese Tests sichern das ueber mehrere Wege ab.
  // ================================================================
  describe('Gesperrte Konten', () => {
    it('sendToOrgAdmins: aktive Leitung bekommt, deaktivierte nicht', async () => {
      // Erlaubter Fall zuerst — sonst prueft ein spaeterer 0-Vergleich nichts.
      await PushService.sendToOrgAdmins(db, ORGS.testGemeinde.id, {
        title: 'Neu', body: 'Etwas ist passiert', data: { type: 'test' },
      });
      expect(gesendete().map(p => p.token)).toContain('token-admin1');
      sendFirebasePushNotification.mockClear();

      await db.query('UPDATE users SET is_active = false WHERE id = $1', [USERS.admin1.id]);
      await PushService.sendToOrgAdmins(db, ORGS.testGemeinde.id, {
        title: 'Neu', body: 'Etwas ist passiert', data: { type: 'test' },
      });
      expect(gesendete().map(p => p.token)).not.toContain('token-admin1');
    });

    it('sendNewActivityRequestToAdmins: deaktivierte Leitung faellt raus', async () => {
      await PushService.sendNewActivityRequestToAdmins(db, ORGS.testGemeinde.id, 'Konfi', 'Aktivitaet', 3);
      expect(gesendete().map(p => p.token)).toContain('token-admin1');
      sendFirebasePushNotification.mockClear();

      await db.query('UPDATE users SET is_active = false WHERE id = $1', [USERS.admin1.id]);
      await PushService.sendNewActivityRequestToAdmins(db, ORGS.testGemeinde.id, 'Konfi', 'Aktivitaet', 3);
      expect(gesendete().map(p => p.token)).not.toContain('token-admin1');
    });

    it('sendEventOptOutToAdmins: deaktivierte Leitung faellt raus', async () => {
      await PushService.sendEventOptOutToAdmins(db, ORGS.testGemeinde.id, 'Konfi', 'Termin', 'krank');
      expect(gesendete().map(p => p.token)).toContain('token-admin1');
      sendFirebasePushNotification.mockClear();

      await db.query('UPDATE users SET is_active = false WHERE id = $1', [USERS.admin1.id]);
      await PushService.sendEventOptOutToAdmins(db, ORGS.testGemeinde.id, 'Konfi', 'Termin', 'krank');
      expect(gesendete().map(p => p.token)).not.toContain('token-admin1');
    });

    it('Geloeschtes Konto bekommt ebenfalls nichts', async () => {
      await db.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [USERS.admin1.id]);
      await PushService.sendToOrgAdmins(db, ORGS.testGemeinde.id, {
        title: 'Neu', body: 'Etwas ist passiert', data: { type: 'test' },
      });
      expect(gesendete().map(p => p.token)).not.toContain('token-admin1');
    });

    it('getTokensForUser liefert fuer ein gesperrtes Konto nichts, fuer ein aktives alles', async () => {
      const aktiv = await PushService.getTokensForUser(db, USERS.admin1.id);
      expect(aktiv.length).toBe(1);
      expect(aktiv[0].token).toBe('token-admin1');

      await db.query('UPDATE users SET is_active = false WHERE id = $1', [USERS.admin1.id]);
      const gesperrt = await PushService.getTokensForUser(db, USERS.admin1.id);
      expect(gesperrt.length).toBe(0);
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
  // M4 (Push-Bericht 27.08.2026): Zwei Typen erreichen auch
  // Teamer:innen — und die koennen mehreren Gemeinden angehoeren.
  // Fuer sie ist der Primaer-Org-Fallback FALSCH: Der Tap muss in die
  // Organisation des INHALTS wechseln, nicht in die Heimatgemeinde.
  //
  // Verbotener Fall: Content-Org der Zweitgemeinde (2) darf NICHT durch
  // die Primaer-Org (1) ersetzt werden.
  // Erlaubter Fall: ohne Content-Org greift der Fallback weiter — fuer
  // Konfis ist er richtig, sie sind immer Single-Org.
  // ================================================================
  describe('M4: Content-Org schlaegt die Primaer-Org (Multi-Org-Teamer)', () => {
    it('sendBadgeEarnedToKonfi: uebergebene Org 2 gewinnt gegen Primaer-Org 1', async () => {
      await PushService.sendBadgeEarnedToKonfi(
        db, USERS.teamer1.id, 'Abzeichen', 'star', 'Beschreibung', null,
        ORGS.andereGemeinde.id
      );
      const [push] = gesendete();
      expect(push.data.type).toBe('badge_earned');
      expect(push.data.organization_id).toBe('2');
    });

    it('sendBadgeEarnedToKonfi: ohne Org greift der Fallback (Primaer-Org 1)', async () => {
      await PushService.sendBadgeEarnedToKonfi(
        db, USERS.teamer1.id, 'Abzeichen', 'star', 'Beschreibung'
      );
      const [push] = gesendete();
      expect(push.data.organization_id).toBe('1');
    });

    it('sendActivityRequestStatusToKonfi: uebergebene Org 2 gewinnt', async () => {
      await PushService.sendActivityRequestStatusToKonfi(
        db, USERS.teamer1.id, 'Aktivitaet', 3, 'approved', null, null,
        ORGS.andereGemeinde.id
      );
      const [push] = gesendete();
      expect(push.data.type).toBe('activity_request_status');
      expect(push.data.organization_id).toBe('2');
    });

    it('sendActivityRequestStatusToKonfi: ohne Org greift der Fallback', async () => {
      await PushService.sendActivityRequestStatusToKonfi(
        db, USERS.teamer1.id, 'Aktivitaet', 3, 'approved'
      );
      const [push] = gesendete();
      expect(push.data.organization_id).toBe('1');
    });

    it('sendBadgeEarnedToKonfi reicht die badge_id mit durch', async () => {
      // Vorher blieb badge_id leer, weil die Aufrufstelle in badges.js sie
      // nicht uebergab — der Tap kannte das Abzeichen also nicht.
      await PushService.sendBadgeEarnedToKonfi(
        db, USERS.konfi1.id, 'Abzeichen', 'star', 'Beschreibung', 42,
        ORGS.testGemeinde.id
      );
      const [push] = gesendete();
      expect(push.data.badge_id).toBe('42');
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

    it('sendTeamerEventCancellationToAdmins: Abmeldung ohne Grund — Text wie bisher', async () => {
      // Der Storno-Weg (DELETE /events/:id/book) ruft ohne reason auf: Der
      // Text darf sich fuer ihn nicht aendern.
      await PushService.sendTeamerEventCancellationToAdmins(
        db, ORGS.testGemeinde.id, 'Lasse Brandt', 'Konfi-Freizeit', 42
      );

      const [push] = gesendete();
      expect(push.title).toBe('Teamer:in abgemeldet');
      expect(push.body).toBe("Lasse Brandt hat sich von 'Konfi-Freizeit' abgemeldet");
      expect(push.data.type).toBe('teamer_event_cancellation');
      expect(push.data.eventId).toBe('42');
      expect(push.data.organization_id).toBe('1');
      expect(push.data.reason).toBeUndefined();
    });

    it('sendTeamerEventCancellationToAdmins: Absage MIT Grund nennt ihn (01.09.2026)', async () => {
      await PushService.sendTeamerEventCancellationToAdmins(
        db, ORGS.testGemeinde.id, 'Lasse Brandt', 'Konfi-Freizeit', 42, 'Familienfeier'
      );

      const [push] = gesendete();
      expect(push.title).toBe('Teamer:in abgemeldet');
      expect(push.body).toBe("Lasse Brandt hat sich von 'Konfi-Freizeit' abgemeldet. Grund: Familienfeier");
      expect(push.data.type).toBe('teamer_event_cancellation');
      expect(push.data.reason).toBe('Familienfeier');
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
