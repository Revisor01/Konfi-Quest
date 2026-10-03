// Gemeinden in der Web-Fassung der Support-Ansicht, gerendert
// (docs/planung/support-web.md, Entscheidung 4): Akkordeon Landeskirche ->
// Kirchenkreis, in jeder Gruppe eine Tabelle mit der Gemeindeleitung direkt
// in der Zeile, Live-Suche ueber Gemeinde, Kirchenkreis, Landeskirche und
// Leitung (Treffer klappen ihre Gruppen auf), Zustand der Gruppen im Browser.
// Im schmalen Fenster und fuer Konten ohne Super-Admin-Recht bleibt die Liste
// der App.
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import type { AlertOptionen } from './ionicAttrappe';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiDelete: vi.fn(),
  push: vi.fn(),
  present: vi.fn(),
  modalProps: null as null | Record<string, unknown>,
  alert: null as null | AlertOptionen,
  suche: '',
  breit: true,
  user: { id: 9, display_name: 'Support Eins', role_name: 'super_admin', is_super_admin: true } as Record<string, unknown>,
  setSuccess: vi.fn(),
}));

vi.mock('@ionic/react', async () => {
  const attrappe = (await import('./ionicAttrappe')).ionicAttrappe({
    presentAlert: (o) => { h.alert = o; },
    router: { push: h.push, goBack: vi.fn(), canGoBack: () => false },
  });
  return {
    ...attrappe,
    useIonModal: (_seite: unknown, props: Record<string, unknown>) => {
      h.modalProps = props;
      return [h.present, vi.fn()];
    },
  };
});
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('./ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../navigation/useAppLocation', () => ({ useAppLocation: () => ({ pathname: '/admin/organizations', search: h.suche, state: null }) }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, delete: h.apiDelete } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: vi.fn(), setSuccess: h.setSuccess, isOnline: true, refreshUser: vi.fn() }),
}));
vi.mock('../../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }) }));
vi.mock('../../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: () => {} }));
vi.mock('../../../components/admin/modals/OrganizationManagementModal', () => ({ default: () => null }));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
// Die App-Fassung liest ihre Liste ueber den Cache -- hier eine feste Antwort.
vi.mock('../../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: () => ({
    data: [{ id: 7, name: 'buesum', display_name: 'Büsum', is_active: true, created_at: '2026-01-02T00:00:00Z', updated_at: '', user_count: 3, konfi_count: 20, activity_count: 0, event_count: 0, badge_count: 0 }],
    loading: false,
    refresh: vi.fn(),
  }),
}));

import AdminOrganizationsPage from '../../../components/admin/pages/AdminOrganizationsPage';
import { SCHLUESSEL_GEMEINDEN_ZU } from '../../../components/support/web/WebGemeinden';

let vorherTZ: string | undefined;
beforeAll(() => { vorherTZ = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherTZ === undefined) delete process.env.TZ; else process.env.TZ = vorherTZ; });

const leitung = (id: number, name: string, benutzer: string, mail: string | null, aktiv = true, login: string | null = null) => ({
  id, display_name: name, username: benutzer, email: mail, is_active: aktiv, last_login_at: login,
});

const gemeinde = (id: number, name: string, extra: Record<string, unknown>) => ({
  id, name: name.toLowerCase().replace(/\W+/g, '-'), display_name: name, is_active: true, is_trial: false, trial_ends_at: null, max_konfis: null,
  konfi_count: 10, team_count: 2, created_at: '2026-03-14T00:00:00Z',
  kirchenkreis_id: null, kirchenkreis: null, landeskirche_id: null, landeskirche: null, wunsch_lizenz: null, leitung: [],
  ...extra,
});

const NORD = { landeskirche_id: 2, landeskirche: 'Zukunftskirche' };
const GEMEINDEN = [
  gemeinde(1, 'Kirchengemeinde Musterdorf', {
    ...NORD, kirchenkreis_id: 20, kirchenkreis: 'Kirchenkreis Küstenland', max_konfis: 50, konfi_count: 38, team_count: 9,
    trial_ends_at: '2027-01-31T12:00:00Z', wunsch_lizenz: 'standard',
    leitung: [
      leitung(10, 'Alex Beispiel', 'alex.beispiel', 'alex@example.org', true, '2026-10-03T06:30:00Z'),
      leitung(11, 'Sam Muster', 'sam.muster', 'sam@example.org', false, null),
    ],
  }),
  gemeinde(2, 'Kirchengemeinde Hafenstadt', {
    ...NORD, kirchenkreis_id: 20, kirchenkreis: 'Kirchenkreis Küstenland', konfi_count: 84, team_count: 17,
    leitung: [leitung(20, 'Robin Probe', 'robin.probe', 'robin@example.org', true, '2026-10-02T08:30:00Z')],
  }),
  gemeinde(3, 'Kirchengemeinde Fährdorf', {
    ...NORD, kirchenkreis_id: 21, kirchenkreis: 'Kirchenkreis Marschen', max_konfis: 50, konfi_count: 49, team_count: 8,
    trial_ends_at: '2027-03-10T12:00:00Z', wunsch_lizenz: 'plus',
    leitung: [leitung(30, 'Jules Vorlage', 'jules.vorlage', null, true, null)],
  }),
  gemeinde(4, 'Kirchengemeinde Lindenau', {
    landeskirche_id: 1, landeskirche: 'Kirche im Mittelland', kirchenkreis_id: 10, kirchenkreis: 'Kirchenkreis Hügelland',
    is_trial: true, trial_ends_at: '2026-10-12T00:00:00Z', max_konfis: 5, konfi_count: 5, team_count: 1, wunsch_lizenz: 'klein',
    leitung: [leitung(40, 'Lou Exempel', 'lou.exempel', 'lou@example.org', true, '2026-09-20T08:30:00Z')],
  }),
  gemeinde(5, 'Kirchengemeinde Testhausen', { is_active: false, konfi_count: 2, team_count: 1, leitung: [] }),
];

const antworten = (daten: unknown = GEMEINDEN) => {
  h.apiGet.mockImplementation((pfad: string) => {
    if (pfad === '/support/gemeinden') return daten instanceof Error ? Promise.reject(daten) : Promise.resolve({ data: daten });
    if (pfad === '/support/mail/zaehler') return Promise.resolve({ data: {} });
    return Promise.reject(new Error(`unerwartet: ${pfad}`));
  });
};

const zeigen = async () => {
  render(<AdminOrganizationsPage />);
  await screen.findByRole('heading', { level: 1, name: 'Gemeinden' });
  await screen.findByRole('button', { name: /Zukunftskirche/ });
};

/** Die Koepfe der Akkordeons in Dokumentreihenfolge (Landeskirchen und Kirchenkreise). */
const koepfe = () => screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-expanded'));
const zeile = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  h.apiGet.mockReset();
  h.apiDelete.mockReset();
  h.alert = null;
  h.suche = '';
  h.breit = true;
  h.modalProps = null;
  h.user = { id: 9, display_name: 'Support Eins', role_name: 'super_admin', is_super_admin: true };
  window.localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-03T08:30:00Z'));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Gemeinden (Web): Aufbau', () => {
  it('holt GET /support/gemeinden; Titel, Zahlen im Untertitel und "Neue Gemeinde"', async () => {
    antworten();
    await zeigen();
    expect(h.apiGet).toHaveBeenCalledWith('/support/gemeinden');
    expect(h.apiGet).not.toHaveBeenCalledWith('/organizations');
    expect(screen.getByText('5 Gemeinden · 178 Konfis · 36 Team')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Neue Gemeinde' })).toBeInTheDocument();
  });

  it('Landeskirchen alphabetisch, "Ohne Zuordnung" zuletzt; darin die Kirchenkreise; mit Zahlen', async () => {
    antworten();
    await zeigen();
    const k = koepfe();
    expect(k.map((b) => b.querySelector('.web-akkordeon__titel')?.textContent)).toEqual([
      'Kirche im Mittelland', 'Kirchenkreis Hügelland',
      'Zukunftskirche', 'Kirchenkreis Küstenland', 'Kirchenkreis Marschen',
      'Ohne Zuordnung',
    ]);
    expect(k[0]).toHaveTextContent('1 Gemeinde · 5 Konfis');
    expect(k[2]).toHaveTextContent('3 Gemeinden · 171 Konfis');
    expect(k[3]).toHaveTextContent('2 Gemeinden · 122 Konfis');
    expect(k[4]).toHaveTextContent('1 Gemeinde · 49 Konfis');
    expect(k[5]).toHaveTextContent('1 Gemeinde · 2 Konfis');
    // Alles offen, solange nichts gemerkt ist; die Gruppe ohne Zuordnung hat keine eigene Kirchenkreis-Ebene.
    expect(k.every((b) => b.getAttribute('aria-expanded') === 'true')).toBe(true);
    expect(screen.getAllByRole('table')).toHaveLength(4);
  });

  it('keine Ionic-Listen in der Web-Fassung', async () => {
    antworten();
    await zeigen();
    expect(document.querySelector('.app-list-item')).toBeNull();
    expect(document.querySelectorAll('table.web-tabelle')).toHaveLength(4);
  });
});

describe('Gemeinden (Web): Zeilen mit Gemeindeleitung', () => {
  it('Laufzeit, Konfis mit Limit, Team, Wunschlizenz und die Leitung direkt in der Zeile', async () => {
    antworten();
    await zeigen();
    const z = zeile('Kirchengemeinde Musterdorf');
    expect(z).toHaveTextContent('Lizenz bis 31.01.2027');
    expect(z).toHaveTextContent('38 / 50');
    expect(z).toHaveTextContent('Standard');
    // Team steht in einer eigenen Spalte.
    expect([...z.querySelectorAll('td')].map((td) => td.textContent?.replace(/\s+/g, ' ').trim())[3]).toBe('9');
    // Die erste Person: Name, Benutzername, E-Mail als mailto-Link, zuletzt angemeldet relativ.
    expect(within(z).getByText('Alex Beispiel')).toBeInTheDocument();
    expect(within(z).getByText('@alex.beispiel')).toBeInTheDocument();
    expect(within(z).getByRole('link', { name: 'alex@example.org' })).toHaveAttribute('href', 'mailto:alex@example.org');
    expect(z).toHaveTextContent('zuletzt angemeldet vor 2 Std.');
    // Die zweite: gesperrt, nie angemeldet.
    expect(within(z).getByText('Sam Muster')).toBeInTheDocument();
    expect(within(z).getByText('gesperrt')).toBeInTheDocument();
    expect(z).toHaveTextContent('noch nie angemeldet');
    expect(within(z).getAllByText('gesperrt')).toHaveLength(1);
  });

  it('ohne Limit steht nur die Zahl; ohne Ende "Unbegrenzt"; ohne Wunschlizenz ein Strich; ohne E-Mail kein Link', async () => {
    antworten();
    await zeigen();
    const hafen = zeile('Kirchengemeinde Hafenstadt');
    expect(hafen).toHaveTextContent('84');
    expect(hafen).toHaveTextContent('ohne Limit');
    expect(hafen).not.toHaveTextContent('/');
    expect(hafen).toHaveTextContent('Unbegrenzt');
    const faehrdorf = zeile('Kirchengemeinde Fährdorf');
    expect(within(faehrdorf).queryAllByRole('link', { name: /@/ })).toHaveLength(0);
    expect(faehrdorf).toHaveTextContent('Jules Vorlage');
    expect(faehrdorf).toHaveTextContent('Plus');
  });

  it('Testphase mit Datum, gesperrte Gemeinde mit Marke, Gemeinde ohne Leitung mit Hinweis', async () => {
    antworten();
    await zeigen();
    const lindenau = zeile('Kirchengemeinde Lindenau');
    expect(lindenau).toHaveTextContent('Testphase bis 12.10.');
    expect(within(lindenau).getByText('Testphase bis 12.10.')).toHaveAttribute('title', 'Testphase bis 12.10.2026, noch 9 Tage');
    const testhausen = zeile('Kirchengemeinde Testhausen');
    expect(within(testhausen).getByText('Gesperrt')).toBeInTheDocument();
    expect(testhausen).toHaveTextContent('Keine Gemeindeleitung eingetragen');
  });

  it('der Balken am Limit warnt ab 90 % und wird ab 100 % rot', async () => {
    antworten();
    await zeigen();
    const fuellung = (name: string) => zeile(name).querySelector('.web-limit__fuellung') as HTMLElement;
    expect(fuellung('Kirchengemeinde Musterdorf').className).toBe('web-limit__fuellung');
    expect(fuellung('Kirchengemeinde Musterdorf').style.width).toBe('76%');
    expect(fuellung('Kirchengemeinde Fährdorf').className).toContain('web-limit__fuellung--warnung');
    expect(fuellung('Kirchengemeinde Lindenau').className).toContain('web-limit__fuellung--fehler');
    expect(fuellung('Kirchengemeinde Lindenau').style.width).toBe('100%');
  });
});

describe('Gemeinden (Web): Aktionen direkt in der Zeile', () => {
  it('Bearbeiten oeffnet das Formular "Gemeinde" dieser Gemeinde', async () => {
    antworten();
    await zeigen();
    fireEvent.click(within(zeile('Kirchengemeinde Lindenau')).getByRole('button', { name: /bearbeiten/ }));
    expect(h.present).toHaveBeenCalledTimes(1);
    expect(h.modalProps?.organizationId).toBe(4);
  });

  it('Bearbeiten fuehrt gleich ins Formular, nicht erst in die Ansicht ("nicht erst nach Klick und Details und wieder Klick")', async () => {
    antworten();
    await zeigen();
    fireEvent.click(within(zeile('Kirchengemeinde Lindenau')).getByRole('button', { name: /bearbeiten/ }));
    expect(h.modalProps?.direktBearbeiten).toBe(true);
  });

  it('Neue Gemeinde oeffnet das Formular ohne Gemeinde', async () => {
    antworten();
    await zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Neue Gemeinde' }));
    expect(h.present).toHaveBeenCalledTimes(1);
    expect(h.modalProps?.organizationId).toBeNull();
    expect(h.modalProps?.direktBearbeiten).toBe(false);
  });

  it('Schreiben ist ein echter Link zum Schriftwechsel der Gemeinde; Klick bleibt in der App', async () => {
    antworten();
    await zeigen();
    const link = within(zeile('Kirchengemeinde Musterdorf')).getByRole('link', { name: /schreiben/ });
    expect(link).toHaveAttribute('href', '/admin/support/post/gemeinde/1');
    fireEvent.click(link);
    expect(h.push).toHaveBeenCalledWith('/admin/support/post/gemeinde/1', 'none', 'push');
  });

  it('Loeschen fragt nach; erst "Loeschen" ruft DELETE und laedt die Liste neu', async () => {
    antworten();
    h.apiDelete.mockResolvedValue({ data: { konten_geloescht: 3, konten_umgezogen: 1 } });
    await zeigen();
    fireEvent.click(within(zeile('Kirchengemeinde Musterdorf')).getByRole('button', { name: /löschen/ }));
    expect(h.alert?.header).toBe('Gemeinde löschen');
    expect(h.alert?.message).toContain('Kirchengemeinde Musterdorf');
    expect(h.apiDelete).not.toHaveBeenCalled();
    const ladenVorher = h.apiGet.mock.calls.filter(([p]) => p === '/support/gemeinden').length;
    await act(async () => { await h.alert?.buttons?.find((b) => b.role === 'destructive')?.handler?.(); });
    expect(h.apiDelete).toHaveBeenCalledWith('/organizations/1');
    expect(h.setSuccess).toHaveBeenCalledWith('Gemeinde "Kirchengemeinde Musterdorf" gelöscht: 3 Konten gelöscht, 1 Konto in eine andere Gemeinde umgezogen');
    expect(h.apiGet.mock.calls.filter(([p]) => p === '/support/gemeinden').length).toBe(ladenVorher + 1);
  });

  it('?gemeinde=<id> oeffnet das Formular dieser Gemeinde direkt (Weg aus der Uebersicht)', async () => {
    h.suche = '?gemeinde=4';
    antworten();
    await zeigen();
    expect(h.present).toHaveBeenCalledTimes(1);
    expect(h.modalProps?.organizationId).toBe(4);
    // Der Sprung aus der Uebersicht zeigt wie bisher erst die Ansicht der Gemeinde.
    expect(h.modalProps?.direktBearbeiten).toBe(false);
  });

  it('?gemeinde=<id>&bearbeiten=1 (Link "Bearbeiten" im Schriftwechsel) oeffnet das Formular gleich im Bearbeiten-Modus', async () => {
    h.suche = '?gemeinde=4&bearbeiten=1';
    antworten();
    await zeigen();
    expect(h.present).toHaveBeenCalledTimes(1);
    expect(h.modalProps?.organizationId).toBe(4);
    expect(h.modalProps?.direktBearbeiten).toBe(true);
  });

  it('jeder andere Wert von bearbeiten bleibt bei der Ansicht', async () => {
    h.suche = '?gemeinde=4&bearbeiten=0';
    antworten();
    await zeigen();
    expect(h.modalProps?.direktBearbeiten).toBe(false);
  });
});

describe('Gemeinden (Web): Live-Suche', () => {
  const suchen = (text: string) => fireEvent.change(screen.getByRole('searchbox', { name: 'Gemeinden durchsuchen' }), { target: { value: text } });

  it('die E-Mail der Gemeindeleitung findet genau diese Gemeinde und klappt ihre Gruppen auf -- auch gemerkt zugeklappte', async () => {
    window.localStorage.setItem(SCHLUESSEL_GEMEINDEN_ZU, JSON.stringify(['lk-1', 'kk-10']));
    antworten();
    await zeigen();
    // Vor der Suche sind Landeskirche und Kirchenkreis der Gemeinde Lindenau zu.
    expect(screen.queryByText('Kirchengemeinde Lindenau')).toBeNull();
    suchen('lou@example.org');
    expect(screen.getByText('Kirchengemeinde Lindenau')).toBeInTheDocument();
    expect(screen.queryByText('Kirchengemeinde Musterdorf')).toBeNull();
    expect(screen.queryByText('Kirchengemeinde Testhausen')).toBeNull();
    const k = koepfe();
    expect(k.map((b) => b.querySelector('.web-akkordeon__titel')?.textContent)).toEqual(['Kirche im Mittelland', 'Kirchenkreis Hügelland']);
    expect(k.every((b) => b.getAttribute('aria-expanded') === 'true')).toBe(true);
    // Treffer hervorgehoben, Zaehler im Kopf.
    expect([...document.querySelectorAll('mark.web-treffer')].map((m) => m.textContent)).toEqual(['lou@example.org']);
    expect(screen.getByRole('status')).toHaveTextContent('1 von 5 Gemeinden');
    // Suche leeren: der gemerkte Stand gilt wieder.
    suchen('');
    expect(screen.queryByText('Kirchengemeinde Lindenau')).toBeNull();
    expect(koepfe()[0]).toHaveAttribute('aria-expanded', 'false');
  });

  it('findet nach Benutzername, Name, Kirchenkreis und Landeskirche; Umlaute auch als ae/ue', async () => {
    antworten();
    await zeigen();
    suchen('sam.muster');
    expect(screen.getAllByRole('row')).toHaveLength(2); // Kopfzeile + Musterdorf
    expect(screen.getByText('Kirchengemeinde Musterdorf')).toBeInTheDocument();
    suchen('faehrdorf');
    expect(screen.getByText('Kirchengemeinde')).toBeInTheDocument(); // der Name ist zerlegt: "Kirchengemeinde " + <mark>Fährdorf</mark>
    expect([...document.querySelectorAll('mark.web-treffer')].map((m) => m.textContent)).toEqual(['Fährdorf']);
    suchen('Küstenland');
    expect(screen.getByText('Kirchengemeinde Musterdorf')).toBeInTheDocument();
    expect(screen.getByText('Kirchengemeinde Hafenstadt')).toBeInTheDocument();
    expect(screen.queryByText('Kirchengemeinde Lindenau')).toBeNull();
    suchen('mittelland');
    expect(screen.getByText('Kirchengemeinde Lindenau')).toBeInTheDocument();
    expect(screen.queryByText('Kirchengemeinde Musterdorf')).toBeNull();
  });

  it('ohne Treffer: "Keine Treffer" mit dem Suchwort; "Suche leeren" bringt alles zurueck', async () => {
    antworten();
    await zeigen();
    suchen('zzz');
    expect(screen.getByText('Keine Treffer')).toBeInTheDocument();
    expect(screen.getByText(/Zu „zzz“ gibt es keine Gemeinde/)).toBeInTheDocument();
    expect(screen.queryAllByRole('table')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Suche leeren' }));
    expect(screen.queryByText('Keine Treffer')).toBeNull();
    expect(screen.getAllByRole('table')).toHaveLength(4);
    expect(screen.getByRole('searchbox', { name: 'Gemeinden durchsuchen' })).toHaveValue('');
  });

  it('waehrend der Suche laesst sich eine Gruppe zuklappen -- ohne den gemerkten Stand zu veraendern', async () => {
    antworten();
    await zeigen();
    suchen('muster');
    const nord = koepfe().find((b) => b.textContent?.includes('Zukunftskirche'))!;
    expect(nord).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(nord);
    expect(koepfe().find((b) => b.textContent?.includes('Zukunftskirche'))).toHaveAttribute('aria-expanded', 'false');
    expect(window.localStorage.getItem(SCHLUESSEL_GEMEINDEN_ZU)).toBeNull();
    suchen('');
    expect(koepfe().find((b) => b.textContent?.includes('Zukunftskirche'))).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('Gemeinden (Web): Aufklappen und Merken', () => {
  it('Alle zuklappen und Alle aufklappen -- der Stand wird im Browser gemerkt', async () => {
    antworten();
    await zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Alle zuklappen' }));
    expect(koepfe().every((b) => b.getAttribute('aria-expanded') === 'false')).toBe(true);
    expect(screen.queryAllByRole('table')).toHaveLength(0);
    expect(JSON.parse(window.localStorage.getItem(SCHLUESSEL_GEMEINDEN_ZU) ?? 'null').sort()).toEqual(['kk-10', 'kk-20', 'kk-21', 'lk-1', 'lk-2', 'lk-ohne']);
    fireEvent.click(screen.getByRole('button', { name: 'Alle aufklappen' }));
    expect(koepfe().every((b) => b.getAttribute('aria-expanded') === 'true')).toBe(true);
    expect(window.localStorage.getItem(SCHLUESSEL_GEMEINDEN_ZU)).toBe('[]');
  });

  it('eine gemerkte zugeklappte Gruppe bleibt zu, die uebrigen stehen offen; ein Klick klappt sie auf und merkt es', async () => {
    window.localStorage.setItem(SCHLUESSEL_GEMEINDEN_ZU, JSON.stringify(['lk-2']));
    antworten();
    await zeigen();
    const nord = () => koepfe().find((b) => b.textContent?.includes('Zukunftskirche'))!;
    expect(nord()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Kirchengemeinde Musterdorf')).toBeNull();
    expect(screen.getByText('Kirchengemeinde Lindenau')).toBeInTheDocument();
    expect(nord().getAttribute('aria-controls')).toBe(document.getElementById(nord().getAttribute('aria-controls')!)?.id);
    fireEvent.click(nord());
    expect(nord()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Kirchengemeinde Musterdorf')).toBeInTheDocument();
    expect(window.localStorage.getItem(SCHLUESSEL_GEMEINDEN_ZU)).toBe('[]');
  });

  it('ein defekter oder unlesbarer Speicher: alles steht offen, die Seite geht trotzdem', async () => {
    window.localStorage.setItem(SCHLUESSEL_GEMEINDEN_ZU, '{kaputt');
    antworten();
    await zeigen();
    expect(koepfe().every((b) => b.getAttribute('aria-expanded') === 'true')).toBe(true);
  });

  it('ohne Zugriff auf localStorage (privates Fenster): offen, bedienbar, kein Absturz', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('gesperrt'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('gesperrt'); });
    antworten();
    await zeigen();
    expect(koepfe().every((b) => b.getAttribute('aria-expanded') === 'true')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Alle zuklappen' }));
    expect(koepfe().every((b) => b.getAttribute('aria-expanded') === 'false')).toBe(true);
  });
});

describe('Gemeinden (Web): Laden, Fehler, leer', () => {
  it('Fehler: Hinweis mit erneutem Versuch, der wirklich neu laedt', async () => {
    antworten(new Error('Netz weg'));
    render(<AdminOrganizationsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Gemeinden konnten nicht geladen werden.');
    antworten();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' })); });
    expect(await screen.findByRole('button', { name: /Zukunftskirche/ })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('ohne Gemeinden: eigener Hinweis mit "Neue Gemeinde"', async () => {
    antworten([]);
    render(<AdminOrganizationsPage />);
    expect(await screen.findByText('Noch keine Gemeinden')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Neue Gemeinde' }).length).toBeGreaterThan(0);
  });
});

describe('Gemeinden: zwei Gesichter, eine Seite', () => {
  it('im schmalen Fenster bleibt die Liste der App -- ohne Abruf der neuen Route', async () => {
    h.breit = false;
    antworten();
    render(<AdminOrganizationsPage />);
    expect(await screen.findByLabelText('Gemeinde suchen')).toBeInTheDocument();
    expect(screen.getByText('Büsum')).toBeInTheDocument();
    expect(h.apiGet).not.toHaveBeenCalledWith('/support/gemeinden');
    expect(document.querySelector('.web-seite')).toBeNull();
  });

  it('breit, aber ohne Super-Admin-Recht (Leitung per Adresse): die Liste der App, kein 403 der neuen Route', async () => {
    h.user = { id: 5, display_name: 'Leitung', role_name: 'org_admin' };
    antworten();
    render(<AdminOrganizationsPage />);
    expect(await screen.findByLabelText('Gemeinde suchen')).toBeInTheDocument();
    expect(h.apiGet).not.toHaveBeenCalledWith('/support/gemeinden');
  });
});
