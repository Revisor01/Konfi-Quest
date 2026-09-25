// backend/tests/services/postfachSchreiben.test.js
//
// Postfach fuer alle Push-Arten (25.09.2026). Simon: "Postfach macht ja nur
// Sinn wenn es auch alles beinhaltet. Gerade Punkte erhalten macht ja Sinn.
// Da gibts ja nur nen Push und dann keine Indikator in der App."
//
// Bis dahin schrieben nur vier Arten in die Tabelle notifications; alles
// andere war reiner Push. Jetzt schreibt der zentrale Versandweg
// (PushService.sendToUser / sendToMultipleUsers) den Eintrag mit -- gesteuert
// ueber die Positivliste in utils/postfachArten.js.
//
// Geprueft wird je Art: Der Push loest genau einen Eintrag je Empfaenger:in
// aus, mit der richtigen Art, den Kennungen fuers Antippen (event_id,
// challengeId, jahrgang_id) und der Organisation des Inhalts. Und: Die
// bewusst ausgenommenen Arten schreiben NICHTS.
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, EVENTS, JAHRGAENGE } = require('../helpers/seed');
const { ladeLeitungDerOrganisation } = require('../../utils/orgMitglieder');
const { POSTFACH_ARTEN, NICHT_IM_POSTFACH } = require('../../utils/postfachArten');

// Firebase abklemmen, BEVOR pushService geladen wird (Muster aus
// pushService.test.js). Der Push selbst ist hier Nebensache -- es geht um
// die Zeile in notifications.
const firebase = require('../../push/firebase');
const sendFirebasePushNotification = vi
  .spyOn(firebase, 'sendFirebasePushNotification')
  .mockResolvedValue({ success: true });
vi.spyOn(firebase, 'sendFirebaseSilentPush').mockResolvedValue({ success: true });

const PushService = require('../../services/pushService');

const ORG1 = ORGS.testGemeinde.id;
const TERMIN = EVENTS.gottesdienstEvent.id;
const DATUM = '2026-12-24T17:00:00.000Z';

describe('Postfach: der Push-Weg schreibt die Mitteilung mit', () => {
  let db;

  beforeAll(() => {
    db = getTestPool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    // Nur konfi1 und admin1 haben ein Push-Geraet. Alle anderen Empfaenger
    // sind ohne Token -- und muessen die Mitteilung trotzdem bekommen.
    await db.query(
      `INSERT INTO push_tokens (user_id, token, platform, device_id) VALUES
       ($1, 'token-konfi1', 'ios', 'dev-konfi1'),
       ($2, 'token-admin1', 'ios', 'dev-admin1')`,
      [USERS.konfi1.id, USERS.admin1.id]
    );
    sendFirebasePushNotification.mockClear();
  });

  afterAll(async () => {
    await closePool();
  });

  /** Alle Mitteilungen einer Person, aelteste zuerst; data als Objekt. */
  async function postfach(userId) {
    const { rows } = await db.query(
      `SELECT id, user_id, title, message, type, data, organization_id, read_at
         FROM notifications WHERE user_id = $1 ORDER BY id`,
      [userId]
    );
    return rows;
  }

  async function anzahl() {
    const { rows: [{ c }] } = await db.query('SELECT COUNT(*)::int AS c FROM notifications');
    return c;
  }

  async function challengeAnlegen(orgId = ORG1) {
    const { rows: [c] } = await db.query(
      `INSERT INTO challenges (organization_id, title, description, badge_name,
                               starts_at, ends_at, is_draft, audience)
       VALUES ($1, 'Fotochallenge', 'B', 'Stempel', NOW() - interval '1 day',
               NOW() + interval '7 days', false, 'konfis') RETURNING id`,
      [orgId]
    );
    await db.query(
      'INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id) VALUES ($1, $2)',
      [c.id, JAHRGAENGE.jahrgang1.id]
    );
    return c.id;
  }

  // ================================================================
  // Konfi-Arten -- Simons Kernanliegen ("Punkte erhalten")
  // ================================================================
  describe('Konfi-Arten', () => {
    it('event_attendance: Punkte aus einem Termin verbucht -> Eintrag mit event_id, Punkten und Org', async () => {
      await PushService.sendEventAttendanceToKonfi(db, USERS.konfi1.id, 'Weihnachtsgottesdienst', 'present', 2, TERMIN, ORG1);

      const [m] = await postfach(USERS.konfi1.id);
      expect(m).toMatchObject({
        type: 'event_attendance',
        title: 'Teilnahme bestätigt!',
        organization_id: ORG1,
        read_at: null
      });
      expect(m.message).toBe('Deine Teilnahme an "Weihnachtsgottesdienst" wurde bestätigt. Du erhältst +2 Punkte!');
      expect(m.data).toMatchObject({ type: 'event_attendance', event_id: String(TERMIN), points: '2', status: 'present' });
      expect(await anzahl()).toBe(1);
    });

    it('bonus_points: ohne Org im Aufruf -> Stamm-Organisation der Konfi', async () => {
      await PushService.sendBonusPointsToKonfi(db, USERS.konfi1.id, 3, 'Kuchen gebacken', 'gemeinde');

      const [m] = await postfach(USERS.konfi1.id);
      expect(m.type).toBe('bonus_points');
      expect(m.title).toBe('+3 Bonuspunkte!');
      expect(m.organization_id).toBe(ORG1);
      expect(m.data).toMatchObject({ points: '3', category: 'gemeinde' });
    });

    it('bonus_points: Konfi in Org 2 -> Eintrag in Org 2', async () => {
      await PushService.sendBonusPointsToKonfi(db, USERS.konfi3.id, 1, 'Test', 'gottesdienst');

      const [m] = await postfach(USERS.konfi3.id);
      expect(m.organization_id).toBe(ORGS.andereGemeinde.id);
    });

    it('activity_assigned: direkt zugewiesene Aktivitaet', async () => {
      await PushService.sendActivityAssignedToKonfi(db, USERS.konfi1.id, 'Kirchenchor', 1, 'gemeinde');

      const [m] = await postfach(USERS.konfi1.id);
      expect(m.type).toBe('activity_assigned');
      expect(m.title).toBe('+1 Punkte!');
      expect(m.data).toMatchObject({ activity_name: 'Kirchenchor', points: '1' });
    });

    it('level_up: Aufstieg mit level_id', async () => {
      await PushService.sendLevelUpToKonfi(db, USERS.konfi1.id, 'lehrling', 'Lehrling', 'star', 2);

      const [m] = await postfach(USERS.konfi1.id);
      expect(m.type).toBe('level_up');
      expect(m.data).toMatchObject({ level_id: '2', level_title: 'Lehrling' });
    });

    it('challenge_badge_earned: Stempel mit challengeId und Challenge-Org', async () => {
      const challengeId = await challengeAnlegen();
      await PushService.sendChallengeBadgeEarnedToKonfi(db, USERS.konfi1.id, challengeId, 'Fotochallenge');

      const [m] = await postfach(USERS.konfi1.id);
      expect(m.type).toBe('challenge_badge_earned');
      expect(m.organization_id).toBe(ORG1);
      expect(m.data).toMatchObject({ challengeId: String(challengeId) });
    });

    it('waitlist_promotion: nachgerueckt, mit event_id', async () => {
      await PushService.sendWaitlistPromotionToKonfi(db, USERS.konfi1.id, 'Weihnachtsgottesdienst', DATUM, TERMIN, ORG1);

      const [m] = await postfach(USERS.konfi1.id);
      expect(m.type).toBe('waitlist_promotion');
      expect(m.data).toMatchObject({ event_id: String(TERMIN) });
    });

    it('event_cancelled an viele: genau EIN Eintrag je Empfaenger:in, Grund und event_id dabei', async () => {
      await PushService.sendEventCancellationToKonfis(db, [USERS.konfi1.id, USERS.konfi2.id], 'Weihnachtsgottesdienst', DATUM, ORG1, 'Sturmwarnung', TERMIN);

      expect(await anzahl()).toBe(2);
      const [k1] = await postfach(USERS.konfi1.id);
      const [k2] = await postfach(USERS.konfi2.id);
      for (const m of [k1, k2]) {
        expect(m.type).toBe('event_cancelled');
        expect(m.organization_id).toBe(ORG1);
        expect(m.data).toMatchObject({ event_id: String(TERMIN), cancelled_reason: 'Sturmwarnung' });
      }
      // konfi2 hat KEIN Push-Geraet -- der Eintrag steht trotzdem da. Der
      // Push ging nur an konfi1.
      expect(sendFirebasePushNotification).toHaveBeenCalledTimes(1);
    });

    it('event_changed: mit event_id', async () => {
      await PushService.sendEventChangedToKonfis(db, [USERS.konfi1.id], 'Weihnachtsgottesdienst', { date: true }, TERMIN, ORG1);

      const [m] = await postfach(USERS.konfi1.id);
      expect(m.type).toBe('event_changed');
      expect(m.data).toMatchObject({ event_id: String(TERMIN) });
    });

    it('event_reactivated: Termin findet doch statt', async () => {
      await PushService.sendEventReactivationToKonfis(db, [USERS.konfi1.id], 'Weihnachtsgottesdienst', DATUM, ORG1, TERMIN);

      const [m] = await postfach(USERS.konfi1.id);
      expect(m.type).toBe('event_reactivated');
      expect(m.data).toMatchObject({ event_id: String(TERMIN) });
    });

    it('event_registered: Anmeldung bestaetigt, auch fuer Teamer:innen ueber denselben Weg', async () => {
      await PushService.sendEventRegisteredToKonfi(db, USERS.konfi1.id, 'Weihnachtsgottesdienst', DATUM, 'confirmed', TERMIN, null, ORG1);
      await PushService.sendEventRegisteredToTeamer(db, USERS.teamer1.id, 'Weihnachtsgottesdienst', DATUM, 'waitlist', TERMIN, ORG1);

      const [k] = await postfach(USERS.konfi1.id);
      expect(k.type).toBe('event_registered');
      expect(k.title).toBe('Anmeldung bestätigt!');
      expect(k.data).toMatchObject({ event_id: String(TERMIN), status: 'confirmed' });

      const [t] = await postfach(USERS.teamer1.id);
      expect(t.type).toBe('event_registered');
      expect(t.title).toBe('Auf Warteliste');
      expect(t.data).toMatchObject({ status: 'waitlist' });
    });

    it('event_unregistered: Abmeldung bestaetigt', async () => {
      await PushService.sendEventUnregisteredToKonfi(db, USERS.konfi1.id, 'Weihnachtsgottesdienst', TERMIN);

      const [m] = await postfach(USERS.konfi1.id);
      expect(m.type).toBe('event_unregistered');
      expect(m.data).toMatchObject({ event_id: String(TERMIN) });
    });

    it('challenge_submission_hidden: eigener Beitrag ausgeblendet, mit Begruendung', async () => {
      const challengeId = await challengeAnlegen();
      await PushService.sendChallengeSubmissionHiddenToUser(db, USERS.konfi1.id, challengeId, 'Fotochallenge', 'Unscharf');

      const [m] = await postfach(USERS.konfi1.id);
      expect(m.type).toBe('challenge_submission_hidden');
      expect(m.message).toContain('Begründung: Unscharf');
      expect(m.data).toMatchObject({ challengeId: String(challengeId) });
    });
  });

  // ================================================================
  // Leitungs- und Team-Arten
  // ================================================================
  describe('Leitungs-Arten', () => {
    it('event_unregistration: Konfi-Abmeldung an die GESAMTE Leitung, mit event_id', async () => {
      const leitung = await ladeLeitungDerOrganisation(db, ORG1);
      expect(leitung.length).toBeGreaterThan(1);

      await PushService.sendEventUnregistrationToAdmins(db, ORG1, 'Test Konfi 1', 'Weihnachtsgottesdienst', 'Krank', TERMIN);

      expect(await anzahl()).toBe(leitung.length);
      for (const id of leitung) {
        const [m] = await postfach(id);
        expect(m.type).toBe('event_unregistration');
        expect(m.organization_id).toBe(ORG1);
        expect(m.data).toMatchObject({ event_id: String(TERMIN), konfi_name: 'Test Konfi 1' });
        expect(m.message).toBe('Test Konfi 1 hat sich von "Weihnachtsgottesdienst" abgemeldet. Grund: Krank');
      }
    });

    it('teamer_event_booking und teamer_event_cancellation: mit eventId (camelCase, wie der Push)', async () => {
      await PushService.sendTeamerEventBookingToAdmins(db, ORG1, 'Test Teamer 1', 'Weihnachtsgottesdienst', 'confirmed', TERMIN);
      await PushService.sendTeamerEventCancellationToAdmins(db, ORG1, 'Test Teamer 1', 'Weihnachtsgottesdienst', TERMIN, 'Verhindert');

      const [buchung, absage] = await postfach(USERS.admin1.id);
      expect(buchung.type).toBe('teamer_event_booking');
      expect(buchung.data).toMatchObject({ eventId: String(TERMIN) });
      expect(absage.type).toBe('teamer_event_cancellation');
      expect(absage.data).toMatchObject({ eventId: String(TERMIN) });
      expect(absage.message).toContain('Verhindert');
    });

    it('events_pending_approval: Erinnerung an unverbuchte Termine', async () => {
      await PushService.sendEventsPendingApprovalToAdmins(db, ORG1, 3);

      const [m] = await postfach(USERS.admin1.id);
      expect(m.type).toBe('events_pending_approval');
      expect(m.message).toBe('3 Events warten auf Anwesenheitsverbuchung');
      expect(m.data).toMatchObject({ count: '3' });
    });

    it('events_pending_approval kommt taeglich: die neue ersetzt die noch UNGELESENE alte, Gelesenes bleibt', async () => {
      await PushService.sendEventsPendingApprovalToAdmins(db, ORG1, 3);
      await PushService.sendEventsPendingApprovalToAdmins(db, ORG1, 2);

      let liste = await postfach(USERS.admin1.id);
      expect(liste).toHaveLength(1);
      expect(liste[0].data.count).toBe('2');

      // Gelesen -> Verlauf, bleibt stehen; die naechste kommt dazu.
      await db.query('UPDATE notifications SET read_at = NOW() WHERE id = $1', [liste[0].id]);
      await PushService.sendEventsPendingApprovalToAdmins(db, ORG1, 1);

      liste = await postfach(USERS.admin1.id);
      expect(liste).toHaveLength(2);
      expect(liste[0].data.count).toBe('2');
      expect(liste[0].read_at).not.toBeNull();
      expect(liste[1].data.count).toBe('1');
      expect(liste[1].read_at).toBeNull();
    });

    it('new_konfi_registration: mit jahrgang_id', async () => {
      await PushService.sendNewKonfiRegistrationToAdmins(db, ORG1, JAHRGAENGE.jahrgang1.id, 'Neue Konfi', '2025/2026');

      const { rows } = await db.query("SELECT user_id, data FROM notifications WHERE type = 'new_konfi_registration'");
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        expect(r.data).toMatchObject({ jahrgang_id: String(JAHRGAENGE.jahrgang1.id) });
      }
    });

    it('challenge_submission: Beitrag zur Freigabe, mit challengeId, an Leitung UND zugewiesene Teamer:innen', async () => {
      const challengeId = await challengeAnlegen();
      // teamer1 betreut jahrgang1 (Seed) -> bekommt die Meldung ebenfalls.

      await PushService.sendChallengeSubmissionToLeadership(db, ORG1, challengeId, 'Fotochallenge', 'Test Konfi 1', true);

      const [admin] = await postfach(USERS.admin1.id);
      expect(admin.type).toBe('challenge_submission');
      expect(admin.data).toMatchObject({ challengeId: String(challengeId) });
      expect(admin.message).toBe('Test Konfi 1 hat bei "Fotochallenge" etwas eingereicht. Wartet auf Freigabe.');

      const [teamer] = await postfach(USERS.teamer1.id);
      expect(teamer.type).toBe('challenge_submission');
    });

    it('jahrgang_deletion_warning: mit jahrgang_id, damit sie mit dem Jahrgang gehen kann', async () => {
      await PushService.sendJahrgangDeletionWarningToAdmins(db, ORG1, '2025/2026', 3, JAHRGAENGE.jahrgang1.id);

      const [m] = await postfach(USERS.orgAdmin1.id);
      expect(m.type).toBe('jahrgang_deletion_warning');
      expect(m.data).toMatchObject({ jahrgang_id: String(JAHRGAENGE.jahrgang1.id), days_left: '3' });
    });

    it('event_opt_out und event_opt_in: mit event_id', async () => {
      await PushService.sendEventOptOutToAdmins(db, ORG1, 'Test Konfi 1', 'Konfi-Unterricht', 'Zahnarzt', EVENTS.pflichtEvent.id);
      await PushService.sendEventOptInToAdmins(db, ORG1, 'Test Konfi 1', 'Konfi-Unterricht', EVENTS.pflichtEvent.id);

      const [aus, ein] = await postfach(USERS.admin1.id);
      expect(aus.type).toBe('event_opt_out');
      expect(aus.data).toMatchObject({ event_id: String(EVENTS.pflichtEvent.id) });
      expect(ein.type).toBe('event_opt_in');
      expect(ein.data).toMatchObject({ event_id: String(EVENTS.pflichtEvent.id) });
    });
  });

  // ================================================================
  // Die bewusst ausgenommenen Arten schreiben NICHTS
  // ================================================================
  describe('nicht im Postfach', () => {
    it('event_reminder ("morgen", "gleich"): kein Eintrag', async () => {
      await PushService.sendEventReminderToKonfi(db, USERS.konfi1.id, 'Weihnachtsgottesdienst', DATUM, '17:00', '1_day', ORG1, TERMIN);
      expect(await anzahl()).toBe(0);
      // Der Push ging aber raus -- nur das Postfach bleibt leer.
      expect(sendFirebasePushNotification).toHaveBeenCalledTimes(1);
    });

    it('new_event und mandatory_event_created: kein Eintrag (steht in der Terminliste)', async () => {
      await PushService.sendNewEventToOrgKonfis(db, ORG1, 'Neuer Termin', DATUM, TERMIN);
      await PushService.sendMandatoryEventCreated(db, [USERS.konfi1.id], 'Pflicht', DATUM, EVENTS.pflichtEvent.id, ORG1);
      expect(await anzahl()).toBe(0);
    });

    it('challenge_started (Start und Feed): kein Eintrag (die Challenge-Liste zaehlt selbst)', async () => {
      const challengeId = await challengeAnlegen();
      await PushService.sendChallengeStartedToJahrgaenge(db, challengeId, 'Fotochallenge');
      await PushService.sendChallengeFeedToJahrgaenge(db, ORG1, challengeId, 'Fotochallenge', USERS.konfi2.id, 'Test Konfi 2', 'photo');
      expect(await anzahl()).toBe(0);
    });

    it('chat: kein Eintrag (der Chat zaehlt selbst)', async () => {
      await PushService.sendToUser(db, USERS.konfi1.id, {
        title: 'Test Admin 1', body: 'Hallo', data: { type: 'chat', roomId: '1', organization_id: '1' }
      });
      expect(await anzahl()).toBe(0);
    });

    it('die Push-Gegenstuecke der alten Schreibstellen schreiben hier NICHT (sonst laege alles doppelt)', async () => {
      await PushService.sendBadgeEarnedToKonfi(db, USERS.konfi1.id, 'Fleissig', 'flame', 'B', 1, ORG1);
      await PushService.sendNewActivityRequestToAdmins(db, ORG1, 'Test Konfi 1', 'Kirchenchor', 1);
      await PushService.sendActivityRequestStatusToKonfi(db, USERS.konfi1.id, 'Kirchenchor', 1, 'approved', null, 7, ORG1);
      expect(await anzahl()).toBe(0);
    });

    it('wrapped und certificate: kein Eintrag (nicht entschieden)', async () => {
      await PushService.sendWrappedReleased(db, [USERS.konfi1.id], 'konfi', ORG1);
      await PushService.sendCertificateToTeamer(db, USERS.teamer1.id, 'Jugendleiter', ORG1);
      expect(await anzahl()).toBe(0);
    });

    it('Positiv- und Ausschlussliste sind disjunkt und decken die Push-Registry ab', () => {
      for (const art of Object.keys(NICHT_IM_POSTFACH)) {
        expect(POSTFACH_ARTEN.has(art)).toBe(false);
      }
      expect(POSTFACH_ARTEN.size).toBe(21);
      expect(Object.keys(NICHT_IM_POSTFACH)).toHaveLength(11);
    });
  });

  // ================================================================
  // Regeln des zentralen Wegs
  // ================================================================
  describe('Regeln des Schreibens', () => {
    it('ohne Push-Geraet: Eintrag ja, Push nein', async () => {
      await PushService.sendBonusPointsToKonfi(db, USERS.konfi2.id, 2, 'Test', 'gemeinde');

      expect((await postfach(USERS.konfi2.id))).toHaveLength(1);
      expect(sendFirebasePushNotification).not.toHaveBeenCalled();
    });

    it('Push abgeschaltet: Eintrag trotzdem -- das Postfach ist der Weg fuer genau diese Person', async () => {
      await db.query('UPDATE users SET push_enabled = false WHERE id = $1', [USERS.konfi1.id]);
      await PushService.sendBonusPointsToKonfi(db, USERS.konfi1.id, 2, 'Test', 'gemeinde');

      expect((await postfach(USERS.konfi1.id))).toHaveLength(1);
      expect(sendFirebasePushNotification).not.toHaveBeenCalled();
    });

    it('geloeschtes Konto: kein Eintrag', async () => {
      await db.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [USERS.konfi2.id]);
      await PushService.sendBonusPointsToKonfi(db, USERS.konfi2.id, 2, 'Test', 'gemeinde');

      expect(await anzahl()).toBe(0);
    });

    it('Versand an viele: ein Eintrag je Kopf, nicht zusaetzlich einer aus sendToUser', async () => {
      await PushService.sendEventChangedToKonfis(db, [USERS.konfi1.id, USERS.konfi2.id, USERS.konfi3.id], 'X', {}, TERMIN, ORG1);
      expect(await anzahl()).toBe(3);
    });

    it('die Zahl am App-Symbol im Push zaehlt die neue Mitteilung schon mit', async () => {
      // konfi1 hat sonst nichts Offenes: Die Zahl im Push muss 1 sein --
      // also NACH dem Postfach-Eintrag gerechnet, nicht davor.
      await PushService.sendBonusPointsToKonfi(db, USERS.konfi1.id, 2, 'Test', 'gemeinde');

      const [[, payload]] = sendFirebasePushNotification.mock.calls;
      expect(payload.badge).toBe(1);
    });

    it('ein ueberlanger Titel wird auf 255 Zeichen gekuerzt statt den Eintrag zu verlieren', async () => {
      const name = 'X'.repeat(300);
      await PushService.sendEventOptOutToAdmins(db, ORG1, 'Konfi', name, 'Grund', EVENTS.pflichtEvent.id);

      const [m] = await postfach(USERS.admin1.id);
      expect(m.title).toHaveLength(255);
      expect(m.title.startsWith('Abmeldung: XXX')).toBe(true);
    });

    it('ein Fehler beim Schreiben kippt den Push nicht', async () => {
      const spy = vi.spyOn(PushService, 'schreibePostfach').mockRejectedValueOnce(new Error('kaputt'));
      const res = await PushService.sendBonusPointsToKonfi(db, USERS.konfi1.id, 2, 'Test', 'gemeinde');
      spy.mockRestore();

      // Der Push ging trotzdem raus; nur der Eintrag fehlt.
      expect(res).toMatchObject({ success: true, sent: 1 });
      expect(sendFirebasePushNotification).toHaveBeenCalledTimes(1);
      expect(await anzahl()).toBe(0);
    });
  });
});
