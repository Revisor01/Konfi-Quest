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

describe('Push-Token: aktiver Abruf, wenn Android nichts meldet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    plattform = 'android';
    istNativ = true;
    geraeteId = 'geraet-1';
    pushZeitstempel = 0;
    aktiverToken = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /*
   * DER KERN DES ANDROID-PROBLEMS (23.09.2026, Fall Malte).
   *
   * Es gab genau EINEN Weg zum Token: register() aufrufen und auf das
   * Ereignis 'registration' warten. Bei unveraenderter Installation feuert das
   * nicht wieder, weil FCM denselben Token liefert und ihn nur einmal pro
   * Installation meldet. MainActivity ist eine reine BridgeActivity und reicht
   * nichts nach; das FCM-Plugin haengt an AppDelegate.swift (iOS-only).
   *
   * Nachgemessen an Produktion: Zwei Anmeldungen um 18:25 und 18:30 Uhr, in
   * den Server-Logs KEIN einziger POST /device-token und kein Fehler. Die
   * Berechtigung stand auf 'granted' (per Screenshot bestaetigt) — es war kein
   * Geraeteproblem, sondern unser fehlender Weg.
   *
   * WARUM EIGENE DATEI: `letzterBekannterFcmToken` ueberlebt das Abmelden
   * bewusst (Eigenschaft der Installation, kein Sitzungszustand). In der
   * Sammeldatei stammt er aus einem vorherigen Test, und der Ausgangszustand
   * "noch kein Token bekannt" — der Zustand nach einem App-Update — ist dort
   * nicht herstellbar. Hier ist das Modul frisch.
   */
  it('holt den Token aktiv, wenn registration nach dem Anmelden schweigt', async () => {
    aktiverToken = 'fcm-token-aktiv-geholt';

    await act(async () => {
      render(<AppProvider><Verbraucher /></AppProvider>);
    });
    // Der Listener bleibt bewusst still — wie auf Maltes Geraet.
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });

    expect(getTokenMock).toHaveBeenCalled();
    // Die App schickt seit dem 23.09.2026 ihre Fassung mit (Migration 156) —
    // deshalb auf die Felder pruefen, die zaehlen, statt auf das ganze Objekt.
    expect(apiPost).toHaveBeenCalledWith('/notifications/device-token',
      expect.objectContaining({
        token: 'fcm-token-aktiv-geholt',
        platform: 'android',
        device_id: 'geraet-1',
        app_version: '2.3.0',
        app_build: '117',
      }));
  });
});
