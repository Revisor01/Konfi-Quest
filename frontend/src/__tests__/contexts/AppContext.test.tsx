import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';

// --- Mocks für alle Capacitor-Plugins und Services ---

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
  Device: {
    getId: vi.fn().mockResolvedValue({ identifier: 'test-device-id' }),
  },
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
  BackgroundTask: {
    beforeExit: vi.fn(),
    finish: vi.fn(),
  },
}));

const mockGetUser = vi.fn().mockReturnValue(null);
const mockGetDeviceId = vi.fn().mockReturnValue(null);
const mockSetDeviceId = vi.fn().mockResolvedValue(undefined);
const mockGetPushTokenTimestamp = vi.fn().mockReturnValue(0);
const mockSetPushTokenTimestamp = vi.fn().mockResolvedValue(undefined);

vi.mock('../../services/tokenStore', () => ({
  getUser: () => mockGetUser(),
  getDeviceId: () => mockGetDeviceId(),
  setDeviceId: (...args: any[]) => mockSetDeviceId(...args),
  getPushTokenTimestamp: () => mockGetPushTokenTimestamp(),
  setPushTokenTimestamp: (...args: any[]) => mockSetPushTokenTimestamp(...args),
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

const mockQueueFlush = vi.fn().mockResolvedValue({ succeeded: [], failed: [] });
const mockQueueClear = vi.fn().mockResolvedValue(undefined);
const mockQueueGetAll = vi.fn().mockResolvedValue([]);

vi.mock('../../services/writeQueue', () => ({
  writeQueue: {
    flush: (...args: any[]) => mockQueueFlush(...args),
    flushTextOnly: vi.fn().mockResolvedValue({ succeeded: [], failed: [] }),
    clear: (...args: any[]) => mockQueueClear(...args),
    getAll: (...args: any[]) => mockQueueGetAll(...args),
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
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

import api from '../../services/api';
import { AppProvider, useApp } from '../../contexts/AppContext';
import { BaseUser } from '../../types/user';

// Test-Consumer-Komponente
const TestConsumer: React.FC<{ onContext?: (ctx: ReturnType<typeof useApp>) => void }> = ({ onContext }) => {
  const ctx = useApp();
  // Callback für Tests die den Context direkt brauchen
  React.useEffect(() => {
    onContext?.(ctx);
  });
  return (
    <div>
      <span data-testid="user">{ctx.user?.display_name || 'none'}</span>
      <span data-testid="loading">{String(ctx.loading)}</span>
      <span data-testid="error">{ctx.error || 'no-error'}</span>
      <span data-testid="success">{ctx.success || 'no-success'}</span>
      <span data-testid="isOnline">{String(ctx.isOnline)}</span>
      <button data-testid="setError" onClick={() => ctx.setError('Test-Fehler')}>setError</button>
      <button data-testid="setSuccess" onClick={() => ctx.setSuccess('Erfolg!')}>setSuccess</button>
      <button data-testid="clearMessages" onClick={() => ctx.clearMessages()}>clearMessages</button>
      <button data-testid="setUser" onClick={() => ctx.setUser({
        id: 1,
        type: 'konfi',
        display_name: 'Test-Konfi',
      } as BaseUser)}>setUser</button>
      <button data-testid="logoutUser" onClick={() => ctx.setUser(null)}>logoutUser</button>
    </div>
  );
};

describe('AppContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockReturnValue(null);
  });

  it('AppProvider rendert children korrekt', () => {
    render(
      <AppProvider>
        <div data-testid="child">Hallo</div>
      </AppProvider>
    );

    expect(screen.getByTestId('child')).toHaveTextContent('Hallo');
  });

  it('useApp() wirft Fehler ausserhalb von AppProvider', () => {
    // Console.error unterdruecken für den erwarteten Fehler
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestConsumer />);
    }).toThrow('useApp must be used within an AppProvider');

    consoleSpy.mockRestore();
  });

  it('user ist initial null (getUser gibt null)', () => {
    render(
      <AppProvider>
        <TestConsumer />
      </AppProvider>
    );

    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('user ist initial getUser() aus tokenStore wenn vorhanden', () => {
    mockGetUser.mockReturnValue({
      id: 5,
      type: 'admin',
      display_name: 'Admin-User',
    } as BaseUser);

    render(
      <AppProvider>
        <TestConsumer />
      </AppProvider>
    );

    expect(screen.getByTestId('user')).toHaveTextContent('Admin-User');
  });

  it('setUser() aktualisiert user State', async () => {
    render(
      <AppProvider>
        <TestConsumer />
      </AppProvider>
    );

    expect(screen.getByTestId('user')).toHaveTextContent('none');

    await act(async () => {
      screen.getByTestId('setUser').click();
    });

    expect(screen.getByTestId('user')).toHaveTextContent('Test-Konfi');
  });

  it('setError() aktualisiert error State', async () => {
    render(
      <AppProvider>
        <TestConsumer />
      </AppProvider>
    );

    expect(screen.getByTestId('error')).toHaveTextContent('no-error');

    await act(async () => {
      screen.getByTestId('setError').click();
    });

    expect(screen.getByTestId('error')).toHaveTextContent('Test-Fehler');
  });

  it('setSuccess() aktualisiert success State', async () => {
    render(
      <AppProvider>
        <TestConsumer />
      </AppProvider>
    );

    expect(screen.getByTestId('success')).toHaveTextContent('no-success');

    await act(async () => {
      screen.getByTestId('setSuccess').click();
    });

    expect(screen.getByTestId('success')).toHaveTextContent('Erfolg!');
  });

  it('clearMessages() setzt error und success auf leer', async () => {
    render(
      <AppProvider>
        <TestConsumer />
      </AppProvider>
    );

    // Erst Messages setzen
    await act(async () => {
      screen.getByTestId('setError').click();
    });
    await act(async () => {
      screen.getByTestId('setSuccess').click();
    });

    expect(screen.getByTestId('error')).toHaveTextContent('Test-Fehler');
    expect(screen.getByTestId('success')).toHaveTextContent('Erfolg!');

    // Dann clearen
    await act(async () => {
      screen.getByTestId('clearMessages').click();
    });

    expect(screen.getByTestId('error')).toHaveTextContent('no-error');
    expect(screen.getByTestId('success')).toHaveTextContent('no-success');
  });

  it('isOnline ist initial true', () => {
    render(
      <AppProvider>
        <TestConsumer />
      </AppProvider>
    );

    expect(screen.getByTestId('isOnline')).toHaveTextContent('true');
  });

  it('stoesst beim Start die Schreib-Queue an (Kaltstart-Flush)', async () => {
    // Kaltstart: keiner der uebrigen Ausloeser (Online-Wechsel, Reconnect,
    // Resume) feuert — ohne den Start-Flush blieben Queue-Items liegen.
    await act(async () => {
      render(
        <AppProvider>
          <TestConsumer />
        </AppProvider>
      );
    });

    expect(mockQueueFlush).toHaveBeenCalled();
  });

  describe('switchOrg und die Schreib-Queue', () => {
    const renderMitContext = async () => {
      let ctx: ReturnType<typeof useApp> | undefined;
      await act(async () => {
        render(
          <AppProvider>
            <TestConsumer onContext={(c) => { ctx = c; }} />
          </AppProvider>
        );
      });
      return () => ctx!;
    };

    it('flusht die Queue der alten Organisation BEVOR sie geleert wird', async () => {
      const getCtx = await renderMitContext();
      // Start-Flush aus der Zaehlung nehmen — geprueft wird der switchOrg-Flush
      mockQueueFlush.mockClear();
      (api.post as any).mockResolvedValue({ data: { token: 'neues-token', type: 'admin', is_primary: false } });

      await act(async () => {
        await getCtx().switchOrg(2);
      });

      expect(mockQueueFlush).toHaveBeenCalled();
      expect(mockQueueClear).toHaveBeenCalledTimes(1);
      const ersterFlush = Math.min(...mockQueueFlush.mock.invocationCallOrder);
      const clearAufruf = mockQueueClear.mock.invocationCallOrder[0];
      expect(ersterFlush).toBeLessThan(clearAufruf);
    });

    it('meldet ehrlich, wenn eine ungesendete Chat-Nachricht verworfen wird', async () => {
      const getCtx = await renderMitContext();
      (api.post as any).mockResolvedValue({ data: { token: 'neues-token', type: 'admin', is_primary: false } });
      // Nach dem (erfolglosen) Flush liegt noch eine Chat-Nachricht in der Queue
      mockQueueGetAll.mockResolvedValueOnce([
        { id: 'q1', metadata: { type: 'chat', clientId: 'c1', roomId: 1 } },
        { id: 'q2', metadata: { type: 'fire-and-forget', clientId: 'f1' } },
      ]);

      await act(async () => {
        await getCtx().switchOrg(2);
      });

      expect(screen.getByTestId('error')).toHaveTextContent(
        'Eine ungesendete Chat-Nachricht konnte vor dem Wechsel nicht mehr zugestellt werden'
      );
    });
  });
});
