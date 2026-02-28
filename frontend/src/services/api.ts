import axios from 'axios';

const API_BASE_URL = 'https://konfi-quest.de/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Export API_BASE_URL für andere Komponenten
export const API_URL = API_BASE_URL;

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('konfi_token');
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
      // Don't redirect during login attempts
      const isLoginRequest = error.config?.url?.includes('/login');
      if (!isLoginRequest) {
        // Token expired or invalid
        localStorage.removeItem('konfi_token');
        localStorage.removeItem('konfi_user');
        window.location.href = '/';
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
    }

    return Promise.reject(error);
  }
);

export default api;