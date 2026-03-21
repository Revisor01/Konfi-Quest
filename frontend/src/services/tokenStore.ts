import { Preferences } from '@capacitor/preferences';
import { BaseUser } from '../types/user';

// In-Memory-Cache — synchrone Reads, async Writes nach Preferences
let _token: string | null = null;
let _user: BaseUser | null = null;
let _deviceId: string | null = null;
let _pushTokenTimestamp: number = 0;

// --- Synchrone Getter (lesen nur aus Memory) ---

export const getToken = (): string | null => _token;

export const getUser = (): BaseUser | null => _user;

export const getDeviceId = (): string | null => _deviceId;

export const getPushTokenTimestamp = (): number => _pushTokenTimestamp;

// --- Async Setter (schreiben in Memory + Preferences) ---

export const setToken = async (token: string): Promise<void> => {
  _token = token;
  await Preferences.set({ key: 'konfi_token', value: token });
};

export const setUser = async (user: BaseUser): Promise<void> => {
  _user = user;
  await Preferences.set({ key: 'konfi_user', value: JSON.stringify(user) });
};

export const setDeviceId = async (id: string): Promise<void> => {
  _deviceId = id;
  await Preferences.set({ key: 'device_id', value: id });
};

export const setPushTokenTimestamp = async (ts: number): Promise<void> => {
  _pushTokenTimestamp = ts;
  await Preferences.set({ key: 'push_token_last_refresh', value: ts.toString() });
};

// --- Auth loeschen (Device-ID bleibt erhalten) ---

export const clearAuth = async (): Promise<void> => {
  _token = null;
  _user = null;
  await Preferences.remove({ key: 'konfi_token' });
  await Preferences.remove({ key: 'konfi_user' });
};

// --- Initialisierung: Preferences -> Memory laden ---

export const initTokenStore = async (): Promise<void> => {
  const tokenResult = await Preferences.get({ key: 'konfi_token' });
  _token = tokenResult.value;

  const userResult = await Preferences.get({ key: 'konfi_user' });
  if (userResult.value) {
    try {
      _user = JSON.parse(userResult.value);
    } catch {
      console.error('Fehler beim Parsen von konfi_user aus Preferences');
      _user = null;
      await Preferences.remove({ key: 'konfi_user' });
    }
  }

  const deviceIdResult = await Preferences.get({ key: 'device_id' });
  _deviceId = deviceIdResult.value;

  const pushResult = await Preferences.get({ key: 'push_token_last_refresh' });
  _pushTokenTimestamp = pushResult.value ? parseInt(pushResult.value, 10) || 0 : 0;
};
