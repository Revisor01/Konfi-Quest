import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, act, waitFor } from '@testing-library/react';

// --- Mocks ---

const mockApiGet = vi.fn();
const mockApiPost = vi.fn().mockResolvedValue({});
vi.mock('../../services/api', () => ({
  default: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
  },
}));

vi.mock('../../services/writeQueue', () => ({
  writeQueue: { enqueue: vi.fn() },
}));

vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: { isOnline: true, subscribe: vi.fn(() => () => {}) },
}));

vi.mock('../../services/websocket', () => ({
  initializeWebSocket: vi.fn(() => ({ on: vi.fn(), off: vi.fn() })),
  getSocket: vi.fn(() => null),
}));

vi.mock('../../services/tokenStore', () => ({
  getToken: vi.fn(() => 'test-token'),
}));

vi.mock('../../services/notifications', () => ({
  removeDeliveredForChatRoom: vi.fn(),
}));

vi.mock('@capawesome/capacitor-badge', () => ({
  Badge: { set: vi.fn().mockResolvedValue(undefined), clear: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}));

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 1, type: 'konfi', role_name: 'konfi' } }),
}));

vi.mock('../../contexts/LiveUpdateContext', () => ({
  useLiveUpdate: () => ({ socketEpoch: 0 }),
  useLiveRefresh: vi.fn(),
}));

import { BadgeProvider, useBadge } from '../../contexts/BadgeContext';

// Consumer, der die aktuellen Kontextwerte nach außen reicht
const captured: { current: ReturnType<typeof useBadge> | null } = { current: null };
const Consumer: React.FC = () => {
  captured.current = useBadge();
  return null;
};

const renderProvider = () =>
  render(
    <BadgeProvider>
      <Consumer />
    </BadgeProvider>
  );

describe('BadgeContext: chatUnreadByRoom Referenz-Stabilität', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured.current = null;
  });

  // Verbotener Fall (24.08.2026): Jeder refreshAllCounts() erzeugte ein NEUES
  // Objekt, auch wenn die Zähler identisch waren. ChatOverview refresht die
  // Raumliste bei jeder neuen Referenz — GET /chat/rooms lief dadurch beim
  // Öffnen des Chat-Tabs in allen drei Rollen doppelt.
  it('unveränderte Zähler behalten dieselbe Objekt-Referenz', async () => {
    mockApiGet.mockResolvedValue({ data: { chat: { byRoom: { 1: 3, 2: 0 } } } });

    renderProvider();

    await waitFor(() => {
      expect(captured.current?.chatUnreadByRoom).toEqual({ 1: 3, 2: 0 });
    });
    const ersteReferenz = captured.current!.chatUnreadByRoom;

    // Zweiter Refresh mit IDENTISCHEN Werten
    await act(async () => {
      await captured.current!.refreshAllCounts();
    });

    expect(captured.current!.chatUnreadByRoom).toBe(ersteReferenz);
    expect(captured.current!.chatUnreadByRoom).toEqual({ 1: 3, 2: 0 });
  });

  // Erlaubter Fall: geänderte Zähler MÜSSEN eine neue Referenz liefern,
  // sonst bekommt ChatOverview echte Änderungen nicht mehr mit.
  it('geänderte Zähler liefern eine neue Referenz mit neuen Werten', async () => {
    // Mutable Quelle statt mockResolvedValueOnce: der Initial-Load kann
    // (StrictMode-Doppelmount) mehrfach feuern und würde Once-Werte aufbrauchen.
    let byRoom: Record<number, number> = { 1: 3 };
    mockApiGet.mockImplementation(() => Promise.resolve({ data: { chat: { byRoom } } }));

    renderProvider();

    await waitFor(() => {
      expect(captured.current?.chatUnreadByRoom).toEqual({ 1: 3 });
    });
    const ersteReferenz = captured.current!.chatUnreadByRoom;

    byRoom = { 1: 5, 2: 1 };
    await act(async () => {
      await captured.current!.refreshAllCounts();
    });

    expect(captured.current!.chatUnreadByRoom).not.toBe(ersteReferenz);
    expect(captured.current!.chatUnreadByRoom).toEqual({ 1: 5, 2: 1 });
    expect(captured.current!.chatUnreadTotal).toBe(6);
  });
});
