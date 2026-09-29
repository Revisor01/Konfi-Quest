// Gesperrte Gemeinde, abgelaufene Testphase oder deaktiviertes Konto
// erscheinen nicht mehr als "Sitzung abgelaufen" (Audit 26.09.2026,
// Grundgeruest BF-11).
//
// Der Refresh unterscheidet 401 (Token ungueltig) von 403 mit error_code
// ('user_inactive', 'org_inactive', 'org_trial_expired'). Der Client warf
// beides auf denselben Weg: clearAuth, 'auth:relogin-required', und die
// Anmeldeseite sagte "Deine Sitzung ist abgelaufen". Erst der naechste
// Passwort-Versuch nannte den echten Grund.
//
// Jetzt traegt das Ereignis bei einer Sperre die Meldung des Servers; App.tsx
// legt sie ueber anmeldeHinweisMerken ab, die Anmeldeseite holt sie mit
// anmeldeHinweisAbholen. Gemessen mit der ECHTEN api-Instanz: Der Adapter
// antwortet 401, axios.post (der Refresh) antwortet je Fall.

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
import { anmeldeHinweisMerken, anmeldeHinweisAbholen, sperrMeldungAus } from '../../utils/anmeldeHinweis';

const TESTPHASE = 'Die Testphase dieser Gemeinde ist abgelaufen. Bitte wende dich an die Leitung deiner Gemeinde, um einen Tarif zu buchen.';

let ereignisse: CustomEvent[] = [];
const merke = (e: Event) => { ereignisse.push(e as CustomEvent); };

function refreshAntwortet(status: number, data: Record<string, unknown>) {
  vi.spyOn(axios, 'post').mockImplementation(async (url: string) => {
    throw new AxiosError(
      `Request failed with status code ${status}`,
      AxiosError.ERR_BAD_REQUEST,
      { url, headers: {} } as InternalAxiosRequestConfig,
      {},
      { status, statusText: '', headers: {}, config: { url, headers: {} } as InternalAxiosRequestConfig, data }
    );
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  ereignisse = [];
  sessionStorage.clear();
  window.addEventListener('auth:relogin-required', merke);
  // Jede Anfrage bekommt 401 -> der Interceptor refresht.
  api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    throw new AxiosError('401', AxiosError.ERR_BAD_REQUEST, config, {},
      { status: 401, statusText: 'Unauthorized', headers: {}, config, data: { error: 'Organization is inactive' } });
  };
});

afterEach(() => {
  window.removeEventListener('auth:relogin-required', merke);
  vi.restoreAllMocks();
});

describe('Refresh abgelehnt: Grund an die Anmeldeseite', () => {
  it('403 mit Sperr-Code: das Ereignis traegt die Meldung des Servers', async () => {
    refreshAntwortet(403, { error: TESTPHASE, error_code: 'org_trial_expired' });

    await api.get('/konfi/dashboard').catch(() => undefined);

    expect(tokenStore.clearAuth).toHaveBeenCalledTimes(1);
    expect(ereignisse).toHaveLength(1);
    expect(ereignisse[0].detail).toEqual({ sperrMeldung: TESTPHASE });
  });

  it('401 (Token ungueltig): das Ereignis traegt keine Sperr-Meldung', async () => {
    refreshAntwortet(401, { error: 'Ungültiger oder abgelaufener Refresh-Token' });

    await api.get('/konfi/dashboard').catch(() => undefined);

    expect(tokenStore.clearAuth).toHaveBeenCalledTimes(1);
    expect(ereignisse).toHaveLength(1);
    expect(ereignisse[0].detail).toEqual({ sperrMeldung: null });
  });
});

describe('sperrMeldungAus', () => {
  const antwort = (status: number, data: unknown) => ({ response: { status, data } });

  it('nimmt den Text des Servers fuer die drei Sperr-Codes', () => {
    expect(sperrMeldungAus(antwort(403, { error: 'A', error_code: 'user_inactive' }))).toBe('A');
    expect(sperrMeldungAus(antwort(403, { error: 'B', error_code: 'org_inactive' }))).toBe('B');
    expect(sperrMeldungAus(antwort(403, { error: 'C', error_code: 'org_trial_expired' }))).toBe('C');
  });

  it('ohne Text des Servers: eigener Ersatztext', () => {
    expect(sperrMeldungAus(antwort(403, { error_code: 'org_inactive' })))
      .toBe('Zugang gesperrt. Bitte wende dich an deine Gemeinde.');
  });

  it('alles andere ist keine Sperre', () => {
    expect(sperrMeldungAus(antwort(401, { error: 'x', error_code: 'user_inactive' }))).toBeNull();
    expect(sperrMeldungAus(antwort(403, { error: 'Kein Zugriff auf diese Organisation' }))).toBeNull();
    expect(sperrMeldungAus(antwort(403, { error: 'x', error_code: 'etwas_anderes' }))).toBeNull();
    expect(sperrMeldungAus(new Error('Netz weg'))).toBeNull();
    expect(sperrMeldungAus(null)).toBeNull();
  });
});

describe('anmeldeHinweisMerken / anmeldeHinweisAbholen', () => {
  it('eine Sperre ersetzt "Sitzung abgelaufen" und gilt genau einmal', () => {
    anmeldeHinweisMerken(TESTPHASE);
    expect(anmeldeHinweisAbholen()).toBe(TESTPHASE);
    expect(anmeldeHinweisAbholen()).toBeNull();
  });

  it('ohne Sperre bleibt es bei "Sitzung abgelaufen" (Schluessel wie bisher)', () => {
    anmeldeHinweisMerken(null);
    expect(sessionStorage.getItem('session_expired')).toBe('1');
    expect(anmeldeHinweisAbholen()).toBe('Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.');
    expect(anmeldeHinweisAbholen()).toBeNull();
  });

  it('eine spaetere Sperre gewinnt ueber einen liegengebliebenen Ablauf-Hinweis', () => {
    anmeldeHinweisMerken(null);
    anmeldeHinweisMerken(TESTPHASE);
    expect(anmeldeHinweisAbholen()).toBe(TESTPHASE);
    expect(sessionStorage.getItem('session_expired')).toBeNull();
  });
});
