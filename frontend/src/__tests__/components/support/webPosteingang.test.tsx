// Posteingang in der Web-Fassung, gerendert (docs/planung/support-vorgaenge.md,
// Entscheidung 7): nur die Mails, die in keinem Vorgang liegen und nicht
// archiviert sind. Je Mail „Einsortieren“ (bestehender Vorgang mit Suche oder
// neuer Vorgang mit Art, Bereich, Gemeinde), Archivieren und Löschen; mehrere
// Mails lassen sich auswählen; Filter Alle, Ungelesen, moin@, support@ und
// Archiv; oben der Zustand der Postfächer. Im schmalen Fenster bleibt der
// Posteingang der App.
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import type { AlertOptionen } from './ionicAttrappe';
import { mail, vorgang, vorgaengeServer } from './vorgaengeServer';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  push: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  alert: null as null | AlertOptionen,
  breit: true,
  online: true,
  user: { id: 9, display_name: 'Support Eins', role_name: 'super_admin', is_super_admin: true } as Record<string, unknown>,
  standort: { pathname: '/admin/support/post', search: '', state: null } as { pathname: string; search: string; state: null },
}));

vi.mock('@ionic/react', async () => (await import('./ionicAttrappe')).ionicAttrappe({
  presentAlert: (o) => { h.alert = o; },
  router: { push: h.push, goBack: vi.fn(), canGoBack: () => false },
}));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('./ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: ({ message }: { message: string }) => <p>{message}</p> }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, signOut: vi.fn(), setError: h.setError, setSuccess: h.setSuccess, isOnline: h.online }),
}));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../../navigation/useAppLocation', () => ({ useAppLocation: () => h.standort }));

import SupportPosteingangPage from '../../../components/support/SupportPosteingangPage';
import { supportMailZaehlerZuruecksetzen } from '../../../navigation/supportMailZaehler';

let vorherTZ: string | undefined;
beforeAll(() => { vorherTZ = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherTZ === undefined) delete process.env.TZ; else process.env.TZ = vorherTZ; });

let server: ReturnType<typeof vorgaengeServer>;

const MAILS = () => [
  mail(301, null, { postfach: 'moin', von_name: 'Pastorin Lena Probe', von_adresse: 'lena.probe@example.org', betreff: 'Rückfrage zur Lizenz', text: 'Vielen Dank für die schnelle Rückmeldung!', gesendet_am: '2026-10-03T08:18:00Z' }),
  mail(302, null, { postfach: 'support', von_name: 'Sam Muster', von_adresse: 'sam@example.org', betreff: 'Frage zu den Jahrgängen', text: 'Guten Morgen, wir möchten den neuen Jahrgang anlegen.', gesendet_am: '2026-10-03T07:35:00Z' }),
  mail(303, null, { postfach: 'support', von_name: null, von_adresse: 'info@beispiel-verein.example', betreff: 'Passwort vergessen?', text: 'Hallo, ich komme nicht mehr in die App.', gesendet_am: '2026-10-03T03:30:00Z' }),
  mail(304, null, { postfach: 'moin', von_name: 'Jan Vorlage', von_adresse: 'jan.vorlage@example.org', betreff: 'Angebot', text: 'Könnten Sie uns ein Angebot senden?', gesendet_am: '2026-10-02T10:30:00Z', gelesen_am: '2026-10-02T11:00:00Z', anhaenge: [{ name: 'angebot.pdf' }, { name: 'logo.png' }] }),
  mail(305, null, { postfach: 'moin', von_name: 'Presseverteiler', von_adresse: 'presse@beispiel-medien.example', betreff: 'Pressemitteilung', text: 'Sehr geehrte Damen und Herren', gesendet_am: '2026-09-28T10:30:00Z', gelesen_am: '2026-09-28T11:00:00Z' }),
  // Archiviert: nur unter dem Filter „Archiv“.
  mail(306, null, { postfach: 'support', von_name: 'Werbung', von_adresse: 'werbung@beispiel-medien.example', betreff: 'Sonderangebot', text: 'Jetzt zugreifen', gesendet_am: '2026-09-20T10:30:00Z', gelesen_am: '2026-09-20T11:00:00Z', archiviert_am: '2026-09-21T10:30:00Z' }),
  // In einem Vorgang: gehört nicht in den Posteingang.
  mail(11, 1, { betreff: 'Chat zeigt nichts Neues', text: 'Seit gestern nichts Neues.' }),
];

const VORGAENGE = () => [
  vorgang(1, { status: 'neu', art: 'fehler', bereich: 'chat', betreff: 'Chat zeigt nichts Neues', organization_id: 7, created_at: '2026-10-03T07:00:00Z' }),
  vorgang(2, { status: 'in_arbeit', art: 'frage', bereich: 'konten', betreff: 'Wie lege ich einen Jahrgang an?', created_at: '2026-10-02T09:00:00Z' }),
  vorgang(3, { status: 'erledigt', art: 'zugang', bereich: null, betreff: 'Konto entsperrt', archiviert_am: '2026-10-01T12:00:00Z', created_at: '2026-09-20T09:00:00Z' }),
];

beforeEach(() => {
  vi.clearAllMocks();
  h.alert = null;
  h.breit = true;
  h.online = true;
  h.user = { id: 9, display_name: 'Support Eins', role_name: 'super_admin', is_super_admin: true };
  h.standort = { pathname: '/admin/support/post', search: '', state: null };
  supportMailZaehlerZuruecksetzen();
  server = vorgaengeServer({ vorgaenge: VORGAENGE(), mails: MAILS() });
  server.installieren({ get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-03T08:30:00Z'));
});
afterEach(() => { vi.useRealTimers(); });

const TABELLE = 'Mails im Posteingang';
const zeigen = async (name = TABELLE) => {
  render(<SupportPosteingangPage />);
  await screen.findByRole('table', { name });
};
const zeilen = (name = TABELLE) => within(screen.getByRole('table', { name })).getAllByRole('row').slice(1);
const zelle = (z: HTMLElement, spalte: number) => within(z).getAllByRole('cell')[spalte];
const betreffe = (name = TABELLE) => zeilen(name).map((z) => within(zelle(z, 4)).getByRole('link').textContent);
const chip = (name: RegExp | string) => within(screen.getByRole('group', { name: 'Mails filtern' })).getByRole('button', { name });
const bestaetigen = async (knopf: string) => { await act(async () => { h.alert?.buttons?.find((b) => b.text === knopf)?.handler?.(); }); };

describe('Posteingang (Web): was geladen wird', () => {
  it('ruft nur die Mails ohne Vorgang ab -- ohne Parameter -- und den Zustand der Postfächer', async () => {
    await zeigen();
    expect(server.aufrufe('get', '/support/mail/eingang').map((a) => a.optionen)).toEqual([undefined]);
    expect(server.aufrufe('get', '/support/mail/status')).toHaveLength(1);
  });

  it('der Filter wechselt ohne neuen Abruf -- die Zahlen von Alle, moin@ und support@ stehen aus einer Antwort da', async () => {
    await zeigen();
    fireEvent.click(chip(/^moin@/));
    fireEvent.click(chip(/^support@/));
    fireEvent.click(chip(/^Ungelesen/));
    expect(server.aufrufe('get', '/support/mail/eingang')).toHaveLength(1);
  });

  it('das Archiv wird erst beim Wählen des Filters geladen (archiv=1)', async () => {
    await zeigen();
    expect(server.aufrufe('get', '/support/mail/eingang')).toHaveLength(1);
    fireEvent.click(chip(/^Archiv/));
    await waitFor(() => expect(server.aufrufe('get', '/support/mail/eingang').map((a) => a.optionen)).toContainEqual({ params: { archiv: 1 } }));
    await screen.findByRole('table', { name: 'Archivierte Mails' });
  });
});

describe('Posteingang (Web): Tabelle', () => {
  it('eine Zeile je Mail ohne Vorgang, neueste zuerst; Mails in einem Vorgang und archivierte fehlen', async () => {
    await zeigen();
    expect(betreffe()).toEqual(['Rückfrage zur Lizenz', 'Frage zu den Jahrgängen', 'Passwort vergessen?', 'Angebot', 'Pressemitteilung']);
    expect(screen.getByRole('heading', { level: 1, name: 'Posteingang' })).toBeInTheDocument();
    expect(screen.getByText('5 Mails warten darauf, einem Vorgang zugeordnet zu werden')).toBeInTheDocument();
  });

  it('Postfach, Von (Name und Adresse), Betreff mit Auszug und Datum stehen in der Zeile', async () => {
    await zeigen();
    const z = zeilen();
    expect(z.map((x) => zelle(x, 2).textContent)).toEqual(['moin@', 'support@', 'support@', 'moin@', 'moin@']);
    expect(zelle(z[0], 3)).toHaveTextContent('Pastorin Lena Probe');
    expect(zelle(z[0], 3)).toHaveTextContent('lena.probe@example.org');
    expect(zelle(z[0], 4)).toHaveTextContent('Rückfrage zur Lizenz');
    expect(zelle(z[0], 4)).toHaveTextContent('Vielen Dank für die schnelle Rückmeldung!');
    expect(zelle(z[0], 5)).toHaveTextContent('vor 12 Min.');
    // Ohne Namen steht die Adresse allein; ein Datum ab zwei Tagen als Datum.
    expect(zelle(z[2], 3).textContent).toBe('info@beispiel-verein.example');
    expect(zelle(z[4], 5)).toHaveTextContent('28.09.2026');
    // Anhänge stehen vor dem Auszug.
    expect(zelle(z[3], 4)).toHaveTextContent('2 Anhänge');
  });

  it('ungelesene Mails tragen einen Punkt und stehen fett; gelesene nicht', async () => {
    await zeigen();
    const z = zeilen();
    expect(z.map((x) => within(x).queryByRole('img', { name: 'ungelesen' }) !== null)).toEqual([true, true, true, false, false]);
    expect(z.map((x) => x.classList.contains('web-zeile--ungelesen'))).toEqual([true, true, true, false, false]);
    expect(within(z[0]).getByRole('link', { name: 'Rückfrage zur Lizenz' }).className).toContain('web-ungelesen');
    expect(within(z[3]).getByRole('link', { name: 'Angebot' }).className).not.toContain('web-ungelesen');
  });

  it('die Zeile öffnet die Mail: ein echter Link, Klick bleibt in der App', async () => {
    await zeigen();
    const link = within(zeilen()[1]).getByRole('link', { name: 'Frage zu den Jahrgängen' });
    expect(link).toHaveAttribute('href', '/admin/support/post/302');
    expect(link.className).toContain('web-link--zeile');
    fireEvent.click(link);
    expect(h.push).toHaveBeenCalledWith('/admin/support/post/302', 'none', 'push');
  });

  it('neueste zuerst, auch wenn der Server sie durcheinander liefert; bei gleicher Zeit entscheidet die höhere Kennung', async () => {
    const zeit = '2026-10-03T08:00:00Z';
    server.stand.mails = [
      mail(10, null, { betreff: 'Erste', gesendet_am: zeit }),
      mail(12, null, { betreff: 'Dritte', gesendet_am: zeit }),
      mail(11, null, { betreff: 'Zweite', gesendet_am: zeit }),
      mail(13, null, { betreff: 'Älteste', gesendet_am: '2026-10-03T07:00:00Z' }),
    ];
    await zeigen();
    expect(betreffe()).toEqual(['Dritte', 'Zweite', 'Erste', 'Älteste']);
  });
});

describe('Posteingang (Web): Filter', () => {
  it('Alle ist voreingestellt und zählt die Mails ohne Vorgang; moin@ und support@ zählen je Postfach', async () => {
    await zeigen();
    expect(chip(/^Alle/)).toHaveAttribute('aria-pressed', 'true');
    expect(chip(/^Alle/)).toHaveTextContent('5');
    expect(chip(/^moin@/)).toHaveTextContent('3');
    expect(chip(/^support@/)).toHaveTextContent('2');
  });

  it('Ungelesen trägt die rote Zahl -- aus demselben Zähler wie die Leiste, nicht aus der Liste', async () => {
    const vorher = h.apiGet.getMockImplementation()!;
    h.apiGet.mockImplementation((pfad: string, o?: unknown) => (pfad === '/support/mail/zaehler'
      ? Promise.resolve({ data: { ...server.zaehler(), posteingang: 7 } })
      : vorher(pfad, o as never)));
    await zeigen();
    await waitFor(() => expect(chip(/^Ungelesen/)).toHaveTextContent('7'));
    const zahl = chip(/^Ungelesen/).querySelector('.web-chip__zahl') as HTMLElement;
    expect(zahl.className).toContain('web-chip__zahl--rot');
    expect(zahl).toHaveTextContent('7 ungelesen');
  });

  it('ohne ungelesene Mails steht die Zahl 0 am Chip -- nicht rot', async () => {
    server.stand.mails.forEach((m) => { m.gelesen_am = '2026-10-03T08:00:00Z'; });
    await zeigen();
    await waitFor(() => expect(server.aufrufe('get', '/support/mail/zaehler').length).toBeGreaterThan(0));
    const zahl = chip(/^Ungelesen/).querySelector('.web-chip__zahl') as HTMLElement;
    expect(zahl.textContent).toBe('0');
    expect(zahl.className).not.toContain('--rot');
  });

  it('Ungelesen zeigt genau die ungelesenen; moin@ und support@ je Postfach; Alle holt alles zurück', async () => {
    await zeigen();
    fireEvent.click(chip(/^Ungelesen/));
    expect(chip(/^Ungelesen/)).toHaveAttribute('aria-pressed', 'true');
    expect(chip(/^Alle/)).toHaveAttribute('aria-pressed', 'false');
    expect(betreffe()).toEqual(['Rückfrage zur Lizenz', 'Frage zu den Jahrgängen', 'Passwort vergessen?']);
    fireEvent.click(chip(/^moin@/));
    expect(betreffe()).toEqual(['Rückfrage zur Lizenz', 'Angebot', 'Pressemitteilung']);
    fireEvent.click(chip(/^support@/));
    expect(betreffe()).toEqual(['Frage zu den Jahrgängen', 'Passwort vergessen?']);
    fireEvent.click(chip(/^Alle/));
    expect(zeilen()).toHaveLength(5);
  });

  it('Ungelesen ohne ungelesene Mails: eigener Hinweis', async () => {
    server.stand.mails.forEach((m) => { m.gelesen_am = '2026-10-03T08:00:00Z'; });
    await zeigen();
    fireEvent.click(chip(/^Ungelesen/));
    expect(screen.getByText('Nichts Ungelesenes')).toBeInTheDocument();
    expect(screen.getByText('Alle Mails sind gelesen.')).toBeInTheDocument();
  });

  it('Archiv: die archivierten Mails, mit „Zurück“ statt „Einsortieren“ -- und die Zahl steht am Chip', async () => {
    await zeigen();
    expect(chip(/^Archiv/).querySelector('.web-chip__zahl')).toBeNull();
    fireEvent.click(chip(/^Archiv/));
    await screen.findByRole('table', { name: 'Archivierte Mails' });
    expect(betreffe('Archivierte Mails')).toEqual(['Sonderangebot']);
    const z = zeilen('Archivierte Mails')[0];
    expect(within(z).getByRole('button', { name: 'Wiederherstellen: Sonderangebot' })).toBeInTheDocument();
    expect(within(z).queryByRole('button', { name: /^Einsortieren/ })).toBeNull();
    expect(within(z).queryByRole('button', { name: /^Archivieren/ })).toBeNull();
    expect(within(z).getByRole('button', { name: 'Löschen: Sonderangebot' })).toBeInTheDocument();
    expect(chip(/^Archiv/)).toHaveTextContent('1');
    expect(screen.getByText('Archivierte Mails, die zu keinem Vorgang gehören')).toBeInTheDocument();
  });

  it('ein leeres Archiv und ein leerer Posteingang sagen es', async () => {
    server.stand.mails = server.stand.mails.filter((m) => m.id !== 306 && m.vorgang_id !== null);
    await zeigen('Mails im Posteingang').catch(() => undefined);
    // Ohne Mails keine Tabelle: der Hinweis steht da.
    expect(await screen.findByText('Nichts einzusortieren')).toBeInTheDocument();
    expect(screen.getByText('Alles ist einsortiert. Neue Mails, die zu keinem Vorgang passen, erscheinen hier.')).toBeInTheDocument();
    fireEvent.click(chip(/^Archiv/));
    expect(await screen.findByText('Das Archiv ist leer')).toBeInTheDocument();
    expect(screen.getByText('Archivierte Mails liegen hier und werden nach 180 Tagen gelöscht.')).toBeInTheDocument();
  });
});

describe('Posteingang (Web): Filter aus der Adresse', () => {
  const eingestellt = () => ['Alle', 'Ungelesen', 'moin@', 'support@', 'Archiv']
    .filter((n) => chip(new RegExp(`^${n}`)).getAttribute('aria-pressed') === 'true');

  it('?filter=ungelesen stellt Ungelesen ein -- so führt die Kachel der Übersicht auf die ungelesenen Mails', async () => {
    h.standort = { pathname: '/admin/support/post', search: '?filter=ungelesen', state: null };
    await zeigen();
    expect(eingestellt()).toEqual(['Ungelesen']);
    expect(zeilen()).toHaveLength(3);
  });

  it('?filter=archiv lädt das Archiv', async () => {
    h.standort = { pathname: '/admin/support/post', search: '?filter=archiv', state: null };
    await zeigen('Archivierte Mails');
    expect(eingestellt()).toEqual(['Archiv']);
  });

  it('jeder Filter ist über die Adresse einstellbar', async () => {
    for (const [wert, name, zahl] of [['moin', 'moin@', 3], ['support', 'support@', 2], ['alle', 'Alle', 5]] as const) {
      h.standort = { pathname: '/admin/support/post', search: `?filter=${wert}`, state: null };
      const { unmount } = render(<SupportPosteingangPage />);
      await screen.findByRole('table', { name: TABELLE });
      expect(eingestellt()).toEqual([name]);
      expect(zeilen()).toHaveLength(zahl);
      unmount();
    }
  });

  it('ein unbekannter Wert: Alle; eine neue Adresse bei offener Seite stellt um; auf einer anderen Seite rührt sie nichts an', async () => {
    h.standort = { pathname: '/admin/support/post', search: '?filter=blau', state: null };
    const { rerender } = render(<SupportPosteingangPage />);
    await screen.findByRole('table', { name: TABELLE });
    expect(eingestellt()).toEqual(['Alle']);
    h.standort = { pathname: '/admin/support/post', search: '?filter=ungelesen', state: null };
    rerender(<SupportPosteingangPage />);
    expect(eingestellt()).toEqual(['Ungelesen']);
    h.standort = { pathname: '/admin/support/vorgaenge', search: '?filter=neu', state: null };
    rerender(<SupportPosteingangPage />);
    expect(eingestellt()).toEqual(['Ungelesen']);
  });
});

describe('Posteingang (Web): Archivieren, Wiederherstellen, Löschen je Mail', () => {
  it('Archivieren: eine Anfrage an die Mail; sie verlässt die Liste und liegt im Archiv', async () => {
    await zeigen();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Archivieren: Frage zu den Jahrgängen' })); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/302/archivieren')).toHaveLength(1);
    expect(h.setSuccess).toHaveBeenCalledWith('1 Mail archiviert');
    await waitFor(() => expect(betreffe()).toEqual(['Rückfrage zur Lizenz', 'Passwort vergessen?', 'Angebot', 'Pressemitteilung']));
    expect(server.stand.mails.find((m) => m.id === 302)!.archiviert_am).not.toBeNull();
    fireEvent.click(chip(/^Archiv/));
    await waitFor(() => expect(betreffe('Archivierte Mails')).toEqual(['Frage zu den Jahrgängen', 'Sonderangebot']));
  });

  it('Wiederherstellen im Archiv: die Mail ist wieder im Posteingang', async () => {
    h.standort = { pathname: '/admin/support/post', search: '?filter=archiv', state: null };
    await zeigen('Archivierte Mails');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Wiederherstellen: Sonderangebot' })); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/306/wiederherstellen')).toHaveLength(1);
    expect(h.setSuccess).toHaveBeenCalledWith('1 Mail wiederhergestellt – wieder im Posteingang');
    expect(await screen.findByText('Das Archiv ist leer')).toBeInTheDocument();
    expect(server.stand.mails.find((m) => m.id === 306)!.archiviert_am).toBeNull();
  });

  it('Löschen fragt zuerst und sagt, dass im Postfach alles stehen bleibt; erst „Löschen“ löscht', async () => {
    await zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Löschen: Passwort vergessen?' }));
    expect(h.alert?.header).toBe('Mail löschen');
    expect(h.alert?.message).toContain('Im Postfach selbst bleibt alles stehen');
    expect(server.aufrufe('delete')).toHaveLength(0);
    await bestaetigen('Löschen');
    expect(server.aufrufe('delete', '/support/mail/nachrichten/303')).toHaveLength(1);
    expect(h.setSuccess).toHaveBeenCalledWith('1 Mail gelöscht');
    await waitFor(() => expect(betreffe()).not.toContain('Passwort vergessen?'));
    expect(zeilen()).toHaveLength(4);
  });

  it('Abbrechen löscht nichts', async () => {
    await zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Löschen: Passwort vergessen?' }));
    await bestaetigen('Abbrechen');
    expect(server.aufrufe('delete')).toHaveLength(0);
    expect(zeilen()).toHaveLength(5);
  });

  it('ein Fehler beim Archivieren: Meldung, die Mail bleibt in der Liste', async () => {
    server.stand.fehler.set('POST /support/mail/nachrichten/302/archivieren', Object.assign(new Error('x'), { response: { status: 500, data: { error: 'Datenbankfehler' } } }));
    await zeigen();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Archivieren: Frage zu den Jahrgängen' })); });
    expect(h.setError).toHaveBeenCalledWith('Datenbankfehler');
    expect(zeilen()).toHaveLength(5);
  });

  it('ohne Netz sind Archivieren und Löschen gesperrt; Einsortieren öffnet den Dialog, sendet aber nicht', async () => {
    h.online = false;
    await zeigen();
    expect(screen.getByRole('button', { name: 'Archivieren: Frage zu den Jahrgängen' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Löschen: Frage zu den Jahrgängen' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Einsortieren: Frage zu den Jahrgängen' }));
    const d = within(await screen.findByRole('dialog', { name: 'Mail einsortieren' }));
    expect(d.getByRole('button', { name: 'Einsortieren' })).toBeDisabled();
  });
});

describe('Posteingang (Web): mehrere Mails auswählen', () => {
  const kasten = (betreff: string) => screen.getByRole('checkbox', { name: `Mail auswählen: ${betreff}` }) as HTMLInputElement;

  it('ohne Auswahl steht nur „Alle auswählen“; mit Auswahl die Zahl und die Aktionen', async () => {
    await zeigen();
    const leiste = within(screen.getByRole('group', { name: 'Auswahl' }));
    expect(leiste.getByText('Alle auswählen')).toBeInTheDocument();
    expect(leiste.queryByRole('button')).toBeNull();
    fireEvent.click(kasten('Frage zu den Jahrgängen'));
    fireEvent.click(kasten('Passwort vergessen?'));
    expect(leiste.getByText('2 Mails ausgewählt')).toBeInTheDocument();
    expect(leiste.getByRole('button', { name: 'Archivieren' })).toBeInTheDocument();
    expect(leiste.getByRole('button', { name: 'Löschen' })).toBeInTheDocument();
    expect((leiste.getByRole('checkbox') as HTMLInputElement).indeterminate).toBe(true);
  });

  it('Archivieren: ein Aufruf für alle gewählten; danach ist die Auswahl leer und die Liste neu', async () => {
    await zeigen();
    fireEvent.click(kasten('Frage zu den Jahrgängen'));
    fireEvent.click(kasten('Passwort vergessen?'));
    await act(async () => { fireEvent.click(within(screen.getByRole('group', { name: 'Auswahl' })).getByRole('button', { name: 'Archivieren' })); });
    expect(server.aufrufe('post', '/support/mail/sammel').map((a) => a.koerper)).toEqual([{ ids: [302, 303], aktion: 'archivieren' }]);
    expect(h.setSuccess).toHaveBeenCalledWith('2 Mails archiviert');
    await waitFor(() => expect(betreffe()).toEqual(['Rückfrage zur Lizenz', 'Angebot', 'Pressemitteilung']));
    expect(within(screen.getByRole('group', { name: 'Auswahl' })).getByText('Alle auswählen')).toBeInTheDocument();
  });

  it('Löschen fragt mit der Zahl; erst „Löschen“ löscht alle gewählten', async () => {
    await zeigen();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Alle auswählen' }));
    expect(screen.getByText('5 Mails ausgewählt')).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('group', { name: 'Auswahl' })).getByRole('button', { name: 'Löschen' }));
    expect(h.alert?.header).toBe('5 Mails löschen');
    expect(server.aufrufe('post', '/support/mail/sammel')).toHaveLength(0);
    await bestaetigen('Löschen');
    expect(server.aufrufe('post', '/support/mail/sammel').map((a) => a.koerper)).toEqual([{ ids: [301, 302, 303, 304, 305], aktion: 'loeschen' }]);
    expect(await screen.findByText('Nichts einzusortieren')).toBeInTheDocument();
  });

  it('eine Mail, die aus der Liste verschwindet, bleibt nicht ausgewählt', async () => {
    await zeigen();
    fireEvent.click(kasten('Frage zu den Jahrgängen'));
    fireEvent.click(kasten('Passwort vergessen?'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Archivieren: Frage zu den Jahrgängen' })); });
    await waitFor(() => expect(betreffe()).not.toContain('Frage zu den Jahrgängen'));
    expect(screen.getByText('1 Mail ausgewählt')).toBeInTheDocument();
  });

  it('im Archiv: „Wiederherstellen“ für alle gewählten', async () => {
    server.stand.mails.push(mail(307, null, { betreff: 'Noch eine', archiviert_am: '2026-09-22T10:30:00Z', gelesen_am: '2026-09-22T11:00:00Z' }));
    h.standort = { pathname: '/admin/support/post', search: '?filter=archiv', state: null };
    await zeigen('Archivierte Mails');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Alle auswählen' }));
    await act(async () => { fireEvent.click(within(screen.getByRole('group', { name: 'Auswahl' })).getByRole('button', { name: 'Wiederherstellen' })); });
    expect(server.aufrufe('post', '/support/mail/sammel').map((a) => a.koerper)).toEqual([{ ids: [307, 306], aktion: 'wiederherstellen' }]);
    expect(h.setSuccess).toHaveBeenCalledWith('2 Mails wiederhergestellt – wieder im Posteingang');
  });

  it('ein Fehler bei der Sammelaktion: Meldung, die Auswahl bleibt', async () => {
    server.stand.fehler.set('POST /support/mail/sammel', new Error('Netz weg'));
    await zeigen();
    fireEvent.click(kasten('Frage zu den Jahrgängen'));
    fireEvent.click(kasten('Passwort vergessen?'));
    await act(async () => { fireEvent.click(within(screen.getByRole('group', { name: 'Auswahl' })).getByRole('button', { name: 'Archivieren' })); });
    expect(h.setError).toHaveBeenCalledWith('Archivieren hat nicht geklappt');
    expect(screen.getByText('2 Mails ausgewählt')).toBeInTheDocument();
  });
});

describe('Posteingang (Web): Einsortieren', () => {
  const dialog = () => screen.getByRole('dialog', { name: 'Mail einsortieren' });
  const oeffnen = async (betreff = 'Frage zu den Jahrgängen') => {
    await zeigen();
    fireEvent.click(screen.getByRole('button', { name: `Einsortieren: ${betreff}` }));
    await screen.findByRole('dialog', { name: 'Mail einsortieren' });
    // Die offenen Vorgänge kommen nach dem Öffnen.
    await waitFor(() => expect(within(dialog()).queryAllByRole('radio').length).toBeGreaterThan(0));
  };

  it('der Dialog nennt die Mail und bietet „Bestehender Vorgang“ und „Neuer Vorgang“; die offenen Vorgänge stehen zur Wahl, das Archiv nicht', async () => {
    await oeffnen();
    const d = within(dialog());
    expect(d.getByText(/„Frage zu den Jahrgängen“ kommt in einen Vorgang/)).toBeInTheDocument();
    expect(d.getByRole('button', { name: 'Bestehender Vorgang' })).toHaveAttribute('aria-pressed', 'true');
    expect(d.getByRole('button', { name: 'Neuer Vorgang' })).toHaveAttribute('aria-pressed', 'false');
    const radios = d.getAllByRole('radio').map((r) => r.closest('label')!.textContent);
    expect(radios).toHaveLength(2);
    expect(radios[0]).toContain('Nr. 1 · Chat zeigt nichts Neues');
    expect(radios[0]).toContain('Kirchengemeinde Musterdorf');
    expect(radios[1]).toContain('Nr. 2 · Wie lege ich einen Jahrgang an?');
    expect(radios[1]).toContain('Keine Gemeinde');
    expect(server.aufrufe('get', '/support/vorgaenge').map((a) => a.optionen)).toContainEqual({ params: { filter: 'offen' } });
  });

  it('die Suche engt die Vorgänge ein', async () => {
    await oeffnen();
    const d = within(dialog());
    fireEvent.change(d.getByRole('searchbox', { name: 'Vorgang suchen' }), { target: { value: 'jahrgang' } });
    expect(d.getAllByRole('radio')).toHaveLength(1);
    expect(d.getByRole('radio', { name: /Nr\. 2/ })).toBeInTheDocument();
    fireEvent.change(d.getByRole('searchbox', { name: 'Vorgang suchen' }), { target: { value: 'gibt es nicht' } });
    expect(d.getByText(/Keine Treffer für „gibt es nicht“/)).toBeInTheDocument();
  });

  it('einen bestehenden Vorgang wählen: ein Aufruf mit der Nummer; die Mail verlässt den Posteingang und liegt im Vorgang', async () => {
    await oeffnen();
    const d = within(dialog());
    fireEvent.click(d.getByRole('radio', { name: /Nr\. 2/ }));
    await act(async () => { fireEvent.click(d.getByRole('button', { name: 'Einsortieren' })); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/302/einsortieren').map((a) => a.koerper)).toEqual([{ vorgang_id: 2 }]);
    expect(h.setSuccess).toHaveBeenCalledWith('Mail in Vorgang 2 einsortiert');
    expect(screen.queryByRole('dialog', { name: 'Mail einsortieren' })).toBeNull();
    await waitFor(() => expect(betreffe()).not.toContain('Frage zu den Jahrgängen'));
    expect(zeilen()).toHaveLength(4);
    expect(server.stand.mails.find((m) => m.id === 302)!.vorgang_id).toBe(2);
  });

  it('ohne Wahl: ein Satz sagt, was fehlt -- nichts geht raus', async () => {
    await oeffnen();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Einsortieren' }));
    expect(within(dialog()).getByRole('alert')).toHaveTextContent('Bitte einen Vorgang wählen');
    expect(server.aufrufe('post', /einsortieren$/)).toHaveLength(0);
  });

  it('neuer Vorgang: Betreff aus der Mail vorbelegt; Art, Bereich, Dringlichkeit, Gemeinde gehen genau so an den Server', async () => {
    await oeffnen();
    const d = within(dialog());
    fireEvent.click(d.getByRole('button', { name: 'Neuer Vorgang' }));
    expect(d.getByRole('button', { name: 'Neuer Vorgang' })).toHaveAttribute('aria-pressed', 'true');
    expect((d.getByLabelText('Betreff') as HTMLInputElement).value).toBe('Frage zu den Jahrgängen');
    expect((d.getByLabelText('Art') as HTMLSelectElement).value).toBe('');
    expect((d.getByLabelText('Dringlichkeit') as HTMLSelectElement).value).toBe('normal');
    fireEvent.change(d.getByLabelText('Art'), { target: { value: 'fehler' } });
    fireEvent.change(d.getByLabelText('Bereich'), { target: { value: 'chat' } });
    fireEvent.change(d.getByLabelText('Dringlichkeit'), { target: { value: 'dringend' } });
    fireEvent.change(d.getByLabelText('Betreff'), { target: { value: '  Chat geht nicht  ' } });
    await waitFor(() => expect((d.getByLabelText('Gemeinde') as HTMLSelectElement).options.length).toBeGreaterThan(1));
    fireEvent.change(d.getByLabelText('Gemeinde'), { target: { value: '7' } });
    await act(async () => { fireEvent.click(d.getByRole('button', { name: 'Einsortieren' })); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/302/einsortieren').map((a) => a.koerper)).toEqual([
      { neu: { art: 'fehler', bereich: 'chat', dringlichkeit: 'dringend', betreff: 'Chat geht nicht', organization_id: 7 } },
    ]);
    expect(h.setSuccess).toHaveBeenCalledWith('Mail in Vorgang 100 einsortiert');
    expect(server.stand.vorgaenge.find((v) => v.id === 100)).toMatchObject({ art: 'fehler', bereich: 'chat', organization_id: 7 });
    await waitFor(() => expect(betreffe()).not.toContain('Frage zu den Jahrgängen'));
  });

  it('neuer Vorgang ohne Art, ohne Bereich bei Frage, Fehler, Wunsch und ohne Betreff: je ein Satz, nichts geht raus', async () => {
    await oeffnen();
    const d = within(dialog());
    fireEvent.click(d.getByRole('button', { name: 'Neuer Vorgang' }));
    fireEvent.click(d.getByRole('button', { name: 'Einsortieren' }));
    expect(d.getByRole('alert')).toHaveTextContent('Bitte eine Art wählen');
    expect(d.getByText('Bereich').className).not.toContain('--pflicht');
    fireEvent.change(d.getByLabelText('Art'), { target: { value: 'frage' } });
    expect(d.getByText('Bereich').className).toContain('web-feld__label--pflicht');
    fireEvent.click(d.getByRole('button', { name: 'Einsortieren' }));
    expect(d.getByRole('alert')).toHaveTextContent('Bitte einen Bereich wählen');
    fireEvent.change(d.getByLabelText('Art'), { target: { value: 'lizenz' } });
    fireEvent.change(d.getByLabelText('Betreff'), { target: { value: '   ' } });
    fireEvent.click(d.getByRole('button', { name: 'Einsortieren' }));
    expect(d.getByRole('alert')).toHaveTextContent('Bitte einen Betreff eingeben');
    expect(server.aufrufe('post', /einsortieren$/)).toHaveLength(0);
  });

  it('eine Art ohne Bereichspflicht kommt ohne Bereich aus -- das Feld fehlt im Körper', async () => {
    await oeffnen();
    const d = within(dialog());
    fireEvent.click(d.getByRole('button', { name: 'Neuer Vorgang' }));
    fireEvent.change(d.getByLabelText('Art'), { target: { value: 'lizenz' } });
    await act(async () => { fireEvent.click(d.getByRole('button', { name: 'Einsortieren' })); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/302/einsortieren').map((a) => a.koerper)).toEqual([
      { neu: { art: 'lizenz', dringlichkeit: 'normal', betreff: 'Frage zu den Jahrgängen' } },
    ]);
  });

  it('ein Fehler des Servers: er steht im Dialog, der Dialog bleibt, die Mail bleibt in der Liste', async () => {
    server.stand.fehler.set('POST /support/mail/nachrichten/302/einsortieren', Object.assign(new Error('x'), { response: { status: 409, data: { error: 'Die Mail liegt schon in einem Vorgang' } } }));
    await oeffnen();
    const d = within(dialog());
    fireEvent.click(d.getByRole('radio', { name: /Nr\. 1/ }));
    await act(async () => { fireEvent.click(d.getByRole('button', { name: 'Einsortieren' })); });
    expect(d.getByRole('alert')).toHaveTextContent('Die Mail liegt schon in einem Vorgang');
    expect(screen.getByRole('dialog', { name: 'Mail einsortieren' })).toBeInTheDocument();
    expect(h.setSuccess).not.toHaveBeenCalled();
    expect(zeilen()).toHaveLength(5);
  });

  it('die Vorgänge lassen sich nicht laden: der Dialog sagt das und bleibt für „Neuer Vorgang“ benutzbar', async () => {
    await zeigen();
    server.stand.fehler.set('GET /support/vorgaenge', new Error('Netz weg'));
    fireEvent.click(screen.getByRole('button', { name: 'Einsortieren: Frage zu den Jahrgängen' }));
    const d = within(await screen.findByRole('dialog', { name: 'Mail einsortieren' }));
    expect(await d.findByText('Die Vorgänge konnten nicht geladen werden.')).toBeInTheDocument();
    fireEvent.click(d.getByRole('button', { name: 'Neuer Vorgang' }));
    expect(d.getByLabelText('Art')).toBeInTheDocument();
  });

  it('Abbrechen schließt den Dialog ohne Aufruf', async () => {
    await oeffnen();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog', { name: 'Mail einsortieren' })).toBeNull();
    expect(server.aufrufe('post', /einsortieren$/)).toHaveLength(0);
  });
});

describe('Posteingang (Web): Zustand der Postfächer', () => {
  it('je Postfach: Adresse, eingerichtet, Aufgabe, zuletzt abgeholt', async () => {
    await zeigen();
    const k = screen.getByText('moin@konfi-quest.example').closest('.web-status') as HTMLElement;
    expect(k).toHaveTextContent('Eingerichtet');
    expect(k).toHaveTextContent('Anfragen und Erstkontakt');
    expect(k).toHaveTextContent('zuletzt abgeholt vor 1 Min.');
    expect(screen.getByText('support@konfi-quest.example').closest('.web-status')).toHaveTextContent('Hilfe für Gemeinden');
  });

  it('Fehler beim Abholen, nicht eingerichtet und „auf diesem Server aus“ stehen da', async () => {
    const vorher = h.apiGet.getMockImplementation()!;
    h.apiGet.mockImplementation((pfad: string, o?: unknown) => (pfad === '/support/mail/status'
      ? Promise.resolve({
        data: {
          postfaecher: [
            { postfach: 'moin', adresse: 'moin@konfi-quest.example', eingerichtet: true, abgeholt_am: '2026-10-03T07:00:00Z', fehler: 'Anmeldung abgelehnt', fehler_am: '2026-10-03T07:01:00Z' },
            { postfach: 'support', adresse: 'support@konfi-quest.example', eingerichtet: false, abgeholt_am: null, fehler: null, fehler_am: null, auf_diesem_server: false },
          ],
        },
      })
      : vorher(pfad, o as never)));
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
    server.stand.fehler.set('GET /support/mail/status', new Error('kaputt'));
    await zeigen();
    expect(screen.getByText('Der Zustand der Postfächer konnte nicht geladen werden.')).toBeInTheDocument();
    expect(zeilen()).toHaveLength(5);
  });
});

describe('Posteingang (Web): Laden, Fehler, leer', () => {
  it('Fehler: Hinweis mit erneutem Versuch, der wirklich neu lädt', async () => {
    server.stand.fehler.set('GET /support/mail/eingang', new Error('Netz weg'));
    render(<SupportPosteingangPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Der Posteingang konnte nicht geladen werden.');
    server.stand.fehler.delete('GET /support/mail/eingang');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' })); });
    expect(await screen.findByRole('table', { name: TABELLE })).toBeInTheDocument();
  });

  it('eine Antwort in unbekannter Form ist ein Fehler, kein Absturz', async () => {
    h.apiGet.mockImplementation((pfad: string) => (pfad === '/support/mail/eingang' ? Promise.resolve({ data: { irgendwas: true } }) : Promise.resolve({ data: {} })));
    render(<SupportPosteingangPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Der Posteingang konnte nicht geladen werden.');
  });

  it('Aktualisieren lädt neu', async () => {
    await zeigen();
    server.stand.mails.push(mail(310, null, { betreff: 'Frisch eingetroffen', gesendet_am: '2026-10-03T08:29:00Z' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Aktualisieren' })); });
    await waitFor(() => expect(betreffe()[0]).toBe('Frisch eingetroffen'));
  });
});

describe('Posteingang: zwei Gesichter, eine Seite', () => {
  it('im schmalen Fenster bleibt die App-Darstellung -- mit derselben Logik', async () => {
    h.breit = false;
    render(<SupportPosteingangPage />);
    expect(await screen.findByText('Postfächer')).toBeInTheDocument();
    expect(await screen.findByText('5 Mails zum Einsortieren')).toBeInTheDocument();
    expect(server.aufrufe('get', '/support/mail/eingang').map((a) => a.optionen)).toEqual([undefined]);
    expect(document.querySelector('.web-seite')).toBeNull();
  });

  it('ohne Super-Admin-Recht: Hinweis, kein Abruf', () => {
    h.user = { id: 5, display_name: 'Leitung', role_name: 'org_admin' };
    render(<SupportPosteingangPage />);
    expect(screen.getByText('Nur für den Support')).toBeInTheDocument();
    expect(server.aufrufe('get', '/support/mail/eingang')).toHaveLength(0);
  });
});
