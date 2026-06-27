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
    getDeliveredNotifications: (...args: any[]) => getDeliveredNotifications(...args),
    removeDeliveredNotifications: (...args: any[]) => removeDeliveredNotifications(...args),
    removeAllDeliveredNotifications: (...args: any[]) => removeAllDeliveredNotifications(...args),
  },
}));

import {
  removeDeliveredById,
  removeAllDelivered,
  removeDeliveredForChatRoom,
  removeDeliveredForEvents,
} from '../../services/notifications';

const delivered = (notifications: any[]) => {
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
  it('entfernt genau die Notification mit der id', async () => {
    removeDeliveredNotifications.mockResolvedValue(undefined);
    await removeDeliveredById('abc');
    expect(removeDeliveredNotifications).toHaveBeenCalledWith({
      notifications: [{ id: 'abc' }],
    });
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
    const arg = removeDeliveredNotifications.mock.calls[0][0];
    expect(arg.notifications.map((n: any) => n.id).sort()).toEqual(['1', '4']);
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
    const arg = removeDeliveredNotifications.mock.calls[0][0];
    expect(arg.notifications.map((n: any) => n.id).sort()).toEqual(['1', '2']);
  });

  it('ist no-op im Web', async () => {
    isNative = false;
    await removeDeliveredForEvents();
    expect(getDeliveredNotifications).not.toHaveBeenCalled();
  });
});
