import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, renderHook, act, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { dateien, objectUrlAttrappe } from '../medienAttrappen';

// Der Betrachter der App auf Android (Simons Befund 29.09.2026,
// Android-Testbuild 2.3.0): Bilder, Videos und PDFs gingen dort in einer
// fremden App auf. Jetzt zeigt sie der Betrachter selbst — PDFs per pdf.js,
// Seiten untereinander. Nur was er nicht kann, geht noch hinaus, und dann
// durch die Hülle dateiExternOeffnen (Ausflug-Merker der App-Sperre).
//
// pdf.js ist hier ersetzt: Die Attrappe liefert zwei Seiten und zählt, was
// gezeichnet wird. Plattform und Plugins ebenso; alles andere — Hook,
// Betrachter, nativeFileViewer, Medien-Cache, Hülle, Merker — ist echt.

const plattform = vi.hoisted(() => ({ name: 'android' as 'android' | 'ios' | 'web' }));

vi.mock('@capacitor/core', async (original) => {
  const echt = await original<typeof import('@capacitor/core')>();
  return {
    ...echt,
    Capacitor: {
      ...echt.Capacitor,
      isNativePlatform: () => plattform.name !== 'web',
      getPlatform: () => plattform.name,
    },
  };
});

vi.mock('@capacitor/filesystem', async () => (await import('../medienAttrappen')).dateisystemModul);

const fileOpenerOeffnen = vi.fn();
vi.mock('@capacitor-community/file-opener', () => ({
  FileOpener: { open: (...a: unknown[]) => fileOpenerOeffnen(...a) },
}));

const fileViewerOeffnen = vi.fn();
vi.mock('@capacitor/file-viewer', () => ({
  FileViewer: { openDocumentFromLocalPath: (...a: unknown[]) => fileViewerOeffnen(...a) },
}));

vi.mock('@capacitor/share', () => ({ Share: { share: vi.fn(async () => undefined) } }));

const apiGet = vi.fn();
vi.mock('../../services/api', () => ({
  default: { get: (...args: unknown[]) => apiGet(...args) },
  DATEI_TIMEOUT_MS: 180000,
}));

vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: { isOnline: true, subscribe: () => () => undefined },
}));

vi.mock('../../utils/haptics', () => ({
  haptik: vi.fn(async () => undefined),
  ImpactStyle: { Light: 'LIGHT' },
}));

const setError = vi.fn();
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ setError }),
}));

// --- pdf.js-Attrappe ---
// Die Zählung lebt außerhalb der Modul-Attrappe: Wird pdf.js gar nicht erst
// geladen (iOS, Word-Dokument), muss „nie aufgerufen" trotzdem prüfbar sein.
const pdf = vi.hoisted(() => {
  const zustand = { seiten: 2, scheitern: false, gezeichnet: [] as number[], zerstoert: 0 };
  const getDocument = vi.fn((_quelle: { data: Uint8Array }) => ({
    promise: zustand.scheitern
      ? Promise.reject(new Error('Invalid PDF structure'))
      : Promise.resolve({
        numPages: zustand.seiten,
        getPage: async (nummer: number) => ({
          getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
          render: () => {
            zustand.gezeichnet.push(nummer);
            return { promise: Promise.resolve(), cancel: vi.fn() };
          },
        }),
      }),
    destroy: vi.fn(async () => { zustand.zerstoert += 1; }),
  }));
  return Object.assign(zustand, { getDocument });
});
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({ getDocument: pdf.getDocument, GlobalWorkerOptions: {} }));
vi.mock('pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker&url', () => ({ default: '/assets/pdf.worker.js' }));
vi.mock('pdfjs-dist/wasm/openjpeg.wasm?url', () => ({ default: '/assets/openjpeg.wasm' }));
vi.mock('pdfjs-dist/wasm/jbig2.wasm?url', () => ({ default: '/assets/jbig2.wasm' }));

// Der Betrachter wird im Hook-Teil nur angezeigt, nicht gerendert: gezählt
// wird, WAS er bekäme.
type BetrachterProps = { files: Array<{ url: string; fileName: string; mimeType: string }>; initialIndex: number };
let betrachterProps: BetrachterProps | null = null;
const betrachterZeigen = vi.fn();
vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  useIonModal: (_komponente: unknown, props: BetrachterProps) => {
    betrachterProps = props;
    return [betrachterZeigen, vi.fn()];
  },
}));

import { useDateiOeffnen } from '../../hooks/useDateiOeffnen';
import FileViewerModal from '../../components/shared/FileViewerModal';
import { clearMediaCache } from '../../services/mediaCache';
import { laeuftAusflug } from '../../services/appSperre';
import { DATEI_NACHLAUF_MS } from '../../services/systemDialoge';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PDF_BYTES = [37, 80, 68, 70]; // "%PDF"

// fetch auf blob:-Adressen kann jsdom nicht. Die Attrappe liefert Bytes und
// einen Blob aus jsdom (den FileReader annimmt).
const geholt: string[] = [];
const fetchAttrappe = vi.fn(async (url: string) => {
  geholt.push(url);
  return {
    ok: true,
    arrayBuffer: async () => new Uint8Array(PDF_BYTES).buffer,
    blob: async () => new Blob([new Uint8Array(PDF_BYTES)], { type: 'application/pdf' }),
  };
});

// Canvas zählbar machen: jsdom zeichnet nichts.
const umkopiert = vi.fn();

beforeEach(async () => {
  plattform.name = 'android';
  await clearMediaCache();
  dateien.clear();
  apiGet.mockReset();
  apiGet.mockImplementation(async (route: string) => ({ data: new Blob([`inhalt:${route}`]) }));
  fileOpenerOeffnen.mockReset();
  fileOpenerOeffnen.mockResolvedValue(undefined);
  fileViewerOeffnen.mockReset();
  fileViewerOeffnen.mockResolvedValue(undefined);
  setError.mockReset();
  betrachterZeigen.mockReset();
  betrachterProps = null;
  pdf.seiten = 2;
  pdf.scheitern = false;
  pdf.getDocument.mockClear();
  pdf.gezeichnet = [];
  pdf.zerstoert = 0;
  geholt.length = 0;
  fetchAttrappe.mockClear();
  vi.stubGlobal('fetch', fetchAttrappe);
  umkopiert.mockClear();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => ({ drawImage: umkopiert }) as unknown as CanvasRenderingContext2D
  );
  objectUrlAttrappe();
});

afterEach(async () => {
  cleanup();
  // Ein offener Ausflug endet von selbst nach dem Nachlauf. Darauf warten,
  // statt den Merker hart zu leeren: Der noch laufende Zeitgeber würde sonst
  // im nächsten Test dessen Ausflug abmelden.
  await waitFor(() => expect(laeuftAusflug()).toBe(false), { timeout: DATEI_NACHLAUF_MS * 2 });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const pluginAufrufe = () => fileOpenerOeffnen.mock.calls.length + fileViewerOeffnen.mock.calls.length;

describe('Android: Antippen im Chat, in Challenges und im Material öffnet den Betrachter', () => {
  const kontext = () => [
    { pfad: 'ab12', name: 'foto.jpg' },
    { pfad: 'cd34', name: 'clip.mp4' },
    { pfad: 'ef56', name: 'plan.pdf' },
  ];

  it.each([
    ['ab12', 'foto.jpg', 'image/jpeg', 0],
    ['cd34', 'clip.mp4', 'video/mp4', 1],
    ['ef56', 'plan.pdf', 'application/pdf', 2],
  ])('%s (%s): Betrachter mit Wisch-Kontext, kein Plugin', async (pfad, name, typ, index) => {
    const { result } = renderHook(() => useDateiOeffnen({ quelle: 'chat', kontext, fehlerOrt: 'chat-datei' }));

    await act(async () => { await result.current.dateiOeffnen(pfad, name); });

    expect(pluginAufrufe()).toBe(0);
    expect(betrachterZeigen).toHaveBeenCalledTimes(1);
    expect(betrachterProps!.initialIndex).toBe(index);
    expect(betrachterProps!.files.map((f) => f.mimeType)).toEqual(['image/jpeg', 'video/mp4', 'application/pdf']);
    expect(betrachterProps!.files[index].mimeType).toBe(typ);
    // Keine Kopie in Documents/temp — die gäbe es nur fürs native Öffnen.
    expect([...dateien.keys()].filter((p) => p.startsWith('temp/'))).toEqual([]);
    expect(setError).not.toHaveBeenCalled();
  });

  it('ein Word-Dokument geht hinaus, ohne Betrachter, und mit Ausflug', async () => {
    const { result } = renderHook(() => useDateiOeffnen({
      quelle: 'material',
      kontext: () => [{ pfad: 'gh78', name: 'plan.docx' }],
      fehlerOrt: 'material-datei',
    }));

    await act(async () => { await result.current.dateiOeffnen('gh78', 'plan.docx'); });

    expect(fileViewerOeffnen).toHaveBeenCalledTimes(1);
    expect(betrachterZeigen).toHaveBeenCalledTimes(0);
    expect(laeuftAusflug()).toBe(true);
  });
});

describe('Android: der Betrachter zeigt eine PDF selbst', () => {
  const plan = { url: 'blob:plan', fileName: 'plan.pdf', mimeType: 'application/pdf' };

  it('zwei Seiten untereinander, gezeichnet per pdf.js — kein Plugin', async () => {
    render(<FileViewerModal files={[plan]} onClose={vi.fn()} />);

    expect(await screen.findByRole('img', { name: 'Seite 1 von 2' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Seite 2 von 2' })).toBeInTheDocument();
    await waitFor(() => expect(umkopiert).toHaveBeenCalledTimes(2));

    expect(pdf.getDocument).toHaveBeenCalledTimes(1);
    expect(pdf.getDocument.mock.calls[0][0].data).toEqual(new Uint8Array(PDF_BYTES));
    expect([...pdf.gezeichnet].sort()).toEqual([1, 2]);
    expect(geholt).toEqual(['blob:plan']);
    expect(pluginAufrufe()).toBe(0);
    expect(laeuftAusflug()).toBe(false);
    expect(screen.queryByTitle('plan.pdf')).toBeNull(); // kein iframe
  });

  it('Zoom über die Knöpfe: 100 % → 150 %, die Seiten werden neu gezeichnet', async () => {
    render(<FileViewerModal files={[plan]} onClose={vi.fn()} />);
    await waitFor(() => expect(umkopiert).toHaveBeenCalledTimes(2));

    expect(screen.getByText('100 %')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verkleinern' })).toBeDisabled();
    const breiteVorher = (screen.getByRole('img', { name: 'Seite 1 von 2' }).parentElement as HTMLElement).style.width;

    await act(async () => { screen.getByRole('button', { name: 'Vergrößern' }).click(); });

    expect(screen.getByText('150 %')).toBeInTheDocument();
    const breiteNachher = (screen.getByRole('img', { name: 'Seite 1 von 2' }).parentElement as HTMLElement).style.width;
    expect(parseFloat(breiteNachher)).toBe(parseFloat(breiteVorher) * 1.5);
    await waitFor(() => expect(umkopiert).toHaveBeenCalledTimes(4));
  });

  it('schließt der Betrachter, räumt pdf.js auf', async () => {
    const { unmount } = render(<FileViewerModal files={[plan]} onClose={vi.fn()} />);
    await screen.findByRole('img', { name: 'Seite 1 von 2' });

    unmount();

    expect(pdf.zerstoert).toBe(1);
  });

  it('scheitert pdf.js, geht die PDF in eine fremde App — mit Ausflug', async () => {
    pdf.scheitern = true;
    const onClose = vi.fn();
    render(<FileViewerModal files={[plan]} onClose={onClose} />);

    await waitFor(() => expect(fileOpenerOeffnen).toHaveBeenCalledTimes(1));
    expect(fileOpenerOeffnen.mock.calls[0][0]).toEqual({ filePath: 'file:///cache/plan.pdf', contentType: 'application/pdf' });
    expect(laeuftAusflug()).toBe(true);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('ein Word-Dokument im Betrachter geht wie bisher hinaus — jetzt mit Ausflug', async () => {
    const onClose = vi.fn();
    render(<FileViewerModal files={[{ url: 'blob:brief', fileName: 'brief.docx', mimeType: DOCX }]} onClose={onClose} />);

    await waitFor(() => expect(fileOpenerOeffnen).toHaveBeenCalledTimes(1));
    expect(laeuftAusflug()).toBe(true);
    expect(pdf.getDocument).toHaveBeenCalledTimes(0);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    await new Promise((weiter) => setTimeout(weiter, DATEI_NACHLAUF_MS + 50));
    expect(laeuftAusflug()).toBe(false);
  });
});

describe('Android: was der Betrachter nicht darstellen kann, geht doch hinaus', () => {
  it('ein Video, das das WebView nicht abspielt: fremde App, mit Ausflug', async () => {
    const onClose = vi.fn();
    const { container } = render(
      <FileViewerModal files={[{ url: 'blob:clip', fileName: 'clip.mov', mimeType: 'video/quicktime' }]} onClose={onClose} />
    );
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
    expect(pluginAufrufe()).toBe(0);

    fireEvent.error(container.querySelector('video')!);

    await waitFor(() => expect(fileOpenerOeffnen).toHaveBeenCalledTimes(1));
    expect(fileOpenerOeffnen.mock.calls[0][0]).toEqual({ filePath: 'file:///cache/clip.mov', contentType: 'video/quicktime' });
    expect(screen.getByText('Die App kann diese Datei nicht selbst anzeigen.')).toBeInTheDocument();
    expect(laeuftAusflug()).toBe(true);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('ein Bild, das das WebView nicht dekodiert (etwa HEIC): ebenso', async () => {
    const { container } = render(
      <FileViewerModal files={[{ url: 'blob:foto', fileName: 'foto.heic', mimeType: 'image/heic' }]} onClose={vi.fn()} />
    );
    await waitFor(() => expect(container.querySelector('img')).not.toBeNull());

    fireEvent.error(container.querySelector('img')!);

    await waitFor(() => expect(fileOpenerOeffnen).toHaveBeenCalledTimes(1));
    expect(fileOpenerOeffnen.mock.calls[0][0].contentType).toBe('image/heic');
  });

  it('iOS: ein Bildfehler startet nichts — dort bleibt alles, wie es war', async () => {
    plattform.name = 'ios';
    const { container } = render(
      <FileViewerModal files={[{ url: 'blob:foto', fileName: 'foto.heic', mimeType: 'image/heic' }]} onClose={vi.fn()} />
    );
    await waitFor(() => expect(container.querySelector('img')).not.toBeNull());

    fireEvent.error(container.querySelector('img')!);
    await act(async () => { await new Promise((weiter) => setTimeout(weiter, 50)); });

    expect(pluginAufrufe()).toBe(0);
    expect(container.querySelector('img')).not.toBeNull();
  });
});

describe('Android: durch Fotos und Videos wischen', () => {
  const folge = [
    { url: 'blob:foto', fileName: 'foto.jpg', mimeType: 'image/jpeg' },
    { url: 'blob:clip', fileName: 'clip.mp4', mimeType: 'video/mp4' },
    { url: 'blob:plan', fileName: 'plan.pdf', mimeType: 'application/pdf' },
  ];

  const wischen = (element: Element, von: { x: number; y: number }, nach: { x: number; y: number }) => {
    fireEvent.touchStart(element, { touches: [{ clientX: von.x, clientY: von.y }] });
    fireEvent.touchEnd(element, { touches: [], changedTouches: [{ clientX: nach.x, clientY: nach.y }] });
  };

  beforeEach(() => {
    // jsdom rechnet kein Layout: das Video steht auf 300 × 400 px.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 0, bottom: 400, left: 0, right: 300, width: 300, height: 400, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect);
  });

  it('vom Video weiter zur PDF und zurück', async () => {
    const { container } = render(<FileViewerModal files={folge} initialIndex={1} onClose={vi.fn()} />);
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
    expect(screen.getByText('2 / 3')).toBeInTheDocument();

    wischen(container.querySelector('.file-viewer-video-rahmen')!, { x: 250, y: 150 }, { x: 60, y: 160 });
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
    await screen.findByRole('img', { name: 'Seite 1 von 2' });
  });

  it('ein Wisch über der Zeitleiste des Videos spult nur', async () => {
    const { container } = render(<FileViewerModal files={folge} initialIndex={1} onClose={vi.fn()} />);
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull());

    wischen(container.querySelector('.file-viewer-video-rahmen')!, { x: 250, y: 380 }, { x: 60, y: 380 });

    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });
});

describe('iOS: PDFs weiter in der Vorschau des Systems', () => {
  it('öffnet über den FileOpener, pdf.js bleibt unberührt', async () => {
    plattform.name = 'ios';
    const onClose = vi.fn();
    render(<FileViewerModal files={[{ url: 'blob:plan', fileName: 'plan.pdf', mimeType: 'application/pdf' }]} onClose={onClose} />);

    await waitFor(() => expect(fileOpenerOeffnen).toHaveBeenCalledTimes(1));
    expect(pdf.getDocument).toHaveBeenCalledTimes(0);
    expect(screen.queryByRole('img', { name: 'Seite 1 von 2' })).toBeNull();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('Antippen im Chat nimmt weiter den nativen Weg, nicht den Betrachter', async () => {
    plattform.name = 'ios';
    const { result } = renderHook(() => useDateiOeffnen({
      quelle: 'chat',
      kontext: () => [{ pfad: 'ab12', name: 'foto.jpg' }],
      fehlerOrt: 'chat-datei',
    }));

    await act(async () => { await result.current.dateiOeffnen('ab12', 'foto.jpg'); });

    expect(fileOpenerOeffnen).toHaveBeenCalledTimes(1);
    expect(betrachterZeigen).toHaveBeenCalledTimes(0);
  });
});

describe('Browser: PDFs ebenfalls per pdf.js, das iframe nur als Rückfall', () => {
  beforeEach(() => { plattform.name = 'web'; });

  it('zeigt die Seiten per pdf.js', async () => {
    render(<FileViewerModal files={[{ url: 'blob:plan', fileName: 'plan.pdf', mimeType: 'application/pdf' }]} onClose={vi.fn()} />);

    expect(await screen.findByRole('img', { name: 'Seite 2 von 2' })).toBeInTheDocument();
    expect(pdf.getDocument).toHaveBeenCalledTimes(1);
    expect(pluginAufrufe()).toBe(0);
  });

  it('scheitert pdf.js, bleibt das iframe', async () => {
    pdf.scheitern = true;
    const { container } = render(<FileViewerModal files={[{ url: 'blob:plan', fileName: 'plan.pdf', mimeType: 'application/pdf' }]} onClose={vi.fn()} />);

    await waitFor(() => expect(container.querySelector('iframe')).not.toBeNull());
    expect(container.querySelector('iframe')!.getAttribute('src')).toBe('blob:plan');
    expect(pluginAufrufe()).toBe(0);
  });
});
