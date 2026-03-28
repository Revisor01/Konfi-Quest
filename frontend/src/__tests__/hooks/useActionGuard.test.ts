import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActionGuard } from '../../hooks/useActionGuard';

describe('useActionGuard', () => {
  it('isSubmitting ist initial false', () => {
    const { result } = renderHook(() => useActionGuard());
    expect(result.current.isSubmitting).toBe(false);
  });

  it('guard() setzt isSubmitting auf true waehrend Ausfuehrung, danach false', async () => {
    const { result } = renderHook(() => useActionGuard());

    let resolveAction!: () => void;
    const action = () => new Promise<string>((resolve) => {
      resolveAction = () => resolve('done');
    });

    let guardPromise: Promise<string>;
    act(() => {
      guardPromise = result.current.guard(action);
    });

    // Waehrend die Action laeuft: isSubmitting true
    expect(result.current.isSubmitting).toBe(true);

    // Action abschliessen
    await act(async () => {
      resolveAction();
      await guardPromise!;
    });

    expect(result.current.isSubmitting).toBe(false);
  });

  it('guard() gibt Ergebnis der Action zurueck', async () => {
    const { result } = renderHook(() => useActionGuard());

    let returnValue: string | undefined;
    await act(async () => {
      returnValue = await result.current.guard(async () => 'test-ergebnis');
    });

    expect(returnValue).toBe('test-ergebnis');
  });

  it('guard() wirft Fehler wenn bereits eine Action laeuft', async () => {
    const { result } = renderHook(() => useActionGuard());

    let resolveFirst!: () => void;
    const firstAction = () => new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });

    // Erste Action starten (laeuft noch)
    let firstPromise: Promise<void>;
    act(() => {
      firstPromise = result.current.guard(firstAction);
    });

    // Zweite Action starten — muss werfen
    await expect(
      result.current.guard(async () => {})
    ).rejects.toThrow('Aktion l\u00e4uft bereits');

    // Aufraemen: erste Action abschliessen
    await act(async () => {
      resolveFirst();
      await firstPromise!;
    });
  });

  it('guard() setzt isSubmitting auf false auch wenn Action fehlschlaegt', async () => {
    const { result } = renderHook(() => useActionGuard());

    await act(async () => {
      try {
        await result.current.guard(async () => {
          throw new Error('Test-Fehler');
        });
      } catch {
        // Fehler erwartet
      }
    });

    expect(result.current.isSubmitting).toBe(false);
  });

  it('guard() propagiert den Fehler der Action', async () => {
    const { result } = renderHook(() => useActionGuard());

    await expect(
      act(() => result.current.guard(async () => {
        throw new Error('Spezifischer Fehler');
      }))
    ).rejects.toThrow('Spezifischer Fehler');
  });
});
