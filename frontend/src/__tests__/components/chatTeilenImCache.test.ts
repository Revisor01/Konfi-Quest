import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dateien, Filesystem } from '../medienAttrappen';
import type { Message } from '../../types/chat';

/**
 * Teilen aus dem Chat legt die Datei im Cache ab, nicht unter Documents
 * (29.09.2026, Paket App-Größe, Punkt 5 — Dateifreigabe).
 *
 * Bis hierher schrieb nachrichtTeilen jede geteilte Datei nach
 * Directory.Documents/share/ und räumte sie nie weg. Auf dem iPhone ist das
 * der Documents-Ordner der App (mit der früheren Dateifreigabe offen in der
 * Dateien-App), auf Android der ÖFFENTLICHE Ordner „Dokumente“
 * (Environment.DIRECTORY_DOCUMENTS) — dort lesen andere Apps und jeder
 * Dateimanager mit. Geteilt werden aber Chat-Anhänge, oft Fotos von
 * Jugendlichen. Der Chat-Export tat es schon richtig (Directory.Cache); das
 * Teilen-Blatt nimmt Cache-Dateien auf beiden Systemen an (Android:
 * cache-path in file_paths.xml).
 */
vi.mock('@capacitor/filesystem', async () => (await import('../medienAttrappen')).dateisystemModul);

const teilen = vi.fn(async () => undefined);
vi.mock('../../services/systemDialoge', () => ({ teilen: (...a: unknown[]) => teilen(...(a as [])) }));
vi.mock('../../services/mediaCache', () => ({
  getMediaBlob: vi.fn(async () => new Blob(['foto'], { type: 'image/jpeg' })),
}));
vi.mock('../../services/api', () => ({ default: { get: vi.fn() }, DATEI_TIMEOUT_MS: 1000 }));

const { nachrichtTeilen } = await import('../../components/chat/chatTeilen');

describe('Chat: Datei teilen', () => {
  beforeEach(() => {
    dateien.clear();
    vi.clearAllMocks();
  });

  it('schreibt in den Cache und teilt von dort — nie nach Documents', async () => {
    const nachricht = { id: 7, file_path: 'ab12', file_name: 'foto.jpg', content: '' } as unknown as Message;
    await nachrichtTeilen(nachricht, vi.fn());

    const geschrieben = Filesystem.writeFile.mock.calls.map(([o]) => (o as { directory: string }).directory);
    expect(geschrieben).toEqual(['CACHE']);
    const uri = Filesystem.getUri.mock.calls.map(([o]) => (o as { directory: string }).directory);
    expect(uri).toEqual(['CACHE']);
    expect(teilen).toHaveBeenCalledWith(expect.objectContaining({ url: 'file:///cache/share/foto.jpg' }));
  });

  it('eine reine Textnachricht schreibt gar keine Datei', async () => {
    const nachricht = { id: 8, content: 'Hallo' } as unknown as Message;
    await nachrichtTeilen(nachricht, vi.fn());
    expect(Filesystem.writeFile).not.toHaveBeenCalled();
    expect(teilen).toHaveBeenCalledWith(expect.objectContaining({ text: 'Hallo' }));
  });
});
