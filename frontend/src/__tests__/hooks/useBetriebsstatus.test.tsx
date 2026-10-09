// hooks/useBetriebsstatus: liest den gemeinsamen Stand und rendert neu,
// sobald die eine Pruefung in App.tsx ihn aendert -- ohne eigene Anfrage.
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const laden = vi.hoisted(() => {
  let stand = { aktualisierenUrl: null as string | null, wartungstext: null as string | null };
  const zuhoerer = new Set<() => void>();
  return {
    abonniereBetriebsstatus: vi.fn((f: () => void) => { zuhoerer.add(f); return () => { zuhoerer.delete(f); }; }),
    holeBetriebsstatus: vi.fn(() => stand),
    pruefeBetriebsstatus: vi.fn(),
    setze(neu: typeof stand) { stand = neu; zuhoerer.forEach((f) => f()); },
    zuhoerer,
  };
});
vi.mock('../../services/betriebsstatus', () => laden);

import { useBetriebsstatus } from '../../hooks/useBetriebsstatus';

describe('useBetriebsstatus', () => {
  it('zeigt den aktuellen Stand und folgt jeder Aenderung', () => {
    const { result } = renderHook(() => useBetriebsstatus());
    expect(result.current).toEqual({ aktualisierenUrl: null, wartungstext: null });

    act(() => laden.setze({ aktualisierenUrl: null, wartungstext: 'Heute ab 22 Uhr Wartung' }));
    expect(result.current.wartungstext).toBe('Heute ab 22 Uhr Wartung');

    act(() => laden.setze({ aktualisierenUrl: 'https://apps.apple.com/app/id1', wartungstext: null }));
    expect(result.current).toEqual({ aktualisierenUrl: 'https://apps.apple.com/app/id1', wartungstext: null });
  });

  it('zwei Stellen teilen denselben Stand und loesen keine Pruefung aus', () => {
    const a = renderHook(() => useBetriebsstatus());
    const b = renderHook(() => useBetriebsstatus());
    act(() => laden.setze({ aktualisierenUrl: null, wartungstext: 'Gleich' }));
    expect(a.result.current.wartungstext).toBe('Gleich');
    expect(b.result.current.wartungstext).toBe('Gleich');
    expect(laden.pruefeBetriebsstatus).not.toHaveBeenCalled();
  });

  it('meldet sich beim Abbau ab', () => {
    const vorher = laden.zuhoerer.size;
    const { unmount } = renderHook(() => useBetriebsstatus());
    expect(laden.zuhoerer.size).toBe(vorher + 1);
    unmount();
    expect(laden.zuhoerer.size).toBe(vorher);
  });
});
