// useZeitgeber: Zeitgeber, die mit der Komponente enden (offene Befunde,
// Tests und CI: "Zeitgeber, die das Schliessen einer Seite überleben").
// Dazu entprellen: mehrere Anstoesse, ein Aufruf, letzter gewinnt.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useZeitgeber, entprellen } from '../../hooks/useZeitgeber';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('useZeitgeber', () => {
  it('fuehrt aus, solange die Komponente steht (erlaubter Fall)', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useZeitgeber());
    act(() => { result.current.nach(300, fn); });
    act(() => { vi.advanceTimersByTime(299); });
    expect(fn).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('loescht beim Abbau alle offenen Zeitgeber und Bildaufbau-Rueckrufe (verbotener Fall)', () => {
    const zeit = vi.fn();
    const bild = vi.fn();
    const { result, unmount } = renderHook(() => useZeitgeber());
    act(() => {
      result.current.nach(100, zeit);
      result.current.nach(5000, zeit);
      result.current.imNaechstenBild(bild);
    });
    expect(vi.getTimerCount()).toBe(3);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(zeit).not.toHaveBeenCalled();
    expect(bild).not.toHaveBeenCalled();
  });

  it('plant nach dem Abbau nichts mehr ein (async-Kette kommt zu spaet zurueck)', () => {
    const fn = vi.fn();
    const { result, unmount } = renderHook(() => useZeitgeber());
    const zeitgeber = result.current;
    unmount();
    expect(zeitgeber.aktiv()).toBe(false);
    zeitgeber.nach(10, fn);
    zeitgeber.imNaechstenBild(fn);
    expect(vi.getTimerCount()).toBe(0);
    act(() => { vi.advanceTimersByTime(100); });
    expect(fn).not.toHaveBeenCalled();
  });

  it('beimAbbauAusfuehren: ein offenes Zuruecknehmen laeuft beim Abbau sofort, genau einmal', () => {
    const zuruecknehmen = vi.fn();
    const verwerfen = vi.fn();
    const { result, unmount } = renderHook(() => useZeitgeber());
    act(() => {
      result.current.nach(1500, zuruecknehmen, true);
      result.current.nach(1500, verwerfen);
    });
    unmount();
    expect(zuruecknehmen).toHaveBeenCalledTimes(1);
    expect(verwerfen).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(2000); });
    expect(zuruecknehmen).toHaveBeenCalledTimes(1);
  });

  it('beimAbbauAusfuehren: schon abgelaufen, laeuft es beim Abbau nicht ein zweites Mal', () => {
    const zuruecknehmen = vi.fn();
    const { result, unmount } = renderHook(() => useZeitgeber());
    act(() => { result.current.nach(100, zuruecknehmen, true); });
    act(() => { vi.advanceTimersByTime(100); });
    unmount();
    expect(zuruecknehmen).toHaveBeenCalledTimes(1);
  });

  it('der Abbruch einzelner Zeitgeber trifft nur diesen', () => {
    const a = vi.fn();
    const b = vi.fn();
    const { result } = renderHook(() => useZeitgeber());
    let abbrechenA: () => void = () => undefined;
    act(() => {
      abbrechenA = result.current.nach(100, a);
      result.current.nach(100, b);
    });
    abbrechenA();
    act(() => { vi.advanceTimersByTime(100); });
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('bleibt ueber Neu-Renderings dieselbe Instanz (taugt als Abhaengigkeit)', () => {
    const { result, rerender } = renderHook(() => useZeitgeber());
    const erste = result.current;
    rerender();
    expect(result.current).toBe(erste);
    expect(erste.aktiv()).toBe(true);
  });
});

describe('entprellen', () => {
  it('fuenf Anstoesse binnen des Fensters ergeben genau einen Aufruf, am Ende des letzten Fensters', () => {
    const fn = vi.fn();
    const e = entprellen(fn, 400);
    for (let i = 0; i < 5; i++) {
      e.ausloesen();
      vi.advanceTimersByTime(100);
    }
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('abbrechen verwirft den wartenden Aufruf', () => {
    const fn = vi.fn();
    const e = entprellen(fn, 400);
    e.ausloesen();
    e.abbrechen();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
  });

  it('Anstoesse in getrennten Fenstern loesen je einmal aus', () => {
    const fn = vi.fn();
    const e = entprellen(fn, 400);
    e.ausloesen();
    vi.advanceTimersByTime(400);
    e.ausloesen();
    vi.advanceTimersByTime(400);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
