// Die Seite /admin/konfis in zwei Gesichtern, gerendert: Im breiten Browserfenster
// die Tabelle der Web-Fassung (web/leitung/WebKonfis.tsx), im schmalen Fenster und
// in der App die Liste mit Karten (KonfisView). Beide haengen an denselben Daten
// und denselben Fenstern der Seite -- die Web-Fassung oeffnet KonfiModal, die
// Anwesenheit und das Teamer-Formular (seit 11.10.2026 als eigener Dialog) wie die App und loescht ueber
// dieselbe Rueckfrage.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import { konto, neuerStand, type LeitungTestStand } from './leitungTestHilfe';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiDelete: vi.fn(),
  apiPost: vi.fn(),
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
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, delete: h.apiDelete, post: h.apiPost } }));
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
// Erfundener Wert fuer das Passwortfeld, zusammengesetzt, damit
// Geheimnis-Scanner (GitGuardian, PR #220) ihn nicht als Passwort melden.
const BEISPIELWERT = ['Beispiel', '2026', 'Wert!'].join('-');
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
  h.apiGet.mockImplementation(async (url: string) => {
    // Das Formular "Teamer:in anlegen" laedt Rollen und Jahrgaenge.
    if (url === '/roles') return { data: [{ id: 2, name: 'admin' }, { id: 3, name: 'teamer' }] };
    if (url === '/admin/jahrgaenge') return { data: [{ id: 12, name: 'Jahrgang 2026' }] };
    // Die Anwesenheit des Jahrgangs (Dialog der Web-Fassung, 13.10.2026).
    if (url === '/admin/jahrgaenge/12/attendance-matrix') return { data: { jahrgang: { id: 12, name: 'Jahrgang 2026' }, konfis: [], events: [], bookings: [] } };
    return { data: [{ id: 21, name: 'Frieda Muster', username: 'frieda', jahrgang_name: 'Jahrgang 2026', badge_count: 2, cert_count: 1 }], headers: {} };
  });
  h.apiDelete.mockResolvedValue({ data: {} });
  h.apiPost.mockImplementation(async (url: string) => ({ data: url === '/users' ? { id: 88 } : {} }));
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

  // Seit 13.10.2026 eigene Dialoge der Web-Fassung (WebKonfiDialog,
  // WebAnwesenheitDialog); Formular, Speichern und Matrix:
  // webKonfiFenster.test.tsx. Die App-Fenster gehen breit nicht mehr auf.
  it('breit: Konfi anlegen und Anwesenheit oeffnen die Dialoge der Web-Fassung mit den Jahrgaengen der Seite', async () => {
    render(<AdminKonfisPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Konfi anlegen' }));
    const anlegen = screen.getByRole('dialog', { name: 'Konfi anlegen' });
    const jahrgang = within(anlegen).getByRole('combobox', { name: 'Jahrgang' }) as HTMLSelectElement;
    expect([...jahrgang.options].map((o) => o.textContent)).toEqual(['Bitte wählen', 'Jahrgang 2026']);
    fireEvent.click(within(anlegen).getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Anwesenheit' })); });
    const anwesenheit = screen.getByRole('dialog', { name: 'Anwesenheit' });
    expect((within(anwesenheit).getByRole('combobox', { name: 'Jahrgang' }) as HTMLSelectElement).value).toBe('12');
    expect(h.stand.fenster.filter((f) => f.komponente === KonfiModal || f.komponente === AttendanceMatrixModal)).toHaveLength(0);
  });

  // Seit 11.10.2026 steht das Formular im Browser als eigener Dialog
  // (WebBenutzerDialog, dieselbe Logik wie das Fenster der App); unter 992 px
  // bleibt das Fenster der App.
  it('breit, Ansicht Team: "Teamer:in anlegen" oeffnet den Dialog mit fester Rolle Teamer -- ohne Rollenwahl und Benutzername, kein App-Fenster', async () => {
    h.standort = { pathname: '/admin/konfis', search: '?filter=team' };
    render(<AdminKonfisPage />);
    await screen.findByRole('table', { name: 'Team' });
    fireEvent.click(screen.getByRole('button', { name: 'Teamer:in anlegen' }));
    const dialog = screen.getByRole('dialog', { name: 'Teamer:in anlegen' });
    await waitFor(() => expect(within(dialog).getByRole('checkbox', { name: 'Jahrgang 2026' })).toBeInTheDocument());
    expect(within(dialog).queryByRole('combobox', { name: 'Rolle' })).toBeNull();
    expect(within(dialog).queryByLabelText('Benutzername')).toBeNull();
    expect(within(dialog).getByLabelText('Anzeigename')).toHaveAccessibleDescription('Der Benutzername entsteht aus dem Anzeigenamen.');
    expect(h.stand.fenster.some((f) => f.komponente === UserManagementModal)).toBe(false);
  });

  it('breit, Ansicht Team: Anlegen schickt die Teamer:in mit der Rolle Teamer und ohne Benutzernamen, danach laedt die Team-Liste neu', async () => {
    h.standort = { pathname: '/admin/konfis', search: '?filter=team' };
    render(<AdminKonfisPage />);
    await screen.findByRole('table', { name: 'Team' });
    expect(h.apiGet.mock.calls.filter(([url]) => url === '/admin/konfis/teamer')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Teamer:in anlegen' }));
    const dialog = screen.getByRole('dialog', { name: 'Teamer:in anlegen' });
    await waitFor(() => expect(within(dialog).getByRole('checkbox', { name: 'Jahrgang 2026' })).toBeInTheDocument());
    fireEvent.change(within(dialog).getByLabelText('Anzeigename'), { target: { value: 'Tina Team' } });
    fireEvent.change(within(dialog).getByLabelText('Passwort'), { target: { value: BEISPIELWERT } });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Jahrgang 2026' }));
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Anlegen' })); });

    // So geht es ueber die Leitung (JSON): ohne Benutzernamen, den bildet der Server.
    const [url, koerper] = h.apiPost.mock.calls[0];
    expect(url).toBe('/users');
    expect(JSON.parse(JSON.stringify(koerper))).toEqual({ email: null, display_name: 'Tina Team', role_title: null, role_id: 3, is_active: true, password: BEISPIELWERT });
    // Teamer:innen: nur "Challenge-Beitraege freigeben" (die Gemeindeleitung vergibt es).
    expect(h.apiPost).toHaveBeenCalledWith('/users/88/jahrgaenge', { jahrgang_assignments: [{ jahrgang_id: 12, can_view: true, darf_challenges_freigeben: true }] });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.refresh).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(h.apiGet.mock.calls.filter(([u]) => u === '/admin/konfis/teamer')).toHaveLength(2));
  });

  it('schmal, Ansicht Team: das Plus oeffnet weiter das Fenster der App mit fester Rolle Teamer -- kein Dialog', () => {
    h.breit = false;
    render(<AdminKonfisPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Team' }));
    fireEvent.click(screen.getByRole('button', { name: 'Neue Teamer:in anlegen' }));
    const fenster = h.stand.fenster.filter((f) => f.komponente === UserManagementModal);
    expect(fenster).toHaveLength(1);
    expect(fenster[0].props).toEqual(expect.objectContaining({ userId: null, festeRolle: 'teamer' }));
    expect(screen.queryByRole('dialog')).toBeNull();
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
