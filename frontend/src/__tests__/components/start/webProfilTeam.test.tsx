// Profil des Teams und Konfi-Historie in der Web-Fassung, gerendert (03.10.2026,
// docs/planung/web-alle-bereiche.md, Entscheidung 6). Das Profil ist zweispaltig:
// links Person und Einstellungen, rechts die Wege zu Badges und Konfi-Historie,
// die Konfi-Zeit, Rueckblicke und Neuerungen. Die Konfi-Historie zeigt Punkte,
// Verlauf, Events der Konfi-Zeit, Badges und den Rueckblick der Person. Alle
// Handgriffe sind die der App -- dieselben Modale mit denselben Eigenschaften.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import './zeitrahmen';
import React from 'react';
import { render, screen, fireEvent, within, waitFor, act } from '@testing-library/react';
import type { ModalAufruf } from './ionicStart';

const h = vi.hoisted(() => ({
  breit: true,
  laedt: false,
  apiGet: vi.fn(),
  push: vi.fn(),
  modale: [] as Array<{ name: string; props: Record<string, unknown>; optionen: Record<string, unknown> | undefined }>,
  alerts: [] as unknown[],
  seite: document.createElement('div'),
  user: { id: 9, type: 'teamer', display_name: 'Tjark Test', role_name: 'teamer', email: 'tjark@example.org' } as Record<string, unknown>,
  profil: null as unknown,
  konfiZeit: null as unknown,
  refresh: vi.fn(),
  signOut: vi.fn(),
  cacheLeeren: vi.fn(),
  antworten: {} as Record<string, unknown>,
}));

vi.mock('@ionic/react', async () => (await import('./ionicStart')).ionicStart(h as never));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('../support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: ({ message }: { message: string }) => <p>{message}</p> }));
vi.mock('../../../components/shared/NeuerungenBanner', () => ({
  default: ({ onUpdateOeffnen, onMitmachenOeffnen }: { onUpdateOeffnen: () => void; onMitmachenOeffnen: () => void }) => (
    <div>
      <button type="button" onClick={onUpdateOeffnen}>Neuerungen öffnen</button>
      <button type="button" onClick={onMitmachenOeffnen}>Mitmachen erklären</button>
    </div>
  ),
}));
vi.mock('../../../components/shared/ChangeEmailModal', async () => ({ default: (await import('./ionicStart')).modalAttrappe('ChangeEmailModal') }));
vi.mock('../../../components/shared/ChangePasswordModal', async () => ({ default: (await import('./ionicStart')).modalAttrappe('ChangePasswordModal') }));
vi.mock('../../../components/shared/DeleteAccountModal', async () => ({ default: (await import('./ionicStart')).modalAttrappe('DeleteAccountModal') }));
vi.mock('../../../components/admin/modals/ChangeRoleTitleModal', async () => ({ default: (await import('./ionicStart')).modalAttrappe('ChangeRoleTitleModal') }));
vi.mock('../../../components/konfi/modals/PointsHistoryModal', async () => ({ default: (await import('./ionicStart')).modalAttrappe('PointsHistoryModal') }));
vi.mock('../../../components/wrapped/WrappedModal', async () => ({ default: (await import('./ionicStart')).modalAttrappe('WrappedModal') }));
vi.mock('../../../components/shared/BibleTranslationModal', async () => ({
  default: (await import('./ionicStart')).modalAttrappe('BibleTranslationModal'),
  getTranslationName: (code: string) => (code === 'LUT' ? 'Lutherbibel 2017' : code),
}));
vi.mock('../../../components/teamer/modals/TeamerOnboardingModal', () => ({ default: () => <p>App-Tour läuft</p> }));
vi.mock('../../../components/teamer/modals/TeamerUpdate230WalkthroughModal', () => ({ default: () => <p>Neuerungen laufen</p> }));
vi.mock('../../../components/shared/MitmachenErklaerungModal', () => ({ default: () => <p>Mitmachen wird erklärt</p> }));
vi.mock('../../../components/shared/AppSperreSchalter', () => ({ default: () => null }));
vi.mock('../../../components/shared/AbsturzberichteSchalter', () => ({ default: () => null }));
vi.mock('../../../components/shared/SpiritFooter', () => ({ default: () => null }));
vi.mock('../../../hooks/useMediaCacheControl', () => ({ useMediaCacheControl: () => ({ cacheLabel: '3,1 MB belegt', clearMediaCache: h.cacheLeeren }) }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: vi.fn(), put: vi.fn() } }));
vi.mock('../../../services/writeQueue', () => ({ writeQueue: { enqueue: vi.fn() } }));
vi.mock('../../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true } }));
vi.mock('../../../services/tokenStore', () => ({ setUser: vi.fn() }));
vi.mock('../../../navigation/useAppLocation', () => ({ useAppLocation: () => ({ pathname: '/teamer/profile', search: '' }) }));
vi.mock('../../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: vi.fn() }));
vi.mock('../../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: h.seite }, presentingElement: h.seite }) }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({
    user: h.user,
    setUser: vi.fn(),
    setError: vi.fn(),
    setSuccess: vi.fn(),
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
    const daten = schluessel.startsWith('teamer:profile') ? h.profil : schluessel.startsWith('teamer:konfi-zeit') ? h.konfiZeit : null;
    return { data: h.laedt ? null : daten, loading: h.laedt, refresh: h.refresh, refreshLive: vi.fn() };
  },
}));

import TeamerProfilePage from '../../../components/teamer/pages/TeamerProfilePage';
import TeamerKonfiStatsPage from '../../../components/teamer/pages/TeamerKonfiStatsPage';

const BADGES = [
  { badge_id: 1, name: 'Erster Schritt', description: 'Die ersten Punkte gesammelt.', icon: 'trophy', color: '#c0c0c0', awarded_date: '2024-02-10T10:00:00Z', criteria_type: 'total_points', criteria_value: 5 },
  { badge_id: 2, name: 'Gottesdienst-Held', description: 'Oft im Gottesdienst gewesen.', icon: 'sunny', color: '#f59e0b', awarded_date: '2024-05-20T10:00:00Z', criteria_type: 'gottesdienst_points', criteria_value: 8 },
  { badge_id: 3, name: 'Event-Champion', description: 'Viele Events besucht.', icon: 'calendar', color: '#3b82f6', awarded_date: '2024-03-15T10:00:00Z', criteria_type: 'event_count', criteria_value: 3 },
];

const PROFIL = {
  user: {
    display_name: 'Tjark Test', username: 'tjark.test', email: 'tjark@example.org', role_title: 'Jugendleiterin',
    teamer_since: '2025-03-14T10:00:00.000Z', organization_name: 'Testgemeinde', bible_translation: 'LUT',
  },
  konfi_data: { gottesdienst_points: 9, gemeinde_points: 12, jahrgang_name: '2023/24', badges: BADGES },
};

const RUECKBLICKE = [
  { id: 51, wrapped_type: 'teamer', year: 2026, data: {}, computed_at: '2026-09-30T10:00:00Z', titel: 'Dein Team-Jahr', ausgabe_id: 3 },
  { id: 50, wrapped_type: 'konfi', year: 2024, data: {}, computed_at: '2024-06-20T10:00:00Z', titel: 'Konfi-Abschluss', ausgabe_id: 1 },
];

const VERLAUF = [
  { id: 2, title: 'Konfi-Fahrt', points: 3, category: 'gemeinde', date: '2024-06-02T10:00:00Z', event_date: '2024-05-25T08:00:00Z', source_type: 'event' },
  { id: 1, title: 'Gottesdienst im Advent', points: 1, category: 'gottesdienst', date: '2024-12-08T10:00:00Z', source_type: 'activity' },
  { id: 3, title: 'Bonus für Einsatz', points: 2, category: 'gemeinde', date: '2024-02-01T10:00:00Z', source_type: 'bonus' },
];

const KONFI_ZEIT = {
  konfi_zeit: {
    jahrgang_name: '2023/24', anlass: 'befoerderung', erstellt_am: '2025-03-14T10:00:00Z',
    termine: [
      { event_id: 71, name: 'Konfi-Fahrt', datum: '2024-05-25T08:00:00Z', status: 'confirmed', anwesenheit: 'present', punkte: 3 },
      { event_id: 72, name: 'Elternabend', datum: '2024-04-10T17:00:00Z', status: 'confirmed', anwesenheit: 'absent', punkte: 0 },
      { event_id: 73, name: 'Vorstellungsgottesdienst', datum: '2024-06-09T08:00:00Z', status: null, punkte: 1 },
    ],
  },
};

const antworten = () => {
  h.apiGet.mockImplementation((url: string) => {
    if (url in h.antworten) {
      const a = h.antworten[url];
      return a instanceof Error ? Promise.reject(a) : Promise.resolve({ data: a });
    }
    return Promise.reject(new Error(`nicht vorgesehen: ${url}`));
  });
};

const karte = (titel: string): HTMLElement => screen.getByRole('heading', { name: titel }).closest('section') as HTMLElement;
const modal = (name: string): ModalAufruf | undefined => h.modale.find((m) => m.name === name);
const knopfInZeile = (titel: string, knopf: string) => screen.getByRole('button', { name: `${titel}: ${knopf}` });

beforeEach(() => {
  vi.clearAllMocks();
  h.apiGet.mockReset();
  h.breit = true;
  h.laedt = false;
  h.modale.length = 0;
  h.alerts.length = 0;
  h.profil = PROFIL;
  h.konfiZeit = KONFI_ZEIT;
  h.user = { id: 9, type: 'teamer', display_name: 'Tjark Test', role_name: 'teamer', email: 'tjark@example.org' };
  h.antworten = {
    '/wrapped/history/9': RUECKBLICKE,
    '/notifications/preferences': { push_enabled: true, stumm: [], gruppen: [] },
    '/einladungen/meine': [],
    '/teamer/konfi-history': { history: VERLAUF },
  };
  antworten();
});

const zeigeProfil = async () => {
  const ergebnis = render(<TeamerProfilePage />);
  await screen.findByRole('heading', { level: 1, name: 'Mein Profil' });
  await waitFor(() => expect(h.apiGet).toHaveBeenCalledWith('/notifications/preferences'));
  await act(async () => { await Promise.resolve(); });
  return ergebnis;
};

describe('Profil des Teams (Web): Person und Wege', () => {
  it('zeigt erst Platzhalter, dann die Person mit ihrer Selbstbezeichnung und den Angaben', async () => {
    h.laedt = true;
    const { unmount } = render(<TeamerProfilePage />);
    expect(screen.getByRole('status')).toHaveTextContent('Das Profil wird geladen.');
    unmount();
    h.laedt = false;
    await zeigeProfil();
    expect(screen.getByText('Konto und Einstellungen')).toBeInTheDocument();
    const person = screen.getByRole('region', { name: 'Person' });
    expect(within(person).getByRole('heading', { level: 2, name: 'Tjark Test' })).toBeInTheDocument();
    expect(person).toHaveTextContent('Jugendleiterin');
    expect(within(person).getByText('@tjark.test')).toBeInTheDocument();
    expect(within(person).getByText('tjark@example.org')).toBeInTheDocument();
    expect(within(person).getByText('Testgemeinde')).toBeInTheDocument();
    expect(within(person).getByText('14.03.2025')).toBeInTheDocument();
  });

  it('ohne eigene Bezeichnung steht „Teamer:in" unter dem Namen', async () => {
    h.profil = { ...PROFIL, user: { ...PROFIL.user, role_title: '   ' } };
    await zeigeProfil();
    expect(within(screen.getByRole('region', { name: 'Person' })).getByText('Teamer:in')).toBeInTheDocument();
    // Eine Bezeichnung aus Leerzeichen ist keine: die Zeile der Einstellungen nennt das Beispiel.
    expect(screen.getByRole('list', { name: 'Konto-Einstellungen' })).toHaveTextContent('Funktionsbeschreibungz.B. Jugendleiter:in');
  });

  it('traegt die Team-Farbe', async () => {
    const { container } = await zeigeProfil();
    expect(container.querySelector('.web-rolle--team')).not.toBeNull();
    expect(container.querySelector('.web-rolle--leitung')).toBeNull();
  });

  it('„Inhalt" fuehrt zu den Badges und zur Konfi-Historie', async () => {
    await zeigeProfil();
    const inhalt = screen.getByRole('list', { name: 'Inhalt' });
    expect(within(inhalt).getByRole('link', { name: 'Badges: Ansehen' })).toHaveAttribute('href', '/teamer/profile/badges');
    expect(within(inhalt).getByRole('link', { name: 'Konfi-Historie: Öffnen' })).toHaveAttribute('href', '/teamer/profile/konfi-stats');
  });

  it('die Konfi-Zeit nennt die Punkte mit Wort und die Zahl der Badges', async () => {
    await zeigeProfil();
    const konfiZeit = karte('Deine Konfi-Zeit');
    expect(konfiZeit).toHaveTextContent('Jahrgang 2023/24');
    expect(konfiZeit).toHaveTextContent('Punkte gesamt21 Punkte');
    expect(konfiZeit).toHaveTextContent('Gottesdienst9 Punkte');
    expect(konfiZeit).toHaveTextContent('Gemeinde12 Punkte');
    expect(konfiZeit).toHaveTextContent('Badges3');
    expect(within(konfiZeit).getByRole('link', { name: 'Konfi-Historie öffnen' })).toHaveAttribute('href', '/teamer/profile/konfi-stats');
  });

  it('ohne Konfi-Zeit fehlen Karte und Weg zur Historie', async () => {
    h.profil = { ...PROFIL, konfi_data: null };
    await zeigeProfil();
    expect(screen.queryByRole('heading', { name: 'Deine Konfi-Zeit' })).toBeNull();
    expect(screen.queryByRole('link', { name: /Konfi-Historie/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Badges: Ansehen' })).toBeInTheDocument();
  });

  it('ohne Profil steht eine Meldung -- und Abmelden bleibt moeglich', async () => {
    h.profil = null;
    render(<TeamerProfilePage />);
    expect(await screen.findByText('Das Profil konnte nicht geladen werden.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Erneut versuchen/ }));
    expect(h.refresh).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Abmelden' }));
    expect(h.alerts).toHaveLength(1);
  });
});

describe('Profil des Teams (Web): Einstellungen -- dieselben Handgriffe wie in der App', () => {
  it('Funktionsbeschreibung oeffnet das Modal mit der aktuellen Bezeichnung', async () => {
    await zeigeProfil();
    expect(screen.getByRole('list', { name: 'Konto-Einstellungen' })).toHaveTextContent('FunktionsbeschreibungAktuell: Jugendleiterin');
    fireEvent.click(knopfInZeile('Funktionsbeschreibung', 'Ändern'));
    expect(modal('ChangeRoleTitleModal')?.props.initialRoleTitle).toBe('Jugendleiterin');
    expect(modal('ChangeRoleTitleModal')?.props.sectionIconClass).toBe('app-section-icon--teamer');
    expect(modal('ChangeRoleTitleModal')?.optionen?.presentingElement).toBe(h.seite);
  });

  it('E-Mail, Passwort, Bibeluebersetzung und Konto loeschen oeffnen die Modale in der Farbe des Teams', async () => {
    await zeigeProfil();
    fireEvent.click(knopfInZeile('E-Mail-Adresse', 'Ändern'));
    expect(modal('ChangeEmailModal')?.props.variante).toBe('teamer');
    fireEvent.click(knopfInZeile('Passwort', 'Ändern'));
    expect(modal('ChangePasswordModal')?.props.variante).toBe('teamer');
    fireEvent.click(knopfInZeile('Bibelübersetzung', 'Ändern'));
    expect(modal('BibleTranslationModal')?.props.currentTranslation).toBe('LUT');
    expect(modal('BibleTranslationModal')?.props.itemVariant).toBe('teamer');
    fireEvent.click(screen.getByRole('button', { name: 'Konto löschen' }));
    expect(modal('DeleteAccountModal')?.optionen?.presentingElement).toBe(h.seite);
  });

  it('Medien-Cache leert ihn; App-Tour und Neuerungen zeigen ihre Overlays', async () => {
    await zeigeProfil();
    expect(screen.getByRole('list', { name: 'Konto-Einstellungen' })).toHaveTextContent('Medien-Cache3,1 MB belegt');
    fireEvent.click(knopfInZeile('Medien-Cache', 'Leeren'));
    expect(h.cacheLeeren).toHaveBeenCalledTimes(1);
    fireEvent.click(knopfInZeile('App-Tour', 'Ansehen'));
    expect(screen.getByText('App-Tour läuft')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Neuerungen öffnen' }));
    expect(screen.getByText('Neuerungen laufen')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mitmachen erklären' }));
    expect(screen.getByText('Mitmachen wird erklärt')).toBeInTheDocument();
  });

  it('Benachrichtigungen oeffnen die Auswahl in der Farbe des Teams', async () => {
    await zeigeProfil();
    expect(await screen.findByText('Alle Mitteilungen aufs Handy')).toBeInTheDocument();
    fireEvent.click(knopfInZeile('Benachrichtigungen', 'Auswählen'));
    expect(modal('PushAuswahlModal')?.props.variante).toBe('teamer');
  });

  it('Abmelden fragt nach; erst die Bestaetigung meldet ab', async () => {
    await zeigeProfil();
    fireEvent.click(screen.getByRole('button', { name: 'Abmelden' }));
    const alert = h.alerts[0] as { header: string; buttons: Array<{ role?: string; handler?: () => unknown }> };
    expect(alert.header).toBe('Abmelden');
    expect(h.signOut).not.toHaveBeenCalled();
    await act(async () => { await alert.buttons.find((b) => b.role === 'destructive')?.handler?.(); });
    expect(h.signOut).toHaveBeenCalledTimes(1);
  });

  it('Einladungen erscheinen oben rechts, sobald eine offen ist', async () => {
    h.antworten['/einladungen/meine'] = [{
      id: 5, organization_display_name: 'St. Petri', organization_name: 'st-petri', role_display_name: 'Leitung', role_name: 'admin',
      eingeladen_von_name: null, expires_at: '2026-10-20T10:00:00Z',
    }];
    await zeigeProfil();
    const k = await waitFor(() => karte('Einladung'));
    expect(k).toHaveTextContent('St. Petri');
    expect(within(k).getByRole('button', { name: 'Annehmen' })).toBeEnabled();
  });

  it('Rueckblicke oeffnen im Modal der App -- mit dem Typ der Ausgabe', async () => {
    await zeigeProfil();
    const rueckblicke = await waitFor(() => karte('Meine Rückblicke'));
    expect(rueckblicke).toHaveTextContent('Dein Team-JahrErstellt am 30.09.2026');
    expect(rueckblicke).toHaveTextContent('Konfi-AbschlussErstellt am 20.06.2024');
    fireEvent.click(knopfInZeile('Konfi-Abschluss', 'Ansehen'));
    await waitFor(() => expect(modal('WrappedModal')).toBeDefined());
    expect(modal('WrappedModal')?.props.wrappedType).toBe('konfi');
    expect(modal('WrappedModal')?.props.initialYear).toBe(2024);
  });
});

describe('Profil des Teams: schmales Fenster', () => {
  it('bleibt die Darstellung der App, ohne Web-Seite', async () => {
    h.breit = false;
    const { container } = render(<TeamerProfilePage />);
    await act(async () => { await Promise.resolve(); });
    expect(container.querySelector('.web-seite')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Person' })).toBeNull();
    expect(screen.getByText('Tjark Test')).toBeInTheDocument();
  });
});

// --- Konfi-Historie -------------------------------------------------------------

const zeigeHistorie = async () => {
  const ergebnis = render(<TeamerKonfiStatsPage />);
  await screen.findByRole('heading', { level: 1, name: 'Konfi-Historie' });
  await screen.findByRole('table', { name: 'Punkte-Verlauf' });
  return ergebnis;
};

describe('Konfi-Historie des Teams (Web)', () => {
  it('Seitenkopf mit Jahrgang und Weg zurueck ins Profil; erst Platzhalter', async () => {
    h.laedt = true;
    const { unmount } = render(<TeamerKonfiStatsPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Die Konfi-Historie wird geladen.');
    unmount();
    h.laedt = false;
    await zeigeHistorie();
    expect(screen.getByText('Jahrgang 2023/24')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Profil' })).toHaveAttribute('href', '/teamer/profile');
  });

  it('die Kacheln nennen Punkte gesamt, je Art und die Zahl der Badges', async () => {
    const { container } = await zeigeHistorie();
    expect(screen.getByRole('group', { name: 'Punkte gesamt: 21' })).toHaveTextContent('21 Punkte');
    expect(screen.getByRole('group', { name: 'Gottesdienst: 9' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Gemeinde: 12' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Badges: 3' })).toHaveTextContent('aus der Konfi-Zeit');
    expect(container.querySelector('.web-rolle--team')).not.toBeNull();
  });

  it('der Verlauf liest die Route der Konfi-Historie, beide Punktearten zaehlen immer', async () => {
    await zeigeHistorie();
    expect(h.apiGet).toHaveBeenCalledWith('/teamer/konfi-history');
    const tabelle = screen.getByRole('table', { name: 'Punkte-Verlauf' });
    const zeilen = within(tabelle).getAllByRole('row').slice(1);
    expect(zeilen.map((z) => z.textContent)).toEqual([
      expect.stringContaining('Gottesdienst im Advent'),
      expect.stringContaining('Konfi-Fahrt'),
      expect.stringContaining('Bonus für Einsatz'),
    ]);
    expect(zeilen[0]).toHaveTextContent('08.12.2024');
    expect(zeilen[1]).toHaveTextContent('25.05.2024');
  });

  it('die Events der Konfi-Zeit nennen Stand und Punkte', async () => {
    await zeigeHistorie();
    const events = karte('Events der Konfi-Zeit');
    expect(events).toHaveTextContent('3 Events');
    const zeilen = within(within(events).getByRole('table', { name: 'Events der Konfi-Zeit' })).getAllByRole('row').slice(1);
    expect(zeilen).toHaveLength(3);
    expect(zeilen[0]).toHaveTextContent('Konfi-Fahrt');
    expect(zeilen[0]).toHaveTextContent('Dabei');
    expect(zeilen[0]).toHaveTextContent('+3');
    expect(zeilen[1]).toHaveTextContent('Elternabend');
    expect(zeilen[1]).toHaveTextContent('Nicht da');
    expect(zeilen[1]).toHaveTextContent('–');
    expect(zeilen[2]).toHaveTextContent('Vorstellungsgottesdienst');
    expect(zeilen[2]).toHaveTextContent('Punkte erhalten');
  });

  it('ohne Kopie der Konfi-Zeit fehlt die Karte, der Rest bleibt', async () => {
    h.konfiZeit = { konfi_zeit: null };
    await zeigeHistorie();
    expect(screen.queryByRole('heading', { name: 'Events der Konfi-Zeit' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Punkte gesamt: 21' })).toBeInTheDocument();
  });

  it('die Badges stehen nach Datum, neueste zuerst; ein Klick zeigt die Einzelheiten im Dialog', async () => {
    await zeigeHistorie();
    const liste = screen.getByRole('list', { name: 'Erreichte Konfi-Badges' });
    expect(within(liste).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Gottesdienst-Held: Einzelheiten ansehen',
      'Event-Champion: Einzelheiten ansehen',
      'Erster Schritt: Einzelheiten ansehen',
    ]);
    expect(karte('Konfi-Badges')).toHaveTextContent('3 Badges erreicht');
    fireEvent.click(within(liste).getByRole('button', { name: 'Event-Champion: Einzelheiten ansehen' }));
    const dialog = screen.getByRole('dialog', { name: 'Event-Champion' });
    expect(within(dialog).getByText('Viele Events besucht.')).toBeInTheDocument();
    expect(within(dialog).getByText('Erreicht')).toBeInTheDocument();
    expect(within(dialog).getByText('15.03.2024')).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('der Rueckblick der Konfi-Zeit steht nur da, wenn es ihn gibt, und oeffnet das Modal der App', async () => {
    await zeigeHistorie();
    const rueckblick = await waitFor(() => karte('Konfi-Rückblick'));
    expect(rueckblick).toHaveTextContent('Konfi-Zeit 2024');
    fireEvent.click(within(rueckblick).getByRole('button', { name: 'Rückblick ansehen' }));
    await waitFor(() => expect(modal('WrappedModal')).toBeDefined());
    expect(modal('WrappedModal')?.props.wrappedType).toBe('konfi');
    expect(modal('WrappedModal')?.props.initialYear).toBe(2024);
  });

  it('ohne Konfi-Rueckblick keine Karte', async () => {
    h.antworten['/wrapped/history/9'] = [RUECKBLICKE[0]];
    await zeigeHistorie();
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByRole('heading', { name: 'Konfi-Rückblick' })).toBeNull();
  });

  it('„Punkte-Uebersicht" oeffnet das Modal mit der Route der Konfi-Historie', async () => {
    await zeigeHistorie();
    fireEvent.click(screen.getByRole('button', { name: 'Punkte-Übersicht' }));
    expect(modal('PointsHistoryModal')?.props.apiEndpoint).toBe('/teamer/konfi-history');
    expect(modal('PointsHistoryModal')?.props.pointConfig).toEqual({ gottesdienst_enabled: true, gemeinde_enabled: true });
    expect(modal('PointsHistoryModal')?.optionen?.presentingElement).toBe(h.seite);
  });

  it('ohne Konfi-Daten sagt die Seite es', async () => {
    h.profil = { konfi_data: null };
    render(<TeamerKonfiStatsPage />);
    expect(await screen.findByText('Keine Konfi-Daten vorhanden')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Punkte-Übersicht' })).toBeNull();
  });

  it('im schmalen Fenster bleibt die Darstellung der App', async () => {
    h.breit = false;
    const { container } = render(<TeamerKonfiStatsPage />);
    await act(async () => { await Promise.resolve(); });
    expect(container.querySelector('.web-seite')).toBeNull();
    expect(screen.queryByRole('table', { name: 'Punkte-Verlauf' })).toBeNull();
    expect(screen.getByText('Jahrgang 2023/24')).toBeInTheDocument();
  });
});
