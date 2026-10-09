/**
 * S10 (docs/messung/umami.md, Simon 09.10.2026): Einladungen beantwortet.
 *
 * Gerendert über den Hook, den App und Web-Fassung des Profils gemeinsam
 * nutzen (shared/EinladungenKarte, useEinladungen):
 *   - Gemeldet wird erst, wenn POST /einladungen/:id/annehmen|ablehnen
 *     GEANTWORTET hat — genau `antwort`, sonst nichts (keine Gemeinde, keine
 *     Kennung, kein Name).
 *   - Scheitert die Anfrage, wird nichts gemeldet.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
vi.mock('../../services/api', () => ({
  default: {
    get: (...a: unknown[]) => mockApiGet(...a),
    post: (...a: unknown[]) => mockApiPost(...a),
  },
}));

const mockTrackHandlung = vi.fn();
vi.mock('../../services/analytics', () => ({
  trackHandlung: (...a: unknown[]) => mockTrackHandlung(...a),
}));

const mockSetError = vi.fn();
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ setSuccess: vi.fn(), setError: mockSetError, isOnline: true }),
}));

import { useEinladungen } from '../../components/shared/EinladungenKarte';

const EINLADUNG = { id: 12, organization_display_name: 'Kirchengemeinde Hennstedt', role_name: 'teamer', eingeladen_von_name: 'Emilia Petersen' };

beforeEach(() => {
  vi.clearAllMocks();
  mockApiGet.mockResolvedValue({ data: [EINLADUNG] });
  vi.spyOn(window, 'setTimeout');
});

describe('einladung-beantwortet', () => {
  it('abgelehnt: erst nach der Antwort, nur die Antwort', async () => {
    let antworten: (v: unknown) => void = () => {};
    mockApiPost.mockReturnValue(new Promise((r) => { antworten = r; }));
    const { result } = renderHook(() => useEinladungen());
    await waitFor(() => expect(result.current.einladungen).toHaveLength(1));

    let lauf: Promise<void> = Promise.resolve();
    act(() => { lauf = result.current.antworten(12, 'ablehnen'); });
    expect(mockApiPost).toHaveBeenCalledWith('/einladungen/12/ablehnen');
    expect(mockTrackHandlung).not.toHaveBeenCalled();

    await act(async () => { antworten({ data: {} }); await lauf; });
    expect(mockTrackHandlung).toHaveBeenCalledTimes(1);
    expect(mockTrackHandlung).toHaveBeenCalledWith('einladung-beantwortet', { antwort: 'abgelehnt' });
  });

  it('angenommen', async () => {
    mockApiPost.mockResolvedValue({ data: { organization: { display_name: 'Kirchengemeinde Hennstedt' } } });
    const { result } = renderHook(() => useEinladungen());
    await waitFor(() => expect(result.current.einladungen).toHaveLength(1));
    await act(async () => { await result.current.antworten(12, 'annehmen'); });
    expect(mockTrackHandlung).toHaveBeenCalledWith('einladung-beantwortet', { antwort: 'angenommen' });
  });

  it('gescheitert: nichts gemeldet', async () => {
    mockApiPost.mockRejectedValue({ response: { status: 409, data: { error: 'Schon beantwortet' } } });
    const { result } = renderHook(() => useEinladungen());
    await waitFor(() => expect(result.current.einladungen).toHaveLength(1));
    await act(async () => { await result.current.antworten(12, 'ablehnen'); });
    expect(mockSetError).toHaveBeenCalledTimes(1);
    expect(mockTrackHandlung).not.toHaveBeenCalled();
  });
});
