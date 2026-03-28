import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';

// --- Mocks fuer alle Capacitor-Plugins und Services ---

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
    flushTextOnly: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/offlineCache', () => ({
  offlineCache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    isStale: vi.fn().mockReturnValue(false),
    invalidateAll: vi.fn().mockResolvedValue(undefined),
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

import { AppProvider, useApp } from '../../contexts/AppContext';
import { BaseUser } from '../../types/user';

// Test-Consumer-Komponente
const TestConsumer: React.FC<{ onContext?: (ctx: ReturnType<typeof useApp>) => void }> = ({ onContext }) => {
  const ctx = useApp();
  // Callback fuer Tests die den Context direkt brauchen
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
    // Console.error unterdruecken fuer den erwarteten Fehler
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
});
