// Der Refresh hat ein Zeitlimit (Audit Grundgeruest BF-07).
//
// Beide direkten Refresh-Aufrufe -- api.ts performRefresh und auth.ts
// mitBiometrieAnmelden -- liefen ohne Zeitlimit am Interceptor der API-Instanz
// vorbei. Hing der Refresh (WLAN/LTE-Wechsel, tote TCP-Verbindung), stand
// `isRefreshing`, und alle Anfragen warteten mit, bis das Betriebssystem
// aufgab. Das Audit mass nach 5 Minuten Fake-Zeit: alle drei Wartenden
// haengen, `timeout: undefined`.
//
// Jetzt gilt dasselbe Limit wie fuer die Instanz (20 s). Hier: axios.post
// antwortet nie, die Zeit laeuft als Fake-Zeit.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const jwt = (sekunden: number): string => {
  const nutzlast = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + sekunden }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `kopf.${nutzlast}.signatur`;
};

let zugangsToken = '';
vi.mock('../../services/tokenStore', () => ({
  getToken: vi.fn(() => zugangsToken),
  getRefreshToken: vi.fn(() => 'refresh-1'),
  getActiveOrgId: vi.fn(() => null),
  getDeviceId: vi.fn(() => null),
  getUser: vi.fn(() => null),
  setToken: vi.fn(async () => undefined),
  setUser: vi.fn(async () => undefined),
  setRefreshToken: vi.fn(async () => undefined),
  setActiveOrgId: vi.fn(async () => undefined),
  setLoggingOut: vi.fn(),
  clearAuth: vi.fn(async () => undefined),
  isLoggingOut: vi.fn(() => false),
}));
vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: { isOnline: true, subscribe: vi.fn(() => () => undefined) },
}));
const mockVergessen = vi.fn(async () => undefined);
vi.mock('../../services/biometrics', () => ({
  rotationUebernehmen: vi.fn(async () => undefined),
  istBiometrieAktiv: vi.fn(async () => false),
  mitBiometrieEntsperren: vi.fn(async () => ({
    status: 'ok', refreshToken: 'refresh-gesichert', user: { id: 42, type: 'konfi' }, gespeichertAm: Date.now(),
  })),
  gespeichertenTokenAuffrischen: vi.fn(async () => undefined),
  biometrieVergessen: (...a: unknown[]) => mockVergessen(...(a as [])),
}));
vi.mock('../../services/offlineCache', () => ({ offlineCache: { clearAll: vi.fn(async () => undefined) } }));
vi.mock('../../services/mediaCache', () => ({ clearMediaCache: vi.fn(async () => undefined) }));
vi.mock('../../services/writeQueue', () => ({
  writeQueue: { flush: vi.fn(async () => ({ succeeded: [], failed: [] })), clear: vi.fn(async () => undefined) },
}));
vi.mock('../../services/websocket', () => ({ disconnectWebSocket: vi.fn() }));
vi.mock('@capacitor/device', () => ({ Device: { getId: vi.fn(async () => ({ identifier: 'geraet-1' })) } }));

// Jeder Test mit frischen Modulen: Ein haengender Refresh laesst sonst
// `isRefreshing` fuer die folgenden Tests stehen -- genau der Befund.
async function laden() {
  const apiModul = await import('../../services/api');
  const api = apiModul.default;
  api.defaults.adapter = async (config: InternalAxiosRequestConfig) =>
    ({ status: 200, statusText: 'OK', headers: {}, config, data: { ok: true } });
  return {
    api,
    ensureFreshToken: apiModul.ensureFreshToken,
    mitBiometrieAnmelden: (await import('../../services/auth')).mitBiometrieAnmelden,
    tokenStore: await import('../../services/tokenStore'),
  };
}

/** Beobachtet, ob ein Versprechen schon erledigt ist. */
function beobachten<T>(p: Promise<T>) {
  const zustand: { fertig: boolean; wert?: T; fehler?: unknown } = { fertig: false };
  p.then(
    (wert) => { zustand.fertig = true; zustand.wert = wert; },
    (fehler) => { zustand.fertig = true; zustand.fehler = fehler; },
  );
  return zustand;
}

let ereignisse: string[] = [];
const merkeEreignis = (e: Event) => { ereignisse.push(e.type); };

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.useFakeTimers();
  zugangsToken = jwt(-60);
  ereignisse = [];
  window.addEventListener('auth:relogin-required', merkeEreignis);
  // Der Server antwortet NIE.
  vi.spyOn(axios, 'post').mockImplementation(() => new Promise(() => undefined));
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  window.removeEventListener('auth:relogin-required', merkeEreignis);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('performRefresh: Zeitlimit 20 s', () => {
  it('der Refresh geht mit timeout 20000 und Abbruchsignal hinaus', async () => {
    const { ensureFreshToken } = await laden();
    const p = beobachten(ensureFreshToken());
    await vi.advanceTimersByTimeAsync(0);

    expect(axios.post).toHaveBeenCalledTimes(1);
    const config = vi.mocked(axios.post).mock.calls[0][2] as { timeout?: number; signal?: AbortSignal };
    expect(config.timeout).toBe(20000);
    expect(config.signal).toBeInstanceOf(AbortSignal);

    await vi.advanceTimersByTimeAsync(20000);
    expect(p.fertig).toBe(true);
    // Das Signal ist nach Ablauf gezogen -- die Leitung wird aufgegeben.
    expect(config.signal?.aborted).toBe(true);
  });

  it('haengt der Refresh, sind alle Wartenden nach 20 s frei -- nicht erst nach Minuten', async () => {
    const { api, ensureFreshToken } = await laden();
    const alt = zugangsToken;
    const p1 = beobachten(ensureFreshToken());
    const p2 = beobachten(ensureFreshToken());
    const p3 = beobachten(api.get('/y'));

    await vi.advanceTimersByTimeAsync(19999);
    expect([p1.fertig, p2.fertig, p3.fertig]).toEqual([false, false, false]);

    await vi.advanceTimersByTimeAsync(1);
    // Bestehender Fehlerweg von ensureFreshToken: der alte Token kommt
    // zurueck, die Anfrage geht damit hinaus (das 401 regelt der Interceptor).
    expect(p1).toMatchObject({ fertig: true, wert: alt });
    expect(p2).toMatchObject({ fertig: true, wert: alt });
    await vi.advanceTimersByTimeAsync(0);
    expect(p3.fertig).toBe(true);
    expect((p3.wert as { data: unknown }).data).toEqual({ ok: true });
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it('ein hängender Refresh im 401-Pfad beendet die Sitzung NICHT -- die Anfrage scheitert als Zeitlimit', async () => {
    const { api, tokenStore } = await laden();
    zugangsToken = jwt(3600);
    api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      throw new AxiosError('Request failed with status code 401', AxiosError.ERR_BAD_REQUEST, config, {},
        { status: 401, statusText: 'Unauthorized', headers: {}, config, data: {} });
    };

    const p = beobachten(api.get('/x'));
    await vi.advanceTimersByTimeAsync(20000);

    expect(p.fertig).toBe(true);
    expect((p.fehler as { code?: string }).code).toBe('ECONNABORTED');
    // Vorher lief jeder gescheiterte Refresh hier in clearAuth und "Sitzung
    // abgelaufen". Mit Zeitlimit hiesse das: ein Netzwechsel meldet nach
    // 20 s ab, statt die App kurz haengen zu lassen. Ohne Antwort des Servers
    // bleibt die Sitzung deshalb -- wie im Offline-Zweig.
    expect(tokenStore.clearAuth).not.toHaveBeenCalled();
    expect(ereignisse).toEqual([]);
  });

  it('erlaubt, unveraendert: lehnt der Server den Refresh ab (401), endet die Sitzung', async () => {
    const { api, tokenStore } = await laden();
    zugangsToken = jwt(3600);
    api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      throw new AxiosError('Request failed with status code 401', AxiosError.ERR_BAD_REQUEST, config, {},
        { status: 401, statusText: 'Unauthorized', headers: {}, config, data: {} });
    };
    vi.mocked(axios.post).mockImplementation(async (url: string) => {
      const config = { url, headers: {} } as InternalAxiosRequestConfig;
      throw new AxiosError('Request failed with status code 401', AxiosError.ERR_BAD_REQUEST, config, {},
        { status: 401, statusText: 'Unauthorized', headers: {}, config, data: { error: 'Ungültiger oder abgelaufener Refresh-Token' } });
    });

    const p = beobachten(api.get('/x'));
    await vi.advanceTimersByTimeAsync(0);

    expect(p.fertig).toBe(true);
    expect(tokenStore.clearAuth).toHaveBeenCalledTimes(1);
    expect(ereignisse).toEqual(['auth:relogin-required']);
  });
});

describe('mitBiometrieAnmelden: Zeitlimit 20 s', () => {
  it('haengt der Tausch beim Server, endet die Anmeldung nach 20 s auf dem Fehlerweg -- die Sitzung bleibt gesichert', async () => {
    const { mitBiometrieAnmelden } = await laden();
    const p = beobachten(mitBiometrieAnmelden());
    await vi.advanceTimersByTimeAsync(0);
    expect(axios.post).toHaveBeenCalledTimes(1);
    const config = vi.mocked(axios.post).mock.calls[0][2] as { timeout?: number };
    expect(config.timeout).toBe(20000);

    await vi.advanceTimersByTimeAsync(19999);
    expect(p.fertig).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    expect(p).toMatchObject({ fertig: true, wert: { status: 'fehler' } });
    // Kein 401 -> die gesicherte Sitzung wird nicht verworfen.
    expect(mockVergessen).not.toHaveBeenCalled();
  });
});
