// backend/tests/services/pushGemeindeJederArt.test.js
//
// JEDE Push-Art gibt die Gemeinde ihres Inhalts mit (Simon, 08.10.2026,
// Mehrfach-Konten Entscheidung 2). Bis hierher setzte sendToUser ohne
// mitgegebene Gemeinde die Stamm-Gemeinde des Empfaengers ein. Wer in A
// zuhause ist und in B mitarbeitet, landete mit einem Push aus B beim
// Antippen in A, und die Zahl wurde dort gebucht. Vier Arten gaben keine
// Gemeinde mit (activity_assigned, bonus_points, event_unregistered,
// level_up), dreizehn nur optional.
//
// Der Test ermittelt die send...-Methoden per Reflexion: Eine NEUE Push-Art,
// die hier nicht in der Tabelle steht, laesst ihn fallen -- sie muss erst
// zeigen, dass sie die Gemeinde mitgibt. Geprueft wird die Mitteilung, mit
// der sendToUser aufgerufen wird (also VOR jedem Rueckfall): Sie muss die
// Gemeinde des Inhalts tragen. Der Empfaenger hat zwei Gemeinden, damit kein
// Rueckfall den Fehler verdecken koennte.
//
// Danach der Rueckfall selbst: nur noch bei genau einer Gemeinde.
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES, JAHRGAENGE, EVENTS, CHAT_ROOMS } = require('../helpers/seed');

const firebase = require('../../push/firebase');
const sendFirebasePushNotification = vi
  .spyOn(firebase, 'sendFirebasePushNotification')
  .mockResolvedValue({ success: true });
vi.spyOn(firebase, 'sendFirebaseSilentPush').mockResolvedValue({ success: true });

const PushService = require('../../services/pushService');

const ORG2 = ORGS.andereGemeinde.id;
const ORG1 = ORGS.testGemeinde.id;
const T = USERS.teamer1.id; // Stamm Org 1, zusaetzlich Teamer:in in Org 2
const DATUM = '2026-12-24T16:00:00Z';

// Infrastruktur, keine eigene Push-Art:
//   sendeMitWiederholung, sendeAnGeraete  -- Versand an FCM
//   sendToUser, sendToMultipleUsers       -- Versandwege; hier sitzt der Rueckfall
//   sendBadgeUpdate, sendBadgeUpdates     -- stiller Push, traegt nur die Zahl
//     am App-Symbol (sendFirebaseSilentPush ohne data-Teil). Die Zahl ist die
//     Summe ueber ALLE Gemeinden der Person (utils/appIconBadge.js), es gibt
//     nichts anzutippen und keine Gemeinde, in die gewechselt wuerde.
const INFRASTRUKTUR = [
  'sendeMitWiederholung', 'sendeAnGeraete', 'sendToUser', 'sendToMultipleUsers',
  'sendBadgeUpdate', 'sendBadgeUpdates',
];

let challengeId;

// Methode -> Aufruf mit Inhalt aus Org 2.
const ARTEN = {
  sendChatNotificationToMany: (db) => PushService.sendChatNotificationToMany(db, [T], {
    title: 'Chat', body: 'Hallo', roomId: CHAT_ROOMS.jahrgang2.id, messageId: 1,
    data: { sender_id: USERS.admin2.id, sender_name: 'Admin 2', room_name: 'Jahrgang' },
  }),
  sendChatNotification: (db) => PushService.sendChatNotification(db, T, {
    title: 'Chat', body: 'Hallo', roomId: CHAT_ROOMS.jahrgang2.id, messageId: 1,
    data: { sender_id: USERS.admin2.id, sender_name: 'Admin 2', room_name: 'Jahrgang' },
  }),
  sendToOrgAdmins: (db) => PushService.sendToOrgAdmins(db, ORG2, { title: 't', body: 'b', data: { type: 'test' } }),
  sendToLeadership: (db) => PushService.sendToLeadership(db, ORG2, [T], { title: 't', body: 'b', data: { type: 'test' } }),
  sendNewActivityRequestToLeadership: (db) => PushService.sendNewActivityRequestToLeadership(db, ORG2, [T], 'Emilia', 'Aktivität', 2),
  sendActivityRequestStatusToKonfi: (db) => PushService.sendActivityRequestStatusToKonfi(db, T, 'Aktivität', 2, 'approved', null, 5, ORG2),
  sendBadgeEarnedToKonfi: (db) => PushService.sendBadgeEarnedToKonfi(db, T, 'Abzeichen', 'star', 'b', 3, ORG2),
  sendActivityAssignedToKonfi: (db) => PushService.sendActivityAssignedToKonfi(db, T, 'Aktivität', 2, 'gemeinde', ORG2),
  sendBonusPointsToKonfi: (db) => PushService.sendBonusPointsToKonfi(db, T, 2, 'Sonderpunkte', 'gemeinde', ORG2),
  sendEventRegisteredToKonfi: (db) => PushService.sendEventRegisteredToKonfi(db, T, 'Termin', DATUM, 'confirmed', 4, null, ORG2),
  sendEventRegisteredToTeamer: (db) => PushService.sendEventRegisteredToTeamer(db, T, 'Termin', DATUM, 'confirmed', 4, ORG2),
  sendEventUnregisteredToKonfi: (db) => PushService.sendEventUnregisteredToKonfi(db, T, 'Termin', 4, ORG2),
  sendEventRemovedByLeitung: (db) => PushService.sendEventRemovedByLeitung(db, T, 'Termin', DATUM, 'removed', 4, ORG2),
  sendEventUnregistrationToLeadership: (db) => PushService.sendEventUnregistrationToLeadership(db, ORG2, [T], 'Emilia', 'Termin', null, 4, USERS.konfi3.id),
  sendLevelUpToKonfi: (db) => PushService.sendLevelUpToKonfi(db, T, 'lehrling', 'Lehrling', 'star', 2, ORG2),
  sendEventReminderToKonfi: (db) => PushService.sendEventReminderToKonfi(db, T, 'Termin', DATUM, '17:00', '1_day', ORG2, 4),
  sendGemeindeEinladungToUser: (db) => PushService.sendGemeindeEinladungToUser(db, T, 'Andere Gemeinde', 'Teamer:in', 9, ORG2),
  sendEinladungBeantwortetToLeitung: (db) => PushService.sendEinladungBeantwortetToLeitung(db, {
    einladungId: 9, organizationId: ORG2, eingeladenVon: null, eingeladenId: USERS.konfi1.id,
    personName: 'P', rolleName: 'Teamer:in', orgName: 'Andere Gemeinde', angenommen: true,
  }),
  sendWaitlistPromotionToKonfi: (db) => PushService.sendWaitlistPromotionToKonfi(db, T, 'Termin', DATUM, 4, ORG2),
  sendWaitlistPromotionToTeamer: (db) => PushService.sendWaitlistPromotionToTeamer(db, T, 'Termin', DATUM, 4, ORG2),
  sendEventCancellationToKonfis: (db) => PushService.sendEventCancellationToKonfis(db, [T], 'Termin', '24.12.', ORG2, null, 4),
  sendEventReactivationToKonfis: (db) => PushService.sendEventReactivationToKonfis(db, [T], 'Termin', '24.12.', ORG2, 4),
  sendEventChangedToKonfis: (db) => PushService.sendEventChangedToKonfis(db, [T], 'Termin', { location: 'Saal' }, 4, ORG2),
  sendNewEventToOrgKonfis: (db) => PushService.sendNewEventToOrgKonfis(db, ORG2, 'Gemeindeabend', DATUM, EVENTS.event2.id),
  sendChallengeStartedToJahrgaenge: (db) => PushService.sendChallengeStartedToJahrgaenge(db, challengeId, 'Runde'),
  sendChallengeFeedToJahrgaenge: (db) => PushService.sendChallengeFeedToJahrgaenge(db, ORG2, challengeId, 'Runde', USERS.admin2.id, 'Emilia', 'text'),
  sendChallengeBadgeEarnedToKonfi: (db) => PushService.sendChallengeBadgeEarnedToKonfi(db, T, challengeId, 'Runde'),
  sendChallengeSubmissionHiddenToUser: (db) => PushService.sendChallengeSubmissionHiddenToUser(db, T, challengeId, 'Runde'),
  sendChallengeSubmissionToLeadership: (db) => PushService.sendChallengeSubmissionToLeadership(db, ORG2, challengeId, 'Runde', 'Emilia', false, USERS.konfi3.id),
  sendEventAttendanceToKonfi: (db) => PushService.sendEventAttendanceToKonfi(db, T, 'Termin', 'present', 1, 4, ORG2),
  sendEventsPendingApprovalToLeadership: (db) => PushService.sendEventsPendingApprovalToLeadership(db, ORG2, [T], 2),
  sendJahrgangDeletionWarningToLeadership: (db) => PushService.sendJahrgangDeletionWarningToLeadership(db, ORG2, [T], 'Jahrgang', 7, JAHRGAENGE.jahrgang2.id),
  sendNewKonfiRegistrationToLeadership: (db) => PushService.sendNewKonfiRegistrationToLeadership(db, ORG2, [T], JAHRGAENGE.jahrgang2.id, 'Emilia', 'Jahrgang', USERS.konfi3.id),
  sendEventOptOutToLeadership: (db) => PushService.sendEventOptOutToLeadership(db, ORG2, [T], 'Emilia', 'Termin', 'krank', 4, USERS.konfi3.id),
  sendEventOptInToLeadership: (db) => PushService.sendEventOptInToLeadership(db, ORG2, [T], 'Emilia', 'Termin', 4, USERS.konfi3.id),
  sendMandatoryEventCreated: (db) => PushService.sendMandatoryEventCreated(db, [T], 'Termin', DATUM, 4, ORG2),
  sendTeamerEventBookingToLeadership: (db) => PushService.sendTeamerEventBookingToLeadership(db, ORG2, [T], 'Tim', 'Termin', 'confirmed', 4, USERS.teamer2.id),
  sendTeamerEventCancellationToLeadership: (db) => PushService.sendTeamerEventCancellationToLeadership(db, ORG2, [T], 'Tim', 'Termin', 4, null, USERS.teamer2.id),
  sendCertificateToTeamer: (db) => PushService.sendCertificateToTeamer(db, T, 'Juleica', ORG2),
  sendWrappedReleased: (db) => PushService.sendWrappedReleased(db, [T], 'teamer', ORG2, 1),
};

const sendMethoden = () => Object.getOwnPropertyNames(PushService)
  .filter((n) => /^send/.test(n) && typeof PushService[n] === 'function')
  .filter((n) => !INFRASTRUKTUR.includes(n))
  .sort();

describe('Jede Push-Art gibt die Gemeinde ihres Inhalts mit', () => {
  let db;
  let sendToUserSpy;

  beforeAll(() => { db = getTestPool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    await db.query(
      'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
      [T, ORG2, ROLES.teamer2.id]
    );
    // Ein Geraet: Der Chat-Weg ruft sendToUser nur fuer Personen mit Token.
    await db.query(
      `INSERT INTO push_tokens (user_id, token, platform, device_id) VALUES ($1, 'token-teamer1', 'ios', 'dev-teamer1')`,
      [T]
    );
    const { rows: [c] } = await db.query(
      `INSERT INTO challenges (organization_id, title, description, audience, visibility, moderated,
         allowed_media, badge_name, created_by, starts_at, ends_at, is_draft, start_push_sent)
       VALUES ($1, 'Runde', 'd', 'konfis', 'public', false, '["text"]'::jsonb, 'A', NULL,
               NOW() - interval '1 minute', NOW() + interval '7 days', false, false)
       RETURNING id`,
      [ORG2]
    );
    challengeId = c.id;
    await db.query('INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id) VALUES ($1, $2)', [challengeId, JAHRGAENGE.jahrgang2.id]);
    sendFirebasePushNotification.mockClear();
    sendToUserSpy = vi.spyOn(PushService, 'sendToUser');
  });

  afterEach(() => { sendToUserSpy.mockRestore(); });
  afterAll(async () => { await closePool(); });

  it('die Tabelle kennt genau die send...-Methoden des Push-Dienstes', () => {
    // Faellt dieser Test, ist eine Push-Art dazugekommen (oder weggefallen):
    // in ARTEN eintragen -- mit der Gemeinde des Inhalts.
    expect(Object.keys(ARTEN).sort()).toEqual(sendMethoden());
  });

  it.each(Object.keys(ARTEN))('%s: jede Mitteilung traegt die Gemeinde des Inhalts', async (name) => {
    await ARTEN[name](db);
    const aufrufe = sendToUserSpy.mock.calls;
    expect(aufrufe.length).toBeGreaterThan(0);
    const orgs = [...new Set(aufrufe.map(([, , notification]) => String(notification.data && notification.data.organization_id)))];
    expect(orgs).toEqual([String(ORG2)]);
  });

  it('checkAndSendLevelUp reicht die Gemeinde an den Level-Push weiter', async () => {
    await db.query('UPDATE konfi_profiles SET gemeinde_points = 50, current_level_id = NULL WHERE user_id = $1', [USERS.konfi1.id]);
    await PushService.checkAndSendLevelUp(db, USERS.konfi1.id, ORG1);
    const levelAufrufe = sendToUserSpy.mock.calls.filter(([, , n]) => n.data && n.data.type === 'level_up');
    expect(levelAufrufe).toHaveLength(1);
    expect(levelAufrufe[0][2].data.organization_id).toBe(String(ORG1));
  });
});

describe('Rueckfall ohne mitgegebene Gemeinde: nur bei genau einer', () => {
  let db;
  let fehlerSpy;

  beforeAll(() => { db = getTestPool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    await db.query(
      `INSERT INTO push_tokens (user_id, token, platform, device_id) VALUES ($1, 'token-teamer1', 'ios', 'dev-teamer1')`,
      [T]
    );
    sendFirebasePushNotification.mockClear();
    fehlerSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => { fehlerSpy.mockRestore(); });
  afterAll(async () => { await closePool(); });

  const gesendet = () => sendFirebasePushNotification.mock.calls.map(([, payload]) => payload.data);
  const ohneGemeinde = { title: 't', body: 'b', data: { type: 'bonus_points' } };

  it('erlaubt: eine Gemeinde -> deren Kennung im Payload (Einzelweg)', async () => {
    await PushService.sendToUser(db, T, ohneGemeinde);
    expect(gesendet()).toHaveLength(1);
    expect(gesendet()[0].organization_id).toBe(String(ORG1));
    expect(fehlerSpy).not.toHaveBeenCalled();
  });

  it('erlaubt: Stamm-Gemeinde doppelt in user_organizations zaehlt als eine', async () => {
    await db.query('INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)', [T, ORG1, ROLES.teamer.id]);
    await PushService.sendToMultipleUsers(db, [T], ohneGemeinde);
    expect(gesendet()).toHaveLength(1);
    expect(gesendet()[0].organization_id).toBe(String(ORG1));
  });

  it('verboten: zwei Gemeinden -> kein Rueckfall, Push ohne organization_id, Fehler im Protokoll (Einzelweg)', async () => {
    await db.query('INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)', [T, ORG2, ROLES.teamer2.id]);
    await PushService.sendToUser(db, T, ohneGemeinde);
    expect(gesendet()).toHaveLength(1);
    expect('organization_id' in gesendet()[0]).toBe(false);
    expect(gesendet()[0].type).toBe('bonus_points');
    const zeilen = fehlerSpy.mock.calls.map((a) => String(a[0]));
    expect(zeilen.filter((z) => z.includes(`Push bonus_points an Konto ${T}`) && z.includes('mehrere Gemeinden'))).toHaveLength(1);
  });

  it('verboten: zwei Gemeinden -> kein Rueckfall auch im Versand an viele', async () => {
    await db.query('INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)', [T, ORG2, ROLES.teamer2.id]);
    await PushService.sendToMultipleUsers(db, [T], ohneGemeinde);
    expect(gesendet()).toHaveLength(1);
    expect('organization_id' in gesendet()[0]).toBe(false);
    const zeilen = fehlerSpy.mock.calls.map((a) => String(a[0]));
    expect(zeilen.filter((z) => z.includes(`an Konto ${T}`) && z.includes('mehrere Gemeinden'))).toHaveLength(1);
  });

  it('mitgegebene Gemeinde gilt bei zwei Gemeinden unveraendert, ohne Fehler', async () => {
    await db.query('INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)', [T, ORG2, ROLES.teamer2.id]);
    await PushService.sendToUser(db, T, { ...ohneGemeinde, data: { type: 'bonus_points', organization_id: ORG2 } });
    expect(gesendet()[0].organization_id).toBe(String(ORG2));
    expect(fehlerSpy).not.toHaveBeenCalled();
  });
});

// Sperre je Gemeinde (Simon, 08.10.2026, Entscheidung 7): Sperrt Gemeinde A
// eine Person, die auch in B ist, kommt aus A nichts mehr bei ihr an --
// weder Push noch Postfach-Eintrag. Aus B geht alles weiter.
describe('Gesperrt in der Gemeinde des Inhalts: kein Push, kein Postfach', () => {
  let db;

  beforeAll(() => { db = getTestPool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    await db.query(
      `INSERT INTO push_tokens (user_id, token, platform, device_id) VALUES ($1, 'token-teamer1', 'ios', 'dev-teamer1')`,
      [T]
    );
    // Teamer:in 1 ist auch in Org 2 -- dort gesperrt.
    await db.query(
      'INSERT INTO user_organizations (user_id, organization_id, role_id, is_active) VALUES ($1, $2, $3, false)',
      [T, ORG2, ROLES.teamer2.id]
    );
    sendFirebasePushNotification.mockClear();
  });

  afterAll(async () => { await closePool(); });

  const tokens = () => sendFirebasePushNotification.mock.calls.map(([token]) => token);
  const postfach = async () => (await db.query(
    'SELECT organization_id FROM notifications WHERE user_id = $1 ORDER BY id', [T]
  )).rows.map((r) => Number(r.organization_id));
  const mitteilung = (org) => ({ title: 't', body: 'b', data: { type: 'bonus_points', organization_id: org } });

  it('verboten: Einzelweg aus der sperrenden Gemeinde -> nichts', async () => {
    const res = await PushService.sendToUser(db, T, mitteilung(ORG2));
    expect(res).toEqual({ success: false, message: 'Gesperrt in dieser Gemeinde' });
    expect(tokens()).toEqual([]);
    expect(await postfach()).toEqual([]);
  });

  it('erlaubt: Einzelweg aus der anderen Gemeinde kommt an', async () => {
    const res = await PushService.sendToUser(db, T, mitteilung(ORG1));
    expect(res.success).toBe(true);
    expect(tokens()).toEqual(['token-teamer1']);
    expect(await postfach()).toEqual([ORG1]);
  });

  it('verboten: Versand an viele aus der sperrenden Gemeinde -> nichts, Antwort behaelt einen Eintrag je Empfaenger', async () => {
    await db.query(
      `INSERT INTO push_tokens (user_id, token, platform, device_id) VALUES ($1, 'token-teamer2', 'ios', 'dev-teamer2')`,
      [USERS.teamer2.id]
    );
    const res = await PushService.sendToMultipleUsers(db, [T, USERS.teamer2.id], mitteilung(ORG2));
    expect(res.map((r) => [Number(r.userId), r.success])).toEqual([[T, false], [USERS.teamer2.id, true]]);
    expect(res[0].message).toBe('Gesperrt in dieser Gemeinde');
    expect(tokens()).toEqual(['token-teamer2']);
    expect(await postfach()).toEqual([]);
  });

  it('erlaubt: Versand an viele aus der anderen Gemeinde kommt an', async () => {
    await PushService.sendToMultipleUsers(db, [T], mitteilung(ORG1));
    expect(tokens()).toEqual(['token-teamer1']);
    expect(await postfach()).toEqual([ORG1]);
  });

  it('verboten/erlaubt: Chat-Push nur aus dem Raum der nicht sperrenden Gemeinde', async () => {
    const chat = (roomId) => PushService.sendChatNotificationToMany(db, [T], {
      title: 'Chat', body: 'Hallo', roomId, messageId: 1,
      data: { sender_id: USERS.admin2.id, sender_name: 'A', room_name: 'R' },
    });
    await chat(CHAT_ROOMS.jahrgang2.id);
    expect(tokens()).toEqual([]);
    await chat(CHAT_ROOMS.jahrgang.id);
    expect(tokens()).toEqual(['token-teamer1']);
  });
});
