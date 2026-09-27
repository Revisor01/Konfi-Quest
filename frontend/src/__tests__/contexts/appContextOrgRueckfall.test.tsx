import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';

// 403-Rueckfall auf die Stamm-Gemeinde: der Socket muss mit dem NEUEN Token
// neu aufgebaut werden (Audit 26.09.2026, Grundgeruest BF-05, HOCH).
//
// api.ts hat im Rueckfall bereits ein Token OHNE Org-Claim beschafft und
// feuert danach 'auth:org-fallback'. Der AppContext setzte daraufhin nur
// State und Cache zurueck und remountete den Router. Der Socket lief mit
// dem alten Token weiter: initializeWebSocket gibt einen bestehenden Socket
// unveraendert zurueck, und der Server lehnte jeden Reconnect mit "Kein
// Zugriff auf diese Organisation" ab -- alle <=30 s, ohne dass jemand den
// Token tauschte. Beim bewussten Wechsel (switchOrg) macht der Kontext den
// Neuaufbau laengst (reconnectWithToken); der unfreiwillige Wechsel muss es
// genauso.

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

vi.mock('../../services/tokenStore', () => ({
  getUser: () => null,
  getDeviceId: () => null,
  setDeviceId: vi.fn().mockResolvedValue(undefined),
  getPushTokenTimestamp: () => 0,
  setPushTokenTimestamp: vi.fn().mockResolvedValue(undefined),
  getToken: () => mockGetToken(),
  getRefreshToken: vi.fn().mockReturnValue(null),
  getActiveOrgId: vi.fn().mockReturnValue(null),
  setActiveOrgId: (...args: unknown[]) => mockSetActiveOrgId(...args),
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

vi.mock('../../services/api', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: {} }),
    get: vi.fn().mockResolvedValue({ data: {} }),
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

import { AppProvider } from '../../contexts/AppContext';

describe('AppContext — 403-Rueckfall auf die Stamm-Gemeinde', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockReturnValue('token-ohne-claim');
  });

  const rendern = async () => {
    await act(async () => {
      render(
        <AppProvider>
          <span>kind</span>
        </AppProvider>
      );
    });
  };

  it('baut den Socket mit dem neuen Token (ohne Org-Claim) neu auf', async () => {
    await rendern();
    mockReconnectWithToken.mockClear();

    await act(async () => {
      window.dispatchEvent(new CustomEvent('auth:org-fallback'));
    });

    expect(mockReconnectWithToken).toHaveBeenCalledTimes(1);
    expect(mockReconnectWithToken).toHaveBeenCalledWith('token-ohne-claim');
    // Der Cache der verlorenen Gemeinde ist weg wie bisher.
    expect(mockClearAll).toHaveBeenCalled();
  });

  it('ohne Token (Sitzung inzwischen weg) kein Socket-Neuaufbau', async () => {
    await rendern();
    mockReconnectWithToken.mockClear();
    mockGetToken.mockReturnValue(null);

    await act(async () => {
      window.dispatchEvent(new CustomEvent('auth:org-fallback'));
    });

    expect(mockReconnectWithToken).not.toHaveBeenCalled();
  });
});
