import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { render, renderHook, act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { useSchrittweiseListe, LISTE_SCHRITT } from '../../hooks/useSchrittweiseListe';

/*
 * Lange Leitungs-Listen schrittweise rendern (Audit 26.09.2026, Leitung BF-14).
 *
 * Gemessen am 29.09.2026 (Chromium, Android-Kennung, CPU 4-fach gedrosselt,
 * Median aus 6 Laeufen): "Verbucht" mit 416 Antraegen 10,5 s -> 1,1 s bis zur
 * letzten Zeile, die Konfi-Liste mit 150 Konfis 3,1 s -> 1,7 s. Die Zahlen
 * stehen in hooks/useSchrittweiseListe.ts.
 *
 * Geprueft wird: die Liste rendert erst LISTE_SCHRITT Zeilen, Zaehler und
 * Filter sehen weiter ALLE, "weitere zeigen" haengt an, ein neuer Filter
 * beginnt wieder oben, und kurze Listen bleiben unveraendert.
 */

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    user: { id: 1, type: 'admin', role_name: 'org_admin', organization_id: 1 },
    isOnline: true,
    setError: vi.fn(),
    setSuccess: vi.fn(),
  }),
}));
const apiGet = vi.fn();
vi.mock('../../services/api', () => ({ default: { get: (...a: unknown[]) => apiGet(...a) } }));
// JSDOM reicht ionInput nicht an React durch (wie ionChange, siehe
// biometrieSchalter.test.tsx): das Suchfeld wird ein schlichtes <input>.
vi.mock('@ionic/react', async () => {
  const echt = await vi.importActual<typeof import('@ionic/react')>('@ionic/react');
  const ReactEcht = await vi.importActual<typeof import('react')>('react');
  const IonInput = (p: { value?: string; 'aria-label'?: string; onIonInput?: (e: { detail: { value: string } }) => void }) =>
    ReactEcht.createElement('input', {
      'aria-label': p['aria-label'],
      value: p.value ?? '',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => p.onIonInput?.({ detail: { value: e.target.value } }),
    });
  return { ...echt, IonInput };
});

import ActivityRequestsView from '../../components/admin/ActivityRequestsView';
import KonfisView from '../../components/admin/KonfisView';

beforeEach(() => {
  apiGet.mockReset();
  apiGet.mockResolvedValue({ data: [] });
});
afterEach(() => cleanup());

const zeilen = (container: HTMLElement) => container.querySelectorAll('ion-item-sliding').length;

describe('useSchrittweiseListe', () => {
  const liste = Array.from({ length: 100 }, (_, i) => i);

  it('zeigt zuerst einen Schritt und meldet den Rest', () => {
    const { result } = renderHook(() => useSchrittweiseListe(liste, 'a'));
    expect(LISTE_SCHRITT).toBe(30);
    expect(result.current.sichtbar).toHaveLength(30);
    expect(result.current.sichtbar[29]).toBe(29);
    expect(result.current.weitere).toBe(70);
  });

  it('haengt je Aufruf einen Schritt an, bis alles da ist', () => {
    const { result } = renderHook(() => useSchrittweiseListe(liste, 'a'));
    act(() => result.current.mehrZeigen());
    expect(result.current.sichtbar).toHaveLength(60);
    act(() => result.current.mehrZeigen());
    act(() => result.current.mehrZeigen());
    expect(result.current.sichtbar).toHaveLength(100);
    expect(result.current.weitere).toBe(0);
  });

  it('ein neuer Schluessel (Suche, Filter, Reiter) beginnt wieder oben', () => {
    const { result, rerender } = renderHook(({ k }) => useSchrittweiseListe(liste, k), { initialProps: { k: 'a' } });
    act(() => result.current.mehrZeigen());
    expect(result.current.sichtbar).toHaveLength(60);
    rerender({ k: 'b' });
    expect(result.current.sichtbar).toHaveLength(30);
  });

  it('eine kurze Liste bleibt, wie sie ist (dasselbe Array)', () => {
    const kurz = [1, 2, 3];
    const { result } = renderHook(() => useSchrittweiseListe(kurz, 'a'));
    expect(result.current.sichtbar).toBe(kurz);
    expect(result.current.weitere).toBe(0);
  });
});

describe('Aktivitaeten-Liste der Leitung', () => {
  const antrag = (id: number) => ({
    id, konfi_id: id, konfi_name: `Konfi ${id}`, activity_id: 1, activity_name: 'Gottesdienst',
    activity_type: 'gottesdienst', activity_points: 1, requested_date: '2026-09-01',
    status: 'pending' as const, created_at: new Date(Date.UTC(2026, 8, 1) + id * 60000).toISOString(),
    updated_at: '2026-09-01T00:00:00Z',
  });

  it('rendert 35 offene Antraege in Schritten, der Zaehler nennt alle 35', async () => {
    // Klein gehalten: Ionic-Zeilen rendern in JSDOM langsam (70 Zeilen ueber 5 s).
    const antraege = Array.from({ length: 35 }, (_, i) => antrag(i + 1));
    const { container } = render(
      <ActivityRequestsView requests={antraege} onSelectRequest={() => {}} onResetRequest={() => {}} />
    );
    expect(zeilen(container)).toBe(30);
    expect(container.textContent).toContain('Aktivitäten (35)');
    fireEvent.click(screen.getByText('Weitere 5 Aktivitäten zeigen (noch 5)'));
    await waitFor(() => expect(zeilen(container)).toBe(35));
    expect(screen.queryByText(/Aktivitäten zeigen \(noch/)).toBeNull();
    expect(container.querySelector('ion-infinite-scroll')).toBeNull();
  }, 20_000);

  it('haengt am Listenende das Nachladen beim Scrollen an', () => {
    const antraege = Array.from({ length: 31 }, (_, i) => antrag(i + 1));
    const { container } = render(
      <ActivityRequestsView requests={antraege} onSelectRequest={() => {}} onResetRequest={() => {}} />
    );
    expect(container.querySelector('ion-infinite-scroll')).not.toBeNull();
  });

  it('bis 30 Antraege: alles auf einmal, kein Knopf, kein Nachladen', () => {
    const antraege = Array.from({ length: 30 }, (_, i) => antrag(i + 1));
    const { container } = render(
      <ActivityRequestsView requests={antraege} onSelectRequest={() => {}} onResetRequest={() => {}} />
    );
    expect(zeilen(container)).toBe(30);
    expect(container.querySelector('ion-infinite-scroll')).toBeNull();
    expect(screen.queryByText(/zeigen \(noch/)).toBeNull();
  });
});

describe('Konfi-Liste der Leitung', () => {
  const konfis = Array.from({ length: 150 }, (_, i) => ({
    id: i + 1, name: `Konfi ${String(i + 1).padStart(3, '0')}`, jahrgang_name: '2026/27',
    gottesdienst_points: 0, gemeinde_points: 0,
  }));
  const props = {
    konfis, jahrgaenge: [{ id: 2, name: '2026/27' }], onSelectKonfi: vi.fn(),
  };

  it('rendert 150 Konfis in Schritten, der Zaehler nennt alle 150', () => {
    const { container } = render(<KonfisView {...props} />);
    expect(zeilen(container)).toBe(30);
    expect(container.textContent).toContain('Konfis (150)');
    expect(screen.getByText('Weitere 30 Konfis zeigen (noch 120)')).toBeTruthy();
  });

  it('die Suche sieht alle 150 -- auch Namen hinter dem ersten Schritt', async () => {
    const { container } = render(<KonfisView {...props} />);
    fireEvent.change(screen.getByLabelText('Konfi suchen'), { target: { value: 'Konfi 149' } });
    await waitFor(() => expect(container.textContent).toContain('Konfis (1)'));
    expect(zeilen(container)).toBe(1);
    expect(container.textContent).toContain('Konfi 149');
  });
});
