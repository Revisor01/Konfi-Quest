import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, waitFor, act } from '@testing-library/react';

// Die Zahl an der Postfach-Glocke nimmt ab, sobald man eine Mitteilung
// antippt (Befund Simon, 27.09.2026: „Der Zähler am Postfach aktualisiert
// sich nicht, wenn ich welche davon angeklickt habe. Also nimmt nicht ab.").
//
// Zwei Ursachen im BadgeContext:
// 1. Die Glocke wartete auf die naechste Server-Zaehlung; nur die Liste im
//    Postfach zaehlte sofort herunter.
// 2. Liefen zwei Zaehlungen gleichzeitig, gewann die ZULETZT EINTREFFENDE --
//    auch wenn sie VOR dem Antippen gestartet war und den alten Stand trug
//    (z. B. die Zaehlung, die ein Gemeindewechsel beim Antippen anstoesst).

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

const LEITUNG = { id: 41, type: 'admin', role_name: 'org_admin' };
let mockUser: { id: number; type: string; role_name: string } = LEITUNG;
let mockOrganizations: Array<{ id: number; name: string; role_name: string }> = [];
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: mockUser, organizations: mockOrganizations }),
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

const zaehlung = (postfach: number) => ({
  data: {
    chat: { total: 0, byRoom: {} },
    pendingRequests: 0,
    pendingEvents: 0,
    pendingChallenges: 0,
    newBadges: 0,
    postfach: { ungelesen: postfach },
  },
});

/** Ein Promise, das der Test von aussen erfuellt. */
const offen = <T,>() => {
  let erfuellen!: (wert: T) => void;
  const promise = new Promise<T>((r) => { erfuellen = r; });
  return { promise, erfuellen };
};

describe('BadgeContext: Postfach-Glocke nimmt beim Lesen ab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured.current = null;
    mockUser = LEITUNG;
    mockOrganizations = [];
  });

  it('eine aeltere Zaehlung, die NACH einer neueren eintrifft, ueberschreibt sie nicht', async () => {
    mockApiGet.mockResolvedValueOnce(zaehlung(3));
    renderProvider();
    await waitFor(() => expect(captured.current?.postfachUngelesen).toBe(3));

    // Zaehlung A startet vor dem Lesen (Stand 3), Zaehlung B danach (Stand 2).
    const a = offen<ReturnType<typeof zaehlung>>();
    const b = offen<ReturnType<typeof zaehlung>>();
    mockApiGet.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    let laufA!: Promise<void>;
    let laufB!: Promise<void>;
    act(() => { laufA = captured.current!.refreshAllCounts(); });
    act(() => { laufB = captured.current!.refreshAllCounts(); });

    // B kommt zuerst an, A (alt) danach.
    await act(async () => { b.erfuellen(zaehlung(2)); await laufB; });
    expect(captured.current!.postfachUngelesen).toBe(2);
    await act(async () => { a.erfuellen(zaehlung(3)); await laufA; });
    expect(captured.current!.postfachUngelesen).toBe(2);
  });

  it('Antippen zaehlt die Glocke sofort herunter, ohne auf den Server zu warten', async () => {
    mockApiGet.mockResolvedValueOnce(zaehlung(3));
    renderProvider();
    await waitFor(() => expect(captured.current?.postfachUngelesen).toBe(3));

    act(() => { captured.current!.postfachGelesen(1); });
    expect(captured.current!.postfachUngelesen).toBe(2);
    // Das App-Symbol zaehlt mit.
    expect(captured.current!.totalBadgeCount).toBe(2);
  });

  it('eine Zaehlung, die VOR dem Antippen gestartet war, bringt die alte Zahl nicht zurueck', async () => {
    mockApiGet.mockResolvedValueOnce(zaehlung(3));
    renderProvider();
    await waitFor(() => expect(captured.current?.postfachUngelesen).toBe(3));

    const alt = offen<ReturnType<typeof zaehlung>>();
    mockApiGet.mockReturnValueOnce(alt.promise);
    let laufAlt!: Promise<void>;
    act(() => { laufAlt = captured.current!.refreshAllCounts(); });
    act(() => { captured.current!.postfachGelesen(1); });
    await act(async () => { alt.erfuellen(zaehlung(3)); await laufAlt; });
    expect(captured.current!.postfachUngelesen).toBe(2);

    // Die Zaehlung NACH dem Lesen gilt wieder.
    mockApiGet.mockResolvedValueOnce(zaehlung(2));
    await act(async () => { await captured.current!.refreshAllCounts(); });
    expect(captured.current!.postfachUngelesen).toBe(2);
  });

  it('„Alle gelesen" setzt die Glocke sofort auf 0, nie darunter', async () => {
    mockApiGet.mockResolvedValueOnce(zaehlung(3));
    renderProvider();
    await waitFor(() => expect(captured.current?.postfachUngelesen).toBe(3));

    act(() => { captured.current!.postfachGelesen('alle'); });
    expect(captured.current!.postfachUngelesen).toBe(0);
    act(() => { captured.current!.postfachGelesen(1); });
    expect(captured.current!.postfachUngelesen).toBe(0);
  });

  it('mehrere Gemeinden: auch die Zahl am App-Symbol (Summe aller Gemeinden) zaehlt sofort herunter', async () => {
    mockOrganizations = [
      { id: 1, name: 'A', role_name: 'org_admin' },
      { id: 2, name: 'B', role_name: 'teamer' },
    ];
    mockApiGet.mockImplementation(async (url: string) => (
      url === '/notifications/badge-counts/je-organisation'
        ? { data: { jeOrganisation: { 1: { offen: 4 }, 2: { offen: 3 } } } }
        : zaehlung(3)
    ));
    renderProvider();
    await waitFor(() => expect(captured.current?.appSymbolZahl).toBe(7));

    act(() => { captured.current!.postfachGelesen(1); });
    expect(captured.current!.postfachUngelesen).toBe(2);
    expect(captured.current!.appSymbolZahl).toBe(6);

    act(() => { captured.current!.postfachGelesen('alle'); });
    expect(captured.current!.postfachUngelesen).toBe(0);
    expect(captured.current!.appSymbolZahl).toBe(4);
  });
});
