import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { enthaeltText, konsoleMitschneiden } from '../protokollDurchsuchen';

// ---------------------------------------------------------------------------
// Passwort und Token im Konsolenprotokoll (Audit Grundgeruest BF-08,
// Sammelbefund S-23).
//
// services/auth.ts schrieb bei einer fehlgeschlagenen Anmeldung
// `fullError: error` ins Protokoll. Der axios-Fehler traegt die gesendete
// Anfrage mit: `config.data` ist der Koerper '{"username":…,"password":…}'
// im Klartext, `config.headers.Authorization` das Zugangs-Token. Auf den
// Geraeten landet das im Protokoll der WebView (Safari-Webinspektor, logcat,
// Fehlerberichte) -- dort hat ein Passwort nichts zu suchen.
//
// Dasselbe Muster stand beim Abmelden (POST /auth/logout mit dem
// Refresh-Token im Koerper) und bei der Anmeldung per Biometrie (POST
// /auth/refresh mit dem Refresh-Token).
//
// Die Fehler hier sind ECHTE AxiosError-Objekte in der Form, die axios
// liefert -- mit config, request und response. Geprueft wird jedes Feld jedes
// Konsolenaufrufs, auch die nicht aufzaehlbaren (siehe protokollDurchsuchen).
// ---------------------------------------------------------------------------

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' },
}));
vi.mock('@capacitor/device', () => ({
  Device: { getId: vi.fn(async () => ({ identifier: 'geraet-1' })) },
}));

const mockApiPost = vi.fn();
const mockApiDelete = vi.fn();
vi.mock('../../services/api', () => ({
  default: {
    post: (...a: unknown[]) => mockApiPost(...a),
    delete: (...a: unknown[]) => mockApiDelete(...a),
    get: vi.fn(),
  },
  API_URL: 'https://test.example/api',
}));

// mitBiometrieAnmelden tauscht den Token bewusst am Interceptor vorbei ueber
// axios direkt. AxiosError und AxiosHeaders bleiben echt.
const mockAxiosPost = vi.fn();
vi.mock('axios', async (importOriginal) => {
  const echt = await importOriginal<typeof import('axios')>();
  return { ...echt, default: { post: (...a: unknown[]) => mockAxiosPost(...a) } };
});

const REFRESH_TOKEN = 'refresh-geheim-8f2a41';
const ZUGANGS_TOKEN = 'zugang-geheim-c93d07';
vi.mock('../../services/tokenStore', () => ({
  setToken: vi.fn(async () => undefined),
  setUser: vi.fn(async () => undefined),
  setRefreshToken: vi.fn(async () => undefined),
  getRefreshToken: vi.fn(() => REFRESH_TOKEN),
  clearAuth: vi.fn(async () => undefined),
  getDeviceId: vi.fn(() => 'geraet-1'),
  setLoggingOut: vi.fn(),
}));

const mockEntsperren = vi.fn();
vi.mock('../../services/biometrics', () => ({
  mitBiometrieEntsperren: (...a: unknown[]) => mockEntsperren(...a),
  gespeichertenTokenAuffrischen: vi.fn(async () => undefined),
  biometrieVergessen: vi.fn(async () => undefined),
  istBiometrieAktiv: vi.fn(async () => false),
}));

const mockQueueFlush = vi.fn();
vi.mock('../../services/writeQueue', () => ({
  writeQueue: {
    flush: (...a: unknown[]) => mockQueueFlush(...a),
    clear: vi.fn(async () => undefined),
  },
}));
vi.mock('../../services/offlineCache', () => ({ offlineCache: { clearAll: vi.fn(async () => undefined) } }));
vi.mock('../../services/mediaCache', () => ({ clearMediaCache: vi.fn(async () => undefined) }));
vi.mock('../../services/websocket', () => ({ disconnectWebSocket: vi.fn() }));
vi.mock('../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true } }));

import { loginWithAutoDetection, logout, mitBiometrieAnmelden } from '../../services/auth';

const PASSWORT = 'Johannes7,47-geheim';

/**
 * Ein axios-Fehler, wie ihn axios fuer eine gescheiterte Anfrage baut:
 * `config.data` ist der gesendete Koerper als JSON, `config.headers` traegt
 * das Zugangs-Token, sofern eines mitging. Ohne `status` fehlt die Antwort
 * (keine Verbindung).
 */
function axiosFehler(optionen: {
  url: string;
  koerper: Record<string, unknown>;
  mitZugangsToken?: boolean;
  status?: number;
  antwort?: Record<string, unknown>;
}): AxiosError {
  const { url, koerper, mitZugangsToken = false, status, antwort = {} } = optionen;
  const headers = new AxiosHeaders({ 'Content-Type': 'application/json' });
  if (mitZugangsToken) headers.set('Authorization', `Bearer ${ZUGANGS_TOKEN}`);
  const config = { url, method: 'post', data: JSON.stringify(koerper), headers };
  const request = { responseURL: `https://test.example/api${url}` };
  const response = status
    ? { status, statusText: status === 401 ? 'Unauthorized' : 'Error', data: antwort, headers: {}, config, request }
    : undefined;
  return new AxiosError(
    status ? `Request failed with status code ${status}` : 'Network Error',
    status ? (status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST') : 'ERR_NETWORK',
    config as never,
    request,
    response as never
  );
}

let konsole: ReturnType<typeof konsoleMitschneiden>;

beforeEach(() => {
  vi.clearAllMocks();
  mockApiPost.mockResolvedValue({ data: {} });
  mockApiDelete.mockResolvedValue({ data: {} });
  mockQueueFlush.mockResolvedValue({ succeeded: [], failed: [] });
  konsole = konsoleMitschneiden();
});

afterEach(() => {
  konsole.beenden();
});

describe('Anmeldung schlägt fehl — das Passwort bleibt aus dem Protokoll', () => {
  it('falsches Passwort: kein Konsolenaufruf enthält das Passwort, Status und Servertext schon', async () => {
    const fehler = axiosFehler({
      url: '/auth/login',
      koerper: { username: 'konfi1', password: PASSWORT },
      status: 401,
      antwort: { error: 'Ungültige Anmeldedaten' },
    });
    // Voraussetzung des Tests: der Fehler traegt das Passwort wirklich.
    expect(enthaeltText(fehler, PASSWORT)).toBe(true);
    mockApiPost.mockRejectedValueOnce(fehler);

    await expect(loginWithAutoDetection('konfi1', PASSWORT)).rejects.toThrow('Ungültige Anmeldedaten');

    expect(konsole.enthaelt(PASSWORT)).toBe(false);
    // Erlaubt und gewollt: woran es lag, bleibt im Protokoll lesbar.
    expect(konsole.aufrufe()).toContainEqual([
      'Login fehlgeschlagen:',
      expect.objectContaining({ status: 401, code: 'ERR_BAD_REQUEST', fehler: 'Ungültige Anmeldedaten' }),
    ]);
  });

  it('keine Verbindung: kein Konsolenaufruf enthält das Passwort', async () => {
    mockApiPost.mockRejectedValueOnce(
      axiosFehler({ url: '/auth/login', koerper: { username: 'konfi1', password: PASSWORT } })
    );

    await expect(loginWithAutoDetection('konfi1', PASSWORT)).rejects.toThrow('Network Error');

    expect(konsole.enthaelt(PASSWORT)).toBe(false);
    expect(konsole.aufrufe()).toContainEqual([
      'Login fehlgeschlagen:',
      expect.objectContaining({ code: 'ERR_NETWORK', meldung: 'Network Error' }),
    ]);
  });

  it('der weitergereichte Fehler trägt das Passwort nicht, wohl aber Status, Antwort und Code', async () => {
    mockApiPost.mockRejectedValueOnce(
      axiosFehler({
        url: '/auth/login',
        koerper: { username: 'konfi1', password: PASSWORT },
        status: 403,
        antwort: { error: 'Zugang gesperrt', error_code: 'user_inactive' },
      })
    );

    const fehler = await loginWithAutoDetection('konfi1', PASSWORT).catch((e: unknown) => e);

    // Die Anmeldeseite braucht Status, Antwort und Code, um die richtige
    // Meldung zu zeigen (anmeldefehlerSichtbar.test.tsx) -- die gesendete
    // Anfrage braucht sie nicht.
    expect(enthaeltText(fehler, PASSWORT)).toBe(false);
    expect(fehler).toMatchObject({
      response: { status: 403, data: { error: 'Zugang gesperrt', error_code: 'user_inactive' } },
      code: 'ERR_BAD_REQUEST',
    });
  });
});

describe('Abmelden und Biometrie — Token bleiben aus dem Protokoll', () => {
  it('Abmelden: scheitern Queue, Push-Abmeldung und Token-Widerruf, steht kein Token im Protokoll', async () => {
    mockQueueFlush.mockRejectedValueOnce(
      axiosFehler({ url: '/chat/rooms/3/messages', koerper: { content: 'Hallo' }, mitZugangsToken: true, status: 502 })
    );
    mockApiDelete.mockRejectedValueOnce(
      axiosFehler({ url: '/notifications/device-token', koerper: { device_id: 'geraet-1' }, mitZugangsToken: true, status: 500 })
    );
    mockApiPost.mockRejectedValueOnce(
      axiosFehler({
        url: '/auth/logout',
        koerper: { refresh_token: REFRESH_TOKEN, device_id: 'geraet-1', platform: 'web' },
        mitZugangsToken: true,
        status: 500,
      })
    );

    await logout();

    expect(mockApiPost).toHaveBeenCalledWith('/auth/logout', expect.objectContaining({ refresh_token: REFRESH_TOKEN }));
    expect(konsole.enthaelt(REFRESH_TOKEN)).toBe(false);
    expect(konsole.enthaelt(ZUGANGS_TOKEN)).toBe(false);
    // Erlaubt: dass und wie der Widerruf scheiterte.
    expect(konsole.aufrufe()).toContainEqual([
      'Serverseitiges Token-Revoke fehlgeschlagen (wird lokal geloescht):',
      expect.objectContaining({ status: 500, code: 'ERR_BAD_RESPONSE' }),
    ]);
  });

  it('Biometrie: scheitert der Tausch beim Server, steht der gespeicherte Token nicht im Protokoll', async () => {
    mockEntsperren.mockResolvedValueOnce({
      status: 'ok',
      refreshToken: REFRESH_TOKEN,
      user: { id: 42, type: 'konfi', display_name: 'Emilia' },
      gespeichertAm: Date.now(),
    });
    mockAxiosPost.mockRejectedValueOnce(
      axiosFehler({ url: '/auth/refresh', koerper: { refresh_token: REFRESH_TOKEN }, status: 500 })
    );

    const ergebnis = await mitBiometrieAnmelden();

    expect(ergebnis).toEqual({ status: 'fehler' });
    expect(konsole.enthaelt(REFRESH_TOKEN)).toBe(false);
    expect(konsole.aufrufe()).toContainEqual([
      'Anmeldung per Biometrie fehlgeschlagen:',
      expect.objectContaining({ status: 500 }),
    ]);
  });
});
