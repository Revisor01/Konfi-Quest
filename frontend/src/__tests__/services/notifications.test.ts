import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---
let isNative = true;
let plattform = 'ios';
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => isNative,
    getPlatform: () => plattform,
  },
}));

const getDeliveredNotifications = vi.fn();
const removeDeliveredNotifications = vi.fn();
const removeAllDeliveredNotifications = vi.fn();
vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    getDeliveredNotifications: (...args: unknown[]) => getDeliveredNotifications(...args),
    removeDeliveredNotifications: (...args: unknown[]) => removeDeliveredNotifications(...args),
    removeAllDeliveredNotifications: (...args: unknown[]) => removeAllDeliveredNotifications(...args),
  },
}));

import * as benachrichtigungen from '../../services/notifications';
import {
  removeDeliveredById,
  removeDeliveredForChatRoom,
  removeDeliveredForEvents,
  aufraeumenNachholen,
} from '../../services/notifications';

// Nur die Felder, die der Code auswertet — die Tests liefern bewusst
// unvollstaendige Notifications (u.a. ganz ohne data). Auf Android ist die id
// eine Zahl und der tag gesetzt (PushNotificationsPlugin.java).
type TestNotification = { id: string | number; tag?: string; data?: Record<string, unknown> };

const delivered = (notifications: TestNotification[]) => {
  getDeliveredNotifications.mockResolvedValue({ notifications });
  removeDeliveredNotifications.mockResolvedValue(undefined);
};

beforeEach(() => {
  isNative = true;
  plattform = 'ios';
  getDeliveredNotifications.mockReset();
  removeDeliveredNotifications.mockReset();
  removeAllDeliveredNotifications.mockReset();
});

describe('removeDeliveredById', () => {
  /*
   * DER ABSTURZ, DEN DIESE TESTS ABSICHERN (Android Vitals, 23.09.2026):
   * 4 betroffene Nutzende, 16 Abstuerze in 28 Tagen, vier Geraete, alle im
   * Vordergrund. Das Android-Plugin liest `notif.getInteger("id")` und ruft
   * damit `notificationManager.cancel(id)`. Bei einer nicht-numerischen id ist
   * das null, das Entpacken wirft eine NullPointerException — NATIV, im
   * Bridge-Thread. Das try/catch im Service faengt das nicht, also darf eine
   * nicht-numerische id den Aufruf gar nicht erreichen.
   *
   * Der frueher hier stehende Test erwartete genau das Gegenteil
   * (`notifications: [{ id: 'abc' }]`) und hat den Absturz mit abgesichert.
   * Die Erwartung war nachweislich falsch, nicht bloss streng.
   */
  it('entfernt genau die Notification mit der id — als ZAHL', async () => {
    removeDeliveredNotifications.mockResolvedValue(undefined);
    await removeDeliveredById('42');
    expect(removeDeliveredNotifications).toHaveBeenCalledWith({
      notifications: [{ id: 42 }],
    });
  });

  it('nimmt eine id auch als Zahl an', async () => {
    removeDeliveredNotifications.mockResolvedValue(undefined);
    await removeDeliveredById(7);
    expect(removeDeliveredNotifications).toHaveBeenCalledWith({
      notifications: [{ id: 7 }],
    });
  });

  it('ruft das Plugin NICHT mit einer nicht-numerischen id — der verbotene Fall', async () => {
    await removeDeliveredById('abc');
    expect(removeDeliveredNotifications).not.toHaveBeenCalled();
  });

  it('laesst auch eine halb-numerische id nicht durch', async () => {
    // Number('12abc') ist NaN — parseInt waere 12 gewesen und haette die
    // falsche Mitteilung entfernt.
    await removeDeliveredById('12abc');
    expect(removeDeliveredNotifications).not.toHaveBeenCalled();
  });

  it('laesst eine Kommazahl nicht durch', async () => {
    await removeDeliveredById('1.5');
    expect(removeDeliveredNotifications).not.toHaveBeenCalled();
  });

  it('ist no-op ohne id', async () => {
    await removeDeliveredById('');
    expect(removeDeliveredNotifications).not.toHaveBeenCalled();
  });

  it('ist no-op im Web (nicht-nativ)', async () => {
    isNative = false;
    await removeDeliveredById('abc');
    expect(removeDeliveredNotifications).not.toHaveBeenCalled();
  });
});

describe('removeDeliveredForChatRoom', () => {
  it('entfernt nur Chat-Notifications des passenden Raums', async () => {
    delivered([
      { id: '1', data: { type: 'chat', roomId: 62 } },
      { id: '2', data: { type: 'chat', roomId: 99 } },
      { id: '3', data: { type: 'event_reminder' } },
      { id: '4', data: { type: 'chat', room_id: '62' } }, // String + alternativer Key
    ]);
    await removeDeliveredForChatRoom(62);
    expect(removeDeliveredNotifications).toHaveBeenCalledTimes(1);
    const arg = removeDeliveredNotifications.mock.calls[0][0] as { notifications: { id: string }[] };
    expect(arg.notifications.map((n) => n.id).sort()).toEqual(['1', '4']);
  });

  it('entfernt nichts, wenn kein Raum passt', async () => {
    delivered([{ id: '1', data: { type: 'chat', roomId: 7 } }]);
    await removeDeliveredForChatRoom(62);
    expect(removeDeliveredNotifications).not.toHaveBeenCalled();
  });

  it('laesst Notifications ohne data unangetastet', async () => {
    delivered([{ id: '1' }, { id: '2', data: undefined }]);
    await removeDeliveredForChatRoom(62);
    expect(removeDeliveredNotifications).not.toHaveBeenCalled();
  });
});

describe('removeDeliveredForEvents', () => {
  it('entfernt alle event-bezogenen Notification-Typen', async () => {
    delivered([
      { id: '1', data: { type: 'new_event' } },
      { id: '2', data: { type: 'event_reminder' } },
      { id: '3', data: { type: 'chat', roomId: 1 } },
      { id: '4', data: { type: 'badge_earned' } },
    ]);
    await removeDeliveredForEvents();
    const arg = removeDeliveredNotifications.mock.calls[0][0] as { notifications: { id: string }[] };
    expect(arg.notifications.map((n) => n.id).sort()).toEqual(['1', '2']);
  });

  it('ist no-op im Web', async () => {
    isNative = false;
    await removeDeliveredForEvents();
    expect(getDeliveredNotifications).not.toHaveBeenCalled();
  });
});

// Tester-Rueckmeldung Build 130 (30.09.2026): Die Mitteilung zu einem Chat
// blieb in der Leiste, nachdem der Chat gelesen war. Simon: "Das ist ein Bug."
//
// Auf Android liefert getDeliveredNotifications als `data` NICHT den
// Push-Inhalt, sondern die Notification.extras (android.title, android.text
// ...). Den Push-Inhalt legt das FCM-SDK nur in den Intent zum Antippen. Der
// Vergleich auf data.type/data.roomId traf deshalb nie. Lesbar bleibt der tag:
// Der Server schreibt Art und Raum hinein (backend/utils/mitteilungsKennung.js,
// "kq:<art>:<raum>:<eindeutig>"). Die Formen unten sind die, die das Plugin
// auf Android tatsaechlich liefert: id 0, tag, extras.
describe('Android: Art und Raum stehen im tag, nicht in data', () => {
  const extras = (titel: string) => ({ 'android.title': titel, 'android.text': 'Neue Nachricht von Anna' });

  beforeEach(() => {
    plattform = 'android';
  });

  it('entfernt die Mitteilungen des gelesenen Chats und gibt sie mit id UND tag zurueck', async () => {
    delivered([
      { id: 0, tag: 'kq:chat:62:4711', data: extras('Jahrgang 2026') },
      { id: 0, tag: 'kq:chat:62:4712', data: extras('Jahrgang 2026') },
      { id: 0, tag: 'kq:chat:99:4713', data: extras('Team') },
      { id: 0, tag: 'kq:event_reminder::a1b2c3d4', data: extras('Morgen') },
    ]);
    await removeDeliveredForChatRoom(62);
    expect(removeDeliveredNotifications).toHaveBeenCalledTimes(1);
    // Das Plugin raeumt per cancel(tag, id) -- beides muss zurueckkommen.
    expect(removeDeliveredNotifications.mock.calls[0][0]).toEqual({
      notifications: [
        { id: 0, tag: 'kq:chat:62:4711', data: extras('Jahrgang 2026') },
        { id: 0, tag: 'kq:chat:62:4712', data: extras('Jahrgang 2026') },
      ],
    });
  });

  it('Raum 6 ist nicht Raum 62', async () => {
    delivered([{ id: 0, tag: 'kq:chat:62:1', data: extras('A') }]);
    await removeDeliveredForChatRoom(6);
    expect(removeDeliveredNotifications).not.toHaveBeenCalled();
  });

  it('laesst fremde tags liegen: FCM ohne Kennung und die Zahl-Mitteilung auf Samsung', async () => {
    // FCM-Notification:<Zeit> -- Mitteilungen von Servern vor dieser Aenderung.
    // konfi_app_symbol -- auf Samsung/Xiaomi traegt diese EINE Mitteilung die
    // Zahl am Symbol (utils/appSymbolWeg.js); sie geht erst bei 0 (AppSymbolZahl).
    delivered([
      { id: 0, tag: 'FCM-Notification:123456', data: extras('A') },
      { id: 0, tag: 'konfi_app_symbol', data: extras('B') },
      { id: 0, data: extras('C') },
    ]);
    await removeDeliveredForChatRoom(62);
    await removeDeliveredForEvents();
    expect(removeDeliveredNotifications).not.toHaveBeenCalled();
  });

  it('entfernt beim Oeffnen der Events die Event-Mitteilungen, nicht den Chat', async () => {
    delivered([
      { id: 0, tag: 'kq:event_reminder::a1b2c3d4', data: extras('Morgen') },
      { id: 0, tag: 'kq:new_event::e5f6a7b8', data: extras('Neu') },
      { id: 0, tag: 'kq:chat:62:4711', data: extras('Chat') },
      { id: 0, tag: 'kq:badge_earned::0a0b0c0d', data: extras('Badge') },
    ]);
    await removeDeliveredForEvents();
    const arg = removeDeliveredNotifications.mock.calls[0][0] as { notifications: { tag: string }[] };
    expect(arg.notifications.map((n) => n.tag)).toEqual(['kq:event_reminder::a1b2c3d4', 'kq:new_event::e5f6a7b8']);
  });
});

// iOS: Das Plugin verweigert getDeliveredNotifications, bis die App fuer
// Pushes registriert ist ("event capacitorDidRegisterForRemoteNotifications
// not called", PushNotificationsPlugin.swift). Genau das passiert, wenn ein
// Push die App kalt startet und sie gleich in den Chat springt: Der Raum wird
// gelesen, bevor die Registrierung durch ist. Das Aufraeumen ging dabei
// verloren -- die uebrigen Mitteilungen des Chats blieben liegen.
describe('iOS: Aufraeumen vor der Registrierung wird nachgeholt', () => {
  it('holt einen verweigerten Chat nach, sobald die Registrierung da ist', async () => {
    getDeliveredNotifications.mockRejectedValueOnce(
      new Error('event capacitorDidRegisterForRemoteNotifications not called.'),
    );
    await removeDeliveredForChatRoom(62);
    expect(removeDeliveredNotifications).not.toHaveBeenCalled();

    delivered([
      { id: 'A', data: { type: 'chat', roomId: '62' } },
      { id: 'B', data: { type: 'chat', roomId: '7' } },
    ]);
    await aufraeumenNachholen();
    expect(removeDeliveredNotifications).toHaveBeenCalledTimes(1);
    expect(removeDeliveredNotifications.mock.calls[0][0]).toEqual({
      notifications: [{ id: 'A', data: { type: 'chat', roomId: '62' } }],
    });
  });

  it('holt nur einmal nach -- danach ist nichts mehr offen', async () => {
    getDeliveredNotifications.mockRejectedValueOnce(new Error('not called'));
    await removeDeliveredForEvents();
    delivered([{ id: 'E', data: { type: 'event_reminder' } }]);
    await aufraeumenNachholen();
    await aufraeumenNachholen();
    expect(getDeliveredNotifications).toHaveBeenCalledTimes(2);
  });

  it('merkt sich nichts, wenn das Aufraeumen gelingt', async () => {
    delivered([]);
    await removeDeliveredForChatRoom(62);
    await aufraeumenNachholen();
    expect(getDeliveredNotifications).toHaveBeenCalledTimes(1);
  });
});

// Simon, 29.09.2026: "warum sollten die keine Benachrichtigungen behalten?"
// Keine Rolle verliert ihre Mitteilungen beim Oeffnen der App. Bis dahin
// raeumte AppContext der Leitung alles weg (auf Android zuletzt nicht mehr,
// auf dem iPhone schon). Weggeraeumt wird nur noch gezielt.
describe('kein globales Aufraeumen', () => {
  it('der Dienst bietet kein "alles wegraeumen" mehr an', () => {
    expect(Object.keys(benachrichtigungen)).not.toContain('removeAllDelivered');
    expect(Object.keys(benachrichtigungen)).not.toContain('raeumtBeimAktivwerdenAllesAuf');
  });

  it('gezieltes Wegraeumen bleibt: eine Mitteilung, ein Chat, die Events', () => {
    expect(typeof removeDeliveredById).toBe('function');
    expect(typeof removeDeliveredForChatRoom).toBe('function');
    expect(typeof removeDeliveredForEvents).toBe('function');
    expect(removeAllDeliveredNotifications).not.toHaveBeenCalled();
  });
});
