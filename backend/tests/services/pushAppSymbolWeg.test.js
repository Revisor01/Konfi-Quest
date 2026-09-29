// backend/tests/services/pushAppSymbolWeg.test.js
//
// Zahl am App-Symbol auf Android je Geraeteart (29.09.2026).
//
// Simon am Sony Xperia 1 VI (Testbuild 128): "App Symbol mit Zahl ist bei mir
// leider nur ein kleiner blauer Kreis [...] Waehrend WhatsApp z. B. wirklich
// eine Zahl da vorhaelt." -- "Ich will Android exakt gleich wie iOS."
//
// Die App meldet bei der Token-Anmeldung, welcher Weg zum Startbildschirm
// passt (push_tokens.app_symbol_weg, utils/appSymbolWeg.js). Diese Tests
// halten fest, was je Geraet an FCM geht:
//
//   anbieter      die sichtbare Mitteilung unveraendert, danach ein stilles
//                 badge_update mit derselben Zahl
//   ohne Angabe   genau das, was bisher ging -- kein zusaetzliches Paket
//   iOS           unveraendert (aps.badge setzt die Zahl)
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { invalidateUserCache } = require('../../middleware/rbac');

const firebase = require('../../push/firebase');
const sichtbar = vi.spyOn(firebase, 'sendFirebasePushNotification').mockResolvedValue({ success: true });
const still = vi.spyOn(firebase, 'sendFirebaseSilentPush').mockResolvedValue({ success: true });

const PushService = require('../../services/pushService');

const ORG1 = ORGS.testGemeinde.id;

describe('Zahl am App-Symbol auf Android: Versand je Geraeteart', () => {
  let db;

  beforeAll(() => { db = getTestPool(); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    sichtbar.mockReset();
    sichtbar.mockResolvedValue({ success: true });
    still.mockReset();
    still.mockResolvedValue({ success: true });
    for (const u of Object.values(USERS)) invalidateUserCache(u.id);

    // Konfi 1 mit vier Geraeten: Sony (Weg anbieter), Samsung (mitteilungen),
    // ein Android mit der Store-App ohne Angabe und ein iPhone.
    await db.query(
      `INSERT INTO push_tokens (user_id, token, platform, device_id, app_version, app_symbol_weg, startbildschirm)
       VALUES ($1, 'tok-sony',    'android', 'dev-sony',    '2.3.0', 'anbieter',     'com.sonymobile.launcher'),
              ($1, 'tok-samsung', 'android', 'dev-samsung', '2.3.0', 'mitteilungen', 'com.sec.android.app.launcher'),
              ($1, 'tok-alt',     'android', 'dev-alt',     NULL,    NULL,           NULL),
              ($1, 'tok-iphone',  'ios',     'dev-iphone',  '2.3.0', NULL,           NULL)`,
      [USERS.konfi1.id]
    );
  });

  const aufrufeAn = (spy, token) => spy.mock.calls.filter(([t]) => t === token);

  it('schickt dem Geraet mit Zahl-Anbieter nach der Mitteilung die Zahl still hinterher', async () => {
    await PushService.sendToUser(db, USERS.konfi1.id, { title: 'X', body: 'Y', badge: 4, data: { type: 'info' } });

    expect(aufrufeAn(sichtbar, 'tok-sony')).toHaveLength(1);
    const stillSony = aufrufeAn(still, 'tok-sony');
    expect(stillSony).toHaveLength(1);
    expect(stillSony[0][1]).toBe(4);
  });

  it('schickt Geraeten ohne Angabe, mit Weg "mitteilungen" und iPhones kein zusaetzliches Paket', async () => {
    await PushService.sendToUser(db, USERS.konfi1.id, { title: 'X', body: 'Y', badge: 4, data: { type: 'info' } });

    // Alle vier bekommen die sichtbare Mitteilung genau einmal ...
    for (const token of ['tok-sony', 'tok-samsung', 'tok-alt', 'tok-iphone']) {
      expect(aufrufeAn(sichtbar, token)).toHaveLength(1);
    }
    // ... still hinterher nur das Sony.
    expect(still.mock.calls.map(([t]) => t)).toEqual(['tok-sony']);
  });

  it('laesst die sichtbare Mitteilung an Geraete ohne Angabe unveraendert', async () => {
    const notification = { title: 'X', body: 'Y', badge: 4, data: { type: 'info', organization_id: String(ORG1) } };
    await PushService.sendToUser(db, USERS.konfi1.id, notification);

    const [[, nutzlast]] = aufrufeAn(sichtbar, 'tok-alt');
    expect(nutzlast).toEqual({
      title: 'X', body: 'Y', badge: 4, sound: 'default',
      data: { type: 'info', organization_id: String(ORG1) },
    });
  });

  it('schickt die Zahl nicht hinterher, wenn die Mitteilung nicht ankam', async () => {
    sichtbar.mockImplementation(async (token) => (token === 'tok-sony'
      ? { success: false, error: 'weg', errorCode: 'messaging/registration-token-not-registered' }
      : { success: true }));

    await PushService.sendToUser(db, USERS.konfi1.id, { title: 'X', body: 'Y', badge: 4, data: { type: 'info' } });

    expect(still).not.toHaveBeenCalled();
  });

  it('ein Fehler beim stillen Paket kippt die zugestellte Mitteilung nicht', async () => {
    still.mockResolvedValue({ success: false, error: 'quota', errorCode: 'messaging/invalid-argument' });

    const ergebnis = await PushService.sendToUser(db, USERS.konfi1.id, { title: 'X', body: 'Y', badge: 4, data: { type: 'info' } });

    expect(ergebnis).toEqual({ success: true, sent: 4, errors: 0, total: 4 });
    // Das Sony bleibt eingetragen: Nur die sichtbare Mitteilung entscheidet
    // ueber den Token.
    const { rows } = await db.query('SELECT token FROM push_tokens WHERE user_id = $1 ORDER BY token', [USERS.konfi1.id]);
    expect(rows.map((r) => r.token)).toEqual(['tok-alt', 'tok-iphone', 'tok-samsung', 'tok-sony']);
  });

  it('traegt still dieselbe Zahl wie die Mitteilung, auch wenn der Server sie rechnet', async () => {
    // Eine laufende, nie geoeffnete Challenge: eine Neuigkeit, volle Zahl 1.
    const { rows: [c] } = await db.query(
      `INSERT INTO challenges (organization_id, title, description, badge_name,
                               starts_at, ends_at, is_draft, audience)
       VALUES ($1, 'Neu', 'B', 'A', NOW() - interval '1 day',
               NOW() + interval '7 days', false, 'konfis') RETURNING id`,
      [ORG1]
    );
    await db.query(
      'INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id) VALUES ($1, $2)',
      [c.id, JAHRGAENGE.jahrgang1.id]
    );

    await PushService.sendToMultipleUsers(db, [USERS.konfi1.id], { title: 'X', body: 'Y', data: { type: 'event_changed' } });

    const [[, nutzlast]] = aufrufeAn(sichtbar, 'tok-sony');
    expect(nutzlast.badge).toBe(1);
    expect(aufrufeAn(still, 'tok-sony')).toEqual([['tok-sony', 1]]);
  });

  it('gilt auch fuer den Chat-Push', async () => {
    await PushService.sendChatNotificationToMany(db, [USERS.konfi1.id], {
      title: 'Chat', body: 'Hallo', roomId: 1, messageId: 1,
      data: { sender_id: USERS.teamer1.id, sender_name: 'T', room_name: 'R', organization_id: ORG1 }
    });

    expect(still.mock.calls.map(([t]) => t)).toEqual(['tok-sony']);
  });

  it('ein iPhone mit (unzulaessig) gesetztem Weg bekommt trotzdem nichts zusaetzlich', async () => {
    // Die Route speichert fuer iOS keinen Weg; steht doch einer in der
    // Tabelle, entscheidet die Plattform.
    await db.query(`UPDATE push_tokens SET app_symbol_weg = 'anbieter' WHERE token = 'tok-iphone'`);

    await PushService.sendToUser(db, USERS.konfi1.id, { title: 'X', body: 'Y', badge: 4, data: { type: 'info' } });

    expect(still.mock.calls.map(([t]) => t)).toEqual(['tok-sony']);
  });
});
