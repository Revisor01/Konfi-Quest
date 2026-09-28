// Keine Schleife "401 -> Refresh gelingt -> 401 -> ..." (Audit Grundgeruest
// BF-09).
//
// Nach einem erfolgreichen Refresh schickte der 401-Interceptor die
// urspruengliche Anfrage ohne Kennzeichnung erneut los. Antwortet die Route
// weiter 401 (eine Route mit eigener Token-Pruefung, ein Unterschied in der
// Pruefreihenfolge), drehte der Client im Kreis und rotierte dabei in jeder
// Runde den Refresh-Token -- eine Datenbankzeile und ein Widerruf pro Runde.
// Das Audit mass mit eingebauter Notbremse 8 Versuche und 7 Refreshs.
//
// Jetzt traegt die wiederholte Anfrage den Merker `_retry`; ein zweites 401
// wird durchgereicht. Gemessen mit der ECHTEN api-Instanz: Der Adapter zaehlt
// die Versuche, axios.post (der Refresh laeuft bewusst am Interceptor vorbei)
// zaehlt die Refreshs.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const gueltig = (() => {
  const nutzlast = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `kopf.${nutzlast}.signatur`;
})();

vi.mock('../../services/tokenStore', () => ({
  getToken: vi.fn(() => gueltig),
  getRefreshToken: vi.fn(() => 'refresh-1'),
  getActiveOrgId: vi.fn(() => null),
  getDeviceId: vi.fn(() => null),
  setToken: vi.fn(async () => undefined),
  setRefreshToken: vi.fn(async () => undefined),
  setActiveOrgId: vi.fn(async () => undefined),
  clearAuth: vi.fn(async () => undefined),
  isLoggingOut: vi.fn(() => false),
}));
vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: { isOnline: true },
}));
vi.mock('../../services/biometrics', () => ({
  rotationUebernehmen: vi.fn(async () => undefined),
  istBiometrieAktiv: vi.fn(async () => false),
}));

import api from '../../services/api';
import * as tokenStore from '../../services/tokenStore';

// Notbremse NUR fuer den Test: Ohne Sperre liefe die Schleife endlos. Nach so
// vielen Versuchen antwortet der Adapter 200, damit der Fall vor dem Fix
// ueberhaupt endet und sich zaehlen laesst.
const NOTBREMSE = 8;

let versuche: Record<string, number> = {};
let refreshs = 0;
let ereignisse: string[] = [];
const merkeEreignis = (e: Event) => { ereignisse.push(e.type); };

/** Jede Anfrage bekommt 401 -- bis zur Notbremse. */
function immer401() {
  api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const url = config.url || '';
    versuche[url] = (versuche[url] || 0) + 1;
    if (versuche[url] >= NOTBREMSE) {
      return { status: 200, statusText: 'OK', headers: {}, config, data: { notbremse: true } };
    }
    throw new AxiosError(
      'Request failed with status code 401',
      AxiosError.ERR_BAD_REQUEST,
      config,
      {},
      { status: 401, statusText: 'Unauthorized', headers: {}, config, data: { error: 'Nicht erlaubt' } }
    );
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  versuche = {};
  refreshs = 0;
  ereignisse = [];
  window.addEventListener('auth:relogin-required', merkeEreignis);
  // Der Refresh gelingt immer -- jedes Mal ein neues Paar.
  vi.spyOn(axios, 'post').mockImplementation(async () => {
    refreshs += 1;
    return { data: { token: gueltig, refresh_token: `refresh-${refreshs + 1}` } };
  });
  immer401();
});

afterEach(() => {
  window.removeEventListener('auth:relogin-required', merkeEreignis);
  vi.restoreAllMocks();
});

describe('401 nach erfolgreichem Refresh', () => {
  it('verboten: keine Schleife -- genau 2 Versuche und 1 Refresh, dann kommt das 401 beim Aufrufer an', async () => {
    const fehler = await api.get('/x').catch((e: unknown) => e as AxiosError);

    expect(versuche['/x']).toBe(2);
    expect(refreshs).toBe(1);
    expect((fehler as AxiosError).response?.status).toBe(401);
  });

  it('das durchgereichte 401 beendet die Sitzung nicht -- sie wurde gerade erneuert', async () => {
    await api.get('/x').catch(() => undefined);

    expect(tokenStore.clearAuth).not.toHaveBeenCalled();
    expect(ereignisse).toEqual([]);
  });

  it('verboten: auch wartende Anfragen werden nach dem Refresh nur einmal wiederholt', async () => {
    // /a loest den Refresh aus; /b kommt, waehrend er laeuft, und wartet.
    let refreshFreigeben: () => void = () => undefined;
    vi.mocked(axios.post).mockImplementationOnce(async () => {
      refreshs += 1;
      await new Promise<void>((r) => { refreshFreigeben = r; });
      return { data: { token: gueltig, refresh_token: 'refresh-2' } };
    });

    const a = api.get('/a').catch((e: unknown) => e as AxiosError);
    await vi.waitFor(() => expect(refreshs).toBe(1));
    const b = api.get('/b').catch((e: unknown) => e as AxiosError);
    await vi.waitFor(() => expect(versuche['/b']).toBe(1));
    refreshFreigeben();

    const [fa, fb] = await Promise.all([a, b]);
    expect(versuche['/a']).toBe(2);
    expect(versuche['/b']).toBe(2);
    expect(refreshs).toBe(1);
    expect((fa as AxiosError).response?.status).toBe(401);
    expect((fb as AxiosError).response?.status).toBe(401);
  });

  it('erlaubt: ist das 401 nach dem Refresh weg, kommt die Antwort der Wiederholung an', async () => {
    let erster = true;
    api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      versuche[config.url || ''] = (versuche[config.url || ''] || 0) + 1;
      if (erster) {
        erster = false;
        throw new AxiosError('Request failed with status code 401', AxiosError.ERR_BAD_REQUEST, config, {},
          { status: 401, statusText: 'Unauthorized', headers: {}, config, data: {} });
      }
      // Die Wiederholung traegt das neue Zugangs-Token.
      expect(config.headers.Authorization).toBe(`Bearer ${gueltig}`);
      return { status: 200, statusText: 'OK', headers: {}, config, data: { ok: true } };
    };

    const antwort = await api.get('/x');

    expect(antwort.data).toEqual({ ok: true });
    expect(versuche['/x']).toBe(2);
    expect(refreshs).toBe(1);
  });

  it('erlaubt: eine NEUE Anfrage nach dem durchgereichten 401 darf wieder refreshen', async () => {
    await api.get('/x').catch(() => undefined);
    await api.get('/y').catch(() => undefined);

    // Der Merker haengt an der einen Anfrage, nicht am Modul.
    expect(versuche['/y']).toBe(2);
    expect(refreshs).toBe(2);
  });
});
