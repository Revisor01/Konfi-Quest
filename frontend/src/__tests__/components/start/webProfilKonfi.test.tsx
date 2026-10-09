// Profil der Konfis in der Web-Fassung, gerendert (03.10.2026,
// docs/planung/web-alle-bereiche.md, Entscheidung 6): zweispaltig -- links die
// Person und die Einstellungen, rechts Kennzahlen, Aufteilung und Verlauf der
// Punkte, Rueckblicke und Neuerungen. Die Handgriffe sind die der App: dieselben
// Modale mit denselben Eigenschaften, dasselbe Abmelden. Die Bausteine, die auch
// Team und Leitung nutzen (Einladungen, Benachrichtigungen, Verlauf), werden
// hier mit durchgespielt.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import './zeitrahmen';
import React from 'react';
import { render, screen, fireEvent, within, waitFor, act } from '@testing-library/react';
import type { ModalAufruf } from './ionicStart';

const h = vi.hoisted(() => ({
  breit: true,
  laedt: false,
  online: true,
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  push: vi.fn(),
  modale: [] as Array<{ name: string; props: Record<string, unknown>; optionen: Record<string, unknown> | undefined }>,
  alerts: [] as unknown[],
  seite: document.createElement('div'),
  user: { id: 7, type: 'konfi', display_name: 'Mia Beispiel', role_name: 'konfi', email: 'mia@example.org' } as Record<string, unknown>,
  profil: null as unknown,
  refresh: vi.fn(),
  signOut: vi.fn(),
  setSuccess: vi.fn(),
  setError: vi.fn(),
  cacheLeeren: vi.fn(),
  pushErlaubnis: 'granted',
  pushAnfordern: vi.fn(),
  antworten: {} as Record<string, unknown>,
  suche: '',
  linkOeffnen: vi.fn(),
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
vi.mock('../../../components/konfi/modals/PointsHistoryModal', async () => ({ default: (await import('./ionicStart')).modalAttrappe('PointsHistoryModal') }));
vi.mock('../../../components/wrapped/WrappedModal', async () => ({ default: (await import('./ionicStart')).modalAttrappe('WrappedModal') }));
vi.mock('../../../components/shared/BibleTranslationModal', async () => ({
  default: (await import('./ionicStart')).modalAttrappe('BibleTranslationModal'),
  getTranslationName: (code: string) => (code === 'LUT' ? 'Lutherbibel 2017' : code === 'BB' ? 'BasisBibel' : code),
}));
vi.mock('../../../components/konfi/modals/KonfiOnboardingModal', () => ({ default: () => <p>App-Tour läuft</p> }));
vi.mock('../../../components/konfi/modals/KonfiUpdate230WalkthroughModal', () => ({ default: () => <p>Neuerungen laufen</p> }));
vi.mock('../../../components/shared/MitmachenErklaerungModal', () => ({ default: () => <p>Mitmachen wird erklärt</p> }));
vi.mock('../../../components/shared/AppSperreSchalter', () => ({ default: () => null }));
vi.mock('../../../components/shared/AbsturzberichteSchalter', () => ({ default: () => null }));
vi.mock('../../../components/shared/SpiritFooter', () => ({ default: () => null }));
vi.mock('../../../hooks/useMediaCacheControl', () => ({ useMediaCacheControl: () => ({ cacheLabel: '12,4 MB belegt', clearMediaCache: h.cacheLeeren }) }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost, put: vi.fn() } }));
vi.mock('../../../services/writeQueue', () => ({ writeQueue: { enqueue: vi.fn() } }));
vi.mock('../../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true } }));
vi.mock('../../../services/tokenStore', () => ({ setUser: vi.fn() }));
vi.mock('../../../services/systemDialoge', () => ({ linkOeffnen: h.linkOeffnen }));
vi.mock('../../../navigation/useAppLocation', () => ({ useAppLocation: () => ({ pathname: '/konfi/profile', search: h.suche }) }));
vi.mock('../../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: vi.fn() }));
vi.mock('../../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: h.seite }, presentingElement: h.seite }) }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({
    user: h.user,
    setUser: vi.fn(),
    setError: h.setError,
    setSuccess: h.setSuccess,
    signOut: h.signOut,
    isOnline: h.online,
    pushNotificationsPermission: h.pushErlaubnis,
    requestPushPermissions: h.pushAnfordern,
  }),
}));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (schluessel: string) => ({
    data: h.laedt || !schluessel.startsWith('konfi:profile') ? null : h.profil,
    loading: h.laedt,
    refresh: h.refresh,
    refreshLive: vi.fn(),
  }),
}));

import KonfiProfilePage from '../../../components/konfi/pages/KonfiProfilePage';

const PROFIL = {
  id: 7, username: 'mia.beispiel', display_name: 'Mia Beispiel', email: 'mia@example.org',
  jahrgang_name: '2026/27', jahrgang_year: 2026, created_at: '2026-01-12T10:00:00.000Z',
  confirmation_date: '2027-05-09T08:00:00.000Z', confirmation_location: 'St.-Marien-Kirche, Beispielstadt',
  bible_translation: 'LUT', gottesdienst_enabled: true, gemeinde_enabled: true,
  total_points: 19, gottesdienst_points: 8, gemeinde_points: 11, bonus_points: 3,
  badge_count: 5, activity_count: 9, event_count: 6, pending_requests: 2, rank_in_jahrgang: 5, total_in_jahrgang: 24,
  progress_overview: { monthly_points: [], achievements: { total_activities: 9, total_events: 6, total_badges: 5 } },
};

/** Zehn Eintraege, wie der Server sie liefert (nach Verbuchung): das Event steht vorn, obwohl es vor dem Gottesdienst stattfand. */
const VERLAUF = [
  { id: 2, title: 'Konfi-Samstag', points: 2, category: 'gemeinde', date: '2026-10-02T09:00:00Z', event_date: '2026-09-26T08:00:00Z', source_type: 'event' },
  { id: 1, title: 'Gottesdienst am Sonntag', points: 1, category: 'gottesdienst', date: '2026-09-27T10:00:00Z', source_type: 'activity' },
  { id: 3, title: 'Kirchenkaffee helfen', points: 1, category: 'gemeinde', date: '2026-09-20T10:00:00Z', comment: 'Tische gedeckt', source_type: 'activity' },
  { id: 4, title: 'Bonus für Einsatz', points: 3, category: 'gemeinde', date: '2026-09-15T10:00:00Z', source_type: 'bonus' },
  { id: 5, title: 'Gottesdienst im Park', points: 1, category: 'gottesdienst', date: '2026-09-13T10:00:00Z', source_type: 'activity' },
  { id: 6, title: 'Jugendabend', points: 2, category: 'gemeinde', date: '2026-09-10T10:00:00Z', source_type: 'activity' },
  { id: 7, title: 'Gottesdienst im Advent', points: 1, category: 'gottesdienst', date: '2026-09-06T10:00:00Z', source_type: 'activity' },
  { id: 8, title: 'Flohmarkt', points: 2, category: 'gemeinde', date: '2026-09-03T10:00:00Z', source_type: 'activity' },
  { id: 9, title: 'Gottesdienst zur Einführung', points: 1, category: 'gottesdienst', date: '2026-08-30T10:00:00Z', source_type: 'activity' },
  { id: 10, title: 'Erntedank', points: 2, category: 'gemeinde', date: '2026-08-23T10:00:00Z', source_type: 'activity' },
];

const RUECKBLICKE = [
  { id: 41, wrapped_type: 'konfi', year: 2026, data: { jahr: 2026 }, computed_at: '2026-09-30T10:00:00Z', titel: 'Zwischenstand Herbst', ausgabe_id: 2 },
  { id: 40, wrapped_type: 'konfi', year: 2025, data: { jahr: 2025 }, computed_at: '2025-12-14T10:00:00Z', titel: null, ausgabe_id: null },
];

const einladung = (id: number, gemeinde: string, von: string | null = 'Anna Beispiel') => ({
  id, organization_display_name: gemeinde, organization_name: gemeinde.toLowerCase(), role_display_name: 'Teamer:in', role_name: 'teamer',
  eingeladen_von_name: von, expires_at: '2026-10-20T10:00:00Z',
});

const antworten = () => {
  h.apiGet.mockImplementation((url: string) => {
    if (url in h.antworten) {
      const a = h.antworten[url];
      return a instanceof Error ? Promise.reject(a) : Promise.resolve({ data: a });
    }
    return Promise.reject(new Error(`nicht vorgesehen: ${url}`));
  });
};

const zeige = async () => {
  const ergebnis = render(<KonfiProfilePage />);
  await screen.findByRole('heading', { level: 1, name: 'Mein Profil' });
  // Die Zusatzabrufe der Seite (Rueckblicke, Challenges, Benachrichtigungen, Einladungen) abwarten.
  await waitFor(() => expect(h.apiGet).toHaveBeenCalledWith('/notifications/preferences'));
  await act(async () => { await Promise.resolve(); });
  return ergebnis;
};

const karte = (titel: string): HTMLElement => screen.getByRole('heading', { name: titel }).closest('section') as HTMLElement;
const modal = (name: string): ModalAufruf | undefined => h.modale.find((m) => m.name === name);
const knopfInZeile = (titel: string, knopf: string) => screen.getByRole('button', { name: `${titel}: ${knopf}` });

beforeEach(() => {
  vi.clearAllMocks();
  h.apiGet.mockReset();
  h.breit = true;
  h.laedt = false;
  h.online = true;
  h.suche = '';
  h.pushErlaubnis = 'granted';
  h.modale.length = 0;
  h.alerts.length = 0;
  h.profil = PROFIL;
  h.user = { id: 7, type: 'konfi', display_name: 'Mia Beispiel', role_name: 'konfi', email: 'mia@example.org' };
  h.antworten = {
    '/wrapped/history/7': RUECKBLICKE,
    '/challenges/konfi': { active: [], archive: [], marks: [{ id: 1 }, { id: 2 }, { id: 3 }] },
    '/notifications/preferences': { push_enabled: true, stumm: [], gruppen: [] },
    '/einladungen/meine': [],
    '/konfi/points-history': { history: VERLAUF },
  };
  antworten();
});
afterEach(() => { vi.useRealTimers(); });

describe('Profil der Konfis (Web): Kopf und Person', () => {
  it('zeigt erst Platzhalter, dann den Seitenkopf und die Person mit ihren Angaben', async () => {
    h.laedt = true;
    const { unmount } = render(<KonfiProfilePage />);
    expect(screen.getByRole('status')).toHaveTextContent('Das Profil wird geladen.');
    unmount();
    h.laedt = false;
    await zeige();
    expect(screen.getByText('Konto, Punkte und Einstellungen')).toBeInTheDocument();
    const person = screen.getByRole('region', { name: 'Person' });
    expect(within(person).getByRole('heading', { level: 2, name: 'Mia Beispiel' })).toBeInTheDocument();
    expect(person).toHaveTextContent('2026/27');
    expect(within(person).getByText('@mia.beispiel')).toBeInTheDocument();
    expect(within(person).getByText('mia@example.org')).toBeInTheDocument();
    expect(within(person).getByText('12.01.2026')).toBeInTheDocument();
  });

  it('ohne Profil steht eine Fehlermeldung mit „Erneut versuchen"', async () => {
    h.profil = null;
    render(<KonfiProfilePage />);
    expect(await screen.findByText('Das Profil konnte nicht geladen werden.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Erneut versuchen/ }));
    expect(h.refresh).toHaveBeenCalledTimes(1);
  });

  it('die Konfirmation nennt Datum, Uhrzeit und den Ort als Link zur Karte', async () => {
    await zeige();
    const konfirmation = karte('Deine Konfirmation');
    expect(within(konfirmation).getByText('So., 09.05.2027')).toBeInTheDocument();
    expect(within(konfirmation).getByText('10:00 Uhr')).toBeInTheDocument();
    const ort = within(konfirmation).getByRole('link', { name: 'St.-Marien-Kirche, Beispielstadt auf der Karte öffnen' });
    expect(ort).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=St.-Marien-Kirche%2C%20Beispielstadt');
    expect(ort).toHaveAttribute('target', '_blank');
    expect(ort).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('ein einfacher Klick auf den Ort oeffnet die Karte ueber die Huelle der App; Strg-Klick bleibt dem Browser', async () => {
    await zeige();
    const ort = screen.getByRole('link', { name: /auf der Karte öffnen/ });
    expect(fireEvent.click(ort)).toBe(false);
    expect(h.linkOeffnen).toHaveBeenCalledTimes(1);
    expect(h.linkOeffnen).toHaveBeenCalledWith('https://www.google.com/maps/search/?api=1&query=St.-Marien-Kirche%2C%20Beispielstadt');
    expect(fireEvent.click(ort, { ctrlKey: true })).toBe(true);
    expect(h.linkOeffnen).toHaveBeenCalledTimes(1);
  });

  it('ohne Konfirmationsdatum entfaellt die Karte', async () => {
    h.profil = { ...PROFIL, confirmation_date: undefined };
    await zeige();
    expect(screen.queryByRole('heading', { name: 'Deine Konfirmation' })).toBeNull();
  });
});

describe('Profil der Konfis (Web): Punkte', () => {
  it('die Kacheln nennen Punkte, Badges, Challenges, Events und Aktivitaeten', async () => {
    await zeige();
    expect(screen.getByRole('group', { name: 'Punkte gesamt: 19' })).toHaveTextContent('Gottesdienst 8Gemeinde 11');
    expect(screen.getByRole('link', { name: 'Badges: 5' })).toHaveAttribute('href', '/konfi/badges');
    // Die Zahl der Challenges kommt aus den eigenen Stempeln.
    expect(screen.getByRole('link', { name: 'Challenges: 3' })).toHaveAttribute('href', '/konfi/challenges');
    expect(screen.getByRole('link', { name: 'Events: 6' })).toHaveAttribute('href', '/konfi/events');
    const aktivitaeten = screen.getByRole('link', { name: 'Aktivitäten: 9' });
    expect(aktivitaeten).toHaveAttribute('href', '/konfi/events?segment=antraege');
    expect(aktivitaeten).toHaveTextContent('2 Anträge warten');
  });

  it('ein einzelner Antrag und keiner stehen in der Einzahl bzw. als „Keine"', async () => {
    h.profil = { ...PROFIL, pending_requests: 1 };
    const { unmount } = await zeige();
    expect(screen.getByRole('link', { name: 'Aktivitäten: 9' })).toHaveTextContent('1 Antrag wartet');
    unmount();
    h.profil = { ...PROFIL, pending_requests: 0 };
    await zeige();
    expect(screen.getByRole('link', { name: 'Aktivitäten: 9' })).toHaveTextContent('Keine Anträge offen');
  });

  it('der Platz im Jahrgang steht nicht im Profil -- wie in der App, auch wenn der Server ihn schickt', async () => {
    // Die Gemeindeleitung kann das Ranking ausschalten; das Profil kennt diese
    // Einstellung nicht. Den Platz zeigt allein die Rangliste der Startseite.
    expect(PROFIL.rank_in_jahrgang).toBe(5);
    await zeige();
    expect(screen.queryByRole('group', { name: /Platz im Jahrgang/ })).toBeNull();
    expect(screen.queryByText(/Platz \d+ von \d+/)).toBeNull();
  });

  it('die Aufteilung zeigt Gottesdienst und Gemeinde samt Bonus; „Punkte-Uebersicht" oeffnet das Modal der App', async () => {
    await zeige();
    const aufteilung = karte('So setzen sich deine Punkte zusammen');
    expect(within(aufteilung).getByRole('img', { name: 'Gottesdienst 8, Gemeinde 11' })).toBeInTheDocument();
    expect(aufteilung).toHaveTextContent('Darin 3 Punkte Bonus');
    expect(aufteilung).toHaveTextContent('Gottesdienst 8');
    expect(aufteilung).toHaveTextContent('Gemeinde 11');
    fireEvent.click(within(aufteilung).getByRole('button', { name: 'Punkte-Übersicht' }));
    const m = modal('PointsHistoryModal');
    expect(m?.props.pointConfig).toEqual({ gottesdienst_enabled: true, gemeinde_enabled: true });
    expect(m?.props.profileTotals).toEqual({ total_points: 19, gottesdienst_points: 8, gemeinde_points: 11, bonus_points: 3, event_count: 6 });
    expect(m?.optionen?.presentingElement).toBe(h.seite);
  });

  it('eine abgeschaltete Punkteart verschwindet aus Kachel, Aufteilung und Verlauf', async () => {
    h.profil = { ...PROFIL, gottesdienst_enabled: false };
    await zeige();
    expect(screen.getByRole('group', { name: 'Punkte gesamt: 19' })).toHaveTextContent('Gemeinde 11');
    expect(screen.getByRole('group', { name: 'Punkte gesamt: 19' })).not.toHaveTextContent('Gottesdienst');
    expect(screen.getByRole('img', { name: 'Gottesdienst 0, Gemeinde 11' })).toBeInTheDocument();
    const tabelle = await screen.findByRole('table', { name: 'Punkte-Verlauf' });
    expect(within(tabelle).queryByText('Gottesdienst am Sonntag')).toBeNull();
    expect(within(tabelle).getByText('Konfi-Samstag')).toBeInTheDocument();
  });
});

describe('Profil der Konfis (Web): Verlauf', () => {
  it('Tabelle nach angezeigtem Datum, neueste zuerst -- bei Events das Datum des Termins', async () => {
    await zeige();
    const tabelle = await screen.findByRole('table', { name: 'Punkte-Verlauf' });
    const zeilen = within(tabelle).getAllByRole('row').slice(1);
    // Das Konfi-Samstag-Event wurde am 02.10. verbucht, fand aber am 26.09. statt.
    expect(zeilen).toHaveLength(10);
    expect(within(zeilen[0]).getAllByRole('cell')[0]).toHaveTextContent('27.09.2026');
    expect(zeilen[0]).toHaveTextContent('Gottesdienst am Sonntag');
    expect(within(zeilen[1]).getAllByRole('cell')[0]).toHaveTextContent('26.09.2026');
    expect(zeilen[1]).toHaveTextContent('Konfi-Samstag');
    expect(zeilen[1]).toHaveTextContent('Gemeinde');
    expect(zeilen[1]).toHaveTextContent('Event');
    expect(zeilen[1]).toHaveTextContent('+2');
    expect(zeilen[2]).toHaveTextContent('Kirchenkaffee helfen');
    expect(zeilen[2]).toHaveTextContent('Tische gedeckt');
    expect(zeilen[3]).toHaveTextContent('Bonus');
  });

  it('zeigt alle Eintraege auf einmal, ohne Knopf zum Aufklappen (Simon, 09.10.2026)', async () => {
    await zeige();
    const tabelle = await screen.findByRole('table', { name: 'Punkte-Verlauf' });
    expect(within(tabelle).getAllByRole('row')).toHaveLength(11);
    const verlauf = karte('Punkte-Verlauf');
    expect(verlauf).toHaveTextContent('10 Einträge');
    expect(within(tabelle).getByText('Erntedank')).toBeInTheDocument();
    expect(within(verlauf).queryByRole('button', { name: /anzeigen$/ })).toBeNull();
  });

  it('ohne Eintraege sagt die Karte es', async () => {
    h.antworten['/konfi/points-history'] = { history: [] };
    await zeige();
    expect(await screen.findByText('Noch keine Einträge')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Punkte-Verlauf' })).toBeNull();
  });

  it('scheitert der Abruf, steht eine Meldung -- „Erneut versuchen" laedt neu', async () => {
    h.antworten['/konfi/points-history'] = new Error('offline');
    await zeige();
    expect(await screen.findByText('Der Verlauf konnte nicht geladen werden.')).toBeInTheDocument();
    h.antworten['/konfi/points-history'] = { history: VERLAUF };
    fireEvent.click(within(karte('Punkte-Verlauf')).getByRole('button', { name: /Erneut versuchen/ }));
    expect(await screen.findByRole('table', { name: 'Punkte-Verlauf' })).toBeInTheDocument();
  });
});

describe('Profil der Konfis (Web): Einstellungen -- dieselben Handgriffe wie in der App', () => {
  it('nennt den Stand jeder Einstellung unter ihrem Titel', async () => {
    await zeige();
    const liste = screen.getByRole('list', { name: 'Konto-Einstellungen' });
    expect(liste).toHaveTextContent('E-Mail-AdresseAktuell: mia@example.org');
    expect(liste).toHaveTextContent('BibelübersetzungLutherbibel 2017');
    expect(liste).toHaveTextContent('Medien-Cache12,4 MB belegt');
    expect(liste).toHaveTextContent('BenachrichtigungenAlle Mitteilungen aufs Handy');
  });

  it('E-Mail, Passwort und Konto loeschen oeffnen die Modale der App ueber dieser Seite', async () => {
    await zeige();
    fireEvent.click(knopfInZeile('E-Mail-Adresse', 'Ändern'));
    expect(modal('ChangeEmailModal')?.props.variante).toBe('purple');
    expect(modal('ChangeEmailModal')?.optionen?.presentingElement).toBe(h.seite);
    fireEvent.click(knopfInZeile('Passwort', 'Ändern'));
    expect(modal('ChangePasswordModal')?.props.variante).toBe('purple');
    fireEvent.click(screen.getByRole('button', { name: 'Konto löschen' }));
    expect(modal('DeleteAccountModal')?.optionen?.presentingElement).toBe(h.seite);
    expect(h.modale.map((m) => m.name)).toEqual(expect.arrayContaining(['ChangeEmailModal', 'ChangePasswordModal', 'DeleteAccountModal']));
  });

  it('Bibeluebersetzung oeffnet die Auswahl mit der aktuellen Uebersetzung', async () => {
    await zeige();
    fireEvent.click(knopfInZeile('Bibelübersetzung', 'Ändern'));
    expect(modal('BibleTranslationModal')?.props.currentTranslation).toBe('LUT');
    expect(modal('BibleTranslationModal')?.optionen?.presentingElement).toBe(h.seite);
  });

  it('Medien-Cache leert ihn', async () => {
    await zeige();
    fireEvent.click(knopfInZeile('Medien-Cache', 'Leeren'));
    expect(h.cacheLeeren).toHaveBeenCalledTimes(1);
  });

  it('App-Tour und Neuerungen zeigen ihre Overlays', async () => {
    await zeige();
    expect(screen.queryByText('App-Tour läuft')).toBeNull();
    fireEvent.click(knopfInZeile('App-Tour', 'Ansehen'));
    expect(screen.getByText('App-Tour läuft')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Neuerungen öffnen' }));
    expect(screen.getByText('Neuerungen laufen')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mitmachen erklären' }));
    expect(screen.getByText('Mitmachen wird erklärt')).toBeInTheDocument();
  });

  it('Abmelden fragt erst nach; erst die Bestaetigung meldet ab', async () => {
    await zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Abmelden' }));
    expect(h.alerts).toHaveLength(1);
    const alert = h.alerts[0] as { header: string; message: string; buttons: Array<{ text: string; role?: string; handler?: () => unknown }> };
    expect(alert.header).toBe('Abmelden');
    expect(alert.message).toBe('Möchtest du dich wirklich abmelden?');
    expect(h.signOut).not.toHaveBeenCalled();
    await act(async () => { await alert.buttons.find((b) => b.role === 'destructive')?.handler?.(); });
    expect(h.signOut).toHaveBeenCalledTimes(1);
  });
});

describe('Profil der Konfis (Web): Benachrichtigungen', () => {
  it('der Stand nennt, wie viele Gruppen aufs Handy kommen', async () => {
    h.antworten['/notifications/preferences'] = {
      push_enabled: true, stumm: [],
      gruppen: [
        { id: 'chat', name: 'Chat', beschreibung: '', aktiv: true },
        { id: 'events', name: 'Events', beschreibung: '', aktiv: false },
        { id: 'punkte', name: 'Punkte', beschreibung: '', aktiv: true },
      ],
    };
    await zeige();
    expect(await screen.findByText('2 von 3 Gruppen aufs Handy')).toBeInTheDocument();
  });

  it('„Auswaehlen" oeffnet die Auswahl der App in der Farbe der Konfis', async () => {
    await zeige();
    fireEvent.click(knopfInZeile('Benachrichtigungen', 'Auswählen'));
    expect(modal('PushAuswahlModal')?.props.variante).toBe('purple');
    expect(modal('PushAuswahlModal')?.optionen?.presentingElement).toBe(h.seite);
    expect(h.pushAnfordern).not.toHaveBeenCalled();
  });

  it('ohne Erlaubnis fragt der Knopf sie an und nennt es im Stand', async () => {
    h.pushErlaubnis = 'prompt';
    await zeige();
    expect(screen.getByText('Noch nicht erlaubt – antippen zum Erlauben')).toBeInTheDocument();
    fireEvent.click(knopfInZeile('Benachrichtigungen', 'Auswählen'));
    expect(h.pushAnfordern).toHaveBeenCalledTimes(1);
  });
});

describe('Profil der Konfis (Web): Einladungen', () => {
  it('ohne Einladung steht keine Karte da', async () => {
    await zeige();
    expect(screen.queryByRole('heading', { name: /Einladung/ })).toBeNull();
  });

  it('zeigt Gemeinde, Rolle und wer eingeladen hat; die Ueberschrift richtet sich nach der Anzahl', async () => {
    h.antworten['/einladungen/meine'] = [einladung(5, 'St. Petri'), einladung(6, 'St. Marien', null)];
    await zeige();
    const karteEinladungen = await waitFor(() => karte('Einladungen'));
    expect(within(karteEinladungen).getByText('St. Petri')).toBeInTheDocument();
    expect(within(karteEinladungen).getByText('als Teamer:in · von Anna Beispiel')).toBeInTheDocument();
    expect(within(karteEinladungen).getByText('als Teamer:in')).toBeInTheDocument();
  });

  it('Ablehnen meldet es, laedt die Liste neu und die Karte verschwindet', async () => {
    h.antworten['/einladungen/meine'] = [einladung(5, 'St. Petri')];
    h.apiPost.mockResolvedValue({ data: {} });
    await zeige();
    const k = await waitFor(() => karte('Einladung'));
    h.antworten['/einladungen/meine'] = [];
    await act(async () => { fireEvent.click(within(k).getByRole('button', { name: 'Ablehnen' })); });
    expect(h.apiPost).toHaveBeenCalledWith('/einladungen/5/ablehnen');
    expect(h.setSuccess).toHaveBeenCalledWith('Einladung abgelehnt.');
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Einladung' })).toBeNull());
  });

  it('Annehmen meldet die Gemeinde und laedt die App neu', async () => {
    const reload = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, reload } });
    try {
      h.antworten['/einladungen/meine'] = [einladung(5, 'St. Petri')];
      h.apiPost.mockResolvedValue({ data: { organization: { display_name: 'St. Petri' } } });
      await zeige();
      const k = await waitFor(() => karte('Einladung'));
      vi.useFakeTimers({ toFake: ['setTimeout'] });
      await act(async () => { fireEvent.click(within(k).getByRole('button', { name: 'Annehmen' })); });
      expect(h.apiPost).toHaveBeenCalledWith('/einladungen/5/annehmen');
      expect(h.setSuccess).toHaveBeenCalledWith('Du arbeitest jetzt auch in St. Petri. Die App lädt neu.');
      expect(reload).not.toHaveBeenCalled();
      await act(async () => { vi.advanceTimersByTime(1200); });
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original });
    }
  });

  it('offline sind Annehmen und Ablehnen gesperrt', async () => {
    h.online = false;
    h.antworten['/einladungen/meine'] = [einladung(5, 'St. Petri')];
    await zeige();
    const k = await waitFor(() => karte('Einladung'));
    expect(within(k).getByRole('button', { name: 'Annehmen' })).toBeDisabled();
    expect(within(k).getByRole('button', { name: 'Ablehnen' })).toBeDisabled();
  });
});

describe('Profil der Konfis (Web): Rueckblicke', () => {
  it('listet die Ausgaben, auch ohne Titel -- und oeffnet den Rueckblick im Modal der App', async () => {
    await zeige();
    const rueckblicke = await waitFor(() => karte('Meine Rückblicke'));
    expect(rueckblicke).toHaveTextContent('Zwischenstand HerbstErstellt am 30.09.2026');
    expect(rueckblicke).toHaveTextContent('Jahresrückblick 2025Erstellt am 14.12.2025');
    fireEvent.click(knopfInZeile('Zwischenstand Herbst', 'Ansehen'));
    await waitFor(() => expect(modal('WrappedModal')).toBeDefined());
    const m = modal('WrappedModal');
    expect(m?.props.initialYear).toBe(2026);
    expect(m?.props.wrappedType).toBe('konfi');
    expect(m?.props.displayName).toBe('Mia Beispiel');
    expect(m?.optionen).toEqual({ cssClass: 'wrapped-modal-fullscreen' });
  });

  it('ohne Rueckblick entfaellt die Karte', async () => {
    h.antworten['/wrapped/history/7'] = [];
    await zeige();
    expect(screen.queryByRole('heading', { name: 'Meine Rückblicke' })).toBeNull();
  });

  it('der Link ?punkte=1 aus Push und Postfach oeffnet auch hier die Punkte-Uebersicht', async () => {
    h.suche = '?punkte=1';
    await zeige();
    expect(modal('PointsHistoryModal')).toBeDefined();
  });
});

describe('Profil der Konfis: schmales Fenster', () => {
  it('bleibt die Darstellung der App, ohne Web-Seite', async () => {
    h.breit = false;
    const { container } = render(<KonfiProfilePage />);
    await act(async () => { await Promise.resolve(); });
    expect(container.querySelector('.web-seite')).toBeNull();
    expect(container.querySelector('.web-start')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Person' })).toBeNull();
    expect(screen.getByText('Mia Beispiel')).toBeInTheDocument();
  });
});
