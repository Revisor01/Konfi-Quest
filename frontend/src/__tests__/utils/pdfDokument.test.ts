// utils/pdfDokument: pdf.js bekommt die Bytes, den Worker und eine eigene
// Datenquelle, die nur die eingebundenen Wasm-Decoder ausliefert.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const pdfjs = vi.hoisted(() => ({
  getDocument: vi.fn((optionen: unknown) => ({ optionen, destroy: vi.fn() })),
  GlobalWorkerOptions: { workerSrc: '' },
}));
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => pdfjs);
vi.mock('pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker&url', () => ({ default: '/assets/pdf.worker-abc.js' }));
vi.mock('pdfjs-dist/wasm/openjpeg.wasm?url', () => ({ default: '/assets/openjpeg-123.wasm' }));
vi.mock('pdfjs-dist/wasm/jbig2.wasm?url', () => ({ default: '/assets/jbig2-456.wasm' }));

import { pdfOeffnen, AppDatenQuelle } from '../../utils/pdfDokument';

const antwort = (ok: boolean, status: number, bytes: number[] = []) =>
  ({ ok, status, arrayBuffer: async () => new Uint8Array(bytes).buffer }) as Response;

let abruf: ReturnType<typeof vi.fn>;
beforeEach(() => {
  abruf = vi.fn(async () => antwort(true, 200, [1, 2, 3]));
  vi.stubGlobal('fetch', abruf);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('pdfOeffnen', () => {
  it('setzt den gebuendelten Worker (.js-Chunk) als Worker von pdf.js', () => {
    expect(pdfjs.GlobalWorkerOptions.workerSrc).toBe('/assets/pdf.worker-abc.js');
  });

  it('reicht die Bytes mit eigener Datenquelle und ohne Worker-Abruf weiter', () => {
    const daten = new Uint8Array([37, 80, 68, 70]);
    pdfOeffnen(daten);
    expect(pdfjs.getDocument).toHaveBeenCalledWith({ data: daten, BinaryDataFactory: AppDatenQuelle, useWorkerFetch: false });
  });
});

describe('AppDatenQuelle', () => {
  it('liefert die Bytes eines eingebundenen Decoders unter seiner Adresse mit Pruefsumme', async () => {
    const bytes = await new AppDatenQuelle().fetch({ kind: 'wasmUrl', filename: 'openjpeg.wasm' });
    expect(abruf).toHaveBeenCalledWith('/assets/openjpeg-123.wasm');
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
    await new AppDatenQuelle().fetch({ kind: 'wasmUrl', filename: 'jbig2.wasm' });
    expect(abruf).toHaveBeenLastCalledWith('/assets/jbig2-456.wasm');
  });

  it('Schriften und Zeichentabellen liefert sie bewusst nicht -- ohne Abruf', async () => {
    await expect(new AppDatenQuelle().fetch({ kind: 'standardFontDataUrl', filename: 'FoxitSans.pfb' }))
      .rejects.toThrow('pdf.js: standardFontDataUrl FoxitSans.pfb ist nicht eingebunden');
    await expect(new AppDatenQuelle().fetch({ kind: 'wasmUrl', filename: 'qcms.wasm' }))
      .rejects.toThrow('pdf.js: wasmUrl qcms.wasm ist nicht eingebunden');
    expect(abruf).not.toHaveBeenCalled();
  });

  it('eine nicht ladbare Datei meldet sich mit Status', async () => {
    abruf.mockResolvedValueOnce(antwort(false, 404));
    await expect(new AppDatenQuelle().fetch({ kind: 'wasmUrl', filename: 'jbig2.wasm' }))
      .rejects.toThrow('pdf.js: jbig2.wasm nicht ladbar (404)');
  });
});
