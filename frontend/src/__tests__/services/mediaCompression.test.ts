import { describe, it, expect, beforeEach, vi } from 'vitest';

// jsdom hat kein URL.createObjectURL/revokeObjectURL — fuer die Tests stubben.
// Der Bild-Pfad (Canvas) laesst sich in jsdom nicht sinnvoll testen; die Tests
// nutzen den Nicht-Bild-Durchreich-Pfad von compressImage, der dieselbe
// compressForUpload-Logik (Groessen-Gate, URL-Freigabe) abdeckt.
const createSpy = vi.fn(() => 'blob:mock-url');
const revokeSpy = vi.fn();

describe('compressForUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (URL as any).createObjectURL = createSpy;
    (URL as any).revokeObjectURL = revokeSpy;
  });

  it('reicht Dateien unter dem Limit durch und gibt die Preview-URL frei', async () => {
    const { compressForUpload } = await import('../../services/mediaCompression');
    const file = new File(['klein'], 'notiz.txt', { type: 'text/plain' });

    const result = await compressForUpload(file, 1024);

    expect(result).toBe(file);
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock-url');
  });

  it('wirft bei Ueberschreitung des Limits einen deutschen Fehler', async () => {
    const { compressForUpload } = await import('../../services/mediaCompression');
    const big = new File([new Uint8Array(2048)], 'riesig.bin', { type: 'application/octet-stream' });

    await expect(compressForUpload(big, 1024)).rejects.toThrow(/zu groß/);
    // Auch im Fehlerfall darf die Preview-URL nicht leaken
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock-url');
  });

  it('Default-Limit ist 5 MB', async () => {
    const { compressForUpload } = await import('../../services/mediaCompression');
    const sixMb = new File([new Uint8Array(6 * 1024 * 1024)], 'foto.bin', { type: 'application/octet-stream' });

    await expect(compressForUpload(sixMb)).rejects.toThrow('max. 5 MB');
  });
});
