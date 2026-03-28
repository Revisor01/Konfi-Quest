import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// --- Mocks ---

const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();
const mockCacheIsStale = vi.fn();

vi.mock('../../services/offlineCache', () => ({
  offlineCache: {
    get: (...args: any[]) => mockCacheGet(...args),
    set: (...args: any[]) => mockCacheSet(...args),
    isStale: (...args: any[]) => mockCacheIsStale(...args),
  },
}));

let mockIsOnline = true;
const mockSubscribers = new Set<(online: boolean) => void>();

vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: {
    get isOnline() { return mockIsOnline; },
    subscribe: vi.fn((fn: (online: boolean) => void) => {
      mockSubscribers.add(fn);
      return () => { mockSubscribers.delete(fn); };
    }),
    init: vi.fn(),
  },
}));

import { useOfflineQuery } from '../../hooks/useOfflineQuery';

describe('useOfflineQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOnline = true;
    mockSubscribers.clear();
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(undefined);
    mockCacheIsStale.mockReturnValue(false);
  });

  it('loading ist initial true, wird false nach erfolgreichem Fetch', async () => {
    const fetcher = vi.fn().mockResolvedValue({ items: [1, 2, 3] });

    const { result } = renderHook(() =>
      useOfflineQuery('test-key', fetcher)
    );

    // Initial loading
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual({ items: [1, 2, 3] });
  });

  it('data enthaelt Fetch-Ergebnis nach erfolgreichem Fetch', async () => {
    const testData = { name: 'Test', count: 42 };
    const fetcher = vi.fn().mockResolvedValue(testData);

    const { result } = renderHook(() =>
      useOfflineQuery('data-key', fetcher)
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(testData);
    });

    expect(result.current.error).toBeNull();
  });

  it('error wird gesetzt wenn Fetch fehlschlaegt und kein Cache vorhanden', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('Netzwerk-Fehler'));

    const { result } = renderHook(() =>
      useOfflineQuery('error-key', fetcher)
    );

    await waitFor(() => {
      expect(result.current.error).toBe('Netzwerk-Fehler');
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it('onSuccess Callback wird nach erfolgreichem Fetch aufgerufen', async () => {
    const testData = { value: 'success' };
    const fetcher = vi.fn().mockResolvedValue(testData);
    const onSuccess = vi.fn();

    renderHook(() =>
      useOfflineQuery('success-key', fetcher, { onSuccess })
    );

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(testData);
    });
  });

  it('onError Callback wird nach fehlgeschlagenem Fetch aufgerufen', async () => {
    const fetchError = new Error('Fetch fehlgeschlagen');
    const fetcher = vi.fn().mockRejectedValue(fetchError);
    const onError = vi.fn();

    renderHook(() =>
      useOfflineQuery('error-cb-key', fetcher, { onError })
    );

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(fetchError);
    });
  });

  it('enabled=false ueberspringt Fetch, loading wird sofort false', async () => {
    const fetcher = vi.fn().mockResolvedValue('data');

    const { result } = renderHook(() =>
      useOfflineQuery('disabled-key', fetcher, { enabled: false })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });

  it('select-Funktion transformiert Daten vor Rueckgabe', async () => {
    const rawData = { items: [1, 2, 3], total: 3 };
    const fetcher = vi.fn().mockResolvedValue(rawData);
    const select = vi.fn((data: typeof rawData) => ({
      ...data,
      items: data.items.map(i => i * 10),
    }));

    const { result } = renderHook(() =>
      useOfflineQuery('select-key', fetcher, { select })
    );

    await waitFor(() => {
      expect(result.current.data).toEqual({
        items: [10, 20, 30],
        total: 3,
      });
    });

    expect(select).toHaveBeenCalledWith(rawData);
  });

  it('isOffline reflektiert networkMonitor.isOnline', async () => {
    mockIsOnline = false;
    const fetcher = vi.fn().mockResolvedValue('data');

    const { result } = renderHook(() =>
      useOfflineQuery('offline-key', fetcher)
    );

    // Wenn offline und kein Cache: loading wird false, error wird gesetzt
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isOffline).toBe(true);
  });

  it('cached Daten werden sofort geliefert, Fetch revalidiert im Hintergrund (SWR)', async () => {
    const cachedData = { data: { cached: true }, timestamp: Date.now(), ttl: 300000 };
    mockCacheGet.mockResolvedValue(cachedData);
    mockCacheIsStale.mockReturnValue(false);

    // Fetcher resolves nach Verzoegerung, damit Cache zuerst geladen wird
    let resolveFetcher!: (value: any) => void;
    const fetcher = vi.fn().mockImplementation(() => new Promise((resolve) => {
      resolveFetcher = resolve;
    }));

    const { result } = renderHook(() =>
      useOfflineQuery('swr-key', fetcher)
    );

    // Cache-Daten sofort verfuegbar
    await waitFor(() => {
      expect(result.current.data).toEqual({ cached: true });
    });

    expect(result.current.loading).toBe(false);

    // SWR: Fetcher wurde trotz Cache aufgerufen (Background-Revalidierung)
    expect(fetcher).toHaveBeenCalled();

    // Fetcher resolved — frische Daten ersetzen Cache
    const freshData = { cached: false, fresh: true };
    resolveFetcher(freshData);

    await waitFor(() => {
      expect(result.current.data).toEqual(freshData);
    });
  });
});
