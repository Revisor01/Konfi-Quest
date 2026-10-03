// Formular "Gemeinde": eine bestehende Gemeinde gleich im Formular oeffnen
// (Eigenschaft `direktBearbeiten`, 03.10.2026). Die Web-Fassung der
// Support-Ansicht fuehrt mit "Bearbeiten" direkt ins Formular -- Simon: „nicht
// erst nach Klick und Details und wieder Klick“. Ohne die Eigenschaft bleibt
// es wie bisher: erst die Ansicht, dann der Stift oben rechts.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock('@ionic/react', async () => (await import('./ionicAttrappe')).ionicAttrappe());
vi.mock('../../../services/api', () => ({
  default: { get: h.apiGet, put: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 1, role_name: 'org_admin', is_super_admin: true }, setError: vi.fn(), setSuccess: vi.fn(), isOnline: true }),
}));
vi.mock('../../../hooks/useActionGuard', () => ({
  useActionGuard: () => ({ isSubmitting: false, guard: <T,>(fn: () => Promise<T>) => fn() }),
}));
vi.mock('../../../components/admin/modals/AdminPasswordResetModal', () => ({ default: () => null }));

import OrganizationManagementModal from '../../../components/admin/modals/OrganizationManagementModal';

const GEMEINDE = {
  id: 7, name: 'buesum', slug: 'buesum', display_name: 'Büsum', is_active: true, max_konfis: null,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  konfi_count: 10, teamer_count: 2, admin_count: 1, user_count: 3, event_count: 4,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.apiGet.mockReset();
  h.apiGet.mockImplementation((pfad: string) => {
    if (pfad === '/organizations/7') return Promise.resolve({ data: GEMEINDE });
    return Promise.resolve({ data: [] });
  });
});

describe('Formular "Gemeinde": Ansicht oder gleich das Formular', () => {
  it('ohne Eigenschaft startet eine bestehende Gemeinde in der Ansicht, mit dem Stift zum Bearbeiten', async () => {
    render(<OrganizationManagementModal organizationId={7} onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(await screen.findByRole('button', { name: 'Gemeinde bearbeiten' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Gemeinde' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gemeinde speichern' })).toBeNull();
  });

  it('mit direktBearbeiten steht gleich das Formular da -- ohne den Umweg ueber die Ansicht', async () => {
    render(<OrganizationManagementModal organizationId={7} direktBearbeiten onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(await screen.findByRole('button', { name: 'Gemeinde speichern' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Gemeinde bearbeiten' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gemeinde bearbeiten' })).toBeNull();
  });

  it('eine neue Gemeinde startet immer im Formular', async () => {
    render(<OrganizationManagementModal organizationId={null} onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(await screen.findByRole('button', { name: 'Gemeinde speichern' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Neue Gemeinde' })).toBeInTheDocument();
  });
});
