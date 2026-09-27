/**
 * Funkloch als offline erkennen (Audit Grundgerüst BF-01, HOCH, 27.09.2026).
 *
 * Das Netz-Plugin meldet ohne Verbindung `connectionType: 'none'`
 * (Flugmodus, kein Empfang). Die App wertete 'none' und 'unknown' bewusst als
 * online: Android-Emulatoren und die Google-Play-Prüfumgebung melden 'none',
 * obwohl Netz da ist, und ein vorab geblockter Login hatte zu Ablehnungen im
 * Play-Store geführt (Commit 8827370e, 30.06.2026). Folge: Im echten Funkloch
 * galt die App als online, die Offline-Warteschlange schickte ins Leere und
 * warf Einträge nach drei Versuchen weg.
 *
 * Jetzt entscheidet in diesem unsicheren Fall eine echte Probe: Antwortet der
 * Server (jede Antwort, auch 503), ist die App online — der Play-Fall bleibt
 * erhalten. Kommt keine Antwort, ist sie offline, und die Probe wiederholt
 * sich, bis wieder Netz da ist oder das Plugin eine Verbindung meldet.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

type Status = { connected: boolean; connectionType?: string };
let statusListener: ((s: Status) => void) | null = null;
const mockGetStatus = vi.fn(async (): Promise<Status> => ({ connected: true, connectionType: 'wifi' }));

vi.mock('@capacitor/network', () => ({
  Network: {
    getStatus: () => mockGetStatus(),
    addListener: (_e: string, cb: (s: Status) => void) => {
      statusListener = cb;
      return Promise.resolve({ remove: vi.fn() });
    },
  },
}));

let nativ = true;
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => nativ,
    getPlatform: () => (nativ ? 'android' : 'web'),
  },
}));

const fetchMock = vi.fn();

const laden = async () => (await import('../../services/networkMonitor')).networkMonitor;

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  nativ = true;
  statusListener = null;
  mockGetStatus.mockReset().mockResolvedValue({ connected: true, connectionType: 'wifi' });
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Funkloch: das Plugin meldet keine Verbindung', () => {
  it('antwortet der Server nicht, ist die App offline', async () => {
    mockGetStatus.mockResolvedValue({ connected: false, connectionType: 'none' });
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const monitor = await laden();
    await monitor.init();
    expect(monitor.isOnline).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/health$/);
  });

  it('antwortet der Server (Play-Prüfumgebung, Emulator), bleibt sie online', async () => {
    mockGetStatus.mockResolvedValue({ connected: false, connectionType: 'none' });
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const monitor = await laden();
    await monitor.init();
    expect(monitor.isOnline).toBe(true);
  });

  it('auch "unknown" ohne Verbindung wird geprüft, nicht blind geglaubt', async () => {
    mockGetStatus.mockResolvedValue({ connected: false, connectionType: 'unknown' });
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const monitor = await laden();
    await monitor.init();
    expect(monitor.isOnline).toBe(false);
  });

  it('die Probe wiederholt sich: kommt das Netz zurück, wird die App online und meldet es', async () => {
    mockGetStatus.mockResolvedValue({ connected: false, connectionType: 'none' });
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const monitor = await laden();
    await monitor.init();
    const listener = vi.fn();
    monitor.subscribe(listener);
    expect(monitor.isOnline).toBe(false);

    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
    await vi.advanceTimersByTimeAsync(15_000);

    expect(monitor.isOnline).toBe(true);
    expect(listener).toHaveBeenCalledWith(true);
  });

  it('meldet das Plugin wieder eine Verbindung, ist die App ohne Probe online und prüft nicht weiter', async () => {
    mockGetStatus.mockResolvedValue({ connected: false, connectionType: 'none' });
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const monitor = await laden();
    await monitor.init();
    expect(monitor.isOnline).toBe(false);
    const probenVorher = fetchMock.mock.calls.length;

    statusListener!({ connected: true, connectionType: 'cellular' });
    await vi.advanceTimersByTimeAsync(300);
    expect(monitor.isOnline).toBe(true);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock.mock.calls.length).toBe(probenVorher);
  });

  it('geht die Verbindung verloren, wird geprüft — kein Netz heißt offline', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const monitor = await laden();
    await monitor.init();
    expect(monitor.isOnline).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();

    const listener = vi.fn();
    monitor.subscribe(listener);
    statusListener!({ connected: false, connectionType: 'none' });
    await vi.advanceTimersByTimeAsync(300);

    expect(monitor.isOnline).toBe(false);
    expect(listener).toHaveBeenCalledWith(false);
  });

  it('eine hängende Probe gilt nach dem Zeitlimit als keine Antwort', async () => {
    mockGetStatus.mockResolvedValue({ connected: false, connectionType: 'none' });
    fetchMock.mockImplementation((_url: string, opt: { signal?: AbortSignal }) =>
      new Promise((_ok, nein) => opt?.signal?.addEventListener('abort', () => nein(new DOMException('abgebrochen', 'AbortError'))))
    );
    const monitor = await laden();
    const init = monitor.init();
    await vi.advanceTimersByTimeAsync(4_000);
    await init;
    expect(monitor.isOnline).toBe(false);
  });
});

describe('Web: unverändert über navigator.onLine, keine Probe', () => {
  it('im Browser fragt der Monitor keinen Server', async () => {
    nativ = false;
    mockGetStatus.mockResolvedValue({ connected: false, connectionType: 'none' });
    const monitor = await laden();
    await monitor.init();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
