// Gemeinden in der Support-Ansicht, gerendert:
//   - die Liste zeigt Kirchenkreis und Landeskirche und findet danach;
//   - /admin/organizations?gemeinde=<id> oeffnet die Gemeinde direkt (Weg aus
//     den Kennzahlen und nach dem Anlegen aus einer Anfrage).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

const h = vi.hoisted(() => ({
  suche: '',
  present: vi.fn(),
  modalProps: null as null | Record<string, unknown>,
}));

vi.mock('@ionic/react', async () => {
  const attrappe = (await import('./ionicAttrappe')).ionicAttrappe();
  return {
    ...attrappe,
    useIonModal: (_seite: unknown, props: Record<string, unknown>) => {
      h.modalProps = props;
      return [h.present, vi.fn()];
    },
  };
});
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('./ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../navigation/useAppLocation', () => ({ useAppLocation: () => ({ pathname: '/admin/organizations', search: h.suche, state: null }) }));
vi.mock('../../../services/api', () => ({ default: { get: vi.fn().mockResolvedValue({ data: [] }), delete: vi.fn() } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ setError: vi.fn(), setSuccess: vi.fn(), isOnline: true, refreshUser: vi.fn() }),
}));
vi.mock('../../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }) }));
vi.mock('../../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: () => {} }));
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../components/admin/modals/OrganizationManagementModal', () => ({ default: () => null }));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));

const GEMEINDEN = [
  { id: 7, name: 'buesum', display_name: 'Büsum', is_active: true, created_at: '2026-01-02T00:00:00Z', updated_at: '',
    user_count: 3, konfi_count: 20, activity_count: 0, event_count: 0, badge_count: 0,
    kirchenkreis: 'Dithmarschen', kirchenkreis_id: 11, landeskirche_id: 1, landeskirche: 'Nordkirche' },
  { id: 8, name: 'schwerin', display_name: 'Dom Schwerin', is_active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '',
    user_count: 2, konfi_count: 12, activity_count: 0, event_count: 0, badge_count: 0,
    kirchenkreis: null, kirchenkreis_id: null, landeskirche_id: null, landeskirche: null },
];
vi.mock('../../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: () => ({ data: GEMEINDEN, loading: false, refresh: vi.fn() }),
}));

import AdminOrganizationsPage from '../../../components/admin/pages/AdminOrganizationsPage';

beforeEach(() => {
  vi.clearAllMocks();
  h.suche = '';
  h.modalProps = null;
});

describe('Gemeinden: Zuordnung in der Liste', () => {
  it('zeigt Kirchenkreis und Landeskirche, wo es sie gibt', () => {
    render(<AdminOrganizationsPage />);
    expect(screen.getByText('Dithmarschen · Nordkirche')).toBeInTheDocument();
    expect(screen.getByText('Dom Schwerin')).toBeInTheDocument();
  });

  it('die Suche findet auch nach Landeskirche', () => {
    render(<AdminOrganizationsPage />);
    fireEvent.change(screen.getByLabelText('Gemeinde suchen'), { target: { value: 'nordkirche' } });
    expect(screen.getByText('Büsum')).toBeInTheDocument();
    expect(screen.queryByText('Dom Schwerin')).toBeNull();
  });
});

describe('Gemeinden: direkt in eine Gemeinde', () => {
  it('?gemeinde=7 oeffnet das Formular der Gemeinde 7', () => {
    h.suche = '?gemeinde=7';
    render(<AdminOrganizationsPage />);
    expect(h.present).toHaveBeenCalledTimes(1);
    expect(h.modalProps?.organizationId).toBe(7);
  });

  it.each(['', '?gemeinde=', '?gemeinde=abc', '?gemeinde=-3', '?andere=7'])('"%s" oeffnet nichts', (suche) => {
    h.suche = suche;
    render(<AdminOrganizationsPage />);
    expect(h.present).not.toHaveBeenCalled();
  });
});
