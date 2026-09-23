import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';

/**
 * Warum es diese Tests gibt (23.09.2026):
 *
 * Der aktive Token-Abruf hatte genau EINEN Versuch. Scheiterte der — ein
 * Netzaussetzer, ein Geraet gerade aus dem Flugmodus, ein FIS-Aussetzer bei
 * Firebase — blieb das Geraet bis zur naechsten Anmeldung ohne Token, und zwar
 * still. In den Server-Protokollen war bei einem Nutzer belegt, dass mehrere
 * Anmeldungen noetig waren, bis ueberhaupt ein Token entstand.
 *
 * Konkret gemeldet wurde auf Android `java.io.IOException: FIS_AUTH_ERROR`
 * beim Aufruf von FirebaseMessaging.getToken(). Das Firebase-Android-SDK
 * sperrt nach einem FIS-403 weitere Versuche fuer 24 Stunden — aber nur im
 * Prozessspeicher, ein App-Neustart bekommt einen frischen Versuch. Deshalb
 * trat der Fehler mal auf und mal nicht.
 *
 * Abgesichert wird hier:
 *
 * 1. Mehrere Versuche mit wachsendem Abstand, statt einem einzigen.
 * 2. Beim ERSTEN Erfolg ist Schluss — keine ueberfluessigen Versuche.
 * 3. GENAU EINE Diagnose-Meldung am Ende, mit der Zahl der Versuche.
 * 4. Der letzte Versuch raeumt vorher den lokalen Firebase-Zustand
 *    (deleteToken), die frueheren nicht.
 * 5. Die Wiederholung haelt den Anmeldevorgang nicht auf.
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

/*
 * getToken ist hier das Stellrad: `abrufe` ist eine Liste von Antworten, die
 * der Reihe nach abgearbeitet wird. Ein Eintrag ist entweder ein Token oder
 * ein Fehler. Nach dem Ende der Liste bleibt die letzte Antwort stehen.
 */
type Abruf = { token: string | null } | { fehler: Error };
let abrufe: Abruf[] = [];
const getTokenMock = vi.fn(async () => {
  const eintrag = abrufe[Math.min(getTokenMock.mock.calls.length - 1, abrufe.length - 1)];
  if (eintrag && 'fehler' in eintrag) throw eintrag.fehler;
  return { token: eintrag ? eintrag.token : null };
});
const deleteTokenMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@capacitor-firebase/messaging', () => ({
  FirebaseMessaging: {
    getToken: (...a: unknown[]) => getTokenMock(...a),
    deleteToken: (...a: unknown[]) => deleteTokenMock(...a),
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

const performLogoutMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../../services/auth', () => ({
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

import { BaseUser } from '../../types/user';

const NUTZER: BaseUser = { id: 7, type: 'teamer', display_name: 'Testperson' } as BaseUser;

/*
 * JEDER Test bekommt ein FRISCHES Modul.
 *
 * `letzterBekannterFcmToken` in AppContext ueberlebt das Abmelden bewusst — es
 * ist eine Eigenschaft der Installation, kein Sitzungszustand. Ohne Reset
 * stammt der Token aus dem vorherigen Test, und dann fragt die App gar nicht
 * mehr aktiv nach: Der Ausgangszustand "noch kein Token bekannt" — der Zustand
 * nach einem App-Update — waere hier nur im ersten Test herstellbar.
 */
const frischLaden = async () => {
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

describe('Push-Token: Wiederholung mit wachsendem Abstand', () => {
  /** Nur die Registrierungen, nicht die Diagnose-Meldungen. */
  const registrierungen = () =>
    apiPost.mock.calls.filter((c) => c[0] === '/notifications/device-token');

  /** Diagnose-Meldungen, auf Wunsch nach Grund gefiltert. */
  const diagnosen = (grund?: string) =>
    apiPost.mock.calls.filter((c) =>
      c[0] === '/notifications/push-diagnose' &&
      (!grund || (c[1] as { grund?: string }).grund === grund));

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    plattform = 'android';
    istNativ = true;
    geraeteId = 'geraet-1';
    pushZeitstempel = 0;
    abrufe = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /*
   * DER KERN (23.09.2026): Ein transienter Fehler darf das Geraet nicht bis
   * zur naechsten Anmeldung ohne Token lassen.
   *
   * Die Abstaende sind 1s/3s — nach 4 Sekunden Gesamtwartezeit steht der
   * dritte Versuch. Der Test schiebt die Zeit kuenstlich vor; echtes Warten
   * waere ein kaputter Test.
   */
  it('wiederholt den Abruf nach einem Netzfehler und sendet den Token beim zweiten Versuch', async () => {
    abrufe = [
      { fehler: new Error('Network error') },
      { token: 'fcm-token-zweiter-versuch' },
    ];

    const { AppProvider, Verbraucher } = await frischLaden();
    await act(async () => {
      render(<AppProvider><Verbraucher /></AppProvider>);
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });

    // Erster Versuch ist durch, zweiter steht noch aus (1s Abstand).
    expect(getTokenMock).toHaveBeenCalledTimes(1);
    expect(registrierungen()).toHaveLength(0);

    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

    expect(getTokenMock).toHaveBeenCalledTimes(2);
    expect(registrierungen()).toHaveLength(1);
    expect(registrierungen()[0][1]).toMatchObject({
      token: 'fcm-token-zweiter-versuch',
      platform: 'android',
      device_id: 'geraet-1',
    });
  });

  /*
   * Drei Versuche, dann Schluss — und GENAU EINE Diagnose-Meldung mit der
   * Zahl der Versuche. Drei Meldungen fuer einen Vorgang machen das Protokoll
   * unlesbar und den Server-Zaehler falsch.
   */
  it('gibt nach drei Fehlversuchen auf und meldet genau einmal mit der Zahl der Versuche', async () => {
    const fis = new Error('java.io.IOException: FIS_AUTH_ERROR');
    abrufe = [{ fehler: fis }, { fehler: fis }, { fehler: fis }];

    const { AppProvider, Verbraucher } = await frischLaden();
    await act(async () => {
      render(<AppProvider><Verbraucher /></AppProvider>);
    });
    // 1s + 3s Abstaende, plus Luft fuer die Aufloesung der Promises.
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });

    expect(getTokenMock).toHaveBeenCalledTimes(3);
    expect(registrierungen()).toHaveLength(0);

    // GENAU EINE Meldung fuer den fehlgeschlagenen Abruf, nicht drei.
    expect(diagnosen('getToken-fehler')).toHaveLength(1);
    const meldung = diagnosen('getToken-fehler')[0][1] as { hinweis: string };
    expect(meldung.hinweis).toContain('versuche=3');
    expect(meldung.hinweis).toContain('FIS_AUTH_ERROR');
    // 200 Zeichen ist die Grenze des Servers.
    expect(meldung.hinweis.length).toBeLessThanOrEqual(200);
  });

  /*
   * Kein Weiterprobieren nach Erfolg: Der erste Versuch liefert, danach darf
   * getToken nicht noch einmal laufen — auch nicht, wenn die Zeit weiterlaeuft.
   */
  it('bricht nach dem ersten Erfolg ab, statt weiterzuprobieren', async () => {
    abrufe = [{ token: 'fcm-token-sofort' }];

    const { AppProvider, Verbraucher } = await frischLaden();
    await act(async () => {
      render(<AppProvider><Verbraucher /></AppProvider>);
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });

    expect(getTokenMock).toHaveBeenCalledTimes(1);
    expect(deleteTokenMock).not.toHaveBeenCalled();
    expect(registrierungen()).toHaveLength(1);
  });

  /*
   * deleteToken verwirft den lokalen Token. Beim ersten Fehlversuch ist das
   * uebertrieben — bei einem Netzaussetzer ist der Token gueltig und wuerde
   * grundlos weggeworfen. Erst VOR dem letzten Versuch ist es angebracht:
   * dann ist ein verdorbener lokaler Zustand die naechstliegende Erklaerung.
   */
  it('raeumt den lokalen Firebase-Zustand erst vor dem letzten Versuch', async () => {
    const fis = new Error('FIS_AUTH_ERROR');
    abrufe = [{ fehler: fis }, { fehler: fis }, { token: 'fcm-token-nach-aufraeumen' }];

    const { AppProvider, Verbraucher } = await frischLaden();
    await act(async () => {
      render(<AppProvider><Verbraucher /></AppProvider>);
    });

    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(getTokenMock).toHaveBeenCalledTimes(1);
    expect(deleteTokenMock).not.toHaveBeenCalled();

    // Zweiter Versuch nach 1s — noch kein Aufraeumen.
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(getTokenMock).toHaveBeenCalledTimes(2);
    expect(deleteTokenMock).not.toHaveBeenCalled();

    // Dritter und letzter Versuch nach weiteren 3s — jetzt genau einmal.
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(getTokenMock).toHaveBeenCalledTimes(3);
    expect(deleteTokenMock).toHaveBeenCalledTimes(1);
    expect(registrierungen()).toHaveLength(1);
    expect(registrierungen()[0][1]).toMatchObject({ token: 'fcm-token-nach-aufraeumen' });
  });

  /*
   * Die Wiederholung darf den Anmeldevorgang nicht aufhalten: Die Oberflaeche
   * steht sofort, obwohl der Token-Abruf noch Sekunden lang wiederholt wird.
   */
  it('haelt die Anmeldung nicht auf, waehrend im Hintergrund wiederholt wird', async () => {
    const fis = new Error('FIS_AUTH_ERROR');
    abrufe = [{ fehler: fis }, { fehler: fis }, { fehler: fis }];

    const { AppProvider, Verbraucher } = await frischLaden();
    let bildschirm: ReturnType<typeof render> | null = null;
    await act(async () => {
      bildschirm = render(<AppProvider><Verbraucher /></AppProvider>);
    });

    // Nutzer:in ist gesetzt, Oberflaeche steht — ohne dass die Zeit fuer die
    // Wiederholungen vorgeschoben wurde. Waere die Wiederholung in den
    // Anmeldeweg eingehaengt, muesste hier auf sie gewartet werden.
    expect(bildschirm!.getByTestId('fertig').textContent).toBe('Testperson');

    // Erster Versuch ist angelaufen, die Oberflaeche stand aber schon vorher.
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(getTokenMock).toHaveBeenCalledTimes(1);

    // Und die Wiederholung laeuft danach nebenher weiter.
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(getTokenMock).toHaveBeenCalledTimes(3);
  });
});
