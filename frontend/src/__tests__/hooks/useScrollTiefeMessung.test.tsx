// hooks/useScrollTiefeMessung: jede Marke (25/50/75/100 %) wird je Seite
// genau einmal gemessen, und nur die Tiefe -- nichts anderes.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const track = vi.hoisted(() => vi.fn());
vi.mock('../../services/analytics', () => ({ track }));

import { useScrollTiefeMessung } from '../../hooks/useScrollTiefeMessung';

// Inhalt 2000 px, sichtbar 1000 px: scrollbar sind 1000 px.
const ereignis = (scrollTop: number, scrollHeight = 2000, clientHeight = 1000) =>
  ({ target: { scrollHeight, clientHeight }, detail: { scrollTop } }) as unknown as CustomEvent;

const marken = () => track.mock.calls.map(([name, daten]) => `${name}:${(daten as { tiefe: number }).tiefe}`);

beforeEach(() => { track.mockClear(); });

describe('useScrollTiefeMessung', () => {
  it('misst die erreichten Marken, jede nur einmal', () => {
    const { result } = renderHook(() => useScrollTiefeMessung());
    result.current(ereignis(100));
    expect(track).not.toHaveBeenCalled();
    result.current(ereignis(260));
    result.current(ereignis(300));
    expect(marken()).toEqual(['dashboard-gescrollt:25']);
    result.current(ereignis(800));
    expect(marken()).toEqual(['dashboard-gescrollt:25', 'dashboard-gescrollt:50', 'dashboard-gescrollt:75']);
    result.current(ereignis(0));
    result.current(ereignis(1000));
    result.current(ereignis(1000));
    expect(marken()).toEqual(['dashboard-gescrollt:25', 'dashboard-gescrollt:50', 'dashboard-gescrollt:75', 'dashboard-gescrollt:100']);
  });

  it('sendet nur die Tiefe als Merkmal', () => {
    const { result } = renderHook(() => useScrollTiefeMessung());
    result.current(ereignis(1000));
    expect(track).toHaveBeenCalledWith('dashboard-gescrollt', { tiefe: 100 });
    expect(track.mock.calls.every(([, daten]) => Object.keys(daten as object).join() === 'tiefe')).toBe(true);
  });

  it('eine Seite, die nicht scrollen kann, misst nichts', () => {
    const { result } = renderHook(() => useScrollTiefeMessung());
    result.current(ereignis(0, 800, 800));
    result.current(ereignis(50, 700, 800));
    expect(track).not.toHaveBeenCalled();
  });

  it('eine neu aufgebaute Seite misst wieder von vorn, ein neues Rendern derselben nicht', () => {
    const erste = renderHook(() => useScrollTiefeMessung());
    erste.result.current(ereignis(500));
    erste.rerender();
    erste.result.current(ereignis(500));
    expect(marken()).toEqual(['dashboard-gescrollt:25', 'dashboard-gescrollt:50']);
    const zweite = renderHook(() => useScrollTiefeMessung());
    zweite.result.current(ereignis(500));
    expect(marken()).toEqual(['dashboard-gescrollt:25', 'dashboard-gescrollt:50', 'dashboard-gescrollt:25', 'dashboard-gescrollt:50']);
  });
});
