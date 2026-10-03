// Gemeinde bearbeiten, Abschnitt "Gemeindeleitung": die Personen in der Farbe
// der Gemeindeleitung (02.10.2026, Paket 2.4.0, Punkt 6).
//
// Nachgestellt: Die Liste (GET /organizations/:id/admins, nur org_admin) trug
// Strich, Kreis und Symbole in der Teamer-Farbe (app-list-item--teamer,
// app-icon-circle--teamer, --app-text-teamer) -- jede Gemeindeleitung stand
// dort in Beere statt Indigo. Die Liste hat nur eine Rolle, die Farbe kommt
// trotzdem aus rollenDarstellung (utils/rollenNamen) wie ueberall.
import { describe, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { karteVon, erwarteRollenfarbe } from './rollenfarbePruefen';

const GEMEINDE_ID = 7;

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    setError: vi.fn(),
    setSuccess: vi.fn(),
    isOnline: true,
    user: { id: 1, role_name: 'org_admin', is_super_admin: false, organization_id: GEMEINDE_ID },
  }),
}));

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn((url: string) => {
      if (url === `/organizations/${GEMEINDE_ID}`) {
        return Promise.resolve({ data: { id: GEMEINDE_ID, display_name: 'Büsum', name: 'buesum', slug: 'buesum', is_active: true, max_konfis: null } });
      }
      if (url === `/organizations/${GEMEINDE_ID}/admins`) {
        return Promise.resolve({ data: [
          { id: 5, username: 'olga', display_name: 'Olga Gemeindeleitung', email: 'olga@example.org', is_active: true },
          { id: 6, username: 'otto', display_name: 'Otto Gemeindeleitung', is_active: true },
        ] });
      }
      return Promise.resolve({ data: [] });
    }),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    put: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

vi.mock('../../hooks/useActionGuard', () => ({
  useActionGuard: () => ({ isSubmitting: false, guard: <T,>(fn: () => Promise<T>) => fn() }),
}));

import OrganizationManagementModal from '../../components/admin/modals/OrganizationManagementModal';

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Gemeinde bearbeiten: die Gemeindeleitung in Indigo, nicht in Beere', () => {
  it('Strich, Kreis und Symbole jeder Person in der Farbe der Gemeindeleitung', async () => {
    render(<OrganizationManagementModal organizationId={GEMEINDE_ID} onClose={vi.fn()} onSuccess={vi.fn()} />);
    fireEvent.click(await screen.findByLabelText('Gemeinde bearbeiten', undefined, { timeout: 15000 }));
    await screen.findByText('Olga Gemeindeleitung', undefined, { timeout: 15000 });

    erwarteRollenfarbe(karteVon('Olga Gemeindeleitung'), 'org_admin', 'Olga', { marke: false });
    erwarteRollenfarbe(karteVon('Otto Gemeindeleitung'), 'org_admin', 'Otto', { marke: false });
  }, 30000);
});
