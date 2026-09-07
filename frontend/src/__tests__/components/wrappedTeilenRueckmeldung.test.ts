// Das Teilen sagt, wenn es nicht geklappt hat -- und teilt im Browser
// wirklich, statt nur herunterzuladen.
//
// WAS SCHIEFGING (bis 06.09.2026): shareSlide verschluckte JEDEN Fehler
// still. Wer teilte und nichts passierte, konnte nicht unterscheiden, ob
// die App noch arbeitet, ob etwas schiefging oder ob er danebengetippt
// hat. Im Browser wurde ausserdem nur heruntergeladen -- auch auf dem
// Handy, wo ein Teilen-Blatt zur Verfuegung steht.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const toPngMock = vi.fn();
const shareMock = vi.fn();
const writeFileMock = vi.fn();
const getUriMock = vi.fn();
const istNativ = vi.fn();

vi.mock('html-to-image', () => ({ toPng: (...a: unknown[]) => toPngMock(...a) }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => istNativ() } }));
vi.mock('@capacitor/share', () => ({ Share: { share: (...a: unknown[]) => shareMock(...a) } }));
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: {
    writeFile: (...a: unknown[]) => writeFileMock(...a),
    getUri: (...a: unknown[]) => getUriMock(...a),
  },
  Directory: { Cache: 'CACHE' },
}));

import { shareSlide } from '../../components/wrapped/share/shareUtils';
import type { ShareTextData } from '../../components/wrapped/share/shareUtils';

const TEXT: ShareTextData = {
  wrappedType: 'konfi', displayName: 'Emilia', year: 2026,
  slideKey: 'punkte', slideValue: '137 Punkte gesammelt',
};

// Ein winziges, gueltiges PNG als Data-URL.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function karte(): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = '<div class="share-card-foto"></div>';
  return el;
}

const urspruenglich = {
  share: navigator.share,
  canShare: navigator.canShare,
  fetch: globalThis.fetch,
  clipboard: navigator.clipboard,
};

beforeEach(() => {
  vi.clearAllMocks();
  toPngMock.mockResolvedValue(PNG);
  getUriMock.mockResolvedValue({ uri: 'file:///cache/x.png' });
  istNativ.mockReturnValue(false);
  globalThis.fetch = vi.fn().mockResolvedValue({ blob: async () => new Blob(['x'], { type: 'image/png' }) }) as never;
});

afterEach(() => {
  Object.defineProperty(navigator, 'share', { value: urspruenglich.share, configurable: true, writable: true });
  Object.defineProperty(navigator, 'canShare', { value: urspruenglich.canShare, configurable: true, writable: true });
  Object.defineProperty(navigator, 'clipboard', { value: urspruenglich.clipboard, configurable: true, writable: true });
  globalThis.fetch = urspruenglich.fetch;
});

function setzeNavigator(felder: Record<string, unknown>) {
  for (const [k, v] of Object.entries(felder)) {
    Object.defineProperty(navigator, k, { value: v, configurable: true, writable: true });
  }
}

describe('Rueckmeldung beim Teilen', () => {
  it('gelungen: meldet "geteilt"', async () => {
    const teilen = vi.fn().mockResolvedValue(undefined);
    setzeNavigator({ share: teilen, canShare: () => true });
    const ergebnis = await shareSlide(karte(), 'punkte', 'konfi', TEXT);
    expect(ergebnis).toEqual({ art: 'geteilt' });
    expect(teilen).toHaveBeenCalledTimes(1);
  });

  it('abgebrochen ist KEIN Fehler', async () => {
    // Wer das Teilen-Blatt zuschiebt, hat sich entschieden. Eine
    // Fehlermeldung darauf waere Bevormundung.
    const abbruch = Object.assign(new Error('Abort'), { name: 'AbortError' });
    setzeNavigator({ share: vi.fn().mockRejectedValue(abbruch), canShare: () => true });
    const ergebnis = await shareSlide(karte(), 'punkte', 'konfi', TEXT);
    expect(ergebnis).toEqual({ art: 'abgebrochen' });
  });

  it('nach Abbruch wird NICHT heruntergeladen', async () => {
    // Sonst laege die Datei im Download-Ordner, obwohl der Nutzer
    // gerade abgesagt hat.
    const abbruch = Object.assign(new Error('Abort'), { name: 'AbortError' });
    setzeNavigator({ share: vi.fn().mockRejectedValue(abbruch), canShare: () => true });
    const klick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await shareSlide(karte(), 'punkte', 'konfi', TEXT);
    expect(klick).not.toHaveBeenCalled();
    klick.mockRestore();
  });

  it('Bild-Erzeugung scheitert: faellt auf den Text zurueck und sagt es', async () => {
    toPngMock.mockRejectedValue(new Error('canvas kaputt'));
    const teilen = vi.fn().mockResolvedValue(undefined);
    setzeNavigator({ share: teilen, canShare: () => false });
    const ergebnis = await shareSlide(karte(), 'punkte', 'konfi', TEXT);
    expect(ergebnis).toEqual({ art: 'nur-text' });
    expect(teilen).toHaveBeenCalledWith({ text: 'Meine Konfi-Zeit: 137 Punkte gesammelt! #KonfiQuest' });
  });

  it('gar nichts geht: meldet einen Fehler mit Grund', async () => {
    toPngMock.mockRejectedValue(new Error('canvas kaputt'));
    setzeNavigator({ share: undefined, canShare: undefined, clipboard: undefined });
    const ergebnis = await shareSlide(karte(), 'punkte', 'konfi', TEXT);
    expect(ergebnis.art).toBe('fehler');
    expect((ergebnis as { grund: string }).grund).toBe('canvas kaputt');
  });
});

describe('Browser-Weg', () => {
  it('teilt das BILD, wenn der Browser Dateien teilen kann', async () => {
    let uebergeben: { files?: File[] } | undefined;
    const teilen = vi.fn().mockImplementation((d) => { uebergeben = d; return Promise.resolve(); });
    setzeNavigator({ share: teilen, canShare: (d: { files?: File[] }) => Array.isArray(d.files) });
    await shareSlide(karte(), 'punkte', 'konfi', TEXT);
    expect(uebergeben?.files).toHaveLength(1);
    expect(uebergeben?.files?.[0].name).toBe('wrapped_punkte.png');
    expect(uebergeben?.files?.[0].type).toBe('image/png');
  });

  it('laedt herunter, wenn der Browser keine Dateien teilen kann', async () => {
    // Auf dem Rechner gibt es kein Teilen-Blatt fuer Dateien -- dort ist
    // der Download das Richtige, keine Fehlermeldung.
    const teilen = vi.fn();
    setzeNavigator({ share: teilen, canShare: () => false });
    const klick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const ergebnis = await shareSlide(karte(), 'punkte', 'konfi', TEXT);
    expect(ergebnis).toEqual({ art: 'geteilt' });
    expect(klick).toHaveBeenCalledTimes(1);
    expect(teilen).not.toHaveBeenCalled();
    klick.mockRestore();
  });

  it('prueft canShare VOR share', async () => {
    // Ohne die Pruefung wirft share() auf dem Rechner, und der Nutzer
    // bekaeme einen Fehler, wo ein Download richtig gewesen waere.
    const reihenfolge: string[] = [];
    setzeNavigator({
      canShare: () => { reihenfolge.push('canShare'); return true; },
      share: () => { reihenfolge.push('share'); return Promise.resolve(); },
    });
    await shareSlide(karte(), 'punkte', 'konfi', TEXT);
    expect(reihenfolge).toEqual(['canShare', 'share']);
  });
});

describe('App auf dem Geraet', () => {
  it('schreibt die Datei und uebergibt sie ans Teilen-Blatt', async () => {
    istNativ.mockReturnValue(true);
    shareMock.mockResolvedValue(undefined);
    const ergebnis = await shareSlide(karte(), 'badges', 'konfi', TEXT);
    expect(ergebnis).toEqual({ art: 'geteilt' });
    expect(writeFileMock).toHaveBeenCalledTimes(1);
    expect(shareMock).toHaveBeenCalledWith({ files: ['file:///cache/x.png'] });
  });

  it('Abbruch auf dem Geraet ist kein Fehler', async () => {
    istNativ.mockReturnValue(true);
    shareMock.mockRejectedValue(new Error('Share canceled'));
    const ergebnis = await shareSlide(karte(), 'badges', 'konfi', TEXT);
    expect(ergebnis).toEqual({ art: 'abgebrochen' });
  });
});

describe('Bild-Erzeugung', () => {
  it('ohne cacheBust -- sonst verliert der Dateityp seine Endung', async () => {
    setzeNavigator({ share: vi.fn().mockResolvedValue(undefined), canShare: () => true });
    await shareSlide(karte(), 'punkte', 'konfi', TEXT);
    const optionen = toPngMock.mock.calls[0][1];
    expect(optionen.cacheBust).toBeUndefined();
    expect(optionen.width).toBe(1080);
    expect(optionen.height).toBe(1920);
  });
});
