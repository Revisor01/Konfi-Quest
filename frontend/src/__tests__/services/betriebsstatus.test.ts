// Tests fuer services/betriebsstatus.ts — Mindestversion und Wartungshinweis
// aus GET /api/app-version (Feature-Empfehlung E-05, Entscheidung 27.09.2026).
//
// Alle Capacitor-Module und die API sind gemockt (Muster wie
// updateCheck.test.ts). Pro Test wird per vi.resetModules ein frisches Modul
// geladen, weil der Stand auf Modulebene liegt.
//
// Geprueft werden die Zusagen aus dem Modulkopf:
//   - gesperrt wird nur nativ, nur mit Antwort des Servers und nur, wenn die
//     installierte Version ECHT unter der Mindestversion der Plattform liegt
//     (semantisch verglichen: 2.10.0 > 2.9.0);
//   - der Wartungshinweis gilt ueberall, auch im Browser;
//   - geprueft wird beim Start und bei der Rueckkehr in die App, nicht oefter;
//   - eine gescheiterte Pruefung aendert nichts am Stand.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const halter = {
  nativ: true,
  plattform: 'ios' as string,
  online: true,
  installierteVersion: '2.3.0',
  apiAntwort: {} as unknown,
  apiFehler: null as Error | null,
  getInfoAufrufe: 0,
};

const mockApiGet = vi.fn(async (_pfad: string) => {
  if (halter.apiFehler) throw halter.apiFehler;
  return { data: halter.apiAntwort };
});

// Der zuletzt angemeldete appStateChange-Zuhoerer — so laesst sich die
// Rueckkehr in die App im Test ausloesen.
let appStateZuhoerer: ((zustand: { isActive: boolean }) => void) | null = null;
const mockEntfernen = vi.fn(async () => undefined);

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => halter.nativ,
    getPlatform: () => halter.plattform,
  },
}));

vi.mock('@capacitor/app', () => ({
  App: {
    getInfo: async () => {
      halter.getInfoAufrufe++;
      return { version: halter.installierteVersion };
    },
    addListener: async (name: string, fn: (zustand: { isActive: boolean }) => void) => {
      if (name === 'appStateChange') appStateZuhoerer = fn;
      return { remove: mockEntfernen };
    },
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

const IOS_URL = 'https://apps.apple.com/de/app/konfi-quest/id6748016619';
const PLAY_URL = 'https://play.google.com/store/apps/details?id=de.godsapp.konfiquest';

function antwort({
  ios = null as string | null,
  android = null as string | null,
  wartung = null as string | null,
} = {}) {
  return {
    ios: { version: '2.3.0', url: IOS_URL, min_version: ios },
    android: { version: '2.3.0', url: PLAY_URL, min_version: android },
    wartung: wartung === null ? { aktiv: false, text: null } : { aktiv: true, text: wartung },
  };
}

async function ladeModul() {
  return import('../../services/betriebsstatus');
}

/** Wartet, bis angestossene Pruefungen durch sind (Mikrotasks). */
const durchlaufen = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  halter.nativ = true;
  halter.plattform = 'ios';
  halter.online = true;
  halter.installierteVersion = '2.3.0';
  halter.apiAntwort = antwort();
  halter.apiFehler = null;
  halter.getInfoAufrufe = 0;
  appStateZuhoerer = null;
});

describe('Mindestversion', () => {
  it('unter der Mindestversion: Sperre mit der Store-Seite der Plattform', async () => {
    halter.installierteVersion = '2.2.0';
    halter.apiAntwort = antwort({ ios: '2.3.0' });
    const m = await ladeModul();
    await m.pruefeBetriebsstatus();
    expect(m.holeBetriebsstatus()).toEqual({ aktualisierenUrl: IOS_URL, wartungstext: null });
    expect(mockApiGet).toHaveBeenCalledWith('/app-version');
  });

  it('auf Android zaehlen Mindestversion und Store-Seite von android', async () => {
    halter.plattform = 'android';
    halter.installierteVersion = '2.2.0';
    // iOS gesperrt, Android nicht -> Android-Geraet bleibt frei ...
    halter.apiAntwort = antwort({ ios: '2.3.0', android: null });
    let m = await ladeModul();
    await m.pruefeBetriebsstatus();
    expect(m.holeBetriebsstatus().aktualisierenUrl).toBeNull();

    // ... und umgekehrt: Android gesperrt -> Play-Store-Seite.
    vi.resetModules();
    halter.apiAntwort = antwort({ ios: null, android: '2.2.1' });
    m = await ladeModul();
    await m.pruefeBetriebsstatus();
    expect(m.holeBetriebsstatus().aktualisierenUrl).toBe(PLAY_URL);
  });

  it('genau auf der Mindestversion: keine Sperre (2.3.0 gegen 2.3.0)', async () => {
    halter.installierteVersion = '2.3.0';
    halter.apiAntwort = antwort({ ios: '2.3.0' });
    const m = await ladeModul();
    await m.pruefeBetriebsstatus();
    expect(m.holeBetriebsstatus().aktualisierenUrl).toBeNull();
  });

  it('ueber der Mindestversion: keine Sperre', async () => {
    halter.installierteVersion = '2.4.1';
    halter.apiAntwort = antwort({ ios: '2.3.0' });
    const m = await ladeModul();
    await m.pruefeBetriebsstatus();
    expect(m.holeBetriebsstatus().aktualisierenUrl).toBeNull();
  });

  it('vergleicht semantisch: 2.9.0 liegt unter 2.10.0', async () => {
    halter.installierteVersion = '2.9.0';
    halter.apiAntwort = antwort({ ios: '2.10.0' });
    const m = await ladeModul();
    await m.pruefeBetriebsstatus();
    expect(m.holeBetriebsstatus().aktualisierenUrl).toBe(IOS_URL);
  });

  it('vergleicht semantisch: 2.10.0 liegt ueber 2.9.0', async () => {
    halter.installierteVersion = '2.10.0';
    halter.apiAntwort = antwort({ ios: '2.9.0' });
    const m = await ladeModul();
    await m.pruefeBetriebsstatus();
    expect(m.holeBetriebsstatus().aktualisierenUrl).toBeNull();
  });

  it('im Browser nie — selbst bei einer Mindestversion weit ueber allem', async () => {
    halter.nativ = false;
    halter.plattform = 'web';
    halter.apiAntwort = antwort({ ios: '99.0.0', android: '99.0.0' });
    const m = await ladeModul();
    await m.pruefeBetriebsstatus();
    expect(m.holeBetriebsstatus().aktualisierenUrl).toBeNull();
    // Die installierte Version wird dort gar nicht erst gefragt.
    expect(halter.getInfoAufrufe).toBe(0);
  });

  it('die Browser-Ausnahme haengt an isNativePlatform, nicht an der Plattform-Kennung', async () => {
    // Zweite Sicherung: Selbst wenn eine Web-Umgebung sich als "ios" meldete,
    // sperrt nur die native App.
    halter.nativ = false;
    halter.plattform = 'ios';
    halter.installierteVersion = '2.2.0';
    halter.apiAntwort = antwort({ ios: '2.3.0' });
    const m = await ladeModul();
    await m.pruefeBetriebsstatus();
    expect(m.holeBetriebsstatus().aktualisierenUrl).toBeNull();
    expect(halter.getInfoAufrufe).toBe(0);
  });

  it('offline: keine Sperre, keine Anfrage', async () => {
    halter.online = false;
    halter.installierteVersion = '2.2.0';
    halter.apiAntwort = antwort({ ios: '2.3.0' });
    const m = await ladeModul();
    await m.pruefeBetriebsstatus();
    expect(m.holeBetriebsstatus()).toEqual({ aktualisierenUrl: null, wartungstext: null });
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('Anfrage scheitert: keine Sperre, kein Fehler nach aussen', async () => {
    halter.installierteVersion = '2.2.0';
    halter.apiFehler = new Error('Network Error');
    const m = await ladeModul();
    await expect(m.pruefeBetriebsstatus()).resolves.toBeUndefined();
    expect(m.holeBetriebsstatus()).toEqual({ aktualisierenUrl: null, wartungstext: null });
  });

  it('Server vor dem Update (Antwort ohne min_version und wartung): keine Sperre, kein Hinweis', async () => {
    halter.installierteVersion = '2.2.0';
    halter.apiAntwort = {
      ios: { version: '2.3.0', url: IOS_URL },
      android: { version: '2.3.0', url: PLAY_URL },
    };
    const m = await ladeModul();
    await m.pruefeBetriebsstatus();
    expect(m.holeBetriebsstatus()).toEqual({ aktualisierenUrl: null, wartungstext: null });
  });

  it('unplausible Werte sperren nie (Mindestversion kein Versionsstring, Store-Seite fehlt)', async () => {
    halter.installierteVersion = '2.2.0';
    for (const kaputt of [
      { ios: { version: '2.3.0', url: IOS_URL, min_version: 'bald' } },
      { ios: { version: '2.3.0', url: IOS_URL, min_version: 230 } },
      { ios: { version: '2.3.0', min_version: '2.3.0' } },
      { ios: { version: '2.3.0', url: 'javascript:alert(1)', min_version: '2.3.0' } },
      null,
      'Wartung',
    ]) {
      vi.resetModules();
      halter.apiAntwort = kaputt;
      const m = await ladeModul();
      await m.pruefeBetriebsstatus();
      expect(m.holeBetriebsstatus().aktualisierenUrl, JSON.stringify(kaputt)).toBeNull();
    }
  });
});

describe('Wartungshinweis', () => {
  it('aktiv: der Text des Servers', async () => {
    halter.apiAntwort = antwort({ wartung: 'Heute ab 20 Uhr Wartung.' });
    const m = await ladeModul();
    await m.pruefeBetriebsstatus();
    expect(m.holeBetriebsstatus()).toEqual({ aktualisierenUrl: null, wartungstext: 'Heute ab 20 Uhr Wartung.' });
  });

  it('inaktiv: kein Hinweis', async () => {
    halter.apiAntwort = antwort();
    const m = await ladeModul();
    await m.pruefeBetriebsstatus();
    expect(m.holeBetriebsstatus().wartungstext).toBeNull();
  });

  it('aktiv ohne Text oder mit Text bei aktiv=false: kein Hinweis', async () => {
    for (const wartung of [
      { aktiv: true, text: null },
      { aktiv: true, text: '   ' },
      { aktiv: false, text: 'Alter Text' },
      { aktiv: 'ja', text: 'Text' },
    ]) {
      vi.resetModules();
      halter.apiAntwort = { ...antwort(), wartung };
      const m = await ladeModul();
      await m.pruefeBetriebsstatus();
      expect(m.holeBetriebsstatus().wartungstext, JSON.stringify(wartung)).toBeNull();
    }
  });

  it('gilt auch im Browser', async () => {
    halter.nativ = false;
    halter.plattform = 'web';
    halter.apiAntwort = antwort({ wartung: 'Wartung heute Abend' });
    const m = await ladeModul();
    await m.pruefeBetriebsstatus();
    expect(m.holeBetriebsstatus().wartungstext).toBe('Wartung heute Abend');
  });
});

describe('Wann geprueft wird', () => {
  it('beim Start und bei jeder Rueckkehr in die App — beim Wegwechseln nicht', async () => {
    const m = await ladeModul();
    const beenden = m.beobachteBetriebsstatus();
    await durchlaufen();
    expect(mockApiGet).toHaveBeenCalledTimes(1);
    expect(appStateZuhoerer).not.toBeNull();

    appStateZuhoerer!({ isActive: false });
    await durchlaufen();
    expect(mockApiGet).toHaveBeenCalledTimes(1);

    appStateZuhoerer!({ isActive: true });
    await durchlaufen();
    expect(mockApiGet).toHaveBeenCalledTimes(2);

    beenden();
    await durchlaufen();
    expect(mockEntfernen).toHaveBeenCalledTimes(1);
  });

  it('der Hinweis bleibt, bis der Server ihn nicht mehr meldet', async () => {
    halter.apiAntwort = antwort({ wartung: 'Wartung' });
    const m = await ladeModul();
    m.beobachteBetriebsstatus();
    await durchlaufen();
    expect(m.holeBetriebsstatus().wartungstext).toBe('Wartung');

    // Rueckkehr, Server meldet weiter -> bleibt.
    appStateZuhoerer!({ isActive: true });
    await durchlaufen();
    expect(m.holeBetriebsstatus().wartungstext).toBe('Wartung');

    // Rueckkehr, Server meldet nichts mehr -> weg.
    halter.apiAntwort = antwort();
    appStateZuhoerer!({ isActive: true });
    await durchlaufen();
    expect(m.holeBetriebsstatus().wartungstext).toBeNull();
  });

  it('eine Mindestversion, die waehrend der Sitzung gesetzt wird, greift bei der Rueckkehr', async () => {
    halter.installierteVersion = '2.3.0';
    const m = await ladeModul();
    m.beobachteBetriebsstatus();
    await durchlaufen();
    expect(m.holeBetriebsstatus().aktualisierenUrl).toBeNull();

    halter.apiAntwort = antwort({ ios: '2.4.0' });
    appStateZuhoerer!({ isActive: true });
    await durchlaufen();
    expect(m.holeBetriebsstatus().aktualisierenUrl).toBe(IOS_URL);
  });

  it('eine gescheiterte Pruefung aendert den Stand nicht', async () => {
    halter.installierteVersion = '2.2.0';
    halter.apiAntwort = antwort({ ios: '2.3.0', wartung: 'Wartung' });
    const m = await ladeModul();
    m.beobachteBetriebsstatus();
    await durchlaufen();
    const vorher = m.holeBetriebsstatus();
    expect(vorher).toEqual({ aktualisierenUrl: IOS_URL, wartungstext: 'Wartung' });

    halter.apiFehler = new Error('Network Error');
    appStateZuhoerer!({ isActive: true });
    await durchlaufen();
    expect(m.holeBetriebsstatus()).toBe(vorher);
  });

  it('Zuhoerer werden bei einer Aenderung benachrichtigt, bei gleichem Stand nicht', async () => {
    halter.apiAntwort = antwort({ wartung: 'Wartung' });
    const m = await ladeModul();
    const zuhoerer = vi.fn();
    const abmelden = m.abonniereBetriebsstatus(zuhoerer);
    await m.pruefeBetriebsstatus();
    expect(zuhoerer).toHaveBeenCalledTimes(1);
    const stand = m.holeBetriebsstatus();

    // Gleiche Antwort: derselbe Stand (gleiche Referenz), keine Meldung.
    await m.pruefeBetriebsstatus();
    expect(zuhoerer).toHaveBeenCalledTimes(1);
    expect(m.holeBetriebsstatus()).toBe(stand);

    abmelden();
    halter.apiAntwort = antwort();
    await m.pruefeBetriebsstatus();
    expect(zuhoerer).toHaveBeenCalledTimes(1);
    expect(m.holeBetriebsstatus().wartungstext).toBeNull();
  });
});
