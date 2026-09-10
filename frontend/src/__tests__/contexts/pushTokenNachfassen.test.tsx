import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';

/**
 * Warum es diese Tests gibt (10.09.2026):
 *
 * Ein Teamer meldete, seit Wochen keine Push-Nachrichten mehr zu bekommen —
 * trotz Neuinstallation und neu erteilter Berechtigung. In der Datenbank hatte
 * er keinen einzigen Token. Nachgemessen: 29 von 68 aktiven Nutzer:innen ohne
 * Token, und Android-Token gab es AUSSCHLIESSLICH bei Konfis (8 Stueck), bei
 * Teamer:innen und Admins keinen einzigen ausser einem Testkonto.
 *
 * Zwei Ursachen, beide hier abgesichert:
 *
 * 1. sendTokenToServer brach ohne Geraete-ID mit einem blanken `return` ab —
 *    ohne Merker, ohne zweiten Versuch. Bei einer Neuinstallation ist die
 *    Geraete-ID beim ersten Start noch nicht da (ein eigener Effect holt sie
 *    per `await Device.getId()`), waehrend Android den Token sofort liefert.
 *
 * 2. Auf Android gab es kein Nachfassen. iOS reicht den Token bei JEDER
 *    App-Aktivierung ueber das AppDelegate nach; Androids MainActivity ist eine
 *    leere Klasse, und 'registration' feuert pro Installation praktisch nur
 *    einmal, weil FCM bei unveraenderter Installation denselben Token liefert.
 *    Der Resume-Pfad rief register() nur alle zwoelf Stunden — und setzte den
 *    Zeitstempel schon nach dem Registrieren, nicht erst nach erfolgreichem
 *    Senden. Ein verpuffter Token sperrte damit den naechsten Anlauf.
 */

let plattform = 'android';
let istNativ = true;

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => istNativ,
    getPlatform: () => plattform,
  },
  registerPlugin: () => ({
    forceAPNSRegistration: vi.fn(),
    forceTokenRetrieval: vi.fn(),
  }),
}));

vi.mock('@capacitor/device', () => ({
  Device: { getId: vi.fn().mockResolvedValue({ identifier: 'geraet-1' }) },
}));

const appListener = vi.fn().mockResolvedValue({ remove: vi.fn() });
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (...a: unknown[]) => appListener(...a),
    fireRestoredResult: vi.fn(),
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

const apiPost = vi.fn().mockResolvedValue({ data: {} });
vi.mock('../../services/api', () => ({
  default: {
    post: (...a: unknown[]) => apiPost(...a),
    get: vi.fn().mockResolvedValue({ data: {} }),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

import { AppProvider, useApp } from '../../contexts/AppContext';
import { BaseUser } from '../../types/user';

const NUTZER: BaseUser = { id: 7, type: 'teamer', display_name: 'Testperson' } as BaseUser;

const Verbraucher: React.FC = () => {
  const ctx = useApp();
  React.useEffect(() => {
    if (!ctx.user) ctx.setUser(NUTZER);
  }, [ctx]);
  return <span data-testid="fertig">{ctx.user?.display_name || 'keiner'}</span>;
};

/** Den 'registration'-Listener herausfischen, den der Push-Effect gesetzt hat. */
const registrierungsListener = (): ((t: { value: string }) => void) | null => {
  const treffer = pushAddListener.mock.calls.find((c) => c[0] === 'registration');
  return treffer ? (treffer[1] as (t: { value: string }) => void) : null;
};

/** Den Rueckruf fuer App-Aktivierung herausfischen. */
const aktivierungsRueckruf = (): ((z: { isActive: boolean }) => void) | null => {
  const treffer = appListener.mock.calls.find((c) => c[0] === 'appStateChange');
  return treffer ? (treffer[1] as (z: { isActive: boolean }) => void) : null;
};

describe('Push-Token: Nachfassen statt stillem Verlust', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    plattform = 'android';
    istNativ = true;
    geraeteId = 'geraet-1';
    pushZeitstempel = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sendet den Token, sobald die Geraete-ID da ist — auch wenn sie beim ersten Anlauf fehlt', async () => {
    // Neuinstallation: Die Geraete-ID steht beim ersten Start noch nicht.
    geraeteId = null;

    await act(async () => {
      render(<AppProvider><Verbraucher /></AppProvider>);
    });
    await act(async () => { await Promise.resolve(); });

    const melden = registrierungsListener();
    expect(melden).not.toBeNull();

    // Android liefert den Token, bevor die Geraete-ID da ist.
    await act(async () => { melden!({ value: 'fcm-token-abc' }); });

    // Vorher ging der Token hier verloren. Jetzt: noch kein POST, aber auch
    // nicht aufgegeben.
    expect(apiPost).not.toHaveBeenCalled();

    // Die Geraete-ID trifft ein, der Nachfass-Versuch laeuft.
    geraeteId = 'geraet-1';
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });

    expect(apiPost).toHaveBeenCalledTimes(1);
    expect(apiPost).toHaveBeenCalledWith('/notifications/device-token', {
      token: 'fcm-token-abc',
      platform: 'android',
      device_id: 'geraet-1',
    });
  });

  it('gibt den Token nach mehreren vergeblichen Anlaeufen nicht verloren, sondern merkt ihn', async () => {
    geraeteId = null;

    await act(async () => {
      render(<AppProvider><Verbraucher /></AppProvider>);
    });
    await act(async () => { await Promise.resolve(); });

    const melden = registrierungsListener();
    await act(async () => { melden!({ value: 'fcm-token-xyz' }); });

    // Die Geraete-ID bleibt aus: 500 + 2000 + 5000 ms verstreichen.
    await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
    expect(apiPost).not.toHaveBeenCalled();

    // Kommt die Verbindung (und die Geraete-ID) spaeter, traegt der Merker.
    geraeteId = 'geraet-1';
    await act(async () => {
      window.dispatchEvent(new Event('sync:reconnect'));
      await Promise.resolve();
    });

    expect(apiPost).toHaveBeenCalledTimes(1);
    expect(apiPost).toHaveBeenCalledWith(
      '/notifications/device-token',
      expect.objectContaining({ token: 'fcm-token-xyz' })
    );
  });

  it('fasst auf Android bei jeder App-Aktivierung nach, nicht nur alle zwoelf Stunden', async () => {
    // Der Zeitstempel ist frisch: Vor der Korrektur haette das jeden weiteren
    // Versuch fuer zwoelf Stunden gesperrt.
    pushZeitstempel = Date.now();

    await act(async () => {
      render(<AppProvider><Verbraucher /></AppProvider>);
    });
    await act(async () => { await Promise.resolve(); });

    const beimStart = pushRegister.mock.calls.length;
    const aktivieren = aktivierungsRueckruf();
    expect(aktivieren).not.toBeNull();

    // Die 5s-Sperre gegen Doppelaufrufe im Resume-Pfad ueberspringen.
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    await act(async () => {
      aktivieren!({ isActive: true });
      await Promise.resolve();
    });

    expect(pushRegister.mock.calls.length).toBeGreaterThan(beimStart);
  });

  it('behaelt auf iOS das Zwoelf-Stunden-Fenster bei', async () => {
    plattform = 'ios';
    pushZeitstempel = Date.now();

    await act(async () => {
      render(<AppProvider><Verbraucher /></AppProvider>);
    });
    await act(async () => { await Promise.resolve(); });

    const beimStart = pushRegister.mock.calls.length;
    const aktivieren = aktivierungsRueckruf();

    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    await act(async () => {
      aktivieren!({ isActive: true });
      await Promise.resolve();
    });

    // iOS reicht den Token ohnehin ueber das AppDelegate nach — hier darf das
    // Fenster greifen, sonst entstuenden ueberfluessige Registrierungen.
    expect(pushRegister.mock.calls.length).toBe(beimStart);
  });

  it('merkt den Zeitstempel erst, wenn der Token wirklich angekommen ist', async () => {
    geraeteId = null;

    await act(async () => {
      render(<AppProvider><Verbraucher /></AppProvider>);
    });
    await act(async () => { await Promise.resolve(); });

    const melden = registrierungsListener();
    await act(async () => { melden!({ value: 'fcm-token-123' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(8000); });

    // Kein POST, also darf auch kein Zeitstempel gesetzt sein — sonst sperrte
    // er den naechsten Anlauf, obwohl nie etwas ankam.
    expect(apiPost).not.toHaveBeenCalled();
    expect(setPushZeitstempel).not.toHaveBeenCalled();
  });
});
