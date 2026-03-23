import axios from 'axios';
import axiosRetry from 'axios-retry';
import { getToken, getRefreshToken, setToken, setRefreshToken, clearAuth } from './tokenStore';
import { networkMonitor } from './networkMonitor';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://konfi-quest.de/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Automatischer Retry für transiente Fehler (5xx, 408, 429)
axiosRetry(api, {
  retries: 3,
  retryDelay: (retryCount) => {
    return axiosRetry.exponentialDelay(retryCount) + Math.random() * 200;
  },
  retryCondition: (error) => {
    const status = error.response?.status;
    if (status === 429) return true;
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || (status !== undefined && status >= 500);
  },
  onRetry: () => {}
});

// Export API_BASE_URL für andere Komponenten
export const API_URL = API_BASE_URL;

// Add token to requests (synchron aus Memory-Cache)
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Verhindere parallele Refresh-Requests
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
};

const addRefreshSubscriber = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

// Handle auth errors and rate limiting
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401) {
      const isLoginRequest = originalRequest?.url?.includes('/login');
      const isRefreshRequest = originalRequest?.url?.includes('/refresh');

      // Login- und Refresh-Requests nicht retry'en
      if (isLoginRequest || isRefreshRequest) {
        return Promise.reject(error);
      }

      // Offline: Token behalten, gecachte Daten nutzen
      if (!networkMonitor.isOnline) {
        console.warn('401 während Offline — Token wird behalten');
        return Promise.reject(error);
      }

      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        // Kein Refresh-Token → direkt Re-Login
        await clearAuth();
        window.dispatchEvent(new CustomEvent('auth:relogin-required'));
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Anderer Request refresht bereits → warten
        return new Promise((resolve) => {
          addRefreshSubscriber((newToken: string) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            resolve(api(originalRequest));
          });
        });
      }

      isRefreshing = true;

      try {
        // Refresh-Versuch mit direktem axios (nicht api, um Interceptor-Loop zu vermeiden)
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken
        });

        const { token: newToken, refresh_token: newRefreshToken } = response.data;
        await setToken(newToken);
        await setRefreshToken(newRefreshToken);

        isRefreshing = false;
        onTokenRefreshed(newToken);

        // Original-Request mit neuem Token wiederholen
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        refreshSubscribers = [];

        // Refresh fehlgeschlagen → Re-Login-Dialog
        await clearAuth();
        window.dispatchEvent(new CustomEvent('auth:relogin-required'));
        return Promise.reject(refreshError);
      }
    }

    // Rate-Limit: Benutzerfreundliche Meldung bereitstellen
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      const minutes = retryAfter ? Math.ceil(parseInt(retryAfter) / 60) : 15;
      error.rateLimitMessage = `Zu viele Versuche. Bitte warte ${minutes} Minuten.`;
      // Falls Backend bereits eine Message hat, diese bevorzugen
      if (error.response.data?.error) {
        error.rateLimitMessage = error.response.data.error;
      }
      // Generisches Rate-Limit Event für nicht-Login Requests
      const isLoginRequest = error.config?.url?.includes('/login');
      if (!isLoginRequest) {
        window.dispatchEvent(new CustomEvent('rate-limit', {
          detail: { message: error.rateLimitMessage }
        }));
      }
    }

    return Promise.reject(error);
  }
);

export default api;