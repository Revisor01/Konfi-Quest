import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';
import { dateien } from '../medienAttrappen';

// Eine Datei in einer fremden App öffnen, ohne Biometrie-Abfrage bei der
// Rückkehr (Simons Befund 29.09.2026, Android-Testbuild 2.3.0): „Auf Android werden
// Bilder, Videos, PDFs immer extern geöffnet, nicht mit einem File-Viewer aus
// Capacitor wie bei iOS. […] Das führt bei aktivierter Biometrie sofort immer
// zu einer Biometrie-Abfrage."
//
// Geprüft wird der ECHTE Weg: openFileNatively, die Hülle dateiExternOeffnen,
// der Ausflug-Merker der App-Sperre und der Lebenszyklus in useAppSperre.
// Ersetzt sind nur die Plugins und die Plattform.

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

let zustandsWechsel: ((e: { isActive: boolean }) => void) | null = null;
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(async (_name: string, cb: (e: { isActive: boolean }) => void) => {
      zustandsWechsel = cb;
      return { remove: vi.fn() };
    }),
  },
}));

const mockLesen = vi.fn();
vi.mock('../../services/appSperre', async () => {
  // Merker und Rechnung bleiben ECHT; nur Geräteabfragen sind ersetzt.
  const echt = await vi.importActual<typeof import('../../services/appSperre')>('../../services/appSperre');
  return {
    ...echt,
    sperreVerfuegbar: async () => true,
    sperreLesen: (...a: unknown[]) => mockLesen(...(a as [])),
  };
});

import { openFileNatively } from '../../utils/nativeFileViewer';
import { laeuftAusflug } from '../../services/appSperre';
import { DATEI_NACHLAUF_MS, DATEI_AUSFLUG_HOECHSTENS_MS } from '../../services/systemDialoge';
import { useAppSperre } from '../../hooks/useAppSperre';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const datei = () => new Blob(['inhalt'], { type: 'application/octet-stream' });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  plattform.name = 'android';
  dateien.clear();
  fileOpenerOeffnen.mockReset();
  fileOpenerOeffnen.mockResolvedValue(undefined);
  fileViewerOeffnen.mockReset();
  fileViewerOeffnen.mockResolvedValue(undefined);
  mockLesen.mockReset();
  mockLesen.mockResolvedValue('sofort');
  zustandsWechsel = null;
});

afterEach(() => {
  cleanup();
  // Offene Ausflüge regulär auslaufen lassen (Nachlauf, Notbremse). Danach
  // muss der Merker leer sein — sonst färbte der Test den nächsten.
  vi.runAllTimers();
  vi.useRealTimers();
  expect(laeuftAusflug()).toBe(false);
});

/**
 * Wartet, bis das Plugin gerufen ist — ohne die Uhr vorzustellen (vi.waitFor
 * täte das bei falschen Uhren in jedem Schritt und verschöbe die Notbremse).
 */
const bisGerufen = async (plugin: ReturnType<typeof vi.fn>) => {
  for (let i = 0; i < 100 && plugin.mock.calls.length === 0; i += 1) {
    await new Promise((weiter) => setImmediate(weiter));
  }
  expect(plugin).toHaveBeenCalledTimes(1);
};

describe('Android: ein Word-Dokument geht in eine fremde App, mit Ausflug', () => {
  it('öffnet über den FileViewer und hält den Merker 1,5 s über die Antwort hinaus', async () => {
    const ergebnis = await openFileNatively(datei(), 'plan.docx', DOCX);

    expect(ergebnis).toBe(true);
    expect(fileViewerOeffnen).toHaveBeenCalledTimes(1);
    expect(fileViewerOeffnen.mock.calls[0][0]).toEqual({ path: expect.stringMatching(/^file:\/\/\/cache\/temp\/native_\d+\.docx$/) });
    // Das Plugin ist zurück, die fremde App schiebt sich erst jetzt davor.
    expect(laeuftAusflug()).toBe(true);
    vi.advanceTimersByTime(DATEI_NACHLAUF_MS - 1);
    expect(laeuftAusflug()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(laeuftAusflug()).toBe(false);
  });

  it('der Merker steht schon, während das Plugin noch arbeitet', async () => {
    let fertig: () => void = () => undefined;
    fileViewerOeffnen.mockImplementation(() => new Promise<void>((r) => { fertig = r; }));

    const laeuft = openFileNatively(datei(), 'plan.docx', DOCX);
    await bisGerufen(fileViewerOeffnen);
    expect(laeuftAusflug()).toBe(true);

    fertig();
    await expect(laeuft).resolves.toBe(true);
    vi.advanceTimersByTime(DATEI_NACHLAUF_MS);
    expect(laeuftAusflug()).toBe(false);
  });

  it('scheitert das Öffnen: false, und der Merker fällt nach dem Nachlauf', async () => {
    fileViewerOeffnen.mockRejectedValue(new Error('Keine App für diesen Typ'));
    const warnung = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const ergebnis = await openFileNatively(datei(), 'plan.docx', DOCX);

    expect(ergebnis).toBe(false);
    vi.advanceTimersByTime(DATEI_NACHLAUF_MS);
    expect(laeuftAusflug()).toBe(false);
    warnung.mockRestore();
  });

  it('antwortet das Plugin nie, endet der Ausflug trotzdem — sonst wäre die Sperre tot', async () => {
    fileViewerOeffnen.mockImplementation(() => new Promise<void>(() => undefined));

    void openFileNatively(datei(), 'plan.docx', DOCX);
    await bisGerufen(fileViewerOeffnen);

    vi.advanceTimersByTime(DATEI_AUSFLUG_HOECHSTENS_MS - 1);
    expect(laeuftAusflug()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(laeuftAusflug()).toBe(false);
  });
});

describe('iOS: alles wie bisher, nur mit Ausflug', () => {
  beforeEach(() => { plattform.name = 'ios'; });

  it('Bild über den FileOpener', async () => {
    expect(await openFileNatively(datei(), 'foto.jpg', 'image/jpeg')).toBe(true);
    expect(fileOpenerOeffnen).toHaveBeenCalledTimes(1);
    expect(fileOpenerOeffnen.mock.calls[0][0]).toEqual({
      filePath: expect.stringMatching(/^file:\/\/\/cache\/temp\/native_\d+\.jpg$/),
      contentType: 'image/jpeg',
    });
    expect(fileViewerOeffnen).toHaveBeenCalledTimes(0);
  });

  it.each([
    ['plan.pdf', 'application/pdf'],
    ['clip.mp4', 'video/mp4'],
    ['plan.docx', DOCX],
  ])('%s über den FileViewer', async (name, typ) => {
    expect(await openFileNatively(datei(), name, typ)).toBe(true);
    expect(fileViewerOeffnen).toHaveBeenCalledTimes(1);
    expect(fileOpenerOeffnen).toHaveBeenCalledTimes(0);
  });

  it('die Vorschau des Systems läuft als Ausflug, solange das Plugin sie offen hält', async () => {
    // Der FileOpener antwortet auf iOS erst, wenn die Vorschau zu ist
    // (documentInteractionControllerDidEndPreview). Das Teilen-Blatt daraus
    // darf die Sperre nicht auslösen.
    let zu: () => void = () => undefined;
    fileOpenerOeffnen.mockImplementation(() => new Promise<void>((r) => { zu = r; }));

    const laeuft = openFileNatively(datei(), 'foto.jpg', 'image/jpeg');
    await bisGerufen(fileOpenerOeffnen);
    vi.advanceTimersByTime(60_000);
    expect(laeuftAusflug()).toBe(true);

    zu();
    await laeuft;
    vi.advanceTimersByTime(DATEI_NACHLAUF_MS);
    expect(laeuftAusflug()).toBe(false);
  });
});

describe('Browser: nie ein Plugin', () => {
  it('liefert false für jede Datei', async () => {
    plattform.name = 'web';
    expect(await openFileNatively(datei(), 'plan.docx', DOCX)).toBe(false);
    expect(fileViewerOeffnen).toHaveBeenCalledTimes(0);
    expect(fileOpenerOeffnen).toHaveBeenCalledTimes(0);
  });
});

// --- Die App-Sperre im Zusammenspiel ---------------------------------------------

const Pruefling: React.FC = () => {
  const { gesperrt, entsperren } = useAppSperre();
  return (
    <div>
      <span data-testid="zustand">{gesperrt ? 'gesperrt' : 'offen'}</span>
      <button onClick={entsperren}>entsperren</button>
    </div>
  );
};

const zustand = () => screen.getByTestId('zustand').textContent;

/** Einschalten, Kaltstart-Sperre lösen — danach steht die App offen. */
const appOffen = async () => {
  render(<Pruefling />);
  // Einstellung lesen und Listener anmelden laufen über Versprechen.
  for (let i = 0; i < 5; i += 1) await act(async () => { await Promise.resolve(); });
  expect(zustand()).toBe('gesperrt');
  fireEvent.click(screen.getByText('entsperren'));
  expect(zustand()).toBe('offen');
  expect(zustandsWechsel).not.toBeNull();
};

const wegwechseln = () => act(() => { zustandsWechsel!({ isActive: false }); });
const zurueckkommen = () => act(() => { zustandsWechsel!({ isActive: true }); });

describe('Die App-Sperre fragt nach einer Datei in einer fremden App nicht', () => {
  it('„sofort": Word-Dokument öffnen, drei Minuten lesen, zurück — offen', async () => {
    await appOffen();

    await act(async () => { await openFileNatively(datei(), 'plan.docx', DOCX); });
    // Die fremde App schiebt sich kurz nach der Antwort des Plugins davor.
    vi.advanceTimersByTime(300);
    wegwechseln();
    vi.advanceTimersByTime(3 * 60 * 1000);
    zurueckkommen();

    expect(zustand()).toBe('offen');
  });

  it('„Nach 1 Minute": fünf Minuten in der fremden App, zurück — offen', async () => {
    mockLesen.mockResolvedValue('1min');
    await appOffen();

    await act(async () => { await openFileNatively(datei(), 'plan.docx', DOCX); });
    vi.advanceTimersByTime(300);
    wegwechseln();
    vi.advanceTimersByTime(5 * 60 * 1000);
    zurueckkommen();

    expect(zustand()).toBe('offen');
  });

  // Die Gegenseite: Der Ausflug ist eng begrenzt und schluckt kein echtes
  // Verlassen der App.
  it('ohne Datei: wegwechseln und zurück sperrt bei „sofort"', async () => {
    await appOffen();

    wegwechseln();
    vi.advanceTimersByTime(3 * 60 * 1000);
    zurueckkommen();

    expect(zustand()).toBe('gesperrt');
  });

  it('wer nach dem Nachlauf die App verlässt, verlässt sie wirklich — gesperrt', async () => {
    await appOffen();

    await act(async () => { await openFileNatively(datei(), 'plan.docx', DOCX); });
    vi.advanceTimersByTime(DATEI_NACHLAUF_MS);
    wegwechseln();
    vi.advanceTimersByTime(1000);
    zurueckkommen();

    expect(zustand()).toBe('gesperrt');
  });
});
