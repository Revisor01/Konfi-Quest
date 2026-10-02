// Antippen einer Push-Mitteilung: Das Ziel geht ueber pushZielMelden an den
// Router, die Seite wird NICHT neu geladen -- am echten AppProvider geprueft
// (Audit Tests 26.09.2026, BF-02). Bis hierher sicherte das ein Quelltext-
// Test ("AppContext enthaelt kein window.location.href =").
//
// Hintergrund (Befund aus dem Gerätetest 23.09.2026, Android): Der Push-Handler setzte
// nach 100 ms window.location.href -- ein harter Reload, der die gerade
// hochfahrende App abraeumte ("oeffnet sich ganz kurz und stuerzt ab").
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' },
  registerPlugin: () => ({ forceAPNSRegistration: vi.fn(), forceTokenRetrieval: vi.fn() }),
}));
vi.mock('@capacitor/device', () => ({ Device: { getId: vi.fn().mockResolvedValue({ identifier: 'geraet-1' }) } }));
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
    fireRestoredResult: vi.fn(),
    getInfo: vi.fn().mockResolvedValue({ version: '2.3.0', build: '117' }),
  },
}));
type Lauscher = (daten: unknown) => void;
const pushLauscher = new Map<string, Lauscher>();
vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    checkPermissions: vi.fn().mockResolvedValue({ receive: 'granted' }),
    requestPermissions: vi.fn().mockResolvedValue({ receive: 'granted' }),
    register: vi.fn().mockResolvedValue(undefined),
    addListener: (ereignis: string, fn: Lauscher) => { pushLauscher.set(ereignis, fn); return Promise.resolve({ remove: vi.fn() }); },
    removeAllListeners: vi.fn().mockResolvedValue(undefined),
    createChannel: vi.fn().mockResolvedValue(undefined),
    removeDeliveredNotifications: vi.fn().mockResolvedValue(undefined),
    getDeliveredNotifications: vi.fn().mockResolvedValue({ notifications: [] }),
  },
}));
vi.mock('@capacitor-firebase/messaging', () => ({ FirebaseMessaging: { getToken: vi.fn(async () => ({ token: null })) } }));
vi.mock('@capawesome/capacitor-background-task', () => ({ BackgroundTask: { beforeExit: vi.fn(), finish: vi.fn() } }));
vi.mock('../../services/tokenStore', () => ({
  getUser: () => ({ id: 7, type: 'konfi', organization_id: 1 }),
  getDeviceId: () => 'geraet-1',
  setDeviceId: vi.fn().mockResolvedValue(undefined),
  getPushTokenTimestamp: () => 0,
  setPushTokenTimestamp: vi.fn().mockResolvedValue(undefined),
  getToken: vi.fn().mockReturnValue(null),
  getRefreshToken: vi.fn().mockReturnValue(null),
  getActiveOrgId: vi.fn().mockReturnValue(null),
  setActiveOrgId: vi.fn(),
  setUser: vi.fn(),
  setToken: vi.fn(),
  setRefreshToken: vi.fn(),
  clearAuth: vi.fn(),
}));
vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: { get isOnline() { return true; }, subscribe: vi.fn(() => () => {}), init: vi.fn() },
}));
vi.mock('../../services/writeQueue', () => ({
  writeQueue: {
    flush: vi.fn().mockResolvedValue({ succeeded: [], failed: [] }),
    flushTextOnly: vi.fn().mockResolvedValue({ succeeded: [], failed: [] }),
    clear: vi.fn().mockResolvedValue(undefined),
    getAll: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock('../../services/offlineCache', () => ({
  offlineCache: {
    get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(undefined),
    isStale: vi.fn().mockReturnValue(false), invalidateAll: vi.fn().mockResolvedValue(undefined), clearAll: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('../../services/auth', () => ({ logout: vi.fn().mockResolvedValue(undefined), clearAuth: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../services/api', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: {} }),
    get: vi.fn().mockResolvedValue({ data: {} }),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));
const entferneZugestellte = vi.fn();
const nachholen = vi.fn();
vi.mock('../../services/notifications', async () => {
  const echt = await vi.importActual<Record<string, unknown>>('../../services/notifications');
  return {
    ...echt,
    removeDeliveredById: (id: unknown) => entferneZugestellte(id),
    aufraeumenNachholen: () => nachholen(),
  };
});

import { AppProvider, useApp } from '../../contexts/AppContext';
import { PUSH_ZIEL_EVENT, pushZielAbholen } from '../../utils/pushNavigation';
import type { BaseUser } from '../../types/user';

const KONFI = { id: 7, type: 'konfi', display_name: 'Kim', organization_id: 1 } as BaseUser;
const Anmelden: React.FC = () => {
  const ctx = useApp();
  React.useEffect(() => { if (!ctx.user) ctx.setUser(KONFI); }, [ctx]);
  return null;
};

const ziele: string[] = [];
const merkeZiel = (e: Event) => { ziele.push((e as CustomEvent<{ ziel: string }>).detail.ziel); };
const empfangen = vi.fn();

beforeEach(() => {
  pushLauscher.clear();
  ziele.length = 0;
  pushZielAbholen();
  vi.clearAllMocks();
  window.addEventListener(PUSH_ZIEL_EVENT, merkeZiel);
  window.addEventListener('push:received', empfangen);
});
afterEach(() => {
  window.removeEventListener(PUSH_ZIEL_EVENT, merkeZiel);
  window.removeEventListener('push:received', empfangen);
});

async function tippeAuf(data: Record<string, unknown>) {
  await act(async () => { render(<AppProvider><Anmelden /></AppProvider>); });
  await vi.waitFor(() => expect(pushLauscher.has('pushNotificationActionPerformed')).toBe(true));
  const adresseVorher = window.location.href;
  await act(async () => {
    pushLauscher.get('pushNotificationActionPerformed')!({ notification: { id: 'n-1', data } });
  });
  await vi.waitFor(() => expect(ziele.length).toBe(1));
  return adresseVorher;
}

describe('Push antippen', () => {
  it('ein Chat-Push fuehrt in den Raum -- ueber den Router, ohne die Seite neu zu laden', async () => {
    const vorher = await tippeAuf({ type: 'chat', roomId: 5 });
    expect(ziele).toEqual(['/konfi/chat/room/5']);
    expect(window.location.href).toBe(vorher);
  });

  it('das Ziel liegt auch fuer einen spaeter montierten Router bereit (einmal)', async () => {
    await tippeAuf({ type: 'badge_earned' });
    expect(pushZielAbholen()).toEqual({ ziel: '/konfi/badges', herkunft: 'push' });
    expect(pushZielAbholen()).toBe(null);
  });

  it('frischt die Zaehler auf und raeumt die angetippte Mitteilung weg', async () => {
    await tippeAuf({ type: 'activity_request_decision' });
    expect(ziele).toEqual(['/konfi/requests']);
    expect(empfangen).toHaveBeenCalledTimes(1);
    expect(entferneZugestellte).toHaveBeenCalledWith('n-1');
  });
});

// Tester-Rueckmeldung Build 130/236 (30.09.2026): Die Mitteilungen eines
// gelesenen Chats blieben liegen. Auf dem iPhone verweigert das Plugin das
// Aufraeumen, bis die Registrierung da ist; ein vorher gelesener Chat wird
// deshalb nachgeholt (services/notifications.ts, aufraeumenNachholen).
describe('Aufraeumen nach der Registrierung nachholen', () => {
  async function angemeldet() {
    await act(async () => { render(<AppProvider><Anmelden /></AppProvider>); });
    await vi.waitFor(() => expect(pushLauscher.has('registration')).toBe(true));
  }

  it('holt nach, sobald der Token da ist', async () => {
    await angemeldet();
    expect(nachholen).not.toHaveBeenCalled();
    await act(async () => { pushLauscher.get('registration')!({ value: 'token-1' }); });
    expect(nachholen).toHaveBeenCalledTimes(1);
  });

  it('holt auch nach, wenn die Registrierung scheitert -- auch das hebt die Sperre auf', async () => {
    await angemeldet();
    await act(async () => { pushLauscher.get('registrationError')!({ error: 'kein APNs' }); });
    expect(nachholen).toHaveBeenCalledTimes(1);
  });
});
