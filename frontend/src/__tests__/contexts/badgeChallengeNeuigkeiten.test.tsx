import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, act, waitFor } from '@testing-library/react';

// Challenge-Neuigkeiten im BadgeContext (24.09.2026, Simon: "Badge-Indikator
// genau wie beim Chat -- auf der Challenge, auf dem Navi-Tab, auf dem Icon").
//
// Der Server liefert in badge-counts `challengeUpdates: { total, byChallenge }`
// nur fuer Konfis. Hier wird festgehalten, was der Client daraus macht:
//   - byChallenge -> Zahl am Listeneintrag (challengeUpdatesByChallenge)
//   - Summe       -> Zahl am Reiter (challengeUpdatesTotal)
//   - Summe       -> Anteil im App-Icon (totalBadgeCount), NUR im Konfi-Zweig
// Die Zusammensetzung von totalBadgeCount muss der Server-Summe in
// utils/appIconBadge.js entsprechen (Paritaet B2b); die Serverseite haelt
// tests/utils/appIconBadgeParitaet.test.js fest.

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

// Rolle pro Test umschaltbar. Die Factory liest die Variable erst beim
// Aufruf von useApp (im Render), nicht beim Hoisting.
const KONFI = { id: 1, type: 'konfi', role_name: 'konfi' };
const TEAMER = { id: 3, type: 'teamer', role_name: 'teamer' };
let mockUser: { id: number; type: string; role_name: string } = KONFI;
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

// Antwort wie von GET /notifications/badge-counts fuer einen Konfi:
// 2 ungelesene Chat-Nachrichten, 1 ungesehenes Abzeichen, 3 Neuigkeiten
// verteilt auf zwei Challenges.
const konfiAntwort = () => ({
  data: {
    chat: { total: 2, byRoom: { 1: 2 } },
    pendingRequests: 0,
    pendingEvents: 0,
    pendingChallenges: 0,
    newBadges: 1,
    challengeUpdates: { total: 3, byChallenge: { 7: 2, 9: 1 } },
  },
});

describe('BadgeContext: Challenge-Neuigkeiten', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured.current = null;
    mockUser = KONFI;
  });

  it('Konfi: Zahl je Challenge, Summe am Reiter, Anteil im App-Icon', async () => {
    mockApiGet.mockResolvedValue(konfiAntwort());

    renderProvider();

    await waitFor(() => {
      expect(captured.current?.challengeUpdatesTotal).toBe(3);
    });
    expect(captured.current!.challengeUpdatesByChallenge).toEqual({ 7: 2, 9: 1 });
    // 2 Chat + 1 Abzeichen + 3 Neuigkeiten -- dieselbe Summe wie
    // berechneAppIconSumme auf dem Server.
    expect(captured.current!.totalBadgeCount).toBe(6);
  });

  it('Konfi: ungesehene Abzeichen kommen am Reiter an (Befund 25.09.2026)', async () => {
    // Vorher stand setNewBadgesCount im Leitungs-Zweig: Konfis behielten 0,
    // obwohl der Server dieselbe Zahl ins App-Icon summierte.
    mockApiGet.mockResolvedValue(konfiAntwort());

    renderProvider();

    await waitFor(() => {
      expect(captured.current?.newBadgesCount).toBe(1);
    });
  });

  it('Konfi: Oeffnen einer Challenge nimmt ihre Zahl sofort heraus und meldet es dem Server', async () => {
    mockApiGet.mockResolvedValue(konfiAntwort());

    renderProvider();
    await waitFor(() => {
      expect(captured.current?.challengeUpdatesTotal).toBe(3);
    });

    await act(async () => {
      await captured.current!.markChallengeAsRead(7);
    });

    expect(captured.current!.challengeUpdatesByChallenge).toEqual({ 9: 1 });
    expect(captured.current!.challengeUpdatesTotal).toBe(1);
    // App-Icon folgt mit: 2 Chat + 1 Abzeichen + 1 verbliebene Neuigkeit.
    expect(captured.current!.totalBadgeCount).toBe(4);
    expect(mockApiPost).toHaveBeenCalledTimes(1);
    expect(mockApiPost).toHaveBeenCalledWith('/challenges/konfi/7/mark-read');
  });

  it('Konfi: Oeffnen einer Challenge ohne Neuigkeiten aendert die Summe nicht', async () => {
    mockApiGet.mockResolvedValue(konfiAntwort());

    renderProvider();
    await waitFor(() => {
      expect(captured.current?.challengeUpdatesTotal).toBe(3);
    });

    await act(async () => {
      await captured.current!.markChallengeAsRead(42);
    });

    expect(captured.current!.challengeUpdatesByChallenge).toEqual({ 7: 2, 9: 1 });
    expect(captured.current!.challengeUpdatesTotal).toBe(3);
    // Gemeldet wird trotzdem -- der Server merkt sich das Oeffnen fuer spaeter.
    expect(mockApiPost).toHaveBeenCalledWith('/challenges/konfi/42/mark-read');
  });

  it('aelterer Server ohne das Feld: keine Zahl, kein Fehler', async () => {
    mockApiGet.mockResolvedValue({
      data: { chat: { total: 2, byRoom: { 1: 2 } }, newBadges: 1 },
    });

    renderProvider();

    await waitFor(() => {
      expect(captured.current?.chatUnreadTotal).toBe(2);
    });
    expect(captured.current!.challengeUpdatesByChallenge).toEqual({});
    expect(captured.current!.challengeUpdatesTotal).toBe(0);
    expect(captured.current!.totalBadgeCount).toBe(3);
  });

  it('Teamer: Neuigkeiten zaehlen weder am Reiter noch im App-Icon -- ihr Reiter zaehlt Freigaben', async () => {
    mockUser = TEAMER;
    // Der Server schickt Team-Rollen hier 0/leer. Selbst wenn er es nicht
    // taete, darf der Client den Anteil nicht uebernehmen -- die Aufteilung
    // je Rolle muss auf beiden Seiten dieselbe sein.
    mockApiGet.mockResolvedValue({
      data: {
        chat: { total: 1, byRoom: { 3: 1 } },
        pendingRequests: 0,
        pendingEvents: 0,
        pendingChallenges: 2,
        newBadges: 1,
        challengeUpdates: { total: 5, byChallenge: { 7: 5 } },
      },
    });

    renderProvider();

    await waitFor(() => {
      expect(captured.current?.pendingChallengesCount).toBe(2);
    });
    expect(captured.current!.challengeUpdatesByChallenge).toEqual({});
    expect(captured.current!.challengeUpdatesTotal).toBe(0);
    // 1 Chat + 2 Freigaben + 1 Abzeichen -- wie appIconBadge.js fuer teamer.
    expect(captured.current!.totalBadgeCount).toBe(4);

    await act(async () => {
      await captured.current!.markChallengeAsRead(7);
    });
    // Kein Request fuer eine Zahl, die es fuer diese Rolle nicht gibt.
    expect(mockApiPost).not.toHaveBeenCalled();
  });
});
