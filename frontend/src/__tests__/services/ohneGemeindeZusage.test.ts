// Konten ohne Gemeinde (Support-Konten) arbeiten nur im Browser (Simon,
// 03.10.2026; docs/planung/web-version.md, Punkt 13). Der Server meldet ein
// solches Konto nur an, wenn Anmeldung oder Refresh `kann_ohne_gemeinde:
// true` tragen (backend/routes/auth.js; Test
// backend/tests/routes/kontoOhneGemeindeAnmeldung.test.js).
//
// Die Zusage schickt allein die Web-Version -- dieselbe Codebasis wie die
// Apps, unterschieden ueber Capacitor.isNativePlatform(). Schickte eine App
// sie mit, liesse sich ein Support-Konto auf dem Telefon anmelden und landete
// in einer Ansicht, die dafuer nicht gebaut ist.

import { describe, it, expect, beforeEach, vi } from 'vitest';

let plattform: 'web' | 'ios' | 'android' = 'web';
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => plattform !== 'web',
    getPlatform: () => plattform,
  },
}));
vi.mock('@capacitor/device', () => ({ Device: { getId: vi.fn(async () => ({ identifier: 'GERAET-1' })) } }));
vi.mock('../../services/tokenStore', () => ({
  getDeviceId: () => 'GERAET-1',
  setDeviceId: vi.fn(async () => undefined),
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
    status: 'ok', refreshToken: 'refresh-gesichert', user: { id: 42, type: 'admin' }, gespeichertAm: Date.now(),
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
import { ohneGemeindeZusage } from '../../services/ohneGemeinde';
import { refreshAnfordern } from '../../services/refreshAnfrage';
import { loginWithAutoDetection, mitBiometrieAnmelden } from '../../services/auth';

beforeEach(() => {
  vi.restoreAllMocks();
  plattform = 'web';
});

const anmeldeKoerper = async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { token: 't', refresh_token: 'r', user: { id: 1 } } });
  await loginWithAutoDetection('support1', 'Support-Passwort1!');
  return post.mock.calls[0][1] as Record<string, unknown>;
};
const refreshKoerper = async () => {
  const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: {} });
  await refreshAnfordern({ refresh_token: 'refresh-1' });
  return post.mock.calls[0][1] as Record<string, unknown>;
};

describe('Web-Version: die Zusage geht mit', () => {
  it('ohneGemeindeZusage liefert das Feld', () => {
    expect(ohneGemeindeZusage()).toEqual({ kann_ohne_gemeinde: true });
  });

  it('bei der Anmeldung mit Passwort', async () => {
    expect(await anmeldeKoerper()).toEqual({
      username: 'support1', password: 'Support-Passwort1!', device_id: 'GERAET-1', kann_ohne_gemeinde: true,
    });
  });

  it('bei jedem Refresh -- sonst endete die Sitzung eines Support-Kontos nach 15 Minuten', async () => {
    expect(await refreshKoerper()).toEqual({ refresh_token: 'refresh-1', device_id: 'GERAET-1', kann_ohne_gemeinde: true });
  });
});

describe.each(['ios', 'android'] as const)('App (%s): keine Zusage', (geraet) => {
  beforeEach(() => { plattform = geraet; });

  it('ohneGemeindeZusage liefert nichts', () => {
    expect(ohneGemeindeZusage()).toEqual({});
  });

  it('die Anmeldung mit Passwort traegt kein kann_ohne_gemeinde', async () => {
    expect(await anmeldeKoerper()).toEqual({ username: 'support1', password: 'Support-Passwort1!', device_id: 'GERAET-1' });
  });

  it('der Refresh traegt kein kann_ohne_gemeinde', async () => {
    expect(await refreshKoerper()).toEqual({ refresh_token: 'refresh-1', device_id: 'GERAET-1' });
  });

  it('die Anmeldung per Biometrie traegt kein kann_ohne_gemeinde', async () => {
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: { token: 't', refresh_token: 'r' } });
    expect(await mitBiometrieAnmelden()).toMatchObject({ status: 'ok' });
    expect(post.mock.calls[0][1]).toEqual({ refresh_token: 'refresh-gesichert', device_id: 'GERAET-1' });
  });
});
