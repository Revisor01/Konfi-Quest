// Entscheidung 28.08.2026: Die Leitungssicht sagt "Verbucht" statt
// "Genehmigt". Das Wort beschreibt, was passiert ist — die Punkte sind
// gutgeschrieben — statt einen Verwaltungsakt, und es steht in der App schon
// bei den Terminen ("Verbuchen"/"Verbucht") sowie im Handbuch.
//
// Die Vorlage aus der alten Notiz ("an die Konfi-Seite angleichen") gab es
// nicht mehr: Konfis lesen heute "Dein Team schaut es sich an" und "Punkte
// sind da". Es war also eine neue Entscheidung, keine Angleichung.
//
// Gerendert: die Antragsliste der Leitung (Kachel, Reiter, Eintrag), das
// Eck-Badge und die Teamer-Liste der Leitung (Zertifikate).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@ionic/react', async () => {
  const echt = await vi.importActual<Record<string, unknown>>('@ionic/react');
  const basis = (await import('./support/ionicAttrappe')).ionicAttrappe();
  return {
    ...echt,
    ...basis,
    // Das Symbol wird sichtbar gemacht, damit der Test es vergleichen kann.
    IonIcon: ({ icon }: { icon?: string }) => <i data-testid="symbol" data-icon={icon} />,
  };
});
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    user: { id: 1, type: 'admin', organization_id: 7 },
    isOnline: true,
    setError: vi.fn(),
    setSuccess: vi.fn(),
  }),
}));
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(async (url: string) => {
      if (url === '/admin/konfis/teamer') {
        return { data: [{ id: 9, name: 'Tom Team', display_name: 'Tom Team', badge_count: 1, cert_count: 2 }] };
      }
      return { data: {} };
    }),
  },
}));

import ActivityRequestsView from '../../components/admin/ActivityRequestsView';
import StatusBadge from '../../components/shared/StatusBadge';
import KonfisView from '../../components/admin/KonfisView';
import { ICON_DATEI, ICON_TEXTDOKUMENT, ICON_ZUSAGE_GEFUELLT } from '../../components/shared/icons';

const antrag = (id: number, status: 'pending' | 'approved' | 'rejected') => ({
  id, konfi_id: id + 10, konfi_name: `Konfi ${id}`, activity_id: 3, activity_name: 'Gemeindefest',
  activity_type: 'gemeinde', activity_points: 2, requested_date: '2026-09-20', status,
  created_at: `2026-09-2${id}T10:00:00Z`, updated_at: '2026-09-25T10:00:00Z',
});

const zeigeAntraege = () =>
  render(
    <ActivityRequestsView
      requests={[antrag(1, 'approved'), antrag(2, 'pending'), antrag(3, 'approved')]}
      onSelectRequest={vi.fn()}
      onResetRequest={vi.fn()}
    />
  );

const reiter = (wort: string) =>
  screen.getAllByRole('tab').filter((t) => (t.textContent || '').startsWith(wort));

beforeEach(() => vi.clearAllMocks());

describe('Statuswort in der Leitungssicht', () => {
  it('sagt "Verbucht", nicht "Genehmigt"', () => {
    const { container } = zeigeAntraege();
    fireEvent.click(reiter('Verbucht')[0]);
    expect(container.textContent).toContain('Verbucht');
    expect(container.textContent).not.toContain('Genehmigt');
    expect(container.querySelectorAll('[aria-label="Genehmigt"]')).toHaveLength(0);
  });

  it('nutzt das Wort an allen drei Stellen — Kachel, Reiter, Eintrag', () => {
    // Kachel und Filterreiter schalten auf denselben Filter; steht das Wort
    // nur an einer Stelle, widersprechen sich Reiter und Liste.
    zeigeAntraege();
    // Reiter
    expect(reiter('Verbucht')).toHaveLength(1);
    // Kachel: das Wort steht ausserhalb der Reiterleiste
    const ausserhalbReiter = screen
      .getAllByText('Verbucht')
      .filter((el) => !el.closest('[role="tablist"]'));
    expect(ausserhalbReiter.length).toBe(1);
    // Eintrag: nach dem Wechsel auf den Reiter tragen beide verbuchten Antraege das Badge
    fireEvent.click(reiter('Verbucht')[0]);
    expect(screen.getAllByRole('img', { name: 'Verbucht' })).toHaveLength(2);
  });

  it('behaelt den technischen Statuswert "approved" -- der Filter findet genau die verbuchten', () => {
    // Nur die Anzeige aendert sich. Der Wert in der Datenbank und in der
    // Schnittstelle bleibt 'approved' — sonst braeche der Filter.
    zeigeAntraege();
    fireEvent.click(reiter('Verbucht')[0]);
    expect(screen.getByText('Konfi 1')).toBeInTheDocument();
    expect(screen.getByText('Konfi 3')).toBeInTheDocument();
    expect(screen.queryByText('Konfi 2')).toBeNull();
  });
});

describe('Symbol-Zuordnung', () => {
  it('kennt "Verbucht" -- Termine und Antraege tragen dasselbe Symbol', () => {
    render(<StatusBadge statusText="Verbucht" statusColor="green" />);
    const badge = screen.getByRole('img', { name: 'Verbucht' });
    expect(badge.querySelector('[data-icon]')!.getAttribute('data-icon')).toBe(ICON_ZUSAGE_GEFUELLT);
  });

  it('kennt "Genehmigt" weiterhin', () => {
    // Das alte Wort kann in Screenshots und aelteren Ansichten auftauchen und
    // verloere sonst sein Symbol (und fiele auf den Text zurueck).
    render(<StatusBadge statusText="Genehmigt" statusColor="green" />);
    const badge = screen.getByRole('img', { name: 'Genehmigt' });
    expect(badge.querySelector('[data-icon]')!.getAttribute('data-icon')).toBe(ICON_ZUSAGE_GEFUELLT);
    expect(badge.textContent).toBe('');
  });
});

describe('Icon der Antraege', () => {
  it('nutzt das Textdokument-Symbol wie die Termin-Detailansicht', () => {
    zeigeAntraege();
    const symbole = screen.getAllByTestId('symbol').map((s) => s.getAttribute('data-icon'));
    expect(symbole.filter((s) => s === ICON_TEXTDOKUMENT).length).toBeGreaterThanOrEqual(2);
    expect(symbole).not.toContain(ICON_DATEI);
  });

  it('laesst die Zertifikate in der Teamer-Liste der Leitung unberuehrt', async () => {
    // Dort steht ICON_DATEI (frueher documentOutline) fuer ZERTIFIKATE — ein
    // anderer Gegenstand, der bewusst sein eigenes Symbol behaelt.
    render(
      <KonfisView
        konfis={[]}
        jahrgaenge={[]}
        onSelectKonfi={vi.fn()}
        onDeleteKonfi={vi.fn()}
        onDeleteTeamer={vi.fn()}
        initialViewMode="teamer"
      />
    );
    const zeile = await screen.findByText('2 Zertifikate', { exact: false });
    await waitFor(() => expect(zeile.querySelector('[data-icon]')).not.toBeNull());
    expect(zeile.querySelector('[data-icon]')!.getAttribute('data-icon')).toBe(ICON_DATEI);
  });
});
