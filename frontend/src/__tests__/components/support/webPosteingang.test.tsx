// Posteingang in der Web-Fassung, gerendert (docs/planung/support-web.md,
// Entscheidung 10): wie ein Mailprogramm -- ALLE eingehenden Mails
// (?zuordnung=alle), Filter Alle, Ungelesen, Nicht zugeordnet (mit roter Zahl),
// moin@ und support@, Spalte "Zugeordnet" mit Link zur Anfrage bzw. zum Schriftwechsel,
// oben der Zustand der Postfaecher. Im schmalen Fenster bleibt der
// Posteingang der App.
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  push: vi.fn(),
  breit: true,
  user: { id: 9, display_name: 'Support Eins', role_name: 'super_admin', is_super_admin: true } as Record<string, unknown>,
  standort: { pathname: '/admin/support/post', search: '', state: null } as { pathname: string; search: string; state: null },
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

import SupportPosteingangPage from '../../../components/support/SupportPosteingangPage';
import { supportMailZaehlerZuruecksetzen } from '../../../navigation/supportMailZaehler';

let vorherTZ: string | undefined;
beforeAll(() => { vorherTZ = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherTZ === undefined) delete process.env.TZ; else process.env.TZ = vorherTZ; });

const mail = (id: number, postfach: 'moin' | 'support', von: string | null, adresse: string, betreff: string, auszug: string, gesendet: string, gelesen: boolean, zu: Record<string, unknown> = {}) => ({
  id, postfach, von_name: von, von_adresse: adresse, betreff, auszug, gesendet_am: gesendet, gelesen_am: gelesen ? '2026-10-03T00:00:00Z' : null, anhaenge: [],
  anfrage_id: null, organization_id: null, gemeinde_name: null, ...zu,
});

const EINGANG = [
  mail(301, 'moin', 'Pastorin Lena Probe', 'lena.probe@example.org', 'Re: Eure Anfrage bei Konfi Quest [Anfrage 41]', 'Vielen Dank für die schnelle Rückmeldung!', '2026-10-03T08:18:00Z', false, { anfrage_id: 41, gemeinde_name: 'Kirchengemeinde Musterdorf-Süd' }),
  mail(302, 'support', 'Sam Muster', 'sam@example.org', 'Frage zu den Jahrgängen', 'Guten Morgen, wir möchten den neuen Jahrgang anlegen.', '2026-10-03T07:35:00Z', false, { organization_id: 1, gemeinde_name: 'Kirchengemeinde Musterdorf' }),
  mail(303, 'support', null, 'info@beispiel-verein.example', 'Passwort vergessen?', 'Hallo, ich komme nicht mehr in die App.', '2026-10-03T03:30:00Z', false),
  mail(304, 'moin', 'Jan Vorlage', 'jan.vorlage@example.org', 'Rückfrage zur Lizenz', 'Könnten Sie uns ein Angebot senden?', '2026-10-02T10:30:00Z', true, { anfrage_id: 40, gemeinde_name: 'Kirchengemeinde Wiesengrund', anhaenge: [{ name: 'angebot.pdf' }, { name: 'logo.png' }] }),
  mail(305, 'moin', 'Presseverteiler', 'presse@beispiel-medien.example', 'Pressemitteilung', 'Sehr geehrte Damen und Herren', '2026-09-28T10:30:00Z', true),
];

const STATUS = {
  postfaecher: [
    { postfach: 'moin', adresse: 'moin@konfi-quest.example', eingerichtet: true, abgeholt_am: '2026-10-03T08:29:00Z', fehler: null, fehler_am: null, auf_diesem_server: true },
    { postfach: 'support', adresse: 'support@konfi-quest.example', eingerichtet: true, abgeholt_am: '2026-10-03T08:29:00Z', fehler: null, fehler_am: null, auf_diesem_server: true },
  ],
};

const ZAEHLER = { anfragen: 1, gemeinden: 1, eingang: 1, je_anfrage: { 41: 1 }, je_gemeinde: { 1: 1 } };

const antworten = (opt: { eingang?: unknown; status?: unknown; zaehler?: unknown } = {}) => {
  const eingang = 'eingang' in opt ? opt.eingang : EINGANG;
  const status = 'status' in opt ? opt.status : STATUS;
  const zaehler = 'zaehler' in opt ? opt.zaehler : ZAEHLER;
  h.apiGet.mockImplementation((pfad: string) => {
    if (pfad === '/support/mail/eingang') return eingang instanceof Error ? Promise.reject(eingang) : Promise.resolve({ data: eingang });
    if (pfad === '/support/mail/status') return status instanceof Error ? Promise.reject(status) : Promise.resolve({ data: status });
    if (pfad === '/support/mail/zaehler') return Promise.resolve({ data: zaehler });
    if (pfad === '/organizations') return Promise.resolve({ data: [] });
    return Promise.reject(new Error(`unerwartet: ${pfad}`));
  });
};

const zeigen = async () => {
  render(<SupportPosteingangPage />);
  await screen.findByRole('table', { name: 'Eingehende Mails' });
};
const dataZeilen = () => within(screen.getByRole('table', { name: 'Eingehende Mails' })).getAllByRole('row').slice(1);
const chip = (name: RegExp | string) => screen.getByRole('button', { name });

beforeEach(() => {
  vi.clearAllMocks();
  h.apiGet.mockReset();
  h.breit = true;
  h.standort = { pathname: '/admin/support/post', search: '', state: null };
  h.user = { id: 9, display_name: 'Support Eins', role_name: 'super_admin', is_super_admin: true };
  supportMailZaehlerZuruecksetzen();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-03T08:30:00Z'));
});
afterEach(() => { vi.useRealTimers(); });

describe('Posteingang (Web): was geladen wird', () => {
  it('ruft den Eingang mit zuordnung=alle und den Zustand der Postfaecher ab -- nicht mit postfach=', async () => {
    antworten();
    await zeigen();
    expect(h.apiGet).toHaveBeenCalledWith('/support/mail/eingang', { params: { zuordnung: 'alle' } });
    expect(h.apiGet).toHaveBeenCalledWith('/support/mail/status');
    expect(h.apiGet.mock.calls.filter(([p]) => p === '/support/mail/eingang')).toHaveLength(1);
  });

  it('der Filter wechselt ohne neuen Abruf -- die Zahlen aller Chips stehen aus einer Antwort da', async () => {
    antworten();
    await zeigen();
    fireEvent.click(chip(/^moin@/));
    fireEvent.click(chip(/^support@/));
    expect(h.apiGet.mock.calls.filter(([p]) => p === '/support/mail/eingang')).toHaveLength(1);
  });
});

describe('Posteingang (Web): Tabelle', () => {
  it('eine Zeile je Mail, neueste zuerst; Postfach, Von, Betreff mit Auszug, Zugeordnet, Datum', async () => {
    antworten();
    await zeigen();
    const zeilen = dataZeilen();
    expect(zeilen).toHaveLength(5);
    expect(zeilen.map((z) => within(z).getAllByRole('cell')[1].textContent)).toEqual(['moin@', 'support@', 'support@', 'moin@', 'moin@']);
    const erste = within(zeilen[0]).getAllByRole('cell');
    expect(erste[2]).toHaveTextContent('Pastorin Lena Probe');
    expect(erste[2]).toHaveTextContent('lena.probe@example.org');
    expect(erste[3]).toHaveTextContent('Re: Eure Anfrage bei Konfi Quest [Anfrage 41]');
    expect(erste[3]).toHaveTextContent('Vielen Dank für die schnelle Rückmeldung!');
    expect(erste[5]).toHaveTextContent('vor 12 Min.');
    // Ohne Namen steht die Adresse allein; ein Datum ab zwei Tagen als Datum.
    expect(within(zeilen[2]).getAllByRole('cell')[2]).toHaveTextContent('info@beispiel-verein.example');
    expect(within(zeilen[4]).getAllByRole('cell')[5]).toHaveTextContent('28.09.2026');
    // Anhaenge stehen vor dem Auszug.
    expect(within(zeilen[3]).getAllByRole('cell')[3]).toHaveTextContent('2 Anhänge');
  });

  it('Zugeordnet: Link zur Anfrage bzw. zum Schriftwechsel der Gemeinde, sonst ein Strich', async () => {
    antworten();
    await zeigen();
    const zeilen = dataZeilen();
    const ziel = (i: number) => within(zeilen[i]).getAllByRole('cell')[4];
    expect(within(ziel(0)).getByRole('link', { name: 'Kirchengemeinde Musterdorf-Süd' })).toHaveAttribute('href', '/admin/support/anfragen/41');
    expect(within(ziel(1)).getByRole('link', { name: 'Kirchengemeinde Musterdorf' })).toHaveAttribute('href', '/admin/support/post/gemeinde/1');
    expect(within(ziel(3)).getByRole('link')).toHaveAttribute('href', '/admin/support/anfragen/40');
    expect(ziel(2)).toHaveTextContent('—');
    expect(within(ziel(2)).queryByRole('link')).toBeNull();
  });

  it('ungelesene Mails tragen einen Punkt und stehen fett; gelesene nicht', async () => {
    antworten();
    await zeigen();
    const zeilen = dataZeilen();
    expect(zeilen.map((z) => within(z).queryByRole('img', { name: 'ungelesen' }) !== null)).toEqual([true, true, true, false, false]);
    expect(zeilen.map((z) => z.classList.contains('web-zeile--ungelesen'))).toEqual([true, true, true, false, false]);
    expect(within(zeilen[0]).getByRole('link', { name: /Re: Eure Anfrage/ }).className).toContain('web-ungelesen');
    expect(within(zeilen[3]).getByRole('link', { name: 'Rückfrage zur Lizenz' }).className).not.toContain('web-ungelesen');
  });

  it('die Zeile oeffnet die Mail: ein echter Link auf der ganzen Zeile, Klick bleibt in der App', async () => {
    antworten();
    await zeigen();
    const link = within(dataZeilen()[1]).getByRole('link', { name: 'Frage zu den Jahrgängen' });
    expect(link).toHaveAttribute('href', '/admin/support/post/302');
    expect(link.className).toContain('web-link--zeile');
    fireEvent.click(link);
    expect(h.push).toHaveBeenCalledWith('/admin/support/post/302', 'none', 'push');
  });
});

describe('Posteingang (Web): Filter-Chips', () => {
  it('Alle ist voreingestellt und zaehlt alle; moin@ und support@ zaehlen je Postfach', async () => {
    antworten();
    await zeigen();
    expect(chip(/^Alle/)).toHaveAttribute('aria-pressed', 'true');
    expect(chip(/^Alle/)).toHaveTextContent('5');
    expect(chip(/^moin@/)).toHaveTextContent('3');
    expect(chip(/^support@/)).toHaveTextContent('2');
  });

  it('"Nicht zugeordnet" traegt die rote Zahl der ungelesenen nicht zugeordneten Mails -- aus demselben Zaehler wie die Leiste', async () => {
    antworten({ zaehler: { anfragen: 4, gemeinden: 2, eingang: 7, je_anfrage: {}, je_gemeinde: {} } });
    await zeigen();
    // Die Zahl 7 kommt aus /support/mail/zaehler (eingang), nicht aus der Liste (dort waere es 1).
    await vi.waitFor(() => expect(chip(/^Nicht zugeordnet/)).toHaveTextContent('7'));
    const zahl = chip(/^Nicht zugeordnet/).querySelector('.web-chip__zahl') as HTMLElement;
    expect(zahl.className).toContain('web-chip__zahl--rot');
    expect(zahl).toHaveTextContent('7 ungelesen');
  });

  it('ohne ungelesene nicht zugeordnete Mails steht keine Zahl am Chip', async () => {
    antworten({ zaehler: { anfragen: 0, gemeinden: 0, eingang: 0, je_anfrage: {}, je_gemeinde: {} } });
    await zeigen();
    await vi.waitFor(() => expect(h.apiGet).toHaveBeenCalledWith('/support/mail/zaehler'));
    expect(chip(/^Nicht zugeordnet/).querySelector('.web-chip__zahl')).toBeNull();
  });

  it('Nicht zugeordnet zeigt nur Mails ohne Anfrage und ohne Gemeinde; moin@ und support@ je Postfach', async () => {
    antworten();
    await zeigen();
    fireEvent.click(chip(/^Nicht zugeordnet/));
    expect(chip(/^Nicht zugeordnet/)).toHaveAttribute('aria-pressed', 'true');
    expect(chip(/^Alle/)).toHaveAttribute('aria-pressed', 'false');
    expect(dataZeilen().map((z) => within(z).getAllByRole('cell')[3].textContent)).toEqual([
      expect.stringContaining('Passwort vergessen?'), expect.stringContaining('Pressemitteilung'),
    ]);
    fireEvent.click(chip(/^moin@/));
    expect(dataZeilen()).toHaveLength(3);
    fireEvent.click(chip(/^support@/));
    expect(dataZeilen().map((z) => within(z).getAllByRole('cell')[1].textContent)).toEqual(['support@', 'support@']);
    fireEvent.click(chip(/^Alle/));
    expect(dataZeilen()).toHaveLength(5);
  });

  it('Ungelesen zaehlt alle ungelesenen Mails -- auch die zugeordneten -- und zeigt genau diese', async () => {
    antworten();
    await zeigen();
    expect(chip(/^Ungelesen/)).toHaveTextContent('3');
    expect((chip(/^Ungelesen/).querySelector('.web-chip__zahl') as HTMLElement).className).toContain('web-chip__zahl--rot');
    fireEvent.click(chip(/^Ungelesen/));
    expect(chip(/^Ungelesen/)).toHaveAttribute('aria-pressed', 'true');
    // 301 (Anfrage 41), 302 (Gemeinde 1) und 303 (nicht zugeordnet): der Filter fragt nur nach "gelesen", nicht nach der Zuordnung.
    expect(dataZeilen().map((z) => within(z).getAllByRole('cell')[3].textContent)).toEqual([
      expect.stringContaining('Re: Eure Anfrage'), expect.stringContaining('Frage zu den Jahrgängen'), expect.stringContaining('Passwort vergessen?'),
    ]);
  });

  it('Ungelesen ohne ungelesene Mails: eigener Hinweis', async () => {
    antworten({ eingang: EINGANG.filter((m) => m.gelesen_am) });
    await zeigen();
    fireEvent.click(chip(/^Ungelesen/));
    expect(screen.getByText('Nichts Ungelesenes')).toBeInTheDocument();
    expect(screen.getByText('Alle Mails sind gelesen.')).toBeInTheDocument();
  });

  it('ein Filter ohne Mails: eigener Hinweis', async () => {
    antworten({ eingang: EINGANG.filter((m) => m.anfrage_id || m.organization_id) });
    await zeigen();
    fireEvent.click(chip(/^Nicht zugeordnet/));
    expect(screen.getByText('Nichts zuzuordnen')).toBeInTheDocument();
    expect(screen.getByText('Jede Mail ist einer Anfrage oder Gemeinde zugeordnet.')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Eingehende Mails' })).toBeNull();
  });
});

describe('Posteingang (Web): Reihenfolge', () => {
  it('neueste zuerst, auch wenn der Server sie durcheinander liefert', async () => {
    antworten({ eingang: [EINGANG[4], EINGANG[1], EINGANG[3], EINGANG[0], EINGANG[2]] });
    await zeigen();
    expect(dataZeilen().map((z) => within(within(z).getAllByRole('cell')[3]).getByRole('link').textContent)).toEqual([
      'Re: Eure Anfrage bei Konfi Quest [Anfrage 41]', 'Frage zu den Jahrgängen', 'Passwort vergessen?', 'Rückfrage zur Lizenz', 'Pressemitteilung',
    ]);
  });

  it('bei gleicher Sendezeit entscheidet die hoehere Kennung', async () => {
    const zeit = '2026-10-03T08:00:00Z';
    antworten({ eingang: [
      mail(10, 'moin', 'A', 'a@example.org', 'Erste', '', zeit, true),
      mail(12, 'moin', 'C', 'c@example.org', 'Dritte', '', zeit, true),
      mail(11, 'moin', 'B', 'b@example.org', 'Zweite', '', zeit, true),
    ] });
    await zeigen();
    expect(dataZeilen().map((z) => within(z).getAllByRole('cell')[3].textContent)).toEqual(['Dritte', 'Zweite', 'Erste']);
  });
});

describe('Posteingang (Web): Filter aus der Adresse', () => {
  const eingestellt = () => ['Alle', 'Ungelesen', 'Nicht zugeordnet', 'moin@', 'support@']
    .filter((n) => chip(new RegExp(`^${n}`)).getAttribute('aria-pressed') === 'true');

  it('?filter=ungelesen stellt Ungelesen ein -- so fuehrt die Kachel der Uebersicht auf die ungelesenen Mails', async () => {
    h.standort = { pathname: '/admin/support/post', search: '?filter=ungelesen', state: null };
    antworten();
    await zeigen();
    expect(eingestellt()).toEqual(['Ungelesen']);
    expect(dataZeilen()).toHaveLength(3);
  });

  it('jeder Filter ist ueber die Adresse einstellbar', async () => {
    for (const [wert, name, zeilenZahl] of [['offen', 'Nicht zugeordnet', 2], ['moin', 'moin@', 3], ['support', 'support@', 2], ['alle', 'Alle', 5]] as const) {
      h.standort = { pathname: '/admin/support/post', search: `?filter=${wert}`, state: null };
      antworten();
      const { unmount } = render(<SupportPosteingangPage />);
      await screen.findByRole('table', { name: 'Eingehende Mails' });
      expect(eingestellt()).toEqual([name]);
      expect(dataZeilen()).toHaveLength(zeilenZahl);
      unmount();
    }
  });

  it('ein unbekannter Wert: Alle', async () => {
    h.standort = { pathname: '/admin/support/post', search: '?filter=blau', state: null };
    antworten();
    await zeigen();
    expect(eingestellt()).toEqual(['Alle']);
  });

  it('eine neue Adresse bei offener Seite stellt den Filter um', async () => {
    antworten();
    const { rerender } = render(<SupportPosteingangPage />);
    await screen.findByRole('table', { name: 'Eingehende Mails' });
    h.standort = { pathname: '/admin/support/post', search: '?filter=ungelesen', state: null };
    rerender(<SupportPosteingangPage />);
    expect(eingestellt()).toEqual(['Ungelesen']);
  });

  it('auf einer anderen Seite ruehrt die Adresse den Filter nicht an', async () => {
    antworten();
    const { rerender } = render(<SupportPosteingangPage />);
    await screen.findByRole('table', { name: 'Eingehende Mails' });
    h.standort = { pathname: '/admin/support/anfragen', search: '?filter=offen', state: null };
    rerender(<SupportPosteingangPage />);
    expect(eingestellt()).toEqual(['Alle']);
  });
});

describe('Posteingang (Web): Zustand der Postfaecher', () => {
  it('je Postfach: Adresse, eingerichtet, Aufgabe, zuletzt abgeholt', async () => {
    antworten();
    await zeigen();
    const k = screen.getByText('moin@konfi-quest.example').closest('.web-status') as HTMLElement;
    expect(k).toHaveTextContent('Eingerichtet');
    expect(k).toHaveTextContent('Anfragen und Erstkontakt');
    expect(k).toHaveTextContent('zuletzt abgeholt vor 1 Min.');
    expect(screen.getByText('support@konfi-quest.example').closest('.web-status')).toHaveTextContent('Hilfe für Gemeinden');
  });

  it('Fehler beim Abholen, nicht eingerichtet und "auf diesem Server aus" stehen da', async () => {
    antworten({
      status: {
        postfaecher: [
          { postfach: 'moin', adresse: 'moin@konfi-quest.example', eingerichtet: true, abgeholt_am: '2026-10-03T07:00:00Z', fehler: 'Anmeldung abgelehnt', fehler_am: '2026-10-03T07:01:00Z' },
          { postfach: 'support', adresse: 'support@konfi-quest.example', eingerichtet: false, abgeholt_am: null, fehler: null, fehler_am: null, auf_diesem_server: false },
        ],
      },
    });
    await zeigen();
    const moin = screen.getByText('moin@konfi-quest.example').closest('.web-status') as HTMLElement;
    expect(moin.className).toContain('web-status--fehler');
    expect(moin).toHaveTextContent('Fehler beim Abholen: Anmeldung abgelehnt (03.10.2026, 09:01)');
    const support = screen.getByText('support@konfi-quest.example').closest('.web-status') as HTMLElement;
    expect(support).toHaveTextContent('Auf diesem Server aus');
    expect(support).toHaveTextContent('noch nicht abgeholt');
    expect(support.className).toContain('web-status--warnung');
  });

  it('kommt der Zustand nicht, sagt die Seite das -- und zeigt die Mails trotzdem', async () => {
    antworten({ status: new Error('kaputt') });
    await zeigen();
    expect(screen.getByText('Der Zustand der Postfächer konnte nicht geladen werden.')).toBeInTheDocument();
    expect(dataZeilen()).toHaveLength(5);
  });
});

describe('Posteingang (Web): Laden, Fehler, leer', () => {
  it('Fehler: Hinweis mit erneutem Versuch, der wirklich neu laedt', async () => {
    antworten({ eingang: new Error('Netz weg') });
    render(<SupportPosteingangPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Der Posteingang konnte nicht geladen werden.');
    antworten();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' })); });
    expect(await screen.findByRole('table', { name: 'Eingehende Mails' })).toBeInTheDocument();
  });

  it('keine Mails: eigener Hinweis', async () => {
    antworten({ eingang: [] });
    render(<SupportPosteingangPage />);
    expect(await screen.findByText('Noch keine Mails')).toBeInTheDocument();
  });

  it('eine Antwort in unbekannter Form ist ein Fehler, kein Absturz', async () => {
    antworten({ eingang: { irgendwas: true } });
    render(<SupportPosteingangPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Der Posteingang konnte nicht geladen werden.');
  });
});

describe('Posteingang: zwei Gesichter, eine Seite', () => {
  it('im schmalen Fenster bleibt die App-Darstellung mit dem alten Abruf (nur nicht zugeordnete)', async () => {
    h.breit = false;
    antworten();
    render(<SupportPosteingangPage />);
    expect(await screen.findByText('Postfächer')).toBeInTheDocument();
    expect(h.apiGet).toHaveBeenCalledWith('/support/mail/eingang', undefined);
    expect(h.apiGet).not.toHaveBeenCalledWith('/support/mail/eingang', { params: { zuordnung: 'alle' } });
    expect(document.querySelector('.web-seite')).toBeNull();
  });

  it('ohne Super-Admin-Recht: Hinweis, kein Abruf', () => {
    h.user = { id: 5, display_name: 'Leitung', role_name: 'org_admin' };
    antworten();
    render(<SupportPosteingangPage />);
    expect(screen.getByText('Nur für den Support')).toBeInTheDocument();
    expect(h.apiGet).not.toHaveBeenCalledWith('/support/mail/eingang', expect.anything());
  });
});
