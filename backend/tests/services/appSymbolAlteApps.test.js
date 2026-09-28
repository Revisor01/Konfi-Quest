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
// Fuer sie geht die Zahl nach der Rechnung von 2.2.0 raus: ohne
// Challenge-Neuigkeiten. Neue Geraete bekommen die volle Zahl.
//
// POSTFACH (28.09.2026, Simon): Ungelesene Mitteilungen zaehlen seitdem auf
// KEINEM Geraet mehr mit -- die Glocke zeigt einen Briefumschlag statt einer
// Zahl. Die drei ungelesenen Mitteilungen im Aufbau bleiben absichtlich
// stehen: Kaemen sie zurueck in die Summe, fielen die konkreten Zahlen unten.
// Einziger Unterschied zwischen den Geraeten sind jetzt die
// Challenge-Neuigkeiten (hier: eine laufende, nie geoeffnete Challenge).
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { invalidateUserCache } = require('../../middleware/rbac');

const firebase = require('../../push/firebase');
const sichtbar = vi.spyOn(firebase, 'sendFirebasePushNotification').mockResolvedValue({ success: true });
const still = vi.spyOn(firebase, 'sendFirebaseSilentPush').mockResolvedValue({ success: true });

const PushService = require('../../services/pushService');
const BackgroundService = require('../../services/backgroundService');

const ORG1 = ORGS.testGemeinde.id;

describe('Zahl am App-Symbol: alte Apps ohne Challenge-Neuigkeiten, Postfach nirgends', () => {
  let challengeId;
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
    // Drei ungelesene Postfach-Mitteilungen -- sie zaehlen auf keinem Geraet.
    for (let i = 0; i < 3; i++) {
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type, data, organization_id)
         VALUES ($1, 'T', 'M', 'info', '{}'::jsonb, $2)`,
        [USERS.konfi1.id, ORG1]
      );
    }
    // Eine laufende Challenge fuer Konfi 1s Jahrgang, nie geoeffnet: eine
    // Challenge-Neuigkeit -- die alte App kann sie nicht abbauen.
    const { rows: [c] } = await db.query(
      `INSERT INTO challenges (organization_id, title, description, badge_name,
                               starts_at, ends_at, is_draft, audience)
       VALUES ($1, 'Neu', 'B', 'A', NOW() - interval '1 day',
               NOW() + interval '7 days', false, 'konfis') RETURNING id`,
      [ORG1]
    );
    challengeId = c.id;
    await db.query(
      'INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id) VALUES ($1, $2)',
      [challengeId, JAHRGAENGE.jahrgang1.id]
    );
  });

  const challengeGeoeffnet = () => db.query(
    `INSERT INTO challenge_read_status (challenge_id, user_id, user_type, last_read_at)
     VALUES ($1, $2, 'konfi', NOW())`,
    [challengeId, USERS.konfi1.id]
  );

  const zahlAn = (spy, token) => {
    const aufrufe = spy.mock.calls.filter(([t]) => t === token);
    expect(aufrufe.length).toBeGreaterThan(0);
    const letzter = aufrufe[aufrufe.length - 1][1];
    return typeof letzter === 'object' ? letzter.badge : letzter;
  };

  it('die Rechnung selbst: volle Zahl 1 (Neuigkeit), alte Apps 0 -- die drei Mitteilungen zaehlen nirgends', async () => {
    const { badges, badgesAlteApps } = await PushService.berechneBadgesFuerAlle(db, [USERS.konfi1.id]);
    expect(badges.get(USERS.konfi1.id)).toBe(1);
    expect(badgesAlteApps.get(USERS.konfi1.id)).toBe(0);
  });

  it('sichtbarer Push: neues Geraet 1, altes 0', async () => {
    await PushService.sendToUser(db, USERS.konfi1.id, { title: 'X', body: 'Y', data: { type: 'info' } });

    expect(zahlAn(sichtbar, 'tok-neu')).toBe(1);
    expect(zahlAn(sichtbar, 'tok-alt')).toBe(0);
  });

  it('Push an viele: dieselbe Unterscheidung je Geraet', async () => {
    // Eine Art mit Postfach-Eintrag: Der Versand schreibt ihn VOR der
    // Rechnung. Er zaehlt trotzdem nicht -- weder neu noch alt.
    await PushService.sendToMultipleUsers(db, [USERS.konfi1.id], { title: 'X', body: 'Y', data: { type: 'event_changed' } });

    const { rows: [{ c }] } = await db.query(
      'SELECT COUNT(*)::int AS c FROM notifications WHERE user_id = $1 AND read_at IS NULL',
      [USERS.konfi1.id]
    );
    expect(c).toBe(4);
    expect(zahlAn(sichtbar, 'tok-neu')).toBe(1);
    expect(zahlAn(sichtbar, 'tok-alt')).toBe(0);
  });

  it('Chat-Push: dieselbe Unterscheidung je Geraet', async () => {
    await PushService.sendChatNotificationToMany(db, [USERS.konfi1.id], {
      title: 'Chat', body: 'Hallo', roomId: 1, messageId: 1,
      data: { sender_id: USERS.teamer1.id, sender_name: 'T', room_name: 'R', organization_id: ORG1 }
    });

    expect(zahlAn(sichtbar, 'tok-neu')).toBe(1);
    expect(zahlAn(sichtbar, 'tok-alt')).toBe(0);
  });

  it('stiller Push fuer eine Person: dieselbe Unterscheidung', async () => {
    await PushService.sendBadgeUpdate(db, USERS.konfi1.id);

    expect(zahlAn(still, 'tok-neu')).toBe(1);
    expect(zahlAn(still, 'tok-alt')).toBe(0);
  });

  it('Hintergrundlauf: dieselbe Unterscheidung je Geraet', async () => {
    await BackgroundService.updateAllUserBadges(db, { nurZaehler: true });
    expect(zahlAn(still, 'tok-neu')).toBe(1);
    expect(zahlAn(still, 'tok-alt')).toBe(0);

    // Die Challenge wird geoeffnet: Die volle Zahl sinkt, die alte bleibt.
    still.mockClear();
    await challengeGeoeffnet();
    await BackgroundService.updateAllUserBadges(db, { nurZaehler: true });
    expect(zahlAn(still, 'tok-neu')).toBe(0);
    expect(zahlAn(still, 'tok-alt')).toBe(0);
  });

  it('Hintergrundlauf: Mitteilungen lesen aendert keine der beiden Zahlen -- kein Versand', async () => {
    await BackgroundService.updateAllUserBadges(db, { nurZaehler: true });
    still.mockClear();
    await db.query('UPDATE notifications SET read_at = NOW() WHERE user_id = $1', [USERS.konfi1.id]);
    await BackgroundService.updateAllUserBadges(db, { nurZaehler: true });
    expect(still.mock.calls.filter(([t]) => t === 'tok-neu' || t === 'tok-alt')).toEqual([]);
  });

  it('Hintergrundlauf sendet auch, wenn sich NUR die Zahl der alten Apps aendert', async () => {
    await BackgroundService.updateAllUserBadges(db, { nurZaehler: true });

    // Challenge geoeffnet (-1 nur voll), ein neues ungesehenes Abzeichen
    // (+1 in beiden): Die volle Zahl bleibt 1, die alte steigt auf 1.
    still.mockClear();
    await challengeGeoeffnet();
    await db.query(
      'INSERT INTO user_badges (user_id, badge_id, organization_id) VALUES ($1, 1, $2)',
      [USERS.konfi1.id, ORG1]
    );
    const nachher = await PushService.berechneBadgesFuerAlle(db, [USERS.konfi1.id]);
    expect(nachher.badges.get(USERS.konfi1.id)).toBe(1);
    expect(nachher.badgesAlteApps.get(USERS.konfi1.id)).toBe(1);

    await BackgroundService.updateAllUserBadges(db, { nurZaehler: true });
    expect(zahlAn(still, 'tok-alt')).toBe(1);
  });

  it('ohne Challenge-Neuigkeit bekommen beide dieselbe Zahl -- trotz ungelesener Mitteilungen', async () => {
    await challengeGeoeffnet();
    await PushService.sendToUser(db, USERS.konfi1.id, { title: 'X', body: 'Y', data: { type: 'info' } });
    expect(zahlAn(sichtbar, 'tok-neu')).toBe(0);
    expect(zahlAn(sichtbar, 'tok-alt')).toBe(0);
  });

  it('eine ausdruecklich uebergebene Zahl gilt fuer alle Geraete', async () => {
    await PushService.sendToUser(db, USERS.konfi1.id, { title: 'X', body: 'Y', badge: 7, data: { type: 'info' } });
    expect(zahlAn(sichtbar, 'tok-neu')).toBe(7);
    expect(zahlAn(sichtbar, 'tok-alt')).toBe(7);
  });
});
