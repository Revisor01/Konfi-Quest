import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, act, waitFor } from '@testing-library/react';

// Zaehler beim Gemeindewechsel (26.09.2026, Simons Befund am Geraet):
// "Wechsel ich die Ansicht, wird der Badge auf Challenges nicht ordentlich
// zurueckgesetzt. Der wird mitgenommen. Konfi-Ansicht Testgemeinde Challenge
// 9+, Wechsel auf Hennstedt -- bleibt dieser Badge, obwohl es nicht mal
// Challenges gibt."
//
// Die Zaehler am Reiter gehoeren zur AKTIVEN Gemeinde: Chat, Antraege,
// Termine, Freigaben, Abzeichen und Challenge-Neuigkeiten kommen aus
// GET /notifications/badge-counts, das der Server ueber
// req.user.organization_id filtert. Einzige Ausnahme ist das Postfach: es
// zaehlt bewusst ueber alle Gemeinden des Kontos (routes/notifications.js)
// und darf beim Wechsel NICHT auf 0 springen.
//
// Der BadgeProvider liegt ausserhalb des Router-Remounts (App.tsx haengt nur
// den Router an orgVersion) -- er muss den Wechsel also selbst mitbekommen.
// AppContext feuert dafuer 'org:switched'.

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
const TEAMER = { id: 1, type: 'teamer', role_name: 'teamer' };
const ORG_ADMIN = { id: 1, type: 'admin', role_name: 'org_admin' };
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

// Testgemeinde, Konfi-Sicht: 9 Challenge-Neuigkeiten auf zwei Challenges,
// 3 Chat, 2 ungesehene Abzeichen, 4 ungelesene Postfach-Mitteilungen
// (kontoweit, gehoert NICHT zur Gemeinde).
const TESTGEMEINDE_KONFI = {
  data: {
    chat: { total: 3, byRoom: { 1: 3 } },
    pendingRequests: 0,
    pendingEvents: 0,
    pendingChallenges: 0,
    newBadges: 2,
    challengeUpdates: { total: 9, byChallenge: { 7: 5, 9: 4 } },
    challengeApprovals: { total: 0, byChallenge: {} },
    postfach: { ungelesen: 4 },
  },
};

// Hennstedt: keine Challenges, kein Chat, keine Abzeichen. Das Postfach
// bleibt bei 4 -- es gehoert dem Konto, nicht der Gemeinde.
const HENNSTEDT_LEER = {
  data: {
    chat: { total: 0, byRoom: {} },
    pendingRequests: 0,
    pendingEvents: 0,
    pendingChallenges: 0,
    newBadges: 0,
    challengeUpdates: { total: 0, byChallenge: {} },
    challengeApprovals: { total: 0, byChallenge: {} },
    postfach: { ungelesen: 4 },
  },
};

const TESTGEMEINDE_TEAMER = {
  data: {
    chat: { total: 2, byRoom: { 5: 2 } },
    pendingRequests: 0,
    pendingEvents: 0,
    pendingChallenges: 6,
    newBadges: 1,
    challengeUpdates: { total: 0, byChallenge: {} },
    challengeApprovals: { total: 6, byChallenge: { 11: 4, 12: 2 } },
    postfach: { ungelesen: 4 },
  },
};

const TESTGEMEINDE_ADMIN = {
  data: {
    chat: { total: 1, byRoom: { 2: 1 } },
    pendingRequests: 7,
    pendingEvents: 3,
    pendingChallenges: 2,
    newBadges: 0,
    challengeUpdates: { total: 0, byChallenge: {} },
    challengeApprovals: { total: 2, byChallenge: { 11: 2 } },
    postfach: { ungelesen: 4 },
  },
};

// Eine Antwort, die erst aufgeloest wird, wenn der Test es sagt. Damit laesst
// sich das Fenster zwischen Wechsel und Antwort der neuen Gemeinde
// festhalten -- genau dort sah Simon die alte Zahl weiterstehen.
const anhaltendeAntwort = <T,>(wert: T) => {
  let loesen!: () => void;
  const versprechen = new Promise<T>(res => {
    loesen = () => res(wert);
  });
  return { versprechen, loesen: () => loesen() };
};

describe('BadgeContext: Zaehler beim Gemeindewechsel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured.current = null;
    mockUser = KONFI;
  });

  it('Konfi: Challenge-Zahlen der alten Gemeinde verschwinden SOFORT beim Wechsel', async () => {
    mockApiGet.mockResolvedValue(TESTGEMEINDE_KONFI);
    renderProvider();

    await waitFor(() => {
      expect(captured.current?.challengeUpdatesTotal).toBe(9);
    });
    expect(captured.current!.challengeUpdatesByChallenge).toEqual({ 7: 5, 9: 4 });

    // Die neue Gemeinde antwortet absichtlich erst spaeter.
    const spaet = anhaltendeAntwort(HENNSTEDT_LEER);
    mockApiGet.mockReturnValue(spaet.versprechen);

    await act(async () => {
      window.dispatchEvent(new CustomEvent('org:switched'));
    });

    // Noch BEVOR die neue Gemeinde geantwortet hat: keine Zahl der alten.
    expect(captured.current!.challengeUpdatesTotal).toBe(0);
    expect(captured.current!.challengeUpdatesByChallenge).toEqual({});
    expect(captured.current!.chatUnreadTotal).toBe(0);
    expect(captured.current!.chatUnreadByRoom).toEqual({});
    expect(captured.current!.newBadgesCount).toBe(0);
    // Das Postfach gehoert dem Konto und bleibt stehen.
    expect(captured.current!.postfachUngelesen).toBe(4);
    expect(captured.current!.totalBadgeCount).toBe(4);

    await act(async () => {
      spaet.loesen();
      await spaet.versprechen;
    });

    expect(captured.current!.challengeUpdatesTotal).toBe(0);
    expect(captured.current!.totalBadgeCount).toBe(4);
  });

  it('Leitung: Freigaben der alten Gemeinde verschwinden SOFORT beim Wechsel', async () => {
    mockUser = TEAMER;
    mockApiGet.mockResolvedValue(TESTGEMEINDE_TEAMER);
    renderProvider();

    await waitFor(() => {
      expect(captured.current?.pendingChallengesCount).toBe(6);
    });
    expect(captured.current!.pendingChallengesByChallenge).toEqual({ 11: 4, 12: 2 });

    const spaet = anhaltendeAntwort(HENNSTEDT_LEER);
    mockApiGet.mockReturnValue(spaet.versprechen);

    await act(async () => {
      window.dispatchEvent(new CustomEvent('org:switched'));
    });

    expect(captured.current!.pendingChallengesCount).toBe(0);
    expect(captured.current!.pendingChallengesByChallenge).toEqual({});
    expect(captured.current!.chatUnreadTotal).toBe(0);
    expect(captured.current!.newBadgesCount).toBe(0);
    expect(captured.current!.postfachUngelesen).toBe(4);
    expect(captured.current!.totalBadgeCount).toBe(4);
  });

  it('Leitung: Antraege und Termine der alten Gemeinde verschwinden SOFORT beim Wechsel', async () => {
    mockUser = ORG_ADMIN;
    mockApiGet.mockResolvedValue(TESTGEMEINDE_ADMIN);
    renderProvider();

    await waitFor(() => {
      expect(captured.current?.pendingRequestsCount).toBe(7);
    });
    expect(captured.current!.pendingEventsCount).toBe(3);
    // 1 Chat + 7 Antraege + 3 Termine + 2 Freigaben + 4 Postfach.
    expect(captured.current!.totalBadgeCount).toBe(17);

    const spaet = anhaltendeAntwort(HENNSTEDT_LEER);
    mockApiGet.mockReturnValue(spaet.versprechen);

    await act(async () => {
      window.dispatchEvent(new CustomEvent('org:switched'));
    });

    expect(captured.current!.pendingRequestsCount).toBe(0);
    expect(captured.current!.pendingEventsCount).toBe(0);
    expect(captured.current!.pendingChallengesCount).toBe(0);
    expect(captured.current!.chatUnreadTotal).toBe(0);
    expect(captured.current!.postfachUngelesen).toBe(4);
    expect(captured.current!.totalBadgeCount).toBe(4);
  });

  it('nach dem Wechsel werden die Zaehler der NEUEN Gemeinde geladen', async () => {
    mockApiGet.mockResolvedValue(TESTGEMEINDE_KONFI);
    renderProvider();
    await waitFor(() => {
      expect(captured.current?.challengeUpdatesTotal).toBe(9);
    });

    mockApiGet.mockResolvedValue({
      data: {
        chat: { total: 1, byRoom: { 42: 1 } },
        pendingRequests: 0,
        pendingEvents: 0,
        pendingChallenges: 0,
        newBadges: 0,
        challengeUpdates: { total: 2, byChallenge: { 99: 2 } },
        postfach: { ungelesen: 4 },
      },
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent('org:switched'));
    });

    await waitFor(() => {
      expect(captured.current?.challengeUpdatesTotal).toBe(2);
    });
    expect(captured.current!.challengeUpdatesByChallenge).toEqual({ 99: 2 });
    expect(captured.current!.chatUnreadByRoom).toEqual({ 42: 1 });
    // 1 Chat + 2 Neuigkeiten + 4 Postfach.
    expect(captured.current!.totalBadgeCount).toBe(7);
  });

  it('Wettlauf: die spaet eintreffende Antwort der ALTEN Gemeinde wird verworfen', async () => {
    // Die Abfrage der alten Gemeinde haengt und trifft ERST NACH dem Wechsel
    // und nach der Antwort der neuen Gemeinde ein. Ohne Schutz ueberschreibt
    // sie die Zahlen der neuen Gemeinde -- Simons Befund waere damit nur
    // verschoben, nicht behoben.
    const alt = anhaltendeAntwort(TESTGEMEINDE_KONFI);
    mockApiGet.mockReturnValue(alt.versprechen);

    renderProvider();
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalled();
    });

    mockApiGet.mockResolvedValue(HENNSTEDT_LEER);

    await act(async () => {
      window.dispatchEvent(new CustomEvent('org:switched'));
    });

    // Neue Gemeinde ist da: alles leer bis auf das kontoweite Postfach.
    await waitFor(() => {
      expect(captured.current?.postfachUngelesen).toBe(4);
    });
    expect(captured.current!.challengeUpdatesTotal).toBe(0);

    // Jetzt trifft die Antwort der ALTEN Gemeinde ein.
    await act(async () => {
      alt.loesen();
      await alt.versprechen;
    });

    expect(captured.current!.challengeUpdatesTotal).toBe(0);
    expect(captured.current!.challengeUpdatesByChallenge).toEqual({});
    expect(captured.current!.chatUnreadTotal).toBe(0);
    expect(captured.current!.chatUnreadByRoom).toEqual({});
    expect(captured.current!.newBadgesCount).toBe(0);
    expect(captured.current!.totalBadgeCount).toBe(4);
  });

  it('Zugang zur Zweitgemeinde verloren (403): Zaehler fallen genauso zurueck', async () => {
    // api.ts setzt bei 403 "Kein Zugriff auf diese Organisation" die aktive
    // Gemeinde auf die Stamm-Gemeinde zurueck und feuert 'auth:org-fallback' --
    // ohne 'org:switched'. Das ist derselbe Wechsel.
    mockUser = TEAMER;
    mockApiGet.mockResolvedValue(TESTGEMEINDE_TEAMER);
    renderProvider();

    await waitFor(() => {
      expect(captured.current?.pendingChallengesCount).toBe(6);
    });

    const spaet = anhaltendeAntwort(HENNSTEDT_LEER);
    mockApiGet.mockReturnValue(spaet.versprechen);

    await act(async () => {
      window.dispatchEvent(new CustomEvent('auth:org-fallback'));
    });

    expect(captured.current!.pendingChallengesCount).toBe(0);
    expect(captured.current!.pendingChallengesByChallenge).toEqual({});
    expect(captured.current!.chatUnreadTotal).toBe(0);
    expect(captured.current!.postfachUngelesen).toBe(4);
    expect(captured.current!.totalBadgeCount).toBe(4);
  });

  it('Rollenwechsel: Freigaben der Leitungs-Gemeinde bleiben nicht in der Konfi-Gemeinde stehen', async () => {
    // Org A: Teamer:in mit 6 offenen Freigaben. Org B: Konfi.
    // Der Konfi-Zweig von refreshAllCounts setzt pendingChallenges NICHT --
    // ohne Zuruecksetzen beim Wechsel bliebe die 6 am Reiter stehen, selbst
    // nachdem die neue Gemeinde geantwortet hat.
    mockUser = TEAMER;
    mockApiGet.mockResolvedValue(TESTGEMEINDE_TEAMER);

    const { rerender } = renderProvider();

    await waitFor(() => {
      expect(captured.current?.pendingChallengesCount).toBe(6);
    });

    // Wechsel in die Gemeinde, in der die Person Konfi ist.
    mockUser = KONFI;
    mockApiGet.mockResolvedValue(HENNSTEDT_LEER);

    await act(async () => {
      window.dispatchEvent(new CustomEvent('org:switched'));
      rerender(
        <BadgeProvider>
          <Consumer />
        </BadgeProvider>
      );
    });

    await waitFor(() => {
      expect(captured.current?.pendingChallengesCount).toBe(0);
    });
    expect(captured.current!.pendingChallengesByChallenge).toEqual({});
    expect(captured.current!.totalBadgeCount).toBe(4);
  });

  it('ein Wechsel fragt die Zaehler EINMAL ab, nicht zweimal', async () => {
    // AppContext.switchOrg setzt beim Wechsel ein neues user-Objekt UND feuert
    // 'org:switched'. Beides loest einen Refresh aus -- gemessen am 26.09.2026
    // zwei GET /notifications/badge-counts je Wechsel. Das In-flight-Dedupe in
    // refreshAllCounts macht daraus einen (dasselbe Muster wie in
    // hooks/useOfflineQuery.ts, dort seit dem 24.08.2026).
    mockUser = KONFI;
    mockApiGet.mockResolvedValue(TESTGEMEINDE_KONFI);

    const { rerender } = renderProvider();
    await waitFor(() => {
      expect(captured.current?.challengeUpdatesTotal).toBe(9);
    });
    const vorDemWechsel = mockApiGet.mock.calls.length;

    mockApiGet.mockResolvedValue(HENNSTEDT_LEER);
    // Wie switchOrg: neues user-Objekt (gleiche Werte, neue Referenz) und das
    // Ereignis im selben Durchlauf.
    mockUser = { ...KONFI };

    await act(async () => {
      window.dispatchEvent(new CustomEvent('org:switched'));
      rerender(
        <BadgeProvider>
          <Consumer />
        </BadgeProvider>
      );
    });
    await waitFor(() => {
      expect(captured.current?.challengeUpdatesTotal).toBe(0);
    });

    expect(mockApiGet.mock.calls.length - vorDemWechsel).toBe(1);
  });

  it('Abmelden: auch die Zahl an der Glocke faellt, nicht nur die Reiter', async () => {
    // Beim Gemeindewechsel bleibt das Postfach stehen (kontoweit) -- beim
    // Abmelden darf es das nicht: Ohne Konto gibt es keine Mitteilungen.
    mockUser = KONFI;
    mockApiGet.mockResolvedValue(TESTGEMEINDE_KONFI);

    const { rerender } = renderProvider();
    await waitFor(() => {
      expect(captured.current?.postfachUngelesen).toBe(4);
    });
    expect(captured.current!.totalBadgeCount).toBe(18);

    mockUser = null as unknown as typeof KONFI;
    await act(async () => {
      rerender(
        <BadgeProvider>
          <Consumer />
        </BadgeProvider>
      );
    });

    expect(captured.current!.postfachUngelesen).toBe(0);
    expect(captured.current!.challengeUpdatesTotal).toBe(0);
    expect(captured.current!.chatUnreadTotal).toBe(0);
    expect(captured.current!.newBadgesCount).toBe(0);
    expect(captured.current!.totalBadgeCount).toBe(0);
  });
});
