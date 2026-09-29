// Die Konfi-Liste laedt die Gemeinde nicht mehr bei jedem Oeffnen
// (Audit 26.09.2026, Screens Leitung BF-07).
//
// KonfisView holte bei jedem Mount GET /organizations/:id (samt sechs
// Zaehlabfragen im Server) fuer eine "X von Y Konfis"-Anzeige, die es nie
// gab: `const [, setKonfiLimit] = useState(...)` -- gesetzt, nie gelesen.
// Gerendert wird die echte Ansicht; gezaehlt werden die Abrufe.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

const apiGet = vi.fn();

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    user: { id: 1, type: 'admin', role_name: 'org_admin', organization_id: 7 },
    isOnline: true,
    setError: vi.fn(),
    setSuccess: vi.fn(),
  }),
}));
vi.mock('../../services/api', () => ({
  default: { get: (...a: unknown[]) => apiGet(...a) },
}));

import KonfisView from '../../components/admin/KonfisView';

const basisProps = {
  konfis: [{ id: 1, name: 'Kim Test', jahrgang_name: '2026/27' }],
  jahrgaenge: [{ id: 2, name: '2026/27' }],
  settings: {},
  onUpdate: vi.fn(),
  onAddKonfiClick: vi.fn(),
  onSelectKonfi: vi.fn(),
  onDeleteKonfi: vi.fn(),
  onDeleteTeamer: vi.fn(),
};

beforeEach(() => {
  apiGet.mockReset();
  apiGet.mockResolvedValue({ data: [] });
});

describe('Konfi-Liste oeffnen', () => {
  it('ruft GET /organizations/:id nicht auf', async () => {
    const { container } = render(<KonfisView {...basisProps} />);

    await waitFor(() => expect(container.textContent).toContain('Kim Test'));
    // Einen Takt warten, damit ein Effekt nach dem ersten Rendern gelaufen waere.
    await new Promise((r) => setTimeout(r, 20));
    expect(apiGet.mock.calls.map((c) => c[0]).filter((u) => String(u).startsWith('/organizations'))).toEqual([]);
  });

  it('Gegenprobe: das Team-Segment laedt seine Liste weiter', async () => {
    render(<KonfisView {...basisProps} initialViewMode="teamer" />);

    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/admin/konfis/teamer'));
  });
});
