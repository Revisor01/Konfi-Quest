import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, waitFor, act } from '@testing-library/react';

// Zahl am App-Symbol bei mehreren Gemeinden (27.09.2026, Audit "Wer bekommt
// was", Befund BF-12, Frage F-09).
//
// Der Server setzt mit Push und Hintergrund-Lauf die Summe ueber ALLE
// Gemeinden der Person, je Gemeinde mit der dortigen Rolle -- dieselbe Zahl,
// deren Aufteilung GET /notifications/badge-counts/je-organisation liefert
// (backend/tests/services/appIconMehrereGemeinden.test.js). Die offene App
// setzte bis dahin totalBadgeCount, also nur die AKTIVE Gemeinde: Push 5,
// App auf -> 4, App zu -> beim naechsten Push wieder 5.
//
// Jetzt: Bei mehreren Gemeinden setzt die App die Summe aus je-organisation.
// Bei einer Gemeinde bleibt alles, wie es war -- auch ohne zusaetzliche
// Abfrage.

const BADGE_COUNTS = '/notifications/badge-counts';
const JE_ORGANISATION = '/notifications/badge-counts/je-organisation';

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
vi.mock('../../services/websocket', () => ({
  initializeWebSocket: vi.fn(() => ({ on: vi.fn(), off: vi.fn() })),
  getSocket: vi.fn(() => null),
}));
vi.mock('../../services/tokenStore', () => ({ getToken: vi.fn(() => 'test-token') }));
vi.mock('../../services/notifications', () => ({ removeDeliveredForChatRoom: vi.fn() }));
vi.mock('../../services/offlineCache', () => ({ offlineCache: { remove: vi.fn() } }));

// Auf dem Geraet: Das Symbol wird wirklich gesetzt, und genau das wird hier
// beobachtet -- nicht ein Zwischenwert im Context.
const badgeSet = vi.fn().mockResolvedValue(undefined);
const badgeClear = vi.fn().mockResolvedValue(undefined);
vi.mock('@capawesome/capacitor-badge', () => ({
  Badge: { set: (...a: unknown[]) => badgeSet(...a), clear: (...a: unknown[]) => badgeClear(...a) },
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));

const LEITUNG = { id: 5, type: 'admin', role_name: 'org_admin', organization_id: 1 };
const ZWEI_GEMEINDEN = [
  { id: 1, name: 'West', slug: 'kirchspiel-west', role_name: 'org_admin' },
  { id: 2, name: 'Hennstedt', slug: 'kirchengemeinde-hennstedt', role_name: 'teamer' },
];
let mockOrganizations: typeof ZWEI_GEMEINDEN = ZWEI_GEMEINDEN;
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: LEITUNG, organizations: mockOrganizations }),
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
const renderProvider = () => render(<BadgeProvider><Consumer /></BadgeProvider>);

// Aktive Gemeinde 1 (Org-Admin): zwei offene Antraege, zwei ungelesene
// Mitteilungen (eine aus jeder Gemeinde -- das Postfach ist kontoweit).
// Seit 28.09.2026 zaehlt das Postfach nicht mehr mit (die Glocke zeigt einen
// Briefumschlag): Reiter = 2.
const AKTIVE_GEMEINDE = {
  data: {
    chat: { total: 0, byRoom: {} },
    pendingRequests: 2,
    pendingEvents: 0,
    pendingChallenges: 0,
    newBadges: 0,
    challengeUpdates: { total: 0, byChallenge: {} },
    challengeApprovals: { total: 0, byChallenge: {} },
    postfach: { ungelesen: 2 },
  },
};
// Der Umschalter: Gemeinde 1 = 2 Antraege, Gemeinde 2 (dort Teamer:in) =
// 1 Freigabe; die Mitteilungen zaehlt der Server seit 28.09.2026 nicht mehr.
// Summe 3 -- die Zahl, die Push und Hintergrund setzen.
const JE_GEMEINDE = { data: { jeOrganisation: { 1: { offen: 2 }, 2: { offen: 1 } } } };

const letzteSymbolZahl = () => {
  const aufrufe = badgeSet.mock.calls;
  return aufrufe.length ? (aufrufe[aufrufe.length - 1][0] as { count: number }).count : null;
};
const aufrufeVon = (pfad: string) => mockApiGet.mock.calls.filter(([p]) => p === pfad).length;

describe('BadgeContext: Zahl am App-Symbol ueber alle Gemeinden (BF-12)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured.current = null;
    mockOrganizations = ZWEI_GEMEINDEN;
    mockApiGet.mockImplementation((pfad: string) =>
      Promise.resolve(pfad === JE_ORGANISATION ? JE_GEMEINDE : AKTIVE_GEMEINDE));
  });

  it('mehrere Gemeinden: das Symbol zeigt die Summe des Umschalters (3), nicht die aktive Gemeinde (2)', async () => {
    renderProvider();
    await waitFor(() => expect(letzteSymbolZahl()).toBe(3));
    // Die Reiter bleiben bei der aktiven Gemeinde; das Postfach zaehlt nicht.
    expect(captured.current!.totalBadgeCount).toBe(2);
    expect(captured.current!.pendingRequestsCount).toBe(2);
    expect(captured.current!.postfachUngelesen).toBe(2);
    expect(captured.current!.appSymbolZahl).toBe(3);
  });

  it('mehrere Gemeinden: je Zaehler-Aktualisierung genau eine Abfrage des Umschalters', async () => {
    renderProvider();
    await waitFor(() => expect(letzteSymbolZahl()).toBe(3));
    const vorher = { zaehler: aufrufeVon(BADGE_COUNTS), umschalter: aufrufeVon(JE_ORGANISATION) };
    expect(vorher.umschalter).toBe(vorher.zaehler);

    // In Gemeinde 2 kommt etwas dazu: der naechste Refresh bringt die neue Summe.
    mockApiGet.mockImplementation((pfad: string) =>
      Promise.resolve(pfad === JE_ORGANISATION
        ? { data: { jeOrganisation: { 1: { offen: 2 }, 2: { offen: 4 } } } }
        : AKTIVE_GEMEINDE));
    await act(async () => { await captured.current!.refreshAllCounts(); });
    expect(letzteSymbolZahl()).toBe(6);
    expect(aufrufeVon(BADGE_COUNTS)).toBe(vorher.zaehler + 1);
    expect(aufrufeVon(JE_ORGANISATION)).toBe(vorher.umschalter + 1);
  });

  it('eine Gemeinde: das Symbol bleibt die Summe der Reiter (ohne Postfach) -- ohne Abfrage des Umschalters', async () => {
    mockOrganizations = [ZWEI_GEMEINDEN[0]];
    renderProvider();
    await waitFor(() => expect(letzteSymbolZahl()).toBe(2));
    expect(captured.current!.appSymbolZahl).toBe(2);
    expect(aufrufeVon(BADGE_COUNTS)).toBeGreaterThan(0);
    expect(aufrufeVon(JE_ORGANISATION)).toBe(0);
  });

  it('noch keine Gemeinde-Liste geladen: wie eine Gemeinde, ohne Abfrage des Umschalters', async () => {
    mockOrganizations = [];
    renderProvider();
    await waitFor(() => expect(letzteSymbolZahl()).toBe(2));
    expect(aufrufeVon(JE_ORGANISATION)).toBe(0);
  });

  it('aelterer Server ohne die Route: das Symbol faellt auf die aktive Gemeinde zurueck, statt 0 zu zeigen', async () => {
    mockApiGet.mockImplementation((pfad: string) =>
      pfad === JE_ORGANISATION
        ? Promise.reject(new Error('404'))
        : Promise.resolve(AKTIVE_GEMEINDE));
    renderProvider();
    await waitFor(() => expect(captured.current?.pendingRequestsCount).toBe(2));
    await waitFor(() => expect(letzteSymbolZahl()).toBe(2));
    expect(captured.current!.appSymbolZahl).toBe(2);
  });

  it('nichts offen in allen Gemeinden: das Symbol wird geleert -- auch mit ungelesenen Mitteilungen', async () => {
    mockApiGet.mockImplementation((pfad: string) =>
      Promise.resolve(pfad === JE_ORGANISATION
        ? { data: { jeOrganisation: { 1: { offen: 0 }, 2: { offen: 0 } } } }
        : { data: { ...AKTIVE_GEMEINDE.data, pendingRequests: 0 } }));
    renderProvider();
    await waitFor(() => expect(captured.current?.appSymbolZahl).toBe(0));
    expect(badgeClear).toHaveBeenCalled();
  });
});
