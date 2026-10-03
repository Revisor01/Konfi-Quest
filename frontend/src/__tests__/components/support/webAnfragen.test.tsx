// Anfragen in der Web-Fassung, gerendert (docs/planung/support-web.md,
// Entscheidung 1): Tabelle mit Filter-Chips (Zahl je Status), Live-Suche und
// den Spalten Eingang, Gemeinde, Kontakt, Kirchenkreis, Wunschlizenz, Status,
// ungelesene Mails. Im schmalen Fenster bleibt die Liste der App.
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  push: vi.fn(),
  breit: true,
  user: { id: 9, display_name: 'Support Eins', role_name: 'super_admin', is_super_admin: true } as Record<string, unknown>,
  standort: { pathname: '/admin/support/anfragen', search: '', state: null } as { pathname: string; search: string; state: null },
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
vi.mock('../../../navigation/useAppLocation', () => ({ useAppLocation: () => h.standort }));

import SupportAnfragenPage from '../../../components/support/SupportAnfragenPage';

let vorherTZ: string | undefined;
beforeAll(() => { vorherTZ = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherTZ === undefined) delete process.env.TZ; else process.env.TZ = vorherTZ; });

const anfrage = (id: number, gemeinde: string, status: string, erstellt: string, extra: Record<string, unknown> = {}) => ({
  id, gemeinde, status, kirchenkreis: 'Kirchenkreis Küstenland', landeskirche: 'Nordlandkirche', kontakt_name: 'Anna Beispiel',
  funktion: 'Pastorin', email: `kontakt${id}@example.org`, mobil: null, anzahl_konfis: 25, anzahl_teamer: 6,
  nachricht: null, notiz: null, organization_id: null, created_at: erstellt, updated_at: erstellt, wunsch_lizenz: null, ungelesen: 0,
  ...extra,
});

const ANFRAGEN = [
  anfrage(41, 'Kirchengemeinde Musterdorf-Süd', 'neu', '2026-10-03T06:55:00Z', { kontakt_name: 'Lena Probe', wunsch_lizenz: 'standard', ungelesen: 2 }),
  anfrage(40, 'Kirchengemeinde Wiesengrund', 'neu', '2026-10-02T12:30:00Z', { kontakt_name: 'Jan Vorlage', funktion: null, wunsch_lizenz: 'klein', kirchenkreis: 'Kirchenkreis Flusstal', landeskirche: 'Kirche im Mittelland' }),
  anfrage(39, 'Kirchengemeinde Steinbach', 'in_arbeit', '2026-10-01T08:30:00Z', { kontakt_name: 'Miriam Demo', wunsch_lizenz: 'plus' }),
  anfrage(36, 'Kirchengemeinde Kirchbach', 'angelegt', '2026-09-14T08:30:00Z', { kontakt_name: 'Sascha Beispiel', organization_id: 13 }),
  anfrage(34, 'Jugendwerk Beispielstadt', 'abgelehnt', '2026-09-03T08:30:00Z', { kontakt_name: 'Ole Entwurf', kirchenkreis: null, landeskirche: null }),
];

const antworten = (daten: unknown = ANFRAGEN) => {
  h.apiGet.mockImplementation((pfad: string) => {
    if (pfad === '/support/anfragen') return daten instanceof Error ? Promise.reject(daten) : Promise.resolve({ data: daten });
    if (pfad === '/support/mail/zaehler') return Promise.resolve({ data: {} });
    return Promise.reject(new Error(`unerwartet: ${pfad}`));
  });
};

const zeigen = async () => {
  render(<SupportAnfragenPage />);
  await screen.findByRole('table', { name: 'Anfragen' });
};
const zeilen = () => within(screen.getByRole('table', { name: 'Anfragen' })).getAllByRole('row').slice(1);
const spalte = (zeile: HTMLElement, i: number) => within(zeile).getAllByRole('cell')[i];
const chip = (name: RegExp | string) => screen.getByRole('button', { name });
const suchen = (text: string) => fireEvent.change(screen.getByRole('searchbox', { name: 'Anfragen durchsuchen' }), { target: { value: text } });

beforeEach(() => {
  vi.clearAllMocks();
  h.apiGet.mockReset();
  h.breit = true;
  h.standort = { pathname: '/admin/support/anfragen', search: '', state: null };
  h.user = { id: 9, display_name: 'Support Eins', role_name: 'super_admin', is_super_admin: true };
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-03T08:30:00Z'));
});
afterEach(() => { vi.useRealTimers(); });

describe('Anfragen (Web): Tabelle', () => {
  it('holt alle Anfragen einmal (ohne Status) und zeigt je Anfrage eine Zeile, neueste zuerst', async () => {
    antworten();
    await zeigen();
    expect(h.apiGet).toHaveBeenCalledWith('/support/anfragen');
    expect(h.apiGet.mock.calls.filter(([p]) => p === '/support/anfragen')).toHaveLength(1);
    expect(zeilen()).toHaveLength(5);
    expect(zeilen().map((z) => within(spalte(z, 1)).getByRole('link').getAttribute('href'))).toEqual([
      '/admin/support/anfragen/41', '/admin/support/anfragen/40', '/admin/support/anfragen/39', '/admin/support/anfragen/36', '/admin/support/anfragen/34',
    ]);
    expect(screen.getByRole('heading', { level: 1, name: 'Anfragen' })).toBeInTheDocument();
  });

  it('die Spalten: Eingang relativ und mit Datum, Gemeinde, Kontakt mit Funktion und E-Mail, Kirchenkreis und Landeskirche, Wunschlizenz, Status', async () => {
    antworten();
    await zeigen();
    const [erste, zweite, , , letzte] = zeilen();
    expect(spalte(erste, 0)).toHaveTextContent('vor 1 Std.');
    expect(spalte(erste, 0)).toHaveTextContent('03.10., 08:55');
    expect(spalte(erste, 1)).toHaveTextContent('Kirchengemeinde Musterdorf-Süd');
    expect(spalte(erste, 2)).toHaveTextContent('Lena Probe (Pastorin)');
    expect(within(spalte(erste, 2)).getByRole('link', { name: 'kontakt41@example.org' })).toHaveAttribute('href', 'mailto:kontakt41@example.org');
    expect(spalte(erste, 3)).toHaveTextContent('Kirchenkreis Küstenland');
    expect(spalte(erste, 3)).toHaveTextContent('Nordlandkirche');
    expect(spalte(erste, 4)).toHaveTextContent('Standard');
    expect(spalte(erste, 5)).toHaveTextContent('Neu');
    expect(spalte(zweite, 2)).toHaveTextContent('Jan Vorlage');
    expect(spalte(zweite, 2)).not.toHaveTextContent('(');
    expect(spalte(zweite, 4)).toHaveTextContent('Klein');
    // Ohne Zuordnung und Wunschlizenz stehen Striche; abgelehnt hat seinen Status.
    expect(spalte(letzte, 3)).toHaveTextContent('–');
    expect(spalte(letzte, 4)).toHaveTextContent('–');
    expect(spalte(letzte, 5)).toHaveTextContent('Abgelehnt');
    expect(zeilen().map((z) => spalte(z, 5).textContent)).toEqual(['Neu', 'Neu', 'In Arbeit', 'Angelegt', 'Abgelehnt']);
  });

  it('ungelesene Mails: rote Zahl in der Spalte und fett in der Zeile, gelesene mit Strich', async () => {
    antworten();
    await zeigen();
    const [erste, zweite] = zeilen();
    const zahl = spalte(erste, 6).querySelector('.web-chip__zahl--rot') as HTMLElement;
    expect(zahl).toHaveTextContent('2');
    expect(spalte(zweite, 6)).toHaveTextContent('–');
    expect(erste.classList.contains('web-zeile--ungelesen')).toBe(true);
    expect(zweite.classList.contains('web-zeile--ungelesen')).toBe(false);
    expect(within(spalte(erste, 1)).getByRole('link')).toHaveAccessibleName('Kirchengemeinde Musterdorf-Süd, 2 ungelesene Mails');
  });

  it('die Zeile oeffnet die Anfrage: echter Link, Klick bleibt in der App', async () => {
    antworten();
    await zeigen();
    const link = within(spalte(zeilen()[2], 1)).getByRole('link');
    expect(link.className).toContain('web-link--zeile');
    fireEvent.click(link);
    expect(h.push).toHaveBeenCalledWith('/admin/support/anfragen/39', 'none', 'push');
  });
});

describe('Anfragen (Web): Chips und Suche', () => {
  it('Zahl je Status an den Chips; Alle ist voreingestellt', async () => {
    antworten();
    await zeigen();
    expect(chip(/^Alle/)).toHaveAttribute('aria-pressed', 'true');
    const zahlen = ['Alle', 'Offen', 'Neu', 'In Arbeit', 'Angelegt', 'Abgelehnt', 'Ungelesen'].map((n) => chip(new RegExp(`^${n}`)).textContent);
    expect(zahlen).toEqual(['Alle5', 'Offen3 neu oder in Arbeit', 'Neu2', 'In Arbeit1', 'Angelegt1', 'Abgelehnt1', 'Ungelesen1 mit ungelesenen Mails']);
    expect((chip(/^Ungelesen/).querySelector('.web-chip__zahl') as HTMLElement).className).toContain('web-chip__zahl--rot');
    expect((chip(/^Neu/).querySelector('.web-chip__zahl') as HTMLElement).className).not.toContain('web-chip__zahl--rot');
  });

  it('der Filter zeigt nur den Status; Ungelesen zeigt Anfragen mit ungelesenen Mails gleich welchen Status', async () => {
    antworten();
    await zeigen();
    fireEvent.click(chip(/^Neu/));
    expect(zeilen()).toHaveLength(2);
    fireEvent.click(chip(/^In Arbeit/));
    expect(zeilen().map((z) => spalte(z, 1).textContent)).toEqual(['Kirchengemeinde Steinbach']);
    fireEvent.click(chip(/^Angelegt/));
    expect(zeilen().map((z) => spalte(z, 1).textContent)).toEqual(['Kirchengemeinde Kirchbach']);
    fireEvent.click(chip(/^Ungelesen/));
    expect(zeilen().map((z) => spalte(z, 1).textContent)).toEqual(['Kirchengemeinde Musterdorf-Süd, 2 ungelesene Mails']);
    fireEvent.click(chip(/^Alle/));
    expect(zeilen()).toHaveLength(5);
    expect(h.apiGet.mock.calls.filter(([p]) => p === '/support/anfragen')).toHaveLength(1);
  });

  it('Offen zeigt Neu und In Arbeit zusammen, nicht Angelegt und Abgelehnt', async () => {
    antworten();
    await zeigen();
    fireEvent.click(chip(/^Offen/));
    expect(chip(/^Offen/)).toHaveAttribute('aria-pressed', 'true');
    expect(zeilen().map((z) => spalte(z, 5).textContent)).toEqual(['Neu', 'Neu', 'In Arbeit']);
    expect(screen.getByText('5 Anfragen aus dem Formular auf der Startseite · 3 in dieser Auswahl')).toBeInTheDocument();
  });

  it('Offen ohne wartende Anfragen: eigener Hinweis', async () => {
    antworten(ANFRAGEN.filter((a) => a.status === 'angelegt' || a.status === 'abgelehnt'));
    await zeigen();
    fireEvent.click(chip(/^Offen/));
    expect(screen.getByText('Keine Anfrage wartet auf Bearbeitung.')).toBeInTheDocument();
  });

  it('die Suche findet nach Gemeinde, Kontakt, E-Mail und Kirchenkreis, mit Umlauten, und hebt Treffer hervor', async () => {
    antworten();
    await zeigen();
    suchen('buesum');
    expect(screen.getByText('Keine Treffer')).toBeInTheDocument();
    suchen('süd');
    expect(zeilen()).toHaveLength(1);
    expect([...document.querySelectorAll('mark.web-treffer')].map((m) => m.textContent)).toEqual(['Süd']);
    suchen('jan vorlage');
    expect(zeilen().map((z) => spalte(z, 1).textContent)).toEqual(['Kirchengemeinde Wiesengrund']);
    suchen('kontakt39@');
    expect(zeilen().map((z) => spalte(z, 1).textContent)).toEqual(['Kirchengemeinde Steinbach']);
    suchen('FLUSSTAL');
    expect(zeilen().map((z) => spalte(z, 1).textContent)).toEqual(['Kirchengemeinde Wiesengrund']);
    expect(screen.getByText('5 Anfragen aus dem Formular auf der Startseite · 1 in dieser Auswahl')).toBeInTheDocument();
  });

  it('Suche und Filter wirken zusammen; ohne Treffer fuehrt "Suche leeren" zurueck', async () => {
    antworten();
    await zeigen();
    fireEvent.click(chip(/^Angelegt/));
    suchen('wiesengrund');
    expect(screen.getByText('Keine Treffer')).toBeInTheDocument();
    expect(screen.getByText(/Zu „wiesengrund“ gibt es in dieser Auswahl keine Anfrage\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Suche leeren' }));
    expect(zeilen()).toHaveLength(1);
  });

  it('ein Filter ohne Anfragen: eigener Hinweis', async () => {
    antworten(ANFRAGEN.filter((a) => a.status !== 'abgelehnt'));
    await zeigen();
    fireEvent.click(chip(/^Abgelehnt/));
    expect(screen.getByText('Keine abgelehnten Anfragen.')).toBeInTheDocument();
  });
});

describe('Anfragen (Web): Reihenfolge', () => {
  const ids = () => zeilen().map((z) => within(spalte(z, 1)).getByRole('link').getAttribute('href')!.split('/').pop());

  it('neueste zuerst, auch wenn der Server sie durcheinander liefert', async () => {
    antworten([ANFRAGEN[3], ANFRAGEN[0], ANFRAGEN[4], ANFRAGEN[2], ANFRAGEN[1]]);
    await zeigen();
    expect(ids()).toEqual(['41', '40', '39', '36', '34']);
  });

  it('die Reihenfolge gilt auch in einem Filter', async () => {
    antworten([ANFRAGEN[2], ANFRAGEN[1], ANFRAGEN[0]]);
    await zeigen();
    fireEvent.click(chip(/^Offen/));
    expect(ids()).toEqual(['41', '40', '39']);
  });

  it('bei gleichem Eingang entscheidet die hoehere Kennung', async () => {
    antworten([
      anfrage(20, 'Gemeinde A', 'neu', '2026-10-01T08:30:00Z'),
      anfrage(22, 'Gemeinde C', 'neu', '2026-10-01T08:30:00Z'),
      anfrage(21, 'Gemeinde B', 'neu', '2026-10-01T08:30:00Z'),
    ]);
    await zeigen();
    expect(ids()).toEqual(['22', '21', '20']);
  });
});

describe('Anfragen (Web): Filter aus der Adresse', () => {
  const eingestellt = () => ['Alle', 'Offen', 'Neu', 'In Arbeit', 'Angelegt', 'Abgelehnt', 'Ungelesen']
    .filter((n) => chip(new RegExp(`^${n}`)).getAttribute('aria-pressed') === 'true');

  it('?filter=offen stellt Offen ein -- so fuehrt die Kachel der Uebersicht auf die offenen Anfragen', async () => {
    h.standort = { pathname: '/admin/support/anfragen', search: '?filter=offen', state: null };
    antworten();
    await zeigen();
    expect(eingestellt()).toEqual(['Offen']);
    expect(zeilen()).toHaveLength(3);
  });

  it('jeder Filter ist ueber die Adresse einstellbar', async () => {
    for (const [wert, name, zeilenZahl] of [['neu', 'Neu', 2], ['in_arbeit', 'In Arbeit', 1], ['angelegt', 'Angelegt', 1], ['abgelehnt', 'Abgelehnt', 1], ['ungelesen', 'Ungelesen', 1], ['alle', 'Alle', 5]] as const) {
      h.standort = { pathname: '/admin/support/anfragen', search: `?filter=${wert}`, state: null };
      antworten();
      const { unmount } = render(<SupportAnfragenPage />);
      await screen.findByRole('table', { name: 'Anfragen' });
      expect(eingestellt()).toEqual([name]);
      expect(zeilen()).toHaveLength(zeilenZahl);
      unmount();
    }
  });

  it('ein unbekannter Wert oder keiner: Alle', async () => {
    h.standort = { pathname: '/admin/support/anfragen', search: '?filter=blau', state: null };
    antworten();
    await zeigen();
    expect(eingestellt()).toEqual(['Alle']);
  });

  it('eine neue Adresse bei offener Seite stellt den Filter um; ein Chip danach gilt', async () => {
    antworten();
    const { rerender } = render(<SupportAnfragenPage />);
    await screen.findByRole('table', { name: 'Anfragen' });
    expect(eingestellt()).toEqual(['Alle']);
    h.standort = { pathname: '/admin/support/anfragen', search: '?filter=offen', state: null };
    rerender(<SupportAnfragenPage />);
    expect(eingestellt()).toEqual(['Offen']);
    fireEvent.click(chip(/^Neu/));
    expect(eingestellt()).toEqual(['Neu']);
    rerender(<SupportAnfragenPage />);
    expect(eingestellt()).toEqual(['Neu']);
  });

  it('auf einer anderen Seite (Ionic haelt die Anfragen noch kurz) ruehrt die Adresse den Filter nicht an', async () => {
    antworten();
    const { rerender } = render(<SupportAnfragenPage />);
    await screen.findByRole('table', { name: 'Anfragen' });
    h.standort = { pathname: '/admin/support/post', search: '?filter=offen', state: null };
    rerender(<SupportAnfragenPage />);
    expect(eingestellt()).toEqual(['Alle']);
  });
});

describe('Anfragen (Web): Laden, Fehler, leer', () => {
  it('Fehler: Hinweis mit erneutem Versuch, der wirklich neu laedt', async () => {
    antworten(new Error('Netz weg'));
    render(<SupportAnfragenPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Anfragen konnten nicht geladen werden.');
    antworten();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' })); });
    expect(await screen.findByRole('table', { name: 'Anfragen' })).toBeInTheDocument();
  });

  it('noch keine Anfragen: eigener Hinweis', async () => {
    antworten([]);
    render(<SupportAnfragenPage />);
    expect(await screen.findByText('Noch keine Anfragen über die Startseite.')).toBeInTheDocument();
  });

  it('eine Antwort in unbekannter Form ist ein Fehler, kein Absturz', async () => {
    antworten({ irgendwas: true });
    render(<SupportAnfragenPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Anfragen konnten nicht geladen werden.');
  });
});

describe('Anfragen: zwei Gesichter, eine Seite', () => {
  it('im schmalen Fenster bleibt die App-Darstellung -- mit dem alten Abruf nach Status', async () => {
    h.breit = false;
    antworten();
    render(<SupportAnfragenPage />);
    expect(await screen.findByRole('tab', { name: 'Neu' })).toHaveAttribute('aria-selected', 'true');
    expect(h.apiGet).toHaveBeenCalledWith('/support/anfragen', { params: { status: 'neu' } });
    expect(document.querySelector('.web-seite')).toBeNull();
  });

  it('ohne Super-Admin-Recht: Hinweis, kein Abruf', () => {
    h.user = { id: 5, display_name: 'Leitung', role_name: 'org_admin' };
    antworten();
    render(<SupportAnfragenPage />);
    expect(screen.getByText('Nur für den Support')).toBeInTheDocument();
    expect(h.apiGet).not.toHaveBeenCalledWith('/support/anfragen', expect.anything());
    expect(h.apiGet).not.toHaveBeenCalledWith('/support/anfragen');
  });
});
