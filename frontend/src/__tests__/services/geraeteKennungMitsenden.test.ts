// Die App schickt ihre Geraete-Kennung mit, damit der Server das
// Refresh-Token an das Geraet binden kann (Audit 26.09.2026, Sicherheit
// BF-08; Server: routes/auth.js, Migration 171, Test
// backend/tests/routes/refreshGeraetebindung.test.js).
//
// Gebunden heisst: Das Token gilt nur mit DERSELBEN Kennung. Deshalb muss sie
// stabil sein (auf dem Geraet die des Betriebssystems, nicht die gespeicherte
// Kopie) und in jeder Anfrage stecken, die ein Token ausstellt oder
// eintauscht: Anmeldung, Registrierung, Biometrie-Anmeldung, Refresh.

import { describe, it, expect, beforeEach, vi } from 'vitest';

let istNativ = false;
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => istNativ,
    getPlatform: () => (istNativ ? 'ios' : 'web'),
  },
}));
const mockGetId = vi.fn();
vi.mock('@capacitor/device', () => ({ Device: { getId: (...a: unknown[]) => mockGetId(...a) } }));

let gespeichert: string | null = null;
const mockSetDeviceId = vi.fn(async (id: string) => { gespeichert = id; });
vi.mock('../../services/tokenStore', () => ({
  getDeviceId: () => gespeichert,
  setDeviceId: (id: string) => mockSetDeviceId(id),
  getToken: () => null,
  getRefreshToken: () => 'refresh-1',
  getActiveOrgId: () => null,
  getUser: () => null,
  setToken: vi.fn(async () => undefined),
  setUser: vi.fn(async () => undefined),
  setRefreshToken: vi.fn(async () => undefined),
  setActiveOrgId: vi.fn(async () => undefined),
  setLoggingOut: vi.fn(),
  clearAuth: vi.fn(async () => undefined),
  isLoggingOut: () => false,
}));
vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: { isOnline: true, subscribe: vi.fn(() => () => undefined) },
}));
vi.mock('../../services/biometrics', () => ({
  rotationUebernehmen: vi.fn(async () => undefined),
  istBiometrieAktiv: vi.fn(async () => false),
  mitBiometrieEntsperren: vi.fn(async () => ({
    status: 'ok', refreshToken: 'refresh-gesichert', user: { id: 42, type: 'konfi' }, gespeichertAm: Date.now(),
  })),
  gespeichertenTokenAuffrischen: vi.fn(async () => undefined),
  biometrieVergessen: vi.fn(async () => undefined),
}));
vi.mock('../../services/offlineCache', () => ({ offlineCache: { clearAll: vi.fn(async () => undefined) } }));
vi.mock('../../services/mediaCache', () => ({ clearMediaCache: vi.fn(async () => undefined) }));
vi.mock('../../services/writeQueue', () => ({
  writeQueue: { flush: vi.fn(async () => ({ succeeded: [], failed: [] })), clear: vi.fn(async () => undefined) },
}));
vi.mock('../../services/websocket', () => ({ disconnectWebSocket: vi.fn() }));

import axios from 'axios';
import api from '../../services/api';
import { geraeteKennung } from '../../services/geraeteKennung';
import { refreshAnfordern } from '../../services/refreshAnfrage';
import { loginWithAutoDetection, mitBiometrieAnmelden } from '../../services/auth';

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  istNativ = false;
  gespeichert = null;
  mockGetId.mockResolvedValue({ identifier: 'IOS-VENDOR-1' });
});

describe('geraeteKennung', () => {
  it('auf dem Geraet: die Kennung des Betriebssystems -- und die gespeicherte Kopie wird nachgezogen', async () => {
    istNativ = true;
    gespeichert = 'alte-kopie';
    expect(await geraeteKennung()).toBe('IOS-VENDOR-1');
    expect(gespeichert).toBe('IOS-VENDOR-1');
  });

  it('auf dem Geraet: eine Kopie aus einer Sicherung setzt sich NICHT durch', async () => {
    // Preferences samt Kennung vom alten Handy auf ein neues geholt: Das
    // neue Handy meldet seine eigene Kennung -- und nur die geht hinaus.
    istNativ = true;
    gespeichert = 'KENNUNG-DES-ALTEN-HANDYS';
    mockGetId.mockResolvedValue({ identifier: 'KENNUNG-DES-NEUEN-HANDYS' });
    expect(await geraeteKennung()).toBe('KENNUNG-DES-NEUEN-HANDYS');
  });

  it('auf dem Geraet ohne Kennung des Betriebssystems (iOS vor dem ersten Entsperren): die gespeicherte', async () => {
    istNativ = true;
    gespeichert = 'IOS-VENDOR-1';
    mockGetId.mockRejectedValue(new Error('Id not available'));
    expect(await geraeteKennung()).toBe('IOS-VENDOR-1');
    expect(mockSetDeviceId).not.toHaveBeenCalled();
  });

  it('im Browser: die gespeicherte, sonst einmal erzeugt und gespeichert', async () => {
    const erste = await geraeteKennung();
    expect(erste).toMatch(/^web_\d+_[a-z0-9]+$/);
    expect(gespeichert).toBe(erste);
    expect(await geraeteKennung()).toBe(erste);
    expect(mockSetDeviceId).toHaveBeenCalledTimes(1);
  });

  it('laesst sich eine neue Kennung nicht speichern, geht KEINE hinaus -- sonst hinge das Token an einem vergessenen Wert', async () => {
    mockSetDeviceId.mockRejectedValueOnce(new Error('Preferences kaputt'));
    expect(await geraeteKennung()).toBeNull();
  });
});

// Diese Faelle laufen als Web-Version (istNativ = false). Dort traegt jede
// Anfrage zusaetzlich die Zusage fuer Konten ohne Gemeinde
// (services/ohneGemeinde.ts, seit 03.10.2026; die Apps schicken sie nie,
// siehe ohneGemeindeZusage.test.ts).
const WEB = { kann_ohne_gemeinde: true };

describe('die Kennung geht mit', () => {
  it('bei jedem Refresh', async () => {
    gespeichert = 'geraet-1';
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: {} });
    await refreshAnfordern({ refresh_token: 'refresh-1' });
    expect(post.mock.calls[0][1]).toEqual({ refresh_token: 'refresh-1', device_id: 'geraet-1', ...WEB });
  });

  it('bei der Anmeldung per Biometrie', async () => {
    gespeichert = 'geraet-1';
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: { token: 't', refresh_token: 'r' } });
    expect(await mitBiometrieAnmelden()).toMatchObject({ status: 'ok' });
    expect(post.mock.calls[0][1]).toEqual({ refresh_token: 'refresh-gesichert', device_id: 'geraet-1', ...WEB });
  });

  it('bei der Anmeldung mit Passwort', async () => {
    gespeichert = 'geraet-1';
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { token: 't', refresh_token: 'r', user: { id: 1 } } });
    await loginWithAutoDetection('konfi1', 'Johannes7,47');
    expect(post).toHaveBeenCalledWith('/auth/login', { username: 'konfi1', password: 'Johannes7,47', device_id: 'geraet-1', ...WEB });
  });

  it('ohne ermittelbare Kennung wie bisher ohne device_id (das Token bleibt ungebunden)', async () => {
    mockSetDeviceId.mockRejectedValue(new Error('Preferences kaputt'));
    const login = vi.spyOn(api, 'post').mockResolvedValue({ data: { token: 't', refresh_token: 'r', user: { id: 1 } } });
    const refresh = vi.spyOn(axios, 'post').mockResolvedValue({ data: {} });

    await loginWithAutoDetection('konfi1', 'Johannes7,47');
    await refreshAnfordern({ refresh_token: 'refresh-1' });

    expect(login).toHaveBeenCalledWith('/auth/login', { username: 'konfi1', password: 'Johannes7,47', ...WEB });
    expect(refresh.mock.calls[0][1]).toEqual({ refresh_token: 'refresh-1', ...WEB });
  });

  // Bei der Registrierung mit Einladungscode: geprueft an der gerenderten
  // Seite, components/konfiRegistrierung.test.tsx (bis 30.09.2026 hier am
  // Quelltext).
});
