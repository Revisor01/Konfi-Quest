import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, waitFor, act } from '@testing-library/react';

// Zaehler-Abruf nach Chat-Nachrichten, entprellt (offene Befunde, Betrieb
// BF-08, Rest: "Jede newMessage loest im BadgeContext einen Abruf der Zaehler
// aus"). Bis 08.10.2026 hiess ein Gruppenchat mit zehn Nachrichten in fuenf
// Sekunden zehnmal GET /notifications/badge-counts. Jetzt ergibt ein Schwall
// binnen 400 ms genau EINEN Abruf, nach der letzten
// Nachricht; ein wartender Abruf faellt beim Abbau weg.

const mockApiGet = vi.fn();
vi.mock('../../services/api', () => ({
  default: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: vi.fn().mockResolvedValue({}),
  },
}));
vi.mock('../../services/writeQueue', () => ({ writeQueue: { enqueue: vi.fn() } }));
vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: { isOnline: true, subscribe: vi.fn(() => () => {}) },
}));

const socketHorcher: Record<string, () => void> = {};
vi.mock('../../services/websocket', () => ({
  initializeWebSocket: vi.fn(() => ({
    on: (ereignis: string, fn: () => void) => { socketHorcher[ereignis] = fn; },
    off: vi.fn(),
  })),
  getSocket: vi.fn(() => null),
}));
vi.mock('../../services/tokenStore', () => ({ getToken: vi.fn(() => 'test-token') }));
vi.mock('../../services/notifications', () => ({ removeDeliveredForChatRoom: vi.fn() }));
vi.mock('../../services/offlineCache', () => ({ offlineCache: { remove: vi.fn() } }));
vi.mock('@capawesome/capacitor-badge', () => ({
  Badge: { set: vi.fn().mockResolvedValue(undefined), clear: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));

const ORG_ADMIN = { id: 5, type: 'admin', role_name: 'org_admin' };
vi.mock('../../contexts/AppContext', () => ({ useApp: () => ({ user: ORG_ADMIN }) }));
vi.mock('../../contexts/LiveUpdateContext', () => ({
  useLiveUpdate: () => ({ socketEpoch: 0 }),
  useLiveRefresh: vi.fn(),
}));

import { BadgeProvider, useBadge } from '../../contexts/BadgeContext';

// Das Fenster im Provider (ZAEHLER_NACH_NACHRICHT_MS): kurz, hoechstens eine halbe Sekunde.
const FENSTER_MS = 400;

const captured: { current: ReturnType<typeof useBadge> | null } = { current: null };
const Consumer: React.FC = () => {
  const badge = useBadge();
  React.useEffect(() => { captured.current = badge; });
  return null;
};

const antwort = (chat: number) => ({
  data: {
    chat: { total: chat, byRoom: { 7: chat } },
    pendingRequests: 0,
    pendingEvents: 0,
    pendingChallenges: 0,
    newBadges: 0,
    challengeUpdates: { total: 0, byChallenge: {} },
    challengeApprovals: { total: 0, byChallenge: {} },
    postfach: { ungelesen: 0 },
  },
});

const zaehlerAbrufe = () => mockApiGet.mock.calls.filter((c) => c[0] === '/notifications/badge-counts').length;

/** Provider aufbauen und den ersten Abruf (beim Anmelden) abwarten. */
const aufbauen = async () => {
  const r = render(<BadgeProvider><Consumer /></BadgeProvider>);
  await waitFor(() => expect(captured.current?.chatUnreadTotal).toBe(1));
  expect(zaehlerAbrufe()).toBe(1);
  expect(typeof socketHorcher.newMessage).toBe('function');
  vi.useFakeTimers();
  return r;
};

beforeEach(() => {
  vi.clearAllMocks();
  captured.current = null;
  for (const k of Object.keys(socketHorcher)) delete socketHorcher[k];
  mockApiGet.mockResolvedValue(antwort(1));
});
afterEach(() => { vi.useRealTimers(); });

describe('BadgeContext: Zaehler nach neuen Chat-Nachrichten', () => {
  it('zehn Nachrichten binnen des Fensters: genau ein Abruf, erst nach der letzten', async () => {
    await aufbauen();
    mockApiGet.mockResolvedValue(antwort(11));
    for (let i = 0; i < 10; i++) {
      act(() => { socketHorcher.newMessage(); });
      act(() => { vi.advanceTimersByTime(30); });
    }
    expect(zaehlerAbrufe()).toBe(1);
    await act(async () => { vi.advanceTimersByTime(FENSTER_MS); });
    expect(zaehlerAbrufe()).toBe(2);
    await act(async () => { await Promise.resolve(); });
    expect(captured.current?.chatUnreadTotal).toBe(11);

    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(zaehlerAbrufe()).toBe(2);
  });

  it('erlaubter Fall: Nachrichten in getrennten Fenstern laden je einmal nach', async () => {
    await aufbauen();
    act(() => { socketHorcher.newMessage(); });
    await act(async () => { vi.advanceTimersByTime(FENSTER_MS); });
    act(() => { socketHorcher.newMessage(); });
    await act(async () => { vi.advanceTimersByTime(FENSTER_MS); });
    expect(zaehlerAbrufe()).toBe(3);
  });

  it('abgebaut, waehrend ein Abruf wartet: er faellt weg', async () => {
    const { unmount } = await aufbauen();
    act(() => { socketHorcher.newMessage(); });
    unmount();
    await act(async () => { vi.advanceTimersByTime(FENSTER_MS * 5); });
    expect(zaehlerAbrufe()).toBe(1);
  });
});
