import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import KonfisView from '../../components/admin/KonfisView';

// Waehrend die Teamer:innen noch laden, darf NICHT "Noch keine Teamer:innen
// vorhanden" stehen — dieselbe Fehlerklasse wie der Audit-Befund vom 10.08.
// (Fehler nicht als Leerzustand ausgeben): auch Laden ist kein Leerzustand.
// Der Ladezustand (teamerLoading) wurde gepflegt, aber nie gerendert.
//
// Das Teamer-Segment wird ueber initialViewMode angesteuert: JSDOM reicht
// das ionChange-Event des Segments nicht an den React-Handler durch.

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    user: { id: 1, type: 'admin', organization_id: 7 },
    isOnline: true,
    setError: vi.fn(),
    setSuccess: vi.fn()
  })
}));

let teamerResolve: (value: { data: unknown[] }) => void;

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn((url: string) => {
      if (url === '/admin/konfis/teamer') {
        return new Promise((resolve) => { teamerResolve = resolve; });
      }
      // Organisations-Limit u.ae. — irrelevant fuer diesen Test
      return Promise.resolve({ data: {} });
    })
  }
}));

const basisProps = {
  konfis: [],
  jahrgaenge: [],
  settings: {},
  onUpdate: vi.fn(),
  onAddKonfiClick: vi.fn(),
  onSelectKonfi: vi.fn(),
  initialViewMode: 'teamer' as const
};

describe('KonfisView Teamer-Segment: Laden ist kein Leerzustand', () => {
  beforeEach(() => vi.clearAllMocks());

  it('zeigt waehrend des Ladens einen Spinner statt "Noch keine Teamer:innen vorhanden"', async () => {
    const { container } = render(<KonfisView {...basisProps} />);

    await waitFor(() => {
      expect(container.querySelector('ion-spinner')).not.toBeNull();
    });
    expect(container.textContent).not.toContain('Noch keine Teamer:innen vorhanden');
  });

  it('zeigt nach leerer Antwort den echten Leerzustand', async () => {
    const { container } = render(<KonfisView {...basisProps} />);
    await waitFor(() => {
      expect(container.querySelector('ion-spinner')).not.toBeNull();
    });

    await act(async () => { teamerResolve({ data: [] }); });

    await waitFor(() => {
      expect(container.textContent).toContain('Noch keine Teamer:innen vorhanden');
    });
    expect(container.querySelector('ion-spinner')).toBeNull();
  });
});
