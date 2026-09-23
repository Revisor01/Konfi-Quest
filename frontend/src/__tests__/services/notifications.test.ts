import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---
let isNative = true;
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => isNative,
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

import {
  removeDeliveredById,
  removeAllDelivered,
  removeDeliveredForChatRoom,
  removeDeliveredForEvents,
} from '../../services/notifications';

// Nur die Felder, die der Code auswertet — die Tests liefern bewusst
// unvollstaendige Notifications (u.a. ganz ohne data).
type TestNotification = { id: string; data?: Record<string, unknown> };

const delivered = (notifications: TestNotification[]) => {
  getDeliveredNotifications.mockResolvedValue({ notifications });
  removeDeliveredNotifications.mockResolvedValue(undefined);
};

beforeEach(() => {
  isNative = true;
  getDeliveredNotifications.mockReset();
  removeDeliveredNotifications.mockReset();
  removeAllDeliveredNotifications.mockReset();
});

describe('removeAllDelivered', () => {
  it('entfernt alle Notifications nativ', async () => {
    removeAllDeliveredNotifications.mockResolvedValue(undefined);
    await removeAllDelivered();
    expect(removeAllDeliveredNotifications).toHaveBeenCalledTimes(1);
  });

  it('ist no-op im Web', async () => {
    isNative = false;
    await removeAllDelivered();
    expect(removeAllDeliveredNotifications).not.toHaveBeenCalled();
  });
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
