import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { QueueItem, FailedAction } from '../../services/writeQueue';

// Die Warteschlange wird nachgestellt: Der Hook soll gegen ihre Schnittstelle
// getestet werden, nicht gegen Capacitor-Speicher.
let queueItems: QueueItem[] = [];
let failedActions: FailedAction[] = [];
const melder = new Set<() => void>();

const meldeAenderung = () => { melder.forEach(l => l()); };

vi.mock('../../services/writeQueue', () => ({
  writeQueue: {
    getAll: vi.fn(async () => [...queueItems]),
    getFailedActions: vi.fn(async () => [...failedActions]),
    forgetFailedAction: vi.fn(async (id: string) => {
      failedActions = failedActions.filter(f => f.id !== id);
      meldeAenderung();
    }),
    forgetAllFailedActions: vi.fn(async () => {
      failedActions = [];
      meldeAenderung();
    }),
  },
  onQueueChanged: (l: () => void) => {
    melder.add(l);
    return () => { melder.delete(l); };
  },
}));

import { useWartendeVorgaenge } from '../../hooks/useWartendeVorgaenge';

const item = (id: string, type: QueueItem['metadata']['type'], label: string): QueueItem => ({
  id, method: 'POST', url: '/x', maxRetries: 3, retryCount: 0,
  createdAt: 0, hasFileUpload: false,
  metadata: { type, clientId: id, label },
});

describe('useWartendeVorgaenge', () => {
  beforeEach(() => {
    queueItems = [];
    failedActions = [];
    melder.clear();
    vi.clearAllMocks();
  });

  it('liefert die wartenden Vorgaenge', async () => {
    queueItems = [
      item('a', 'opt-out', 'Abmeldung'),
      item('b', 'admin', 'Kategorie erstellen'),
    ];

    const { result } = renderHook(() => useWartendeVorgaenge());

    await waitFor(() => expect(result.current.wartend).toHaveLength(2));
    expect(result.current.wartend.map(i => i.metadata.label))
      .toEqual(['Abmeldung', 'Kategorie erstellen']);
  });

  it('laesst stille Hintergrund-Aufraeumer weg', async () => {
    // 'fire-and-forget' sind Push-Token entfernen, gelesen markieren,
    // Einstellungen — die gehen niemanden etwas an und gehoeren nicht in eine
    // Anzeige "Wird gesendet...".
    queueItems = [
      item('a', 'opt-out', 'Abmeldung'),
      item('b', 'fire-and-forget', 'Mark-Read'),
    ];

    const { result } = renderHook(() => useWartendeVorgaenge());

    await waitFor(() => expect(result.current.wartend).toHaveLength(1));
    expect(result.current.wartend[0].metadata.label).toBe('Abmeldung');
  });

  it('schraenkt auf die angefragten Arten ein', async () => {
    queueItems = [
      item('a', 'opt-out', 'Abmeldung'),
      item('b', 'admin', 'Kategorie erstellen'),
      item('c', 'request', 'Aktivität melden'),
    ];

    const { result } = renderHook(() => useWartendeVorgaenge(['request']));

    await waitFor(() => expect(result.current.wartend).toHaveLength(1));
    expect(result.current.wartend[0].metadata.label).toBe('Aktivität melden');
  });

  it('aktualisiert sich, wenn sich die Warteschlange leert (der Befund)', async () => {
    // Vorher haing die Anzeige daran, dass die zugehoerige Liste neu lud.
    // Leerte sich die Queue im Hintergrund (Reconnect, App-Start), blieb
    // "Wird gesendet..." stehen, bis jemand zog.
    queueItems = [item('a', 'opt-out', 'Abmeldung')];

    const { result } = renderHook(() => useWartendeVorgaenge());
    await waitFor(() => expect(result.current.wartend).toHaveLength(1));

    await act(async () => {
      queueItems = [];
      meldeAenderung();
    });

    await waitFor(() => expect(result.current.wartend).toHaveLength(0));
  });

  it('liefert die endgueltig gescheiterten Vorgaenge', async () => {
    failedActions = [
      { id: 'f1', label: 'Abmeldung', type: 'opt-out', createdAt: 0, failedAt: 0,
        error: { status: 409, message: 'Anmeldeschluss vorbei' } },
    ];

    const { result } = renderHook(() => useWartendeVorgaenge());

    await waitFor(() => expect(result.current.gescheitert).toHaveLength(1));
    expect(result.current.gescheitert[0].error.message).toBe('Anmeldeschluss vorbei');
  });

  it('ein gescheiterter Vorgang laesst sich wegwischen', async () => {
    failedActions = [
      { id: 'f1', label: 'Abmeldung', type: 'opt-out', createdAt: 0, failedAt: 0,
        error: { status: 409, message: 'Konflikt' } },
    ];

    const { result } = renderHook(() => useWartendeVorgaenge());
    await waitFor(() => expect(result.current.gescheitert).toHaveLength(1));

    await act(async () => { await result.current.vergessen('f1'); });

    await waitFor(() => expect(result.current.gescheitert).toHaveLength(0));
  });

  it('meldet sich beim Abbau wieder ab', async () => {
    queueItems = [item('a', 'opt-out', 'Abmeldung')];

    const { unmount } = renderHook(() => useWartendeVorgaenge());
    await waitFor(() => expect(melder.size).toBe(1));

    unmount();
    expect(melder.size).toBe(0);
  });
});
