// backend/tests/services/pushGruppenAuswahl.test.js
//
// Auswahl der Push-Gruppen in der App (25.09.2026). Simon: "waere doch super,
// wenn das quasi wie in Android auch auf iOS auswaehlbar macht welche pushes
// man bekommt."
//
// Geprueft wird an den DREI Versandwegen (sendToUser, sendToMultipleUsers,
// sendChatNotification):
//   - Voreinstellung: nichts stumm -> Push UND Postfach-Eintrag.
//   - Gruppe stumm: KEIN Push, aber der Postfach-Eintrag entsteht trotzdem --
//     wer nichts aufs Handy will, liest es unter der Glocke nach.
//   - Andere Gruppe stumm: der Push geht weiter raus.
//   - Hauptschalter aus: gar kein Push, egal welche Gruppe.
//   - Der stille badge_update laeuft trotz Abwahl durch (er hat keine Art).
//   - Jede Push-Art im Code hat eine Gruppe.
const fs = require('fs');
const path = require('path');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS } = require('../helpers/seed');
const {
  GRUPPE_JE_ART, GRUPPEN, GRUPPE_CHAT, GRUPPE_TERMINE, GRUPPE_FORTSCHRITT,
  GRUPPE_VERWALTUNG, gruppenFuerRolle, bereinigeStumm
} = require('../../utils/pushGruppen');

const firebase = require('../../push/firebase');
const sendFirebasePushNotification = vi
  .spyOn(firebase, 'sendFirebasePushNotification')
  .mockResolvedValue({ success: true });
const sendFirebaseSilentPush = vi
  .spyOn(firebase, 'sendFirebaseSilentPush')
  .mockResolvedValue({ success: true });

const PushService = require('../../services/pushService');

const ORG1 = ORGS.testGemeinde.id;
const KONFI = USERS.konfi1.id;
const ADMIN = USERS.admin1.id;

const terminPush = {
  title: 'Termin geändert',
  body: 'Der Gottesdienst beginnt später',
  data: { type: 'event_changed', event_id: '1', organization_id: String(ORG1) }
};
const punktePush = {
  title: '+3 Bonuspunkte',
  body: 'Für den Kuchen',
  data: { type: 'bonus_points', organization_id: String(ORG1) }
};

const postfach = (userId, art) => db.query(
  'SELECT id FROM notifications WHERE user_id = $1 AND type = $2',
  [userId, art]
).then((r) => r.rowCount);

const stummSetzen = (userId, gruppen) => db.query(
  'UPDATE users SET push_gruppen_stumm = $1::text[] WHERE id = $2',
  [gruppen, userId]
);

let db;

describe('Push-Gruppen: Abwahl in der App', () => {
  beforeAll(() => { db = getTestPool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    await db.query(
      `INSERT INTO push_tokens (user_id, token, platform, device_id) VALUES
       ($1, 'token-konfi1', 'ios', 'dev-konfi1'),
       ($2, 'token-admin1', 'ios', 'dev-admin1')`,
      [KONFI, ADMIN]
    );
    sendFirebasePushNotification.mockClear();
    sendFirebaseSilentPush.mockClear();
  });

  afterAll(async () => { await closePool(); });

  describe('Voreinstellung fuer neue Konten', () => {
    it('ein frisch angelegtes Konto hat nichts stummgeschaltet und Push an', async () => {
      const { rows: [row] } = await db.query(
        'SELECT push_enabled, push_gruppen_stumm FROM users WHERE id = $1', [KONFI]
      );
      expect(row.push_enabled).toBe(true);
      expect(row.push_gruppen_stumm).toEqual([]);
    });

    it('Push UND Postfach-Eintrag, wenn nichts stumm ist', async () => {
      const ergebnis = await PushService.sendToUser(db, KONFI, terminPush);
      expect(ergebnis.success).toBe(true);
      expect(sendFirebasePushNotification).toHaveBeenCalledTimes(1);
      expect(await postfach(KONFI, 'event_changed')).toBe(1);
    });
  });

  describe('sendToUser', () => {
    it('Gruppe "Termine" stumm: KEIN Push, aber der Postfach-Eintrag entsteht', async () => {
      await stummSetzen(KONFI, [GRUPPE_TERMINE]);

      const ergebnis = await PushService.sendToUser(db, KONFI, terminPush);

      expect(sendFirebasePushNotification).not.toHaveBeenCalled();
      expect(ergebnis.success).toBe(false);
      expect(ergebnis.message).toBe('No tokens found');
      expect(await postfach(KONFI, 'event_changed')).toBe(1);
    });

    it('Gruppe "Termine" stumm: Punkte-Push geht weiter raus (andere Gruppe)', async () => {
      await stummSetzen(KONFI, [GRUPPE_TERMINE]);

      const ergebnis = await PushService.sendToUser(db, KONFI, punktePush);

      expect(ergebnis.success).toBe(true);
      expect(sendFirebasePushNotification).toHaveBeenCalledTimes(1);
      expect(await postfach(KONFI, 'bonus_points')).toBe(1);
    });

    it('Hauptschalter aus: gar kein Push, auch bei nicht stummgeschalteter Gruppe', async () => {
      await db.query('UPDATE users SET push_enabled = false WHERE id = $1', [KONFI]);

      const ergebnis = await PushService.sendToUser(db, KONFI, punktePush);

      expect(sendFirebasePushNotification).not.toHaveBeenCalled();
      expect(ergebnis.success).toBe(false);
      expect(await postfach(KONFI, 'bonus_points')).toBe(1);
    });

    it('unbekannte Art faellt auf "Punkte und Abzeichen" und laesst sich darueber stummschalten', async () => {
      await stummSetzen(KONFI, [GRUPPE_FORTSCHRITT]);
      await PushService.sendToUser(db, KONFI, {
        title: 'x', body: 'y', data: { type: 'noch_nie_gesehen', organization_id: String(ORG1) }
      });
      expect(sendFirebasePushNotification).not.toHaveBeenCalled();
    });
  });

  describe('sendToMultipleUsers', () => {
    it('nur die Person mit stummer Gruppe faellt heraus, beide bekommen den Postfach-Eintrag', async () => {
      await stummSetzen(ADMIN, [GRUPPE_TERMINE]);

      const ergebnisse = await PushService.sendToMultipleUsers(db, [KONFI, ADMIN], terminPush);

      expect(ergebnisse).toHaveLength(2);
      expect(ergebnisse[0]).toMatchObject({ userId: KONFI, success: true, sent: 1 });
      expect(ergebnisse[1]).toMatchObject({ userId: ADMIN, success: false, message: 'No tokens found' });
      expect(sendFirebasePushNotification).toHaveBeenCalledTimes(1);
      expect(await postfach(KONFI, 'event_changed')).toBe(1);
      expect(await postfach(ADMIN, 'event_changed')).toBe(1);
    });

    it('ohne Abwahl bekommen beide den Push', async () => {
      const ergebnisse = await PushService.sendToMultipleUsers(db, [KONFI, ADMIN], terminPush);
      expect(ergebnisse.map((e) => e.success)).toEqual([true, true]);
      expect(sendFirebasePushNotification).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendChatNotification', () => {
    const chat = {
      title: 'Test Admin 1',
      body: 'Hallo',
      roomId: 1,
      messageId: 5,
      data: { sender_id: ADMIN, sender_name: 'Test Admin 1', room_name: 'Raum' }
    };

    it('"Nachrichten" stumm: kein Chat-Push', async () => {
      await stummSetzen(KONFI, [GRUPPE_CHAT]);
      const ergebnis = await PushService.sendChatNotification(db, KONFI, chat);
      expect(ergebnis.success).toBe(false);
      expect(sendFirebasePushNotification).not.toHaveBeenCalled();
    });

    it('andere Gruppe stumm: Chat-Push geht raus', async () => {
      await stummSetzen(KONFI, [GRUPPE_TERMINE, GRUPPE_FORTSCHRITT, GRUPPE_VERWALTUNG]);
      const ergebnis = await PushService.sendChatNotification(db, KONFI, chat);
      expect(ergebnis.success).toBe(true);
      expect(sendFirebasePushNotification).toHaveBeenCalledTimes(1);
    });
  });

  describe('Stiller badge_update', () => {
    it('laeuft trotz Abwahl ALLER Gruppen durch -- er traegt nur die Zahl am App-Symbol', async () => {
      await stummSetzen(KONFI, GRUPPEN.map((g) => g.id));
      const ergebnis = await PushService.sendBadgeUpdate(db, KONFI);
      expect(ergebnis.success).toBe(true);
      expect(sendFirebaseSilentPush).toHaveBeenCalledTimes(1);
    });

    it('bleibt beim Hauptschalter aus weiterhin still', async () => {
      await db.query('UPDATE users SET push_enabled = false WHERE id = $1', [KONFI]);
      const ergebnis = await PushService.sendBadgeUpdate(db, KONFI);
      expect(ergebnis.success).toBe(false);
      expect(sendFirebaseSilentPush).not.toHaveBeenCalled();
    });
  });

  describe('Zuordnung und Rollen', () => {
    it('jede Push-Art in pushService.js hat eine Gruppe', () => {
      const quelle = fs.readFileSync(path.join(__dirname, '../../services/pushService.js'), 'utf8');
      const arten = [...new Set([...quelle.matchAll(/^\s*type: '([a-z_]+)'/gm)].map((m) => m[1]))];
      expect(arten.length).toBeGreaterThanOrEqual(30);
      const ohneGruppe = arten.filter((a) => !GRUPPE_JE_ART[a]);
      expect(ohneGruppe).toEqual([]);
    });

    it('Konfis bekommen drei Gruppen ohne Verwaltung, Team und Leitung alle vier', () => {
      expect(gruppenFuerRolle('konfi').map((g) => g.id)).toEqual([GRUPPE_CHAT, GRUPPE_TERMINE, GRUPPE_FORTSCHRITT]);
      expect(gruppenFuerRolle('teamer')).toHaveLength(4);
      expect(gruppenFuerRolle('admin')).toHaveLength(4);
    });

    it('bereinigeStumm: bekannte Kennungen entdoppelt in fester Reihenfolge, Unbekanntes -> null', () => {
      expect(bereinigeStumm([GRUPPE_TERMINE, GRUPPE_CHAT, GRUPPE_TERMINE])).toEqual([GRUPPE_CHAT, GRUPPE_TERMINE]);
      expect(bereinigeStumm([])).toEqual([]);
      expect(bereinigeStumm(['egal'])).toBeNull();
      expect(bereinigeStumm('konfi_chat')).toBeNull();
      expect(bereinigeStumm([42])).toBeNull();
    });
  });
});
