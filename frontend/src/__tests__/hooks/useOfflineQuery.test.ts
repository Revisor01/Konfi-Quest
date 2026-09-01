import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// --- Mocks ---

const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();
const mockCacheIsStale = vi.fn();

vi.mock('../../services/offlineCache', () => ({
  offlineCache: {
    get: (...args: unknown[]) => mockCacheGet(...args),
    set: (...args: unknown[]) => mockCacheSet(...args),
    isStale: (...args: unknown[]) => mockCacheIsStale(...args),
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
    let resolveFetcher!: (value: unknown) => void;
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

  it('org:switched-Event loest erneuten Fetch aus (Multi-Org-Switcher)', async () => {
    const fetcher = vi.fn().mockResolvedValue({ org: 1 });
    renderHook(() => useOfflineQuery('org-switch-key', fetcher));

    // Initialer Fetch
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    // Org-Wechsel feuert das Event -> Hook muss erneut laden
    window.dispatchEvent(new CustomEvent('org:switched'));

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });

  it('sync:reconnect-Event loest erneuten Fetch aus (Socket-Reconnect)', async () => {
    const fetcher = vi.fn().mockResolvedValue({ v: 1 });
    renderHook(() => useOfflineQuery('reconnect-key', fetcher));

    // Initialer Fetch
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    // Socket-Reconnect feuert das Event -> sichtbare View muss frisch laden
    window.dispatchEvent(new CustomEvent('sync:reconnect'));

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });

  it('sync:reconnect revalidiert NICHT wenn offline', async () => {
    const fetcher = vi.fn().mockResolvedValue({ v: 1 });
    renderHook(() => useOfflineQuery('reconnect-offline-key', fetcher));

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    // Offline: der Reconnect-Handler darf keinen Fetch auslösen
    mockIsOnline = false;
    window.dispatchEvent(new CustomEvent('sync:reconnect'));

    // Kurz warten und sicherstellen, dass kein zweiter Fetch kam
    await new Promise((r) => setTimeout(r, 50));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  // In-flight-Dedupe (24.08.2026): Mount-Load und useIonViewWillEnter(refresh)
  // feuerten beim ersten Öffnen parallel -> GET /chat/rooms lief in allen drei
  // Rollen doppelt. Verbotener Fall: zweiter identischer Request während der
  // erste noch läuft. Erlaubter Fall: sequentielles refresh() lädt erneut.
  it('paralleles refresh() während laufendem Fetch startet KEINEN zweiten Request', async () => {
    let resolveFetch: (v: unknown) => void;
    const fetcher = vi.fn().mockImplementation(
      () => new Promise((resolve) => { resolveFetch = resolve; })
    );

    const { result } = renderHook(() => useOfflineQuery('dedupe-key', fetcher));

    // Mount-Load hängt noch im fetcher
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    // Zweiter Aufruf während der erste läuft (entspricht useIonViewWillEnter)
    const second = result.current.refresh();

    resolveFetch!({ v: 'einmal' });
    await second;

    await waitFor(() => expect(result.current.data).toEqual({ v: 'einmal' }));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  // Zweiter Teil des Doppel-Load-Fixes: useIonViewWillEnter(refresh) feuert
  // VOR dem Mount-Effekt und ist längst fertig, wenn dessen langsames
  // offlineCache.get zurückkommt (gemessen 24.08.2026: zweiter GET /chat/rooms
  // ~400 ms nach dem ersten). Der Initial-Load darf dann NICHT sofort erneut
  // laden — die Daten sind sekundenfrisch.
  it('Initial-Load ueberspringt Revalidierung, wenn refresh() gerade erst geladen hat', async () => {
    // cache.get langsam -> refresh() gewinnt das Rennen und ist fertig,
    // bevor der Initial-Load seinen Zweig waehlt
    let resolveCacheGet: (v: unknown) => void;
    mockCacheGet.mockImplementation(
      () => new Promise((resolve) => { resolveCacheGet = resolve; })
    );
    const fetcher = vi.fn().mockResolvedValue({ v: 'frisch' });

    const { result } = renderHook(() => useOfflineQuery('viewenter-key', fetcher));

    // refresh() (entspricht useIonViewWillEnter) laeuft durch, waehrend
    // der Initial-Load noch im cache.get haengt
    await result.current.refresh();
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Jetzt kommt der Initial-Load aus dem Cache-Lookup zurueck (Cache leer)
    resolveCacheGet!(null);
    await new Promise((r) => setTimeout(r, 50));

    // KEIN zweiter identischer Request; die Daten aus refresh() stehen bereit
    expect(fetcher).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.data).toEqual({ v: 'frisch' }));
    expect(result.current.loading).toBe(false);
  });

  // Regression 25.08.2026: Das In-flight-Dedupe verschluckte Live-Ereignisse.
  // Trifft ein Socket-Ereignis ein, waehrend fuer denselben Key schon ein Abruf
  // laeuft, gab revalidate() dessen Promise zurueck — der aber VOR der Aenderung
  // startete und den alten Stand liefert. Ein Nachfolge-Abruf entstand nie, die
  // Aenderung war fuer alle unsichtbar.
  // Verbotener Fall: nach dem Dedupe bleibt der veraltete Stand stehen.
  // Erlaubter Fall (Test darueber): Mount-Load + useIonViewWillEnter bleiben dedupt.
  it('refreshLive() waehrend laufendem Fetch laedt danach den NEUEN Stand nach', async () => {
    let resolveErster: (v: unknown) => void;
    const fetcher = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveErster = resolve; }))
      .mockResolvedValueOnce({ v: 'NEU' });

    const { result } = renderHook(() => useOfflineQuery('live-key', fetcher));

    // Mount-Load haengt noch im fetcher (Server-Stand zu diesem Zeitpunkt: ALT)
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    // Jemand aendert etwas -> Socket-Ereignis loest refreshLive() aus
    const live = result.current.refreshLive();

    // Der laufende Abruf kommt mit dem alten Stand zurueck
    resolveErster!({ v: 'ALT' });
    await live;

    // Der neue Stand muss ankommen, nicht der alte.
    await waitFor(() => expect(result.current.data).toEqual({ v: 'NEU' }));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('mehrere Live-Ereignisse waehrend eines Abrufs loesen nur EINEN Nachfolge-Abruf aus', async () => {
    let resolveErster: (v: unknown) => void;
    const fetcher = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveErster = resolve; }))
      .mockResolvedValueOnce({ v: 'NEU' });

    const { result } = renderHook(() => useOfflineQuery('live-burst-key', fetcher));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    // Drei Ereignisse in schneller Folge (z.B. Sammel-Anwesenheit)
    const a = result.current.refreshLive();
    const b = result.current.refreshLive();
    const c = result.current.refreshLive();

    resolveErster!({ v: 'ALT' });
    await Promise.all([a, b, c]);

    await waitFor(() => expect(result.current.data).toEqual({ v: 'NEU' }));
    // Genau ein Nachfolge-Abruf, kein Sturm
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('sequentielles refresh() nach abgeschlossenem Fetch laedt erneut', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ v: 1 })
      .mockResolvedValueOnce({ v: 2 });

    const { result } = renderHook(() => useOfflineQuery('sequential-key', fetcher));

    await waitFor(() => expect(result.current.data).toEqual({ v: 1 }));
    expect(fetcher).toHaveBeenCalledTimes(1);

    await result.current.refresh();

    await waitFor(() => expect(result.current.data).toEqual({ v: 2 }));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
