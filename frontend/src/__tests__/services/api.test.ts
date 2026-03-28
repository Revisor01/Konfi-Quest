import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock tokenStore
vi.mock('../../services/tokenStore', () => ({
  getToken: vi.fn(() => null),
  getRefreshToken: vi.fn(() => null),
  setToken: vi.fn(),
  setRefreshToken: vi.fn(),
  clearAuth: vi.fn(),
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
    const handlers = (api.interceptors.request as any).handlers;
    const requestInterceptor = handlers.find((h: any) => h && h.fulfilled);

    if (requestInterceptor) {
      const config = { headers: {} as any };
      const result = requestInterceptor.fulfilled(config);
      expect(result.headers.Authorization).toBe('Bearer my-jwt-token');
    }
  });

  it('Request-Interceptor setzt keinen Header wenn kein Token', async () => {
    const tokenStore = await import('../../services/tokenStore');
    vi.mocked(tokenStore.getToken).mockReturnValue(null);

    const { default: api } = await import('../../services/api');

    const handlers = (api.interceptors.request as any).handlers;
    const requestInterceptor = handlers.find((h: any) => h && h.fulfilled);

    if (requestInterceptor) {
      const config = { headers: {} as any };
      const result = requestInterceptor.fulfilled(config);
      expect(result.headers.Authorization).toBeUndefined();
    }
  });

  it('401-Response ohne RefreshToken dispatcht auth:relogin-required', async () => {
    const tokenStore = await import('../../services/tokenStore');
    vi.mocked(tokenStore.getRefreshToken).mockReturnValue(null);
    vi.mocked(tokenStore.clearAuth).mockResolvedValue(undefined);

    const { default: api } = await import('../../services/api');
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    const handlers = (api.interceptors.response as any).handlers;
    const responseInterceptor = handlers.find((h: any) => h && h.rejected);

    if (responseInterceptor) {
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

    const handlers = (api.interceptors.response as any).handlers;
    const responseInterceptor = handlers.find((h: any) => h && h.rejected);

    if (responseInterceptor) {
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
      } catch (e: any) {
        expect(e.rateLimitMessage).toBeDefined();
        expect(typeof e.rateLimitMessage).toBe('string');
      }

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'rate-limit' })
      );
    }

    dispatchSpy.mockRestore();
  });

  it('429-Response bevorzugt Backend-Error-Message', async () => {
    const { default: api } = await import('../../services/api');

    const handlers = (api.interceptors.response as any).handlers;
    const responseInterceptor = handlers.find((h: any) => h && h.rejected);

    if (responseInterceptor) {
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
      } catch (e: any) {
        expect(e.rateLimitMessage).toBe('Bitte warte 15 Minuten');
      }
    }
  });

  it('401 auf Login-Request wird nicht als Refresh behandelt', async () => {
    const tokenStore = await import('../../services/tokenStore');
    const { default: api } = await import('../../services/api');

    const handlers = (api.interceptors.response as any).handlers;
    const responseInterceptor = handlers.find((h: any) => h && h.rejected);

    if (responseInterceptor) {
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
