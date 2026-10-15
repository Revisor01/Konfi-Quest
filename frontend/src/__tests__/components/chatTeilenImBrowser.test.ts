import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dateien, Filesystem, objectUrlAttrappe } from '../medienAttrappen';
import type { Message } from '../../types/chat';

/**
 * Eine Datei aus dem Chat im Browser teilen (Befund 15.10.2026).
 *
 * nachrichtTeilen schrieb die Datei auch im Browser in den „Cache" des
 * Capacitor-Dateisystems und reichte dessen URI an das Teilen-Blatt. Im
 * Browser gibt es diesen Ort nicht: Geteilt wurde ein leerer bzw. nutzloser
 * Pfad statt der Datei. Jetzt: Kann der Browser Dateien teilen
 * (navigator.canShare mit files), geht die Datei selbst an sein
 * Teilen-Fenster; sonst wird sie heruntergeladen. In der App bleibt es beim
 * Teilen-Blatt aus dem Cache (chatTeilenImCache.test.ts).
 */
vi.mock('@capacitor/filesystem', async () => (await import('../medienAttrappen')).dateisystemModul);

const teilen = vi.fn(async () => undefined);
const teilenImBrowser = vi.fn(async (_daten: ShareData) => undefined);
vi.mock('../../services/systemDialoge', () => ({
  teilen: (...a: unknown[]) => teilen(...(a as [])),
  teilenImBrowser: (daten: ShareData) => teilenImBrowser(daten),
}));
vi.mock('../../services/mediaCache', () => ({
  getMediaBlob: vi.fn(async () => new Blob(['foto'], { type: 'image/jpeg' })),
}));
vi.mock('../../services/api', () => ({ default: { get: vi.fn() }, DATEI_TIMEOUT_MS: 1000 }));

const { nachrichtTeilen } = await import('../../components/chat/chatTeilen');
const { nachrichtHerunterladen, dateiImBrowserTeilbar } = await import('../../components/chat/dateiImBrowser');

const FOTO = { id: 7, file_path: 'ab12', file_name: 'foto.jpg', content: '', message_type: 'image' } as unknown as Message;

/** Welche Downloads ausgelöst wurden: Dateiname je Klick auf einen Link mit download. */
const downloads: string[] = [];
let klick: ReturnType<typeof vi.spyOn>;

const kannTeilen = (antwort: boolean | undefined) => {
  if (antwort === undefined) Reflect.deleteProperty(navigator, 'canShare');
  else Object.defineProperty(navigator, 'canShare', { configurable: true, value: vi.fn(() => antwort) });
};

describe('Chat im Browser: eine Datei teilen', () => {
  beforeEach(() => {
    dateien.clear();
    vi.clearAllMocks();
    downloads.length = 0;
    objectUrlAttrappe();
    klick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });
  });
  afterEach(() => {
    klick.mockRestore();
    Reflect.deleteProperty(navigator, 'canShare');
  });

  it('kann der Browser Dateien teilen, geht die Datei selbst an sein Teilen-Fenster -- kein Cache-Pfad', async () => {
    kannTeilen(true);
    await nachrichtTeilen(FOTO, vi.fn());
    expect(teilenImBrowser).toHaveBeenCalledTimes(1);
    const daten = teilenImBrowser.mock.calls[0][0];
    expect(daten.title).toBe('Datei aus Konfi Quest');
    expect(daten.url).toBeUndefined();
    expect(daten.files).toHaveLength(1);
    expect(daten.files![0].name).toBe('foto.jpg');
    expect(daten.files![0].type).toBe('image/jpeg');
    expect(await daten.files![0].text()).toBe('foto');
    expect(teilen).not.toHaveBeenCalled();
    expect(Filesystem.writeFile).not.toHaveBeenCalled();
    expect(downloads).toEqual([]);
  });

  it('kann er es nicht (Desktop), wird die Datei heruntergeladen -- nichts geht an ein Teilen-Blatt', async () => {
    kannTeilen(undefined);
    await nachrichtTeilen(FOTO, vi.fn());
    expect(downloads).toEqual(['foto.jpg']);
    expect(teilenImBrowser).not.toHaveBeenCalled();
    expect(teilen).not.toHaveBeenCalled();
    expect(Filesystem.writeFile).not.toHaveBeenCalled();
  });

  it('bricht die Person das Teilen ab, folgt kein Download und keine Meldung', async () => {
    kannTeilen(true);
    const abbruch = Object.assign(new Error('abgebrochen'), { name: 'AbortError' });
    teilenImBrowser.mockRejectedValueOnce(abbruch);
    const setError = vi.fn();
    await nachrichtTeilen(FOTO, setError);
    expect(downloads).toEqual([]);
    expect(setError).not.toHaveBeenCalled();
  });

  it('eine reine Textnachricht geht wie bisher als Text an das Teilen-Blatt', async () => {
    kannTeilen(true);
    await nachrichtTeilen({ id: 8, content: 'Hallo', message_type: 'text' } as unknown as Message, vi.fn());
    expect(teilen).toHaveBeenCalledWith({ text: 'Hallo', title: 'Nachricht aus Konfi Quest' });
    expect(teilenImBrowser).not.toHaveBeenCalled();
  });

  it('„Herunterladen" speichert die Datei unter ihrem Namen', async () => {
    await nachrichtHerunterladen(FOTO, vi.fn());
    expect(downloads).toEqual(['foto.jpg']);
    expect(teilenImBrowser).not.toHaveBeenCalled();
  });

  it('ob der Browser eine Datei teilen kann, fragt er selbst (navigator.canShare mit files)', () => {
    kannTeilen(undefined);
    expect(dateiImBrowserTeilbar('foto.jpg')).toBe(false);
    kannTeilen(false);
    expect(dateiImBrowserTeilbar('foto.jpg')).toBe(false);
    kannTeilen(true);
    expect(dateiImBrowserTeilbar('plan.pdf')).toBe(true);
    const gefragt = (navigator.canShare as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as ShareData;
    expect(gefragt.files![0].name).toBe('plan.pdf');
    expect(gefragt.files![0].type).toBe('application/pdf');
  });
});
