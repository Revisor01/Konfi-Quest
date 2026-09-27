// backend/tests/services/appSymbolAlteApps.test.js
//
// Zahl am App-Symbol fuer die Store-Apps 2.2.x (Kompatibilitaetspruefung vor
// dem Deploy von 2.3.0, 27.09.2026).
//
// Seit dem 24./25.09.2026 zaehlt die Zahl, die der Server mit jedem Push als
// aps.badge (iOS) schickt, auch die ungelesenen Postfach-Mitteilungen und die
// Challenge-Neuigkeiten. Die Store-App 2.2.0 (Tag 2.2.0, 18.09.2026) kennt
// beides nicht: kein Postfach, kein mark-read fuer Challenges
// (frontend/src/contexts/BadgeContext.tsx:73-81 am Tag). Sie kann diese
// Anteile nie abbauen -- die Zahl am Symbol bliebe dauerhaft zu hoch.
//
// Geraete der alten App erkennt der Server daran, dass sie ihren Push-Token
// ohne app_version melden (2.3.0 schickt die Version mit, Migration 156).
// Fuer sie geht die Zahl nach der Rechnung von 2.2.0 raus: ohne Postfach,
// ohne Challenge-Neuigkeiten. Neue Geraete bekommen die volle Zahl.
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS } = require('../helpers/seed');
const { invalidateUserCache } = require('../../middleware/rbac');

const firebase = require('../../push/firebase');
const sichtbar = vi.spyOn(firebase, 'sendFirebasePushNotification').mockResolvedValue({ success: true });
const still = vi.spyOn(firebase, 'sendFirebaseSilentPush').mockResolvedValue({ success: true });

const PushService = require('../../services/pushService');
const BackgroundService = require('../../services/backgroundService');

const ORG1 = ORGS.testGemeinde.id;

describe('Zahl am App-Symbol: alte Apps ohne Postfach-Anteil', () => {
  let db;

  beforeAll(() => { db = getTestPool(); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    sichtbar.mockClear();
    still.mockClear();
    BackgroundService.letzterZaehler.clear();
    if (BackgroundService.letzterZaehlerAlteApps) BackgroundService.letzterZaehlerAlteApps.clear();
    BackgroundService.zaehlerMerkerGefuellt = true;
    for (const u of Object.values(USERS)) invalidateUserCache(u.id);

    // Konfi 1 hat zwei Geraete: eines mit 2.3.0, eines mit der Store-App 2.2.x.
    await db.query(
      `INSERT INTO push_tokens (user_id, token, platform, device_id, app_version)
       VALUES ($1, 'tok-neu', 'ios', 'dev-neu', '2.3.0'),
              ($1, 'tok-alt', 'ios', 'dev-alt', NULL)`,
      [USERS.konfi1.id]
    );
    // Drei ungelesene Postfach-Mitteilungen -- die alte App kennt kein Postfach.
    for (let i = 0; i < 3; i++) {
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type, data, organization_id)
         VALUES ($1, 'T', 'M', 'info', '{}'::jsonb, $2)`,
        [USERS.konfi1.id, ORG1]
      );
    }
  });

  const zahlAn = (spy, token) => {
    const aufrufe = spy.mock.calls.filter(([t]) => t === token);
    expect(aufrufe.length).toBeGreaterThan(0);
    const letzter = aufrufe[aufrufe.length - 1][1];
    return typeof letzter === 'object' ? letzter.badge : letzter;
  };

  it('sichtbarer Push: neues Geraet mit Postfach, altes ohne', async () => {
    const ohnePostfach = (await PushService.berechneBadgesFuerAlle(db, [USERS.konfi1.id])).badgesAlteApps.get(USERS.konfi1.id);
    await PushService.sendToUser(db, USERS.konfi1.id, { title: 'X', body: 'Y', data: { type: 'info' } });

    expect(zahlAn(sichtbar, 'tok-neu')).toBe(ohnePostfach + 3);
    expect(zahlAn(sichtbar, 'tok-alt')).toBe(ohnePostfach);
  });

  it('Push an viele: dieselbe Unterscheidung je Geraet', async () => {
    const ohnePostfach = (await PushService.berechneBadgesFuerAlle(db, [USERS.konfi1.id])).badgesAlteApps.get(USERS.konfi1.id);
    // Eine Art mit Postfach-Eintrag: Der Versand schreibt ihn VOR der
    // Rechnung, die neue Mitteilung zaehlt also schon mit -- nur nicht fuer
    // das alte Geraet.
    await PushService.sendToMultipleUsers(db, [USERS.konfi1.id], { title: 'X', body: 'Y', data: { type: 'event_changed' } });

    expect(zahlAn(sichtbar, 'tok-neu')).toBe(ohnePostfach + 4);
    expect(zahlAn(sichtbar, 'tok-alt')).toBe(ohnePostfach);
  });

  it('Chat-Push: dieselbe Unterscheidung je Geraet', async () => {
    const ohnePostfach = (await PushService.berechneBadgesFuerAlle(db, [USERS.konfi1.id])).badgesAlteApps.get(USERS.konfi1.id);
    await PushService.sendChatNotificationToMany(db, [USERS.konfi1.id], {
      title: 'Chat', body: 'Hallo', roomId: 1, messageId: 1,
      data: { sender_id: USERS.teamer1.id, sender_name: 'T', room_name: 'R', organization_id: ORG1 }
    });

    expect(zahlAn(sichtbar, 'tok-neu')).toBe(ohnePostfach + 3);
    expect(zahlAn(sichtbar, 'tok-alt')).toBe(ohnePostfach);
  });

  it('stiller Push fuer eine Person: dieselbe Unterscheidung', async () => {
    const ohnePostfach = (await PushService.berechneBadgesFuerAlle(db, [USERS.konfi1.id])).badgesAlteApps.get(USERS.konfi1.id);
    await PushService.sendBadgeUpdate(db, USERS.konfi1.id);

    expect(zahlAn(still, 'tok-neu')).toBe(ohnePostfach + 3);
    expect(zahlAn(still, 'tok-alt')).toBe(ohnePostfach);
  });

  it('Hintergrundlauf: dieselbe Unterscheidung je Geraet', async () => {
    await BackgroundService.updateAllUserBadges(db, { nurZaehler: true });
    const ohnePostfach = (await PushService.berechneBadgesFuerAlle(db, [USERS.konfi1.id])).badgesAlteApps.get(USERS.konfi1.id);
    expect(zahlAn(still, 'tok-neu')).toBe(ohnePostfach + 3);
    expect(zahlAn(still, 'tok-alt')).toBe(ohnePostfach);

    // Die Mitteilungen werden gelesen: Die volle Zahl sinkt, die alte bleibt.
    still.mockClear();
    await db.query('UPDATE notifications SET read_at = NOW() WHERE user_id = $1', [USERS.konfi1.id]);
    await BackgroundService.updateAllUserBadges(db, { nurZaehler: true });
    expect(zahlAn(still, 'tok-neu')).toBe(ohnePostfach);
    expect(zahlAn(still, 'tok-alt')).toBe(ohnePostfach);
  });

  it('Hintergrundlauf sendet auch, wenn sich NUR die Zahl der alten Apps aendert', async () => {
    await BackgroundService.updateAllUserBadges(db, { nurZaehler: true });
    const vorher = await PushService.berechneBadgesFuerAlle(db, [USERS.konfi1.id]);

    // Eine Mitteilung gelesen (-1 nur voll), ein neues ungesehenes Abzeichen
    // (+1 in beiden): Die volle Zahl bleibt gleich, die alte steigt um eins.
    still.mockClear();
    await db.query(
      `UPDATE notifications SET read_at = NOW()
        WHERE id = (SELECT MIN(id) FROM notifications WHERE user_id = $1)`,
      [USERS.konfi1.id]
    );
    await db.query(
      'INSERT INTO user_badges (user_id, badge_id, organization_id) VALUES ($1, 1, $2)',
      [USERS.konfi1.id, ORG1]
    );
    const nachher = await PushService.berechneBadgesFuerAlle(db, [USERS.konfi1.id]);
    expect(nachher.badges.get(USERS.konfi1.id)).toBe(vorher.badges.get(USERS.konfi1.id));
    expect(nachher.badgesAlteApps.get(USERS.konfi1.id)).toBe(vorher.badgesAlteApps.get(USERS.konfi1.id) + 1);

    await BackgroundService.updateAllUserBadges(db, { nurZaehler: true });
    expect(zahlAn(still, 'tok-alt')).toBe(vorher.badgesAlteApps.get(USERS.konfi1.id) + 1);
  });

  it('ohne ungelesene Mitteilungen bekommen beide dieselbe Zahl', async () => {
    await db.query('UPDATE notifications SET read_at = NOW() WHERE user_id = $1', [USERS.konfi1.id]);
    await PushService.sendToUser(db, USERS.konfi1.id, { title: 'X', body: 'Y', data: { type: 'info' } });
    expect(zahlAn(sichtbar, 'tok-neu')).toBe(zahlAn(sichtbar, 'tok-alt'));
  });

  it('eine ausdruecklich uebergebene Zahl gilt fuer alle Geraete', async () => {
    await PushService.sendToUser(db, USERS.konfi1.id, { title: 'X', body: 'Y', badge: 7, data: { type: 'info' } });
    expect(zahlAn(sichtbar, 'tok-neu')).toBe(7);
    expect(zahlAn(sichtbar, 'tok-alt')).toBe(7);
  });
});
