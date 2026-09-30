// Leitung kann den Jahresrückblick einer Konfi ansehen (Befund N5) --
// gerendert (Audit Tests 26.09.2026, BF-02; vorher Quelltext-Test,
// 30.09.2026 umgestellt).
//
// Halb genutzter Endpunkt: GET /wrapped/history/:userId gestattet admin und
// org_admin seit jeher den Zugriff auf die Snapshots der eigenen Gemeinde --
// im Leitungs-Baum rief ihn aber niemand auf. Kein zusätzliches
// Freigabe-Gate nötig: Snapshot-Erzeugung und wrapped_released_at laufen in
// derselben Transaktion; die Leitung sieht nichts, was die Konfi nicht selbst
// schon sehen kann.
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import {
  zustand, zuruecksetzen, konfi, oeffne, api, zuletztGeoeffnet, KONFI_ID,
} from './gerueste/leitungKonfiDetail';

beforeEach(zuruecksetzen);

const eintrag = (id: number, wrapped_type: 'konfi' | 'teamer', year: number, titel: string | null, data: Record<string, unknown> = { seiten: id }) =>
  ({ id, wrapped_type, year, titel, data });

const GESCHICHTE = [
  eintrag(1, 'konfi', 2026, 'Zwischenstand'),
  eintrag(2, 'konfi', 2025, null),
  eintrag(3, 'teamer', 2026, 'Team-Rückblick 2026'),
];

describe('Leitung kann den Jahresrückblick einer Konfi ansehen (N5)', () => {
  it('holt die Rückblicke der angezeigten Person, nicht die eigenen', async () => {
    zustand.antworten.set(`/wrapped/history/${KONFI_ID}`, GESCHICHTE);
    await oeffne();
    const pfade = api.get.mock.calls.map((c) => c[0]);
    expect(pfade).toContain(`/wrapped/history/${KONFI_ID}`);
    expect(pfade).not.toContain('/wrapped/history/5');
  });

  it('zeigt ALLE Ausgaben der passenden Rolle, mit Namen -- ohne Namen "Jahresrückblick <Jahr>"', async () => {
    zustand.antworten.set(`/wrapped/history/${KONFI_ID}`, GESCHICHTE);
    await oeffne();
    expect(screen.getByText('Zwischenstand')).toBeInTheDocument();
    expect(screen.getByText('Jahresrückblick 2025')).toBeInTheDocument();
    expect(screen.queryByText('Team-Rückblick 2026')).toBeNull();
    expect(screen.getAllByText('Der Rückblick, den diese Konfi sieht')).toHaveLength(2);
  });

  it('öffnet den Rückblick mit den geladenen Daten und dem Namen der Konfi, nicht dem der Leitung', async () => {
    zustand.antworten.set(`/wrapped/history/${KONFI_ID}`, GESCHICHTE);
    await oeffne();
    await act(async () => { fireEvent.click(screen.getByText('Zwischenstand')); });
    const modal = zuletztGeoeffnet('WrappedModal')!;
    expect(modal.props).toEqual(expect.objectContaining({
      initialData: { seiten: 1 }, initialYear: 2026, initialTitel: 'Zwischenstand',
      wrappedType: 'konfi', displayName: 'Emilia Test',
    }));
  });

  it('blendet die Karte ohne vorhandenen Rückblick aus', async () => {
    zustand.antworten.set(`/wrapped/history/${KONFI_ID}`, []);
    await oeffne();
    expect(screen.queryByText(/Rückblick, den diese/)).toBeNull();
  });

  it('... auch wenn der Abruf scheitert', async () => {
    zustand.antworten.set(`/wrapped/history/${KONFI_ID}`, new Error('404'));
    await oeffne();
    expect(screen.queryByText(/Rückblick, den diese/)).toBeNull();
  });

  it('lädt den Rückblick auch bei Teamer:innen -- dann die Team-Ausgaben', async () => {
    zustand.antworten.set(`/admin/konfis/${KONFI_ID}`, konfi({ role_name: 'teamer', name: 'Tom Teamer', display_name: 'Tom Teamer' }));
    zustand.antworten.set(`/wrapped/history/${KONFI_ID}`, GESCHICHTE);
    await oeffne();
    expect(screen.getByText('Team-Rückblick 2026')).toBeInTheDocument();
    expect(screen.queryByText('Zwischenstand')).toBeNull();
    await act(async () => { fireEvent.click(screen.getByText('Team-Rückblick 2026')); });
    expect(zuletztGeoeffnet('WrappedModal')!.props).toEqual(expect.objectContaining({ wrappedType: 'teamer', displayName: 'Tom Teamer' }));
  });

  it('bricht den Abruf beim Wechsel der Person ab: eine späte Antwort der vorigen zeigt nichts an', async () => {
    let alteAntwort: (w: unknown) => void = () => undefined;
    api.get.mockImplementation(async (pfad: string) => {
      if (pfad === `/wrapped/history/${KONFI_ID}`) return new Promise((resolve) => { alteAntwort = resolve; });
      if (pfad === '/wrapped/history/10') return { data: [] };
      const person = /^\/admin\/konfis\/(\d+)$/.exec(pfad);
      if (person) return { data: konfi({ id: Number(person[1]) }) };
      return { data: [] };
    });
    const { rerender, KonfiDetailView, onBack } = await oeffne();
    rerender(<KonfiDetailView konfiId={10} onBack={onBack} />);
    for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });

    await act(async () => { alteAntwort({ data: GESCHICHTE }); });
    expect(screen.queryByText('Zwischenstand')).toBeNull();
  });
});
