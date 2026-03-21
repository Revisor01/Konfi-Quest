import api from './api';
import { Device } from '@capacitor/device';
import { Capacitor } from '@capacitor/core';
import { getUser, setToken, setUser, setRefreshToken, clearAuth, getDeviceId, setDeviceId } from './tokenStore';
import { offlineCache } from './offlineCache';
import { writeQueue } from './writeQueue';
import { networkMonitor } from './networkMonitor';
import { BaseUser } from '../types/user';

// Race Condition User-Wechsel: Backend POST /device-token loescht alte Tokens
// (anderer user_id mit gleichem device_token) automatisch VOR dem INSERT.
// Frontend-seitig wird logout() mit await ausgefuehrt und blockiert bis DELETE durch ist.
export const loginWithAutoDetection = async (username: string, password: string): Promise<BaseUser> => {

  try {
    const response = await api.post('/auth/login', { username, password });
    const { token, refresh_token, user } = response.data;

    if (!token || !user) throw new Error('Fehlender Token oder Benutzer');

    await setToken(token);
    if (refresh_token) await setRefreshToken(refresh_token);
    await setUser(user);

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
 console.warn('Logout bereits in Bearbeitung, wird übersprungen');
    return;
  }
  
  logoutInProgress = true;
  
  // TKN-01: Löscht nur den Token des AKTUELLEN Devices (user_id + platform + device_id)
  // Andere Geräte des Users behalten ihre Tokens
  // Best-effort: Logout geht immer durch, auch bei Fehler
  try {
    let deviceId: string | undefined;
    
    
    // Echte Device ID via Capacitor abrufen
    if (Capacitor.isNativePlatform()) {
      try {
        const deviceInfo = await Device.getId();
        deviceId = deviceInfo.identifier;
      } catch (err) {
 console.warn('Could not get device ID via Capacitor, using TokenStore fallback:', err);
        deviceId = getDeviceId() || undefined;
      }
    } else {
      deviceId = getDeviceId() || undefined;
      if (!deviceId) {
        const fallbackId = `${Capacitor.getPlatform()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await setDeviceId(fallbackId);
        deviceId = fallbackId;
      }
    }
    
    if (deviceId) {
      const deleteData = {
        device_id: deviceId,
        platform: Capacitor.getPlatform()
      };

      if (networkMonitor.isOnline) {
        try {
          await api.delete('/notifications/device-token', {
            data: deleteData
          });
        } catch (error) {
          // Falls Request fehlschlaegt: in Queue fuer spaeter
          await writeQueue.enqueue({
            method: 'DELETE',
            url: '/notifications/device-token',
            body: deleteData,
            maxRetries: 3,
            hasFileUpload: false,
            metadata: { type: 'fire-and-forget', clientId: `push_cleanup_${Date.now()}`, label: 'Push-Token entfernen' }
          });
        }
      } else {
        // Offline: direkt in Queue
        await writeQueue.enqueue({
          method: 'DELETE',
          url: '/notifications/device-token',
          body: deleteData,
          maxRetries: 3,
          hasFileUpload: false,
          metadata: { type: 'fire-and-forget', clientId: `push_cleanup_${Date.now()}`, label: 'Push-Token entfernen' }
        });
      }
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

  await clearAuth();
  // Cache löschen — alle gecachten API-Daten entfernen
  await offlineCache.clearAll();
  // Device ID NICHT löschen - bleibt für das Gerät persistent

  // Reset logout lock
  logoutInProgress = false;
};

export const checkAuth = (): BaseUser | null => {
  return getUser();
};

export const checkAuthAsync = async (): Promise<BaseUser | null> => {
  return getUser();
};

