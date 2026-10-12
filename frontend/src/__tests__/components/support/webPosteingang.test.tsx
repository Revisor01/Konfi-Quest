// Posteingang in der Web-Fassung, gerendert (docs/planung/support-vorgaenge.md,
// Entscheidung 7): nur die Mails, die in keinem Vorgang liegen und nicht
// archiviert sind. Wie ein Mailprogramm (11.10.2026): links die Mails als
// Zeilen, rechts die gewählte im Lesebereich mit „Einsortieren“ (bestehender
// Vorgang mit Suche oder neuer Vorgang mit Art, Bereich, Gemeinde),
// Archivieren und Löschen; mehrere Mails lassen sich ankreuzen; Filter Alle,
// Ungelesen, moin@, support@ und Archiv; oben der Zustand der Postfächer als
// eine Zeile. Im schmalen Fenster bleibt der Posteingang der App.
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
  window.history.replaceState(null, '', '/admin/support/post');
  supportMailZaehlerZuruecksetzen();
  server = vorgaengeServer({ vorgaenge: VORGAENGE(), mails: MAILS() });
  server.installieren({ get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-03T08:30:00Z'));
});
afterEach(() => { vi.useRealTimers(); });

const LISTE = 'Mails im Posteingang';
const zeigen = async (name = LISTE) => {
  render(<SupportPosteingangPage />);
  await screen.findByRole('navigation', { name });
};
const liste = (name = LISTE) => screen.getByRole('navigation', { name });
const zeilen = (name = LISTE) => [...liste(name).querySelectorAll<HTMLElement>('li.web-postfachzeile')];
const betreffe = (name = LISTE) => zeilen(name).map((z) => z.querySelector('.web-postfachzeile__betreff')!.textContent);
const zeileVon = (betreff: string, name = LISTE) => zeilen(name).find((z) => z.querySelector('.web-postfachzeile__betreff')!.textContent === betreff)!;
const zeilenKnopf = (betreff: string, name = LISTE) => zeileVon(betreff, name).querySelector('button') as HTMLButtonElement;
const chip = (name: RegExp | string) => within(screen.getByRole('group', { name: 'Mails filtern' })).getByRole('button', { name });
const bestaetigen = async (knopf: string) => { await act(async () => { h.alert?.buttons?.find((b) => b.text === knopf)?.handler?.(); }); };
/** Eine Mail wählen: Klick auf die Zeile; rechts steht sie dann im Lesebereich. */
const waehlen = async (betreff: string, name = LISTE) => {
  fireEvent.click(zeilenKnopf(betreff, name));
  return screen.findByRole('article', { name: betreff });
};

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
    await screen.findByRole('navigation', { name: 'Archivierte Mails' });
  });

  it('beim Öffnen ist keine Mail gewählt: rechts steht ein Hinweis, keine Mail wird abgerufen oder als gelesen gemeldet', async () => {
    await zeigen();
    expect(screen.getByText('Keine Mail gewählt')).toBeInTheDocument();
    expect(screen.getByText('Wähle links eine Mail — sie öffnet sich hier.')).toBeInTheDocument();
    expect(within(liste()).queryAllByRole('button', { current: true })).toHaveLength(0);
    expect(server.aufrufe('get', /^\/support\/mail\/nachrichten\//)).toHaveLength(0);
    expect(h.apiPost).not.toHaveBeenCalledWith('/support/mail/gelesen', expect.anything());
  });
});

describe('Posteingang (Web): Liste', () => {
  it('eine Zeile je Mail ohne Vorgang, neueste zuerst; Mails in einem Vorgang und archivierte fehlen', async () => {
    await zeigen();
    expect(betreffe()).toEqual(['Rückfrage zur Lizenz', 'Frage zu den Jahrgängen', 'Passwort vergessen?', 'Angebot', 'Pressemitteilung']);
    expect(screen.getByRole('heading', { level: 1, name: 'Posteingang' })).toBeInTheDocument();
    expect(screen.getByText('5 Mails warten darauf, einem Vorgang zugeordnet zu werden')).toBeInTheDocument();
  });

  it('Absender (Name, sonst Adresse), Zeit, Betreff, Auszug und Postfach stehen in der Zeile', async () => {
    await zeigen();
    const z = zeilen();
    const teil = (x: HTMLElement, klasse: string) => x.querySelector(`.web-postfachzeile__${klasse}`)!.textContent;
    expect(z.map((x) => teil(x, 'titel'))).toEqual(['Pastorin Lena Probe', 'Sam Muster', 'info@beispiel-verein.example', 'Jan Vorlage', 'Presseverteiler']);
    expect(z.map((x) => teil(x, 'marken'))).toEqual(['moin@', 'support@', 'support@', 'moin@', 'moin@']);
    expect(teil(z[0], 'text')).toBe('Vielen Dank für die schnelle Rückmeldung!');
    // Der Auszug in eigener Spanne -- nur so kürzt er mit „…" statt mitten im Buchstaben (gesehen 11.10.2026).
    expect(teil(z[0], 'auszug')).toBe('Vielen Dank für die schnelle Rückmeldung!');
    // Heute die Uhrzeit, gestern „gestern, …“, sonst das Datum -- in deutscher Zeit.
    expect(z.map((x) => teil(x, 'zeit'))).toEqual(['10:18', '09:35', '05:30', 'gestern, 12:30', '28.09., 12:30']);
    expect(z[0].querySelector('time')).toHaveAttribute('title', '03.10.2026, 10:18');
    // Der Name ersetzt den Inhalt des Knopfes; Postfach, Anhänge und Auszug hören Vorleseprogramme als Beschreibung.
    expect(z[0].querySelector('button')).toHaveAccessibleDescription('an moin@ · Vielen Dank für die schnelle Rückmeldung!');
    expect(z[3].querySelector('button')).toHaveAccessibleDescription('an moin@ · 2 Anhänge · Könnten Sie uns ein Angebot senden?');
  });

  it('vor jeder Zeile der Kreis mit den Initialen des Absenders -- derselbe wie im Kopf der Mail; der Betreff als Kern ohne Re:/AW:', async () => {
    server.stand.mails.find((m) => m.id === 301)!.betreff = 'AW: Re: [Anfrage 41] Rückfrage zur Lizenz';
    await zeigen();
    expect(zeilen().map((z) => z.querySelector('.web-mail-kreis')?.textContent)).toEqual(['PL', 'SM', 'I', 'JV', 'P']);
    expect(zeilen()[0].querySelector('.web-mail-kreis')).toHaveAttribute('aria-hidden', 'true');
    expect(zeilen()[0].querySelector('button')!.className).toContain('web-postfachzeile__knopf--kreis');
    expect(betreffe()[0]).toBe('Rückfrage zur Lizenz');
    expect(zeilenKnopf('Rückfrage zur Lizenz')).toHaveAccessibleName('Pastorin Lena Probe: Rückfrage zur Lizenz, ungelesen');
  });

  it('ungelesene Mails tragen einen Punkt, stehen fett und sagen es dem Vorleseprogramm; gelesene nicht', async () => {
    await zeigen();
    const z = zeilen();
    expect(z.map((x) => x.querySelector('.app-ungelesen-punkt') !== null)).toEqual([true, true, true, false, false]);
    expect(z.map((x) => x.classList.contains('web-postfachzeile--ungelesen'))).toEqual([true, true, true, false, false]);
    expect(z[0].querySelector('button')).toHaveAccessibleName('Pastorin Lena Probe: Rückfrage zur Lizenz, ungelesen');
    expect(z[3].querySelector('button')).toHaveAccessibleName('Jan Vorlage: Angebot');
  });

  it('ein Klick wählt die Mail: die Zeile ist markiert, rechts steht die Mail, die Adresse folgt -- ohne neue Seite', async () => {
    await zeigen();
    const lese = await waehlen('Frage zu den Jahrgängen');
    expect(zeilenKnopf('Frage zu den Jahrgängen')).toHaveAttribute('aria-current', 'true');
    expect(zeileVon('Frage zu den Jahrgängen').classList.contains('web-postfachzeile--gewaehlt')).toBe(true);
    expect(within(liste()).getAllByRole('button', { current: true })).toHaveLength(1);
    expect(within(lese).getByRole('heading', { level: 2, name: 'Frage zu den Jahrgängen' })).toBeInTheDocument();
    expect(await within(lese).findByText('Guten Morgen, wir möchten den neuen Jahrgang anlegen.', { selector: 'p' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/admin/support/post/302');
    expect(h.push).not.toHaveBeenCalled();
    // Die gewählte Mail war ungelesen: gemeldet.
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledWith('/support/mail/gelesen', { ids: [302] }));
  });

  it('Pfeiltasten wählen die nächste und vorige Mail und nehmen den Fokus mit', async () => {
    await zeigen();
    await waehlen('Rückfrage zur Lizenz');
    zeilenKnopf('Rückfrage zur Lizenz').focus();
    fireEvent.keyDown(zeilenKnopf('Rückfrage zur Lizenz'), { key: 'ArrowDown' });
    expect(await screen.findByRole('article', { name: 'Frage zu den Jahrgängen' })).toBeInTheDocument();
    expect(zeilenKnopf('Frage zu den Jahrgängen')).toHaveAttribute('aria-current', 'true');
    expect(document.activeElement).toBe(zeilenKnopf('Frage zu den Jahrgängen'));
    fireEvent.keyDown(zeilenKnopf('Frage zu den Jahrgängen'), { key: 'ArrowDown' });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    // Oben bleibt oben.
    expect(await screen.findByRole('article', { name: 'Rückfrage zur Lizenz' })).toBeInTheDocument();
    expect(document.activeElement).toBe(zeilenKnopf('Rückfrage zur Lizenz'));
    expect(window.location.pathname).toBe('/admin/support/post/301');
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

  it('Archiv: die archivierten Mails; gewählt bietet der Lesebereich „Wiederherstellen“ statt „Archivieren“ und kein „Antworten“ -- die Zahl steht am Chip', async () => {
    await zeigen();
    expect(chip(/^Archiv/).querySelector('.web-chip__zahl')).toBeNull();
    fireEvent.click(chip(/^Archiv/));
    await screen.findByRole('navigation', { name: 'Archivierte Mails' });
    expect(betreffe('Archivierte Mails')).toEqual(['Sonderangebot']);
    const lese = within(await waehlen('Sonderangebot', 'Archivierte Mails'));
    expect(lese.getByText('Im Archiv seit 21.09.2026 · wird nach 180 Tagen gelöscht · Einsortieren holt sie zurück.')).toBeInTheDocument();
    expect(lese.getByRole('button', { name: 'Wiederherstellen' })).toBeInTheDocument();
    expect(lese.queryByRole('button', { name: 'Archivieren' })).toBeNull();
    expect(lese.queryByRole('button', { name: 'Antworten' })).toBeNull();
    expect(lese.getByRole('button', { name: 'Löschen' })).toBeInTheDocument();
    expect(chip(/^Archiv/)).toHaveTextContent('1');
    expect(screen.getByText('Archivierte Mails, die zu keinem Vorgang gehören')).toBeInTheDocument();
  });

  it('ein leeres Archiv und ein leerer Posteingang sagen es', async () => {
    server.stand.mails = server.stand.mails.filter((m) => m.id !== 306 && m.vorgang_id !== null);
    render(<SupportPosteingangPage />);
    // Ohne Mails steht der Hinweis in der Liste; der Lesebereich daneben bleibt.
    expect(await screen.findByText('Nichts einzusortieren')).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: LISTE })).getByText('Alles ist einsortiert. Neue Mails, die zu keinem Vorgang passen, erscheinen hier.')).toBeInTheDocument();
    expect(screen.getByText('Keine Mail gewählt')).toBeInTheDocument();
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
      await screen.findByRole('navigation', { name: LISTE });
      expect(eingestellt()).toEqual([name]);
      expect(zeilen()).toHaveLength(zahl);
      unmount();
    }
  });

  it('ein unbekannter Wert: Alle; eine neue Adresse bei offener Seite stellt um; auf einer anderen Seite rührt sie nichts an', async () => {
    h.standort = { pathname: '/admin/support/post', search: '?filter=blau', state: null };
    const { rerender } = render(<SupportPosteingangPage />);
    await screen.findByRole('navigation', { name: LISTE });
    expect(eingestellt()).toEqual(['Alle']);
    h.standort = { pathname: '/admin/support/post', search: '?filter=ungelesen', state: null };
    rerender(<SupportPosteingangPage />);
    expect(eingestellt()).toEqual(['Ungelesen']);
    h.standort = { pathname: '/admin/support/vorgaenge', search: '?filter=neu', state: null };
    rerender(<SupportPosteingangPage />);
    expect(eingestellt()).toEqual(['Ungelesen']);
  });

  it('beim Wählen bleibt der Filter in der Adresse stehen', async () => {
    window.history.replaceState(null, '', '/admin/support/post?filter=support');
    h.standort = { pathname: '/admin/support/post', search: '?filter=support', state: null };
    await zeigen();
    await waehlen('Passwort vergessen?');
    expect(`${window.location.pathname}${window.location.search}`).toBe('/admin/support/post/303?filter=support');
  });
});

describe('Posteingang (Web): Archivieren, Wiederherstellen, Löschen im Lesebereich', () => {
  it('Archivieren: eine Anfrage an die Mail; sie verlässt die Liste, rechts öffnet sich die nächste (Frage 6)', async () => {
    await zeigen();
    const lese = within(await waehlen('Frage zu den Jahrgängen'));
    await act(async () => { fireEvent.click(lese.getByRole('button', { name: 'Archivieren' })); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/302/archivieren')).toHaveLength(1);
    expect(h.setSuccess).toHaveBeenCalledWith('1 Mail archiviert');
    await waitFor(() => expect(betreffe()).toEqual(['Rückfrage zur Lizenz', 'Passwort vergessen?', 'Angebot', 'Pressemitteilung']));
    // Die nächste der Liste -- bis 11.10.2026 blieb die archivierte stehen.
    expect(await screen.findByRole('article', { name: 'Passwort vergessen?' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/admin/support/post/303');
    expect(zeilenKnopf('Passwort vergessen?')).toHaveAttribute('aria-current', 'true');
    expect(server.stand.mails.find((m) => m.id === 302)!.archiviert_am).not.toBeNull();
    fireEvent.click(chip(/^Archiv/));
    await waitFor(() => expect(betreffe('Archivierte Mails')).toEqual(['Frage zu den Jahrgängen', 'Sonderangebot']));
  });

  it('Wiederherstellen im Archiv: die Mail ist wieder im Posteingang', async () => {
    h.standort = { pathname: '/admin/support/post', search: '?filter=archiv', state: null };
    await zeigen('Archivierte Mails');
    const lese = within(await waehlen('Sonderangebot', 'Archivierte Mails'));
    await act(async () => { fireEvent.click(lese.getByRole('button', { name: 'Wiederherstellen' })); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/306/wiederherstellen')).toHaveLength(1);
    expect(h.setSuccess).toHaveBeenCalledWith('1 Mail wiederhergestellt – wieder im Posteingang');
    expect(await screen.findByText('Das Archiv ist leer')).toBeInTheDocument();
    expect(server.stand.mails.find((m) => m.id === 306)!.archiviert_am).toBeNull();
  });

  it('Löschen fragt zuerst und sagt, dass im Postfach alles stehen bleibt; erst „Löschen“ löscht -- die Zeile fehlt, rechts steht die nächste (Frage 6)', async () => {
    await zeigen();
    const lese = within(await waehlen('Passwort vergessen?'));
    fireEvent.click(lese.getByRole('button', { name: 'Löschen' }));
    expect(h.alert?.header).toBe('Mail löschen');
    expect(h.alert?.message).toContain('Im Postfach selbst bleibt alles stehen');
    expect(server.aufrufe('delete')).toHaveLength(0);
    await bestaetigen('Löschen');
    expect(server.aufrufe('delete', '/support/mail/nachrichten/303')).toHaveLength(1);
    expect(h.setSuccess).toHaveBeenCalledWith('1 Mail gelöscht');
    await waitFor(() => expect(betreffe()).not.toContain('Passwort vergessen?'));
    expect(zeilen()).toHaveLength(4);
    expect(await screen.findByRole('article', { name: 'Angebot' })).toBeInTheDocument();
    expect(screen.queryByText('Keine Mail gewählt')).toBeNull();
    expect(window.location.pathname).toBe('/admin/support/post/304');
    expect(h.push).not.toHaveBeenCalled();
  });

  it('Abbrechen löscht nichts', async () => {
    await zeigen();
    const lese = within(await waehlen('Passwort vergessen?'));
    fireEvent.click(lese.getByRole('button', { name: 'Löschen' }));
    await bestaetigen('Abbrechen');
    expect(server.aufrufe('delete')).toHaveLength(0);
    expect(zeilen()).toHaveLength(5);
    expect(screen.getByRole('article', { name: 'Passwort vergessen?' })).toBeInTheDocument();
  });

  it('ein Fehler beim Archivieren: Meldung, die Mail bleibt in der Liste', async () => {
    server.stand.fehler.set('POST /support/mail/nachrichten/302/archivieren', Object.assign(new Error('x'), { response: { status: 500, data: { error: 'Datenbankfehler' } } }));
    await zeigen();
    const lese = within(await waehlen('Frage zu den Jahrgängen'));
    await act(async () => { fireEvent.click(lese.getByRole('button', { name: 'Archivieren' })); });
    expect(h.setError).toHaveBeenCalledWith('Datenbankfehler');
    expect(zeilen()).toHaveLength(5);
  });

  it('ohne Netz sind Antworten, Einsortieren, Archivieren und Löschen gesperrt', async () => {
    h.online = false;
    await zeigen();
    const lese = within(await waehlen('Frage zu den Jahrgängen'));
    for (const name of ['Antworten', 'Einsortieren', 'Archivieren', 'Löschen']) expect(lese.getByRole('button', { name }), name).toBeDisabled();
  });
});

describe('Posteingang (Web): mehrere Mails auswählen', () => {
  const kasten = (betreff: string) => within(zeileVon(betreff)).getByRole('checkbox') as HTMLInputElement;
  const leiste = () => within(screen.getByRole('group', { name: 'Auswahl' }));

  it('die Kästchen sind benannt; die Leiste steht oben in der Liste: ohne Auswahl nur „Alle auswählen“, mit Auswahl Zahl und Aktionen', async () => {
    await zeigen();
    expect(kasten('Frage zu den Jahrgängen')).toHaveAccessibleName('Auswählen: Sam Muster: Frage zu den Jahrgängen');
    expect(liste().contains(screen.getByRole('group', { name: 'Auswahl' }))).toBe(true);
    expect(leiste().getByText('Alle auswählen')).toBeInTheDocument();
    expect(leiste().queryByRole('button')).toBeNull();
    fireEvent.click(kasten('Frage zu den Jahrgängen'));
    fireEvent.click(kasten('Passwort vergessen?'));
    expect(leiste().getByText('2 Mails ausgewählt')).toBeInTheDocument();
    expect(leiste().getByRole('button', { name: 'Archivieren' })).toBeInTheDocument();
    expect(leiste().getByRole('button', { name: 'Löschen' })).toBeInTheDocument();
    expect((leiste().getByRole('checkbox') as HTMLInputElement).indeterminate).toBe(true);
    // Ankreuzen wählt keine Mail zum Lesen.
    expect(screen.getByText('Keine Mail gewählt')).toBeInTheDocument();
  });

  it('Archivieren: ein Aufruf für alle gewählten; danach ist die Auswahl leer und die Liste neu', async () => {
    await zeigen();
    fireEvent.click(kasten('Frage zu den Jahrgängen'));
    fireEvent.click(kasten('Passwort vergessen?'));
    await act(async () => { fireEvent.click(leiste().getByRole('button', { name: 'Archivieren' })); });
    expect(server.aufrufe('post', '/support/mail/sammel').map((a) => a.koerper)).toEqual([{ ids: [302, 303], aktion: 'archivieren' }]);
    expect(h.setSuccess).toHaveBeenCalledWith('2 Mails archiviert');
    await waitFor(() => expect(betreffe()).toEqual(['Rückfrage zur Lizenz', 'Angebot', 'Pressemitteilung']));
    expect(leiste().getByText('Alle auswählen')).toBeInTheDocument();
  });

  it('Löschen fragt mit der Zahl; erst „Löschen“ löscht alle gewählten', async () => {
    await zeigen();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Alle auswählen' }));
    expect(screen.getByText('5 Mails ausgewählt')).toBeInTheDocument();
    fireEvent.click(leiste().getByRole('button', { name: 'Löschen' }));
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
    const lese = within(await waehlen('Frage zu den Jahrgängen'));
    await act(async () => { fireEvent.click(lese.getByRole('button', { name: 'Archivieren' })); });
    await waitFor(() => expect(betreffe()).not.toContain('Frage zu den Jahrgängen'));
    expect(screen.getByText('1 Mail ausgewählt')).toBeInTheDocument();
  });

  it('im Archiv: „Wiederherstellen“ für alle gewählten', async () => {
    server.stand.mails.push(mail(307, null, { betreff: 'Noch eine', archiviert_am: '2026-09-22T10:30:00Z', gelesen_am: '2026-09-22T11:00:00Z' }));
    h.standort = { pathname: '/admin/support/post', search: '?filter=archiv', state: null };
    await zeigen('Archivierte Mails');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Alle auswählen' }));
    await act(async () => { fireEvent.click(leiste().getByRole('button', { name: 'Wiederherstellen' })); });
    expect(server.aufrufe('post', '/support/mail/sammel').map((a) => a.koerper)).toEqual([{ ids: [307, 306], aktion: 'wiederherstellen' }]);
    expect(h.setSuccess).toHaveBeenCalledWith('2 Mails wiederhergestellt – wieder im Posteingang');
  });

  it('ein Fehler bei der Sammelaktion: Meldung, die Auswahl bleibt', async () => {
    server.stand.fehler.set('POST /support/mail/sammel', new Error('Netz weg'));
    await zeigen();
    fireEvent.click(kasten('Frage zu den Jahrgängen'));
    fireEvent.click(kasten('Passwort vergessen?'));
    await act(async () => { fireEvent.click(leiste().getByRole('button', { name: 'Archivieren' })); });
    expect(h.setError).toHaveBeenCalledWith('Archivieren hat nicht geklappt');
    expect(screen.getByText('2 Mails ausgewählt')).toBeInTheDocument();
  });
});

describe('Posteingang (Web): Einsortieren', () => {
  const dialog = () => screen.getByRole('dialog', { name: 'Mail einsortieren' });
  const oeffnen = async (betreff = 'Frage zu den Jahrgängen') => {
    await zeigen();
    const lese = within(await waehlen(betreff));
    fireEvent.click(lese.getByRole('button', { name: 'Einsortieren' }));
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

  it('einen bestehenden Vorgang wählen: ein Aufruf mit der Nummer; die Mail verlässt den Posteingang, der Vorgang öffnet sich', async () => {
    await oeffnen();
    const d = within(dialog());
    fireEvent.click(d.getByRole('radio', { name: /Nr\. 2/ }));
    await act(async () => { fireEvent.click(d.getByRole('button', { name: 'Einsortieren' })); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/302/einsortieren').map((a) => a.koerper)).toEqual([{ vorgang_id: 2 }]);
    expect(h.setSuccess).toHaveBeenCalledWith('Mail in Vorgang 2 einsortiert');
    expect(screen.queryByRole('dialog', { name: 'Mail einsortieren' })).toBeNull();
    // In den Vorgang, mit dieser Mail offen und hervorgehoben (E).
    expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge/2?mail=302');
    await waitFor(() => expect(betreffe()).not.toContain('Frage zu den Jahrgängen'));
    expect(zeilen()).toHaveLength(4);
    expect(server.stand.mails.find((m) => m.id === 302)!.vorgang_id).toBe(2);
    // Die Mail ist nicht mehr gewählt: Der Lesebereich lädt sie nicht neu und
    // meldet den Verlauf ihres Vorgangs nicht als gelesen (bis 11.10.2026 sank
    // so die rote Zahl der Vorgänge, ohne dass jemand den Vorgang öffnete).
    expect(screen.getByText('Keine Mail gewählt')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/admin/support/post');
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
    expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge/100?mail=302');
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
    expect(h.push).not.toHaveBeenCalled();
    expect(zeilen()).toHaveLength(5);
  });

  it('die Vorgänge lassen sich nicht laden: der Dialog sagt das und bleibt für „Neuer Vorgang“ benutzbar', async () => {
    await zeigen();
    const lese = within(await waehlen('Frage zu den Jahrgängen'));
    server.stand.fehler.set('GET /support/vorgaenge', new Error('Netz weg'));
    fireEvent.click(lese.getByRole('button', { name: 'Einsortieren' }));
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
  const statusAntwort = (postfaecher: unknown[]) => {
    const vorher = h.apiGet.getMockImplementation()!;
    h.apiGet.mockImplementation((pfad: string, o?: unknown) => (pfad === '/support/mail/status'
      ? Promise.resolve({ data: { postfaecher } })
      : vorher(pfad, o as never)));
  };
  const LAEUFT = { postfach: 'support', adresse: 'support@konfi-quest.example', eingerichtet: true, abgeholt_am: '2026-10-03T08:29:00Z', fehler: null, fehler_am: null, auf_diesem_server: true };

  it('laufen beide Postfächer, steht eine Zeile da: beide Namen und wann zuletzt abgeholt -- keine Kästen', async () => {
    await zeigen();
    const zeile = screen.getByText(/zuletzt abgeholt/, { selector: 'p.web-postfachstand' });
    expect(zeile).toHaveTextContent('moin@ und support@ zuletzt abgeholt vor 1 Min.');
    expect(document.querySelectorAll('.web-status')).toHaveLength(0);
  });

  it('Fehler beim Abholen und „auf diesem Server aus“: je ein Kasten mit dem Grund, keine Zeile', async () => {
    statusAntwort([
      { postfach: 'moin', adresse: 'moin@konfi-quest.example', eingerichtet: true, abgeholt_am: '2026-10-03T07:00:00Z', fehler: 'Anmeldung abgelehnt', fehler_am: '2026-10-03T07:01:00Z' },
      { postfach: 'support', adresse: 'support@konfi-quest.example', eingerichtet: false, abgeholt_am: null, fehler: null, fehler_am: null, auf_diesem_server: false },
    ]);
    await zeigen();
    const moin = screen.getByText('moin@konfi-quest.example').closest('.web-status') as HTMLElement;
    expect(moin.className).toContain('web-status--fehler');
    expect(moin).toHaveTextContent('Fehler beim Abholen: Anmeldung abgelehnt (03.10.2026, 09:01)');
    const support = screen.getByText('support@konfi-quest.example').closest('.web-status') as HTMLElement;
    expect(support).toHaveTextContent('Auf diesem Server aus');
    expect(support.className).toContain('web-status--warnung');
    expect(document.querySelector('.web-postfachstand')).toBeNull();
  });

  it('nur das gestörte Postfach bekommt einen Kasten -- nicht eingerichtet sagt, was fehlt', async () => {
    statusAntwort([
      { postfach: 'moin', adresse: 'moin@konfi-quest.example', eingerichtet: false, abgeholt_am: null, fehler: null, fehler_am: null, auf_diesem_server: true },
      LAEUFT,
    ]);
    await zeigen();
    expect(document.querySelectorAll('.web-status')).toHaveLength(1);
    const moin = screen.getByText('moin@konfi-quest.example').closest('.web-status') as HTMLElement;
    expect(moin).toHaveTextContent('Nicht eingerichtet');
    expect(moin).toHaveTextContent('Zugangsdaten fehlen');
    expect(screen.queryByText('support@konfi-quest.example')).toBeNull();
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
    expect(await screen.findByRole('navigation', { name: LISTE })).toBeInTheDocument();
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
    expect(await screen.findByText(/moin@ und support@ eingerichtet/)).toBeInTheDocument();
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
