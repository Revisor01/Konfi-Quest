// Googles In-App-Updates auf Android (services/updateCheck.ts, Simon 09.10.2026).
//
// Unter der Mindestversion: Sofort-Update (Googles Vollbild). Nur eine
// neuere Store-Version: flexibles Update (Laden im Hintergrund, danach
// "Neustarten zum Aktualisieren"). Kann Google nicht, bleibt es beim
// bisherigen Hinweis mit Store-Link. iOS und der Browser rufen das Plugin nie.
//
// Das Plugin ist gemockt und verhaelt sich wie die Android-Seite von
// @capawesome/capacitor-app-update 8.1: getAppUpdateInfo liefert Verfuegbarkeit
// und erlaubte Wege, perform/start loesen mit einem Ergebniscode auf, der
// Ladefortschritt kommt als Ereignis onFlexibleUpdateStateChange.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const VERFUEGBAR = 2; // AppUpdateAvailability.UPDATE_AVAILABLE
const NICHT_VERFUEGBAR = 1;
const OK = 0; // AppUpdateResultCode
const ABGEBROCHEN = 1;
const GESCHEITERT = 2;
const GELADEN = 11; // FlexibleUpdateInstallStatus.DOWNLOADED
const LAEDT = 2;
const LADEN_GESCHEITERT = 5;

const halter = {
  nativ: true,
  online: true,
  plattform: 'android' as string,
  installierteVersion: '2.4.0',
  apiAntwort: {} as Record<string, unknown>,
  info: {} as Record<string, unknown>,
  infoFehler: null as Error | null,
  sofortCode: OK,
  flexibelCode: OK,
  /** Zustaende, die das Plugin nach dem Start des flexiblen Updates meldet. */
  ladeZustaende: [GELADEN] as number[],
};

const gespeichertePrefs = new Map<string, string>();
let zuhoerer: ((s: { installStatus: number }) => void) | null = null;

const plugin = {
  getAppUpdateInfo: vi.fn(async () => {
    if (halter.infoFehler) throw halter.infoFehler;
    return halter.info;
  }),
  performImmediateUpdate: vi.fn(async () => ({ code: halter.sofortCode })),
  startFlexibleUpdate: vi.fn(async () => {
    // Wie auf dem Geraet: Der Ladefortschritt kommt nach der Zustimmung.
    if (halter.flexibelCode === OK) {
      setTimeout(() => halter.ladeZustaende.forEach((s) => zuhoerer?.({ installStatus: s })), 0);
    }
    return { code: halter.flexibelCode };
  }),
  completeFlexibleUpdate: vi.fn(async () => undefined),
  openAppStore: vi.fn(async () => undefined),
  addListener: vi.fn(async (_name: string, fn: (s: { installStatus: number }) => void) => {
    zuhoerer = fn;
    return { remove: vi.fn(async () => { zuhoerer = null; }) };
  }),
};

vi.mock('@capawesome/capacitor-app-update', () => ({
  AppUpdate: plugin,
  AppUpdateAvailability: { UNKNOWN: 0, UPDATE_NOT_AVAILABLE: 1, UPDATE_AVAILABLE: 2, UPDATE_IN_PROGRESS: 3 },
  AppUpdateResultCode: { OK: 0, CANCELED: 1, FAILED: 2, NOT_AVAILABLE: 3, NOT_ALLOWED: 4, INFO_MISSING: 5 },
  FlexibleUpdateInstallStatus: {
    UNKNOWN: 0, PENDING: 1, DOWNLOADING: 2, INSTALLING: 3, INSTALLED: 4, FAILED: 5, CANCELED: 6, DOWNLOADED: 11,
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => halter.nativ,
    getPlatform: () => halter.plattform,
  },
}));

vi.mock('@capacitor/app', () => ({
  App: { getInfo: async () => ({ version: halter.installierteVersion }) },
}));

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: gespeichertePrefs.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => { gespeichertePrefs.set(key, value); },
  },
}));

vi.mock('../../services/api', () => ({
  default: { get: async () => ({ data: halter.apiAntwort }) },
}));

vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: { get isOnline() { return halter.online; } },
}));

const PLAY_URL = 'https://play.google.com/store/apps/details?id=de.godsapp.konfiquest';
const IOS_URL = 'https://apps.apple.com/de/app/konfi-quest/id6748016619';

function antwort(store: string, min: string | null = null) {
  return {
    ios: { version: store, url: IOS_URL, min_version: min },
    android: { version: store, url: PLAY_URL, min_version: min },
    wartung: { aktiv: false, text: null },
  };
}

const ladeModul = () => import('../../services/updateCheck');

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  gespeichertePrefs.clear();
  zuhoerer = null;
  halter.nativ = true;
  halter.online = true;
  halter.plattform = 'android';
  halter.installierteVersion = '2.4.0';
  halter.apiAntwort = antwort('2.5.0');
  halter.info = {
    updateAvailability: VERFUEGBAR, availableVersionCode: '139',
    immediateUpdateAllowed: true, flexibleUpdateAllowed: true, installStatus: 0,
  };
  halter.infoFehler = null;
  halter.sofortCode = OK;
  halter.flexibelCode = OK;
  halter.ladeZustaende = [LAEDT, GELADEN];
});

describe('Sofort-Update unter der Mindestversion', () => {
  it('startet Googles Vollbild und meldet "gestartet"', async () => {
    const { versucheSofortUpdate } = await ladeModul();
    expect(await versucheSofortUpdate()).toBe('gestartet');
    expect(plugin.getAppUpdateInfo).toHaveBeenCalledTimes(1);
    expect(plugin.performImmediateUpdate).toHaveBeenCalledTimes(1);
    expect(plugin.startFlexibleUpdate).not.toHaveBeenCalled();
  });

  it('Vollbild geschlossen: "abgelehnt"', async () => {
    halter.sofortCode = ABGEBROCHEN;
    const { versucheSofortUpdate } = await ladeModul();
    expect(await versucheSofortUpdate()).toBe('abgelehnt');
  });

  it('Google meldet einen Fehler: "nicht_moeglich"', async () => {
    halter.sofortCode = GESCHEITERT;
    const { versucheSofortUpdate } = await ladeModul();
    expect(await versucheSofortUpdate()).toBe('nicht_moeglich');
  });

  it('Plugin wirft (kein Play, Sideload, Emulator): "nicht_moeglich", ohne Exception', async () => {
    halter.infoFehler = new Error('GooglePlayServices are not available.');
    const { versucheSofortUpdate } = await ladeModul();
    expect(await versucheSofortUpdate()).toBe('nicht_moeglich');
    expect(plugin.performImmediateUpdate).not.toHaveBeenCalled();
  });

  it('Play kennt kein Update oder erlaubt den Sofort-Weg nicht: "nicht_moeglich", kein Start', async () => {
    halter.info = { updateAvailability: NICHT_VERFUEGBAR, immediateUpdateAllowed: false };
    const { versucheSofortUpdate } = await ladeModul();
    expect(await versucheSofortUpdate()).toBe('nicht_moeglich');

    vi.resetModules();
    halter.info = { updateAvailability: VERFUEGBAR, immediateUpdateAllowed: false };
    const zweites = await ladeModul();
    expect(await zweites.versucheSofortUpdate()).toBe('nicht_moeglich');
    expect(plugin.performImmediateUpdate).not.toHaveBeenCalled();
  });

  it('hoechstens einmal je App-Start', async () => {
    const { versucheSofortUpdate } = await ladeModul();
    await versucheSofortUpdate();
    expect(await versucheSofortUpdate()).toBe('gestartet');
    expect(plugin.performImmediateUpdate).toHaveBeenCalledTimes(1);
  });
});

describe('Flexibles Update bei neuerer Store-Version', () => {
  const BEREIT = { zustand: 'bereit', schluessel: 'play-139' };
  const NICHT = { zustand: 'nicht_moeglich', schluessel: null };

  it('laedt im Hintergrund und meldet "bereit", sobald Google "geladen" meldet', async () => {
    const { holeUpdateImHintergrund } = await ladeModul();
    expect(await holeUpdateImHintergrund()).toEqual(BEREIT);
    expect(plugin.addListener).toHaveBeenCalledWith('onFlexibleUpdateStateChange', expect.any(Function));
    expect(plugin.startFlexibleUpdate).toHaveBeenCalledTimes(1);
    expect(plugin.performImmediateUpdate).not.toHaveBeenCalled();
    // Der Zuhoerer ist danach wieder abgemeldet.
    expect(zuhoerer).toBeNull();
  });

  it('Google Play entscheidet: Server meldet keine neuere Version, Play bietet eine an -> "bereit"', async () => {
    // Die Store-Version des Servers kommt aus dem App Store; Play kennt den
    // Stand dieses Geraets (Testtrack, gestaffelte Freigabe).
    halter.apiAntwort = antwort('2.4.0');
    const { holeUpdateImHintergrund } = await ladeModul();
    expect(await holeUpdateImHintergrund()).toEqual(BEREIT);
  });

  it('schon in einem frueheren Start geladen: sofort "bereit", ohne neuen Ablauf', async () => {
    halter.info = { updateAvailability: NICHT_VERFUEGBAR, availableVersionCode: '139', installStatus: GELADEN };
    const { holeUpdateImHintergrund } = await ladeModul();
    expect(await holeUpdateImHintergrund()).toEqual(BEREIT);
    expect(plugin.startFlexibleUpdate).not.toHaveBeenCalled();
  });

  it('Googles Rueckfrage verneint: "abgelehnt" und fuer genau dieses Update gemerkt', async () => {
    halter.flexibelCode = ABGEBROCHEN;
    const { holeUpdateImHintergrund, istHinweisWeggeklickt } = await ladeModul();
    expect(await holeUpdateImHintergrund()).toEqual({ zustand: 'abgelehnt', schluessel: 'play-139' });
    expect(await istHinweisWeggeklickt('play-139')).toBe(true);
    expect(await istHinweisWeggeklickt('play-140')).toBe(false);
  });

  it('frueher verneint oder weggetippt: "weggeklickt", Google fragt nicht noch einmal', async () => {
    gespeichertePrefs.set('store_update_hinweis_weggeklickt_play-139', '1');
    const { holeUpdateImHintergrund } = await ladeModul();
    expect(await holeUpdateImHintergrund()).toEqual({ zustand: 'weggeklickt', schluessel: 'play-139' });
    expect(plugin.startFlexibleUpdate).not.toHaveBeenCalled();
  });

  it('ein neueres Update fragt wieder, auch wenn das vorige verneint wurde', async () => {
    gespeichertePrefs.set('store_update_hinweis_weggeklickt_play-138', '1');
    const { holeUpdateImHintergrund } = await ladeModul();
    expect(await holeUpdateImHintergrund()).toEqual(BEREIT);
  });

  it('Laden scheitert: "nicht_moeglich"', async () => {
    halter.ladeZustaende = [LAEDT, LADEN_GESCHEITERT];
    const { holeUpdateImHintergrund } = await ladeModul();
    expect(await holeUpdateImHintergrund()).toEqual(NICHT);
  });

  it('Plugin wirft (nicht aus Play installiert): "nicht_moeglich", ohne Exception', async () => {
    halter.infoFehler = new Error('Install Error(-10): The app is not owned by any user on this device.');
    const { holeUpdateImHintergrund } = await ladeModul();
    expect(await holeUpdateImHintergrund()).toEqual(NICHT);
    expect(plugin.startFlexibleUpdate).not.toHaveBeenCalled();
  });

  it('Play bietet nichts an oder erlaubt den flexiblen Weg nicht: "nicht_moeglich", kein Start', async () => {
    halter.info = { updateAvailability: NICHT_VERFUEGBAR, availableVersionCode: '0', installStatus: 0 };
    const { holeUpdateImHintergrund } = await ladeModul();
    expect(await holeUpdateImHintergrund()).toEqual(NICHT);

    vi.resetModules();
    halter.info = { updateAvailability: VERFUEGBAR, availableVersionCode: '139', flexibleUpdateAllowed: false, installStatus: 0 };
    const zweites = await ladeModul();
    expect(await zweites.holeUpdateImHintergrund()).toEqual(NICHT);
    expect(plugin.startFlexibleUpdate).not.toHaveBeenCalled();
  });

  it('unter der Mindestversion: kein flexibles Update (das Sofort-Update ist dran)', async () => {
    halter.apiAntwort = antwort('2.5.0', '2.5.0');
    const { holeUpdateImHintergrund } = await ladeModul();
    expect(await holeUpdateImHintergrund()).toEqual(NICHT);
    expect(plugin.getAppUpdateInfo).not.toHaveBeenCalled();
  });

  it('gleich der Mindestversion: flexibles Update wie sonst', async () => {
    halter.apiAntwort = antwort('2.5.0', '2.4.0');
    const { holeUpdateImHintergrund } = await ladeModul();
    expect(await holeUpdateImHintergrund()).toEqual(BEREIT);
  });

  it('offline: kein Plugin-Aufruf', async () => {
    halter.online = false;
    const { holeUpdateImHintergrund } = await ladeModul();
    expect(await holeUpdateImHintergrund()).toEqual(NICHT);
    expect(plugin.getAppUpdateInfo).not.toHaveBeenCalled();
  });

  it('hoechstens einmal je App-Start', async () => {
    const { holeUpdateImHintergrund } = await ladeModul();
    await holeUpdateImHintergrund();
    expect(await holeUpdateImHintergrund()).toEqual(BEREIT);
    expect(plugin.getAppUpdateInfo).toHaveBeenCalledTimes(1);
    expect(plugin.startFlexibleUpdate).toHaveBeenCalledTimes(1);
  });

  it('installiereGeladenesUpdate: installiert; scheitert das, oeffnet es Google Play', async () => {
    const { installiereGeladenesUpdate } = await ladeModul();
    expect(await installiereGeladenesUpdate()).toBe(true);
    expect(plugin.completeFlexibleUpdate).toHaveBeenCalledTimes(1);
    expect(plugin.openAppStore).not.toHaveBeenCalled();

    plugin.completeFlexibleUpdate.mockRejectedValueOnce(new Error('kaputt'));
    expect(await installiereGeladenesUpdate()).toBe(true);
    expect(plugin.openAppStore).toHaveBeenCalledTimes(1);

    plugin.completeFlexibleUpdate.mockRejectedValueOnce(new Error('kaputt'));
    plugin.openAppStore.mockRejectedValueOnce(new Error('auch kaputt'));
    expect(await installiereGeladenesUpdate()).toBe(false);
  });
});

describe('iOS und Browser: das Plugin wird nie gerufen', () => {
  for (const [name, nativ, plattform] of [
    ['iOS', true, 'ios'],
    ['Browser', false, 'web'],
    ['Browser, der sich als Android meldet', false, 'android'],
  ] as const) {
    it(`${name}: beide Wege "nicht_moeglich", kein Plugin-Aufruf`, async () => {
      halter.nativ = nativ;
      halter.plattform = plattform;
      halter.apiAntwort = antwort('2.5.0', '2.5.0');
      const { versucheSofortUpdate, holeUpdateImHintergrund, pruefeStoreUpdate } = await ladeModul();
      expect(await versucheSofortUpdate()).toBe('nicht_moeglich');
      expect(await holeUpdateImHintergrund()).toEqual({ zustand: 'nicht_moeglich', schluessel: null });
      await pruefeStoreUpdate();
      expect(plugin.getAppUpdateInfo).not.toHaveBeenCalled();
      expect(plugin.performImmediateUpdate).not.toHaveBeenCalled();
      expect(plugin.startFlexibleUpdate).not.toHaveBeenCalled();
      expect(plugin.addListener).not.toHaveBeenCalled();
    });
  }
});
