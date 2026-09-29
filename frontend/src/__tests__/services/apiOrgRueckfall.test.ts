import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AxiosInstance, AxiosInterceptorManager, AxiosResponse } from 'axios';
import { konsoleMitschneiden } from '../protokollDurchsuchen';

// 403-Rueckfall auf die Stamm-Gemeinde (Audit 26.09.2026, Grundgeruest BF-05, HOCH)
//
// Wird jemandem die Mitgliedschaft in der Zweit-Gemeinde entzogen, waehrend
// er dort arbeitet, antwortet der Server 403 "Kein Zugriff auf diese
// Organisation". api.ts setzte daraufhin nur die aktive Gemeinde auf null
// (kein X-Active-Organization-Header mehr) und feuerte 'auth:org-fallback'.
// Das Access-Token trug aber weiter den Claim active_organization_id der
// entzogenen Gemeinde, und rbac.js greift OHNE Header genau auf diesen Claim
// zurueck -> wieder 403, bei JEDEM Request, bis das Token ablaeuft (bis zu
// 15 Minuten). Da getActiveOrgId() jetzt null war, griff der Rueckfall-Zweig
// nicht mehr: leere Listen und Fehler-Toasts in jeder Gemeinde.
//
// Der Weg zu einem Token OHNE Claim ist POST /auth/refresh ohne
// X-Active-Organization-Header (auth.js: activeOrgClaim bleibt null).
// switch-org auf die Stamm-Gemeinde ginge nicht: es verlangt eine Zeile in
// user_organizations, die es fuer die Stamm-Gemeinde meist nicht gibt.

interface InterceptorHandler<T> {
  fulfilled?: (value: T) => T | Promise<T>;
  rejected?: (error: unknown) => unknown;
}
type ManagerMitHandlers<T> = Omit<AxiosInterceptorManager<T>, 'handlers'> & { handlers: (InterceptorHandler<T> | null)[] };

const responseHandler = (api: AxiosInstance) =>
  (api.interceptors.response as ManagerMitHandlers<AxiosResponse>).handlers
    .find((h): h is InterceptorHandler<AxiosResponse> => Boolean(h && h.rejected));

// Aktive Gemeinde als Zustand: setActiveOrgId(null) muss im selben Lauf
// dazu fuehren, dass der Refresh OHNE Org-Header hinausgeht.
let mockAktiveOrg: number | null = 2;

vi.mock('../../services/tokenStore', () => ({
  getToken: vi.fn(() => 'token-mit-claim'),
  getRefreshToken: vi.fn(() => 'refresh-1'),
  getActiveOrgId: vi.fn(() => mockAktiveOrg),
  setToken: vi.fn(async () => undefined),
  setRefreshToken: vi.fn(async () => undefined),
  setActiveOrgId: vi.fn(async (id: number | null) => { mockAktiveOrg = id; }),
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

vi.mock('axios-retry', () => ({
  default: vi.fn(),
  __esModule: true,
}));

const ORG_403 = {
  config: { url: '/konfis', headers: {} },
  response: { status: 403, data: { error: 'Kein Zugriff auf diese Organisation' } },
};

describe('api — 403-Rueckfall auf die Stamm-Gemeinde', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.resetModules();
    mockAktiveOrg = 2;
  });

  it('beschafft ein Token OHNE Org-Claim: Refresh ohne X-Active-Organization, dann erst das Event', async () => {
    const axios = (await import('axios')).default;
    const tokenStore = await import('../../services/tokenStore');
    const postSpy = vi.spyOn(axios, 'post').mockResolvedValue({
      data: { token: 'token-ohne-claim', refresh_token: 'refresh-2' },
    });
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    const { default: api } = await import('../../services/api');
    const rejected = responseHandler(api)!.rejected!;

    await expect(rejected(ORG_403)).rejects.toBe(ORG_403);

    // 1. Aktive Gemeinde weg.
    expect(tokenStore.setActiveOrgId).toHaveBeenCalledWith(null);

    // 2. GENAU EIN Refresh, ohne Org-Header -- nur so kommt ein Token ohne
    //    active_organization_id zurueck.
    expect(postSpy).toHaveBeenCalledTimes(1);
    const [url, body, config] = postSpy.mock.calls[0];
    expect(String(url)).toMatch(/\/auth\/refresh$/);
    expect(body).toEqual({ refresh_token: 'refresh-1' });
    const headers = (config as { headers?: Record<string, string> } | undefined)?.headers;
    expect(headers?.['X-Active-Organization']).toBeUndefined();

    // 3. Das neue Paar ist gespeichert ...
    expect(tokenStore.setRefreshToken).toHaveBeenCalledWith('refresh-2', { klartext: true });
    expect(tokenStore.setToken).toHaveBeenCalledWith('token-ohne-claim');

    // 4. ... BEVOR der AppContext remountet und den Socket neu aufbaut. Sonst
    //    liefe der Neuaufbau noch mit dem alten Token.
    const ereignisse = dispatchSpy.mock.calls.map(c => (c[0] as Event).type);
    expect(ereignisse).toContain('auth:org-fallback');
    const eventReihe = dispatchSpy.mock.invocationCallOrder[ereignisse.indexOf('auth:org-fallback')];
    const setTokenReihe = vi.mocked(tokenStore.setToken).mock.invocationCallOrder[0];
    expect(setTokenReihe).toBeLessThan(eventReihe);
  });

  it('schlaegt der Refresh fehl, bleibt die Sitzung -- Rueckfall-Event kommt trotzdem, kein Relogin', async () => {
    const axios = (await import('axios')).default;
    const tokenStore = await import('../../services/tokenStore');
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('Network Error'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    const { default: api } = await import('../../services/api');
    const rejected = responseHandler(api)!.rejected!;

    await expect(rejected(ORG_403)).rejects.toBe(ORG_403);

    const ereignisse = dispatchSpy.mock.calls.map(c => (c[0] as Event).type);
    expect(ereignisse).toContain('auth:org-fallback');
    expect(ereignisse).not.toContain('auth:relogin-required');
    expect(tokenStore.clearAuth).not.toHaveBeenCalled();
  });

  // Audit Grundgeruest BF-08: Der Fehler des Refresh traegt die gesendete
  // Anfrage mit -- `config.data` ist '{"refresh_token":"…"}'. Ins Protokoll
  // gehoeren Status und Code, nicht der Token.
  it('scheitert der Refresh, steht der Refresh-Token nicht im Protokoll', async () => {
    const axiosModul = await import('axios');
    const config = { url: '/auth/refresh', method: 'post', data: JSON.stringify({ refresh_token: 'refresh-1' }), headers: {} };
    const fehler = new axiosModul.AxiosError(
      'Request failed with status code 500', 'ERR_BAD_RESPONSE', config as never, {},
      { status: 500, statusText: 'Error', data: {}, headers: {}, config } as never
    );
    vi.spyOn(axiosModul.default, 'post').mockRejectedValue(fehler);
    const konsole = konsoleMitschneiden();

    const { default: api } = await import('../../services/api');
    const rejected = responseHandler(api)!.rejected!;
    await expect(rejected(ORG_403)).rejects.toBe(ORG_403);

    expect(konsole.enthaelt('refresh-1')).toBe(false);
    expect(konsole.aufrufe()).toContainEqual([
      'Token ohne Gemeinde-Claim konnte nicht beschafft werden:',
      expect.objectContaining({ status: 500, code: 'ERR_BAD_RESPONSE' }),
    ]);
    konsole.beenden();
  });

  it('ein anderes 403 loest keinen Rueckfall und keinen Refresh aus', async () => {
    const axios = (await import('axios')).default;
    const tokenStore = await import('../../services/tokenStore');
    const postSpy = vi.spyOn(axios, 'post');
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    const { default: api } = await import('../../services/api');
    const rejected = responseHandler(api)!.rejected!;
    const fehler = {
      config: { url: '/users', headers: {} },
      response: { status: 403, data: { error: 'Keine Berechtigung' } },
    };

    await expect(rejected(fehler)).rejects.toBe(fehler);

    expect(tokenStore.setActiveOrgId).not.toHaveBeenCalled();
    expect(postSpy).not.toHaveBeenCalled();
    expect(dispatchSpy.mock.calls.map(c => (c[0] as Event).type)).not.toContain('auth:org-fallback');
  });

  // Seit dem 29.09.2026 traegt die Ablehnung error_code 'org_kein_zugriff'
  // (middleware/rbac.js, ORG_KEIN_ZUGRIFF). Die App erkennt sie daran -- auch
  // mit anderem Text. Nur so kann der Server spaeter „Kein Zugriff auf diese
  // Gemeinde" sagen, ohne diese App zu brechen.
  it('erkennt die Ablehnung an error_code, auch wenn der Text „Gemeinde" sagt', async () => {
    const axios = (await import('axios')).default;
    const tokenStore = await import('../../services/tokenStore');
    const postSpy = vi.spyOn(axios, 'post').mockResolvedValue({
      data: { token: 'token-ohne-claim', refresh_token: 'refresh-2' },
    });
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    const { default: api } = await import('../../services/api');
    const rejected = responseHandler(api)!.rejected!;
    const fehler = {
      config: { url: '/konfis', headers: {} },
      response: { status: 403, data: { error: 'Kein Zugriff auf diese Gemeinde', error_code: 'org_kein_zugriff' } },
    };

    await expect(rejected(fehler)).rejects.toBe(fehler);

    expect(tokenStore.setActiveOrgId).toHaveBeenCalledWith(null);
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(dispatchSpy.mock.calls.map(c => (c[0] as Event).type)).toContain('auth:org-fallback');
  });

  it('ein 403 mit anderem error_code loest keinen Rueckfall aus', async () => {
    const axios = (await import('axios')).default;
    const tokenStore = await import('../../services/tokenStore');
    const postSpy = vi.spyOn(axios, 'post');

    const { default: api } = await import('../../services/api');
    const rejected = responseHandler(api)!.rejected!;
    const fehler = {
      config: { url: '/events/7', headers: {} },
      response: { status: 403, data: { error: 'Kein Zugriff auf dieses Event', error_code: 'jahrgang_nicht_zugewiesen' } },
    };

    await expect(rejected(fehler)).rejects.toBe(fehler);
    expect(tokenStore.setActiveOrgId).not.toHaveBeenCalled();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('ohne aktive Zweit-Gemeinde greift der Rueckfall nicht (Stamm-Gemeinde kennt kein Zurueck)', async () => {
    mockAktiveOrg = null;
    const axios = (await import('axios')).default;
    const postSpy = vi.spyOn(axios, 'post');

    const { default: api } = await import('../../services/api');
    const rejected = responseHandler(api)!.rejected!;

    await expect(rejected(ORG_403)).rejects.toBe(ORG_403);
    expect(postSpy).not.toHaveBeenCalled();
  });
});
