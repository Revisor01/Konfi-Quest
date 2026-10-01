// backend/tests/utils/mitteilungsKennung.test.js
//
// Tester-Rueckmeldung Build 130 (30.09.2026): Die Mitteilung zu einem Chat
// blieb in der Leiste, nachdem der Chat gelesen war. Auf Android findet die
// App eine liegende Mitteilung nur ueber ihren tag wieder -- der Push-Inhalt
// (data) ist dort nicht lesbar (utils/mitteilungsKennung.js). Diese Tests
// halten fest:
//   1. Jede sichtbare Mitteilung an Android traegt "kq:<art>:<raum>:<eindeutig>",
//      ausser auf dem Weg "mitteilungen" (fester tag, Zahl am Symbol).
//   2. Das Format des Servers ist das, das die App liest (notifications.ts).
const fs = require('fs');
const path = require('path');
const messagingModul = require('firebase-admin/messaging');
const appModul = require('firebase-admin/app');

// Wie in pushKanaele.test.js: Die Spies muessen stehen, BEVOR firebase.js
// geladen wird -- es bindet getMessaging beim Laden fest.
const gesendet = [];
vi.spyOn(messagingModul, 'getMessaging').mockReturnValue({
  send: async (message) => {
    gesendet.push(message);
    return 'test-message-id';
  }
});
vi.spyOn(appModul, 'cert').mockReturnValue({});
vi.spyOn(appModul, 'initializeApp').mockReturnValue({});
process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'test' });

const firebaseModul = require('../../push/firebase');
const { mitteilungsKennung, PRAEFIX } = require('../../utils/mitteilungsKennung');

describe('mitteilungsKennung', () => {
  it('Chat: Art, Raum und die Nachrichten-ID', () => {
    expect(mitteilungsKennung({ type: 'chat', roomId: '62', messageId: '4711' })).toBe('kq:chat:62:4711');
  });

  it('Chat mit room_id (aeltere Schreibweise) und Zahlen statt Text', () => {
    expect(mitteilungsKennung({ type: 'chat', room_id: 62, messageId: 4711 })).toBe('kq:chat:62:4711');
  });

  it('andere Arten: ohne Raum, mit zufaelligem Ende -- jede Mitteilung bleibt einzeln', () => {
    const a = mitteilungsKennung({ type: 'event_reminder', roomId: '62' });
    const b = mitteilungsKennung({ type: 'event_reminder' });
    expect(a).toMatch(/^kq:event_reminder::[0-9a-f]{8}$/);
    expect(b).toMatch(/^kq:event_reminder::[0-9a-f]{8}$/);
    expect(a).not.toBe(b);
  });

  it('ein Doppelpunkt in den Daten zerlegt das Format nicht', () => {
    expect(mitteilungsKennung({ type: 'chat', roomId: '6:2', messageId: '1:2' })).toBe('kq:chat:62:12');
    expect(mitteilungsKennung({ type: 'new:event', messageId: '1' })).toBe('kq:newevent::1');
  });

  it('ohne Daten: eine Kennung ohne Art, die die App keinem Bereich zuordnet', () => {
    expect(mitteilungsKennung()).toMatch(/^kq:::[0-9a-f]{8}$/);
  });
});

describe('sichtbare Mitteilung an Android traegt die Kennung', () => {
  beforeEach(() => {
    gesendet.length = 0;
  });

  it('Chat an ein Geraet ohne Weg (Pixel, Store-App ohne Angabe): tag mit Raum', async () => {
    await firebaseModul.sendFirebasePushNotification('token-x', {
      title: 'Jahrgang 2026', body: 'Neue Nachricht von Anna', badge: 3,
      data: { type: 'chat', roomId: '62', messageId: '4711' }
    });
    expect(gesendet).toHaveLength(1);
    expect(gesendet[0].android.notification.tag).toBe('kq:chat:62:4711');
    // Keine Zahl in der Mitteilung -- die setzt auf diesen Wegen die App.
    expect(gesendet[0].android.notification.notificationCount).toBeUndefined();
    // data bleibt unveraendert; iOS liest weiter daraus.
    expect(gesendet[0].data).toEqual({ type: 'chat', roomId: '62', messageId: '4711' });
  });

  it('Weg "anbieter" und "punkt": ebenfalls die Kennung', async () => {
    for (const weg of ['anbieter', 'punkt']) {
      await firebaseModul.sendFirebasePushNotification('token-x', {
        title: 'T', body: 'B', badge: 3, appSymbolWeg: weg, data: { type: 'chat', roomId: '9', messageId: '1' }
      });
    }
    expect(gesendet.map((m) => m.android.notification.tag)).toEqual(['kq:chat:9:1', 'kq:chat:9:1']);
  });

  it('Weg "mitteilungen" (Samsung, Xiaomi): der feste tag geht vor', async () => {
    await firebaseModul.sendFirebasePushNotification('token-x', {
      title: 'T', body: 'B', badge: 3, appSymbolWeg: 'mitteilungen', data: { type: 'chat', roomId: '62', messageId: '4711' }
    });
    expect(gesendet[0].android.notification.tag).toBe('konfi_app_symbol');
    expect(gesendet[0].android.notification.notificationCount).toBe(3);
  });

  it('der stille Zahl-Push bekommt keinen tag -- er zeigt nichts an', async () => {
    await firebaseModul.sendFirebaseSilentPush('token-x', 5);
    expect(gesendet[0].android.notification).toBeUndefined();
  });
});

describe('Server und App lesen dasselbe Format', () => {
  const app = fs.readFileSync(path.join(__dirname, '../../../frontend/src/services/notifications.ts'), 'utf8');

  it('dasselbe Praefix', () => {
    expect(PRAEFIX).toBe('kq');
    expect(app).toContain(`export const TAG_PRAEFIX = '${PRAEFIX}';`);
  });

  it('dieselbe Reihenfolge: Praefix, Art, Raum', () => {
    expect(app).toContain("const [praefix, art, raum] = tag.split(':');");
  });
});
