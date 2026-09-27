import { describe, it, expect, beforeEach, vi } from 'vitest';

// jsdom hat kein URL.createObjectURL/revokeObjectURL — für die Tests stubben.
//
// Bis zum 27.09.2026 standen hier die Tests für compressForUpload, den
// eigenen Weg der Antrags-Fotos (Größen-Grenze, Freigabe der Vorschau-URL,
// Vorgabe 5 MB). Die Anträge gehen seitdem über fuerUploadVorbereiten wie
// Chat und Challenges; die drei Erwartungen ziehen mit um. Der echte
// Verkleinerungsweg (Canvas) ist in uploadVerkleinerungGemeinsam und
// nachweisfotoGemeinsam gestellt geprüft.
const createSpy = vi.fn(() => 'blob:mock-url');
const revokeSpy = vi.fn();

describe('fuerUploadVorbereiten (vorher compressForUpload der Anträge)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = createSpy;
    URL.revokeObjectURL = revokeSpy;
  });

  it('reicht eine Datei unter der Grenze unverändert durch, ohne Vorschau-URL', async () => {
    const { fuerUploadVorbereiten } = await import('../../services/mediaCompression');
    const file = new File(['klein'], 'notiz.txt', { type: 'text/plain' });

    const result = await fuerUploadVorbereiten(file, 1024);

    expect(result.file).toBe(file);
    expect(result.bildVorschau).toBeNull();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('ein zu großes Bild wirft den Satz des Servers und gibt seine Vorschau-URL frei', async () => {
    // Ein Bild, das sich nicht dekodieren lässt: Die Verkleinerung gibt das
    // Original samt Vorschau zurück, das dann über der Grenze liegt.
    (globalThis as unknown as { Image: unknown }).Image = class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_wert: string) { setTimeout(() => this.onerror?.(), 0); }
    };
    const { fuerUploadVorbereiten, UPLOAD_GRENZE } = await import('../../services/mediaCompression');
    const sechsMb = new File([new Uint8Array(6 * 1024 * 1024)], 'foto.jpg', { type: 'image/jpeg' });

    await expect(fuerUploadVorbereiten(sechsMb, UPLOAD_GRENZE.nachweisfoto)).rejects.toThrow('Datei ist zu groß (max. 5 MB).');
    // Auch im Fehlerfall darf die Vorschau-URL nicht liegen bleiben.
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock-url');
  });

  it('die Grenze des Nachweisfotos ist 5 MB wie auf dem Server', async () => {
    const { UPLOAD_GRENZE, zuGrossText } = await import('../../services/mediaCompression');

    expect(UPLOAD_GRENZE.nachweisfoto).toBe(5 * 1024 * 1024);
    expect(zuGrossText(UPLOAD_GRENZE.nachweisfoto)).toBe('Datei ist zu groß (max. 5 MB).');
  });
});
