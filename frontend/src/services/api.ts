import axios from 'axios';

const API_BASE_URL = 'https://konfipoints.godsapp.de/api';

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

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('konfi_token');
      localStorage.removeItem('konfi_user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default api;