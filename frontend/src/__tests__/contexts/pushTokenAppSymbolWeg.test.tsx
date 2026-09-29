import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';

/**
 * Zahl am App-Symbol auf Android (29.09.2026): Bei der Anmeldung des
 * Push-Tokens meldet die App mit, welcher Weg zum Startbildschirm passt
 * (app_symbol_weg) und welcher Startbildschirm es ist. Der Server richtet
 * danach den Versand je Geraet aus (backend/utils/appSymbolWeg.js).
 *
 * Die Mocks stammen aus pushTokenAktivAbruf.test.tsx; eigene Datei, weil
 * der Token-Merker in AppContext die Installation ueberlebt und nur in
 * einem frischen Modul der Ausgangszustand "noch nichts gesendet" gilt.
 */

let plattform = 'android';
let istNativ = true;

// Das eigene Plugin AppSymbolZahl (Android) liefert Weg und Startbildschirm.
const art = vi.fn();
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => istNativ,
    getPlatform: () => plattform,
    isPluginAvailable: (name: string) => plattform === 'android' && name === 'AppSymbolZahl',
  },
  registerPlugin: (name: string) => (name === 'AppSymbolZahl'
    ? { art: (...a: unknown[]) => art(...a), setzen: vi.fn() }
    : { forceAPNSRegistration: vi.fn(), forceTokenRetrieval: vi.fn() }),
}));

vi.mock('@capacitor/device', () => ({
  Device: { getId: vi.fn().mockResolvedValue({ identifier: 'geraet-1' }) },
}));

const appListener = vi.fn().mockResolvedValue({ remove: vi.fn() });
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (...a: unknown[]) => appListener(...a),
    fireRestoredResult: vi.fn(),
    // Seit 23.09.2026 schickt die App ihre Fassung mit (Migration 156).
    getInfo: vi.fn().mockResolvedValue({ version: '2.3.0', build: '117' }),
  },
}));

const pushRegister = vi.fn().mockResolvedValue(undefined);
const pushAddListener = vi.fn().mockResolvedValue({ remove: vi.fn() });
vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    checkPermissions: vi.fn().mockResolvedValue({ receive: 'granted' }),
    requestPermissions: vi.fn().mockResolvedValue({ receive: 'granted' }),
    register: (...a: unknown[]) => pushRegister(...a),
    addListener: (...a: unknown[]) => pushAddListener(...a),
    removeAllListeners: vi.fn().mockResolvedValue(undefined),
  },
}));

let aktiverToken: string | null = null;
const getTokenMock = vi.fn(async () => ({ token: aktiverToken }));
vi.mock('@capacitor-firebase/messaging', () => ({
  FirebaseMessaging: { getToken: (...a: unknown[]) => getTokenMock(...a) },
}));

vi.mock('@capawesome/capacitor-background-task', () => ({
  BackgroundTask: { beforeExit: vi.fn(), finish: vi.fn() },
}));

let geraeteId: string | null = 'geraet-1';
let pushZeitstempel = 0;
const setPushZeitstempel = vi.fn().mockResolvedValue(undefined);

vi.mock('../../services/tokenStore', () => ({
  getUser: () => null,
  getDeviceId: () => geraeteId,
  setDeviceId: vi.fn().mockResolvedValue(undefined),
  getPushTokenTimestamp: () => pushZeitstempel,
  setPushTokenTimestamp: (...a: unknown[]) => setPushZeitstempel(...a),
  getToken: vi.fn().mockReturnValue(null),
  getRefreshToken: vi.fn().mockReturnValue(null),
  getActiveOrgId: vi.fn().mockReturnValue(null),
  setActiveOrgId: vi.fn(),
  setUser: vi.fn(),
  setToken: vi.fn(),
  setRefreshToken: vi.fn(),
  clearAuth: vi.fn(),
}));

vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: {
    get isOnline() { return true; },
    subscribe: vi.fn(() => () => {}),
    init: vi.fn(),
  },
}));

vi.mock('../../services/writeQueue', () => ({
  writeQueue: {
    flush: vi.fn().mockResolvedValue({ succeeded: [], failed: [] }),
    flushTextOnly: vi.fn().mockResolvedValue({ succeeded: [], failed: [] }),
    clear: vi.fn().mockResolvedValue(undefined),
    getAll: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../services/offlineCache', () => ({
  offlineCache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    isStale: vi.fn().mockReturnValue(false),
    invalidateAll: vi.fn().mockResolvedValue(undefined),
    clearAll: vi.fn().mockResolvedValue(undefined),
  },
}));

const performLogoutMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../../services/auth', () => ({
  // AppContext importiert `logout as performLogout` — der Export heisst logout.
  logout: (...a: unknown[]) => performLogoutMock(...a),
  clearAuth: vi.fn().mockResolvedValue(undefined),
}));

const apiPost = vi.fn().mockResolvedValue({ data: {} });
vi.mock('../../services/api', () => ({
  default: {
    post: (...a: unknown[]) => apiPost(...a),
    get: vi.fn().mockResolvedValue({ data: {} }),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

import type { BaseUser } from '../../types/user';

const NUTZER: BaseUser = { id: 7, type: 'teamer', display_name: 'Testperson' } as BaseUser;

// AppContext haelt den zuletzt gesendeten Token auf Modulebene (er ueberlebt
// bewusst das Abmelden). Jeder Fall laedt das Modul deshalb frisch.
const frischerAppContext = async () => {
  vi.resetModules();
  const { AppProvider, useApp } = await import('../../contexts/AppContext');
  const Verbraucher: React.FC = () => {
    const ctx = useApp();
    React.useEffect(() => {
      if (!ctx.user) ctx.setUser(NUTZER);
    }, [ctx]);
    return <span data-testid="fertig">{ctx.user?.display_name || 'keiner'}</span>;
  };
  return { AppProvider, Verbraucher };
};

const tokenAnmeldung = () => {
  const aufrufe = apiPost.mock.calls.filter(([pfad]) => pfad === '/notifications/device-token');
  expect(aufrufe).toHaveLength(1);
  return aufrufe[0][1] as Record<string, unknown>;
};

describe('Push-Token-Anmeldung: Weg zur Zahl am App-Symbol', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    plattform = 'android';
    istNativ = true;
    geraeteId = 'geraet-1';
    pushZeitstempel = 0;
    aktiverToken = 'fcm-token-mit-weg';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const anmelden = async () => {
    const { AppProvider, Verbraucher } = await frischerAppContext();
    await act(async () => {
      render(<AppProvider><Verbraucher /></AppProvider>);
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
  };

  it('schickt auf Android Weg und Startbildschirm mit', async () => {
    art.mockResolvedValue({ weg: 'anbieter', startbildschirm: 'com.sonymobile.launcher' });
    await anmelden();

    expect(tokenAnmeldung()).toEqual({
      token: 'fcm-token-mit-weg',
      platform: 'android',
      device_id: 'geraet-1',
      app_version: '2.3.0',
      app_build: '117',
      app_symbol_weg: 'anbieter',
      startbildschirm: 'com.sonymobile.launcher',
    });
  });

  it('meldet den Token auch dann an, wenn das Plugin scheitert -- nur ohne die Angaben', async () => {
    art.mockRejectedValue(new Error('kein Startbildschirm'));
    await anmelden();

    const koerper = tokenAnmeldung();
    expect(koerper.token).toBe('fcm-token-mit-weg');
    expect(koerper).not.toHaveProperty('app_symbol_weg');
    expect(koerper).not.toHaveProperty('startbildschirm');
  });
});
