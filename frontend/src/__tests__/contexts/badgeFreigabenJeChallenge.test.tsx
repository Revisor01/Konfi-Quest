import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, waitFor } from '@testing-library/react';

// Offene Freigaben je Challenge im BadgeContext (25.09.2026, Simon: "Auf der
// Challenge muss auch ein Badge sein wie bei den Chats").
//
// Der Server liefert in badge-counts additiv `challengeApprovals: { total,
// byChallenge }` -- dieselbe Zaehlung wie pendingChallenges, nur je Challenge
// aufgeschluesselt. Hier wird festgehalten, was der Client daraus macht:
//   - byChallenge -> Zahl am Listeneintrag (pendingChallengesByChallenge), NUR
//     fuer Team und Leitung
//   - pendingChallenges (Altfeld) bleibt die Quelle fuer den Reiter
//   - Konfis uebernehmen den Anteil nie: ihre Zahl an der Challenge sind die
//     Neuigkeiten (challengeUpdatesByChallenge) -- zwei verschiedene Dinge.

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
const ADMIN = { id: 4, type: 'admin', role_name: 'admin' };
let mockUser: { id: number; type: string; role_name: string } = TEAMER;
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

// Antwort wie von GET /notifications/badge-counts fuer die Leitung: drei
// offene Freigaben, verteilt auf zwei Challenges (31: 1, 40: 2).
const leitungsAntwort = () => ({
  data: {
    chat: { total: 1, byRoom: { 3: 1 } },
    pendingRequests: 0,
    pendingEvents: 0,
    pendingChallenges: 3,
    newBadges: 0,
    challengeUpdates: { total: 0, byChallenge: {} },
    challengeApprovals: { total: 3, byChallenge: { 31: 1, 40: 2 } },
  },
});

describe('BadgeContext: offene Freigaben je Challenge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured.current = null;
    mockUser = TEAMER;
  });

  it('Teamer: Zahl je Challenge am Eintrag, Summe am Reiter', async () => {
    mockApiGet.mockResolvedValue(leitungsAntwort());

    renderProvider();

    await waitFor(() => {
      expect(captured.current?.pendingChallengesCount).toBe(3);
    });
    expect(captured.current!.pendingChallengesByChallenge).toEqual({ 31: 1, 40: 2 });
    // Neuigkeiten bleiben leer -- das ist der Konfi-Anteil.
    expect(captured.current!.challengeUpdatesByChallenge).toEqual({});
    // 1 Chat + 3 Freigaben + 0 Abzeichen; die Aufschluesselung veraendert
    // die App-Icon-Summe nicht (dieselbe Zahl, nur verteilt).
    expect(captured.current!.totalBadgeCount).toBe(4);
  });

  it('Leitung (admin): dieselbe Aufteilung', async () => {
    mockUser = ADMIN;
    mockApiGet.mockResolvedValue(leitungsAntwort());

    renderProvider();

    await waitFor(() => {
      expect(captured.current?.pendingChallengesCount).toBe(3);
    });
    expect(captured.current!.pendingChallengesByChallenge).toEqual({ 31: 1, 40: 2 });
  });

  it('eine Challenge mit 0 im Server-Objekt bekommt keinen Eintrag', async () => {
    mockApiGet.mockResolvedValue({
      data: {
        chat: { total: 0, byRoom: {} },
        pendingChallenges: 1,
        challengeApprovals: { total: 1, byChallenge: { 31: 1, 40: 0 } },
      },
    });

    renderProvider();

    await waitFor(() => {
      expect(captured.current?.pendingChallengesCount).toBe(1);
    });
    expect(captured.current!.pendingChallengesByChallenge).toEqual({ 31: 1 });
  });

  it('aelterer Server ohne das Feld: Reiter zaehlt weiter, kein Eintrag, kein Fehler', async () => {
    mockApiGet.mockResolvedValue({
      data: { chat: { total: 0, byRoom: {} }, pendingChallenges: 2, newBadges: 0 },
    });

    renderProvider();

    await waitFor(() => {
      expect(captured.current?.pendingChallengesCount).toBe(2);
    });
    expect(captured.current!.pendingChallengesByChallenge).toEqual({});
  });

  it('Konfi: Freigaben werden nie uebernommen -- auch nicht, wenn der Server sie schickte', async () => {
    mockUser = KONFI;
    // Der Server liefert Konfis hier 0/leer. Selbst wenn er es nicht taete,
    // darf der Client den Anteil nicht uebernehmen: Freigaben sind Arbeit
    // der Leitung, Neuigkeiten die Zahl der Konfis.
    mockApiGet.mockResolvedValue({
      data: {
        chat: { total: 0, byRoom: {} },
        pendingChallenges: 3,
        newBadges: 0,
        challengeUpdates: { total: 1, byChallenge: { 31: 1 } },
        challengeApprovals: { total: 3, byChallenge: { 31: 1, 40: 2 } },
      },
    });

    renderProvider();

    await waitFor(() => {
      expect(captured.current?.challengeUpdatesTotal).toBe(1);
    });
    expect(captured.current!.pendingChallengesByChallenge).toEqual({});
    expect(captured.current!.pendingChallengesCount).toBe(0);
    // Die Konfi-Zahl an Challenge 31 ist die Neuigkeit (1), nicht 1 + 1.
    expect(captured.current!.challengeUpdatesByChallenge).toEqual({ 31: 1 });
    expect(captured.current!.totalBadgeCount).toBe(1);
  });
});
