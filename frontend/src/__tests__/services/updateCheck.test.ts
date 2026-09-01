// Tests fuer services/updateCheck.ts — die Entscheidungslogik des
// Store-Update-Hinweises.
//
// Alle Capacitor-Module und die API sind gemockt (Muster wie
// networkMonitor.test.ts); pro Test wird per vi.resetModules ein frisches
// Modul geladen, weil updateCheck sein Ergebnis pro App-Start memoisiert.
// Geprueft werden die Zusagen aus dem Modulkopf: nur nativ, nur online,
// still bei Fehlern, Hinweis nur bei ECHT neuerer Version, Wegklicken
// haftet pro Version.
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Veraenderbare Halter, damit einzelne Tests Plattform/Netz/Antwort umstellen.
const halter = {
  nativ: true,
  plattform: 'ios' as string,
  online: true,
  installierteVersion: '2.1.1',
  apiAntwort: {} as Record<string, unknown>,
  apiFehler: null as Error | null,
};

const mockApiGet = vi.fn(async (_pfad: string) => {
  if (halter.apiFehler) throw halter.apiFehler;
  return { data: halter.apiAntwort };
});

const gespeichertePrefs = new Map<string, string>();

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => halter.nativ,
    getPlatform: () => halter.plattform,
  },
}));

vi.mock('@capacitor/app', () => ({
  App: {
    getInfo: async () => ({ version: halter.installierteVersion }),
  },
}));

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: gespeichertePrefs.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => { gespeichertePrefs.set(key, value); },
  },
}));

vi.mock('../../services/api', () => ({
  default: { get: mockApiGet },
}));

vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: {
    get isOnline() { return halter.online; },
  },
}));

function standardAntwort(version: string) {
  return {
    ios: { version, url: 'https://apps.apple.com/de/app/konfi-quest/id6748016619' },
    android: { version, url: 'https://play.google.com/store/apps/details?id=de.godsapp.konfiquest' },
  };
}

async function ladeModul() {
  return import('../../services/updateCheck');
}

describe('pruefeStoreUpdate', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    gespeichertePrefs.clear();
    halter.nativ = true;
    halter.plattform = 'ios';
    halter.online = true;
    halter.installierteVersion = '2.1.1';
    halter.apiAntwort = standardAntwort('2.2.0');
    halter.apiFehler = null;
  });

  it('meldet die neuere Store-Version samt iOS-URL', async () => {
    const { pruefeStoreUpdate } = await ladeModul();
    const ergebnis = await pruefeStoreUpdate();
    expect(ergebnis).toEqual({
      version: '2.2.0',
      url: 'https://apps.apple.com/de/app/konfi-quest/id6748016619',
    });
    expect(mockApiGet).toHaveBeenCalledWith('/app-version');
  });

  it('nimmt auf Android den android-Eintrag (Play-Store-URL)', async () => {
    halter.plattform = 'android';
    const { pruefeStoreUpdate } = await ladeModul();
    const ergebnis = await pruefeStoreUpdate();
    expect(ergebnis).toEqual({
      version: '2.2.0',
      url: 'https://play.google.com/store/apps/details?id=de.godsapp.konfiquest',
    });
  });

  it('meldet null, wenn die installierte Version aktuell ist', async () => {
    halter.apiAntwort = standardAntwort('2.1.1');
    const { pruefeStoreUpdate } = await ladeModul();
    expect(await pruefeStoreUpdate()).toBeNull();
  });

  it('meldet null, wenn der Store aelter ist als die App (TestFlight-Build)', async () => {
    halter.installierteVersion = '2.3.0';
    const { pruefeStoreUpdate } = await ladeModul();
    expect(await pruefeStoreUpdate()).toBeNull();
  });

  it('im Browser: null, ohne die API zu rufen', async () => {
    halter.nativ = false;
    const { pruefeStoreUpdate } = await ladeModul();
    expect(await pruefeStoreUpdate()).toBeNull();
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('offline: null, ohne die API zu rufen', async () => {
    halter.online = false;
    const { pruefeStoreUpdate } = await ladeModul();
    expect(await pruefeStoreUpdate()).toBeNull();
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('API-Fehler: null statt Exception', async () => {
    halter.apiFehler = new Error('Server down');
    const { pruefeStoreUpdate } = await ladeModul();
    expect(await pruefeStoreUpdate()).toBeNull();
  });

  it('version=null vom Server (Store-Lookup down): null', async () => {
    halter.apiAntwort = {
      ios: { version: null, url: 'https://apps.apple.com/de/app/konfi-quest/id6748016619' },
      android: { version: null, url: 'https://play.google.com/store/apps/details?id=de.godsapp.konfiquest' },
    };
    const { pruefeStoreUpdate } = await ladeModul();
    expect(await pruefeStoreUpdate()).toBeNull();
  });

  it('fragt nur EINMAL pro App-Start an (Memo)', async () => {
    const { pruefeStoreUpdate } = await ladeModul();
    const erstes = await pruefeStoreUpdate();
    const zweites = await pruefeStoreUpdate();
    expect(mockApiGet).toHaveBeenCalledTimes(1);
    expect(zweites).toEqual(erstes);
  });
});

describe('Wegklicken haftet pro Version', () => {
  beforeEach(() => {
    vi.resetModules();
    gespeichertePrefs.clear();
  });

  it('vor dem Wegklicken: nicht weggeklickt', async () => {
    const { istHinweisWeggeklickt } = await ladeModul();
    expect(await istHinweisWeggeklickt('2.2.0')).toBe(false);
  });

  it('nach dem Wegklicken: genau diese Version bleibt weg, die naechste nicht', async () => {
    const { istHinweisWeggeklickt, merkeHinweisWeggeklickt } = await ladeModul();
    await merkeHinweisWeggeklickt('2.2.0');
    expect(await istHinweisWeggeklickt('2.2.0')).toBe(true);
    expect(await istHinweisWeggeklickt('2.3.0')).toBe(false);
  });
});
