import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Biometrische Anmeldung: nach der Rotation kein Klartext (Audit Grundgeruest
// BF-06).
//
// Wer "Anmelden mit Face ID" einschaltet, dem verspricht biometrics.ts
// (Sicherheitsabwaegung a): Der 90-Tage-Refresh-Token liegt dann NUR noch im
// biometrie-geschuetzten Speicher, nie zusaetzlich im Klartext. Beim
// Einschalten stimmte das. Der Refresh-Pfad schrieb den rotierten Token aber
// ohne Ruecksicht auf den Schalter wieder in die Preferences -- spaetestens
// eine Viertelstunde nach dem Einschalten lag die Klartext-Kopie wieder da,
// und die App startete ohne jede Abfrage.
//
// Hier laufen die ECHTEN Module tokenStore, biometrics und api (bzw. auth);
// gemockt sind nur die Plugins (Preferences und sicherer Speicher als Maps)
// und die Antwort des Servers.
// ---------------------------------------------------------------------------

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' },
}));

const prefs = new Map<string, string>();
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: prefs.get(key) ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => { prefs.set(key, value); }),
    remove: vi.fn(async ({ key }: { key: string }) => { prefs.delete(key); }),
  },
}));

const sicher = new Map<string, string>();
vi.mock('@capgo/capacitor-native-biometric', () => ({
  NativeBiometric: {
    isAvailable: vi.fn(async () => ({ isAvailable: true, biometryType: 2 })),
    setData: vi.fn(async ({ key, value }: { key: string; value: string }) => { sicher.set(key, value); }),
    getSecureData: vi.fn(async ({ key }: { key: string }) => {
      if (!sicher.has(key)) throw Object.assign(new Error('nichts'), { code: 21 });
      return { value: sicher.get(key)! };
    }),
    deleteData: vi.fn(async ({ key }: { key: string }) => { sicher.delete(key); }),
  },
  AccessControl: { NONE: 0, BIOMETRY_CURRENT_SET: 1, BIOMETRY_ANY: 2 },
  BiometryType: { NONE: 0, TOUCH_ID: 1, FACE_ID: 2, FINGERPRINT: 3, FACE_AUTHENTICATION: 4 },
  BiometricAuthError: {
    AUTHENTICATION_FAILED: 10, APP_CANCEL: 11, SYSTEM_CANCEL: 15, USER_CANCEL: 16,
    USER_FALLBACK: 17, NO_PROTECTED_CREDENTIALS_FOUND: 21,
  },
}));

vi.mock('@capacitor/device', () => ({
  Device: { getId: vi.fn(async () => ({ identifier: 'geraet-1' })) },
}));
vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: { isOnline: true, subscribe: vi.fn(() => () => undefined) },
}));
vi.mock('../../services/offlineCache', () => ({ offlineCache: { clearAll: vi.fn(async () => undefined) } }));
vi.mock('../../services/mediaCache', () => ({ clearMediaCache: vi.fn(async () => undefined) }));
vi.mock('../../services/writeQueue', () => ({
  writeQueue: { flush: vi.fn(async () => ({ succeeded: [], failed: [] })), clear: vi.fn(async () => undefined) },
}));
vi.mock('../../services/websocket', () => ({ disconnectWebSocket: vi.fn() }));

const KLARTEXT = 'konfi_refresh_token';
const SICHERER_SCHLUESSEL = 'konfi_quest_biometrie_sitzung';
const nutzer = { id: 42, type: 'konfi' as const, display_name: 'Emilia' };

// Base64url-JWT, das in `sekunden` Sekunden ablaeuft (negativ: abgelaufen).
const jwt = (sekunden: number): string => {
  const nutzlast = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + sekunden }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `kopf.${nutzlast}.signatur`;
};

const gesicherterToken = (): string | undefined => {
  const roh = sicher.get(SICHERER_SCHLUESSEL);
  return roh ? (JSON.parse(roh) as { refreshToken: string }).refreshToken : undefined;
};

/** Angemeldet mit abgelaufenem Zugangs-Token; Schalter wahlweise an. */
async function anmelden(schalterAn: boolean) {
  const tokenStore = await import('../../services/tokenStore');
  await tokenStore.setToken(jwt(-60));
  await tokenStore.setRefreshToken('refresh-alt');
  await tokenStore.setUser(nutzer as never);
  if (schalterAn) {
    const { biometrieAktivieren } = await import('../../services/biometrics');
    expect(await biometrieAktivieren()).toBe(true);
    // Voraussetzung: beim Einschalten ist die Klartext-Kopie weg.
    expect(prefs.get(KLARTEXT)).toBeUndefined();
  }
  return tokenStore;
}

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  prefs.clear();
  sicher.clear();
});

describe('Refresh-Rotation bei eingeschalteter biometrischer Anmeldung', () => {
  it('verboten: nach der Rotation liegt KEIN Refresh-Token im Klartext in den Preferences', async () => {
    const tokenStore = await anmelden(true);
    const axios = (await import('axios')).default;
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { token: jwt(900), refresh_token: 'refresh-neu' } });

    const { ensureFreshToken } = await import('../../services/api');
    await ensureFreshToken();

    expect(prefs.get(KLARTEXT)).toBeUndefined();
    // Die Sitzung laeuft weiter: im Arbeitsspeicher und im sicheren Speicher.
    expect(tokenStore.getRefreshToken()).toBe('refresh-neu');
    expect(gesicherterToken()).toBe('refresh-neu');
  });

  it('verboten: auch ueber mehrere Rotationen kehrt der Klartext nicht zurueck', async () => {
    await anmelden(true);
    const axios = (await import('axios')).default;
    const post = vi.spyOn(axios, 'post')
      .mockResolvedValueOnce({ data: { token: jwt(-60), refresh_token: 'refresh-2' } })
      .mockResolvedValueOnce({ data: { token: jwt(900), refresh_token: 'refresh-3' } });

    const { ensureFreshToken } = await import('../../services/api');
    await ensureFreshToken();
    await ensureFreshToken();

    expect(post).toHaveBeenCalledTimes(2);
    expect(prefs.get(KLARTEXT)).toBeUndefined();
    expect(gesicherterToken()).toBe('refresh-3');
  });

  it('erlaubt: ohne Schalter liegt der rotierte Token wie bisher in den Preferences', async () => {
    const tokenStore = await anmelden(false);
    const axios = (await import('axios')).default;
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { token: jwt(900), refresh_token: 'refresh-neu' } });

    const { ensureFreshToken } = await import('../../services/api');
    await ensureFreshToken();

    expect(prefs.get(KLARTEXT)).toBe('refresh-neu');
    expect(tokenStore.getRefreshToken()).toBe('refresh-neu');
    expect(gesicherterToken()).toBeUndefined();
  });
});

describe('Anmeldung per Biometrie', () => {
  it('verboten: der eingeloeste und rotierte Token landet nicht im Klartext', async () => {
    const tokenStore = await anmelden(true);
    await tokenStore.clearAuth();
    const axios = (await import('axios')).default;
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { token: jwt(900), refresh_token: 'refresh-nach-face-id' } });

    const { mitBiometrieAnmelden } = await import('../../services/auth');
    const ergebnis = await mitBiometrieAnmelden();

    expect(ergebnis).toEqual({ status: 'ok', user: nutzer });
    expect(prefs.get(KLARTEXT)).toBeUndefined();
    expect(tokenStore.getRefreshToken()).toBe('refresh-nach-face-id');
    expect(gesicherterToken()).toBe('refresh-nach-face-id');
  });
});

describe('Schalter wieder ausschalten', () => {
  it('erlaubt: die laufende Sitzung bleibt -- der Token kehrt in die normale Ablage zurueck', async () => {
    const tokenStore = await anmelden(true);
    const axios = (await import('axios')).default;
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { token: jwt(900), refresh_token: 'refresh-neu' } });
    const { ensureFreshToken } = await import('../../services/api');
    await ensureFreshToken();
    expect(prefs.get(KLARTEXT)).toBeUndefined();

    const { biometrieAusschalten, istBiometrieAktiv } = await import('../../services/biometrics');
    await biometrieAusschalten();

    expect(await istBiometrieAktiv()).toBe(false);
    expect(gesicherterToken()).toBeUndefined();
    // Ohne diese Rueckkehr waere die Sitzung beim naechsten Kaltstart weg.
    expect(prefs.get(KLARTEXT)).toBe('refresh-neu');
    expect(tokenStore.getRefreshToken()).toBe('refresh-neu');
  });

  it('nach dem Abmelden bringt Ausschalten keinen Token zurueck', async () => {
    const tokenStore = await anmelden(true);
    await tokenStore.clearAuth();

    const { biometrieAusschalten } = await import('../../services/biometrics');
    await biometrieAusschalten();

    expect(prefs.get(KLARTEXT)).toBeUndefined();
    expect(tokenStore.getRefreshToken()).toBeNull();
  });
});
