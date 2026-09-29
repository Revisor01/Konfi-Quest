import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, waitFor } from '@testing-library/react';

// Zahl am App-Symbol auf Android (29.09.2026).
//
// Simon am Sony Xperia 1 VI: "App Symbol mit Zahl ist bei mir leider nur ein
// kleiner blauer Kreis". Auf Android setzt die offene App die Zahl deshalb
// ueber ihr eigenes Plugin (AppSymbolZahl) -- dieselbe Stelle, die bei
// geschlossener App der Push-Dienst benutzt -- und nicht mehr ueber das
// Badge-Plugin, dessen ShortcutBadger Sonys Startbildschirm nicht erreicht.
//
// Und erst, wenn eine Zaehlung da ist: Vorher steht appSymbolZahl auf 0, und
// die Zahl, die der stille Push bei geschlossener App gesetzt hat, sprang
// beim Oeffnen kurz auf 0.

const BADGE_COUNTS = '/notifications/badge-counts';

let antwortFreigeben: (() => void) | null = null;
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

const badgeSet = vi.fn().mockResolvedValue(undefined);
const badgeClear = vi.fn().mockResolvedValue(undefined);
vi.mock('@capawesome/capacitor-badge', () => ({
  Badge: { set: (...a: unknown[]) => badgeSet(...a), clear: (...a: unknown[]) => badgeClear(...a) },
}));

let plattform = 'android';
const pluginSetzen = vi.fn().mockResolvedValue(undefined);
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => plattform,
    isPluginAvailable: (name: string) => plattform === 'android' && name === 'AppSymbolZahl',
  },
  registerPlugin: () => ({ setzen: (...a: unknown[]) => pluginSetzen(...a), art: vi.fn() }),
}));

const KONFI = { id: 9, type: 'konfi', role_name: 'konfi', organization_id: 1 };
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: KONFI, organizations: [] }),
}));
vi.mock('../../contexts/LiveUpdateContext', () => ({
  useLiveUpdate: () => ({ socketEpoch: 0 }),
  useLiveRefresh: vi.fn(),
}));

import { BadgeProvider } from '../../contexts/BadgeContext';

// Drei ungelesene Chat-Nachrichten und ein neues Abzeichen: Zahl 4.
const ZAEHLER = {
  data: {
    chat: { total: 3, byRoom: { 12: 3 } },
    newBadges: 1,
    challengeUpdates: { total: 0, byChallenge: {} },
    postfach: { ungelesen: 0 },
  },
};

describe('BadgeContext auf Android: Zahl ueber das eigene Plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    plattform = 'android';
    antwortFreigeben = null;
    mockApiGet.mockImplementation((pfad: string) => {
      if (pfad !== BADGE_COUNTS) return Promise.resolve({ data: {} });
      return new Promise((fertig) => { antwortFreigeben = () => fertig(ZAEHLER); });
    });
  });

  it('setzt vor der ersten Zaehlung nichts -- keine 0 beim Oeffnen', async () => {
    render(<BadgeProvider><span /></BadgeProvider>);
    await waitFor(() => expect(antwortFreigeben).not.toBeNull());

    expect(pluginSetzen).not.toHaveBeenCalled();
    expect(badgeSet).not.toHaveBeenCalled();
    expect(badgeClear).not.toHaveBeenCalled();
  });

  it('setzt nach der Zaehlung die Summe ueber das Plugin, nicht ueber das Badge-Plugin', async () => {
    render(<BadgeProvider><span /></BadgeProvider>);
    await waitFor(() => expect(antwortFreigeben).not.toBeNull());
    antwortFreigeben!();

    await waitFor(() => expect(pluginSetzen).toHaveBeenCalledWith({ zahl: 4 }));
    expect(pluginSetzen).toHaveBeenCalledTimes(1);
    expect(badgeSet).not.toHaveBeenCalled();
    expect(badgeClear).not.toHaveBeenCalled();
  });

  it('setzt auch die 0, wenn die Zaehlung 0 ergibt', async () => {
    mockApiGet.mockResolvedValue({ data: { chat: { total: 0, byRoom: {} }, newBadges: 0 } });
    render(<BadgeProvider><span /></BadgeProvider>);

    await waitFor(() => expect(pluginSetzen).toHaveBeenCalledWith({ zahl: 0 }));
    expect(badgeClear).not.toHaveBeenCalled();
  });

  it('das iPhone bleibt beim Badge-Plugin, wie bisher', async () => {
    plattform = 'ios';
    render(<BadgeProvider><span /></BadgeProvider>);
    await waitFor(() => expect(antwortFreigeben).not.toBeNull());
    antwortFreigeben!();

    await waitFor(() => expect(badgeSet).toHaveBeenCalledWith({ count: 4 }));
    expect(pluginSetzen).not.toHaveBeenCalled();
  });
});
