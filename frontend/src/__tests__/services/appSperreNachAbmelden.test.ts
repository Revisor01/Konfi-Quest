// Die App-Sperre überlebt das Abmelden -- als Ablauf geprüft (Audit Tests
// 26.09.2026, BF-02; bis 30.09.2026 prüfte appSperre.test.ts am Quelltext von
// tokenStore.ts und auth.ts, dass der Schlüssel dort nicht vorkommt).
//
// Bewusste Entscheidung (services/appSperre.ts): Die Wartezeit ist eine
// Aussage über das GERÄT ("dieses Handy soll sich sperren"), nicht über das
// Konto. Verschwände sie beim Abmelden, wäre die Sperre danach still aus, und
// wer sie eingeschaltet hat, wäre schlechter geschützt als er glaubt.
//
// Hier läuft das echte Abmelden (auth.logout mit tokenStore und Offline-Cache)
// gegen einen Gerätespeicher im Arbeitsspeicher; gestellt sind nur Server,
// Warteschlange, Socket, Medien-Cache und Biometrie.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const speicher = new Map<string, string>();
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: speicher.has(key) ? speicher.get(key)! : null }),
    set: async ({ key, value }: { key: string; value: string }) => { speicher.set(key, value); },
    remove: async ({ key }: { key: string }) => { speicher.delete(key); },
    keys: async () => ({ keys: [...speicher.keys()] }),
    clear: async () => { speicher.clear(); },
  },
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' } }));
vi.mock('@capacitor/device', () => ({ Device: { getId: vi.fn(async () => ({ identifier: 'geraet-1' })) } }));
vi.mock('../../services/api', () => ({ default: { post: vi.fn(async () => ({ data: {} })), delete: vi.fn(async () => ({ data: {} })), get: vi.fn() } }));
vi.mock('../../services/networkMonitor', () => ({ networkMonitor: { isOnline: false, subscribe: () => () => undefined } }));
vi.mock('../../services/writeQueue', () => ({ writeQueue: { flush: vi.fn(async () => ({ succeeded: [], failed: [] })), clear: vi.fn(async () => undefined) } }));
vi.mock('../../services/websocket', () => ({ disconnectWebSocket: vi.fn() }));
vi.mock('../../services/mediaCache', () => ({ clearMediaCache: vi.fn(async () => undefined) }));
const biometrieVergessen = vi.fn(async () => undefined);
vi.mock('../../services/biometrics', () => ({
  biometrieVergessen: () => biometrieVergessen(),
  mitBiometrieEntsperren: vi.fn(), gespeichertenTokenAuffrischen: vi.fn(), istBiometrieAktiv: vi.fn(async () => false),
  biometrieVerfuegbar: vi.fn(async () => ({ verfuegbar: false })), istAbbruch: () => false,
}));

import { logout } from '../../services/auth';
import { setToken, setRefreshToken, setUser } from '../../services/tokenStore';
import { offlineCache } from '../../services/offlineCache';
import { sperreLesen, sperreSpeichern } from '../../services/appSperre';

const angemeldet = async () => {
  await setToken('zugang-1');
  await setRefreshToken('auffrischen-1');
  await setUser({ id: 31, display_name: 'Mia', type: 'konfi' } as never);
  await offlineCache.set('konfi:dashboard', { punkte: 12 }, 60_000);
};

beforeEach(() => {
  speicher.clear();
  vi.clearAllMocks();
});

describe('Die App-Sperre überlebt das Abmelden', () => {
  it('die eingestellte Wartezeit steht nach dem Abmelden noch da', async () => {
    await angemeldet();
    await sperreSpeichern('5min');
    expect(await sperreLesen()).toBe('5min');

    await logout();

    expect(await sperreLesen()).toBe('5min');
  });

  it('... während die Anmeldung und der Stand des Kontos wirklich weg sind', async () => {
    // Gegenprobe: das Abmelden hat gelaufen und geräumt -- sonst bewiese der
    // Test oben nichts.
    await angemeldet();
    await sperreSpeichern('sofort');
    const vorher = [...speicher.keys()];
    expect(vorher.filter((k) => k.startsWith('cache:'))).toHaveLength(1);
    expect(vorher).toContain('konfi_token');

    await logout();

    expect(speicher.has('konfi_token')).toBe(false);
    expect(speicher.has('konfi_refresh_token')).toBe(false);
    expect(speicher.has('konfi_user')).toBe(false);
    expect([...speicher.keys()].filter((k) => k.startsWith('cache:'))).toEqual([]);
    expect(biometrieVergessen).toHaveBeenCalledTimes(1);
    expect(await sperreLesen()).toBe('sofort');
  });

  it('eine vor dem Update gespeicherte Einstellung wird weiter gelesen (der Schlüssel bleibt)', async () => {
    speicher.set('konfi_app_sperre_verzoegerung', '15min');
    expect(await sperreLesen()).toBe('15min');
    await sperreSpeichern('1min');
    expect(speicher.get('konfi_app_sperre_verzoegerung')).toBe('1min');
  });
});
