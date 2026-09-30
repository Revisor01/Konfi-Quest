import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Das Ende einer schrittweise gezeigten Liste: ein Knopf, der sagt, wie viele
// noch fehlen, und das Nachladen beim Scrollen (Audit Tests 26.09.2026,
// BF-10: ohne Test). Gerendert.
//
// IonInfiniteScroll ist nachgestellt: Im Test läuft die Ionic-Hülle im
// Node-Modus und setzt weder Eigenschaften (threshold) noch Ionic-Ereignisse
// (ionInfinite) auf das Element. Die Attrappe gibt beides so weiter, wie Ionic
// es tut: die Schwelle als Wert, das Ereignis mit dem Element als target.
vi.mock('@ionic/react', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@ionic/react')>();
  type Nachlader = { threshold?: string; onIonInfinite?: (e: { target: EventTarget }) => void; children?: React.ReactNode };
  return {
    ...echt,
    IonInfiniteScroll: ({ threshold, onIonInfinite, children }: Nachlader) => (
      <div
        data-testid="nachlader"
        data-schwelle={threshold}
        onClick={(e) => onIonInfinite?.({ target: e.currentTarget })}
      >
        {children}
      </div>
    ),
  };
});

import WeitereEintraege from '../../../components/shared/WeitereEintraege';
import { LISTE_SCHRITT } from '../../../hooks/useSchrittweiseListe';

const knopf = () => document.querySelector('ion-button') as HTMLElement | null;

afterEach(() => { vi.useRealTimers(); });

describe('WeitereEintraege', () => {
  it('rendert nichts, solange alles zu sehen ist', () => {
    const { container } = render(<WeitereEintraege weitere={0} onMehr={vi.fn()} bezeichnung="Konfis" />);
    expect(container.innerHTML).toBe('');
  });

  it('weniger als ein Schritt übrig: der Knopf nennt genau diese Zahl', () => {
    render(<WeitereEintraege weitere={12} onMehr={vi.fn()} bezeichnung="Konfis" />);
    expect(knopf()!.textContent).toBe('Weitere 12 Konfis zeigen (noch 12)');
  });

  it('mehr als ein Schritt übrig: der Knopf nennt den Schritt und den Rest', () => {
    expect(LISTE_SCHRITT).toBe(30);
    render(<WeitereEintraege weitere={75} onMehr={vi.fn()} bezeichnung="Aktivitäten" />);
    expect(knopf()!.textContent).toBe('Weitere 30 Aktivitäten zeigen (noch 75)');
  });

  it('Antippen des Knopfs holt die nächsten Einträge', () => {
    const onMehr = vi.fn();
    render(<WeitereEintraege weitere={40} onMehr={onMehr} bezeichnung="Events" />);
    fireEvent.click(knopf()!);
    expect(onMehr).toHaveBeenCalledTimes(1);
  });

  it('Scrollen an das Listenende holt ebenfalls nach und gibt die Schwelle erst danach frei', () => {
    vi.useFakeTimers();
    const onMehr = vi.fn();
    render(<WeitereEintraege weitere={40} onMehr={onMehr} bezeichnung="Events" />);
    const el = screen.getByTestId('nachlader') as HTMLElement & { complete?: () => Promise<void> };
    const complete = vi.fn(async () => undefined);
    el.complete = complete;

    fireEvent.click(el);
    expect(onMehr).toHaveBeenCalledTimes(1);
    // Nicht im selben Durchlauf freigeben, sonst meldet sich die Schwelle
    // sofort noch einmal, weil die Liste noch nicht länger ist.
    expect(complete).toHaveBeenCalledTimes(0);
    act(() => { vi.runAllTimers(); });
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('der Nachlader greift schon 800 px vor dem Listenende', () => {
    render(<WeitereEintraege weitere={40} onMehr={vi.fn()} bezeichnung="Events" />);
    expect(screen.getByTestId('nachlader').getAttribute('data-schwelle')).toBe('800px');
  });
});
