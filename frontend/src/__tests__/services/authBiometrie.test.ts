import { describe, it, expect, vi, beforeEach } from 'vitest';

// Zusammenspiel von auth.ts mit der biometrisch gesicherten Sitzung:
// Abmelden muss den gespeicherten Token loeschen, und die Anmeldung per
// Biometrie muss jeden Ausgang sauber unterscheiden.

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' },
}));

vi.mock('@capacitor/device', () => ({
  Device: { getId: vi.fn().mockResolvedValue({ identifier: 'dev-1' }) },
}));

const mockApiPost = vi.fn(async () => ({ data: {} }));
const mockApiDelete = vi.fn(async () => ({ data: {} }));
vi.mock('../../services/api', () => ({
  default: {
    post: (...a: any[]) => mockApiPost(...(a as [])),
    delete: (...a: any[]) => mockApiDelete(...(a as [])),
    get: vi.fn(),
  },
  API_URL: 'https://test.example/api',
}));

// axios wird von mitBiometrieAnmelden direkt benutzt (bewusst am Interceptor
// vorbei) — hier gemockt, um die Serverantwort zu steuern.
const mockAxiosPost = vi.fn();
vi.mock('axios', () => ({
  default: { post: (...a: any[]) => mockAxiosPost(...(a as [])) },
}));

const mockSetToken = vi.fn(async () => undefined);
const mockSetRefreshToken = vi.fn(async () => undefined);
const mockSetUser = vi.fn(async () => undefined);
vi.mock('../../services/tokenStore', () => ({
  getUser: vi.fn(() => null),
  setUser: (...a: any[]) => mockSetUser(...(a as [])),
  setToken: (...a: any[]) => mockSetToken(...(a as [])),
  setRefreshToken: (...a: any[]) => mockSetRefreshToken(...(a as [])),
  getRefreshToken: vi.fn(() => 'refresh-alt'),
  clearAuth: vi.fn(async () => undefined),
  getDeviceId: vi.fn(() => 'dev-1'),
  setDeviceId: vi.fn(),
  setLoggingOut: vi.fn(),
}));

vi.mock('../../services/offlineCache', () => ({
  offlineCache: { clearAll: vi.fn(async () => undefined) },
}));
vi.mock('../../services/writeQueue', () => ({
  writeQueue: {
    flush: vi.fn(async () => ({ succeeded: [], failed: [] })),
    clear: vi.fn(async () => undefined),
  },
}));
vi.mock('../../services/websocket', () => ({ disconnectWebSocket: vi.fn() }));

let istOnline = true;
vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: {
    get isOnline() { return istOnline; },
  },
}));

// Die Biometrie selbst wird gemockt: hier geht es um die Verdrahtung in
// auth.ts, nicht um das Plugin (das prueft biometrics.test.ts).
const testUser = { id: 42, type: 'konfi' as const, display_name: 'Emilia' };
const mockEntsperren = vi.fn();
const mockVergessen = vi.fn(async () => undefined);
const mockAuffrischen = vi.fn(async () => undefined);
const mockIstAktiv = vi.fn(async () => true);
vi.mock('../../services/biometrics', () => ({
  mitBiometrieEntsperren: (...a: any[]) => mockEntsperren(...(a as [])),
  biometrieVergessen: (...a: any[]) => mockVergessen(...(a as [])),
  gespeichertenTokenAuffrischen: (...a: any[]) => mockAuffrischen(...(a as [])),
  istBiometrieAktiv: (...a: any[]) => mockIstAktiv(...(a as [])),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  istOnline = true;
  mockApiPost.mockResolvedValue({ data: {} });
  mockApiDelete.mockResolvedValue({ data: {} });
  mockIstAktiv.mockResolvedValue(true);
});

describe('logout', () => {
  it('loescht die biometrisch gespeicherte Sitzung', async () => {
    const { logout } = await import('../../services/auth');
    await logout();
    expect(mockVergessen).toHaveBeenCalledTimes(1);
  });

  it('loescht sie auch, wenn die Server-Calls fehlschlagen', async () => {
    mockApiPost.mockRejectedValue(new Error('offline'));
    mockApiDelete.mockRejectedValue(new Error('offline'));
    const { logout } = await import('../../services/auth');
    await logout();
    // Der lokale Logout darf NIE an einem Netzwerkfehler haengen bleiben —
    // sonst koennte man sich danach per Face ID wieder hineinentsperren.
    expect(mockVergessen).toHaveBeenCalledTimes(1);
  });
});

describe('mitBiometrieAnmelden', () => {
  it('stellt die Sitzung her und speichert den rotierten Token zurueck', async () => {
    mockEntsperren.mockResolvedValue({
      status: 'ok',
      refreshToken: 'refresh-gespeichert',
      user: testUser,
      gespeichertAm: 1_700_000_000_000,
    });
    mockAxiosPost.mockResolvedValue({
      data: { token: 'access-neu', refresh_token: 'refresh-neu' },
    });

    const { mitBiometrieAnmelden } = await import('../../services/auth');
    const ergebnis = await mitBiometrieAnmelden();

    expect(ergebnis.status).toBe('ok');
    if (ergebnis.status !== 'ok') throw new Error('unerwarteter Status');
    expect(ergebnis.user.id).toBe(42);

    expect(mockSetRefreshToken).toHaveBeenCalledWith('refresh-neu');
    expect(mockSetToken).toHaveBeenCalledWith('access-neu');
    // Rotierter Token muss zurueck in den sicheren Speicher, sonst ist die
    // gespeicherte Sitzung nach 5 Minuten wertlos.
    expect(mockAuffrischen).toHaveBeenCalledWith('refresh-neu', 1_700_000_000_000);
  });

  it('gibt Abbruch weiter, ohne den Server zu fragen', async () => {
    mockEntsperren.mockResolvedValue({ status: 'abgebrochen' });
    const { mitBiometrieAnmelden } = await import('../../services/auth');

    const ergebnis = await mitBiometrieAnmelden();

    expect(ergebnis.status).toBe('abgebrochen');
    expect(mockAxiosPost).not.toHaveBeenCalled();
    // Ein Abbruch darf die Einrichtung nicht loeschen.
    expect(mockVergessen).not.toHaveBeenCalled();
  });

  it('meldet "nichts gespeichert" weiter, ohne den Server zu fragen', async () => {
    mockEntsperren.mockResolvedValue({ status: 'nichts-gespeichert' });
    const { mitBiometrieAnmelden } = await import('../../services/auth');

    const ergebnis = await mitBiometrieAnmelden();

    expect(ergebnis.status).toBe('nichts-gespeichert');
    expect(mockAxiosPost).not.toHaveBeenCalled();
  });

  it('verwirft die gespeicherte Sitzung, wenn der Server den Token ablehnt', async () => {
    mockEntsperren.mockResolvedValue({
      status: 'ok',
      refreshToken: 'refresh-tot',
      user: testUser,
      gespeichertAm: Date.now(),
    });
    mockAxiosPost.mockRejectedValue({ response: { status: 401 } });

    const { mitBiometrieAnmelden } = await import('../../services/auth');
    const ergebnis = await mitBiometrieAnmelden();

    expect(ergebnis.status).toBe('abgelaufen');
    // Ohne dieses Aufraeumen fragte die App bei jedem Start nach Face ID und
    // scheiterte danach — genau die Schleife, die es nicht geben darf.
    expect(mockVergessen).toHaveBeenCalledTimes(1);
    expect(mockSetToken).not.toHaveBeenCalled();
  });

  it('meldet offline und behaelt die gespeicherte Sitzung', async () => {
    istOnline = false;
    mockEntsperren.mockResolvedValue({
      status: 'ok',
      refreshToken: 'refresh-gespeichert',
      user: testUser,
      gespeichertAm: Date.now(),
    });

    const { mitBiometrieAnmelden } = await import('../../services/auth');
    const ergebnis = await mitBiometrieAnmelden();

    expect(ergebnis.status).toBe('offline');
    expect(mockAxiosPost).not.toHaveBeenCalled();
    // Kein Netz ist kein Grund, die Einrichtung wegzuwerfen.
    expect(mockVergessen).not.toHaveBeenCalled();
  });

  it('meldet einen Fehler, wenn die Antwort unvollstaendig ist', async () => {
    mockEntsperren.mockResolvedValue({
      status: 'ok',
      refreshToken: 'refresh-gespeichert',
      user: testUser,
      gespeichertAm: Date.now(),
    });
    mockAxiosPost.mockResolvedValue({ data: { token: 'nur-access' } });

    const { mitBiometrieAnmelden } = await import('../../services/auth');
    const ergebnis = await mitBiometrieAnmelden();

    expect(ergebnis.status).toBe('fehler');
    expect(mockSetToken).not.toHaveBeenCalled();
  });
});

describe('biometrieAnmeldungMoeglich', () => {
  it('folgt dem Schalter', async () => {
    mockIstAktiv.mockResolvedValue(true);
    const { biometrieAnmeldungMoeglich } = await import('../../services/auth');
    expect(await biometrieAnmeldungMoeglich()).toBe(true);

    mockIstAktiv.mockResolvedValue(false);
    expect(await biometrieAnmeldungMoeglich()).toBe(false);
  });
});
