import axios from 'axios';
import axiosRetry from 'axios-retry';
import { getToken, clearAuth } from './tokenStore';
import { networkMonitor } from './networkMonitor';

const API_BASE_URL = 'https://konfi-quest.de/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Automatischer Retry fuer transiente Fehler (5xx, 408, 429)
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
  onRetry: (retryCount, error) => {
    console.log(`Retry ${retryCount} für ${error.config?.url}`);
  }
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

// Handle auth errors and rate limiting
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isLoginRequest = error.config?.url?.includes('/login');
      if (!isLoginRequest) {
        if (networkMonitor.isOnline) {
          // Online und 401 = Token wirklich ungueltig
          clearAuth().then(() => {
            window.location.href = '/';
          });
        } else {
          // Offline und 401 = Netzwerkproblem, Token behalten
          console.warn('401 waehrend Offline — Token wird behalten');
          return Promise.reject(error);
        }
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
      // Generisches Rate-Limit Event fuer nicht-Login Requests
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