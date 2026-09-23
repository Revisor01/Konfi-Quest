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

/**
 * Wie oben, gibt aber setUser/signOut nach aussen, damit ein Test den
 * Ab- und Wiederanmelde-Weg nachstellen kann. Meldet NICHT von selbst an.
 */
let steuerung: { setUser: (u: BaseUser | null) => void; signOut: () => Promise<void> } | null = null;
const SteuerbarerVerbraucher: React.FC = () => {
  const ctx = useApp();
  steuerung = { setUser: ctx.setUser as (u: BaseUser | null) => void, signOut: ctx.signOut };
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
  /*
   * Nur die REGISTRIERUNGEN zaehlen, nicht jeden POST.
   *
   * Seit dem 23.09.2026 meldet die App eine erfolglose Token-Beschaffung an
   * /notifications/push-diagnose — das ist gewollt und darf die Pruefungen hier
   * nicht verfaelschen.
   */
  const registrierungen = () =>
    apiPost.mock.calls.filter((c) => c[0] === '/notifications/device-token');

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

    // Vorher ging der Token hier verloren. Jetzt: noch keine REGISTRIERUNG,
    // aber auch nicht aufgegeben.
    //
    // Geprueft wird gezielt der device-token-Aufruf, nicht "kein POST
    // ueberhaupt": Seit dem 23.09.2026 meldet die App eine erfolglose
    // Token-Beschaffung an /notifications/push-diagnose. Diese Meldung ist
    // gewollt — sie war die Antwort auf eine Fehlersuche, bei der genau diese
    // Stille nicht zu deuten war.
    expect(registrierungen()).toHaveLength(0);

    // Die Geraete-ID trifft ein, der Nachfass-Versuch laeuft.
    geraeteId = 'geraet-1';
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });

    // Genau EINE Registrierung — die Diagnose-Meldung an
    // /notifications/push-diagnose zaehlt hier nicht mit (23.09.2026).
    expect(registrierungen()).toHaveLength(1);
    expect(apiPost).toHaveBeenCalledWith('/notifications/device-token',
      expect.objectContaining({
        token: 'fcm-token-abc',
        platform: 'android',
        device_id: 'geraet-1',
        app_version: '2.3.0',
        app_build: '117',
      }));
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

  /*
   * ABMELDEN UND WIEDER ANMELDEN (23.09.2026, Fall Malte, Android).
   *
   * Der Logout loescht den Token serverseitig (auth.ts, DELETE /device-token),
   * raeumte aber keine der App-internen Sperren: `pushAlreadyRegistered` blieb
   * true, `fcmTokenSent` behielt den Token, und `prevPushUserIdRef` behielt die
   * alte ID. Beim Wiederanmelden mit DEMSELBEN Konto griff deshalb weder
   * requestPushPermissions (steigt bei pushAlreadyRegistered sofort aus) noch
   * der Nachfass-Weg beim Nutzerwechsel (prev === user.id).
   *
   * Ergebnis: Der Server hatte den Token geloescht, die App hielt sich fuer
   * registriert. Gemessen an Produktion: zwei Anmeldungen um 14:27 und 14:37
   * Uhr, kein einziger POST /device-token in den Logs, kein Token in der
   * Datenbank.
   */
  it('registriert nach Abmelden und Wiederanmelden mit DEMSELBEN Konto erneut', async () => {
    await act(async () => {
      render(<AppProvider><SteuerbarerVerbraucher /></AppProvider>);
    });
    await act(async () => { await Promise.resolve(); });

    // Anmelden und einen Token registrieren.
    await act(async () => { steuerung!.setUser(NUTZER); });
    await act(async () => { await Promise.resolve(); });
    const melden = registrierungsListener();
    await act(async () => { melden!({ value: 'fcm-token-malte' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(apiPost).toHaveBeenCalledTimes(1);

    // Abmelden — der Server verwirft den Token dabei.
    await act(async () => { await steuerung!.signOut(); });
    await act(async () => { await Promise.resolve(); });

    // Wieder anmelden, gleiches Konto, gleicher FCM-Token (unveraenderte
    // Installation liefert denselben).
    apiPost.mockClear();
    await act(async () => { steuerung!.setUser(NUTZER); });
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });

    // Vorher: kein POST, dauerhaft kein Push. Jetzt muss der Token erneut raus.
    expect(apiPost).toHaveBeenCalledWith(
      '/notifications/device-token',
      expect.objectContaining({ token: 'fcm-token-malte', platform: 'android' })
    );
  });

  it('haelt den persistierten Zeitstempel nicht gegen eine Anmeldung', async () => {
    // Der Zeitstempel ueberlebt App-Neustarts (Preferences). Nach einem Logout
    // darf er die neue Anmeldung NICHT sperren — sonst haengt die
    // Registrierung bis zu zwoelf Stunden.
    pushZeitstempel = Date.now();

    await act(async () => {
      render(<AppProvider><SteuerbarerVerbraucher /></AppProvider>);
    });
    await act(async () => { await Promise.resolve(); });

    await act(async () => { steuerung!.setUser(NUTZER); });
    await act(async () => { await Promise.resolve(); });
    const melden = registrierungsListener();
    await act(async () => { melden!({ value: 'fcm-token-frisch' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });

    await act(async () => { await steuerung!.signOut(); });
    apiPost.mockClear();

    await act(async () => { steuerung!.setUser(NUTZER); });
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });

    expect(apiPost).toHaveBeenCalledWith(
      '/notifications/device-token',
      expect.objectContaining({ token: 'fcm-token-frisch' })
    );
  });

  /*
   * Die Kehrseite des Fixes: Der Effect feuert jetzt bei JEDER Anmeldung.
   * Wenn der Token serverseitig schon steht, darf daraus KEIN zusaetzlicher
   * POST entstehen — sonst schickt jeder App-Start eine Registrierung, und das
   * war der Grund, aus dem das 12h-Fenster ueberhaupt eingebaut wurde.
   */
  it('schickt bei App-Start mit bestehender Sitzung keinen zweiten POST, wenn der Token schon steht', async () => {
    await act(async () => {
      render(<AppProvider><SteuerbarerVerbraucher /></AppProvider>);
    });
    await act(async () => { await Promise.resolve(); });

    await act(async () => { steuerung!.setUser(NUTZER); });
    await act(async () => { await Promise.resolve(); });
    const melden = registrierungsListener();
    await act(async () => { melden!({ value: 'fcm-token-stabil' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(apiPost).toHaveBeenCalledTimes(1);

    // Zeitstempel frisch (wie nach erfolgreichem Send) und derselbe Nutzer
    // wird erneut gesetzt — z.B. durch ein Profil-Neuladen.
    pushZeitstempel = Date.now();
    apiPost.mockClear();
    await act(async () => { steuerung!.setUser({ ...NUTZER } as BaseUser); });
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });

    // Das 12h-Fenster greift: kein weiterer POST.
    expect(apiPost).not.toHaveBeenCalled();
  });

  /*
   * UPDATE OHNE AB- UND ANMELDEN (23.09.2026).
   *
   * Der haeufigste Fall in der Praxis: Jemand ist angemeldet, installiert die
   * neue Fassung darueber und meldet sich NICHT neu an. Dann gilt:
   *
   *   - Der Prozess startet neu, alle In-Memory-Merker sind leer
   *     (fcmTokenSent, pendingFcmToken, letzterBekannterFcmToken)
   *   - Der persistierte Zeitstempel ueberlebt das Update (Preferences)
   *   - Serverseitig steht der Token noch — er wurde nie geloescht
   *
   * Der Token kommt trotzdem an, sobald Firebase ihn meldet: `fcmTokenSent` ist
   * nach dem Neustart null, und die 12h-Sperre verlangt `fcmTokenSent === token`
   * — sie greift also nicht.
   *
   * WICHTIG, damit dieser Test nicht falsch gelesen wird: Er belegt KEINE
   * Wirkung des Fixes vom 23.09.2026. Gegenprobe gelaufen — mit dem alten
   * Verhalten (nur Konto-WECHSEL loest aus) bleibt er ebenfalls gruen. Dieser
   * Weg war nie kaputt. Der Test haelt ihn fest, weil der Fix die
   * Anmelde-Logik anfasst und dabei nichts an diesem haeufigsten Fall brechen
   * darf: eingeloggt bleiben, neue Fassung darueber installieren.
   */
  it('registriert nach einem Update ohne Ab- und Anmelden, trotz frischem Zeitstempel', async () => {
    // Wie nach einem Update: Zeitstempel aus der alten Fassung ist frisch,
    // der Prozess aber neu. Die Modul-Merker raeumt der signOut unten — das
    // Modul selbst wird NUR EINMAL importiert, seine Merker ueberleben sonst
    // von Test zu Test.
    pushZeitstempel = Date.now();

    await act(async () => {
      render(<AppProvider><SteuerbarerVerbraucher /></AppProvider>);
    });
    await act(async () => { await Promise.resolve(); });

    // Sitzung besteht weiter — kein Anmeldevorgang, der Nutzer ist einfach da.
    await act(async () => { steuerung!.setUser(NUTZER); });
    await act(async () => { await Promise.resolve(); });

    // Firebase meldet den Token nach dem Start.
    const melden = registrierungsListener();
    expect(melden).not.toBeNull();
    await act(async () => { melden!({ value: 'fcm-token-nach-update' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });

    expect(apiPost).toHaveBeenCalledWith(
      '/notifications/device-token',
      expect.objectContaining({ token: 'fcm-token-nach-update', platform: 'android' })
    );
  });

  /*
   * ANMELDEN, WENN 'registration' SCHWEIGT (23.09.2026, Fall Malte, Android).
   *
   * Der eigentliche Kern des Android-Problems: Es gab genau EINEN Weg zum
   * Token — register() aufrufen und auf das Ereignis 'registration' warten.
   * Bei unveraenderter Installation feuert das nicht wieder, weil FCM
   * denselben Token liefert und ihn nur einmal meldet. MainActivity reicht
   * nichts nach, und das FCM-Plugin haengt an AppDelegate.swift (iOS-only).
   *
   * Nachgemessen an Produktion: Zwei Anmeldungen um 18:25 und 18:30 Uhr, in
   * den Server-Logs KEIN einziger POST /device-token und kein Fehler. Die
   * Benachrichtigungs-Berechtigung stand auf 'granted' (per Screenshot
   * bestaetigt) — es war kein Geraeteproblem, sondern unser fehlender Weg.
   *
   * Hier feuert der Listener bewusst NICHT. Der Token muss trotzdem ankommen,
   * weil er aktiv bei Firebase abgefragt wird.
   */
  it('fragt nicht aktiv nach, wenn der Token schon bekannt ist', async () => {
    // Sonst entstuende bei jedem Anmelden ein zusaetzlicher Plugin-Aufruf.
    aktiverToken = 'sollte-nicht-gebraucht-werden';

    await act(async () => {
      render(<AppProvider><SteuerbarerVerbraucher /></AppProvider>);
    });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { steuerung!.setUser(NUTZER); });
    await act(async () => { await Promise.resolve(); });

    const melden = registrierungsListener();
    await act(async () => { melden!({ value: 'fcm-token-per-ereignis' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    getTokenMock.mockClear();

    // Erneutes Setzen desselben Nutzers: Der Token ist bekannt, also kein
    // aktiver Abruf.
    await act(async () => { steuerung!.setUser({ ...NUTZER } as BaseUser); });
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });

    expect(getTokenMock).not.toHaveBeenCalled();
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
