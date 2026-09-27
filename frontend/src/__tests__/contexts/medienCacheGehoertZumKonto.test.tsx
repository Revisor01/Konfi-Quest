import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';

// Der Medien-Cache gehört zum Konto und zur Gemeinde (27.09.2026).
//
// Befund: Der Cache mit den Chat-Medien — und seit dem gemeinsamen Cache auch
// den Challenge-Fotos — wurde nur von Hand geleert. Der Wechsel der Gemeinde
// räumte zwar alle anderen Zwischenspeicher ("keine Daten der alten Org"),
// den Medien-Cache aber nicht; nach dem Rückfall auf die Stamm-Gemeinde
// (Mitgliedschaft entzogen) ebenso wenig. Und meldete sich nach einer
// abgelaufenen Sitzung ein ANDERES Konto an, fand es die Medien des vorigen
// auf dem Gerät vor.
//
// Geprüft wird der echte AppProvider; der Cache selbst ist gestellt, weil
// hier die Verdrahtung zählt (der Cache ist in medienCacheKonto.test.ts
// geprüft).

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' },
  registerPlugin: () => ({ forceAPNSRegistration: vi.fn(), forceTokenRetrieval: vi.fn() }),
}));
vi.mock('@capacitor/device', () => ({
  Device: { getId: vi.fn().mockResolvedValue({ identifier: 'test-device-id' }) },
}));
vi.mock('@capacitor/app', () => ({
  App: { addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }), fireRestoredResult: vi.fn() },
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

vi.mock('../../services/tokenStore', () => ({
  getUser: vi.fn().mockReturnValue(null),
  getDeviceId: vi.fn().mockReturnValue(null),
  setDeviceId: vi.fn().mockResolvedValue(undefined),
  getPushTokenTimestamp: vi.fn().mockReturnValue(0),
  setPushTokenTimestamp: vi.fn().mockResolvedValue(undefined),
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
  networkMonitor: { get isOnline() { return true; }, subscribe: vi.fn(() => () => {}), init: vi.fn() },
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
vi.mock('../../services/api', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: {} }),
    get: vi.fn().mockResolvedValue({ data: {} }),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

const mockLogout = vi.fn<() => Promise<void>>(async () => undefined);
vi.mock('../../services/auth', () => ({
  logout: () => mockLogout(),
}));

const mockClearMediaCache = vi.fn<() => Promise<void>>(async () => undefined);
const mockKontoPruefen = vi.fn<(konto: number | string) => Promise<void>>(async () => undefined);
vi.mock('../../services/mediaCache', () => ({
  clearMediaCache: () => mockClearMediaCache(),
  medienCacheKontoPruefen: (konto: number | string) => mockKontoPruefen(konto),
}));

import api from '../../services/api';
import { AppProvider, useApp } from '../../contexts/AppContext';
import type { BaseUser } from '../../types/user';

const renderMitContext = async () => {
  let ctx: ReturnType<typeof useApp> | undefined;
  const Abgreifer: React.FC = () => {
    const c = useApp();
    React.useEffect(() => { ctx = c; });
    return null;
  };
  await act(async () => {
    render(<AppProvider><Abgreifer /></AppProvider>);
  });
  return () => ctx!;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Anmelden: der Cache folgt dem angemeldeten Konto', () => {
  it('meldet jedes angemeldete Konto an den Cache — ein Wechsel leert dort', async () => {
    const ctx = await renderMitContext();

    await act(async () => { ctx().setUser({ id: 1, type: 'konfi', display_name: 'Lena' } as BaseUser); });
    await act(async () => { ctx().setUser(null); });
    await act(async () => { ctx().setUser({ id: 2, type: 'konfi', display_name: 'Tom' } as BaseUser); });

    expect(mockKontoPruefen.mock.calls.map(([k]) => k)).toEqual([1, 2]);
  });

  it('ohne Konto (abgemeldet) wird nichts gemeldet', async () => {
    await renderMitContext();

    expect(mockKontoPruefen).not.toHaveBeenCalled();
  });
});

describe('Gemeindewechsel', () => {
  it('ein gelungener Wechsel leert den Medien-Cache', async () => {
    const ctx = await renderMitContext();
    vi.mocked(api.post).mockResolvedValue({ data: { token: 'neues-token', type: 'admin', is_primary: false } });

    await act(async () => { await ctx().switchOrg(2); });

    expect(mockClearMediaCache).toHaveBeenCalledTimes(1);
  });

  it('ein gescheiterter Wechsel lässt ihn stehen (die Gemeinde bleibt dieselbe)', async () => {
    const ctx = await renderMitContext();
    vi.mocked(api.post).mockRejectedValue(new Error('Netz weg'));

    await act(async () => { await ctx().switchOrg(2); });

    expect(mockClearMediaCache).not.toHaveBeenCalled();
  });

  it('der Rückfall nach entzogener Mitgliedschaft leert ihn ebenfalls', async () => {
    await renderMitContext();

    await act(async () => {
      window.dispatchEvent(new CustomEvent('auth:org-fallback'));
      await Promise.resolve();
    });

    expect(mockClearMediaCache).toHaveBeenCalledTimes(1);
  });
});

describe('Abmelden über die Oberfläche', () => {
  it('scheitert der geordnete Logout, leert die Notbremse trotzdem den Cache', async () => {
    mockLogout.mockRejectedValueOnce(new Error('kaputt'));
    const ctx = await renderMitContext();

    await act(async () => { await ctx().signOut(); });

    expect(mockClearMediaCache).toHaveBeenCalledTimes(1);
  });

  it('läuft der Logout durch, leert er selbst — die Oberfläche nicht noch einmal', async () => {
    const ctx = await renderMitContext();

    await act(async () => { await ctx().signOut(); });

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockClearMediaCache).not.toHaveBeenCalled();
  });
});
