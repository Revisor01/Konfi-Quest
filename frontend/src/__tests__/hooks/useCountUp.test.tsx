// hooks/useCountUp: Die Zahl einer Rueckblick-Seite zaehlt erst hoch, wenn die
// Seite sichtbar ist, und endet genau auf dem Ziel.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCountUp } from '../../hooks/useCountUp';

// requestAnimationFrame und performance.now selbst steuern: jedes Bild 100 ms.
let jetzt = 0;
let bilder = new Map<number, FrameRequestCallback>();
let naechsteId = 1;
const bild = () => {
  jetzt += 100;
  const offen = bilder;
  bilder = new Map();
  offen.forEach((f) => f(jetzt));
};

beforeEach(() => {
  jetzt = 0;
  bilder = new Map();
  vi.spyOn(performance, 'now').mockImplementation(() => jetzt);
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => { const id = naechsteId++; bilder.set(id, f); return id; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { bilder.delete(id); });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('useCountUp', () => {
  it('unsichtbare Seite: bleibt bei 0 und plant kein Bild', () => {
    const { result } = renderHook(() => useCountUp(42, false));
    expect(result.current).toBe(0);
    expect(bilder.size).toBe(0);
  });

  it('sichtbar: zaehlt mit Abbremsen hoch und endet genau auf dem Ziel', () => {
    const { result } = renderHook(() => useCountUp(100, true, 1000));
    act(() => bild());
    // 10 % der Zeit, ease-out cubic: 1 - 0,9^3 = 0,271
    expect(result.current).toBe(27);
    act(() => { for (let i = 0; i < 4; i++) bild(); });
    // 50 %: 1 - 0,5^3 = 0,875
    expect(result.current).toBe(87);
    act(() => { for (let i = 0; i < 5; i++) bild(); });
    expect(result.current).toBe(100);
    expect(bilder.size).toBe(0);
  });

  it('Ziel 0 oder negativ: 0, ohne Bild', () => {
    const { result } = renderHook(() => useCountUp(0, true));
    expect(result.current).toBe(0);
    expect(bilder.size).toBe(0);
  });

  it('weggewischt: zurueck auf 0, das laufende Bild wird abgebrochen', () => {
    const { result, rerender } = renderHook(({ aktiv }) => useCountUp(100, aktiv, 1000), { initialProps: { aktiv: true } });
    act(() => bild());
    expect(result.current).toBe(27);
    rerender({ aktiv: false });
    expect(result.current).toBe(0);
    expect(bilder.size).toBe(0);
  });

  it('beim Abbau bleibt kein Bild offen', () => {
    const { unmount } = renderHook(() => useCountUp(100, true));
    expect(bilder.size).toBe(1);
    unmount();
    expect(bilder.size).toBe(0);
  });
});
