// Startseite der Konfis in der Web-Fassung, gerendert (03.10.2026,
// docs/planung/web-alle-bereiche.md, Entscheidung 6): im breiten Browserfenster
// ein Raster aus Karten -- Punkte mit Ringen, Zielen und Level, darunter
// Konfirmation, Challenges, Konfispruch, Events, Losung, Badges und Rangliste in
// der Reihenfolge, die die Leitung eingestellt hat. Im schmalen Fenster bleibt
// die Darstellung der App.
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import type { ModalAufruf } from './ionicStart';

const h = vi.hoisted(() => ({
  breit: true,
  apiGet: vi.fn(),
  push: vi.fn(),
  modale: [] as Array<{ name: string; props: Record<string, unknown>; optionen: Record<string, unknown> | undefined }>,
  alerts: [] as unknown[],
  neuerungen: { update: vi.fn(), mitmachen: vi.fn() },
  user: { id: 7, type: 'konfi', display_name: 'Mia Beispiel', role_name: 'konfi' } as Record<string, unknown>,
}));

vi.mock('@ionic/react', async () => (await import('./ionicStart')).ionicStart(h as never));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('../support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../components/shared/StoreUpdateBanner', () => ({ default: () => null }));
vi.mock('../../../components/shared/TrialBanner', () => ({ default: () => null }));
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: ({ message }: { message: string }) => <p>{message}</p> }));
vi.mock('../../../components/shared/NeuerungenBanner', () => ({
  default: ({ onUpdateOeffnen, onMitmachenOeffnen }: { onUpdateOeffnen: () => void; onMitmachenOeffnen: () => void }) => (
    <div>
      <button type="button" onClick={onUpdateOeffnen}>Neuerungen öffnen</button>
      <button type="button" onClick={onMitmachenOeffnen}>Mitmachen erklären</button>
    </div>
  ),
}));
vi.mock('../../../components/wrapped/WrappedModal', async () => ({ default: (await import('./ionicStart')).modalAttrappe('WrappedModal') }));
vi.mock('../../../components/konfi/modals/PointsHistoryModal', async () => ({ default: (await import('./ionicStart')).modalAttrappe('PointsHistoryModal') }));
vi.mock('../../../components/konfi/modals/KonfispruchSelectModal', async () => ({ default: (await import('./ionicStart')).modalAttrappe('KonfispruchSelectModal') }));
vi.mock('../../../components/konfi/modals/KonfiOnboardingModal', () => ({ default: () => null }));
vi.mock('../../../components/konfi/modals/KonfiUpdate230WalkthroughModal', () => ({ default: () => null }));
vi.mock('../../../components/shared/MitmachenErklaerungModal', () => ({ default: () => null }));
vi.mock('../../../components/shared/BibleTranslationModal', async () => ({
  default: (await import('./ionicStart')).modalAttrappe('BibleTranslationModal'),
  getTranslationName: (code: string) => (code === 'LUT' ? 'Lutherbibel 2017' : code),
}));
vi.mock('../../../hooks/useOnboardingOnce', () => ({
  useOnboardingWithUpdateOnce: () => ({
    showOnboarding: false, closeOnboarding: vi.fn(),
    showNeuerungen: false, schliesseNeuerungen: vi.fn(),
    showUpdateHinweis: false, markUpdateHinweisGesehen: vi.fn(),
    showMitmachenHinweis: false, markMitmachenHinweisGesehen: vi.fn(),
  }),
}));
vi.mock('../../../services/offlineCache', () => ({
  CACHE_TTL: { DASHBOARD: 1000, BADGES: 1000, TAGESLOSUNG: 1000, PROFILE: 1000, EVENTS: 1000 },
  offlineCache: { get: vi.fn(async () => null), set: vi.fn(async () => undefined), isStale: () => false },
}));
vi.mock('../../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true, subscribe: () => () => undefined } }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet } }));
vi.mock('../../../services/analytics', () => ({ track: vi.fn() }));
vi.mock('../../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: vi.fn() }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: vi.fn(), setSuccess: vi.fn() }),
}));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));

import KonfiDashboardPage from '../../../components/konfi/pages/KonfiDashboardPage';

const JETZT = new Date('2026-10-03T08:30:00Z');
const inTagen = (n: number, stunde: number) => {
  const d = new Date(JETZT.getTime() + n * 86_400_000);
  d.setUTCHours(stunde - 2, 0, 0, 0);
  return d.toISOString();
};

const LEVELS = [
  { id: 1, name: 'Starter', title: 'Starter', icon: 'footsteps', color: '#8b5cf6', points_required: 0 },
  { id: 2, name: 'Entdecker', title: 'Entdecker', icon: 'compass', color: '#7c3aed', points_required: 10 },
  { id: 3, name: 'Mitmacher', title: 'Mitmacher', icon: 'people', color: '#6d28d9', points_required: 20 },
  { id: 4, name: 'Profi', title: 'Profi', icon: 'star', color: '#5b21b6', points_required: 30 },
];

const badge = (id: number, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, description: `${name} beschrieben`, icon: 'trophy', criteria_type: 'total_points', criteria_value: 5 * id,
  criteria_extra: null, is_hidden: false, is_active: true, sort_order: id, color: '#c0c0c0', earned: false, earned_at: null, seen: true, ...extra,
});

const BADGES = {
  earned: [
    badge(1, 'Erster Schritt', { earned: true, earned_at: '2026-06-05T10:00:00Z' }),
    badge(2, 'Punkte-Sammler', { earned: true, earned_at: '2026-09-19T10:00:00Z' }),
    badge(3, 'Nachtwanderer', { earned: true, earned_at: '2026-07-15T10:00:00Z', is_hidden: true }),
  ],
  available: [badge(4, 'Punkte-Meister', { criteria_value: 30 })],
  stats: { totalVisible: 3, totalSecret: 2 },
};

const DASHBOARD = {
  konfi: { id: 7, display_name: 'Mia Beispiel', jahrgang_name: '2026/27', gottesdienst_points: 8, gemeinde_points: 11, confirmation_location: 'St.-Marien-Kirche' },
  point_config: { gottesdienst_enabled: true, gemeinde_enabled: true, target_gottesdienst: 10, target_gemeinde: 12 },
  dashboard_config: {
    show_konfirmation: true, show_events: true, show_losung: true, show_badges: true, show_ranking: true, show_challenges: true,
    section_order: ['konfirmation', 'challenges', 'konfispruch', 'events', 'losung', 'badges', 'ranking'],
  },
  recent_badges: [{ id: 2, name: 'Punkte-Sammler', icon: 'trophy', color: '#c0c0c0', criteria_type: 'total_points', criteria_value: 10 }],
  badge_count: 3, recent_events: [], event_count: 6,
  ranking: [
    { id: 21, display_name: 'Lena Muster', points: 31, initials: 'LM' },
    { id: 22, display_name: 'Ben Vorlage', points: 27, initials: 'BV' },
    { id: 23, display_name: 'Nele Probe', points: 24, initials: 'NP' },
  ],
  total_points: 19, rank_in_jahrgang: 5, total_in_jahrgang: 24,
  days_to_confirmation: 218, confirmation_date: inTagen(218, 10),
  has_wrapped: true, wrapped_ausgabe_id: 2, wrapped_titel: 'Zwischenstand Herbst',
  konfspruch_visible: true,
  level_info: { current_level: LEVELS[2], next_level: LEVELS[3], progress_percentage: 90, points_to_next_level: 1, level_index: 3, total_levels: 4, all_levels: LEVELS },
};

const EVENTS = [
  { id: 31, name: 'Konfi-Samstag', title: 'Konfi-Samstag', event_date: inTagen(2, 10), type: 'event', points: 2, max_participants: 30, registered_count: 12, is_registered: true, booking_status: 'confirmed', location: 'Gemeindehaus', bring_items: 'Stifte' },
  { id: 33, name: 'Jugendgottesdienst', title: 'Jugendgottesdienst', event_date: inTagen(13, 17), type: 'event', points: 1, max_participants: 30, registered_count: 12, is_registered: false, booking_status: 'waitlist', waitlist_position: 2, location: 'Kirche' },
  { id: 34, name: 'Wochenendfahrt', title: 'Wochenendfahrt', event_date: inTagen(24, 9), type: 'event', points: 3, max_participants: 30, registered_count: 12, is_registered: true, booking_status: 'confirmed', cancelled: true, cancelled_reason: 'Wasserschaden im Haus' },
  { id: 35, name: 'Konfirmation', title: 'Konfirmation', event_date: inTagen(218, 10), type: 'event', points: 0, max_participants: 30, registered_count: 12, is_registered: true, booking_status: 'confirmed', is_konfirmation: true },
];

const CHALLENGES = {
  active: [
    { id: 3, title: 'Eine gute Tat pro Tag', ends_at: new Date(JETZT.getTime() + 5 * 86_400_000).toISOString(), has_submission: true, challenge_type: 'praxis' },
    { id: 5, title: 'Stille-Minute-Woche', ends_at: new Date(JETZT.getTime() + 3 * 3_600_000 + 60_000).toISOString(), has_submission: false, challenge_type: 'wahrnehmung' },
  ],
  archive: [], marks: [],
};

const PROFIL = { konfspruch: { source: 'liste', id: 12, reference: 'Josua 1,9', text: 'Sei getrost und unverzagt!', translation: 'LUT' } };
const LOSUNG = {
  success: true, translation: 'LUT',
  data: { losung: { text: 'Der Herr ist mein Hirte.', reference: 'Psalm 23,1' }, lehrtext: { text: 'Ich bin der gute Hirte.', reference: 'Johannes 10,11' } },
};

let dashboard = DASHBOARD;
const antworten = () => {
  h.apiGet.mockImplementation((url: string) => {
    if (url === '/konfi/dashboard') return Promise.resolve({ data: dashboard });
    if (url === '/konfi/profile') return Promise.resolve({ data: PROFIL });
    if (url === '/konfi/events') return Promise.resolve({ data: EVENTS });
    if (url === '/konfi/badges/v2') return Promise.resolve({ data: BADGES });
    if (url === '/konfi/tageslosung') return Promise.resolve({ data: LOSUNG });
    if (url === '/challenges/konfi') return Promise.resolve({ data: CHALLENGES });
    return Promise.resolve({ data: {} });
  });
};

const karte = (titel: string): HTMLElement => screen.getByRole('heading', { name: titel }).closest('section') as HTMLElement;
/** Die Ueberschriften der Karten, ohne den Hinweis auf den Rueckblick darueber. */
const ueberschriften = (): string[] => screen.getAllByRole('heading', { level: 2 })
  .filter((e) => !e.closest('.web-rueckblick'))
  .map((e) => e.textContent ?? '');

let vorherRandom: () => number;
beforeAll(() => { vorherRandom = Math.random; });
afterAll(() => { Math.random = vorherRandom; });

beforeEach(() => {
  vi.clearAllMocks();
  h.apiGet.mockReset();
  h.breit = true;
  h.modale.length = 0;
  h.alerts.length = 0;
  dashboard = DASHBOARD;
  localStorage.clear();
  // Die Losung des Tages: Math.random() > 0.5 waehlt die Losung statt des Lehrtextes.
  Math.random = () => 0.9;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(JETZT);
  antworten();
});
afterEach(() => { vi.useRealTimers(); });

const BEGRUESSUNG = { level: 1, name: /^Guten (Morgen|Tag|Abend), Mia!$/ } as const;

const zeige = async () => {
  render(<KonfiDashboardPage />);
  return screen.findByRole('heading', BEGRUESSUNG);
};

describe('Konfi-Start (Web): Kopf und Punkte', () => {
  it('zeigt erst Platzhalter, dann Begruessung mit Vornamen und den Jahrgang', async () => {
    render(<KonfiDashboardPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Deine Startseite wird geladen.');
    const titel = await screen.findByRole('heading', BEGRUESSUNG);
    expect(titel).toHaveTextContent('Guten Morgen, Mia!');
    expect(titel.closest('header')).toHaveTextContent('2026/27');
  });

  it('Punkte: Ringe mit allen drei Werten, je Art Fortschritt gegen das Ziel', async () => {
    await zeige();
    const punkte = karte('Deine Punkte');
    expect(within(punkte).getByText('Platz 5 von 24 im Jahrgang')).toBeInTheDocument();
    expect(within(punkte).getByRole('img', { name: 'Gesamt 19 Punkte von 22, Gottesdienst 8 von 10, Gemeinde 11 von 12' })).toBeInTheDocument();

    const gd = within(punkte).getByRole('progressbar', { name: 'Gottesdienst-Punkte' });
    expect(gd).toHaveAttribute('aria-valuenow', '80');
    expect(gd).toHaveAttribute('aria-valuetext', '8 von 10');
    expect(within(punkte).getByRole('progressbar', { name: 'Gemeinde-Punkte' })).toHaveAttribute('aria-valuenow', '92');
    expect(within(punkte).getByRole('progressbar', { name: 'Gesamt-Punkte' })).toHaveAttribute('aria-valuenow', '86');
    expect(within(punkte).getByText('Noch 2 Punkte bis zum Ziel')).toBeInTheDocument();
    expect(within(punkte).getByText('Noch 1 Punkt bis zum Ziel')).toBeInTheDocument();
  });

  it('ein erreichtes Ziel sagt „Ziel erreicht", ein uebertroffenes nennt die Punkte darueber', async () => {
    dashboard = { ...DASHBOARD, konfi: { ...DASHBOARD.konfi, gottesdienst_points: 10, gemeinde_points: 15 } };
    await zeige();
    const punkte = karte('Deine Punkte');
    expect(within(punkte).getByText('Ziel erreicht')).toBeInTheDocument();
    expect(within(punkte).getByText('125 % – Ziel erreicht, 3 Punkte darüber')).toBeInTheDocument();
  });

  it('Level: Titel, alle Stufen, naechstes Level mit den fehlenden Punkten', async () => {
    await zeige();
    const punkte = karte('Deine Punkte');
    expect(within(punkte).getByText('Mitmacher', { selector: 'strong' })).toBeInTheDocument();
    const stufen = within(punkte).getByRole('list', { name: 'Alle Level' });
    expect(within(stufen).getAllByRole('listitem')).toHaveLength(4);
    expect(within(stufen).getByText(/Entdecker, 10 Punkte erforderlich, erreicht/)).toBeInTheDocument();
    expect(within(stufen).getByText(/Profi, 30 Punkte erforderlich, noch nicht erreicht/)).toBeInTheDocument();
    expect(within(punkte).getByText('noch 1 Punkt')).toBeInTheDocument();
    expect(within(punkte).getByRole('progressbar', { name: 'Fortschritt zum Level Profi' })).toHaveAttribute('aria-valuenow', '90');
  });

  it('ist eine Punkteart abgeschaltet, zeigt nur die andere ihren Ring und Balken', async () => {
    dashboard = { ...DASHBOARD, point_config: { ...DASHBOARD.point_config, gemeinde_enabled: false } };
    await zeige();
    const punkte = karte('Deine Punkte');
    expect(within(punkte).getByRole('img', { name: 'Gottesdienst 8 von 10' })).toBeInTheDocument();
    expect(within(punkte).queryByRole('progressbar', { name: 'Gemeinde-Punkte' })).toBeNull();
    expect(within(punkte).queryByRole('progressbar', { name: 'Gesamt-Punkte' })).toBeNull();
  });

  it('der Knopf „Punkte-Übersicht" oeffnet dasselbe Modal wie die App, mit der Punkte-Konfiguration', async () => {
    await zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Punkte-Übersicht' }));
    expect(h.modale).toHaveLength(1);
    const aufruf = h.modale[0] as ModalAufruf;
    expect(aufruf.name).toBe('PointsHistoryModal');
    expect(aufruf.props.pointConfig).toEqual(DASHBOARD.point_config);
  });
});

describe('Konfi-Start (Web): Karten', () => {
  it('zeigt die Karten in der Reihenfolge der Leitung', async () => {
    await zeige();
    // Challenges, Konfispruch und Losung kommen aus eigenen Abrufen und erscheinen erst danach.
    await waitFor(() => expect(ueberschriften()).toEqual([
      'Deine Punkte', 'Deine Konfirmation', 'Laufende Challenges', 'Dein Konfispruch', 'Deine Events', 'Tageslosung', 'Deine Badges', 'Deine Rangliste',
    ]));
  });

  it('eine andere Reihenfolge und ausgeschaltete Bausteine gelten genauso', async () => {
    dashboard = {
      ...DASHBOARD,
      dashboard_config: {
        ...DASHBOARD.dashboard_config,
        show_events: false,
        show_ranking: false,
        section_order: ['ranking', 'badges', 'events', 'challenges', 'losung', 'konfirmation', 'konfispruch'],
      },
      konfspruch_visible: false,
    };
    await zeige();
    // Rangliste, Events und Konfispruch sind aus -- der Rest steht in der eingestellten Reihenfolge.
    await waitFor(() => expect(ueberschriften()).toEqual(['Deine Punkte', 'Deine Badges', 'Laufende Challenges', 'Tageslosung', 'Deine Konfirmation']));
  });

  it('Konfirmation: die Tage des Servers, das Datum und der Ort', async () => {
    await zeige();
    const k = karte('Deine Konfirmation');
    expect(within(k).getByText('Noch genau 218 Tage bis zu deiner Konfirmation')).toBeInTheDocument();
    expect(within(k).getByText('St.-Marien-Kirche')).toBeInTheDocument();
    expect(within(k).getByText('Tage')).toBeInTheDocument();
  });

  it('Events: Links ins Detail, Datum, Ort, Mitbringen, Warteliste und Absage mit Grund -- die Konfirmation steht nicht darunter', async () => {
    await zeige();
    const k = karte('Deine Events');
    const liste = within(k).getByRole('list', { name: 'Deine Events' });
    const zeilen = within(liste).getAllByRole('listitem');
    expect(zeilen).toHaveLength(3);

    const erste = within(zeilen[0]);
    expect(erste.getByRole('link', { name: 'Konfi-Samstag' })).toHaveAttribute('href', '/konfi/events/31');
    expect(erste.getByText('Mo., 05.10.2026')).toBeInTheDocument();
    expect(erste.getByText('10:00 Uhr')).toBeInTheDocument();
    expect(erste.getByText('Gemeindehaus')).toBeInTheDocument();
    expect(erste.getByText('Mitbringen: Stifte')).toBeInTheDocument();
    expect(erste.getByText('in 2 Tagen')).toBeInTheDocument();

    expect(within(zeilen[1]).getByRole('link', { name: 'Jugendgottesdienst' })).toHaveAttribute('href', '/konfi/events/33');
    expect(within(zeilen[1]).getByText('Warteliste #2')).toBeInTheDocument();

    expect(within(zeilen[2]).getByRole('link', { name: 'Wochenendfahrt' })).toHaveAttribute('href', '/konfi/events/34');
    expect(within(zeilen[2]).getByText('Abgesagt')).toBeInTheDocument();
    expect(within(zeilen[2]).getByText('Grund: Wasserschaden im Haus')).toBeInTheDocument();

    expect(within(k).queryByText('Konfirmation')).toBeNull();
    expect(within(k).getByRole('link', { name: 'Alle Events →' })).toHaveAttribute('href', '/konfi/events');
  });

  it('ohne Event steht eine Einladung da, eins zu buchen', async () => {
    h.apiGet.mockImplementation((url: string) => {
      if (url === '/konfi/events') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: url === '/konfi/dashboard' ? dashboard : url === '/konfi/badges/v2' ? BADGES : url === '/challenges/konfi' ? CHALLENGES : url === '/konfi/tageslosung' ? LOSUNG : PROFIL });
    });
    await zeige();
    const k = karte('Deine Events');
    expect(within(k).getByText('Buche dein nächstes Event')).toBeInTheDocument();
    expect(within(k).getByRole('link', { name: 'Events ansehen' })).toHaveAttribute('href', '/konfi/events');
  });

  it('Challenges: nach Ende geordnet, mit Restzeit, Beitrags-Marke und Link', async () => {
    await zeige();
    await screen.findByRole('heading', { name: 'Laufende Challenges' });
    const k = karte('Laufende Challenges');
    const zeilen = within(within(k).getByRole('list', { name: 'Laufende Challenges' })).getAllByRole('listitem');
    expect(zeilen).toHaveLength(2);
    expect(within(zeilen[0]).getByRole('link', { name: 'Stille-Minute-Woche' })).toHaveAttribute('href', '/konfi/challenges/5');
    expect(within(zeilen[0]).getByText('noch 3 Stunden')).toBeInTheDocument();
    expect(within(zeilen[1]).getByRole('link', { name: 'Eine gute Tat pro Tag' })).toHaveAttribute('href', '/konfi/challenges/3');
    expect(within(zeilen[1]).getByText('noch 5 Tage')).toBeInTheDocument();
    expect(within(zeilen[1]).getByText('Beitrag eingereicht')).toBeInTheDocument();
    expect(within(zeilen[0]).queryByText('Beitrag eingereicht')).toBeNull();
  });

  it('ohne laufende Challenge entfaellt die Karte ganz', async () => {
    h.apiGet.mockImplementation((url: string) => {
      if (url === '/challenges/konfi') return Promise.resolve({ data: { active: [], archive: [], marks: [] } });
      return Promise.resolve({ data: url === '/konfi/dashboard' ? dashboard : url === '/konfi/events' ? EVENTS : url === '/konfi/badges/v2' ? BADGES : url === '/konfi/tageslosung' ? LOSUNG : PROFIL });
    });
    await zeige();
    await screen.findByRole('heading', { name: 'Deine Events' });
    expect(screen.queryByRole('heading', { name: 'Laufende Challenges' })).toBeNull();
  });

  it('Konfispruch: Text und Stelle; „ändern" oeffnet die Auswahl mit dem aktuellen Spruch', async () => {
    await zeige();
    const k = await waitFor(() => {
      const karteSpruch = karte('Dein Konfispruch');
      expect(within(karteSpruch).getByText(/Sei getrost und unverzagt!/)).toBeInTheDocument();
      return karteSpruch;
    });
    expect(within(k).getByText('Josua 1,9')).toBeInTheDocument();
    fireEvent.click(within(k).getByRole('button', { name: 'Konfispruch ändern' }));
    expect(h.modale.map((m) => m.name)).toEqual(['KonfispruchSelectModal']);
    expect(h.modale[0].props.current).toEqual(PROFIL.konfspruch);
  });

  it('ohne gewaehlten Spruch laedt die Karte zum Waehlen ein; ist er fuer den Jahrgang nicht freigegeben, fehlt sie', async () => {
    h.apiGet.mockImplementation((url: string) => (
      Promise.resolve({ data: url === '/konfi/profile' ? { konfspruch: null } : url === '/konfi/dashboard' ? dashboard : url === '/konfi/events' ? EVENTS : url === '/konfi/badges/v2' ? BADGES : url === '/konfi/tageslosung' ? LOSUNG : CHALLENGES })
    ));
    const { unmount } = render(<KonfiDashboardPage />);
    const k = await waitFor(() => karte('Dein Konfispruch'));
    expect(within(k).getByText(/Du hast noch keinen Konfispruch gewählt/)).toBeInTheDocument();
    expect(within(k).getByRole('button', { name: 'Konfispruch wählen' })).toBeInTheDocument();
    unmount();

    dashboard = { ...DASHBOARD, konfspruch_visible: false } as typeof DASHBOARD;
    antworten();
    await zeige();
    await screen.findByRole('heading', { name: 'Deine Events' });
    expect(screen.queryByRole('heading', { name: 'Dein Konfispruch' })).toBeNull();
  });

  it('Tageslosung: der Vers, die Uebersetzung; „Übersetzung ändern" oeffnet die Auswahl', async () => {
    await zeige();
    const k = await waitFor(() => karte('Tageslosung'));
    expect(within(k).getByText(/Der Herr ist mein Hirte\./)).toBeInTheDocument();
    expect(within(k).getByText('Psalm 23,1')).toBeInTheDocument();
    expect(within(k).getByText('Lutherbibel 2017')).toBeInTheDocument();
    fireEvent.click(within(k).getByRole('button', { name: 'Übersetzung ändern' }));
    expect(h.modale.map((m) => m.name)).toEqual(['BibleTranslationModal']);
    expect(h.modale[0].props.currentTranslation).toBe('LUT');
  });

  it('Badges: Zahlen, geheime Badges, neue Markierung -- ein Klick oeffnet den Dialog, Escape schliesst ihn', async () => {
    await zeige();
    const k = await waitFor(() => karte('Deine Badges'));
    expect(within(k).getByText('von 3 erreicht', { exact: false })).toBeInTheDocument();
    expect(within(k).getByText('Geheim: 1 von 2 – noch 1 zu entdecken')).toBeInTheDocument();
    expect(within(k).getByText('1 neues')).toBeInTheDocument();
    expect(within(k).getByRole('link', { name: 'Alle Badges →' })).toHaveAttribute('href', '/konfi/badges');

    // Das neueste zuerst: Punkte-Sammler (19.09.), Nachtwanderer (15.07.), Erster Schritt (05.06.).
    const knoepfe = within(within(k).getByRole('list', { name: 'Zuletzt erhaltene Badges' })).getAllByRole('button');
    expect(knoepfe.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Punkte-Sammler (neu): Einzelheiten ansehen',
      'Nachtwanderer: Einzelheiten ansehen',
      'Erster Schritt: Einzelheiten ansehen',
    ]);

    fireEvent.click(knoepfe[0]);
    const dialog = screen.getByRole('dialog', { name: 'Punkte-Sammler' });
    expect(within(dialog).getByText('Punkte-Sammler beschrieben')).toBeInTheDocument();
    expect(within(dialog).getByText('Erreicht')).toBeInTheDocument();
    expect(within(dialog).getByText('19.09.2026')).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Rangliste: Platz 1, Trenner, Vorgaenger, man selbst mit Punkten und Nachfolger ohne Punkte', async () => {
    await zeige();
    const k = await waitFor(() => karte('Deine Rangliste'));
    const liste = within(k).getByRole('list', { name: 'Rangliste im Jahrgang 2026/27' });
    const zeilen = within(liste).getAllByRole('listitem');
    expect(zeilen.map((z) => z.textContent)).toEqual([
      '1LMLena Muster31 Punkte',
      '4Konfi vor dirPlatz 4',
      '5MBMia BeispielDu19 Punkte',
      '6Konfi nach dirPlatz 6',
    ]);
    expect(within(k).getByText('von 24')).toBeInTheDocument();
  });
});

describe('Konfi-Start (Web): Hinweise', () => {
  it('der Rueckblick oeffnet das Modal; „ausblenden" merkt sich die Ausgabe und blendet die Karte aus', async () => {
    await zeige();
    const hinweis = screen.getByRole('region', { name: 'Rückblick' });
    expect(within(hinweis).getByRole('heading', { name: 'Zwischenstand Herbst' })).toBeInTheDocument();
    expect(within(hinweis).getByText('Dein Rückblick - bis jetzt!')).toBeInTheDocument();

    fireEvent.click(within(hinweis).getByRole('button', { name: 'Rückblick ansehen' }));
    expect(h.modale.map((m) => m.name)).toEqual(['WrappedModal']);
    expect(h.modale[0].optionen).toEqual({ cssClass: 'wrapped-modal-fullscreen' });
    expect(h.modale[0].props).toMatchObject({ displayName: 'Mia Beispiel', jahrgangName: '2026/27', wrappedType: 'konfi' });

    fireEvent.click(within(hinweis).getByRole('button', { name: 'Hinweis ausblenden' }));
    expect(screen.queryByRole('region', { name: 'Rückblick' })).toBeNull();
    await waitFor(() => expect(localStorage.getItem('CapacitorStorage.wrapped_hinweis_7_2')).toBe('1'));
  });

  it('ohne Rueckblick der Leitung steht keine Karte da', async () => {
    dashboard = { ...DASHBOARD, has_wrapped: false } as typeof DASHBOARD;
    await zeige();
    expect(screen.queryByRole('region', { name: 'Rückblick' })).toBeNull();
  });
});

describe('Konfi-Start: Zustaende und die App', () => {
  it('Fehler: Hinweis mit erneutem Versuch, der wirklich neu laedt', async () => {
    h.apiGet.mockRejectedValue(new Error('Netz weg'));
    render(<KonfiDashboardPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Deine Startseite konnte nicht geladen werden.');
    antworten();
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByRole('heading', BEGRUESSUNG)).toHaveTextContent('Guten Morgen, Mia!');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('im schmalen Fenster bleibt die Darstellung der App (Farbverlauf-Kopf, keine Web-Seite)', async () => {
    h.breit = false;
    const { container } = render(<KonfiDashboardPage />);
    await waitFor(() => expect(container.querySelector('.app-dashboard-header')).not.toBeNull());
    expect(container.querySelector('.web-seite')).toBeNull();
    expect(container.querySelector('.web-karte')).toBeNull();
    expect(container.textContent).toContain('Guten Morgen, Mia!');
  });
});
