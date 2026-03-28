import { describe, it, expect, beforeEach, vi } from 'vitest';

// Explizit Capacitor-Mocks registrieren
const mockStore = new Map<string, string>();

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => {
      return { value: mockStore.get(key) ?? null };
    }),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      mockStore.set(key, value);
    }),
    remove: vi.fn(async ({ key }: { key: string }) => {
      mockStore.delete(key);
    }),
    keys: vi.fn(async () => {
      return { keys: Array.from(mockStore.keys()) };
    }),
  },
}));

describe('tokenStore', () => {
  beforeEach(() => {
    mockStore.clear();
    vi.resetModules();
  });

  it('getToken() gibt null zurueck initial', async () => {
    const { getToken, initTokenStore } = await import('../../services/tokenStore');
    await initTokenStore();
    expect(getToken()).toBeNull();
  });

  it('setToken() speichert Token in Memory und Preferences', async () => {
    const { getToken, setToken, initTokenStore } = await import('../../services/tokenStore');
    await initTokenStore();
    await setToken('test-token-123');
    expect(getToken()).toBe('test-token-123');
    expect(mockStore.get('konfi_token')).toBe('test-token-123');
  });

  it('setUser() speichert BaseUser und getUser() gibt ihn zurueck', async () => {
    const { getUser, setUser, initTokenStore } = await import('../../services/tokenStore');
    await initTokenStore();
    const user = { id: 1, type: 'admin' as const, display_name: 'Test Admin' };
    await setUser(user);
    expect(getUser()).toEqual(user);
    expect(mockStore.get('konfi_user')).toBe(JSON.stringify(user));
  });

  it('setDeviceId() speichert DeviceId', async () => {
    const { getDeviceId, setDeviceId, initTokenStore } = await import('../../services/tokenStore');
    await initTokenStore();
    await setDeviceId('device-abc');
    expect(getDeviceId()).toBe('device-abc');
    expect(mockStore.get('device_id')).toBe('device-abc');
  });

  it('setPushTokenTimestamp() speichert Timestamp', async () => {
    const { getPushTokenTimestamp, setPushTokenTimestamp, initTokenStore } = await import('../../services/tokenStore');
    await initTokenStore();
    await setPushTokenTimestamp(1234567890);
    expect(getPushTokenTimestamp()).toBe(1234567890);
    expect(mockStore.get('push_token_last_refresh')).toBe('1234567890');
  });

  it('setRefreshToken() speichert RefreshToken', async () => {
    const { getRefreshToken, setRefreshToken, initTokenStore } = await import('../../services/tokenStore');
    await initTokenStore();
    await setRefreshToken('refresh-xyz');
    expect(getRefreshToken()).toBe('refresh-xyz');
    expect(mockStore.get('konfi_refresh_token')).toBe('refresh-xyz');
  });

  it('clearAuth() loescht Token, User, RefreshToken aber behaelt DeviceId', async () => {
    const { getToken, getUser, getRefreshToken, getDeviceId, setToken, setUser, setRefreshToken, setDeviceId, clearAuth, initTokenStore } = await import('../../services/tokenStore');
    await initTokenStore();
    await setToken('tok');
    await setUser({ id: 1, type: 'konfi', display_name: 'Test' });
    await setRefreshToken('ref');
    await setDeviceId('dev-123');

    await clearAuth();

    expect(getToken()).toBeNull();
    expect(getUser()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(getDeviceId()).toBe('dev-123');
  });

  it('initTokenStore() laedt Werte aus Preferences in Memory', async () => {
    // Zuerst Preferences befuellen
    mockStore.set('konfi_token', 'stored-token');
    mockStore.set('konfi_user', JSON.stringify({ id: 2, type: 'teamer', display_name: 'Teamer' }));
    mockStore.set('device_id', 'stored-device');
    mockStore.set('push_token_last_refresh', '9999');
    mockStore.set('konfi_refresh_token', 'stored-refresh');

    const { getToken, getUser, getDeviceId, getPushTokenTimestamp, getRefreshToken, initTokenStore } = await import('../../services/tokenStore');
    await initTokenStore();

    expect(getToken()).toBe('stored-token');
    expect(getUser()).toEqual({ id: 2, type: 'teamer', display_name: 'Teamer' });
    expect(getDeviceId()).toBe('stored-device');
    expect(getPushTokenTimestamp()).toBe(9999);
    expect(getRefreshToken()).toBe('stored-refresh');
  });

  it('initTokenStore() handhabt korruptes JSON graceful', async () => {
    mockStore.set('konfi_user', '{invalid-json');

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { getUser, initTokenStore } = await import('../../services/tokenStore');
    await initTokenStore();

    expect(getUser()).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('Fehler beim Parsen'));
    consoleError.mockRestore();
  });

  it('initTokenStore() handhabt fehlenden pushTokenTimestamp als 0', async () => {
    const { getPushTokenTimestamp, initTokenStore } = await import('../../services/tokenStore');
    await initTokenStore();
    expect(getPushTokenTimestamp()).toBe(0);
  });
});
