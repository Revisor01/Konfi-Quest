import api from './api';

interface User {
  id: number;
  type: 'admin' | 'konfi' | 'user';
  display_name: string;
  username?: string;
  email?: string;
  organization?: string;
  organization_id?: number;
  roles?: string[];
  role_name?: string;
  jahrgang?: string;
  is_super_admin?: boolean;
  permissions?: string[];
}

export const login = async (username: string, password: string, type: 'admin' | 'konfi'): Promise<User> => {
  // Use unified login endpoint with auto-detection
  const response = await api.post('/auth/login', { username, password });
  const { token, user } = response.data;

  if (!token || !user) throw new Error('Fehlender Token oder Benutzer');

  localStorage.setItem('konfi_token', token);
  localStorage.setItem('konfi_user', JSON.stringify(user));

  return user;
};

export const loginWithAutoDetection = async (username: string, password: string): Promise<User> => {
  console.log('Login starten…', { username, password });
  
  try {
    const response = await api.post('/auth/login', { username, password });
    console.log('Login erfolgreich:', response.data);
    const { token, user } = response.data;
    
    if (!token || !user) throw new Error('Fehlender Token oder Benutzer');
    
    localStorage.setItem('konfi_token', token);
    localStorage.setItem('konfi_user', JSON.stringify(user));
    
    return user;
  } catch (error: any) {
    console.error('Login fehlgeschlagen:', {
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      data: error?.response?.data,
      message: error.message,
      code: error.code,
      fullError: error
    });
    throw new Error('Login fehlgeschlagen: ' + (error?.response?.data?.error || error.message));
  }
};

export const logout = (): void => {
  localStorage.removeItem('konfi_token');
  localStorage.removeItem('konfi_user');
};

export const checkAuth = (): User | null => {
  const token = localStorage.getItem('konfi_token');
  const rawUser = localStorage.getItem('konfi_user');

  if (token && rawUser) {
    try {
      return JSON.parse(rawUser);
    } catch (err) {
      console.error('Fehler beim Parsen von konfi_user:', err);
      localStorage.removeItem('konfi_user');
      return null;
    }
  }

  return null;
};

export const getToken = (): string | null => {
  return localStorage.getItem('konfi_token');
};

export const getUser = (): User | null => {
  const raw = localStorage.getItem('konfi_user');
  try {
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('Fehler beim Parsen von konfi_user:', err);
    localStorage.removeItem('konfi_user');
    return null;
  }
};