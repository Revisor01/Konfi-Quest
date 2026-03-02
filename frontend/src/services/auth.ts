import api from './api';
import { Device } from '@capacitor/device';
import { Capacitor } from '@capacitor/core';

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
  // permissions entfernt - jetzt rollen-basiert (role_name)
}

export const loginWithAutoDetection = async (username: string, password: string): Promise<User> => {
  
  try {
    const response = await api.post('/auth/login', { username, password });
    const { token, user } = response.data;
    
    if (!token || !user) throw new Error('Fehlender Token oder Benutzer');
    
    localStorage.setItem('konfi_token', token);
    localStorage.setItem('konfi_user', JSON.stringify(user));
    
    return user;
  } catch (error: unknown) {
    const err = error as { response?: { status?: number; statusText?: string; data?: { error?: string } }; message?: string; code?: string };
 console.error('Login fehlgeschlagen:', {
      status: err?.response?.status,
      statusText: err?.response?.statusText,
      data: err?.response?.data,
      message: err.message,
      code: err.code,
      fullError: error
    });
    throw new Error('Login fehlgeschlagen: ' + (err?.response?.data?.error || err.message));
  }
};

// ANTI-SPAM: Verhindere mehrfache Logout-Calls
let logoutInProgress = false;

export const logout = async (): Promise<void> => {
  if (logoutInProgress) {
 console.warn('Logout bereits in Bearbeitung, wird uebersprungen');
    return;
  }
  
  logoutInProgress = true;
  
  // Push token für aktuelles Device löschen vor logout
  try {
    let deviceId: string | undefined;
    
    
    // Echte Device ID via Capacitor abrufen
    if (Capacitor.isNativePlatform()) {
      try {
        const deviceInfo = await Device.getId();
        deviceId = deviceInfo.identifier;
      } catch (err) {
 console.warn('Could not get device ID via Capacitor, using localStorage fallback:', err);
        deviceId = localStorage.getItem('device_id') || undefined;
      }
    } else {
      deviceId = localStorage.getItem('device_id') || undefined;
    }
    
    if (deviceId) {
      const deleteData = {
        device_id: deviceId,
        platform: Capacitor.getPlatform()
      };
      
      const response = await api.delete('/notifications/device-token', {
        data: deleteData
      });
      
    } else {
 console.warn('No device ID found - skipping push token removal');
    }
  } catch (error: unknown) {
    const err = error as { response?: { status?: number; statusText?: string; data?: unknown }; message?: string };
 console.error('ERROR during push token removal:', {
      message: err.message,
      status: err?.response?.status,
      statusText: err?.response?.statusText,
      data: err?.response?.data,
      fullError: error
    });
    // Logout sollte trotzdem funktionieren, auch wenn Push Token removal fehlschlägt
  }

  localStorage.removeItem('konfi_token');
  localStorage.removeItem('konfi_user');
  // Device ID NICHT löschen - bleibt für das Gerät persistent
  
  // Reset logout lock
  logoutInProgress = false;
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

