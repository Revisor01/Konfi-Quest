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
import { ziehenZumAktualisieren } from '../support/ionicAttrappe';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiDelete: vi.fn(),
  apiPost: vi.fn(),
  refresh: vi.fn(),
  // refreshLive der Konfi-Liste (useOfflineQuery 'admin:konfis:...').
  konfisLive: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  breit: true,
  stand: { alert: null, fenster: [], push: vi.fn() } as unknown as LeitungTestStand,
  user: {} as Record<string, unknown>,
  standort: { pathname: '/admin/konfis', search: '' },
  // Was die Seite bei Meldungen des Servers neu laedt (useLiveRefresh), je Art.
  live: {} as Record<string, () => void>,
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
  useLiveRefresh: (arten: string | string[], rueckruf: () => void) => {
    for (const art of [arten].flat()) h.live[art] = rueckruf;
  },
  useLiveUpdate: () => ({ triggerRefresh: vi.fn() }),
}));
vi.mock('../../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (schluessel: string) => ({
    data: schluessel.startsWith('admin:konfis') ? KONFIS : schluessel.startsWith('admin:jahrgaenge') ? JAHRGAENGE : {},
    loading: false, error: null, isStale: false, isOffline: false,
    refresh: h.refresh, refreshLive: schluessel.startsWith('admin:konfis') ? h.konfisLive : vi.fn(),
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
  h.live = {};
  h.apiGet.mockImplementation(async (url: string) => {
    // Das Formular "Teamer:in anlegen" laedt Rollen und Jahrgaenge.
    if (url === '/roles') return { data: [{ id: 2, name: 'admin' }, { id: 3, name: 'teamer' }] };
    if (url === '/admin/jahrgaenge') return { data: [{ id: 12, name: 'Jahrgang 2026' }] };
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

  it('breit: Konfi anlegen, Anwesenheit und Teamer:in anlegen oeffnen die Fenster der Seite', () => {
    render(<AdminKonfisPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Konfi anlegen' }));
    expect(h.stand.fenster[0].komponente).toBe(KonfiModal);
    expect(h.stand.fenster[0].props).toEqual(expect.objectContaining({ jahrgaenge: JAHRGAENGE }));
    fireEvent.click(screen.getByRole('button', { name: 'Anwesenheit' }));
    expect(h.stand.fenster[1].komponente).toBe(AttendanceMatrixModal);
    expect(h.stand.fenster[1].props).toEqual(expect.objectContaining({ jahrgaenge: JAHRGAENGE }));
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

  // Simon, 13.10.2026: die Anwesenheit nur bei den Konfis, nicht beim Team.
  it('schmal: der Knopf "Anwesenheit" steht nur bei den Konfis; beim Team nur das Plus', async () => {
    h.breit = false;
    render(<AdminKonfisPage />);
    await screen.findByRole('tab', { name: 'Team (1)' });
    fireEvent.click(screen.getByRole('button', { name: 'Anwesenheit und Konfisprüche anzeigen' }));
    expect(h.stand.fenster.filter((f) => f.komponente === AttendanceMatrixModal)).toHaveLength(1);
    fireEvent.click(screen.getByRole('tab', { name: 'Team (1)' }));
    expect(screen.queryByRole('button', { name: 'Anwesenheit und Konfisprüche anzeigen' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Neue Teamer:in anlegen' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Konfis (2)' }));
    expect(screen.getByRole('button', { name: 'Anwesenheit und Konfisprüche anzeigen' })).toBeInTheDocument();
  });

  it('schmal, Ansicht Team: das Plus oeffnet weiter das Fenster der App mit fester Rolle Teamer -- kein Dialog', () => {
    h.breit = false;
    render(<AdminKonfisPage />);
    fireEvent.click(screen.getByRole('tab', { name: /^Team/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Neue Teamer:in anlegen' }));
    const fenster = h.stand.fenster.filter((f) => f.komponente === UserManagementModal);
    expect(fenster).toHaveLength(1);
    expect(fenster[0].props).toEqual(expect.objectContaining({ userId: null, festeRolle: 'teamer' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // Simon, 13.10.2026: die Zahl des Teams erschien erst nach dem Klick auf
  // "Team". In der App stand am Umschalter gar keine Zahl; jetzt beide in
  // Klammern, das Team geladen beim Oeffnen der Seite.
  const teamAbrufe = () => h.apiGet.mock.calls.filter(([u]) => u === '/admin/konfis/teamer').length;

  it('schmal: der Umschalter zeigt die Anzahl der Konfis und des Teams gleich beim Oeffnen; der Wechsel fragt nicht erneut', async () => {
    h.breit = false;
    render(<AdminKonfisPage />);
    expect(await screen.findByRole('tab', { name: 'Team (1)' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: 'Konfis (2)' })).toHaveAttribute('aria-selected', 'true');
    expect(teamAbrufe()).toBe(1);
    fireEvent.click(screen.getByRole('tab', { name: 'Team (1)' }));
    expect(screen.getByText('Frieda Muster')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Konfis (2)' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Team (1)' }));
    await act(async () => { await Promise.resolve(); });
    expect(teamAbrufe()).toBe(1);
  });

  // Befund 13.10.2026: /admin/konfis ist die Startseite der Leitung, und das
  // Team laedt dort beim Oeffnen. Im Funkloch meldete es sich mit einem roten
  // Toast, obwohl niemand das Team geoeffnet hatte, und lud nicht neu, wenn
  // das Netz zurueckkam. Jetzt fehlt im Hintergrund nur die Zahl am
  // Umschalter -- keine "Team (0)", denn ein Fehler ist kein leeres Team.
  const appReiter = () => screen.getAllByRole('tab').map((t) => t.textContent);
  const FRIEDA = { id: 21, name: 'Frieda Muster', username: 'frieda', badge_count: 2, cert_count: 1 };
  const teamAntwortet = (wie: { ok: boolean; team?: unknown[] }) => h.apiGet.mockImplementation(async (url: string) => {
    if (url !== '/admin/konfis/teamer') return { data: [], headers: {} };
    if (!wie.ok) throw new Error('Netz weg');
    return { data: wie.team ?? [FRIEDA] };
  });

  it('schmal: scheitert das Team beim Oeffnen, heisst der Reiter nur "Team" -- ohne Zahl, ohne Toast; der Wechsel auf "Team" versucht es neu', async () => {
    h.breit = false;
    const antwort = { ok: false };
    teamAntwortet(antwort);
    const stumm = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<AdminKonfisPage />);
    await waitFor(() => expect(stumm).toHaveBeenCalledTimes(1));
    expect(appReiter()).toEqual(['Konfis (2)', 'Team']);
    expect(h.setError).not.toHaveBeenCalled();

    antwort.ok = true;
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Team' })); });
    expect(await screen.findByText('Frieda Muster')).toBeInTheDocument();
    expect(appReiter()).toEqual(['Konfis (2)', 'Team (1)']);
    expect(teamAbrufe()).toBe(2);
    expect(h.setError).not.toHaveBeenCalled();
    stumm.mockRestore();
  });

  it('schmal: scheitert auch der neue Versuch bei offenem Team, kommt der Toast -- einmal', async () => {
    h.breit = false;
    teamAntwortet({ ok: false });
    const stumm = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<AdminKonfisPage />);
    await waitFor(() => expect(stumm).toHaveBeenCalledTimes(1));
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Team' })); });
    await waitFor(() => expect(h.setError).toHaveBeenCalledWith('Das Team konnte nicht geladen werden'));
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(h.setError).toHaveBeenCalledTimes(1);
    expect(teamAbrufe()).toBe(2);
    expect(appReiter()).toEqual(['Konfis (2)', 'Team']);
    stumm.mockRestore();
  });

  it.each([false, true])('ohne Netz beim Oeffnen (breit: %s): kommt die Verbindung zurueck (sync:reconnect), laedt das Team still und die Zahl steht da', async (breit) => {
    h.breit = breit;
    const antwort = { ok: false };
    teamAntwortet(antwort);
    const stumm = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<AdminKonfisPage />);
    await waitFor(() => expect(stumm).toHaveBeenCalledTimes(1));
    antwort.ok = true;
    await act(async () => { window.dispatchEvent(new CustomEvent('sync:reconnect')); });
    if (breit) expect(await screen.findByRole('button', { name: /^Team\s*1$/ })).toBeInTheDocument();
    else expect(await screen.findByRole('tab', { name: 'Team (1)' })).toBeInTheDocument();
    expect(teamAbrufe()).toBe(2);
    expect(h.setError).not.toHaveBeenCalled();
    stumm.mockRestore();
  });

  it('schmal: Herunterziehen laedt Konfis und Team neu', async () => {
    h.breit = false;
    render(<AdminKonfisPage />);
    await screen.findByRole('tab', { name: 'Team (1)' });
    await act(async () => { ziehenZumAktualisieren(); });
    await waitFor(() => expect(teamAbrufe()).toBe(2));
  });

  it.each([false, true])('meldet der Server eine Aenderung an Konten (breit: %s), laedt das Team neu und die Zahl folgt', async (breit) => {
    h.breit = breit;
    render(<AdminKonfisPage />);
    if (breit) await screen.findByRole('button', { name: /^Team\s*1$/ });
    else await screen.findByRole('tab', { name: 'Team (1)' });
    const neu = { id: 22, name: 'Gero Beispiel', username: 'gero', badge_count: 0, cert_count: 0 };
    h.apiGet.mockImplementation(async (url: string) => ({ data: url === '/admin/konfis/teamer' ? [{ id: 21, name: 'Frieda Muster', username: 'frieda' }, neu] : [], headers: {} }));
    await act(async () => { h.live.users(); });
    if (breit) expect(await screen.findByRole('button', { name: /^Team\s*2$/ })).toBeInTheDocument();
    else expect(await screen.findByRole('tab', { name: 'Team (2)' })).toBeInTheDocument();
    expect(teamAbrufe()).toBe(2);
  });

  // Befund 13.10.2026: Die Leitung traegt unter Events die Anwesenheit ein und
  // wechselt zurueck in den Reiter Konfis. Die Seite bleibt eingehaengt
  // (Reiter), und der Server meldet Anwesenheit und Check-in nur als 'events'
  // -- die Spalte "Pflicht-Events" (und die Punkte) blieben auf dem alten
  // Stand, bis jemand herunterzog.
  it.each([false, true])('meldet der Server eine Aenderung an Events (Anwesenheit, breit: %s), laedt die Konfi-Liste neu', (breit) => {
    h.breit = breit;
    render(<AdminKonfisPage />);
    expect(h.konfisLive).not.toHaveBeenCalled();
    act(() => { h.live.events(); });
    expect(h.konfisLive).toHaveBeenCalledTimes(1);
  });

  // Befund 13.10.2026: Wechselt das Fenster ueber 992 px die Fassung, haengt
  // sich die andere neu ein -- mit einem Stand > 0, wenn vorher schon einmal
  // neu geladen wurde (Herunterziehen, Anlegen, Signal 'users'). Dann liefen
  // der erste Abruf und einer fuer den Stand: zwei GET fuer dieselbe Liste.
  it.each([true, false])('wechselt die Breite nach einem neuen Stand (vorher breit: %s), laedt die andere Fassung das Team genau einmal', async (vorherBreit) => {
    h.breit = vorherBreit;
    const { rerender } = render(<AdminKonfisPage />);
    if (vorherBreit) await screen.findByRole('button', { name: /^Team\s*1$/ });
    else await screen.findByRole('tab', { name: 'Team (1)' });
    await act(async () => { h.live.users(); });
    await waitFor(() => expect(teamAbrufe()).toBe(2));

    h.breit = !vorherBreit;
    rerender(<AdminKonfisPage />);
    if (vorherBreit) expect(await screen.findByRole('tab', { name: 'Team (1)' })).toBeInTheDocument();
    else expect(await screen.findByRole('button', { name: /^Team\s*1$/ })).toBeInTheDocument();
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(teamAbrufe()).toBe(3);
  });

  // Befund 11.10.2026 (docs/offene-befunde.md): In der App erschien eine neu
  // angelegte Teamer:in erst nach einem Wechsel Konfis/Team -- das Fenster
  // rief danach nur die Konfi-Liste neu ab, die Team-Liste nicht.
  it('schmal: nach "Teamer:in anlegen" steht die Neue sofort in der Team-Liste, ohne Wechsel Konfis/Team', async () => {
    h.breit = false;
    const frieda = { id: 21, name: 'Frieda Muster', username: 'frieda', badge_count: 2, cert_count: 1 };
    const tina = { id: 88, name: 'Tina Team', username: 'tina.team', badge_count: 0, cert_count: 0 };
    let team = [frieda];
    h.apiGet.mockImplementation(async (url: string) => (url === '/admin/konfis/teamer' ? { data: team } : { data: [], headers: {} }));
    render(<AdminKonfisPage />);
    fireEvent.click(screen.getByRole('tab', { name: /^Team/ }));
    expect(await screen.findByText('Frieda Muster')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Neue Teamer:in anlegen' }));
    const fenster = h.stand.fenster.find((f) => f.komponente === UserManagementModal)!;
    const abrufeVorher = h.apiGet.mock.calls.filter(([u]) => u === '/admin/konfis/teamer').length;

    team = [frieda, tina];
    await act(async () => { (fenster.props.onSuccess as () => void)(); });

    expect(await screen.findByText('Tina Team')).toBeInTheDocument();
    expect(screen.getByText('Frieda Muster')).toBeInTheDocument();
    expect(h.apiGet.mock.calls.filter(([u]) => u === '/admin/konfis/teamer')).toHaveLength(abrufeVorher + 1);
    expect(h.refresh).toHaveBeenCalledTimes(1);
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
