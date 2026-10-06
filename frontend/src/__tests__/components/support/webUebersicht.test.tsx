// Uebersicht der Support-Ansicht in der Web-Fassung, gerendert
// (docs/planung/support-web.md, Entscheidung 3): im breiten Fenster ein
// Dashboard aus GET /support/uebersicht -- Kennzahl-Kacheln, neueste
// Vorgänge und Mails, Diagramme in eigenem SVG, Testphasen, Gemeinden je
// Landeskirche. Seit den Vorgängen (docs/planung/support-vorgaenge.md,
// Entscheidung 7) zählt die Kachel „Offene Vorgänge“ und die Liste zeigt die
// neuesten offenen Vorgänge; die Kachel „Posteingang“ trägt dieselbe Zahl wie
// die rote Zahl der Leiste. Im schmalen Fenster bleibt die Liste der Bereiche
// der App.
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  push: vi.fn(),
  breit: true,
  user: { id: 9, display_name: 'Support Eins', username: 'support1', role_name: 'super_admin', is_super_admin: true } as Record<string, unknown>,
}));

vi.mock('@ionic/react', async () => (await import('./ionicAttrappe')).ionicAttrappe({
  router: { push: h.push, goBack: vi.fn(), canGoBack: () => false },
}));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('./ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: ({ message }: { message: string }) => <p>{message}</p> }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, signOut: vi.fn(), setError: vi.fn(), setSuccess: vi.fn(), isOnline: true }),
}));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));

import SupportUebersichtPage from '../../../components/support/SupportUebersichtPage';
import { supportMailZaehlerZuruecksetzen } from '../../../navigation/supportMailZaehler';

// Ein Geraet in Deutschland, und "jetzt" ist der 03.10.2026, 10:30 Uhr.
let vorherTZ: string | undefined;
beforeAll(() => { vorherTZ = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherTZ === undefined) delete process.env.TZ; else process.env.TZ = vorherTZ; });

const MONATE = ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
const WOCHEN = ['2026-W29', '2026-W30', '2026-W31', '2026-W32', '2026-W33', '2026-W34', '2026-W35', '2026-W36', '2026-W37', '2026-W38', '2026-W39', '2026-W40'];
const KONFI_NEU = [22, 31, 38, 44, 52, 61, 58, 70, 83, 96, 118, 74];
const TEAM_NEU = [4, 6, 7, 9, 10, 12, 11, 14, 17, 19, 23, 14];

const UEBERSICHT = {
  kennzahlen: {
    gemeinden: { gesamt: 15, testphase: 4, lizenz: 8, unbegrenzt: 2, gesperrt: 1 },
    konten: { konfi: 1265, teamer: 176, admin: 41, org_admin: 19 },
    aktiv_30_tage: 912,
    anfragen_offen: 5,
    mails_ungelesen: 3,
  },
  entwicklung: {
    monate: MONATE,
    gemeinden_neu: [0, 1, 0, 1, 1, 2, 1, 2, 2, 1, 3, 2],
    konten_neu: { konfi: KONFI_NEU, team: TEAM_NEU },
    konten_gesamt: [651, 687, 731, 781, 842, 914, 980, 1063, 1162, 1274, 1414, 1501],
    anfragen_neu: [1, 2, 1, 3, 2, 4, 3, 3, 5, 4, 6, 5],
  },
  aktivitaet: {
    wochen: WOCHEN,
    antraege: [41, 38, 12, 8, 6, 9, 22, 47, 63, 71, 84, 77],
    buchungen: [18, 14, 6, 4, 3, 5, 15, 29, 41, 55, 62, 58],
    nachrichten: [210, 190, 95, 70, 60, 88, 160, 280, 340, 410, 455, 390],
  },
  neueste_anfragen: [
    { id: 41, gemeinde: 'Kirchengemeinde Musterdorf-Süd', kontakt_name: 'Pastorin Lena Probe', status: 'neu', wunsch_lizenz: 'standard', created_at: '2026-10-03T06:55:00Z', ungelesen: 1 },
    { id: 40, gemeinde: 'Kirchengemeinde Wiesengrund', kontakt_name: 'Jan Vorlage', status: 'neu', wunsch_lizenz: 'klein', created_at: '2026-10-02T12:30:00Z', ungelesen: 0 },
    { id: 39, gemeinde: 'Kirchengemeinde Steinbach', kontakt_name: 'Miriam Demo', status: 'in_arbeit', wunsch_lizenz: null, created_at: '2026-10-01T08:30:00Z', ungelesen: 0 },
    { id: 38, gemeinde: 'Kirchengemeinde Rosenau', kontakt_name: 'Tim Platzhalter', status: 'in_arbeit', wunsch_lizenz: 'gross', created_at: '2026-09-29T08:30:00Z', ungelesen: 0 },
    { id: 37, gemeinde: 'Kirchengemeinde Seeblick', kontakt_name: 'Vera Beispielfrau', status: 'neu', wunsch_lizenz: null, created_at: '2026-09-27T08:30:00Z', ungelesen: 0 },
  ],
  neueste_mails: [
    { id: 301, postfach: 'moin', von_name: 'Pastorin Lena Probe', von_adresse: 'lena.probe@example.org', betreff: 'Re: Eure Anfrage bei Konfi Quest [Anfrage 41]', gesendet_am: '2026-10-03T08:18:00Z', gelesen_am: null, anfrage_id: 41, vorgang_id: 41, organization_id: null, gemeinde_name: 'Kirchengemeinde Musterdorf-Süd' },
    { id: 302, postfach: 'support', von_name: 'Sam Muster', von_adresse: 'sam@example.org', betreff: 'Frage zu den Jahrgängen', gesendet_am: '2026-10-03T07:35:00Z', gelesen_am: null, anfrage_id: null, organization_id: 1, gemeinde_name: 'Kirchengemeinde Musterdorf' },
    { id: 303, postfach: 'support', von_name: null, von_adresse: 'info@beispiel-verein.example', betreff: 'Passwort vergessen?', gesendet_am: '2026-10-03T03:30:00Z', gelesen_am: null, anfrage_id: null, organization_id: null, gemeinde_name: null },
    { id: 304, postfach: 'moin', von_name: 'Jan Vorlage', von_adresse: 'jan.vorlage@example.org', betreff: 'Rückfrage zur Lizenz', gesendet_am: '2026-10-02T10:30:00Z', gelesen_am: '2026-10-02T11:00:00Z', anfrage_id: 40, organization_id: null, gemeinde_name: 'Kirchengemeinde Wiesengrund' },
    { id: 305, postfach: 'support', von_name: 'Robin Probe', von_adresse: 'robin@example.org', betreff: 'Termin-Export als Kalender?', gesendet_am: '2026-10-02T06:30:00Z', gelesen_am: '2026-10-02T07:00:00Z', anfrage_id: null, organization_id: 2, gemeinde_name: 'Kirchengemeinde Hafenstadt' },
  ],
  testphase_endet: [
    { id: 8, display_name: 'Kirchengemeinde Sonnenberg', trial_ends_at: '2026-10-07T00:00:00Z' },
    { id: 5, display_name: 'Kirchengemeinde Neustadt am Deich', trial_ends_at: '2026-10-12T00:00:00Z' },
  ],
};

const vorgangEintrag = (id: number, extra: Record<string, unknown> = {}) => ({
  id, art: 'frage', bereich: null, dringlichkeit: 'normal', status: 'neu', betreff: `Vorgang ${id}`, quelle: 'formular', organization_id: null, gemeinde_name: null,
  anfrage_id: null, ungelesen: 0, letzte_aktivitaet: '2026-10-03T06:00:00Z', created_at: '2026-10-03T06:00:00Z', archiviert_am: null, ...extra,
});

// Sieben offene Vorgänge (drei neu, drei in Arbeit, einer wartet); gezeigt werden die sechs neuesten.
const VORGAENGE = [
  vorgangEintrag(35, { status: 'in_arbeit', betreff: 'Alter Vorgang', art: 'sonstiges', created_at: '2026-09-20T08:30:00Z' }),
  vorgangEintrag(41, { status: 'neu', betreff: 'Anfrage Kirchengemeinde Musterdorf-Süd', art: 'neue_gemeinde', quelle: 'anfrage', anfrage_id: 41, ungelesen: 1, created_at: '2026-10-03T06:55:00Z' }),
  vorgangEintrag(40, { status: 'neu', betreff: 'Anfrage Kirchengemeinde Wiesengrund', art: 'neue_gemeinde', quelle: 'anfrage', anfrage_id: 40, created_at: '2026-10-02T12:30:00Z' }),
  vorgangEintrag(39, { status: 'in_arbeit', betreff: 'Anfrage Kirchengemeinde Steinbach', art: 'neue_gemeinde', quelle: 'anfrage', anfrage_id: 39, created_at: '2026-10-01T08:30:00Z' }),
  vorgangEintrag(38, { status: 'in_arbeit', betreff: 'Chat zeigt nichts Neues', art: 'fehler', bereich: 'chat', organization_id: 1, gemeinde_name: 'Kirchengemeinde Musterdorf', created_at: '2026-09-29T08:30:00Z' }),
  vorgangEintrag(37, { status: 'wartet', betreff: 'Termin-Export als Kalender?', art: 'wunsch', bereich: 'termine', created_at: '2026-09-27T08:30:00Z' }),
  vorgangEintrag(36, { status: 'neu', betreff: 'Passwort vergessen', art: 'zugang', created_at: '2026-09-25T08:30:00Z' }),
];

const kennzahl = (id: number, name: string, lk: [number, string] | null, kk: [number, string] | null) => ({
  id, name, is_active: true,
  kirchenkreis_id: kk ? kk[0] : null, kirchenkreis: kk ? kk[1] : null, landeskirche_id: lk ? lk[0] : null, landeskirche: lk ? lk[1] : null,
  konten: { konfi: 10, teamer: 2, admin: 1, org_admin: 1 }, aktiv_30_tage: 8, jahrgaenge: 1,
});
const STATISTIK = {
  stand: '2026-10-03T08:25:00Z',
  gemeinden: [
    kennzahl(1, 'A', [1, 'Nordlandkirche'], [11, 'Küstenland']),
    kennzahl(2, 'B', [1, 'Nordlandkirche'], [11, 'Küstenland']),
    kennzahl(3, 'C', [1, 'Nordlandkirche'], [12, 'Marschen']),
    kennzahl(4, 'D', [2, 'Kirche im Mittelland'], [21, 'Hügelland']),
    kennzahl(5, 'E', [2, 'Kirche im Mittelland'], [21, 'Hügelland']),
    kennzahl(6, 'F', null, null),
  ],
};

const antworten = (uebersicht: unknown = UEBERSICHT, statistik: unknown = STATISTIK, vorgaenge: unknown = VORGAENGE) => {
  h.apiGet.mockImplementation((pfad: string, optionen?: { params?: { filter?: string } }) => {
    if (pfad === '/support/vorgaenge') {
      if (optionen?.params?.filter !== 'offen') return Promise.reject(new Error('unerwartet: nur die offenen'));
      return vorgaenge instanceof Error ? Promise.reject(vorgaenge) : Promise.resolve({ data: vorgaenge });
    }
    if (pfad === '/support/uebersicht') return uebersicht instanceof Error ? Promise.reject(uebersicht) : Promise.resolve({ data: uebersicht });
    if (pfad === '/support/statistik') return statistik instanceof Error ? Promise.reject(statistik) : Promise.resolve({ data: statistik });
    if (pfad === '/support/mail/zaehler') return Promise.resolve({ data: { anfragen: 1, gemeinden: 1, eingang: 1, je_anfrage: {}, je_gemeinde: {}, vorgaenge: 7, posteingang: 4 } });
    if (pfad === '/support/anfragen') return Promise.resolve({ data: [] });
    return Promise.reject(new Error(`unerwartet: ${pfad}`));
  });
};

const karte = (titel: string): HTMLElement => screen.getByRole('heading', { name: titel }).closest('section') as HTMLElement;
const diagramm = (name: RegExp): SVGElement => screen.getByRole('img', { name }) as unknown as SVGElement;

beforeEach(() => {
  vi.clearAllMocks();
  h.apiGet.mockReset();
  h.breit = true;
  h.user = { id: 9, display_name: 'Support Eins', username: 'support1', role_name: 'super_admin', is_super_admin: true };
  supportMailZaehlerZuruecksetzen();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-03T08:30:00Z'));
});
afterEach(() => { vi.useRealTimers(); });

describe('Uebersicht (Web): Laden und Fehler', () => {
  it('fragt Uebersicht und Statistik ab und zeigt erst Platzhalter, dann das Dashboard', async () => {
    antworten();
    render(<SupportUebersichtPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Die Übersicht wird geladen.');
    expect(await screen.findByRole('group', { name: 'Konfis: 1.265' })).toBeInTheDocument();
    expect(h.apiGet).toHaveBeenCalledWith('/support/uebersicht');
    expect(h.apiGet).toHaveBeenCalledWith('/support/statistik');
    expect(h.apiGet).toHaveBeenCalledWith('/support/vorgaenge', { params: { filter: 'offen' } });
    expect(screen.getByRole('heading', { level: 1, name: 'Übersicht' })).toBeInTheDocument();
  });

  it('Fehler: Hinweis mit erneutem Versuch, der wirklich neu laedt', async () => {
    antworten(new Error('Netz weg'));
    render(<SupportUebersichtPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Übersicht konnte nicht geladen werden.');
    antworten();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' })); });
    expect(await screen.findByRole('group', { name: 'Konfis: 1.265' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('eine Antwort in unbekannter Form ist ein Fehler, kein Absturz', async () => {
    antworten({ irgendwas: 1 });
    render(<SupportUebersichtPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Übersicht konnte nicht geladen werden.');
  });

  it('kommt die Statistik nicht, fehlt nur die Karte "Gemeinden je Landeskirche"', async () => {
    antworten(UEBERSICHT, new Error('Statistik kaputt'));
    render(<SupportUebersichtPage />);
    expect(await screen.findByRole('group', { name: 'Konfis: 1.265' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Gemeinden je Landeskirche' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Neueste Vorgänge' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('kommen die Vorgänge nicht, sagt die Karte das -- die Kachel zählt dann nach den Kennzahlen, der Rest steht da', async () => {
    antworten(UEBERSICHT, STATISTIK, new Error('Vorgänge kaputt'));
    render(<SupportUebersichtPage />);
    await screen.findByRole('group', { name: 'Konfis: 1.265' });
    expect(screen.getByText('Vorgänge nicht geladen')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Offene Vorgänge: 5' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Neueste Mails' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Uebersicht (Web): Kennzahl-Kacheln', () => {
  it('sechs Kacheln mit den Zahlen aus den Kennzahlen', async () => {
    antworten();
    render(<SupportUebersichtPage />);
    await screen.findByRole('group', { name: 'Konfis: 1.265' });

    // Gemeinden: gesamt, darunter Lizenz/Testphase/unbegrenzt/gesperrt; Link zu den Gemeinden.
    const gemeinden = screen.getByRole('link', { name: 'Gemeinden: 15' });
    expect(gemeinden).toHaveAttribute('href', '/admin/organizations');
    expect(gemeinden).toHaveTextContent('8 Lizenz · 4 Testphase');
    expect(gemeinden).toHaveTextContent('2 unbegrenzt · 1 gesperrt');

    expect(screen.getByRole('group', { name: 'Konfis: 1.265' })).toHaveTextContent('74 neu im Oktober');
    // Team: Teamer + Admin + Org-Admin = 176 + 41 + 19.
    const team = screen.getByRole('group', { name: 'Team: 236' });
    expect(team).toHaveTextContent('davon 60 Leitung');
    expect(team).toHaveTextContent('14 neu im Oktober');
    expect(screen.getByRole('group', { name: 'Aktiv in 30 Tagen: 912' })).toHaveTextContent('61 % von 1.501 Konten');

    // Die offenen Vorgänge aus der Liste: 7, davon drei neu, drei in Arbeit, einer wartet.
    const offen = screen.getByRole('link', { name: 'Offene Vorgänge: 7' });
    expect(offen).toHaveAttribute('href', '/admin/support/vorgaenge?filter=offen');
    expect(offen).toHaveTextContent('3 neu · 3 in Arbeit · 1 wartet');
    // Der Posteingang: dieselbe Zahl wie die rote Zahl der Leiste (4), nicht die aus den Kennzahlen (3).
    const mails = await screen.findByRole('link', { name: 'Posteingang: 4' });
    expect(mails).toHaveAttribute('href', '/admin/support/post?filter=ungelesen');
    expect(mails).toHaveTextContent('Ungelesen, noch nicht einsortiert');
    expect(screen.queryByText('Offene Anfragen')).toBeNull();
  });

  it('kommt der Zähler nicht, zählt der Posteingang nach den Kennzahlen der Übersicht (3)', async () => {
    antworten();
    const vorher = h.apiGet.getMockImplementation()!;
    h.apiGet.mockImplementation((pfad: string, o?: unknown) => (pfad === '/support/mail/zaehler' ? Promise.reject(new Error('Netz weg')) : vorher(pfad, o as never)));
    render(<SupportUebersichtPage />);
    expect(await screen.findByRole('link', { name: 'Posteingang: 3' })).toBeInTheDocument();
  });

  it('keine Liste der Bereiche und kein Abmelden im breiten Fenster -- die Leiste steht links', async () => {
    antworten();
    render(<SupportUebersichtPage />);
    await screen.findByRole('group', { name: 'Konfis: 1.265' });
    expect(screen.queryByText('Bereiche')).toBeNull();
    expect(screen.queryByRole('button', { name: /Abmelden/ })).toBeNull();
    expect(document.querySelector('.app-list-item')).toBeNull();
  });
});

describe('Uebersicht (Web): neueste Vorgänge und Mails', () => {
  it('die sechs neuesten offenen Vorgänge, neueste zuerst, mit Art, Gemeinde, Stand und Datum relativ -- der siebte fehlt', async () => {
    antworten();
    render(<SupportUebersichtPage />);
    await screen.findByRole('group', { name: 'Konfis: 1.265' });
    // Jede Karte ist ein Bereich, benannt nach ihrer Ueberschrift.
    expect(screen.getByRole('region', { name: 'Neueste Vorgänge' })).toBe(karte('Neueste Vorgänge'));
    const zeilen = within(karte('Neueste Vorgänge')).getAllByRole('listitem');
    expect(zeilen).toHaveLength(6);
    expect(zeilen.map((z) => within(z).getAllByRole('link')[0].getAttribute('href'))).toEqual([
      '/admin/support/vorgaenge/41', '/admin/support/vorgaenge/40', '/admin/support/vorgaenge/39', '/admin/support/vorgaenge/38',
      '/admin/support/vorgaenge/37', '/admin/support/vorgaenge/36',
    ]);
    expect(within(karte('Neueste Vorgänge')).queryByText('Alter Vorgang')).toBeNull();
    expect(zeilen[0]).toHaveTextContent('Anfrage Kirchengemeinde Musterdorf-Süd');
    expect(zeilen[0]).toHaveTextContent('Neue Gemeinde');
    expect(zeilen[0]).toHaveTextContent('Nicht zugeordnet');
    expect(zeilen[0]).toHaveTextContent('Neu');
    expect(zeilen[0]).toHaveTextContent('vor 1 Std.');
    expect(zeilen[3]).toHaveTextContent('Kirchengemeinde Musterdorf');
    expect(zeilen[3]).toHaveTextContent('Fehler');
    expect(zeilen[3]).toHaveTextContent('In Arbeit');
    expect(zeilen[4]).toHaveTextContent('Wartet');
    // Neu oder ungelesen: ein Punkt -- 41 (neu, ungelesen), 40 (neu) und 36 (neu); die in Arbeit nicht.
    expect(within(karte('Neueste Vorgänge')).getAllByRole('img', { name: 'ungelesen' })).toHaveLength(3);
    expect(within(zeilen[0]).getByRole('img', { name: 'ungelesen' })).toBeInTheDocument();
    expect(within(zeilen[2]).queryByRole('img', { name: 'ungelesen' })).toBeNull();
    expect(within(karte('Neueste Vorgänge')).getByRole('link', { name: 'Alle Vorgänge →' })).toHaveAttribute('href', '/admin/support/vorgaenge');
  });

  it('fuenf Mails mit Postfach, Absender, Betreff und Zuordnung als Link', async () => {
    antworten();
    render(<SupportUebersichtPage />);
    await screen.findByRole('group', { name: 'Konfis: 1.265' });
    const k = karte('Neueste Mails');
    const zeilen = within(k).getAllByRole('listitem');
    expect(zeilen).toHaveLength(5);
    expect(zeilen[0]).toHaveTextContent('moin@');
    expect(zeilen[0]).toHaveTextContent('Pastorin Lena Probe');
    // Mit Vorgang: zum Vorgang; älterer Server ohne Vorgang: eine Anfrage führt zu ihrem Vorgang, eine Gemeinde zu ihren Vorgängen.
    expect(within(zeilen[0]).getByRole('link', { name: /Musterdorf-Süd/ })).toHaveAttribute('href', '/admin/support/vorgaenge/41');
    expect(within(zeilen[1]).getByRole('link', { name: /Kirchengemeinde Musterdorf$/ })).toHaveAttribute('href', '/admin/support/vorgaenge?gemeinde=1');
    expect(within(zeilen[3]).getByRole('link', { name: /Wiesengrund/ })).toHaveAttribute('href', '/admin/support/anfragen/40');
    // Nicht einsortiert: Marke statt Link; ohne Namen steht die Adresse.
    expect(zeilen[2]).toHaveTextContent('Nicht einsortiert');
    expect(zeilen[2]).toHaveTextContent('info@beispiel-verein.example');
    expect(within(zeilen[2]).getAllByRole('link')).toHaveLength(1);
    // Ungelesen: die ersten drei.
    expect(within(k).getAllByRole('img', { name: 'ungelesen' })).toHaveLength(3);
    expect(within(zeilen[0]).getByRole('link', { name: 'Re: Eure Anfrage bei Konfi Quest [Anfrage 41]' })).toHaveAttribute('href', '/admin/support/post/301');
    expect(within(k).getByRole('link', { name: 'Zum Posteingang →' })).toHaveAttribute('href', '/admin/support/post');
  });

  it('ein Klick bleibt in der App (Router), Strg-Klick und Mittelklick gehen an den Browser', async () => {
    antworten();
    render(<SupportUebersichtPage />);
    await screen.findByRole('group', { name: 'Konfis: 1.265' });
    const link = within(karte('Neueste Vorgänge')).getAllByRole('link')[1];
    expect(link).toHaveAttribute('href', '/admin/support/vorgaenge/41');
    // Was der Browser danach taete, ohne dass jsdom "navigieren" will: der Stand von defaultPrevented am Dokument.
    const verhindert: boolean[] = [];
    const horcher = (e: Event) => { verhindert.push(e.defaultPrevented); e.preventDefault(); };
    document.addEventListener('click', horcher);
    try {
      fireEvent.click(link);
      expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge/41', 'none', 'push');
      h.push.mockClear();
      fireEvent.click(link, { ctrlKey: true });
      fireEvent.click(link, { button: 1 });
      fireEvent.click(link, { metaKey: true });
      fireEvent.click(link, { shiftKey: true });
      expect(h.push).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('click', horcher);
    }
    // Einfacher Klick: die App uebernimmt (kein Neuladen); alle anderen: der Browser.
    expect(verhindert).toEqual([true, false, false, false, false]);
  });

  it('leere Listen: Hinweise statt leerer Karten', async () => {
    antworten({ ...UEBERSICHT, neueste_anfragen: [], neueste_mails: [], testphase_endet: [] }, STATISTIK, []);
    render(<SupportUebersichtPage />);
    await screen.findByRole('group', { name: 'Konfis: 1.265' });
    expect(screen.getByText('Nichts offen')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Offene Vorgänge: 0' })).toBeInTheDocument();
    expect(screen.getByText('Noch keine Mails')).toBeInTheDocument();
    expect(screen.getByText('Keine Testphase läuft aus')).toBeInTheDocument();
  });
});

describe('Uebersicht (Web): Testphasen und Landeskirchen', () => {
  it('Testphase endet bald: Gemeinde, Datum und Resttage, fruehestes zuerst, Link zur Gemeinde', async () => {
    antworten();
    render(<SupportUebersichtPage />);
    await screen.findByRole('group', { name: 'Konfis: 1.265' });
    const zeilen = within(karte('Testphase endet bald')).getAllByRole('listitem');
    expect(zeilen).toHaveLength(2);
    expect(zeilen[0]).toHaveTextContent('Kirchengemeinde Sonnenberg');
    expect(zeilen[0]).toHaveTextContent('Testphase bis 07.10.2026');
    expect(zeilen[0]).toHaveTextContent('in 4 Tagen');
    expect(zeilen[1]).toHaveTextContent('in 9 Tagen');
    expect(within(zeilen[0]).getByRole('link')).toHaveAttribute('href', '/admin/organizations?gemeinde=8');
  });

  it('Gemeinden je Landeskirche: waagerechte Balken, groesste zuerst, "Ohne Landeskirche" mit eigener Zahl', async () => {
    antworten();
    render(<SupportUebersichtPage />);
    await screen.findByRole('group', { name: 'Konfis: 1.265' });
    const bild = diagramm(/^Gemeinden je Landeskirche:/);
    const zeilen = [...bild.querySelectorAll('.web-balkenzeile')];
    expect(zeilen).toHaveLength(3);
    expect(zeilen.map((z) => z.querySelector('text.web-balkenliste__name')?.textContent)).toEqual(['Nordlandkirche', 'Kirche im Mittelland', 'Ohne Landeskirche']);
    expect(zeilen.map((z) => z.querySelector('text.web-diagramm__text--stark')?.textContent)).toEqual(['3', '2', '1']);
    // Die Laenge traegt den Wert: der Balken fuer 3 ist dreimal so lang wie der fuer 1.
    const breiten = zeilen.map((z) => {
      const d = z.querySelector('path.web-balken')?.getAttribute('d') ?? '';
      return Number(/H([\d.]+)Q/.exec(d)?.[1]) - Number(/^M([\d.]+),/.exec(d)?.[1]);
    });
    expect(breiten[0]).toBeGreaterThan(breiten[1]);
    expect(breiten[1]).toBeGreaterThan(breiten[2]);
  });
});

describe('Uebersicht (Web): Diagramme', () => {
  it('Neue Konten je Monat: zwoelf Saeulen, Monatsnamen kurz, runde Teilstriche, Legende', async () => {
    antworten();
    render(<SupportUebersichtPage />);
    await screen.findByRole('group', { name: 'Konfis: 1.265' });
    const bild = diagramm(/^Neue Konten je Monat:/);
    expect(bild.querySelectorAll('.web-saeule')).toHaveLength(12);
    expect([...bild.querySelectorAll('text.web-diagramm__text--mitte')].map((t) => t.textContent)).toEqual(
      ['Nov', 'Dez', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt'],
    );
    // Hoechster Monat: September mit 118 + 23 = 141 -> Achse 0, 50, 100, 150.
    expect([...bild.querySelectorAll('text.web-diagramm__text--rechts')].map((t) => t.textContent)).toEqual(['0', '50', '100', '150']);
    // Jede Saeule hat zwei Segmente, Konfi unten und Team oben.
    for (const saeule of bild.querySelectorAll('.web-saeule')) expect(saeule.querySelectorAll('path.web-balken')).toHaveLength(2);
    const legenden = within(karte('Neue Konten je Monat')).getByRole('list', { name: 'Legende' });
    expect(within(legenden).getAllByRole('listitem').map((l) => l.textContent)).toEqual(['Konfis', 'Team']);
  });

  it('die Werte stehen auch als Tabelle fuer Vorleseprogramme da: zwoelf Zeilen, die richtigen Zahlen', async () => {
    antworten();
    render(<SupportUebersichtPage />);
    await screen.findByRole('group', { name: 'Konfis: 1.265' });
    const tabelle = within(karte('Neue Konten je Monat')).getByRole('table', { name: 'Neue Konten je Monat' });
    const zeilen = within(tabelle).getAllByRole('row');
    expect(zeilen).toHaveLength(13); // Kopf + 12 Monate
    expect(within(zeilen[0]).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Monat', 'Konfis', 'Team']);
    const september = zeilen.find((z) => within(z).queryByRole('rowheader', { name: 'September 2026' }))!;
    expect(within(september).getAllByRole('cell').map((c) => c.textContent)).toEqual(['118', '23']);
    const november = zeilen[1];
    expect(within(november).getByRole('rowheader')).toHaveTextContent('November 2025');
    expect(within(november).getAllByRole('cell').map((c) => c.textContent)).toEqual(['22', '4']);
  });

  it('Konten gesamt: eine Linie mit Wert am Ende (1.501), ohne Legende', async () => {
    antworten();
    render(<SupportUebersichtPage />);
    await screen.findByRole('group', { name: 'Konfis: 1.265' });
    const bild = diagramm(/^Konten gesamt:/);
    expect(bild.querySelectorAll('path.web-diagramm__linie')).toHaveLength(1);
    expect(bild.querySelector('text.web-diagramm__text--stark')?.textContent).toBe('1.501');
    expect(bild.getAttribute('aria-label')).toContain('651');
    expect(bild.getAttribute('aria-label')).toContain('1.501');
    expect(within(karte('Konten gesamt')).queryByRole('list', { name: 'Legende' })).toBeNull();
  });

  it('Neue Gemeinden und Anfragen: zwoelf Monate, zwei Reihen nebeneinander, Nullmonate ohne Saeule', async () => {
    antworten();
    render(<SupportUebersichtPage />);
    await screen.findByRole('group', { name: 'Konfis: 1.265' });
    const bild = diagramm(/^Neue Gemeinden und Anfragen je Monat:/);
    const saeulen = [...bild.querySelectorAll('.web-saeule')];
    expect(saeulen).toHaveLength(12);
    // November: keine neue Gemeinde (0), eine Anfrage -> ein Balken; Dezember: beide.
    expect(saeulen.map((s) => s.querySelectorAll('path.web-balken').length)).toEqual([1, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2]);
    expect(within(karte('Neue Gemeinden und Anfragen')).getAllByRole('listitem').map((l) => l.textContent)).toEqual(['Neue Gemeinden', 'Neue Anfragen']);
  });

  it('Aktivitaet je Woche: drei Diagramme untereinander, jedes mit eigener Achse und zwoelf Wochen', async () => {
    antworten();
    render(<SupportUebersichtPage />);
    await screen.findByRole('group', { name: 'Konfis: 1.265' });
    const k = karte('Aktivität je Woche');
    for (const [name, summe, achse] of [['Anträge', '478', ['0', '50', '100']], ['Buchungen', '310', ['0', '50', '100']], ['Nachrichten', '2.748', ['0', '250', '500']]] as const) {
      const bild = within(k).getByRole('img', { name: new RegExp(`^${name} je Woche:`) }) as unknown as SVGElement;
      expect(bild.querySelectorAll('.web-saeule'), name).toHaveLength(12);
      expect([...bild.querySelectorAll('text.web-diagramm__text--rechts')].map((t) => t.textContent), name).toEqual(achse);
      expect(k).toHaveTextContent(`${summe} in 12 Wochen`);
    }
    // Nur das unterste Diagramm beschriftet die Wochen -- jede zweite, damit sich die Namen nicht beruehren;
    // die letzte steht immer da.
    const nachrichten = within(k).getByRole('img', { name: /^Nachrichten je Woche:/ }) as unknown as SVGElement;
    expect([...nachrichten.querySelectorAll('text.web-diagramm__text--mitte')].map((t) => t.textContent)).toEqual(
      ['KW 30', 'KW 32', 'KW 34', 'KW 36', 'KW 38', 'KW 40'],
    );
    const antraege = within(k).getByRole('img', { name: /^Anträge je Woche:/ }) as unknown as SVGElement;
    expect(antraege.querySelectorAll('text.web-diagramm__text--mitte')).toHaveLength(0);
  });
});

describe('Uebersicht: zwei Gesichter, eine Seite', () => {
  it('im schmalen Fenster bleibt die App-Darstellung mit der Liste der Bereiche -- und ohne Web-Bausteine', async () => {
    h.breit = false;
    antworten();
    render(<SupportUebersichtPage />);
    expect(await screen.findByText('Bereiche')).toBeInTheDocument();
    // Die Kennzahlen der App: sechs Gemeinden mit je zehn Konfis.
    expect(await screen.findByRole('group', { name: 'Konfis: 60' })).toBeInTheDocument();
    expect(document.querySelector('.web-seite')).toBeNull();
    expect(h.apiGet).not.toHaveBeenCalledWith('/support/uebersicht');
    expect(screen.getByRole('button', { name: /Abmelden/ })).toBeInTheDocument();
  });

  it('ohne Super-Admin-Recht: Hinweis, keine Abrufe, in beiden Fenstern', async () => {
    h.user = { id: 5, display_name: 'Leitung', role_name: 'org_admin' };
    antworten();
    render(<SupportUebersichtPage />);
    expect(screen.getByText('Nur für den Support')).toBeInTheDocument();
    expect(h.apiGet).not.toHaveBeenCalledWith('/support/uebersicht');
  });
});
