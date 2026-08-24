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
let mockOnline = true;
vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: { get isOnline() { return mockOnline; }, subscribe: vi.fn(() => () => {}) },
}));

describe('writeQueue — Chat-Bild Offline-Upload (Datenverlust-Regression)', () => {
  beforeEach(() => {
    store = {};
    mockOnline = true;
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('behaelt _localFilePath im persistierten Item und loescht die Datei NICHT bei transientem Fehler (5xx)', async () => {
    // Request schlägt mit 5xx fehl -> Item muss für Retry erhalten bleiben
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

    // Datei darf NICHT gelöscht worden sein (sonst beim Retry unwiederbringlich weg)
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

// Hilfen für die neuen Faelle
const chatItem = (clientId: string, extra: Record<string, any> = {}) => ({
  method: 'POST' as const,
  url: '/chat/rooms/1/messages',
  body: { content: 'hallo', client_id: clientId },
  maxRetries: 5,
  hasFileUpload: false,
  metadata: { type: 'chat' as const, clientId, roomId: 1 },
  ...extra,
});

describe('writeQueue — Offline-Guard (Retry-Budget nicht offline verbrennen)', () => {
  beforeEach(() => {
    store = {};
    mockOnline = true;
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('flush() versucht offline keine Requests und erhoeht retryCount nicht', async () => {
    mockOnline = false;
    const { writeQueue } = await import('../../services/writeQueue');
    await writeQueue.enqueue(chatItem('off-1'));

    const result = await writeQueue.flush();

    expect(mockPost).not.toHaveBeenCalled();
    expect(result.succeeded).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
    const persisted = JSON.parse(store['queue:items'] || '[]');
    expect(persisted).toHaveLength(1);
    expect(persisted[0].retryCount).toBe(0);
  });

  it('flushTextOnly() versucht offline keine Requests', async () => {
    mockOnline = false;
    const { writeQueue } = await import('../../services/writeQueue');
    await writeQueue.enqueue(chatItem('off-2'));

    await writeQueue.flushTextOnly();

    expect(mockPost).not.toHaveBeenCalled();
    expect(JSON.parse(store['queue:items'] || '[]')).toHaveLength(1);
  });
});

describe('writeQueue — Merker für endgueltig fehlgeschlagene Chat-Nachrichten', () => {
  beforeEach(() => {
    store = {};
    mockOnline = true;
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('4xx: Chat-Item wandert aus der Queue in den Merker (statt spurlos zu verschwinden)', async () => {
    mockPost.mockRejectedValue({ response: { status: 403, data: { error: 'Zugriff verweigert' } } });
    const { writeQueue } = await import('../../services/writeQueue');
    await writeQueue.enqueue(chatItem('perm-1'));

    const result = await writeQueue.flush();

    expect(result.failed).toHaveLength(1);
    expect(JSON.parse(store['queue:items'] || '[]')).toHaveLength(0);
    const merker = await writeQueue.getFailedChat(1);
    expect(merker).toHaveLength(1);
    expect(merker[0].clientId).toBe('perm-1');
    expect(merker[0].content).toBe('hallo');
    expect(merker[0].error.status).toBe(403);
  });

  it('maxRetries erschoepft: Chat-Item wandert in den Merker', async () => {
    mockPost.mockRejectedValue({ response: { status: 503 }, message: 'kaputt' });
    const { writeQueue } = await import('../../services/writeQueue');
    await writeQueue.enqueue(chatItem('perm-2', { maxRetries: 1 }));

    await writeQueue.flush();

    expect(JSON.parse(store['queue:items'] || '[]')).toHaveLength(0);
    const merker = await writeQueue.getFailedChat(1);
    expect(merker).toHaveLength(1);
    expect(merker[0].clientId).toBe('perm-2');
    expect(merker[0].error.status).toBe(503);
  });

  it('Nicht-Chat-Items landen NICHT im Merker', async () => {
    mockPost.mockRejectedValue({ response: { status: 403 } });
    const { writeQueue } = await import('../../services/writeQueue');
    await writeQueue.enqueue({
      method: 'POST',
      url: '/konfi/requests',
      body: { text: 'x' },
      maxRetries: 5,
      hasFileUpload: false,
      metadata: { type: 'request', clientId: 'req-1' },
    });

    await writeQueue.flush();

    expect(await writeQueue.getFailedChat()).toHaveLength(0);
  });

  it('erfolgreicher Versand derselben client_id raeumt den Merker', async () => {
    // Erst endgueltig scheitern lassen -> Merker gefuellt
    mockPost.mockRejectedValueOnce({ response: { status: 500 } });
    const { writeQueue } = await import('../../services/writeQueue');
    await writeQueue.enqueue(chatItem('wieder-1', { maxRetries: 1 }));
    await writeQueue.flush();
    expect(await writeQueue.getFailedChat(1)).toHaveLength(1);

    // Neuversand (z.B. ueber den Retry-Button) gelingt
    mockPost.mockResolvedValue({ data: { id: 5 } });
    await writeQueue.enqueue(chatItem('wieder-1'));
    await writeQueue.flush();

    expect(await writeQueue.getFailedChat(1)).toHaveLength(0);
  });

  it('forgetFailedChatMany entfernt nur die genannten Eintraege', async () => {
    mockPost.mockRejectedValue({ response: { status: 400 } });
    const { writeQueue } = await import('../../services/writeQueue');
    await writeQueue.enqueue(chatItem('a1'));
    await writeQueue.flush();
    await writeQueue.enqueue(chatItem('a2'));
    await writeQueue.flush();
    expect(await writeQueue.getFailedChat(1)).toHaveLength(2);

    await writeQueue.forgetFailedChatMany(['a1', undefined, 'gibt-es-nicht']);

    const rest = await writeQueue.getFailedChat(1);
    expect(rest).toHaveLength(1);
    expect(rest[0].clientId).toBe('a2');
  });
});

describe('writeQueue — clear() raeumt vollstaendig auf', () => {
  beforeEach(() => {
    store = {};
    mockOnline = true;
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('loescht lokale Dateien der Items und den Fehl-Merker mit', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 403 } });
    const { writeQueue } = await import('../../services/writeQueue');
    await writeQueue.enqueue(chatItem('c-fail'));
    await writeQueue.flush();
    expect(await writeQueue.getFailedChat(1)).toHaveLength(1);

    await writeQueue.enqueue(chatItem('c-file', {
      body: { content: '', client_id: 'c-file', _localFilePath: 'queue-uploads/x.jpg', _fileName: 'x.jpg' },
      hasFileUpload: true,
    }));

    await writeQueue.clear();

    expect(mockDeleteFile).toHaveBeenCalledWith({ path: 'queue-uploads/x.jpg', directory: 'DATA' });
    expect(JSON.parse(store['queue:items'] || '[]')).toHaveLength(0);
    expect(await writeQueue.getFailedChat()).toHaveLength(0);
  });

  it('clear() waehrend eines laufenden flush() laesst geleerte Items nicht wieder auferstehen', async () => {
    const { writeQueue } = await import('../../services/writeQueue');
    await writeQueue.enqueue(chatItem('r-1'));
    await writeQueue.enqueue(chatItem('r-2'));

    // Waehrend der erste Request "laeuft", leert jemand die Queue (Org-Wechsel)
    mockPost.mockImplementationOnce(async () => {
      await writeQueue.clear();
      return { data: { id: 1 } };
    });
    mockPost.mockResolvedValue({ data: { id: 2 } });

    await writeQueue.flush();

    // Ohne Schutz schreibt flush() seinen alten Arbeitsstand zurueck und
    // 'r-2' waere wieder da — und wuerde spaeter doppelt behandelt.
    expect(JSON.parse(store['queue:items'] || '[]')).toHaveLength(0);
  });
});
