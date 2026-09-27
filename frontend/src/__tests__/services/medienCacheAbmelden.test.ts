import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dateien, cacheInhalt, objectUrlAttrappe } from '../medienAttrappen';

// Abmelden leert den Medien-Cache — auch Material (27.09.2026).
//
// Seit Simons „Fotos Anträge und Material ja bitte." liegen neben Chat- und
// Challenge-Dateien auch Material-Dateien auf dem Gerät. auth.test.ts prüft,
// DASS logout() den Cache leert (gegen eine Attrappe); hier läuft der ECHTE
// Cache: Nach dem Abmelden liegt keine Datei mehr da, aus keiner Quelle. Die
// Nachweisfotos der Anträge kommen gar nicht erst hinein.

vi.mock('@capacitor/filesystem', async () => (await import('../medienAttrappen')).dateisystemModul);
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' },
}));
vi.mock('@capacitor/device', () => ({
  Device: { getId: vi.fn().mockResolvedValue({ identifier: 'dev-1' }) },
}));

const apiGet = vi.fn();
vi.mock('../../services/api', () => ({
  default: {
    get: (...args: unknown[]) => apiGet(...args),
    post: vi.fn(async () => ({ data: {} })),
    delete: vi.fn(async () => ({ data: {} })),
  },
  API_URL: 'http://test/api',
  DATEI_TIMEOUT_MS: 180000,
}));
vi.mock('../../services/tokenStore', () => ({
  getUser: vi.fn(() => null),
  setUser: vi.fn(),
  setToken: vi.fn(),
  setRefreshToken: vi.fn(),
  getRefreshToken: vi.fn(() => null),
  clearAuth: vi.fn(async () => undefined),
  getDeviceId: vi.fn(() => null),
  setDeviceId: vi.fn(),
  setLoggingOut: vi.fn(),
}));
vi.mock('../../services/biometrics', () => ({
  mitBiometrieEntsperren: vi.fn(),
  gespeichertenTokenAuffrischen: vi.fn(),
  biometrieVergessen: vi.fn(async () => undefined),
  istBiometrieAktiv: vi.fn(async () => false),
}));
vi.mock('../../services/offlineCache', () => ({ offlineCache: { clearAll: vi.fn(async () => undefined) } }));
vi.mock('../../services/writeQueue', () => ({
  writeQueue: { flush: vi.fn(async () => ({ succeeded: [], failed: [] })), clear: vi.fn(async () => undefined) },
}));
vi.mock('../../services/websocket', () => ({ disconnectWebSocket: vi.fn() }));
vi.mock('../../services/networkMonitor', () => ({ networkMonitor: { isOnline: false } }));

import { logout } from '../../services/auth';
import { getMediaBlob, getMediaObjectUrl, getCachedObjectUrl, clearMediaCache } from '../../services/mediaCache';

beforeEach(async () => {
  await clearMediaCache();
  dateien.clear();
  apiGet.mockReset();
  apiGet.mockImplementation(async (route: string) => ({ data: new Blob([route], { type: 'image/jpeg' }) }));
  objectUrlAttrappe();
});

describe('Abmelden', () => {
  it('räumt Chat, Challenges und Material vom Gerät — Nachweisfotos lagen nie dort', async () => {
    await getMediaBlob('aa11');
    await getMediaBlob('bb22', { quelle: 'challenges' });
    await getMediaObjectUrl('cc33', { quelle: 'material' });
    await getMediaBlob('41', { quelle: 'nachweisfotoLeitung' });
    expect(cacheInhalt()).toEqual(['challenges-bb22', 'chat-aa11', 'material-cc33']);

    await logout();

    expect(cacheInhalt()).toEqual([]);
    expect(getCachedObjectUrl('cc33', 'material')).toBeNull();
  });

  it('danach geht dieselbe Material-Datei wieder zum Server — der entscheidet für das nächste Konto', async () => {
    await getMediaBlob('cc33', { quelle: 'material' });
    await logout();

    await getMediaBlob('cc33', { quelle: 'material' });

    expect(apiGet.mock.calls.filter(([r]) => r === '/material/files/cc33').length).toBe(2);
  });
});
