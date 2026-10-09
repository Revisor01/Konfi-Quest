import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, waitFor, act, cleanup, screen } from '@testing-library/react';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';
import { dateien, objectUrlAttrappe } from '../medienAttrappen';

// Haertung rund um Datei-Downloads und Aufraeumen (14.09.2026).
//
// Drei Befunde aus derselben Familie — asynchrone Arbeit, die weiterlaeuft,
// nachdem der Bildschirm weg ist, und ein Zeitlimit, das zu knapp war:
//
//  1. VideoPreview: Die Aufraeumfunktion las die Object-URL aus dem
//     Effekt-Scope. Lief sie, waehrend der Download noch lief, sah sie den
//     leeren Anfangswert — die danach erzeugte URL blieb bis zum App-Neustart
//     liegen. Ein Video wegzuscrollen genuegte.
//  2. QRDisplayModal: Das Abfrage-Intervall wurde erst NACH zwei await gesetzt.
//     Wer das Fenster vorher schloss, hinterliess eine Abfrage alle 10 s, die
//     nie wieder aufhoerte. Mehrfaches Oeffnen summierte sie.
//  3. api.ts: Das globale Zeitlimit von 20 s galt auch fuer Datei-Downloads.
//     20 MB brauchen darin durchgehend 8 Mbit/s — im Gemeindehaus unerreichbar.
//
// Gerendert bzw. aufgerufen: VideoPreview samt echtem Medien-Cache (gestellt
// sind Dateisystem, API und Netz), das QR-Fenster mit gestellter API, das
// Zeitlimit am echten Abruf. Das Abhaengen WAEHREND des Ladens (URL wird
// freigegeben, kein Fehler mehr) prueft zusaetzlich
// components/medienAnzeigeGemeinsam.test.tsx fuer Chat und Challenges.

vi.mock('@capacitor/filesystem', async () => (await import('../medienAttrappen')).dateisystemModul);

const apiGet = vi.fn();
const apiPost = vi.fn();
vi.mock('../../services/api', () => ({
  default: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
  },
  DATEI_TIMEOUT_MS: 180000,
}));
vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: { isOnline: true, subscribe: () => () => {} },
}));
vi.mock('../../utils/haptics', () => ({
  haptik: vi.fn(async () => undefined),
  ImpactStyle: { Light: 'LIGHT' },
}));
vi.mock('../../contexts/AppContext', () => ({ useApp: () => ({ isOnline: true }) }));
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async () => 'data:image/png;base64,QR') } }));

import VideoPreview from '../../components/chat/VideoPreview';
import QRDisplayModal from '../../components/shared/QRDisplayModal';
import { clearMediaCache, getMediaBlob } from '../../services/mediaCache';

/** Ein Abruf, der erst endet, wenn der Test es sagt. */
const offen = () => {
  let fertig: (wert: unknown) => void = () => undefined;
  let scheitern: (grund: unknown) => void = () => undefined;
  const zusage = new Promise((res, rej) => { fertig = res; scheitern = rej; });
  return { zusage, fertig, scheitern };
};

let urls: ReturnType<typeof objectUrlAttrappe>;

beforeEach(async () => {
  await clearMediaCache();
  dateien.clear();
  apiGet.mockReset();
  apiPost.mockReset();
  urls = objectUrlAttrappe();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('VideoPreview raeumt auch bei Abbruch waehrend des Ladens auf', () => {
  it('gibt eine URL frei, die erst nach dem Abhaengen entstanden ist', async () => {
    // Der Kern des Lecks: ohne Abbruch-Merker bleibt genau diese URL liegen.
    const download = offen();
    apiGet.mockImplementation(() => download.zusage.then(() => ({ data: new Blob(['film']) })));

    const { unmount } = render(<VideoPreview filePath="dd1" fileName="clip.mp4" />);
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1));
    unmount();
    await act(async () => { download.fertig(undefined); });

    await waitFor(() => expect(urls.erzeugt).toHaveLength(1));
    expect(urls.freigegeben).toEqual(urls.erzeugt);
  });

  it('meldet keinen Fehler mehr fuer eine weggescrollte Nachricht', async () => {
    const onError = vi.fn();
    const download = offen();
    apiGet.mockImplementation(() => download.zusage);

    const { unmount } = render(<VideoPreview filePath="dd2" fileName="clip.mp4" onError={onError} />);
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1));
    unmount();
    await act(async () => { download.scheitern(Object.assign(new Error('500'), { response: { status: 500 } })); });

    expect(onError).toHaveBeenCalledTimes(0);
  });

  it('erlaubter Fall: bleibt die Vorschau stehen, behaelt sie ihre URL und meldet den Fehler', async () => {
    apiGet.mockImplementation(async () => ({ data: new Blob(['film']) }));
    const { container } = render(<VideoPreview filePath="dd3" fileName="clip.mp4" />);
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
    expect(urls.erzeugt).toHaveLength(1);
    expect(urls.freigegeben).toEqual([]);

    cleanup();
    const onError = vi.fn();
    apiGet.mockRejectedValueOnce(Object.assign(new Error('500'), { response: { status: 500 } }));
    render(<VideoPreview filePath="dd4" fileName="clip.mp4" onError={onError} />);
    await waitFor(() => expect(onError).toHaveBeenCalledWith('Fehler beim Laden des Videos'));
  });

  it('VideoPreview laedt ueber einen eigenen, typisierten Blob', async () => {
    // Eigener Blob mit dem Typ aus dem Dateinamen: Der Server liefert
    // application/octet-stream, ohne richtigen Typ spielt iOS nicht ab. Die
    // URL gehoert damit der Vorschau und geht beim Abhaengen mit.
    const typen: string[] = [];
    (URL.createObjectURL as unknown as ReturnType<typeof vi.fn>).mockImplementation((b: Blob) => {
      typen.push(b.type);
      urls.erzeugt.push(`blob:typ-${typen.length}`);
      return `blob:typ-${typen.length}`;
    });
    apiGet.mockImplementation(async () => ({ data: new Blob(['film'], { type: 'application/octet-stream' }) }));

    const { container, unmount } = render(<VideoPreview filePath="dd5" fileName="Ausflug.MOV" />);
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
    expect(typen).toEqual(['video/quicktime']);
    unmount();
    expect(urls.freigegeben).toEqual(['blob:typ-1']);
  });
});

describe('QRDisplayModal hoert nach dem Schliessen auf abzufragen', () => {
  const oeffne = () =>
    render(<QRDisplayModal eventId={42} eventName="Konfitag" eventDate="2026-10-10T10:00:00Z" onClose={vi.fn()} />);

  it('startet das Intervall nicht mehr, wenn inzwischen geschlossen wurde', async () => {
    // Genau die Luecke: Beim Schliessen lief der Abruf des QR-Tokens noch.
    const intervall = vi.spyOn(globalThis, 'setInterval');
    const token = offen();
    apiPost.mockImplementation(() => token.zusage);
    apiGet.mockResolvedValue({ data: { checked_in: 1, total: 5 } });

    const { unmount } = oeffne();
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/events/42/generate-qr'));
    unmount();
    await act(async () => { token.fertig({ data: { qr_token: 'abc' } }); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

    expect(intervall.mock.calls.filter((c) => c[1] === 10000)).toHaveLength(0);
    expect(apiGet).toHaveBeenCalledTimes(0);
  });

  it('erlaubter Fall: offen fragt es die Anwesenheit ab und wiederholt alle 10 s', async () => {
    const intervall = vi.spyOn(globalThis, 'setInterval');
    apiPost.mockResolvedValue({ data: { qr_token: 'abc' } });
    apiGet.mockResolvedValue({ data: { checked_in: 3, total: 5 } });

    oeffne();
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/events/42/attendance-count'));
    expect(intervall.mock.calls.filter((c) => c[1] === 10000)).toHaveLength(1);
    expect(await screen.findByAltText(/QR/)).toBeTruthy();
  });

  it('raeumt das laufende Intervall beim Schliessen ab', async () => {
    const intervall = vi.spyOn(globalThis, 'setInterval');
    const abraeumen = vi.spyOn(globalThis, 'clearInterval');
    apiPost.mockResolvedValue({ data: { qr_token: 'abc' } });
    apiGet.mockResolvedValue({ data: { checked_in: 3, total: 5 } });

    const { unmount } = oeffne();
    await waitFor(() => expect(intervall.mock.calls.filter((c) => c[1] === 10000)).toHaveLength(1));
    const index = intervall.mock.calls.findIndex((c) => c[1] === 10000);
    const kennung = intervall.mock.results[index].value;
    unmount();
    expect(abraeumen.mock.calls.filter((c) => c[0] === kennung)).toHaveLength(1);
  });
});

describe('Datei-Downloads haben ein eigenes, hoeheres Zeitlimit', () => {
  it('definiert es zentral, und das globale Limit bleibt 20 s', async () => {
    // Nur Dateien brauchen mehr Zeit; fuer normale Anfragen bleibt 20 s
    // richtig, damit ein totes Netz nicht ewig haengt.
    const echt = await vi.importActual<typeof import('../../services/api')>('../../services/api');
    expect(echt.DATEI_TIMEOUT_MS).toBe(180000);
    expect(echt.default.defaults.timeout).toBe(20000);
  });

  it('nutzt es im Medien-Cache', async () => {
    apiGet.mockResolvedValue({ data: new Blob(['x'], { type: 'image/png' }) });
    await getMediaBlob('zz1', { quelle: 'chat' });
    expect(apiGet).toHaveBeenCalledTimes(1);
    expect(apiGet.mock.calls[0][1]).toMatchObject({ responseType: 'blob', timeout: 180000 });
  });

  // WAECHTER (bewusst Quelltext): Vollstaendigkeit ueber ALLE Abrufstellen --
  // eine neue Stelle mit responseType 'blob' ohne das Limit faellt nur so auf.
  it('nutzt es an JEDER Stelle, die eine Datei laedt', () => {
    const wurzel = resolve(process.cwd(), 'src');
    const treffer: string[] = [];

    const gehe = (verzeichnis: string) => {
      for (const eintrag of readdirSync(verzeichnis)) {
        const pfad = join(verzeichnis, eintrag);
        if (statSync(pfad).isDirectory()) {
          if (eintrag !== '__tests__') gehe(pfad);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(eintrag)) continue;
        const inhalt = readFileSync(pfad, 'utf8');
        if (!inhalt.includes("responseType: 'blob'")) continue;
        // Auf die VERWENDUNG pruefen, nicht auf das blosse Vorkommen: Der
        // Import allein genuegt nicht (gegengeprobt 14.09.2026).
        const abrufe = inhalt.match(/responseType: 'blob'[^}]*}/g) || [];
        const ohneLimit = abrufe.filter(a => !a.includes('DATEI_TIMEOUT_MS'));
        if (ohneLimit.length > 0) {
          treffer.push(pfad.slice(wurzel.length + 1));
        }
      }
    };
    gehe(wurzel);

    expect(treffer).toEqual([]);
  });
});
