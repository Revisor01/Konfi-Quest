// Eine Mail aus dem Posteingang in der Web-Fassung (/admin/support/post/:id),
// gerendert (docs/planung/support-vorgaenge.md, Entscheidung 7): wie ein
// Mailprogramm (11.10.2026) -- die Adresse öffnet den Posteingang mit dieser
// Mail im Lesebereich rechts. Kopf mit Betreff, Absender und Postfach, Knöpfe
// Antworten, Einsortieren (Dialog), Archivieren oder Wiederherstellen, Löschen;
// darunter der Faden als Gespräch (MailGespraeche). Die Logik ist die der App
// (usePostDetail, useEinsortieren). Im schmalen Fenster bleibt die Seite der App.
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
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
  user: { id: 9, role_name: 'super_admin', is_super_admin: true } as Record<string, unknown>,
  standort: { pathname: '/admin/support/post/31', search: '', state: null },
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
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: h.online }),
}));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../../navigation/useAppLocation', () => ({ useAppLocation: () => h.standort }));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));

import SupportPostDetailPage from '../../../components/support/SupportPostDetailPage';
import { supportMailZaehlerZuruecksetzen } from '../../../navigation/supportMailZaehler';

let vorherTZ: string | undefined;
beforeAll(() => { vorherTZ = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherTZ === undefined) delete process.env.TZ; else process.env.TZ = vorherTZ; });

let server: ReturnType<typeof vorgaengeServer>;

// Ein Faden aus drei Mails ohne Vorgang; Reihenfolge im Speicher absichtlich
// durcheinander. Die Kopfzeilen verketten sie: 29 <- 30 <- 31.
const FADEN = () => [
  mail(31, null, {
    faden: 'zugang', postfach: 'moin', von_adresse: 'anna@example.org', von_name: 'Anna Beispiel', an_adressen: ['moin@konfi-quest.example'],
    betreff: 'Frage zum Zugang', gesendet_am: '2026-10-03T09:00:00Z', message_id: '<z3@ex>', in_reply_to: '<z2@kq>', referenzen: ['<z1@ex>', '<z2@kq>'],
    text: 'Danke! Und noch eins.\n\nAm 02.10.2026 um 12:00 schrieb Support <moin@konfi-quest.example>:\n> alte Antwort', anhaenge: [{ name: 'plan.pdf' }],
  }),
  mail(29, null, { faden: 'zugang', postfach: 'moin', von_adresse: 'anna@example.org', von_name: 'Anna Beispiel', betreff: 'Frage zum Zugang', gesendet_am: '2026-10-02T08:00:00Z', text: 'Wie melde ich mich an?', message_id: '<z1@ex>' }),
  mail(30, null, {
    faden: 'zugang', postfach: 'moin', richtung: 'aus', von_adresse: 'moin@konfi-quest.example', von_name: 'Support', an_adressen: ['anna@example.org'],
    betreff: 'Re: Frage zum Zugang', gesendet_am: '2026-10-02T10:00:00Z', gelesen_am: '2026-10-02T10:00:00Z', text: 'So geht es.\n\n-- \nKonfi Quest · Fußzeile',
    message_id: '<z2@kq>', in_reply_to: '<z1@ex>', referenzen: ['<z1@ex>'],
  }),
];

const VORGAENGE = () => [
  vorgang(1, { status: 'neu', art: 'fehler', bereich: 'chat', betreff: 'Chat zeigt nichts Neues', organization_id: 7, created_at: '2026-10-03T07:00:00Z' }),
  vorgang(2, { status: 'in_arbeit', art: 'frage', bereich: 'konten', betreff: 'Wie lege ich einen Jahrgang an?', created_at: '2026-10-02T09:00:00Z' }),
];

beforeEach(() => {
  vi.clearAllMocks();
  h.alert = null;
  h.breit = true;
  h.online = true;
  h.user = { id: 9, role_name: 'super_admin', is_super_admin: true };
  h.standort = { pathname: '/admin/support/post/31', search: '', state: null };
  window.history.replaceState(null, '', '/admin/support/post/31');
  supportMailZaehlerZuruecksetzen();
  server = vorgaengeServer({ vorgaenge: VORGAENGE(), mails: FADEN() });
  server.installieren({ get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete });
});

const oeffnen = async (id = 31, titel = 'Frage zum Zugang') => {
  render(<SupportPostDetailPage nachrichtId={id} />);
  await screen.findByRole('article', { name: titel });
};
/** Der Lesebereich rechts: die gewählte Mail mit ihrem Faden. */
const lesen = (titel = 'Frage zum Zugang') => screen.getByRole('article', { name: titel });
const knopf = (name: string) => within(lesen()).getByRole('button', { name });
/** Der Kopf einer Mail im Gespräch (ein Knopf zum Auf- und Zuklappen). */
const mailKopf = (name: RegExp) => within(lesen()).getByRole('button', { name });
const bestaetigen = async (k: string) => { await act(async () => { h.alert?.buttons?.find((b) => b.text === k)?.handler?.(); }); };
const dialog = () => screen.getByRole('dialog', { name: 'Mail einsortieren' });

describe('Mail (Web): im Lesebereich neben dem Posteingang', () => {
  it('die Adresse einer Mail öffnet den Posteingang; die Mail steht rechts, ihre Zeile links ist gewählt', async () => {
    await oeffnen();
    expect(screen.getByRole('heading', { level: 1, name: 'Posteingang' })).toBeInTheDocument();
    const liste = screen.getByRole('navigation', { name: 'Mails im Posteingang' });
    // 29 und 31 tragen denselben Namen; gewählt ist genau eine Zeile -- die von 31 (die jüngere steht oben).
    const gewaehlt = within(liste).getAllByRole('button', { current: true });
    expect(gewaehlt).toHaveLength(1);
    expect(gewaehlt[0]).toHaveAccessibleName(/^Anna Beispiel: Frage zum Zugang/);
    expect(within(liste).getAllByRole('button', { name: /^Anna Beispiel: Frage zum Zugang/ }).indexOf(gewaehlt[0])).toBe(0);
    expect(within(lesen()).getByRole('heading', { level: 2, name: 'Frage zum Zugang' })).toBeInTheDocument();
  });

  it('der Kopf nennt Absender mit Adresse, Postfach und die Zahl der Mails im Faden', async () => {
    await oeffnen();
    const kopf = lesen().querySelector('.web-lesen__angaben') as HTMLElement;
    expect(kopf).toHaveTextContent('Anna Beispiel <anna@example.org>');
    expect(kopf).toHaveTextContent('moin@');
    expect(kopf).toHaveTextContent('3 Mails im Faden');
    for (const name of ['Antworten', 'Einsortieren', 'Archivieren', 'Löschen']) expect(knopf(name), name).toBeInTheDocument();
    expect(within(lesen()).queryByRole('button', { name: 'Wiederherstellen' })).toBeNull();
  });

  it('der Faden ist ein Gespräch: Antworten eingerückt unter ihrem Vorgänger; offen sind die jüngste und die ungelesenen', async () => {
    await oeffnen();
    const gespraech = within(lesen()).getByRole('region', { name: 'Frage zum Zugang' });
    const zeilen = [...gespraech.querySelectorAll<HTMLElement>('li.mail-zeile')];
    expect(zeilen.map((z) => z.querySelector('.mail-zeile__absender')?.textContent)).toEqual(['Anna Beispiel', 'Support', 'Anna Beispiel']);
    expect(zeilen.map((z) => z.className.match(/tiefe-(\d)/)?.[1])).toEqual(['0', '1', '2']);
    // 29 und 31 waren ungelesen: offen und „Neu“; die gesendete 30 ist zu und trägt „Gesendet“.
    const koepfe = zeilen.map((z) => within(z).getAllByRole('button')[0]);
    expect(koepfe.map((k) => k.getAttribute('aria-expanded'))).toEqual(['true', 'false', 'true']);
    expect(koepfe.map((k) => k.textContent?.includes('Neu'))).toEqual([true, false, true]);
    expect(koepfe[1]).toHaveTextContent('Gesendet');
    expect(koepfe[1]).toHaveTextContent('So geht es.');
  });

  it('Text mit eingeklapptem Zitat, Anhänge nur als Namen', async () => {
    await oeffnen();
    expect(within(lesen()).getByText('Danke! Und noch eins.')).toBeInTheDocument();
    expect(within(lesen()).queryByText(/alte Antwort/)).toBeNull();
    fireEvent.click(within(lesen()).getByRole('button', { name: 'Zitat einblenden' }));
    expect(within(lesen()).getByText(/alte Antwort/).textContent).toBe('Am 02.10.2026 um 12:00 schrieb Support <moin@konfi-quest.example>:\n> alte Antwort');
    expect(within(lesen()).getByRole('list', { name: 'Anhänge' }).textContent).toBe('plan.pdf');
  });

  it('die Signatur der gesendeten Mail ist eingeklappt, auch aufgeklappt', async () => {
    await oeffnen();
    fireEvent.click(mailKopf(/^Support/));
    expect(within(lesen()).getByText('So geht es.', { selector: 'p' })).toBeInTheDocument();
    expect(screen.queryByText(/Fußzeile/)).toBeNull();
    fireEvent.click(within(lesen()).getByRole('button', { name: 'Signatur einblenden' }));
    expect(screen.getByText('Konfi Quest · Fußzeile')).toBeInTheDocument();
  });

  it('die ungelesenen Mails des Fadens werden mit einem Aufruf gemeldet', async () => {
    await oeffnen();
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledWith('/support/mail/gelesen', { ids: [29, 31] }));
    await waitFor(() => expect(server.stand.mails.filter((m) => m.gelesen_am).map((m) => m.id).sort()).toEqual([29, 30, 31]));
  });

  it('eine einzelne Mail: „eine Mail“, ein Gespräch mit einer Zeile', async () => {
    server.stand.mails = [mail(40, null, { betreff: 'Allein', von_name: 'Ben', gesendet_am: '2026-10-03T09:00:00Z' })];
    await oeffnen(40, 'Allein');
    expect(lesen('Allein').querySelector('.web-lesen__angaben')).toHaveTextContent('eine Mail');
    expect(lesen('Allein').querySelectorAll('li.mail-zeile')).toHaveLength(1);
  });

  it('nichts ungelesen: kein Aufruf „gelesen“', async () => {
    server.stand.mails = [mail(40, null, { betreff: 'Allein', gelesen_am: '2026-10-03T09:30:00Z' })];
    await oeffnen(40, 'Allein');
    await act(async () => {});
    expect(h.apiPost).not.toHaveBeenCalled();
  });
});

describe('Mail (Web): einsortieren', () => {
  it('„Einsortieren“ öffnet den Dialog; in einen bestehenden Vorgang: ein Aufruf mit der Nummer, der ganze Faden geht mit, der Vorgang öffnet sich', async () => {
    await oeffnen();
    fireEvent.click(knopf('Einsortieren'));
    await screen.findByRole('dialog', { name: 'Mail einsortieren' });
    expect(within(dialog()).getByText(/Spätere Antworten darauf ordnet der Server dann selbst zu/)).toBeInTheDocument();
    await waitFor(() => expect(within(dialog()).queryAllByRole('radio').length).toBe(2));
    fireEvent.click(within(dialog()).getByRole('radio', { name: /Nr\. 2/ }));
    await act(async () => { fireEvent.click(within(dialog()).getByRole('button', { name: 'Einsortieren' })); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/einsortieren').map((a) => a.koerper)).toEqual([{ vorgang_id: 2 }]);
    expect(h.setSuccess).toHaveBeenCalledWith('Mail in Vorgang 2 einsortiert');
    expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge/2');
    expect(server.stand.mails.map((m) => [m.id, m.vorgang_id]).sort()).toEqual([[29, 2], [30, 2], [31, 2]]);
  });

  it('in einen neuen Vorgang: Art und Betreff gehen mit; danach öffnet sich der neue Vorgang', async () => {
    await oeffnen();
    fireEvent.click(knopf('Einsortieren'));
    await screen.findByRole('dialog', { name: 'Mail einsortieren' });
    const d = within(dialog());
    fireEvent.click(d.getByRole('button', { name: 'Neuer Vorgang' }));
    expect((d.getByLabelText('Betreff') as HTMLInputElement).value).toBe('Frage zum Zugang');
    fireEvent.change(d.getByLabelText('Art'), { target: { value: 'zugang' } });
    await act(async () => { fireEvent.click(d.getByRole('button', { name: 'Einsortieren' })); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/einsortieren').map((a) => a.koerper)).toEqual([
      { neu: { art: 'zugang', dringlichkeit: 'normal', betreff: 'Frage zum Zugang' } },
    ]);
    expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge/100');
  });

  it('ein Fehler des Servers steht im Dialog; nichts öffnet sich', async () => {
    server.stand.fehler.set('POST /support/mail/nachrichten/31/einsortieren', Object.assign(new Error('x'), { response: { status: 500, data: { error: 'Datenbankfehler' } } }));
    await oeffnen();
    fireEvent.click(knopf('Einsortieren'));
    await screen.findByRole('dialog', { name: 'Mail einsortieren' });
    await waitFor(() => expect(within(dialog()).queryAllByRole('radio').length).toBe(2));
    fireEvent.click(within(dialog()).getByRole('radio', { name: /Nr\. 1/ }));
    await act(async () => { fireEvent.click(within(dialog()).getByRole('button', { name: 'Einsortieren' })); });
    expect(within(dialog()).getByRole('alert')).toHaveTextContent('Datenbankfehler');
    expect(h.push).not.toHaveBeenCalled();
  });

  it('liegt die Mail schon in einem Vorgang: Hinweis mit Knopf zum Vorgang, „Umsortieren“, kein „Antworten“', async () => {
    server.stand.mails.forEach((m) => { m.vorgang_id = 2; });
    // Eine weitere Mail im Posteingang: ohne sie steht statt Liste und
    // Lesebereich nur „Nichts einzusortieren“ (siehe Bericht).
    server.stand.mails.push(mail(50, null, { betreff: 'Andere Mail', gesendet_am: '2026-10-03T06:00:00Z' }));
    await oeffnen();
    const hinweis = within(lesen()).getByText('Einsortiert in Vorgang 2').closest('.web-hinweis') as HTMLElement;
    const link = within(hinweis).getByRole('link', { name: 'Vorgang öffnen' });
    expect(link).toHaveAttribute('href', '/admin/support/vorgaenge/2');
    fireEvent.click(link);
    expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge/2', 'none', 'push');
    expect(knopf('Umsortieren')).toBeInTheDocument();
    expect(within(lesen()).queryByRole('button', { name: 'Antworten' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Antwort senden' })).toBeNull();
  });

  it('ohne Netz sind Antworten, Einsortieren, Archivieren und Löschen gesperrt', async () => {
    h.online = false;
    await oeffnen();
    for (const name of ['Antworten', 'Einsortieren', 'Archivieren', 'Löschen']) expect(knopf(name), name).toBeDisabled();
  });
});

describe('Mail (Web): archivieren, wiederherstellen, löschen', () => {
  it('Archivieren: eine Anfrage an die Mail; der Lesebereich zeigt, dass sie im Archiv liegt, und bietet „Wiederherstellen“', async () => {
    await oeffnen();
    await act(async () => { fireEvent.click(knopf('Archivieren')); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/archivieren')).toHaveLength(1);
    expect(h.setSuccess).toHaveBeenCalledWith('1 Mail archiviert');
    expect(await within(lesen()).findByText('Diese Mail liegt im Archiv')).toBeInTheDocument();
    expect(within(lesen()).getByText(/Nach 180 Tagen wird sie gelöscht/)).toBeInTheDocument();
    expect(knopf('Wiederherstellen')).toBeInTheDocument();
    expect(within(lesen()).queryByRole('button', { name: 'Archivieren' })).toBeNull();
    // Eine archivierte Mail wird nicht beantwortet.
    expect(within(lesen()).queryByRole('button', { name: 'Antworten' })).toBeNull();
  });

  it('Wiederherstellen: die Mail ist wieder im Posteingang, „Antworten“ ist wieder da', async () => {
    server.stand.mails.find((m) => m.id === 31)!.archiviert_am = '2026-10-02T12:00:00Z';
    await oeffnen();
    expect(within(lesen()).getByText('Diese Mail liegt im Archiv')).toBeInTheDocument();
    await act(async () => { fireEvent.click(knopf('Wiederherstellen')); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/wiederherstellen')).toHaveLength(1);
    expect(h.setSuccess).toHaveBeenCalledWith('1 Mail wiederhergestellt – wieder im Posteingang');
    await waitFor(() => expect(within(lesen()).queryByText('Diese Mail liegt im Archiv')).toBeNull());
    expect(await within(lesen()).findByRole('button', { name: 'Antworten' })).toBeInTheDocument();
  });

  it('Löschen fragt zuerst und sagt, dass im Postfach alles stehen bleibt; erst „Löschen“ löscht -- der Lesebereich ist danach leer, die Seite bleibt', async () => {
    await oeffnen();
    fireEvent.click(knopf('Löschen'));
    expect(h.alert?.header).toBe('Mail löschen');
    expect(h.alert?.message).toContain('Im Postfach selbst bleibt alles stehen');
    expect(server.aufrufe('delete')).toHaveLength(0);
    await bestaetigen('Löschen');
    expect(server.aufrufe('delete', '/support/mail/nachrichten/31')).toHaveLength(1);
    expect(h.setSuccess).toHaveBeenCalledWith('1 Mail gelöscht');
    expect(await screen.findByText('Keine Mail gewählt')).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Frage zum Zugang' })).toBeNull();
    expect(window.location.pathname).toBe('/admin/support/post');
    expect(h.push).not.toHaveBeenCalled();
  });

  it('Abbrechen löscht nichts', async () => {
    await oeffnen();
    fireEvent.click(knopf('Löschen'));
    await bestaetigen('Abbrechen');
    expect(server.aufrufe('delete')).toHaveLength(0);
    expect(lesen()).toBeInTheDocument();
  });

  it('ein Fehler beim Löschen: Meldung, die Mail bleibt im Lesebereich', async () => {
    server.stand.fehler.set('DELETE /support/mail/nachrichten/31', new Error('Netz weg'));
    await oeffnen();
    fireEvent.click(knopf('Löschen'));
    await bestaetigen('Löschen');
    expect(h.setError).toHaveBeenCalledWith('Löschen hat nicht geklappt');
    expect(lesen()).toBeInTheDocument();
    expect(h.push).not.toHaveBeenCalled();
  });
});

describe('Mail (Web): antworten', () => {
  it('„Antworten“ öffnet das Formular unter dem Verlauf: an den Absender der letzten eingehenden Mail, Betreff vorgeschlagen, mit Rückfrage; danach zu und neu geladen', async () => {
    await oeffnen();
    expect(screen.queryByLabelText('Text der Antwort')).toBeNull();
    fireEvent.click(knopf('Antworten'));
    const bereich = within(screen.getByRole('region', { name: 'Antwort schreiben' }));
    expect(bereich.getByText(/^An:/, { selector: 'p.web-antwort__an' })).toHaveTextContent('An: anna@example.org · von moin@');
    expect((bereich.getByLabelText('Betreff') as HTMLInputElement).value).toBe('Re: Frage zum Zugang');
    fireEvent.change(bereich.getByLabelText('Text der Antwort'), { target: { value: 'Hallo Anna,\nso geht es.' } });
    // Die Fußzeile kommt mit den Einstellungen, die das Formular beim Öffnen lädt.
    await waitFor(() => expect(bereich.getByRole('region', { name: 'Vorschau der Antwort' }).textContent).toBe('Hallo Anna,\nso geht es.\n\n-- \nKonfi Quest'));
    fireEvent.click(bereich.getByRole('button', { name: 'Antwort senden' }));
    expect(h.alert?.header).toBe('Antwort senden');
    expect(h.alert?.message).toBe('An anna@example.org: „Re: Frage zum Zugang“ von moin@ senden?');
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/antworten')).toHaveLength(0);

    const abrufeVorher = server.aufrufe('get', '/support/mail/nachrichten/31').length;
    await act(async () => { h.alert?.buttons?.find((b) => b.text === 'Senden')?.handler?.(); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/antworten').map((a) => a.koerper)).toEqual([{ text: 'Hallo Anna,\nso geht es.', betreff: 'Re: Frage zum Zugang' }]);
    expect(h.setSuccess).toHaveBeenCalledWith('Antwort gesendet');
    await waitFor(() => expect(server.aufrufe('get', '/support/mail/nachrichten/31').length).toBe(abrufeVorher + 1));
    expect(screen.queryByRole('region', { name: 'Antwort schreiben' })).toBeNull();
  });

  it('„Verwerfen“ schließt das Formular ohne Aufruf', async () => {
    await oeffnen();
    fireEvent.click(knopf('Antworten'));
    fireEvent.click(within(screen.getByRole('region', { name: 'Antwort schreiben' })).getByRole('button', { name: 'Verwerfen' }));
    expect(screen.queryByRole('region', { name: 'Antwort schreiben' })).toBeNull();
    expect(server.aufrufe('post', /antworten$/)).toHaveLength(0);
  });
});

describe('Mail (Web): Laden, Fehler, nicht gefunden', () => {
  it('404: „Mail nicht gefunden“ im Lesebereich, der Posteingang daneben bleibt', async () => {
    render(<SupportPostDetailPage nachrichtId={999} />);
    expect(await screen.findByText('Mail nicht gefunden')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Posteingang' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Mails im Posteingang' })).toBeInTheDocument();
    expect(server.aufrufe('get', '/support/mail/nachrichten/999')).toHaveLength(1);
  });

  it('Netzfehler: Hinweis mit erneutem Versuch, der wirklich neu lädt', async () => {
    server.stand.fehler.set('GET /support/mail/nachrichten/31', new Error('Netz weg'));
    render(<SupportPostDetailPage nachrichtId={31} />);
    expect(await screen.findByText('Die Mail konnte nicht geladen werden.')).toBeInTheDocument();
    server.stand.fehler.delete('GET /support/mail/nachrichten/31');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' })); });
    expect(await screen.findByRole('heading', { level: 2, name: 'Frage zum Zugang' })).toBeInTheDocument();
  });

  it('beim Laden steht ein Platzhalter', () => {
    h.apiGet.mockImplementation(() => new Promise(() => {}));
    render(<SupportPostDetailPage nachrichtId={31} />);
    expect(screen.getByText('Der Posteingang wird geladen.')).toBeInTheDocument();
  });
});

describe('Mail: zwei Gesichter, eine Seite', () => {
  it('im schmalen Fenster bleibt die App-Darstellung -- mit derselben Logik', async () => {
    h.breit = false;
    render(<SupportPostDetailPage nachrichtId={31} />);
    await screen.findByRole('heading', { level: 2, name: 'Frage zum Zugang' });
    expect(document.querySelector('.web-seite')).toBeNull();
    expect(screen.getByRole('button', { name: 'Einsortieren' })).toBeInTheDocument();
  });

  it('ohne Super-Admin-Recht: Hinweis, kein Abruf', () => {
    h.user = { id: 5, role_name: 'org_admin', is_super_admin: false };
    render(<SupportPostDetailPage nachrichtId={31} />);
    expect(screen.getByText('Nur für den Support')).toBeInTheDocument();
    expect(h.apiGet).not.toHaveBeenCalled();
  });
});
