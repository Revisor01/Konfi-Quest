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

// ====================================================================
// Befund H1 (Offline-Bericht 27.08.2026): Eine vom Server ABGELEHNTE
// Nachreichung existierte fuer alles ausser Chat nur als
// 4-Sekunden-Toast. Laeuft der Flush im Hintergrund oder startet die App
// zwischendurch neu, sah die Meldung niemand — eine offline abgegebene
// Abmeldung konnte verpuffen, waehrend die App "wird gesendet"
// bestaetigt hatte.
//
// Chat-Nachrichten hatten den Schutz laengst (queue:failedChat). Diese
// Tests halten fest, dass ihn jetzt auch der Rest hat.
// ====================================================================
describe('writeQueue — H1: abgelehnte Nachreichungen verschwinden nicht mehr still', () => {
  beforeEach(() => {
    store = {};
    mockOnline = true;
    vi.clearAllMocks();
    vi.resetModules();
  });

  const optOutItem = (clientId: string) => ({
    method: 'POST' as const,
    url: '/konfi/events/5/opt-out',
    body: { reason: 'krank', client_id: clientId },
    maxRetries: 5,
    hasFileUpload: false,
    metadata: { type: 'opt-out' as const, clientId, label: 'Abmeldung' },
  });

  it('merkt sich eine vom Server abgelehnte Abmeldung dauerhaft (4xx)', async () => {
    const { writeQueue } = await import('../../services/writeQueue');
    // 4xx = endgueltig, kein Retry. Genau der Fall, den vorher nur der
    // Toast meldete.
    mockPost.mockRejectedValue({ response: { status: 409 }, message: 'Anmeldeschluss vorbei' });

    await writeQueue.enqueue(optOutItem('c-optout'));
    await writeQueue.flush();

    const gemerkt = await writeQueue.getFailedActions();
    expect(gemerkt).toHaveLength(1);
    expect(gemerkt[0].label).toBe('Abmeldung');
    expect(gemerkt[0].type).toBe('opt-out');
    expect(gemerkt[0].error.status).toBe(409);
    // Der Merker liegt persistent, ueberlebt also einen App-Neustart.
    expect(JSON.parse(store['queue:failedActions'] || '[]')).toHaveLength(1);
  });

  it('merkt sich NICHTS, solange die Queue es noch erneut versucht (5xx)', async () => {
    const { writeQueue } = await import('../../services/writeQueue');
    // 5xx = transient, das Item bleibt in der Queue. Ein Merker waere hier
    // falsch: Der Vorgang ist nicht gescheitert, nur noch nicht durch.
    mockPost.mockRejectedValue({ response: { status: 503 }, message: 'Service Unavailable' });

    await writeQueue.enqueue(optOutItem('c-optout-2'));
    await writeQueue.flush();

    expect(await writeQueue.getFailedActions()).toHaveLength(0);
    expect(JSON.parse(store['queue:items'] || '[]')).toHaveLength(1);
  });

  it('merkt sich stille Hintergrund-Aufraeumer NICHT', async () => {
    const { writeQueue } = await import('../../services/writeQueue');
    mockPost.mockRejectedValue({ response: { status: 401 }, message: 'Unauthorized' });

    await writeQueue.enqueue({
      method: 'POST' as const,
      url: '/notifications/push-token/remove',
      body: {},
      maxRetries: 1,
      hasFileUpload: false,
      metadata: { type: 'fire-and-forget' as const, clientId: 'c-ff', label: 'Push-Token entfernen' },
    });
    await writeQueue.flush();

    // Diese scheitern nach dem Logout zwangslaeufig und gehen niemanden
    // etwas an — sie bekommen schon keinen Toast, also auch keinen Merker.
    expect(await writeQueue.getFailedActions()).toHaveLength(0);
  });

  it('merkt sich Chat-Nachrichten NICHT hier — die haben ihren eigenen Merker', async () => {
    const { writeQueue } = await import('../../services/writeQueue');
    mockPost.mockRejectedValue({ response: { status: 403 }, message: 'Verboten' });

    await writeQueue.enqueue(chatItem('c-chat'));
    await writeQueue.flush();

    expect(await writeQueue.getFailedActions()).toHaveLength(0);
    // Gegenprobe: Der Chat-Merker hat sie sehr wohl.
    expect(await writeQueue.getFailedChat()).toHaveLength(1);
  });

  it('ein gemerkter Fehlschlag laesst sich verwerfen', async () => {
    const { writeQueue } = await import('../../services/writeQueue');
    mockPost.mockRejectedValue({ response: { status: 409 }, message: 'Konflikt' });

    await writeQueue.enqueue(optOutItem('c-weg'));
    await writeQueue.flush();

    const [eintrag] = await writeQueue.getFailedActions();
    await writeQueue.forgetFailedAction(eintrag.id);
    expect(await writeQueue.getFailedActions()).toHaveLength(0);
  });
});

// ====================================================================
// Umfrage-Stimme und Reaktion scheitern nicht mehr lautlos (28.08.2026)
//
// Beide wurden als 'fire-and-forget' eingereiht. handleFlushResult
// ueberspringt diesen Typ vollstaendig — kein Toast, kein Merker. Die Stimme
// wurde optimistisch angezeigt, kam aber nie an, und beim naechsten Laden war
// sie kommentarlos weg. Der Typ 'chat-aktion' trennt jetzt die bewussten
// Handlungen von den stillen Hintergrund-Aufraeumern.
// ====================================================================
describe('writeQueue — bewusste Chat-Handlungen werden gemeldet', () => {
  beforeEach(() => {
    store = {};
    mockOnline = true;
    vi.clearAllMocks();
    vi.resetModules();
  });

  const stimmItem = (clientId: string) => ({
    method: 'POST' as const,
    url: '/chat/polls/7/vote',
    body: { option_index: 0 },
    maxRetries: 3,
    hasFileUpload: false,
    metadata: { type: 'chat-aktion' as const, clientId, label: 'Abstimmung' },
  });

  it('eine abgelehnte Stimme wird gemerkt (der Befund)', async () => {
    const { writeQueue } = await import('../../services/writeQueue');
    // 409 = exklusive Option bereits vergeben. Genau der Fall, von dem
    // offline niemand erfuhr.
    mockPost.mockRejectedValue({ response: { status: 409 }, message: 'Diese Option ist bereits vergeben' });

    await writeQueue.enqueue(stimmItem('c-stimme'));
    await writeQueue.flush();

    const gemerkt = await writeQueue.getFailedActions();
    expect(gemerkt).toHaveLength(1);
    expect(gemerkt[0].label).toBe('Abstimmung');
    expect(gemerkt[0].type).toBe('chat-aktion');
    expect(gemerkt[0].error.status).toBe(409);
  });

  it('eine abgelehnte Reaktion wird gemerkt', async () => {
    const { writeQueue } = await import('../../services/writeQueue');
    mockPost.mockRejectedValue({ response: { status: 403 }, message: 'Zugriff verweigert' });

    await writeQueue.enqueue({
      method: 'POST' as const,
      url: '/chat/messages/7/reactions',
      body: { emoji: '👍' },
      maxRetries: 3,
      hasFileUpload: false,
      metadata: { type: 'chat-aktion' as const, clientId: 'c-reaktion', label: 'Reaktion' },
    });
    await writeQueue.flush();

    const gemerkt = await writeQueue.getFailedActions();
    expect(gemerkt).toHaveLength(1);
    expect(gemerkt[0].label).toBe('Reaktion');
  });

  it('stille Hintergrund-Aufraeumer bleiben still — der erlaubte Fall', async () => {
    const { writeQueue } = await import('../../services/writeQueue');
    mockPost.mockRejectedValue({ response: { status: 401 }, message: 'Unauthorized' });

    await writeQueue.enqueue({
      method: 'POST' as const,
      url: '/notifications/mark-read',
      body: {},
      maxRetries: 3,
      hasFileUpload: false,
      metadata: { type: 'fire-and-forget' as const, clientId: 'c-still', label: 'Mark-Read' },
    });
    await writeQueue.flush();

    expect(await writeQueue.getFailedActions()).toHaveLength(0);
  });

  it('eine durchgegangene Stimme wird nicht gemerkt', async () => {
    const { writeQueue } = await import('../../services/writeQueue');
    mockPost.mockResolvedValue({ data: { action: 'added' } });

    await writeQueue.enqueue(stimmItem('c-ok'));
    await writeQueue.flush();

    expect(await writeQueue.getFailedActions()).toHaveLength(0);
    expect(JSON.parse(store['queue:items'] || '[]')).toHaveLength(0);
  });
});

// ====================================================================
// Aenderungs-Melder (28.08.2026)
//
// Die Anzeige "Wird gesendet..." aktualisierte sich nur, wenn die zugehoerige
// Liste neu lud. Leerte sich die Queue im Hintergrund (Reconnect, App-Start),
// blieb der Hinweis stehen, bis jemand zog.
// ====================================================================
describe('writeQueue — meldet Aenderungen an die Anzeige', () => {
  beforeEach(() => {
    store = {};
    mockOnline = true;
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('Einreihen und erfolgreiches Senden melden je eine Aenderung', async () => {
    const { writeQueue, onQueueChanged } = await import('../../services/writeQueue');
    mockPost.mockResolvedValue({ data: {} });

    let meldungen = 0;
    const abmelden = onQueueChanged(() => { meldungen++; });

    await writeQueue.enqueue({
      method: 'POST' as const,
      url: '/konfi/events/5/opt-out',
      body: { reason: 'krank' },
      maxRetries: 5,
      hasFileUpload: false,
      metadata: { type: 'opt-out' as const, clientId: 'c-melde', label: 'Abmeldung' },
    });
    expect(meldungen).toBeGreaterThanOrEqual(1);

    const vorFlush = meldungen;
    await writeQueue.flush();
    // Das Leeren der Queue meldet sich ebenfalls — genau darauf wartet die
    // Anzeige, um den Hinweis wieder zu entfernen.
    expect(meldungen).toBeGreaterThan(vorFlush);

    abmelden();
  });

  it('Abgemeldete Melder werden nicht mehr gerufen', async () => {
    const { writeQueue, onQueueChanged } = await import('../../services/writeQueue');

    let meldungen = 0;
    const abmelden = onQueueChanged(() => { meldungen++; });
    abmelden();

    await writeQueue.enqueue({
      method: 'POST' as const,
      url: '/konfi/events/5/opt-out',
      body: { reason: 'krank' },
      maxRetries: 5,
      hasFileUpload: false,
      metadata: { type: 'opt-out' as const, clientId: 'c-ab', label: 'Abmeldung' },
    });

    expect(meldungen).toBe(0);
  });

  it('Ein kaputter Melder legt die Warteschlange nicht lahm', async () => {
    const { writeQueue, onQueueChanged } = await import('../../services/writeQueue');
    mockPost.mockResolvedValue({ data: {} });

    const abmelden = onQueueChanged(() => { throw new Error('kaputt'); });

    await writeQueue.enqueue({
      method: 'POST' as const,
      url: '/konfi/events/5/opt-out',
      body: { reason: 'krank' },
      maxRetries: 5,
      hasFileUpload: false,
      metadata: { type: 'opt-out' as const, clientId: 'c-kaputt', label: 'Abmeldung' },
    });
    const ergebnis = await writeQueue.flush();

    expect(ergebnis.succeeded).toHaveLength(1);
    expect(JSON.parse(store['queue:items'] || '[]')).toHaveLength(0);

    abmelden();
  });
});
