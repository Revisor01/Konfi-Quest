// Eine Mail aus dem Posteingang in der Web-Fassung (/admin/support/post/:id),
// gerendert (docs/planung/support-vorgaenge.md, Entscheidung 7): wie ein
// Mailprogramm -- Kopf (Von, An, Datum, Postfach), Text, Anhänge, die weiteren
// Mails des Fadens, der Antwort-Editor; rechts „Einsortieren“ (bestehender oder
// neuer Vorgang), Archivieren, Wiederherstellen und Löschen. Die Logik ist die
// der App (usePostDetail, useEinsortieren). Im schmalen Fenster bleibt die
// Seite der App.
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

import SupportPostDetailPage from '../../../components/support/SupportPostDetailPage';
import { supportMailZaehlerZuruecksetzen } from '../../../navigation/supportMailZaehler';

let vorherTZ: string | undefined;
beforeAll(() => { vorherTZ = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherTZ === undefined) delete process.env.TZ; else process.env.TZ = vorherTZ; });

let server: ReturnType<typeof vorgaengeServer>;

// Ein Faden aus drei Mails ohne Vorgang; Reihenfolge im Speicher absichtlich durcheinander.
const FADEN = () => [
  mail(31, null, {
    faden: 'zugang', postfach: 'moin', von_adresse: 'anna@example.org', von_name: 'Anna Beispiel', an_adressen: ['moin@konfi-quest.example'],
    betreff: 'Frage zum Zugang', gesendet_am: '2026-10-03T09:00:00Z',
    text: 'Danke! Und noch eins.\n\nAm 02.10.2026 um 12:00 schrieb Support <moin@konfi-quest.example>:\n> alte Antwort', anhaenge: [{ name: 'plan.pdf' }],
  }),
  mail(29, null, { faden: 'zugang', postfach: 'moin', von_adresse: 'anna@example.org', von_name: 'Anna Beispiel', betreff: 'Frage zum Zugang', gesendet_am: '2026-10-02T08:00:00Z', text: 'Wie melde ich mich an?' }),
  mail(30, null, {
    faden: 'zugang', postfach: 'moin', richtung: 'aus', von_adresse: 'moin@konfi-quest.example', von_name: 'Support', an_adressen: ['anna@example.org'],
    betreff: 'Re: Frage zum Zugang', gesendet_am: '2026-10-02T10:00:00Z', gelesen_am: '2026-10-02T10:00:00Z', text: 'So geht es.',
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
  supportMailZaehlerZuruecksetzen();
  server = vorgaengeServer({ vorgaenge: VORGAENGE(), mails: FADEN() });
  server.installieren({ get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete });
});

const oeffnen = async (id = 31) => {
  render(<SupportPostDetailPage nachrichtId={id} />);
  await screen.findByRole('complementary', { name: 'Einsortieren' });
};
const seite = () => screen.getByRole('complementary', { name: 'Einsortieren' });
const hauptKarte = (titel: string) => screen.getByRole('heading', { level: 2, name: titel }).closest('section') as HTMLElement;
const bestaetigen = async (knopf: string) => { await act(async () => { h.alert?.buttons?.find((b) => b.text === knopf)?.handler?.(); }); };
const dialog = () => screen.getByRole('dialog', { name: 'Mail einsortieren' });

describe('Mail (Web): wie ein Mailprogramm', () => {
  it('der Betreff ist die Überschrift der Karte; der Kopf nennt Von, An, Datum und Postfach', async () => {
    await oeffnen();
    expect(screen.getByRole('heading', { level: 1, name: 'Mail' })).toBeInTheDocument();
    const karte = hauptKarte('Frage zum Zugang');
    const kopf = karte.querySelector('.web-mail__kopfdaten')!;
    expect([...kopf.querySelectorAll('dt')].map((d) => d.textContent)).toEqual(['Von', 'An', 'Datum', 'Postfach']);
    const werte = [...kopf.querySelectorAll('dd')].map((d) => d.textContent);
    expect(werte[0]).toBe('Anna Beispiel <anna@example.org>');
    expect(werte[1]).toBe('moin@konfi-quest.example');
    expect(werte[2]).toBe('03.10.2026, 11:00');
    expect(werte[3]).toContain('moin@');
    expect(werte[3]).toContain('Eingegangen');
    // Die geöffnete Mail war ungelesen: „Neu“ an ihr, für diesen Besuch.
    expect(werte[3]).toContain('Neu');
    expect(screen.getByText('03.10.2026, 11:00 · Faden mit 3 Mails')).toBeInTheDocument();
  });

  it('der Weg zurück ist ein Link auf den Posteingang, der in der App bleibt', async () => {
    await oeffnen();
    const zurueck = within(screen.getByRole('navigation', { name: 'Zurück' })).getByRole('link', { name: 'Posteingang' });
    expect(zurueck).toHaveAttribute('href', '/admin/support/post');
    fireEvent.click(zurueck);
    expect(h.push).toHaveBeenCalledWith('/admin/support/post', 'none', 'push');
  });

  it('Text mit eingeklapptem Zitat, Anhänge nur als Namen', async () => {
    await oeffnen();
    const karte = within(hauptKarte('Frage zum Zugang'));
    expect(karte.getByText('Danke! Und noch eins.')).toBeInTheDocument();
    expect(screen.queryByText(/alte Antwort/)).toBeNull();
    fireEvent.click(karte.getByRole('button', { name: 'Zitat einblenden' }));
    expect(screen.getByText(/alte Antwort/).textContent).toBe('Am 02.10.2026 um 12:00 schrieb Support <moin@konfi-quest.example>:\n> alte Antwort');
    expect(karte.getByRole('list', { name: 'Anhänge' }).textContent).toBe('plan.pdf');
  });

  it('die weiteren Mails des Fadens stehen darunter, älteste zuerst -- ohne die geöffnete', async () => {
    await oeffnen();
    const faden = screen.getByRole('list', { name: 'Weitere Mails im Faden' });
    expect(within(faden).getAllByRole('article').map((m) => m.getAttribute('aria-label'))).toEqual([
      'Eingegangen am 02.10.2026, 10:00',
      'Gesendet am 02.10.2026, 12:00',
    ]);
    expect(screen.getByRole('heading', { level: 2, name: 'Weitere Mails im Faden (2)' })).toBeInTheDocument();
    // Beim Öffnen waren 29 und 31 ungelesen: gemeldet, und 29 trägt „Neu“.
    await waitFor(() => expect(server.stand.mails.filter((m) => m.gelesen_am).map((m) => m.id).sort()).toEqual([29, 30, 31]));
    expect(within(faden).getAllByRole('article').map((m) => within(m).queryByText('Neu') !== null)).toEqual([true, false]);
  });

  it('die ungelesenen Mails des Fadens werden mit einem Aufruf gemeldet', async () => {
    await oeffnen();
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledWith('/support/mail/gelesen', { ids: [29, 31] }));
  });

  it('eine einzelne Mail hat keine Karte für weitere Mails', async () => {
    server.stand.mails = [mail(40, null, { betreff: 'Allein', von_name: 'Ben', gesendet_am: '2026-10-03T09:00:00Z' })];
    await oeffnen(40);
    expect(screen.queryByRole('heading', { name: /Weitere Mails/ })).toBeNull();
    expect(screen.getByText('03.10.2026, 11:00 · einzelne Mail')).toBeInTheDocument();
  });

  it('nichts ungelesen: kein Aufruf „gelesen“', async () => {
    server.stand.mails = [mail(40, null, { betreff: 'Allein', gelesen_am: '2026-10-03T09:30:00Z' })];
    await oeffnen(40);
    await act(async () => {});
    expect(h.apiPost).not.toHaveBeenCalled();
  });
});

describe('Mail (Web): einsortieren', () => {
  it('rechts steht „Einsortieren“ mit dem Hinweis, dass der ganze Faden mitgeht; Archivieren und Löschen darunter', async () => {
    await oeffnen();
    expect(within(seite()).getByRole('heading', { level: 2, name: 'Einsortieren' })).toBeInTheDocument();
    expect(within(seite()).getByText(/Der ganze Faden geht mit/)).toBeInTheDocument();
    for (const name of ['Einsortieren', 'Archivieren', 'Löschen']) expect(within(seite()).getByRole('button', { name }), name).toBeInTheDocument();
    expect(within(seite()).queryByRole('button', { name: 'Wiederherstellen' })).toBeNull();
  });

  it('in einen bestehenden Vorgang: ein Aufruf mit der Nummer; der ganze Faden geht mit; die Seite öffnet den Vorgang', async () => {
    await oeffnen();
    fireEvent.click(within(seite()).getByRole('button', { name: 'Einsortieren' }));
    await screen.findByRole('dialog', { name: 'Mail einsortieren' });
    await waitFor(() => expect(within(dialog()).queryAllByRole('radio').length).toBe(2));
    fireEvent.click(within(dialog()).getByRole('radio', { name: /Nr\. 2/ }));
    await act(async () => { fireEvent.click(within(dialog()).getByRole('button', { name: 'Einsortieren' })); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/einsortieren').map((a) => a.koerper)).toEqual([{ vorgang_id: 2 }]);
    expect(h.setSuccess).toHaveBeenCalledWith('Mail in Vorgang 2 einsortiert');
    expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge/2');
    expect(server.stand.mails.map((m) => [m.id, m.vorgang_id]).sort()).toEqual([[29, 2], [30, 2], [31, 2]]);
  });

  it('in einen neuen Vorgang: Art, Bereich, Betreff und Gemeinde gehen mit; danach öffnet sich der neue Vorgang', async () => {
    await oeffnen();
    fireEvent.click(within(seite()).getByRole('button', { name: 'Einsortieren' }));
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

  it('ein Fehler des Servers steht im Dialog; die Seite bleibt, wie sie ist', async () => {
    server.stand.fehler.set('POST /support/mail/nachrichten/31/einsortieren', Object.assign(new Error('x'), { response: { status: 500, data: { error: 'Datenbankfehler' } } }));
    await oeffnen();
    fireEvent.click(within(seite()).getByRole('button', { name: 'Einsortieren' }));
    await screen.findByRole('dialog', { name: 'Mail einsortieren' });
    await waitFor(() => expect(within(dialog()).queryAllByRole('radio').length).toBe(2));
    fireEvent.click(within(dialog()).getByRole('radio', { name: /Nr\. 1/ }));
    await act(async () => { fireEvent.click(within(dialog()).getByRole('button', { name: 'Einsortieren' })); });
    expect(within(dialog()).getByRole('alert')).toHaveTextContent('Datenbankfehler');
    expect(h.push).not.toHaveBeenCalled();
  });

  it('liegt die Mail schon in einem Vorgang: Hinweis mit Link, „Anderem Vorgang zuordnen“, kein Antwort-Editor', async () => {
    server.stand.mails.forEach((m) => { m.vorgang_id = 2; });
    await oeffnen();
    const hinweis = within(seite()).getByText('Einsortiert in Vorgang 2').closest('.web-hinweis') as HTMLElement;
    const link = within(hinweis).getByRole('link', { name: 'Vorgang öffnen' });
    expect(link).toHaveAttribute('href', '/admin/support/vorgaenge/2');
    fireEvent.click(link);
    expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge/2', 'none', 'push');
    expect(within(seite()).getByRole('button', { name: 'Anderem Vorgang zuordnen' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Antworten' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Antwort senden' })).toBeNull();
  });

  it('ohne Netz ist „Einsortieren“ gesperrt', async () => {
    h.online = false;
    await oeffnen();
    for (const name of ['Einsortieren', 'Archivieren', 'Löschen']) expect(within(seite()).getByRole('button', { name }), name).toBeDisabled();
  });
});

describe('Mail (Web): archivieren, wiederherstellen, löschen', () => {
  it('Archivieren: eine Anfrage an die Mail; die Seite zeigt, dass sie im Archiv liegt, und bietet „Wiederherstellen“', async () => {
    await oeffnen();
    await act(async () => { fireEvent.click(within(seite()).getByRole('button', { name: 'Archivieren' })); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/archivieren')).toHaveLength(1);
    expect(h.setSuccess).toHaveBeenCalledWith('1 Mail archiviert');
    expect(await screen.findByText('Diese Mail liegt im Archiv')).toBeInTheDocument();
    expect(screen.getByText(/Nach 180 Tagen wird sie gelöscht/)).toBeInTheDocument();
    expect(within(seite()).getByRole('button', { name: 'Wiederherstellen' })).toBeInTheDocument();
    expect(within(seite()).queryByRole('button', { name: 'Archivieren' })).toBeNull();
    // Eine archivierte Mail wird nicht beantwortet.
    expect(screen.queryByRole('button', { name: 'Antwort senden' })).toBeNull();
  });

  it('Wiederherstellen: die Mail ist wieder im Posteingang, der Editor ist wieder da', async () => {
    server.stand.mails.find((m) => m.id === 31)!.archiviert_am = '2026-10-02T12:00:00Z';
    await oeffnen();
    expect(screen.getByText('Diese Mail liegt im Archiv')).toBeInTheDocument();
    await act(async () => { fireEvent.click(within(seite()).getByRole('button', { name: 'Wiederherstellen' })); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/wiederherstellen')).toHaveLength(1);
    expect(h.setSuccess).toHaveBeenCalledWith('1 Mail wiederhergestellt – wieder im Posteingang');
    await waitFor(() => expect(screen.queryByText('Diese Mail liegt im Archiv')).toBeNull());
    expect(await screen.findByRole('button', { name: 'Antwort senden' })).toBeInTheDocument();
  });

  it('Löschen fragt zuerst und sagt, dass im Postfach alles stehen bleibt; erst „Löschen“ löscht und führt zurück zum Posteingang', async () => {
    await oeffnen();
    fireEvent.click(within(seite()).getByRole('button', { name: 'Löschen' }));
    expect(h.alert?.header).toBe('Mail löschen');
    expect(h.alert?.message).toContain('Im Postfach selbst bleibt alles stehen');
    expect(server.aufrufe('delete')).toHaveLength(0);
    await bestaetigen('Löschen');
    expect(server.aufrufe('delete', '/support/mail/nachrichten/31')).toHaveLength(1);
    expect(h.setSuccess).toHaveBeenCalledWith('1 Mail gelöscht');
    expect(h.push).toHaveBeenCalledWith('/admin/support/post', 'back', 'replace');
  });

  it('Abbrechen löscht nichts', async () => {
    await oeffnen();
    fireEvent.click(within(seite()).getByRole('button', { name: 'Löschen' }));
    await bestaetigen('Abbrechen');
    expect(server.aufrufe('delete')).toHaveLength(0);
    expect(h.push).not.toHaveBeenCalled();
  });

  it('ein Fehler beim Löschen: Meldung, die Seite bleibt', async () => {
    server.stand.fehler.set('DELETE /support/mail/nachrichten/31', new Error('Netz weg'));
    await oeffnen();
    fireEvent.click(within(seite()).getByRole('button', { name: 'Löschen' }));
    await bestaetigen('Löschen');
    expect(h.setError).toHaveBeenCalledWith('Löschen hat nicht geklappt');
    expect(h.push).not.toHaveBeenCalled();
  });
});

describe('Mail (Web): antworten', () => {
  it('an den Absender der letzten eingehenden Mail, Betreff vorgeschlagen, mit Rückfrage; danach neu geladen', async () => {
    await oeffnen();
    expect(screen.getByText(/^An:/, { selector: 'p.web-antwort__an' })).toHaveTextContent('An: anna@example.org · von moin@');
    expect((screen.getByLabelText('Betreff') as HTMLInputElement).value).toBe('Re: Frage zum Zugang');
    fireEvent.change(screen.getByLabelText('Text der Antwort'), { target: { value: 'Hallo Anna,\nso geht es.' } });
    expect(screen.getByRole('region', { name: 'Vorschau der Antwort' }).textContent).toBe('Hallo Anna,\nso geht es.\n\n-- \nKonfi Quest');
    fireEvent.click(screen.getByRole('button', { name: 'Antwort senden' }));
    expect(h.alert?.header).toBe('Antwort senden');
    expect(h.alert?.message).toBe('An anna@example.org: „Re: Frage zum Zugang“ von moin@ senden?');
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/antworten')).toHaveLength(0);

    const abrufeVorher = server.aufrufe('get', '/support/mail/nachrichten/31').length;
    await act(async () => { h.alert?.buttons?.find((b) => b.text === 'Senden')?.handler?.(); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/antworten').map((a) => a.koerper)).toEqual([{ text: 'Hallo Anna,\nso geht es.', betreff: 'Re: Frage zum Zugang' }]);
    expect(h.setSuccess).toHaveBeenCalledWith('Antwort gesendet');
    await waitFor(() => expect(server.aufrufe('get', '/support/mail/nachrichten/31').length).toBe(abrufeVorher + 1));
    expect((screen.getByLabelText('Text der Antwort') as HTMLTextAreaElement).value).toBe('');
  });
});

describe('Mail (Web): Laden, Fehler, nicht gefunden', () => {
  it('404: „Mail nicht gefunden“; eine ungültige Kennung ruft nichts ab', async () => {
    const { unmount } = render(<SupportPostDetailPage nachrichtId={999} />);
    expect(await screen.findByText('Mail nicht gefunden')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Posteingang' })).toBeInTheDocument();
    unmount();
    server.stand.aufrufe.length = 0;
    render(<SupportPostDetailPage nachrichtId={Number.NaN} />);
    expect(await screen.findByText('Mail nicht gefunden')).toBeInTheDocument();
    expect(server.aufrufe('get', /^\/support\/mail\/nachrichten/)).toHaveLength(0);
  });

  it('Netzfehler: Hinweis mit erneutem Versuch, der wirklich neu lädt', async () => {
    server.stand.fehler.set('GET /support/mail/nachrichten/31', new Error('Netz weg'));
    render(<SupportPostDetailPage nachrichtId={31} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Mail konnte nicht geladen werden.');
    server.stand.fehler.delete('GET /support/mail/nachrichten/31');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' })); });
    expect(await screen.findByRole('heading', { level: 2, name: 'Frage zum Zugang' })).toBeInTheDocument();
  });

  it('beim Laden steht ein Platzhalter', () => {
    h.apiGet.mockImplementation(() => new Promise(() => {}));
    render(<SupportPostDetailPage nachrichtId={31} />);
    expect(screen.getByRole('status')).toHaveTextContent('Die Mail wird geladen.');
  });
});

describe('Mail: zwei Gesichter, eine Seite', () => {
  it('im schmalen Fenster bleibt die App-Darstellung -- mit derselben Logik', async () => {
    h.breit = false;
    render(<SupportPostDetailPage nachrichtId={31} />);
    await screen.findByText('Faden mit 3 Mails');
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
