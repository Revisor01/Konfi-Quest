import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, waitFor } from '@testing-library/react';

// Das Postfach zaehlt am App-Symbol mit (25.09.2026).
//
// Simons Messung am Geraet (Leitung, Konto 41): Postfach 23 ungelesen,
// Challenges 9, Chat 3 -- das Symbol zeigte 12. totalBadgeCount addierte
// postfachUngelesen in keinem der drei Zweige. Simon: "lass es dagegen
// zaehlen, bitte! Das, was an Benachrichtigungen drin ist, wird mit
// reingezaehlt, damit es logisch konsistent bleibt."
//
// Hier wird festgehalten, was der Client aus badge-counts.postfach.ungelesen
// macht: Zahl an der Glocke UND Anteil an totalBadgeCount, in ALLEN drei
// Rollen. Die Serverseite (utils/appIconBadge.js) addiert dieselbe Zahl;
// tests/utils/appIconBadgeParitaet.test.js haelt beide Seiten fest.

const mockApiGet = vi.fn();
const mockApiPost = vi.fn().mockResolvedValue({});
vi.mock('../../services/api', () => ({
  default: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
  },
}));

const mockEnqueue = vi.fn();
vi.mock('../../services/writeQueue', () => ({
  writeQueue: { enqueue: (...args: unknown[]) => mockEnqueue(...args) },
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

vi.mock('../../services/offlineCache', () => ({
  offlineCache: { remove: vi.fn() },
}));

vi.mock('@capawesome/capacitor-badge', () => ({
  Badge: { set: vi.fn().mockResolvedValue(undefined), clear: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}));

const KONFI = { id: 1, type: 'konfi', role_name: 'konfi' };
const TEAMER = { id: 3, type: 'teamer', role_name: 'teamer' };
const LEITUNG = { id: 41, type: 'admin', role_name: 'org_admin' };
let mockUser: { id: number; type: string; role_name: string } = LEITUNG;
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: mockUser }),
}));

vi.mock('../../contexts/LiveUpdateContext', () => ({
  useLiveUpdate: () => ({ socketEpoch: 0 }),
  useLiveRefresh: vi.fn(),
}));

import { BadgeProvider, useBadge } from '../../contexts/BadgeContext';

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

describe('BadgeContext: Postfach am App-Symbol', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured.current = null;
    mockUser = LEITUNG;
  });

  it('Simons Messung (Leitung): Postfach 23 + Challenges 9 + Chat 3 = 35, nicht 12', async () => {
    mockApiGet.mockResolvedValue({
      data: {
        chat: { total: 3, byRoom: { 5: 3 } },
        pendingRequests: 0,
        pendingEvents: 0,
        pendingChallenges: 9,
        newBadges: 0,
        challengeApprovals: { total: 9, byChallenge: { 12: 9 } },
        postfach: { ungelesen: 23 },
      },
    });

    renderProvider();

    await waitFor(() => {
      expect(captured.current?.postfachUngelesen).toBe(23);
    });
    // Die Glocke zeigt 23 ...
    expect(captured.current!.postfachUngelesen).toBe(23);
    // ... und das Symbol die Summe aller sichtbaren Zahlen -- vorher 12.
    expect(captured.current!.totalBadgeCount).toBe(35);
  });

  it('Leitung: offener Antrag und seine ungelesene Mitteilung -> Reiter 1 + Glocke 1 = 2 (bewusst, siehe postfachArten.js)', async () => {
    mockApiGet.mockResolvedValue({
      data: {
        chat: { total: 0, byRoom: {} },
        pendingRequests: 1,
        pendingEvents: 0,
        pendingChallenges: 0,
        newBadges: 0,
        postfach: { ungelesen: 1 },
      },
    });

    renderProvider();

    await waitFor(() => {
      expect(captured.current?.pendingRequestsCount).toBe(1);
    });
    expect(captured.current!.totalBadgeCount).toBe(2);
  });

  it('Teamer: Chat 1 + Freigaben 2 + Abzeichen 1 + Postfach 4 = 8', async () => {
    mockUser = TEAMER;
    mockApiGet.mockResolvedValue({
      data: {
        chat: { total: 1, byRoom: { 3: 1 } },
        pendingRequests: 0,
        pendingEvents: 0,
        pendingChallenges: 2,
        newBadges: 1,
        postfach: { ungelesen: 4 },
      },
    });

    renderProvider();

    await waitFor(() => {
      expect(captured.current?.postfachUngelesen).toBe(4);
    });
    expect(captured.current!.totalBadgeCount).toBe(8);
  });

  it('Konfi: "Punkte erhalten" hat keinen Reiter -- ohne das Postfach staende das Symbol auf 0', async () => {
    mockUser = KONFI;
    mockApiGet.mockResolvedValue({
      data: {
        chat: { total: 0, byRoom: {} },
        pendingRequests: 0,
        pendingEvents: 0,
        pendingChallenges: 0,
        newBadges: 0,
        challengeUpdates: { total: 0, byChallenge: {} },
        // Bonuspunkte, Teilnahme verbucht, Level-Aufstieg: drei Mitteilungen.
        postfach: { ungelesen: 3 },
      },
    });

    renderProvider();

    await waitFor(() => {
      expect(captured.current?.postfachUngelesen).toBe(3);
    });
    expect(captured.current!.totalBadgeCount).toBe(3);
  });

  it('Konfi: Chat 2 + Abzeichen 1 + Neuigkeiten 3 + Postfach 5 = 11', async () => {
    mockUser = KONFI;
    mockApiGet.mockResolvedValue({
      data: {
        chat: { total: 2, byRoom: { 1: 2 } },
        pendingRequests: 0,
        pendingEvents: 0,
        pendingChallenges: 0,
        newBadges: 1,
        challengeUpdates: { total: 3, byChallenge: { 7: 2, 9: 1 } },
        postfach: { ungelesen: 5 },
      },
    });

    renderProvider();

    await waitFor(() => {
      expect(captured.current?.postfachUngelesen).toBe(5);
    });
    expect(captured.current!.totalBadgeCount).toBe(11);
  });

  it('aelterer Server ohne das Feld: Postfach 0, Summe wie vorher, kein Fehler', async () => {
    mockUser = KONFI;
    mockApiGet.mockResolvedValue({
      data: { chat: { total: 2, byRoom: { 1: 2 } }, newBadges: 1 },
    });

    renderProvider();

    await waitFor(() => {
      expect(captured.current?.chatUnreadTotal).toBe(2);
    });
    expect(captured.current!.postfachUngelesen).toBe(0);
    expect(captured.current!.totalBadgeCount).toBe(3);
  });
});
