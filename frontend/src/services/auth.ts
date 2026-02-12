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

// ANTI-SPAM: Verhindere mehrfache Logout-Calls
let logoutInProgress = false;

export const logout = async (): Promise<void> => {
  if (logoutInProgress) {
    console.log('🚫 LOGOUT already in progress, skipping...');
    return;
  }
  
  logoutInProgress = true;
  console.log('🚪 LOGOUT STARTED - attempting to remove push token...');
  
  // Push token für aktuelles Device löschen vor logout
  try {
    let deviceId: string | undefined;
    
    console.log('📱 Platform check:', { 
      isNative: Capacitor.isNativePlatform(),
      platform: Capacitor.getPlatform()
    });
    
    // Echte Device ID via Capacitor abrufen
    if (Capacitor.isNativePlatform()) {
      try {
        console.log('📱 Getting device ID via Capacitor...');
        const deviceInfo = await Device.getId();
        deviceId = deviceInfo.identifier;
        console.log('🗑️ Device ID retrieved for token removal:', deviceId.substring(0, 8) + '...');
      } catch (err) {
        console.warn('⚠️ Could not get device ID via Capacitor, using localStorage fallback:', err);
        deviceId = localStorage.getItem('device_id') || undefined;
        console.log('📱 Fallback Device ID from localStorage:', deviceId?.substring(0, 8) + '...');
      }
    } else {
      deviceId = localStorage.getItem('device_id') || undefined;
      console.log('🌐 Web platform - using localStorage Device ID:', deviceId?.substring(0, 8) + '...');
    }
    
    if (deviceId) {
      console.log('🚀 Sending DELETE request to /notifications/device-token...');
      const deleteData = {
        device_id: deviceId,
        platform: Capacitor.getPlatform()
      };
      console.log('📤 DELETE request data:', deleteData);
      
      const response = await api.delete('/notifications/device-token', {
        data: deleteData
      });
      
      console.log('✅ Push token DELETE response:', response.status, response.data);
      console.log('✅ Push token successfully removed for current device');
    } else {
      console.warn('⚠️ No device ID found - skipping push token removal');
    }
  } catch (error: any) {
    console.error('❌ ERROR during push token removal:', {
      message: error.message,
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      data: error?.response?.data,
      fullError: error
    });
    // Logout sollte trotzdem funktionieren, auch wenn Push Token removal fehlschlägt
  }

  console.log('🧹 Clearing localStorage data...');
  localStorage.removeItem('konfi_token');
  localStorage.removeItem('konfi_user');
  // Device ID NICHT löschen - bleibt für das Gerät persistent
  
  // Reset logout lock
  logoutInProgress = false;
  console.log('🚪 LOGOUT COMPLETED');
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

