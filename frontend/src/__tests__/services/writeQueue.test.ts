import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-Memory Preferences-Store (mockt Capacitor Persistenz)
let store: Record<string, string> = {};
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: store[key] ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => { store[key] = value; }),
    remove: vi.fn(async ({ key }: { key: string }) => { delete store[key]; }),
  },
}));

const mockReadFile = vi.fn(async () => ({ data: btoa('fake-image-bytes') }));
const mockDeleteFile = vi.fn(async () => undefined);
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: {
    readFile: (...args: any[]) => mockReadFile(...args),
    deleteFile: (...args: any[]) => mockDeleteFile(...args),
  },
  Directory: { Data: 'DATA' },
}));

const mockPost = vi.fn();
vi.mock('../../services/api', () => ({
  default: { post: (...a: any[]) => mockPost(...a), put: vi.fn(), delete: vi.fn() },
}));

vi.mock('@ionic/core', () => ({ toastController: { create: vi.fn() } }));
vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: { isOnline: true, subscribe: vi.fn(() => () => {}) },
}));

describe('writeQueue — Chat-Bild Offline-Upload (Datenverlust-Regression)', () => {
  beforeEach(() => {
    store = {};
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('behaelt _localFilePath im persistierten Item und loescht die Datei NICHT bei transientem Fehler (5xx)', async () => {
    // Request schlaegt mit 5xx fehl -> Item muss fuer Retry erhalten bleiben
    mockPost.mockRejectedValue({ response: { status: 503 }, message: 'Service Unavailable' });

    const { writeQueue } = await import('../../services/writeQueue');

    await writeQueue.enqueue({
      method: 'POST',
      url: '/chat/rooms/1/messages',
      body: { _localFilePath: 'chat/abc.jpg', _fileName: 'abc.jpg', _fileType: 'image/jpeg', content: 'hi', client_id: 'c1' },
      maxRetries: 5,
      hasFileUpload: true,
      metadata: { type: 'chat', clientId: 'c1', roomId: 1 },
    });

    await writeQueue.flush();

    // Datei darf NICHT geloescht worden sein (sonst beim Retry unwiederbringlich weg)
    expect(mockDeleteFile).not.toHaveBeenCalled();

    // Persistiertes Item muss _localFilePath noch enthalten (nicht durch FormData ersetzt)
    const persisted = JSON.parse(store['queue:items'] || '[]');
    expect(persisted).toHaveLength(1);
    expect(persisted[0].body._localFilePath).toBe('chat/abc.jpg');
    expect(persisted[0].retryCount).toBe(1);
  });

  it('loescht die lokale Datei nach erfolgreichem Upload und entfernt das Item', async () => {
    mockPost.mockResolvedValue({ data: { id: 99 } });

    const { writeQueue } = await import('../../services/writeQueue');

    await writeQueue.enqueue({
      method: 'POST',
      url: '/chat/rooms/1/messages',
      body: { _localFilePath: 'chat/abc.jpg', _fileName: 'abc.jpg', _fileType: 'image/jpeg', content: 'hi', client_id: 'c2' },
      maxRetries: 5,
      hasFileUpload: true,
      metadata: { type: 'chat', clientId: 'c2', roomId: 1 },
    });

    const result = await writeQueue.flush();

    // Erfolg: Datei aufgeraeumt, Queue leer
    expect(mockDeleteFile).toHaveBeenCalledTimes(1);
    expect(result.succeeded).toHaveLength(1);
    const persisted = JSON.parse(store['queue:items'] || '[]');
    expect(persisted).toHaveLength(0);

    // Der Request muss FormData (multipart) gesendet haben, nicht den rohen Body
    const sentBody = mockPost.mock.calls[0][1];
    expect(sentBody instanceof FormData).toBe(true);
  });
});
