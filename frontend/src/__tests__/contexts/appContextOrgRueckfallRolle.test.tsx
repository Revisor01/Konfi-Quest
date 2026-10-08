import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';

// 403-Rueckfall auf die Stamm-Gemeinde: Rolle, Typ und Gemeindename im
// Nutzer-Zustand muessen der Gemeinde folgen, in der die App danach arbeitet
// (08.10.2026, Befund "Gemeinde-Rueckfall laesst Rolle und Namen stehen",
// Grundgeruest BF-05, Nebenbefund).
//
// Vorher setzte der Rueckfall Token, Zwischenspeicher und Socket zurueck,
// liess aber role_name, type und organization der entzogenen Gemeinde im
// Zustand stehen: Wer in der Zweitgemeinde Leitung war und zuhause Teamer:in
// ist, sah bis zum naechsten Start die Leitungs-Oberflaeche, deren Knoepfe
// der Server mit 403 abwies. GET /auth/me meldet Rolle, Typ und Gemeinde der
// aktiven Gemeinde.

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
    getPlatform: () => 'web',
  },
  registerPlugin: () => ({
    forceAPNSRegistration: vi.fn(),
    forceTokenRetrieval: vi.fn(),
  }),
}));

vi.mock('@capacitor/device', () => ({
  Device: { getId: vi.fn().mockResolvedValue({ identifier: 'test-device-id' }) },
}));

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
    fireRestoredResult: vi.fn(),
  },
}));

vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    checkPermissions: vi.fn().mockResolvedValue({ receive: 'denied' }),
    requestPermissions: vi.fn().mockResolvedValue({ receive: 'denied' }),
    register: vi.fn().mockResolvedValue(undefined),
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
    removeAllListeners: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@capawesome/capacitor-background-task', () => ({
  BackgroundTask: { beforeExit: vi.fn(), finish: vi.fn() },
}));

// Das Token, das api.ts im Rueckfall frisch (ohne Org-Claim) gespeichert hat.
const mockGetToken = vi.fn().mockReturnValue('token-ohne-claim');
const mockSetActiveOrgId = vi.fn().mockResolvedValue(undefined);

// Der gespeicherte Nutzer: zuletzt in der Zweitgemeinde als Leitung.
let gespeichert: Record<string, unknown> | null = null;

vi.mock('../../services/tokenStore', () => ({
  getUser: () => gespeichert,
  getDeviceId: () => null,
  setDeviceId: vi.fn().mockResolvedValue(undefined),
  getPushTokenTimestamp: () => 0,
  setPushTokenTimestamp: vi.fn().mockResolvedValue(undefined),
  getToken: () => mockGetToken(),
  getRefreshToken: vi.fn().mockReturnValue(null),
  getActiveOrgId: vi.fn().mockReturnValue(null),
  setActiveOrgId: (...args: unknown[]) => mockSetActiveOrgId(...args),
  setUser: vi.fn(async (u: Record<string, unknown>) => { gespeichert = u; }),
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

const mockClearAll = vi.fn().mockResolvedValue(undefined);
vi.mock('../../services/offlineCache', () => ({
  offlineCache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    isStale: vi.fn().mockReturnValue(false),
    invalidateAll: vi.fn().mockResolvedValue(undefined),
    clearAll: (...args: unknown[]) => mockClearAll(...args),
  },
}));

// /auth/me antwortet erst nach dem Rueckfall mit der Stamm-Gemeinde.
let meAntwort: Record<string, unknown> = {};
const mockGet = vi.fn(async (url: string) => {
  if (url === '/auth/me') return { data: meAntwort };
  if (url === '/auth/my-organizations') return { data: [] };
  return { data: {} };
});
vi.mock('../../services/api', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: {} }),
    get: (url: string) => mockGet(url),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

const mockReconnectWithToken = vi.fn();
vi.mock('../../services/websocket', () => ({
  reconnectWithToken: (...args: unknown[]) => mockReconnectWithToken(...args),
  ensureSocketConnected: vi.fn(),
}));

import { AppProvider, useApp } from '../../contexts/AppContext';

// Ein Halter statt einer Variable: React verbietet, aus einer Komponente eine
// aeussere Variable neu zu belegen (Lint-Regel des React-Compilers).
const halter: { aktuell: ReturnType<typeof useApp> | null } = { aktuell: null };
const Lauscher = () => {
  halter.aktuell = useApp();
  return null;
};

describe('AppContext — Rueckfall gleicht Rolle und Gemeinde an', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockReturnValue('token-ohne-claim');
    gespeichert = {
      id: 7, display_name: 'Mia', type: 'admin', role_name: 'org_admin',
      organization: 'Zweitgemeinde', organization_id: 2,
    };
    // Beim Start ist die Zweitgemeinde noch aktiv.
    meAntwort = { role_name: 'org_admin', type: 'admin', organization: 'Zweitgemeinde', organization_id: 2 };
  });

  it('nach dem Rueckfall stehen Rolle, Typ und Gemeindename der Stamm-Gemeinde im Zustand', async () => {
    await act(async () => {
      render(
        <AppProvider>
          <Lauscher />
        </AppProvider>
      );
    });
    expect(halter.aktuell?.user?.role_name).toBe('org_admin');

    // Zugang zur Zweitgemeinde entzogen: api.ts hat schon zurueckgestellt,
    // /auth/me meldet jetzt die Stamm-Gemeinde.
    meAntwort = { role_name: 'teamer', type: 'teamer', organization: 'Stammgemeinde', organization_id: 1 };
    await act(async () => {
      window.dispatchEvent(new CustomEvent('auth:org-fallback'));
    });

    expect(halter.aktuell?.user?.role_name).toBe('teamer');
    expect(halter.aktuell?.user?.type).toBe('teamer');
    expect((halter.aktuell?.user as unknown as { organization: string }).organization).toBe('Stammgemeinde');
    expect(gespeichert).toMatchObject({ role_name: 'teamer', type: 'teamer', organization: 'Stammgemeinde', organization_id: 1 });
    // Die Liste fuer den Umschalter wird neu geholt.
    expect(mockGet).toHaveBeenCalledWith('/auth/my-organizations');
  });
});
