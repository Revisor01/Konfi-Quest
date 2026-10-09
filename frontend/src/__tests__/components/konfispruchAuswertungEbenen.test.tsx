/**
 * Reiter „Sprüche" unter Betrieb: Auswahl der Ebene (Simon, 09.10.2026:
 * Auswertung nach Gemeinde, Kirchenkreis und Landeskirche).
 *
 * Gerendert, App- und Web-Fassung: Ebene wählen lädt mit `ebene` und `id`
 * des ersten Eintrags, ein anderer Eintrag lädt neu, „Alle" lädt ohne
 * Parameter. Die Liste zeigt die Sprüche der Ebene, eigene im Wortlaut; die
 * Auswahl nennt Einträge mit Zusatz und Anzahl. Ohne Einträge ein Hinweis
 * statt einer leeren Liste.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { createContext, useContext } from 'react';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';

const mockGet = vi.fn();
vi.mock('../../services/api', () => ({ default: { get: (...a: unknown[]) => mockGet(...a) } }));

// JSDOM reicht ionChange nicht an React durch: Segment und Auswahl als
// einfache Knöpfe und ein natives Auswahlfeld.
vi.mock('@ionic/react', () => {
  type P = { children?: React.ReactNode };
  const SegmentWahl = createContext<(w: string) => void>(() => {});
  return {
    IonSpinner: () => <div data-testid="laedt" />,
    IonLabel: ({ children }: P) => <span>{children}</span>,
    IonItem: ({ children }: P) => <div>{children}</div>,
    IonSegment: ({ children, onIonChange }: P & { onIonChange?: (e: { detail: { value: string } }) => void }) => (
      <SegmentWahl.Provider value={(w) => onIonChange?.({ detail: { value: w } })}><div role="tablist">{children}</div></SegmentWahl.Provider>
    ),
    IonSegmentButton: ({ children, value }: P & { value: string }) => {
      const waehle = useContext(SegmentWahl);
      return <button type="button" role="tab" onClick={() => waehle(value)}>{children}</button>;
    },
    IonSelect: ({ children, value, onIonChange, 'aria-label': label }: P & { value: unknown; 'aria-label'?: string; onIonChange?: (e: { detail: { value: string } }) => void }) => (
      <select aria-label={label} value={String(value)} onChange={(e) => onIonChange?.({ detail: { value: e.target.value } })}>{children}</select>
    ),
    IonSelectOption: ({ children, value }: P & { value: unknown }) => <option value={String(value)}>{children}</option>,
    IonIcon: () => null,
  };
});

import KonfispruchAuswertung from '../../components/admin/KonfispruchAuswertung';

const AUSWAHL = {
  landeskirchen: [{ id: 7, name: 'Nordkirche', anzahl: 3 }],
  kirchenkreise: [
    { id: 11, name: 'Dithmarschen', landeskirche: 'Nordkirche', anzahl: 2 },
    { id: 12, name: 'Plön-Segeberg', landeskirche: null, anzahl: 1 },
  ],
  gemeinden: [{ id: 1, name: 'St. Martin', kirchenkreis: 'Dithmarschen', anzahl: 2 }],
};

const antwort = (ebene: { art: string; id: number | null }, zusatz: Record<string, unknown> = {}) => ({
  data: {
    gesamt: { wahlen: 3, vorschlag: 2, eigen: 1, aus_bestand: 0 },
    uebersetzungen: [{ translation: 'bigs', anzahl: 2 }],
    sprueche: [{ stelle: 'Josua 1,9', anzahl: 2 }],
    eigene: [{ freitext: 'Fürchte dich nicht', freitext_referenz: 'Jes 43,1', anzahl: 1 }],
    monate: [{ monat: '2026-10', anzahl: 3 }],
    ebene,
    auswahl: AUSWAHL,
    ...zusatz,
  },
});

beforeEach(() => {
  cleanup();
  mockGet.mockReset();
  mockGet.mockImplementation((_url: string, opts?: { params: { ebene: string; id: number } }) =>
    Promise.resolve(antwort(opts ? { art: opts.params.ebene, id: opts.params.id } : { art: 'alle', id: null })));
});

describe.each([
  ['App', false],
  ['Web', true],
])('KonfispruchAuswertung, Ebenen (%s)', (_name, web) => {
  it('Kirchenkreis wählen lädt den ersten Eintrag, ein anderer lädt neu, „Alle" ohne Parameter', async () => {
    render(<KonfispruchAuswertung web={web} />);
    await waitFor(() => expect(screen.getByText(/Wahlen über alle Gemeinden/)).toBeTruthy());
    expect(mockGet).toHaveBeenLastCalledWith('/metrics/konfisprueche');

    fireEvent.click(screen.getByRole(web ? 'button' : 'tab', { name: 'Kirchenkreis' }));
    await waitFor(() => expect(screen.getByText(/3 Wahlen in Dithmarschen/)).toBeTruthy());
    expect(mockGet).toHaveBeenLastCalledWith('/metrics/konfisprueche', { params: { ebene: 'kirchenkreis', id: 11 } });
    expect(screen.getByText(/wie sie beim Wählen zugeordnet waren/)).toBeTruthy();

    const feld = screen.getByLabelText('Kirchenkreis') as HTMLSelectElement;
    expect(Array.from(feld.options).map((o) => o.textContent)).toEqual([
      'Dithmarschen · Nordkirche (2)',
      'Plön-Segeberg (1)',
    ]);
    fireEvent.change(feld, { target: { value: '12' } });
    await waitFor(() => expect(screen.getByText(/3 Wahlen in Plön-Segeberg/)).toBeTruthy());
    expect(mockGet).toHaveBeenLastCalledWith('/metrics/konfisprueche', { params: { ebene: 'kirchenkreis', id: 12 } });
    expect(screen.getByText('Jes 43,1').closest('li')!.textContent).toBe('Jes 43,1 — Fürchte dich nicht1');

    fireEvent.click(screen.getByRole(web ? 'button' : 'tab', { name: 'Alle' }));
    await waitFor(() => expect(screen.getByText(/Wahlen über alle Gemeinden/)).toBeTruthy());
    expect(mockGet).toHaveBeenLastCalledWith('/metrics/konfisprueche');
    expect(screen.queryByLabelText('Kirchenkreis')).toBeNull();
  });

  it('Gemeinde: Name mit Kirchenkreis in der Auswahl, ohne Satz zur Zuordnung', async () => {
    render(<KonfispruchAuswertung web={web} />);
    await waitFor(() => expect(screen.getByText(/Wahlen über alle Gemeinden/)).toBeTruthy());
    fireEvent.click(screen.getByRole(web ? 'button' : 'tab', { name: 'Gemeinde' }));
    await waitFor(() => expect(screen.getByText(/3 Wahlen in St. Martin/)).toBeTruthy());
    expect(mockGet).toHaveBeenLastCalledWith('/metrics/konfisprueche', { params: { ebene: 'gemeinde', id: 1 } });
    expect((screen.getByLabelText('Gemeinde') as HTMLSelectElement).options[0].textContent).toBe('St. Martin · Dithmarschen (2)');
    expect(screen.queryByText(/wie sie beim Wählen zugeordnet waren/)).toBeNull();
  });

  it('Ebene ohne Einträge: Hinweis, keine Anfrage, keine Liste', async () => {
    mockGet.mockImplementation(() => Promise.resolve(antwort({ art: 'alle', id: null }, { auswahl: { ...AUSWAHL, landeskirchen: [] } })));
    render(<KonfispruchAuswertung web={web} />);
    await waitFor(() => expect(screen.getByText(/Wahlen über alle Gemeinden/)).toBeTruthy());
    const anfragen = mockGet.mock.calls.length;
    fireEvent.click(screen.getByRole(web ? 'button' : 'tab', { name: 'Landeskirche' }));
    expect(screen.getByText('Noch keine Wahlen aus einer Gemeinde mit Landeskirche.')).toBeTruthy();
    expect(screen.queryByText('Josua 1,9')).toBeNull();
    expect(mockGet.mock.calls.length).toBe(anfragen);
  });
});
