import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AxiosInstance, AxiosInterceptorManager, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

// axios legt die registrierten Interceptor-Handler intern unter `handlers` ab.
// Das ist Bibliotheks-Interna und daher nicht in den oeffentlichen Typen —
// hier lokal beschrieben, damit die Tests die Handler direkt ausfuehren koennen.
interface InterceptorHandler<T> {
  fulfilled?: (value: T) => T | Promise<T>;
  rejected?: (error: unknown) => unknown;
}
type ManagerMitHandlers<T> = AxiosInterceptorManager<T> & { handlers: (InterceptorHandler<T> | null)[] };

const requestHandler = (api: AxiosInstance) =>
  (api.interceptors.request as ManagerMitHandlers<InternalAxiosRequestConfig>).handlers
    .find((h): h is InterceptorHandler<InternalAxiosRequestConfig> => Boolean(h && h.fulfilled));

const responseHandler = (api: AxiosInstance) =>
  (api.interceptors.response as ManagerMitHandlers<AxiosResponse>).handlers
    .find((h): h is InterceptorHandler<AxiosResponse> => Boolean(h && h.rejected));

// Mock tokenStore
vi.mock('../../services/tokenStore', () => ({
  getToken: vi.fn(() => null),
  getRefreshToken: vi.fn(() => null),
  getActiveOrgId: vi.fn(() => null),
  setToken: vi.fn(),
  setRefreshToken: vi.fn(),
  setActiveOrgId: vi.fn(),
  clearAuth: vi.fn(),
  isLoggingOut: vi.fn(() => false),
}));

// Mock networkMonitor
vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: {
    isOnline: true,
  },
}));

// Mock axios-retry (es darf nicht die echte axios-Instanz modifizieren)
vi.mock('axios-retry', () => ({
  default: vi.fn(),
  __esModule: true,
}));

describe('api-Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('API_URL export hat korrekten Default-Wert', async () => {
    const { API_URL } = await import('../../services/api');
    expect(API_URL).toBeDefined();
    expect(typeof API_URL).toBe('string');
    expect(API_URL.length).toBeGreaterThan(0);
  });

  it('api ist eine axios-Instanz mit interceptors', async () => {
    const { default: api } = await import('../../services/api');
    expect(api).toBeDefined();
    expect(api.interceptors).toBeDefined();
    expect(api.interceptors.request).toBeDefined();
    expect(api.interceptors.response).toBeDefined();
  });

  it('Request-Interceptor setzt Authorization-Header wenn Token vorhanden', async () => {
    const tokenStore = await import('../../services/tokenStore');
    vi.mocked(tokenStore.getToken).mockReturnValue('my-jwt-token');

    const { default: api } = await import('../../services/api');

    // Interceptors manuell ausfuehren
    const requestInterceptor = requestHandler(api);

    if (requestInterceptor?.fulfilled) {
      const config = { headers: {} } as unknown as InternalAxiosRequestConfig;
      const result = await requestInterceptor.fulfilled(config);
      expect(result.headers.Authorization).toBe('Bearer my-jwt-token');
    }
  });

  it('Request-Interceptor setzt keinen Header wenn kein Token', async () => {
    const tokenStore = await import('../../services/tokenStore');
    vi.mocked(tokenStore.getToken).mockReturnValue(null);

    const { default: api } = await import('../../services/api');

    const requestInterceptor = requestHandler(api);

    if (requestInterceptor?.fulfilled) {
      const config = { headers: {} } as unknown as InternalAxiosRequestConfig;
      const result = await requestInterceptor.fulfilled(config);
      expect(result.headers.Authorization).toBeUndefined();
    }
  });

  it('401-Response ohne RefreshToken dispatcht auth:relogin-required', async () => {
    const tokenStore = await import('../../services/tokenStore');
    vi.mocked(tokenStore.getRefreshToken).mockReturnValue(null);
    vi.mocked(tokenStore.clearAuth).mockResolvedValue(undefined);

    const { default: api } = await import('../../services/api');
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    const responseInterceptor = responseHandler(api);

    if (responseInterceptor?.rejected) {
      const error = {
        config: { url: '/some-endpoint', headers: {} },
        response: { status: 401 },
      };

      try {
        await responseInterceptor.rejected(error);
      } catch {
        // Expected rejection
      }

      expect(tokenStore.clearAuth).toHaveBeenCalled();
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'auth:relogin-required' })
      );
    }

    dispatchSpy.mockRestore();
  });

  it('429-Response setzt rateLimitMessage auf Error', async () => {
    const { default: api } = await import('../../services/api');
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    const responseInterceptor = responseHandler(api);

    if (responseInterceptor?.rejected) {
      const error = {
        config: { url: '/some-endpoint' },
        response: {
          status: 429,
          headers: { 'retry-after': '900' },
          data: {},
        },
        rateLimitMessage: undefined as string | undefined,
      };

      try {
        await responseInterceptor.rejected(error);
      } catch (e) {
        const fehler = e as { rateLimitMessage?: string };
        expect(fehler.rateLimitMessage).toBeDefined();
        expect(typeof fehler.rateLimitMessage).toBe('string');
      }

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'rate-limit' })
      );
    }

    dispatchSpy.mockRestore();
  });

  it('429-Response bevorzugt Backend-Error-Message', async () => {
    const { default: api } = await import('../../services/api');

    const responseInterceptor = responseHandler(api);

    if (responseInterceptor?.rejected) {
      const error = {
        config: { url: '/some-endpoint' },
        response: {
          status: 429,
          headers: {},
          data: { error: 'Bitte warte 15 Minuten' },
        },
        rateLimitMessage: undefined as string | undefined,
      };

      try {
        await responseInterceptor.rejected(error);
      } catch (e) {
        expect((e as { rateLimitMessage?: string }).rateLimitMessage).toBe('Bitte warte 15 Minuten');
      }
    }
  });

  it('401 auf Login-Request wird nicht als Refresh behandelt', async () => {
    const tokenStore = await import('../../services/tokenStore');
    const { default: api } = await import('../../services/api');

    const responseInterceptor = responseHandler(api);

    if (responseInterceptor?.rejected) {
      const error = {
        config: { url: '/auth/login', headers: {} },
        response: { status: 401 },
      };

      try {
        await responseInterceptor.rejected(error);
      } catch {
        // Expected
      }

      // clearAuth sollte NICHT aufgerufen worden sein (Login-Request bypass)
      expect(tokenStore.clearAuth).not.toHaveBeenCalled();
    }
  });
});

// --- ensureFreshToken: proaktiver Refresh vor Ablauf ---

// Base64url-JWT mit gegebenem exp-Offset (Sekunden ab jetzt) bauen
const makeJwt = (expOffsetSeconds: number): string => {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expOffsetSeconds }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `header.${payload}.sig`;
};

describe('ensureFreshToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('gibt einen noch lange gueltigen Token unveraendert zurueck (kein Refresh)', async () => {
    const axios = (await import('axios')).default;
    const tokenStore = await import('../../services/tokenStore');
    const validToken = makeJwt(600);
    vi.mocked(tokenStore.getToken).mockReturnValue(validToken);
    vi.mocked(tokenStore.getRefreshToken).mockReturnValue('refresh-1');
    const postSpy = vi.spyOn(axios, 'post');

    const { ensureFreshToken } = await import('../../services/api');
    const result = await ensureFreshToken();

    expect(result).toBe(validToken);
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('refresht einen abgelaufenen Token proaktiv und speichert den neuen', async () => {
    const axios = (await import('axios')).default;
    const tokenStore = await import('../../services/tokenStore');
    const expiredToken = makeJwt(-60);
    const newToken = makeJwt(900);
    vi.mocked(tokenStore.getToken).mockReturnValue(expiredToken);
    vi.mocked(tokenStore.getRefreshToken).mockReturnValue('refresh-1');
    const postSpy = vi.spyOn(axios, 'post').mockResolvedValue({
      data: { token: newToken, refresh_token: 'refresh-2' },
    });

    const { ensureFreshToken } = await import('../../services/api');
    const result = await ensureFreshToken();

    expect(result).toBe(newToken);
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy.mock.calls[0][1]).toEqual({ refresh_token: 'refresh-1' });
    expect(tokenStore.setToken).toHaveBeenCalledWith(newToken);
    expect(tokenStore.setRefreshToken).toHaveBeenCalledWith('refresh-2');
  });

  it('persistiert den Refresh-Token VOR dem Access-Token (Android-Session-Race)', async () => {
    // Der Server revoked den alten Refresh-Token bei Rotation sofort. Stirbt der
    // Android-Prozess zwischen den beiden Preferences-Writes, darf NICHT der
    // langlebige Refresh-Token verloren gehen — sonst ist die Session tot. Also
    // muss setRefreshToken VOR setToken laufen.
    const axios = (await import('axios')).default;
    const tokenStore = await import('../../services/tokenStore');
    const expiredToken = makeJwt(-60);
    const newToken = makeJwt(900);
    vi.mocked(tokenStore.getToken).mockReturnValue(expiredToken);
    vi.mocked(tokenStore.getRefreshToken).mockReturnValue('refresh-1');
    vi.spyOn(axios, 'post').mockResolvedValue({
      data: { token: newToken, refresh_token: 'refresh-2' },
    });

    const order: string[] = [];
    vi.mocked(tokenStore.setRefreshToken).mockImplementation(async () => { order.push('refresh'); });
    vi.mocked(tokenStore.setToken).mockImplementation(async () => { order.push('access'); });

    const { ensureFreshToken } = await import('../../services/api');
    await ensureFreshToken();

    expect(order).toEqual(['refresh', 'access']);
  });

  it('parallele Aufrufe teilen sich EINEN Refresh-Request', async () => {
    const axios = (await import('axios')).default;
    const tokenStore = await import('../../services/tokenStore');
    const expiredToken = makeJwt(-60);
    const newToken = makeJwt(900);
    vi.mocked(tokenStore.getToken).mockReturnValue(expiredToken);
    vi.mocked(tokenStore.getRefreshToken).mockReturnValue('refresh-1');

    let resolveRefresh: (value: { data: { token: string; refresh_token: string } }) => void;
    const postSpy = vi.spyOn(axios, 'post').mockImplementation(
      () => new Promise((resolve) => { resolveRefresh = resolve; })
    );

    const { ensureFreshToken } = await import('../../services/api');
    const p1 = ensureFreshToken();
    const p2 = ensureFreshToken();
    resolveRefresh!({ data: { token: newToken, refresh_token: 'refresh-2' } });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe(newToken);
    expect(r2).toBe(newToken);
    expect(postSpy).toHaveBeenCalledTimes(1);
  });

  it('gibt bei Refresh-Fehler den alten Token zurueck und zerstoert die Session NICHT', async () => {
    const axios = (await import('axios')).default;
    const tokenStore = await import('../../services/tokenStore');
    const expiredToken = makeJwt(-60);
    vi.mocked(tokenStore.getToken).mockReturnValue(expiredToken);
    vi.mocked(tokenStore.getRefreshToken).mockReturnValue('refresh-1');
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('Netzwerkfehler'));

    const { ensureFreshToken } = await import('../../services/api');
    const result = await ensureFreshToken();

    expect(result).toBe(expiredToken);
    expect(tokenStore.clearAuth).not.toHaveBeenCalled();
  });

  it('gibt null zurueck wenn kein Token vorhanden ist', async () => {
    const tokenStore = await import('../../services/tokenStore');
    vi.mocked(tokenStore.getToken).mockReturnValue(null);

    const { ensureFreshToken } = await import('../../services/api');
    expect(await ensureFreshToken()).toBeNull();
  });
});
