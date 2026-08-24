import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
    getPlatform: () => 'web',
  },
}));

vi.mock('@capacitor/device', () => ({
  Device: { getId: vi.fn().mockResolvedValue({ identifier: 'dev-1' }) },
}));

const mockApiPost = vi.fn(async () => ({ data: {} }));
const mockApiDelete = vi.fn(async () => ({ data: {} }));
vi.mock('../../services/api', () => ({
  default: {
    post: (...a: any[]) => mockApiPost(...a),
    delete: (...a: any[]) => mockApiDelete(...a),
    get: vi.fn(),
  },
}));

const mockClearAuth = vi.fn(async () => undefined);
vi.mock('../../services/tokenStore', () => ({
  getUser: vi.fn(() => null),
  setUser: vi.fn(),
  setToken: vi.fn(),
  setRefreshToken: vi.fn(),
  getRefreshToken: vi.fn(() => 'refresh-token'),
  clearAuth: (...a: any[]) => mockClearAuth(...a),
  getDeviceId: vi.fn(() => null),
  setDeviceId: vi.fn(),
  setLoggingOut: vi.fn(),
}));

vi.mock('../../services/offlineCache', () => ({
  offlineCache: { clearAll: vi.fn(async () => undefined) },
}));

const mockQueueFlush = vi.fn(async () => ({ succeeded: [], failed: [] }));
const mockQueueClear = vi.fn(async () => undefined);
vi.mock('../../services/writeQueue', () => ({
  writeQueue: {
    flush: (...a: any[]) => mockQueueFlush(...a),
    clear: (...a: any[]) => mockQueueClear(...a),
  },
}));

vi.mock('../../services/websocket', () => ({
  disconnectWebSocket: vi.fn(),
}));

let mockOnline = true;
vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: { get isOnline() { return mockOnline; } },
}));

describe('auth.logout — Queue gehoert zum Konto, nicht zum Geraet', () => {
  beforeEach(() => {
    mockOnline = true;
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('flusht die Queue VOR dem Token-Entzug und leert sie NACH clearAuth', async () => {
    const { logout } = await import('../../services/auth');

    await logout();

    // Flush noch mit gueltigem Token (vor clearAuth) — sonst gehen die
    // Nachrichten des abgemeldeten Kontos verloren oder werden spaeter unter
    // dem naechsten angemeldeten Konto gesendet.
    expect(mockQueueFlush).toHaveBeenCalledTimes(1);
    expect(mockClearAuth).toHaveBeenCalledTimes(1);
    expect(mockQueueClear).toHaveBeenCalledTimes(1);

    const flushOrder = mockQueueFlush.mock.invocationCallOrder[0];
    const clearAuthOrder = mockClearAuth.mock.invocationCallOrder[0];
    const queueClearOrder = mockQueueClear.mock.invocationCallOrder[0];
    expect(flushOrder).toBeLessThan(clearAuthOrder);
    expect(clearAuthOrder).toBeLessThan(queueClearOrder);
  });

  it('offline: kein aussichtsloser Flush, aber die Queue wird trotzdem geleert', async () => {
    mockOnline = false;
    const { logout } = await import('../../services/auth');

    await logout();

    expect(mockQueueFlush).not.toHaveBeenCalled();
    expect(mockQueueClear).toHaveBeenCalledTimes(1);
  });

  it('ein Fehler beim Flush verhindert den lokalen Logout nicht', async () => {
    mockQueueFlush.mockRejectedValueOnce(new Error('Netz weg'));
    const { logout } = await import('../../services/auth');

    await logout();

    expect(mockClearAuth).toHaveBeenCalledTimes(1);
    expect(mockQueueClear).toHaveBeenCalledTimes(1);
  });
});
