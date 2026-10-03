// Die Seite /admin/konfis in zwei Gesichtern, gerendert: Im breiten Browserfenster
// die Tabelle der Web-Fassung (web/leitung/WebKonfis.tsx), im schmalen Fenster und
// in der App die Liste mit Karten (KonfisView). Beide haengen an denselben Daten
// und denselben Fenstern der Seite -- die Web-Fassung oeffnet KonfiModal, die
// Anwesenheit und das Teamer-Formular genau wie die App und loescht ueber
// dieselbe Rueckfrage.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import { konto, neuerStand, type LeitungTestStand } from './leitungTestHilfe';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiDelete: vi.fn(),
  refresh: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  breit: true,
  stand: { alert: null, fenster: [], push: vi.fn() } as unknown as LeitungTestStand,
  user: {} as Record<string, unknown>,
  standort: { pathname: '/admin/konfis', search: '' },
}));

vi.mock('@ionic/react', async () => (await import('./leitungTestHilfe')).ionicFuerLeitung(h.stand));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../../navigation/useAppLocation', () => ({ useAppLocation: () => h.standort }));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('../support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, delete: h.apiDelete, post: vi.fn() } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: true }),
}));
vi.mock('../../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }) }));
vi.mock('../../../contexts/LiveUpdateContext', () => ({
  useLiveRefresh: () => {},
  useLiveUpdate: () => ({ triggerRefresh: vi.fn() }),
}));
vi.mock('../../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (schluessel: string) => ({
    data: schluessel.startsWith('admin:konfis') ? KONFIS : schluessel.startsWith('admin:jahrgaenge') ? JAHRGAENGE : {},
    loading: false, error: null, isStale: false, isOffline: false,
    refresh: h.refresh, refreshLive: vi.fn(),
  }),
}));
vi.mock('../../../hooks/useOnboardingOnce', () => ({
  useOnboardingWithUpdateOnce: () => ({
    showOnboarding: false, closeOnboarding: vi.fn(),
    showNeuerungen: false, schliesseNeuerungen: vi.fn(),
    showUpdateHinweis: false, markUpdateHinweisGesehen: vi.fn(),
    showMitmachenHinweis: false, markMitmachenHinweisGesehen: vi.fn(),
  }),
}));
vi.mock('../../../components/shared/NeuerungenBanner', () => ({ default: () => null }));
vi.mock('../../../components/shared/MitmachenErklaerungModal', () => ({ default: () => null }));
vi.mock('../../../components/admin/modals/KonfiModal', () => ({ default: () => null }));
vi.mock('../../../components/admin/modals/UserManagementModal', () => ({ default: () => null }));
vi.mock('../../../components/admin/modals/AttendanceMatrixModal', () => ({ default: () => null }));
vi.mock('../../../components/admin/modals/AdminOnboardingModal', () => ({ default: () => null }));
vi.mock('../../../components/admin/modals/AdminUpdate230WalkthroughModal', () => ({ default: () => null }));
vi.mock('../../../components/admin/modals/ActivityModal', () => ({ default: () => null }));
vi.mock('../../../components/admin/modals/BonusModal', () => ({ default: () => null }));

import AdminKonfisPage from '../../../components/admin/pages/AdminKonfisPage';
import KonfiModal from '../../../components/admin/modals/KonfiModal';
import UserManagementModal from '../../../components/admin/modals/UserManagementModal';
import AttendanceMatrixModal from '../../../components/admin/modals/AttendanceMatrixModal';

const JAHRGAENGE = [{ id: 12, name: 'Jahrgang 2026' }];
const KONFIS = [
  { id: 1, name: 'Anna Müller', username: 'anna.mueller', jahrgang_name: 'Jahrgang 2026', gottesdienst_points: 7, gemeinde_points: 5, target_gottesdienst: 10, target_gemeinde: 10, badgeCount: 3 },
  { id: 2, name: 'Ben Schmidt', username: 'ben.schmidt', jahrgang_name: 'Jahrgang 2026', gottesdienst_points: 10, gemeinde_points: 10, target_gottesdienst: 10, target_gemeinde: 10, badgeCount: 5 },
];

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(h.stand, neuerStand());
  h.breit = true;
  h.user = konto('org_admin');
  h.standort = { pathname: '/admin/konfis', search: '' };
  h.apiGet.mockResolvedValue({ data: [{ id: 21, name: 'Frieda Muster', username: 'frieda', jahrgang_name: 'Jahrgang 2026', badge_count: 2, cert_count: 1 }], headers: {} });
  h.apiDelete.mockResolvedValue({ data: {} });
});

describe('/admin/konfis: breit die Tabelle, schmal die App', () => {
  it('breit: Tabelle mit den Konfis der Seite, kein Listenelement der App', () => {
    render(<AdminKonfisPage />);
    expect(screen.getByRole('table', { name: 'Konfis' })).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'Konfis' })).getAllByRole('row')).toHaveLength(3);
    expect(screen.getByRole('heading', { level: 1, name: 'Konfis' })).toBeInTheDocument();
  });

  it('schmal: die Darstellung der App -- keine Tabelle, die Namen stehen als Karten da', () => {
    h.breit = false;
    const { container } = render(<AdminKonfisPage />);
    expect(screen.queryByRole('table')).toBeNull();
    expect(container.querySelector('.web-seite')).toBeNull();
    expect(screen.getByText('Anna Müller')).toBeInTheDocument();
    expect(screen.getByText('Ben Schmidt')).toBeInTheDocument();
  });

  it('breit: Konfi anlegen, Anwesenheit und Teamer:in anlegen oeffnen die Fenster der Seite', () => {
    render(<AdminKonfisPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Konfi anlegen' }));
    expect(h.stand.fenster[0].komponente).toBe(KonfiModal);
    expect(h.stand.fenster[0].props).toEqual(expect.objectContaining({ jahrgaenge: JAHRGAENGE }));
    fireEvent.click(screen.getByRole('button', { name: 'Anwesenheit' }));
    expect(h.stand.fenster[1].komponente).toBe(AttendanceMatrixModal);
    expect(h.stand.fenster[1].props).toEqual(expect.objectContaining({ jahrgaenge: JAHRGAENGE }));
  });

  it('breit, Ansicht Team: "Teamer:in anlegen" oeffnet das Benutzerformular mit fester Rolle Teamer', async () => {
    h.standort = { pathname: '/admin/konfis', search: '?filter=team' };
    render(<AdminKonfisPage />);
    await screen.findByRole('table', { name: 'Team' });
    fireEvent.click(screen.getByRole('button', { name: 'Teamer:in anlegen' }));
    const fenster = h.stand.fenster.find((f) => f.komponente === UserManagementModal)!;
    expect(fenster.props).toEqual(expect.objectContaining({ userId: null, festeRolle: 'teamer' }));
  });

  it('breit: Loeschen fragt wie in der App nach und ruft erst nach der Bestaetigung die Route', async () => {
    render(<AdminKonfisPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Anna Müller löschen' }));
    expect(h.stand.alert?.header).toBe('Konfi wirklich löschen?');
    expect(h.apiDelete).not.toHaveBeenCalled();
    await act(async () => { h.stand.alert?.buttons?.find((b) => b.text === 'Endgültig löschen')?.handler?.(); });
    await waitFor(() => expect(h.apiDelete).toHaveBeenCalledWith('/admin/konfis/1'));
    expect(h.refresh).toHaveBeenCalled();
  });

  it('breit, Ansicht Team: Teamer:in loeschen fragt nach und nennt, dass das Konto in einer anderen Gemeinde bleiben kann', async () => {
    h.standort = { pathname: '/admin/konfis', search: '?filter=team' };
    h.apiDelete.mockResolvedValue({ data: { konto_bleibt: true } });
    render(<AdminKonfisPage />);
    await screen.findByRole('table', { name: 'Team' });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Frieda Muster löschen' })); });
    expect(h.stand.alert?.header).toBe('Teamer:in löschen');
    expect(h.stand.alert?.message).toContain('Teamer:in "Frieda Muster" wirklich löschen?');
    await act(async () => { h.stand.alert?.buttons?.find((b) => b.text === 'Löschen')?.handler?.(); });
    await waitFor(() => expect(h.apiDelete).toHaveBeenCalledWith('/users/21'));
    expect(h.setSuccess).toHaveBeenCalledWith('Teamer:in "Frieda Muster" aus deiner Gemeinde entfernt; das Konto bleibt in einer anderen Gemeinde bestehen');
  });
});
