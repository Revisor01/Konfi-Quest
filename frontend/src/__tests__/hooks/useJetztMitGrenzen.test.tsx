// hooks/useJetztMitGrenzen: Die Ansicht rechnet neu, sobald eine Grenze
// (Beginn, Ende) erreicht ist -- auch wenn sonst nichts passiert.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useJetztMitGrenzen } from '../../hooks/useJetztMitGrenzen';

const START = new Date('2026-10-09T10:00:00Z').getTime();

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(START); });
afterEach(() => { vi.useRealTimers(); });

describe('useJetztMitGrenzen', () => {
  it('ohne Grenzen: die Startzeit, kein Wecker', () => {
    const { result } = renderHook(() => useJetztMitGrenzen([]));
    expect(result.current).toBe(START);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rendert genau an der Grenze neu, nicht davor', () => {
    const ende = START + 60_000;
    const { result } = renderHook(() => useJetztMitGrenzen([ende]));
    act(() => { vi.advanceTimersByTime(59_999); });
    expect(result.current).toBe(START);
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe(ende);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('mehrere Grenzen: eine nach der anderen, vergangene und ungueltige werden uebergangen', () => {
    const beginn = START + 1_000;
    const ende = START + 5_000;
    const { result } = renderHook(() => useJetztMitGrenzen([ende, Number.NaN, START - 1_000, beginn]));
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(result.current).toBe(beginn);
    act(() => { vi.advanceTimersByTime(4_000); });
    expect(result.current).toBe(ende);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('eine Grenze weiter als 24,8 Tage wird in Etappen geplant und trotzdem getroffen', () => {
    const fern = START + 30 * 24 * 60 * 60 * 1000;
    const { result } = renderHook(() => useJetztMitGrenzen([fern]));
    act(() => { vi.advanceTimersByTime(2 ** 31 - 1); });
    // Zwischenetappe: neu gerendert, aber die Grenze ist noch nicht erreicht
    expect(result.current).toBe(START + 2 ** 31 - 1);
    expect(vi.getTimerCount()).toBe(1);
    act(() => { vi.advanceTimersByTime(fern - (START + 2 ** 31 - 1)); });
    expect(result.current).toBe(fern);
  });

  it('eine neue Grenze, die zwischen letztem Stand und jetzt liegt, wird sofort nachgezogen', () => {
    const { result, rerender } = renderHook(({ g }) => useJetztMitGrenzen(g), { initialProps: { g: [] as number[] } });
    // Die Zeit laeuft weiter, ohne dass der Hook etwas zu tun hat ...
    vi.setSystemTime(START + 10_000);
    // ... dann kommt eine Grenze dazu, die schon vorbei ist.
    rerender({ g: [START + 5_000] });
    act(() => { vi.advanceTimersByTime(0); });
    expect(result.current).toBe(START + 10_000);
  });

  it('dieselben Werte in einem neuen Array stellen den Wecker nicht neu', () => {
    const spy = vi.spyOn(globalThis, 'setTimeout');
    const { rerender } = renderHook(({ g }) => useJetztMitGrenzen(g), { initialProps: { g: [START + 60_000] } });
    const anzahl = spy.mock.calls.length;
    rerender({ g: [START + 60_000] });
    rerender({ g: [START + 60_000] });
    expect(spy.mock.calls.length).toBe(anzahl);
    spy.mockRestore();
  });

  it('beim Abbau bleibt kein Wecker stehen', () => {
    const { unmount } = renderHook(() => useJetztMitGrenzen([START + 60_000]));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
