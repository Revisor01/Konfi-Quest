// "Medien-Cache leeren" in den Profil-Seiten (useMediaCacheControl) --
// Verhaltenstest (Audit Tests 26.09.2026, BF-10: ohne Test).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

interface Knopf { text: string; role?: string; handler?: () => Promise<void> | void }
let alert: { header?: string; buttons: Knopf[] } | null = null;
vi.mock('@ionic/react', () => ({
  useIonAlert: () => [(optionen: typeof alert) => { alert = optionen; }],
}));
let belegt = 0;
const clearMediaCache = vi.fn(async () => { belegt = 0; });
const getMediaCacheSize = vi.fn(async () => belegt);
vi.mock('../../services/mediaCache', () => ({
  clearMediaCache: () => clearMediaCache(),
  getMediaCacheSize: () => getMediaCacheSize(),
}));

import { useMediaCacheControl } from '../../hooks/useMediaCacheControl';

beforeEach(() => {
  vi.clearAllMocks();
  alert = null;
  belegt = 0;
});

describe('Medien-Cache leeren', () => {
  it('zeigt die belegte Groesse', async () => {
    belegt = 3 * 1024 * 1024;
    const { result } = renderHook(() => useMediaCacheControl());
    await waitFor(() => expect(result.current.cacheLabel).toBe('3 MB gespeichert'));
    expect(result.current.cacheSize).toBe(3 * 1024 * 1024);
  });

  it('ohne gespeicherte Medien: "Keine Medien gespeichert"', async () => {
    const { result } = renderHook(() => useMediaCacheControl());
    await waitFor(() => expect(getMediaCacheSize).toHaveBeenCalled());
    expect(result.current.cacheLabel).toBe('Keine Medien gespeichert');
  });

  it('kann die Groesse nicht gelesen werden, gilt 0 statt eines Fehlers', async () => {
    belegt = 2048;
    getMediaCacheSize.mockRejectedValueOnce(new Error('kein Zugriff'));
    const { result } = renderHook(() => useMediaCacheControl());
    await waitFor(() => expect(getMediaCacheSize).toHaveBeenCalledTimes(1));
    expect(result.current.cacheSize).toBe(0);
    expect(result.current.cacheLabel).toBe('Keine Medien gespeichert');
  });

  it('leert erst nach der Rueckfrage und zeigt danach die neue Groesse', async () => {
    belegt = 5 * 1024;
    const { result } = renderHook(() => useMediaCacheControl());
    await waitFor(() => expect(result.current.cacheLabel).toBe('5 KB gespeichert'));

    act(() => { result.current.clearMediaCache(); });
    expect(alert?.header).toBe('Cache leeren');
    expect(clearMediaCache).not.toHaveBeenCalled();

    await act(async () => { await alert?.buttons.find((b) => b.text === 'Leeren')?.handler?.(); });
    expect(clearMediaCache).toHaveBeenCalledTimes(1);
    expect(result.current.cacheLabel).toBe('Keine Medien gespeichert');
  });

  it('Abbrechen leert nichts', () => {
    const { result } = renderHook(() => useMediaCacheControl());
    act(() => { result.current.clearMediaCache(); });
    const abbrechen = alert?.buttons.find((b) => b.text === 'Abbrechen');
    expect(abbrechen?.role).toBe('cancel');
    expect(abbrechen?.handler).toBe(undefined);
    expect(clearMediaCache).not.toHaveBeenCalled();
  });
});
