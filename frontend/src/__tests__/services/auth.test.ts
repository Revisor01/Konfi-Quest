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

const mockApiPost = vi.fn<(...args: unknown[]) => Promise<{ data: object }>>(async () => ({ data: {} }));
const mockApiDelete = vi.fn<(...args: unknown[]) => Promise<{ data: object }>>(async () => ({ data: {} }));
vi.mock('../../services/api', () => ({
  default: {
    post: (...a: unknown[]) => mockApiPost(...a),
    delete: (...a: unknown[]) => mockApiDelete(...a),
    get: vi.fn(),
  },
}));

const mockClearAuth = vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined);
vi.mock('../../services/tokenStore', () => ({
  getUser: vi.fn(() => null),
  setUser: vi.fn(),
  setToken: vi.fn(),
  setRefreshToken: vi.fn(),
  getRefreshToken: vi.fn(() => 'refresh-token'),
  clearAuth: (...a: unknown[]) => mockClearAuth(...a),
  getDeviceId: vi.fn(() => null),
  setDeviceId: vi.fn(),
  setLoggingOut: vi.fn(),
}));

vi.mock('../../services/offlineCache', () => ({
  offlineCache: { clearAll: vi.fn(async () => undefined) },
}));

const mockQueueFlush = vi.fn<(...args: unknown[]) => Promise<{ succeeded: unknown[]; failed: unknown[] }>>(async () => ({ succeeded: [], failed: [] }));
const mockQueueClear = vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined);
vi.mock('../../services/writeQueue', () => ({
  writeQueue: {
    flush: (...a: unknown[]) => mockQueueFlush(...a),
    clear: (...a: unknown[]) => mockQueueClear(...a),
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
  // Simons Befund 04.09.2026, drei Symptome aus EINER Ursache:
  //   "Nach Logout, App beenden, App starten -> wieder im alten Account."
  //   "Dann ausloggen zeigt die Anmeldeseite. Ich melde mich an. Alles
  //    bricht zusammen: Tab-Leiste zeigt Konfi, Inhalt Admin."
  //
  // logoutInProgress wurde am ENDE der Funktion zurueckgesetzt, ohne
  // try/finally, und clearAuth() lief voellig ungeschuetzt. Warf einer der
  // Schritte, blieb das Flag fuer immer true -- und JEDER weitere Logout
  // kehrte in Zeile 1 wirkungslos zurueck, ohne die Sitzung zu raeumen.
  it('ein Fehler in clearAuth blockiert den naechsten Logout NICHT', async () => {
    mockClearAuth.mockRejectedValueOnce(new Error('Preferences kaputt'));
    const { logout } = await import('../../services/auth');

    // Erster Logout: clearAuth wirft.
    await logout();
    expect(mockClearAuth).toHaveBeenCalledTimes(1);

    // Zweiter Logout MUSS wieder aufraeumen -- vorher kehrte er
    // wirkungslos zurueck und der Token blieb liegen.
    await logout();
    expect(mockClearAuth).toHaveBeenCalledTimes(2);
  });

  it('isLoggingOut faellt auch nach einem Fehler zurueck', async () => {
    mockClearAuth.mockRejectedValueOnce(new Error('kaputt'));
    const { logout, isLoggingOut } = await import('../../services/auth');

    await logout();

    // Sonst haelt der 401-Interceptor die Sitzung dauerhaft fuer
    // "wird gerade abgemeldet" und meldet echte Abläufe nicht mehr.
    expect(isLoggingOut()).toBe(false);
  });

  it('raeumt nach einem Fehler in clearAuth trotzdem Queue und Cache', async () => {
    mockClearAuth.mockRejectedValueOnce(new Error('kaputt'));
    const { logout } = await import('../../services/auth');

    await logout();

    // Vorher brach die Funktion an der ungeschuetzten Zeile ab -- Queue und
    // Cache des alten Kontos blieben liegen und wurden nach dem naechsten
    // Login unter fremder Identitaet gesendet.
    expect(mockQueueClear).toHaveBeenCalledTimes(1);
  });
});
