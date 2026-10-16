// Die Fenster der drei eigenen Profile (Leitung, Team, Konfi), gerendert:
// Funktionsbeschreibung, Bibelübersetzung, Benachrichtigungen, Konto löschen
// und die Punkte-Übersicht. Simon, 15.10.2026: im Browser ab 992 px bekommt
// jedes Formular, das noch ein App-Modal öffnet, ein kompaktes Web-Fenster;
// in den Apps und im schmalen Fenster bleibt das Modal, wie es ist. Die
// Punkte-Übersicht springt im Browser zur Tabelle „Punkte-Verlauf", die
// dieselben Einträge schon zeigt. Dazu: Abmelden im Profil der Leitung.
//
// Gerendert werden die echten Seiten mit der echten Logik; nachgestellt sind
// Server, Anmeldung, Zwischenspeicher und Ionic (die Modale der App als
// Attrappen mit Namen, damit der Test sieht, welches angefordert wird). Die
// Einzelheiten der Fenster (Prüfung, Fehler, offline) stehen in
// shared/webProfilDialoge.test.tsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import './zeitrahmen';
import React from 'react';
import { render, screen, fireEvent, within, waitFor, act } from '@testing-library/react';

const h = vi.hoisted(() => ({
  breit: true,
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  push: vi.fn(),
  modale: [] as Array<{ name: string; props: Record<string, unknown>; optionen: Record<string, unknown> | undefined }>,
  alerts: [] as Array<{ header?: string; message?: string; buttons?: Array<{ text: string; role?: string; handler?: () => unknown }> }>,
  seite: document.createElement('div'),
  user: {} as Record<string, unknown>,
  signOut: vi.fn(async () => undefined),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  refresh: vi.fn(async () => undefined),
  suche: '',
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
  ...(await vi.importActual<typeof import('../../../components/shared/BibleTranslationModal')>('../../../components/shared/BibleTranslationModal')),
  default: (await import('./ionicStart')).modalAttrappe('BibleTranslationModal'),
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
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost, put: h.apiPut } }));
vi.mock('../../../services/writeQueue', () => ({ writeQueue: { enqueue: vi.fn() } }));
vi.mock('../../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true } }));
vi.mock('../../../services/tokenStore', () => ({ setUser: vi.fn(), setToken: vi.fn(), setRefreshToken: vi.fn(), getDeviceId: () => 'geraet-7' }));
vi.mock('../../../services/systemDialoge', () => ({ linkOeffnen: vi.fn() }));
vi.mock('../../../navigation/useAppLocation', () => ({ useAppLocation: () => ({ pathname: '/profile', search: h.suche }) }));
vi.mock('../../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: vi.fn() }));
vi.mock('../../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: h.seite }, presentingElement: h.seite }) }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({
    user: h.user,
    setUser: vi.fn(),
    setError: h.setError,
    setSuccess: h.setSuccess,
    signOut: h.signOut,
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

type Fassung = 'app' | 'web';

interface Rolle {
  rolle: 'Leitung' | 'Team' | 'Konfi';
  user: Record<string, unknown>;
  Seite: React.FC;
}

const LEITUNG: Rolle = {
  rolle: 'Leitung',
  user: { id: 3, type: 'admin', role_name: 'admin', display_name: 'Lena Leitung', username: 'lena.leitung', email: 'lena@example.org', organization: 'Testgemeinde' },
  Seite: AdminProfilePage,
};
const TEAM: Rolle = {
  rolle: 'Team',
  user: { id: 9, type: 'teamer', role_name: 'teamer', display_name: 'Tjark Test', email: 'tjark@example.org' },
  Seite: TeamerProfilePage,
};
const KONFI: Rolle = {
  rolle: 'Konfi',
  user: { id: 7, type: 'konfi', role_name: 'konfi', display_name: 'Mia Beispiel', email: 'mia@example.org' },
  Seite: KonfiProfilePage,
};

const VERLAUF = [
  { id: 1, title: 'Gottesdienst am Sonntag', points: 1, category: 'gottesdienst', date: '2026-09-27T10:00:00Z', source_type: 'activity' },
];

beforeEach(() => {
  vi.clearAllMocks();
  h.apiGet.mockReset();
  h.apiPost.mockReset();
  h.apiPut.mockReset();
  h.breit = true;
  h.suche = '';
  h.modale.length = 0;
  h.alerts.length = 0;
  h.antworten = {
    '/auth/me': { email: 'server@example.org' },
    '/einladungen/meine': [],
    '/notifications/preferences': { push_enabled: true, stumm: [], gruppen: [{ id: 'konfi_chat', name: 'Nachrichten', beschreibung: '', aktiv: true }] },
    '/wrapped/history/7': [],
    '/wrapped/history/9': [],
    '/challenges/konfi': { active: [], archive: [], marks: [] },
    '/konfi/points-history': { history: VERLAUF },
  };
  h.daten = {
    'user:me': { role_title: 'Gemeindepädagogin', email: 'lena@example.org', created_at: '2025-08-01T10:00:00.000Z' },
    'teamer:profile': {
      user: { display_name: 'Tjark Test', username: 'tjark.test', email: 'tjark@example.org', role_title: 'Jugendleiterin', teamer_since: null, organization_name: 'Testgemeinde', bible_translation: 'LUT' },
      konfi_data: null,
    },
    'konfi:profile': {
      id: 7, username: 'mia.beispiel', display_name: 'Mia Beispiel', email: 'mia@example.org', jahrgang_name: '2026/27', jahrgang_year: 2026,
      created_at: '2026-01-12T10:00:00.000Z', bible_translation: 'LUT', total_points: 1, gottesdienst_points: 1, gemeinde_points: 0, bonus_points: 0,
      gottesdienst_enabled: true, gemeinde_enabled: true,
      badge_count: 0, activity_count: 0, event_count: 0, pending_requests: 0,
      progress_overview: { monthly_points: [], achievements: { total_activities: 0, total_events: 0, total_badges: 0 } },
    },
  };
  h.apiGet.mockImplementation((url: string) => (url in h.antworten
    ? Promise.resolve({ data: h.antworten[url] })
    : Promise.reject(new Error(`nicht vorgesehen: ${url}`))));
  h.apiPost.mockResolvedValue({ data: {} });
  h.apiPut.mockImplementation(async (_u: string, b: Record<string, unknown>) => ({ data: { ...b } }));
});

const rollen: Array<{ restore: () => void }> = [];
afterEach(() => { for (const r of rollen.splice(0)) r.restore(); });

const zeige = async (r: Rolle, fassung: Fassung) => {
  h.breit = fassung === 'web';
  h.user = { ...r.user };
  render(<r.Seite />);
  if (fassung === 'web') await screen.findByRole('heading', { level: 1, name: 'Mein Profil' });
  await act(async () => { await Promise.resolve(); });
};

/** Die Zeile der Einstellungen öffnen: im Browser der Knopf „Titel: Ändern", in der App die Zeile selbst. */
const zeileOeffnen = (fassung: Fassung, titel: string, knopf = 'Ändern') => {
  if (fassung === 'web') fireEvent.click(screen.getByRole('button', { name: `${titel}: ${knopf}` }));
  else fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${titel}`) }));
};

const modalNamen = () => h.modale.map((m) => m.name);

// --- Funktionsbeschreibung (Leitung, Team) ------------------------------------------------
describe.each([LEITUNG, TEAM])('Funktionsbeschreibung $rolle', (r) => {
  const gespeichert = r.rolle === 'Leitung' ? 'Gemeindepädagogin' : 'Jugendleiterin';

  it('Browser: ein Dialog mit der gespeicherten Beschreibung, kein App-Modal; Speichern schickt POST /auth/update-role-title, schließt und lädt neu', async () => {
    await zeige(r, 'web');
    zeileOeffnen('web', 'Funktionsbeschreibung');
    const dialog = screen.getByRole('dialog', { name: 'Funktionsbeschreibung' });
    const feld = within(dialog).getByRole('textbox', { name: 'Funktionsbeschreibung' }) as HTMLInputElement;
    expect(feld.value).toBe(gespeichert);
    expect(h.modale).toEqual([]);
    h.refresh.mockClear();
    fireEvent.change(feld, { target: { value: ' Diakonin ' } });
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' })); });
    expect(h.apiPost.mock.calls).toEqual([['/auth/update-role-title', { role_title: 'Diakonin' }]]);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.refresh).toHaveBeenCalledTimes(1);
  });

  it('App und schmales Fenster: das Modal der App mit derselben Beschreibung, kein Dialog', async () => {
    await zeige(r, 'app');
    zeileOeffnen('app', 'Funktionsbeschreibung');
    expect(modalNamen()).toEqual(['ChangeRoleTitleModal']);
    expect(h.modale[0].props.initialRoleTitle).toBe(gespeichert);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

// --- Bibelübersetzung (Team, Konfi) --------------------------------------------------------
describe.each([
  { ...TEAM, route: '/teamer/bible-translation' },
  { ...KONFI, route: '/konfi/bible-translation' },
])('Bibelübersetzung $rolle: dieselbe Wahl, derselbe Aufruf', (r) => {
  /** Die Übersetzung wählen: im Browser der Klick im Dialog, in der App die Wahl im Modal. */
  const waehlen = async (fassung: Fassung, code: string, name: string) => {
    zeileOeffnen(fassung, 'Bibelübersetzung');
    if (fassung === 'web') {
      const dialog = screen.getByRole('dialog', { name: 'Bibelübersetzung' });
      expect(h.modale).toEqual([]);
      const knopf = within(dialog).getAllByRole('button').find((b) => b.textContent?.startsWith(name));
      expect(within(dialog).getAllByRole('button').find((b) => b.getAttribute('aria-pressed') === 'true')?.textContent).toMatch(/^Lutherbibel 2017/);
      await act(async () => { fireEvent.click(knopf as HTMLElement); });
    } else {
      expect(modalNamen()).toEqual(['BibleTranslationModal']);
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(h.modale[0].props.currentTranslation).toBe('LUT');
      await act(async () => { (h.modale[0].props.onSelect as (c: string) => void)(code); });
    }
  };

  it.each<Fassung>(['web', 'app'])('%s: „Gute Nachricht Bibel" geht als PUT an die Route der Rolle', async (fassung) => {
    await zeige(r, fassung);
    await waehlen(fassung, 'GNB', 'Gute Nachricht Bibel');
    await waitFor(() => expect(h.apiPut).toHaveBeenCalledTimes(1));
    expect(h.apiPut.mock.calls).toEqual([[r.route, { translation: 'GNB' }]]);
    if (fassung === 'web') expect(screen.queryByRole('dialog')).toBeNull();
  });
});

// --- Konto löschen (alle drei) ----------------------------------------------------------------
describe.each([LEITUNG, TEAM, KONFI])('Konto löschen $rolle', (r) => {
  it('Browser: der Dialog „Konto löschen" mit Passwortfeld, kein App-Modal; Abbrechen schickt nichts', async () => {
    await zeige(r, 'web');
    fireEvent.click(screen.getByRole('button', { name: 'Konto löschen' }));
    const dialog = screen.getByRole('dialog', { name: 'Konto löschen' });
    expect(within(dialog).getByLabelText('Dein Passwort')).toHaveAttribute('type', 'password');
    expect(h.modale).toEqual([]);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.apiPost).not.toHaveBeenCalled();
  });

  it('App und schmales Fenster: das Modal der App über der Seite', async () => {
    await zeige(r, 'app');
    fireEvent.click(screen.getByRole('button', { name: /Konto löschen/ }));
    expect(modalNamen()).toEqual(['DeleteAccountModal']);
    expect(h.modale[0].optionen?.presentingElement).toBe(h.seite);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

// --- Benachrichtigungen ----------------------------------------------------------------------
describe.each([LEITUNG, TEAM, KONFI])('Benachrichtigungen $rolle im Browser', (r) => {
  it('„Auswählen" öffnet den Dialog, kein App-Modal; ein Wechsel geht als PUT und der Stand der Zeile zieht mit', async () => {
    await zeige(r, 'web');
    expect(await screen.findByText('Alle Mitteilungen aufs Handy')).toBeInTheDocument();
    zeileOeffnen('web', 'Benachrichtigungen', 'Auswählen');
    const dialog = screen.getByRole('dialog', { name: 'Benachrichtigungen' });
    expect(h.modale).toEqual([]);
    const gruppe = await within(dialog).findByRole('switch', { name: 'Nachrichten' });
    await act(async () => { fireEvent.click(gruppe); });
    expect(h.apiPut.mock.calls).toEqual([['/notifications/preferences', { stumm: ['konfi_chat'] }]]);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fertig' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Keine Gruppe ausgewählt – nur im Postfach')).toBeInTheDocument();
  });
});

describe.each([TEAM, KONFI])('Benachrichtigungen $rolle in der App', (r) => {
  it('der Eintrag öffnet das Modal der App, kein Dialog', async () => {
    await zeige(r, 'app');
    fireEvent.click(screen.getByRole('button', { name: /^Benachrichtigungen/ }));
    expect(modalNamen()).toEqual(['PushAuswahlModal']);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

// --- Punkte-Übersicht (Konfi) -------------------------------------------------------------------
describe('Punkte-Übersicht im Profil der Konfis', () => {
  /** Wohin gerollt wurde: scrollIntoView gibt es in jsdom nicht. */
  const rollenMitschreiben = () => {
    const gerollt: Element[] = [];
    const vorher = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function rollen(this: Element) { gerollt.push(this); };
    rollen.push({ restore: () => { Element.prototype.scrollIntoView = vorher; } });
    return gerollt;
  };

  it('Browser: „Punkte-Übersicht" springt zur Tabelle „Punkte-Verlauf" und nimmt den Fokus mit -- kein Modal', async () => {
    const gerollt = rollenMitschreiben();
    await zeige(KONFI, 'web');
    const tabelle = await screen.findByRole('table', { name: 'Punkte-Verlauf' });
    fireEvent.click(screen.getByRole('button', { name: 'Punkte-Übersicht' }));
    expect(gerollt).toHaveLength(1);
    expect(gerollt[0]).toContainElement(tabelle);
    expect(document.activeElement).toBe(gerollt[0]);
    expect(h.modale).toEqual([]);
  });

  it('Browser: der Link ?punkte=1 aus Push und Postfach springt ebenso zur Tabelle', async () => {
    const gerollt = rollenMitschreiben();
    h.suche = '?punkte=1';
    await zeige(KONFI, 'web');
    expect(gerollt).toHaveLength(1);
    expect(gerollt[0]).toContainElement(screen.getByRole('heading', { name: 'Punkte-Verlauf' }));
    expect(h.modale).toEqual([]);
  });

  it('App: ?punkte=1 öffnet weiter die Punkte-Übersicht der App', async () => {
    const gerollt = rollenMitschreiben();
    h.suche = '?punkte=1';
    await zeige(KONFI, 'app');
    expect(modalNamen()).toEqual(['PointsHistoryModal']);
    expect(gerollt).toHaveLength(0);
  });
});

// --- Abmelden im Profil der Leitung ---------------------------------------------------------------
describe('Abmelden im Profil der Leitung (Browser)', () => {
  it('die Karte „Konto" hat den Knopf; er fragt wie die Seitenleiste nach, erst die Bestätigung meldet ab', async () => {
    await zeige(LEITUNG, 'web');
    const konto = screen.getByRole('heading', { name: 'Konto' }).closest('section') as HTMLElement;
    fireEvent.click(within(konto).getByRole('button', { name: 'Abmelden' }));
    expect(h.alerts).toHaveLength(1);
    expect(h.alerts[0].header).toBe('Abmelden');
    expect(h.alerts[0].message).toBe('Möchtest du dich wirklich abmelden?');
    expect(h.alerts[0].buttons?.map((b) => [b.text, b.role])).toEqual([['Abbrechen', 'cancel'], ['Abmelden', 'destructive']]);
    expect(h.signOut).not.toHaveBeenCalled();
    await act(async () => { await h.alerts[0].buttons?.find((b) => b.role === 'destructive')?.handler?.(); });
    expect(h.signOut).toHaveBeenCalledTimes(1);
  });
});
