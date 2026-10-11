// E-Mail und Passwort ändern in den drei eigenen Profilen (Leitung, Team,
// Konfi), gerendert: Im breiten Browserfenster (Web-Fassung ab 992 px) öffnen
// sie eigene Dialoge (Simon, 11.10.2026: „Web braucht eigene kompaktere Modale
// überall"), im schmalen Fenster und in den Apps weiter die Modale der App in
// der Farbe der Rolle. Gerendert werden die echten Seiten mit der echten Logik
// (useEmailAendern, usePasswortAendern, useNeueEmailUebernehmen); nachgestellt
// sind Server, Anmeldung, Zwischenspeicher und Ionic. Die Einzelheiten der
// Dialoge (Prüfung, Fehler, offline) stehen in shared/webKontoDialoge.test.tsx.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import './zeitrahmen';
import React from 'react';
import { render, screen, fireEvent, within, waitFor, act } from '@testing-library/react';

const h = vi.hoisted(() => ({
  breit: true,
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  push: vi.fn(),
  modale: [] as Array<{ name: string; props: Record<string, unknown>; optionen: Record<string, unknown> | undefined }>,
  alerts: [] as unknown[],
  seite: document.createElement('div'),
  user: {} as Record<string, unknown>,
  setUser: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  tokenSetUser: vi.fn(async (..._a: unknown[]) => undefined),
  setToken: vi.fn(async (..._a: unknown[]) => undefined),
  setRefreshToken: vi.fn(async (..._a: unknown[]) => undefined),
  refresh: vi.fn(async () => undefined),
  antworten: {} as Record<string, unknown>,
  daten: {} as Record<string, unknown>,
}));

vi.mock('@ionic/react', async () => ({
  ...(await import('./ionicStart')).ionicStart(h as never),
  // Die Zeilen der App sind bei Leitung und Team IonItem mit onClick: hier
  // ein Knopf, damit der Test sie antippen kann wie eine Person.
  IonItem: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) =>
    (onClick ? <button type="button" onClick={onClick}>{children}</button> : <>{children}</>),
}));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('../support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: ({ message }: { message: string }) => <p>{message}</p> }));
vi.mock('../../../components/shared/NeuerungenBanner', () => ({ default: () => null }));
vi.mock('../../../components/shared/ChangeEmailModal', async () => ({ default: (await import('./ionicStart')).modalAttrappe('ChangeEmailModal') }));
vi.mock('../../../components/shared/ChangePasswordModal', async () => ({ default: (await import('./ionicStart')).modalAttrappe('ChangePasswordModal') }));
vi.mock('../../../components/shared/DeleteAccountModal', async () => ({ default: (await import('./ionicStart')).modalAttrappe('DeleteAccountModal') }));
vi.mock('../../../components/admin/modals/ChangeRoleTitleModal', async () => ({ default: (await import('./ionicStart')).modalAttrappe('ChangeRoleTitleModal') }));
vi.mock('../../../components/konfi/modals/PointsHistoryModal', async () => ({ default: (await import('./ionicStart')).modalAttrappe('PointsHistoryModal') }));
vi.mock('../../../components/wrapped/WrappedModal', async () => ({ default: (await import('./ionicStart')).modalAttrappe('WrappedModal') }));
vi.mock('../../../components/shared/BibleTranslationModal', async () => ({
  default: (await import('./ionicStart')).modalAttrappe('BibleTranslationModal'),
  getTranslationName: (code: string) => code,
}));
vi.mock('../../../components/teamer/modals/TeamerOnboardingModal', () => ({ default: () => null }));
vi.mock('../../../components/teamer/modals/TeamerUpdate230WalkthroughModal', () => ({ default: () => null }));
vi.mock('../../../components/konfi/modals/KonfiOnboardingModal', () => ({ default: () => null }));
vi.mock('../../../components/konfi/modals/KonfiUpdate230WalkthroughModal', () => ({ default: () => null }));
vi.mock('../../../components/shared/MitmachenErklaerungModal', () => ({ default: () => null }));
vi.mock('../../../components/shared/AppSperreSchalter', () => ({ default: () => null }));
vi.mock('../../../components/shared/AbsturzberichteSchalter', () => ({ default: () => null }));
vi.mock('../../../components/shared/SpiritFooter', () => ({ default: () => null }));
vi.mock('../../../hooks/useMediaCacheControl', () => ({ useMediaCacheControl: () => ({ cacheLabel: '1,0 MB belegt', clearMediaCache: vi.fn() }) }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost, put: vi.fn() } }));
vi.mock('../../../services/writeQueue', () => ({ writeQueue: { enqueue: vi.fn() } }));
vi.mock('../../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true } }));
vi.mock('../../../services/tokenStore', () => ({
  setUser: h.tokenSetUser,
  setToken: h.setToken,
  setRefreshToken: h.setRefreshToken,
  getDeviceId: () => 'geraet-7',
}));
vi.mock('../../../services/systemDialoge', () => ({ linkOeffnen: vi.fn() }));
vi.mock('../../../navigation/useAppLocation', () => ({ useAppLocation: () => ({ pathname: '/profile', search: '' }) }));
vi.mock('../../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: vi.fn() }));
vi.mock('../../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: h.seite }, presentingElement: h.seite }) }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({
    user: h.user,
    setUser: h.setUser,
    setError: h.setError,
    setSuccess: h.setSuccess,
    signOut: vi.fn(),
    isOnline: true,
    pushNotificationsPermission: 'granted',
    requestPushPermissions: vi.fn(),
  }),
}));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (schluessel: string) => {
    const art = Object.keys(h.daten).find((k) => schluessel.startsWith(k));
    return { data: art ? h.daten[art] : null, loading: false, refresh: h.refresh, refreshLive: vi.fn() };
  },
}));

import AdminProfilePage from '../../../components/admin/pages/AdminProfilePage';
import TeamerProfilePage from '../../../components/teamer/pages/TeamerProfilePage';
import KonfiProfilePage from '../../../components/konfi/pages/KonfiProfilePage';

// Erfundene Werte fuer die Passwortfelder. Zusammengesetzt statt als
// Zeichenkette, damit Geheimnis-Scanner einen Testwert nicht als Passwort im
// oeffentlichen Repo melden (wie support/webVorgangDetail.test.tsx).
const ALT = ['Bisher', '2025', 'Wert?'].join('-');
const NEU = ['Herbst', '2026', 'Wiese!'].join('-');

interface Rolle {
  rolle: string;
  variante: string;
  user: Record<string, unknown>;
  Seite: React.FC;
}

const ROLLEN: Rolle[] = [
  {
    rolle: 'Leitung',
    variante: 'users',
    user: { id: 3, type: 'admin', role_name: 'admin', display_name: 'Lena Leitung', username: 'lena.leitung', email: 'lena@example.org', organization: 'Testgemeinde' },
    Seite: AdminProfilePage,
  },
  {
    rolle: 'Team',
    variante: 'teamer',
    user: { id: 9, type: 'teamer', role_name: 'teamer', display_name: 'Tjark Test', email: 'tjark@example.org' },
    Seite: TeamerProfilePage,
  },
  {
    rolle: 'Konfi',
    variante: 'purple',
    user: { id: 7, type: 'konfi', role_name: 'konfi', display_name: 'Mia Beispiel', email: 'mia@example.org' },
    Seite: KonfiProfilePage,
  },
];

const antworten = () => {
  h.apiGet.mockImplementation((url: string) => (url in h.antworten
    ? Promise.resolve({ data: h.antworten[url] })
    : Promise.reject(new Error(`nicht vorgesehen: ${url}`))));
  // Der Server merkt sich die neue Adresse; GET /auth/me liefert sie danach.
  h.apiPost.mockImplementation((url: string, koerper: Record<string, unknown>) => {
    if (url === '/auth/update-email') {
      h.antworten['/auth/me'] = { email: koerper.email };
      return Promise.resolve({ data: { message: 'E-Mail-Adresse erfolgreich aktualisiert', email: koerper.email } });
    }
    if (url === '/auth/change-password') {
      return Promise.resolve({ data: { message: 'Passwort erfolgreich geändert', token: 'token-neu', refresh_token: 'refresh-neu' } });
    }
    return Promise.reject(new Error(`nicht vorgesehen: ${url}`));
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  h.apiGet.mockReset();
  h.apiPost.mockReset();
  h.breit = true;
  h.modale.length = 0;
  h.alerts.length = 0;
  h.antworten = {
    '/auth/me': { email: 'server@example.org' },
    '/einladungen/meine': [],
    '/notifications/preferences': { push_enabled: true, stumm: [], gruppen: [] },
    '/wrapped/history/7': [],
    '/wrapped/history/9': [],
    '/challenges/konfi': { active: [], archive: [], marks: [] },
    '/konfi/points-history': { history: [] },
  };
  h.daten = {
    'user:me': { role_title: '', email: 'lena@example.org', created_at: '2025-08-01T10:00:00.000Z' },
    'teamer:profile': {
      user: { display_name: 'Tjark Test', username: 'tjark.test', email: 'tjark@example.org', role_title: '', teamer_since: null, organization_name: 'Testgemeinde', bible_translation: 'LUT' },
      konfi_data: null,
    },
    'konfi:profile': {
      id: 7, username: 'mia.beispiel', display_name: 'Mia Beispiel', email: 'mia@example.org', jahrgang_name: '2026/27', jahrgang_year: 2026,
      created_at: '2026-01-12T10:00:00.000Z', bible_translation: 'LUT', total_points: 0, gottesdienst_points: 0, gemeinde_points: 0, bonus_points: 0,
      badge_count: 0, activity_count: 0, event_count: 0, pending_requests: 0,
      progress_overview: { monthly_points: [], achievements: { total_activities: 0, total_events: 0, total_badges: 0 } },
    },
  };
  antworten();
});

const zeigeBreit = async (r: Rolle) => {
  h.user = { ...r.user };
  render(<r.Seite />);
  await screen.findByRole('heading', { level: 1, name: 'Mein Profil' });
  await act(async () => { await Promise.resolve(); });
};

const zeigeSchmal = async (r: Rolle) => {
  h.breit = false;
  h.user = { ...r.user };
  render(<r.Seite />);
  await act(async () => { await Promise.resolve(); });
};

const knopfInZeile = (titel: string) => screen.getByRole('button', { name: `${titel}: Ändern` });
const feld = (dialog: HTMLElement, name: string) => within(dialog).getByLabelText(name) as HTMLInputElement;
const tippen = (el: HTMLInputElement, wert: string) => fireEvent.change(el, { target: { value: wert } });

describe.each(ROLLEN)('Profil $rolle, breites Fenster: eigene Dialoge statt App-Modale', (r) => {
  it('„E-Mail-Adresse: Ändern“ öffnet den Dialog mit der Adresse vom Server -- kein App-Modal; Abbrechen schickt nichts', async () => {
    await zeigeBreit(r);
    fireEvent.click(knopfInZeile('E-Mail-Adresse'));
    const dialog = screen.getByRole('dialog', { name: 'E-Mail ändern' });
    await waitFor(() => expect(feld(dialog, 'E-Mail-Adresse (optional)').value).toBe('server@example.org'));
    expect(h.modale).toEqual([]);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.apiPost).toHaveBeenCalledTimes(0);
    expect(h.modale).toEqual([]);
  });

  it('„Passwort: Ändern“ öffnet den Dialog „Passwort ändern“ -- kein App-Modal; Escape schließt ohne zu senden', async () => {
    await zeigeBreit(r);
    fireEvent.click(knopfInZeile('Passwort'));
    const dialog = screen.getByRole('dialog', { name: 'Passwort ändern' });
    expect(feld(dialog, 'Aktuelles Passwort')).toHaveAttribute('autocomplete', 'current-password');
    expect(h.modale).toEqual([]);

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.apiPost).toHaveBeenCalledTimes(0);
  });

  it('E-Mail speichern: POST /auth/update-email mit der neuen Adresse, Dialog zu, Seite neu geladen, Adresse in Anmeldung und TokenStore', async () => {
    await zeigeBreit(r);
    fireEvent.click(knopfInZeile('E-Mail-Adresse'));
    const dialog = screen.getByRole('dialog', { name: 'E-Mail ändern' });
    await waitFor(() => expect(feld(dialog, 'E-Mail-Adresse (optional)').value).toBe('server@example.org'));
    h.refresh.mockClear();

    tippen(feld(dialog, 'E-Mail-Adresse (optional)'), 'neu@example.org');
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' })); });

    expect(h.apiPost).toHaveBeenCalledTimes(1);
    expect(h.apiPost).toHaveBeenCalledWith('/auth/update-email', { email: 'neu@example.org' });
    expect(h.setSuccess).toHaveBeenCalledWith('E-Mail-Adresse erfolgreich aktualisiert');
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(h.setUser).toHaveBeenCalledTimes(1));
    expect(h.refresh).toHaveBeenCalledTimes(1);
    expect(h.setUser).toHaveBeenCalledWith({ ...r.user, email: 'neu@example.org' });
    expect(h.tokenSetUser).toHaveBeenCalledWith({ ...r.user, email: 'neu@example.org' });
    expect(h.setError).toHaveBeenCalledTimes(0);
  });

  it('Passwort speichern: POST /auth/change-password mit genau diesem Körper, neues Token-Paar übernommen, Dialog zu', async () => {
    await zeigeBreit(r);
    fireEvent.click(knopfInZeile('Passwort'));
    const dialog = screen.getByRole('dialog', { name: 'Passwort ändern' });
    tippen(feld(dialog, 'Aktuelles Passwort'), ALT);
    tippen(feld(dialog, 'Neues Passwort'), NEU);
    tippen(feld(dialog, 'Neues Passwort bestätigen'), NEU);
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' })); });

    expect(h.apiPost).toHaveBeenCalledTimes(1);
    expect(h.apiPost).toHaveBeenCalledWith('/auth/change-password', {
      currentPassword: ALT, newPassword: NEU, device_id: 'geraet-7', platform: 'web',
    });
    expect(h.setToken).toHaveBeenCalledWith('token-neu');
    expect(h.setRefreshToken).toHaveBeenCalledWith('refresh-neu');
    expect(h.setSuccess).toHaveBeenCalledWith('Passwort erfolgreich geändert');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.modale).toEqual([]);
  });
});

describe.each(ROLLEN)('Profil $rolle, schmales Fenster und App: weiter die Modale der App', (r) => {
  it(`E-Mail und Passwort öffnen die App-Modale in der Rollenfarbe (variante "${r.variante}") über der Seite, kein Dialog`, async () => {
    await zeigeSchmal(r);
    fireEvent.click(screen.getByRole('button', { name: /^E-Mail-Adresse ändern/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Passwort ändern/ }));

    expect(h.modale.map((m) => m.name)).toEqual(['ChangeEmailModal', 'ChangePasswordModal']);
    expect(h.modale.map((m) => m.props.variante)).toEqual([r.variante, r.variante]);
    expect(h.modale.map((m) => m.optionen?.presentingElement)).toEqual([h.seite, h.seite]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
