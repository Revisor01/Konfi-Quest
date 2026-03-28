import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockGetStatus = vi.fn(async () => ({ connected: true, connectionType: 'wifi' }));
const mockAddListener = vi.fn((_event: string, _callback: (status: { connected: boolean }) => void) => {
  return Promise.resolve({ remove: vi.fn() });
});

vi.mock('@capacitor/network', () => ({
  Network: {
    getStatus: mockGetStatus,
    addListener: mockAddListener,
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
    getPlatform: vi.fn(() => 'web'),
  },
}));

describe('networkMonitor', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('isOnline ist initial true (optimistisch)', async () => {
    const { networkMonitor } = await import('../../services/networkMonitor');
    expect(networkMonitor.isOnline).toBe(true);
  });

  it('subscribe() registriert Listener und gibt unsubscribe zurueck', async () => {
    const { networkMonitor } = await import('../../services/networkMonitor');
    const listener = vi.fn();
    const unsubscribe = networkMonitor.subscribe(listener);
    expect(typeof unsubscribe).toBe('function');
  });

  it('unsubscribe entfernt Listener korrekt', async () => {
    const { networkMonitor } = await import('../../services/networkMonitor');
    const listener = vi.fn();
    const unsubscribe = networkMonitor.subscribe(listener);
    unsubscribe();
    // Nach unsubscribe sollte der Listener nicht mehr aufgerufen werden
    expect(listener).not.toHaveBeenCalled();
  });

  it('init() auf Web-Platform registriert Window-Events', async () => {
    const addEventSpy = vi.spyOn(window, 'addEventListener');
    const { networkMonitor } = await import('../../services/networkMonitor');

    await networkMonitor.init();

    expect(addEventSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(addEventSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    addEventSpy.mockRestore();
  });

  it('init() wird nur einmal ausgefuehrt (idempotent)', async () => {
    const { networkMonitor } = await import('../../services/networkMonitor');

    await networkMonitor.init();
    await networkMonitor.init();

    // getStatus sollte nur einmal aufgerufen worden sein
    expect(mockGetStatus).toHaveBeenCalledTimes(1);
  });

  it('subscribe liefert Status-Updates nach init und Event', async () => {
    vi.useFakeTimers();
    const { networkMonitor } = await import('../../services/networkMonitor');
    await networkMonitor.init();

    const listener = vi.fn();
    networkMonitor.subscribe(listener);

    // Simuliere offline-Event
    window.dispatchEvent(new Event('offline'));
    vi.advanceTimersByTime(300);

    expect(listener).toHaveBeenCalledWith(false);
    expect(networkMonitor.isOnline).toBe(false);

    // Simuliere online-Event
    window.dispatchEvent(new Event('online'));
    vi.advanceTimersByTime(300);

    expect(listener).toHaveBeenCalledWith(true);
    expect(networkMonitor.isOnline).toBe(true);

    vi.useRealTimers();
  });
});
