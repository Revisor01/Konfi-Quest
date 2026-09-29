import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, waitFor, act } from '@testing-library/react';

// Rote Kugel an der Challenge fuer Team und Leitung (Simon, 29.09.2026: "bei
// jeden Beitrag. Wie im Chat bei jeder Nachricht. Und zusaetzlich Orangen bei
// Freigaben."). Der Server liefert additiv `challengeNeueBeitraege: { total,
// byChallenge, wartendByChallenge }` -- jeder fremde Beitrag seit dem letzten
// Oeffnen, wartende eingeschlossen. Hier steht fest, was der BadgeContext
// daraus macht:
//   - byChallenge -> challengeNeueBeitraegeByChallenge (Kugel am Eintrag)
//   - fehlt das Feld (aelterer Server) -> null, die Liste rechnet wie bisher
//   - markChallengeAsRead setzt die Zahl der geoeffneten Challenge sofort auf 0
//   - Reiter und App-Symbol lesen das Feld NICHT (pendingChallenges +
//     challengeUpdates, wie die App 2.3.0)
//   - jeder Weg, der die Zaehler neu laedt (Socket, Push, Reconnect), traegt
//     das Feld mit

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

// Der Socket haelt seine Horcher fest, damit der Test ein 'newMessage'
// ausloesen kann -- derselbe Weg, auf dem die Zaehler live nachladen.
const socketHorcher: Record<string, () => void> = {};
vi.mock('../../services/websocket', () => ({
  initializeWebSocket: vi.fn(() => ({
    on: (ereignis: string, fn: () => void) => { socketHorcher[ereignis] = fn; },
    off: vi.fn(),
  })),
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
const ORG_ADMIN = { id: 5, type: 'admin', role_name: 'org_admin' };
let mockUser: { id: number; type: string; role_name: string } = ORG_ADMIN;
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

// Challenge 31: zwei wartende Beitraege, einer davon neu, dazu ein neuer
// freigegebener. Challenge 40: ein neuer freigegebener.
//   pendingChallenges 2 (beide wartenden, orange)
//   challengeUpdates  31: 1, 40: 1 (neu freigegeben -- Reiter, App-Symbol)
//   challengeNeueBeitraege 31: 2 (1 frei + 1 wartend), 40: 1
const antwort = (mitNeuemFeld = true) => ({
  data: {
    chat: { total: 0, byRoom: {} },
    pendingRequests: 0,
    pendingEvents: 0,
    pendingChallenges: 2,
    newBadges: 0,
    challengeUpdates: { total: 2, byChallenge: { 31: 1, 40: 1 } },
    challengeApprovals: { total: 2, byChallenge: { 31: 2 } },
    ...(mitNeuemFeld
      ? { challengeNeueBeitraege: { total: 3, byChallenge: { 31: 2, 40: 1 }, wartendByChallenge: { 31: 1 } } }
      : {}),
    postfach: { ungelesen: 0 },
  },
});

describe('BadgeContext: neue Beitraege je Challenge (Team und Leitung)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured.current = null;
    mockUser = ORG_ADMIN;
    for (const k of Object.keys(socketHorcher)) delete socketHorcher[k];
  });

  it('uebernimmt byChallenge und wartendByChallenge', async () => {
    mockApiGet.mockResolvedValue(antwort());
    renderProvider();

    await waitFor(() => {
      expect(captured.current?.challengeNeueBeitraegeByChallenge).toEqual({ 31: 2, 40: 1 });
    });
    expect(captured.current!.challengeNeueWartendByChallenge).toEqual({ 31: 1 });
  });

  it('Reiter und App-Symbol bleiben bei wartend + neu freigegeben (2 + 2), nicht beim neuen Feld', async () => {
    mockApiGet.mockResolvedValue(antwort());
    renderProvider();

    await waitFor(() => {
      expect(captured.current?.challengeNeueBeitraegeByChallenge).toEqual({ 31: 2, 40: 1 });
    });
    expect(captured.current!.pendingChallengesCount).toBe(2);
    expect(captured.current!.challengeUpdatesTotal).toBe(2);
    expect(captured.current!.totalBadgeCount).toBe(4);
    expect(captured.current!.appSymbolZahl).toBe(4);
  });

  it('aelterer Server ohne das Feld: null (Rueckfall), kein Fehler', async () => {
    mockApiGet.mockResolvedValue(antwort(false));
    renderProvider();

    await waitFor(() => {
      expect(captured.current?.pendingChallengesCount).toBe(2);
    });
    expect(captured.current!.challengeNeueBeitraegeByChallenge).toBeNull();
    expect(captured.current!.challengeNeueWartendByChallenge).toEqual({});
  });

  it('markChallengeAsRead setzt die Zahl der geoeffneten Challenge sofort auf 0 -- orange bleibt', async () => {
    mockApiGet.mockResolvedValue(antwort());
    // Der POST haengt: Die 0 muss VOR der Antwort des Servers stehen.
    let postFertig: () => void = () => {};
    mockApiPost.mockImplementationOnce(() => new Promise<void>((r) => { postFertig = r; }));
    renderProvider();

    await waitFor(() => {
      expect(captured.current?.challengeNeueBeitraegeByChallenge).toEqual({ 31: 2, 40: 1 });
    });

    let gemeldet: Promise<void> = Promise.resolve();
    act(() => { gemeldet = captured.current!.markChallengeAsRead(31); });

    await waitFor(() => {
      expect(captured.current!.challengeNeueBeitraegeByChallenge).toEqual({ 40: 1 });
    });
    expect(captured.current!.challengeNeueWartendByChallenge).toEqual({});
    // Die wartenden Freigaben bleiben stehen, bis jemand freigibt.
    expect(captured.current!.pendingChallengesByChallenge).toEqual({ 31: 2 });
    expect(mockApiPost).toHaveBeenCalledWith('/challenges/konfi/31/mark-read');

    await act(async () => { postFertig(); await gemeldet; });
  });

  it('der Socket-Weg (neue Nachricht) laedt das Feld neu', async () => {
    mockApiGet.mockResolvedValue(antwort());
    renderProvider();
    await waitFor(() => {
      expect(captured.current?.challengeNeueBeitraegeByChallenge).toEqual({ 31: 2, 40: 1 });
    });

    mockApiGet.mockResolvedValue({
      data: {
        ...antwort().data,
        challengeNeueBeitraege: { total: 4, byChallenge: { 31: 3, 40: 1 }, wartendByChallenge: { 31: 2 } },
      },
    });
    expect(typeof socketHorcher.newMessage).toBe('function');
    await act(async () => { socketHorcher.newMessage(); });

    await waitFor(() => {
      expect(captured.current!.challengeNeueBeitraegeByChallenge).toEqual({ 31: 3, 40: 1 });
    });
    expect(captured.current!.challengeNeueWartendByChallenge).toEqual({ 31: 2 });
  });

  it('der Push-Weg (push:received) laedt das Feld neu', async () => {
    mockUser = TEAMER;
    mockApiGet.mockResolvedValue(antwort());
    renderProvider();
    await waitFor(() => {
      expect(captured.current?.challengeNeueBeitraegeByChallenge).toEqual({ 31: 2, 40: 1 });
    });

    mockApiGet.mockResolvedValue({
      data: { ...antwort().data, challengeNeueBeitraege: { total: 0, byChallenge: {}, wartendByChallenge: {} } },
    });
    await act(async () => { window.dispatchEvent(new Event('push:received')); });

    await waitFor(() => {
      expect(captured.current!.challengeNeueBeitraegeByChallenge).toEqual({});
    });
  });

  it('Konfi: bleibt null -- die Konfi-Kugel liest challengeUpdates', async () => {
    mockUser = KONFI;
    mockApiGet.mockResolvedValue({
      data: {
        chat: { total: 0, byRoom: {} },
        newBadges: 0,
        challengeUpdates: { total: 1, byChallenge: { 31: 1 } },
        challengeNeueBeitraege: { total: 0, byChallenge: {}, wartendByChallenge: {} },
      },
    });
    renderProvider();

    await waitFor(() => {
      expect(captured.current?.challengeUpdatesTotal).toBe(1);
    });
    expect(captured.current!.challengeNeueBeitraegeByChallenge).toBeNull();
  });

  it('Gemeindewechsel setzt das Feld zurueck, bevor neu geladen wird', async () => {
    mockApiGet.mockResolvedValue(antwort());
    renderProvider();
    await waitFor(() => {
      expect(captured.current?.challengeNeueBeitraegeByChallenge).toEqual({ 31: 2, 40: 1 });
    });

    // Die Abfrage der neuen Gemeinde haengt -- bis dahin darf nichts von der
    // alten stehen.
    mockApiGet.mockImplementation(() => new Promise(() => {}));
    act(() => { window.dispatchEvent(new Event('org:switched')); });

    await waitFor(() => {
      expect(captured.current!.challengeNeueBeitraegeByChallenge).toBeNull();
    });
    expect(captured.current!.challengeNeueWartendByChallenge).toEqual({});
  });
});
