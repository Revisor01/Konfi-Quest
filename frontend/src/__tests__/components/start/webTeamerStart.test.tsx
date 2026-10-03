// Startseite des Teams in der Web-Fassung, gerendert (03.10.2026,
// docs/planung/web-alle-bereiche.md, Entscheidung 6): oben Kennzahlen, darunter
// die Karten, die die Leitung einschaltet -- Zertifikate, Challenges,
// Konfispruch, Events, Badges, Losung -- in deren Reihenfolge. Im schmalen
// Fenster bleibt die Darstellung der App.
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import './zeitrahmen';
import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  breit: true,
  apiGet: vi.fn(),
  push: vi.fn(),
  modale: [] as Array<{ name: string; props: Record<string, unknown>; optionen: Record<string, unknown> | undefined }>,
  alerts: [] as unknown[],
  user: { id: 11, type: 'teamer', display_name: 'Jonas Probe', role_name: 'teamer' } as Record<string, unknown>,
}));

vi.mock('@ionic/react', async () => (await import('./ionicStart')).ionicStart(h as never));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('../support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../components/shared/StoreUpdateBanner', () => ({ default: () => null }));
vi.mock('../../../components/shared/TrialBanner', () => ({ default: () => null }));
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: ({ message }: { message: string }) => <p>{message}</p> }));
vi.mock('../../../components/shared/NeuerungenBanner', () => ({ default: () => null }));
vi.mock('../../../components/wrapped/WrappedModal', async () => ({ default: (await import('./ionicStart')).modalAttrappe('WrappedModal') }));
vi.mock('../../../components/konfi/modals/KonfispruchSelectModal', async () => ({ default: (await import('./ionicStart')).modalAttrappe('KonfispruchSelectModal') }));
vi.mock('../../../components/teamer/modals/TeamerOnboardingModal', () => ({ default: () => null }));
vi.mock('../../../components/teamer/modals/TeamerUpdate230WalkthroughModal', () => ({ default: () => null }));
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
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, put: vi.fn() } }));
vi.mock('../../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: vi.fn() }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: vi.fn(), setSuccess: vi.fn() }),
}));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));

import TeamerDashboardPage from '../../../components/teamer/pages/TeamerDashboardPage';

const JETZT = new Date('2026-10-03T08:30:00Z');
const tageHer = (n: number) => new Date(JETZT.getTime() - n * 86_400_000).toISOString();
const inTagen = (n: number, stunde: number) => {
  const d = new Date(JETZT.getTime() + n * 86_400_000);
  d.setUTCHours(stunde - 2, 0, 0, 0);
  return d.toISOString();
};

const event = (id: number, titel: string, tage: number, stunde: number, extra: Record<string, unknown> = {}) => ({
  id, name: titel, title: titel, event_date: inTagen(tage, stunde), type: 'event', points: 1, max_participants: 30, registered_count: 8,
  booking_status: 'confirmed', location: 'Gemeindehaus', ...extra,
});

const DASHBOARD = {
  greeting: { display_name: 'Jonas Probe', hour: 10, role_title: 'Jugendmitarbeiter' },
  certificates: [
    { id: 1, name: 'Juleica', icon: 'ribbon', issued_date: tageHer(400), expiry_date: inTagen(700, 12), status: 'valid' },
    { id: 2, name: 'Erste-Hilfe-Kurs', icon: 'medkit', issued_date: tageHer(900), expiry_date: tageHer(10), status: 'expired' },
    { id: 3, name: 'Präventionsschulung', icon: 'shield', issued_date: tageHer(200), expiry_date: null, status: 'valid' },
    { id: 4, name: 'Andachtsleitung', icon: 'book', issued_date: null, expiry_date: null, status: 'not_earned' },
  ],
  events: [
    event(31, 'Konfi-Samstag', 2, 10, { bring_items: 'Laptop' }),
    event(36, 'Teamer-Abend', 4, 19, { booking_status: 'waitlist' }),
    event(33, 'Jugendgottesdienst', 13, 17),
  ],
  badges: { recent: [], earned_count: 4, total_count: 12 },
  config: {
    show_zertifikate: true, show_challenges: true, show_konfispruch: true, show_events: true, show_badges: true, show_losung: true,
    section_order: ['zertifikate', 'challenges', 'konfispruch', 'events', 'badges', 'losung'],
  },
  has_wrapped: true, wrapped_ausgabe_id: 3, wrapped_titel: null,
  konfspruch: { source: 'freitext', reference: 'Römer 12,12', text: 'Seid fröhlich in Hoffnung.' },
};

const tb = (id: number, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, description: `${name} beschrieben`, icon: 'ribbon', criteria_type: 'teamer_year', criteria_value: id, criteria_extra: null,
  is_hidden: false, is_active: true, color: '#5b21b6', earned: false, earned_at: null, seen: true, ...extra,
});
const BADGES = {
  earned: [
    tb(101, 'Erstes Jahr', { earned: true, earned_at: tageHer(30) }),
    tb(102, 'Event-Begleiter', { earned: true, earned_at: tageHer(2) }),
    tb(104, 'Geheimtipp', { earned: true, earned_at: tageHer(60), is_hidden: true }),
  ],
  available: [tb(105, 'Zweites Jahr', { progress: { current: 1, target: 2, percentage: 50 } })],
  stats: { totalVisible: 10, totalSecret: 2 },
};
const CHALLENGES = {
  active: [{ id: 8, title: 'Kerzen-Challenge', ends_at: new Date(JETZT.getTime() + 2 * 86_400_000 + 60_000).toISOString(), challenge_type: 'beitrag' }],
  archive: [], marks: [],
};
const LOSUNG = {
  success: true, translation: 'LUT',
  data: { losung: { text: 'Der Herr ist mein Hirte.', reference: 'Psalm 23,1' }, lehrtext: { text: 'Ich bin der gute Hirte.', reference: 'Johannes 10,11' } },
};

let dashboard: Record<string, unknown> = DASHBOARD;
let challenges: Record<string, unknown> = CHALLENGES;
const antworten = () => {
  h.apiGet.mockImplementation((url: string) => {
    if (url === '/teamer/dashboard') return Promise.resolve({ data: dashboard });
    if (url === '/teamer/badges/v2') return Promise.resolve({ data: BADGES, headers: {} });
    if (url === '/teamer/tageslosung') return Promise.resolve({ data: LOSUNG });
    if (url === '/challenges/konfi') return Promise.resolve({ data: challenges });
    return Promise.resolve({ data: {} });
  });
};

const karte = (titel: string): HTMLElement => screen.getByRole('heading', { name: titel }).closest('section') as HTMLElement;
const ueberschriften = (): string[] => screen.getAllByRole('heading', { level: 2 })
  .filter((e) => !e.closest('.web-rueckblick'))
  .map((e) => e.textContent ?? '');
const BEGRUESSUNG = { level: 1, name: /^(Moin|Guten (Morgen|Mittag|Tag|Abend)), Jonas!$/ } as const;
const zeige = async () => {
  render(<TeamerDashboardPage />);
  return screen.findByRole('heading', BEGRUESSUNG);
};

let vorherRandom: () => number;
beforeAll(() => { vorherRandom = Math.random; });
afterAll(() => { Math.random = vorherRandom; });

beforeEach(() => {
  vi.clearAllMocks();
  h.apiGet.mockReset();
  h.breit = true;
  h.modale.length = 0;
  dashboard = DASHBOARD;
  challenges = CHALLENGES;
  localStorage.clear();
  // Weder „Moin" (Zufall < 0,2) noch Lehrtext statt Losung (Zufall <= 0,5).
  Math.random = () => 0.9;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(JETZT);
  antworten();
});
afterEach(() => { vi.useRealTimers(); });

describe('Team-Start (Web): Kopf und Kennzahlen', () => {
  it('Begruessung mit Vornamen, darunter die Selbstbezeichnung', async () => {
    render(<TeamerDashboardPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Das Dashboard wird geladen.');
    const titel = await screen.findByRole('heading', BEGRUESSUNG);
    expect(titel).toHaveTextContent('Guten Morgen, Jonas!');
    expect(titel.closest('header')).toHaveTextContent('Jugendmitarbeiter');
  });

  it('ohne Selbstbezeichnung steht „Teamer:in" da', async () => {
    dashboard = { ...DASHBOARD, greeting: { ...DASHBOARD.greeting, role_title: null } };
    const titel = await zeige();
    expect(titel.closest('header')).toHaveTextContent('Teamer:in');
  });

  it('Kennzahlen: Events, Challenges, Badges und Zertifikate mit konkreten Zahlen und Wegen', async () => {
    await zeige();
    await waitFor(() => expect(screen.getByRole('link', { name: 'Laufende Challenges: 1' })).toBeInTheDocument());
    const events = screen.getByRole('link', { name: 'Anstehende Events: 3' });
    expect(events).toHaveAttribute('href', '/teamer/events');
    expect(events).toHaveTextContent('Das nächste: in 2 Tagen');
    expect(screen.getByRole('link', { name: 'Laufende Challenges: 1' })).toHaveAttribute('href', '/teamer/challenges');
    const badges = screen.getByRole('link', { name: 'Badges erreicht: 2' });
    expect(badges).toHaveAttribute('href', '/teamer/profile/badges');
    expect(badges).toHaveTextContent('von 10 sichtbaren');
    expect(badges).toHaveTextContent('1 neues');
    const zertifikate = screen.getByRole('group', { name: 'Zertifikate gültig: 2' });
    expect(zertifikate).toHaveTextContent('1 abgelaufen');
  });
});

describe('Team-Start (Web): Karten', () => {
  it('zeigt die Karten in der Reihenfolge der Leitung', async () => {
    await zeige();
    await waitFor(() => expect(ueberschriften()).toEqual([
      'Deine Zertifikate', 'Laufende Challenges', 'Dein Konfispruch', 'Deine Events', 'Deine Badges', 'Tageslosung',
    ]));
  });

  it('ausgeschaltete Bausteine fehlen -- samt ihrer Kennzahl', async () => {
    dashboard = {
      ...DASHBOARD,
      config: { ...DASHBOARD.config, show_zertifikate: false, show_events: false, section_order: ['badges', 'zertifikate', 'events', 'challenges'] },
    };
    await zeige();
    // Fehlende Bausteine der gespeicherten Reihenfolge kommen an ihrer Standardstelle dazu (mergeSectionOrder).
    await waitFor(() => expect(ueberschriften()).toEqual(['Deine Badges', 'Tageslosung', 'Laufende Challenges', 'Dein Konfispruch']));
    expect(screen.queryByRole('group', { name: /Zertifikate gültig/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Anstehende Events/ })).toBeNull();
  });

  it('Zertifikate: nur die erhaltenen, mit Stand; ein abgelaufenes ist als solches markiert', async () => {
    await zeige();
    const k = await waitFor(() => karte('Deine Zertifikate'));
    expect(within(k).getByText('2 von 3 gültig')).toBeInTheDocument();
    const zeilen = within(within(k).getByRole('list', { name: 'Zertifikate' })).getAllByRole('listitem');
    expect(zeilen).toHaveLength(3);
    expect(zeilen[0]).toHaveTextContent('Juleica');
    expect(zeilen[0]).toHaveTextContent('Gültig');
    expect(zeilen[1]).toHaveTextContent('Erste-Hilfe-Kurs');
    expect(zeilen[1]).toHaveTextContent('Abgelaufen');
    expect(within(k).queryByText('Andachtsleitung')).toBeNull();
  });

  it('Events: Links in die Terminliste des Teams, Warteliste und Mitbringen', async () => {
    await zeige();
    const k = await waitFor(() => karte('Deine Events'));
    const zeilen = within(within(k).getByRole('list', { name: 'Deine Events' })).getAllByRole('listitem');
    expect(zeilen).toHaveLength(3);
    expect(within(zeilen[0]).getByRole('link', { name: 'Konfi-Samstag' })).toHaveAttribute('href', '/teamer/events?eventId=31');
    expect(within(zeilen[0]).getByText('Mitbringen: Laptop')).toBeInTheDocument();
    expect(within(zeilen[1]).getByText('Warteliste')).toBeInTheDocument();
    expect(within(k).getByRole('link', { name: 'Alle Events →' })).toHaveAttribute('href', '/teamer/events');
  });

  it('Challenges: laufende mit Link; ohne laufende steht die Karte trotzdem da (der Weg dorthin)', async () => {
    await zeige();
    const k = await waitFor(() => karte('Laufende Challenges'));
    expect(within(k).getByRole('link', { name: 'Kerzen-Challenge' })).toHaveAttribute('href', '/teamer/challenges/8');
    expect(within(k).getByText('noch 2 Tage')).toBeInTheDocument();
  });

  it('keine laufende Challenge: die Karte sagt es und fuehrt zu den Challenges', async () => {
    challenges = { active: [], archive: [], marks: [] };
    await zeige();
    const k = await waitFor(() => karte('Laufende Challenges'));
    expect(within(k).getByText('Gerade läuft keine Challenge')).toBeInTheDocument();
    expect(within(k).getByRole('link', { name: 'Challenges ansehen' })).toHaveAttribute('href', '/teamer/challenges');
  });

  it('Konfispruch: der Text; „ändern" oeffnet die Auswahl gegen die Team-Endpunkte', async () => {
    await zeige();
    const k = await waitFor(() => karte('Dein Konfispruch'));
    expect(within(k).getByText(/Seid fröhlich in Hoffnung\./)).toBeInTheDocument();
    expect(within(k).getByText('Römer 12,12')).toBeInTheDocument();
    fireEvent.click(within(k).getByRole('button', { name: 'Konfispruch ändern' }));
    expect(h.modale).toHaveLength(1);
    expect(h.modale[0].name).toBe('KonfispruchSelectModal');
    expect(h.modale[0].props).toMatchObject({ apiBasePath: '/teamer', variant: 'teamer', current: DASHBOARD.konfspruch });
  });

  it('Tageslosung mit Uebersetzung; „Übersetzung ändern" oeffnet die Auswahl', async () => {
    await zeige();
    const k = await waitFor(() => karte('Tageslosung'));
    expect(within(k).getByText(/Der Herr ist mein Hirte\./)).toBeInTheDocument();
    expect(within(k).getByText('Lutherbibel 2017')).toBeInTheDocument();
    fireEvent.click(within(k).getByRole('button', { name: 'Übersetzung ändern' }));
    expect(h.modale.map((m) => m.name)).toEqual(['BibleTranslationModal']);
    expect(h.modale[0].props.currentTranslation).toBe('LUT');
  });

  it('Badges: Zahlen, neue Markierung, Dialog; ein noch nicht erreichtes Badge bleibt aus der Karte', async () => {
    await zeige();
    const k = await waitFor(() => karte('Deine Badges'));
    expect(within(k).getByText('Geheim: 1 von 2 – noch 1 zu entdecken')).toBeInTheDocument();
    const knoepfe = within(within(k).getByRole('list', { name: 'Zuletzt erhaltene Badges' })).getAllByRole('button');
    expect(knoepfe.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Event-Begleiter (neu): Einzelheiten ansehen',
      'Erstes Jahr: Einzelheiten ansehen',
      'Geheimtipp: Einzelheiten ansehen',
    ]);
    fireEvent.click(knoepfe[0]);
    const dialog = screen.getByRole('dialog', { name: 'Event-Begleiter' });
    expect(within(dialog).getByText('Erreicht')).toBeInTheDocument();
    expect(within(k).getByRole('link', { name: 'Alle Badges →' })).toHaveAttribute('href', '/teamer/profile/badges');
  });

  it('Rueckblick des Teams: oeffnet das Modal als Team-Rueckblick, „ausblenden" merkt es sich', async () => {
    await zeige();
    const hinweis = screen.getByRole('region', { name: 'Rückblick' });
    expect(within(hinweis).getByRole('heading', { name: 'Dein Team-Jahresrückblick ist da!' })).toBeInTheDocument();
    fireEvent.click(within(hinweis).getByRole('button', { name: 'Rückblick ansehen' }));
    expect(h.modale.map((m) => m.name)).toEqual(['WrappedModal']);
    expect(h.modale[0].props).toMatchObject({ displayName: 'Jonas Probe', wrappedType: 'teamer' });
    fireEvent.click(within(hinweis).getByRole('button', { name: 'Hinweis ausblenden' }));
    expect(screen.queryByRole('region', { name: 'Rückblick' })).toBeNull();
    await waitFor(() => expect(localStorage.getItem('CapacitorStorage.wrapped_hinweis_t_11_3')).toBe('1'));
  });
});

describe('Team-Start: Zustaende und die App', () => {
  it('Fehler: Hinweis mit erneutem Versuch, der wirklich neu laedt', async () => {
    h.apiGet.mockRejectedValue(new Error('Netz weg'));
    render(<TeamerDashboardPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Das Dashboard konnte nicht geladen werden.');
    antworten();
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByRole('heading', BEGRUESSUNG)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('im schmalen Fenster bleibt die Darstellung der App (Farbverlauf-Kopf, keine Web-Seite)', async () => {
    h.breit = false;
    const { container } = render(<TeamerDashboardPage />);
    await waitFor(() => expect(container.querySelector('.app-dashboard-header')).not.toBeNull());
    expect(container.querySelector('.web-seite')).toBeNull();
    expect(container.querySelector('.web-karte')).toBeNull();
    expect(container.textContent).toContain('Guten Morgen, Jonas!');
  });
});
