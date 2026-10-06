// Eine Mail aus dem Posteingang in der App-Fassung (/admin/support/post/:id),
// gerendert (docs/planung/support-vorgaenge.md, Entscheidung 7): Faden
// chronologisch mit ein- und ausgehenden Mails, Zitate eingeklappt, Anhänge nur
// als Namen, ungelesene als gelesen gemeldet; Einsortieren in einen
// bestehenden oder neuen Vorgang; Archivieren, Wiederherstellen und Löschen mit
// Rückfrage; Antworten an den Absender mit Rückfrage. Die Web-Fassung steht in
// webPostDetail.test.tsx -- beide teilen die Logik.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
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
  online: true,
  user: { id: 9, role_name: 'super_admin', is_super_admin: true } as Record<string, unknown>,
}));

vi.mock('@ionic/react', async () => (await import('./ionicAttrappe')).ionicAttrappe({
  presentAlert: (o) => { h.alert = o; },
  router: { push: h.push, goBack: vi.fn(), canGoBack: () => false },
}));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('./ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: ({ message }: { message: string }) => <p>{message}</p> }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: h.online }),
}));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => false }));

import SupportPostDetailPage from '../../../components/support/SupportPostDetailPage';
import { supportMailZaehlerZuruecksetzen } from '../../../navigation/supportMailZaehler';

let server: ReturnType<typeof vorgaengeServer>;

// Ein Faden aus drei Mails ohne Vorgang; Reihenfolge im Speicher absichtlich durcheinander.
const FADEN = () => [
  mail(31, null, {
    faden: 'zugang', postfach: 'moin', von_adresse: 'anna@example.org', von_name: 'Anna Beispiel', an_adressen: ['moin@konfi-quest.de'],
    betreff: 'Frage zum Zugang', gesendet_am: '2026-10-03T09:00:00Z',
    text: 'Danke! Und noch eins.\n\nAm 02.10.2026 um 12:00 schrieb Support <moin@konfi-quest.de>:\n> alte Antwort', anhaenge: [{ name: 'plan.pdf' }],
  }),
  mail(29, null, { faden: 'zugang', postfach: 'moin', von_adresse: 'anna@example.org', von_name: 'Anna Beispiel', betreff: 'Frage zum Zugang', gesendet_am: '2026-10-02T08:00:00Z', text: 'Wie melde ich mich an?' }),
  mail(30, null, {
    faden: 'zugang', postfach: 'moin', richtung: 'aus', von_adresse: 'moin@konfi-quest.de', von_name: 'Support', an_adressen: ['anna@example.org'],
    betreff: 'Re: Frage zum Zugang', gesendet_am: '2026-10-02T10:00:00Z', gelesen_am: '2026-10-02T10:00:00Z', text: 'So geht es.',
  }),
];

const VORGAENGE = () => [
  vorgang(1, { status: 'neu', art: 'fehler', bereich: 'chat', betreff: 'Chat zeigt nichts Neues', organization_id: 7, created_at: '2026-10-03T07:00:00Z' }),
  vorgang(2, { status: 'in_arbeit', art: 'frage', bereich: 'konten', betreff: 'Wie lege ich einen Jahrgang an?', created_at: '2026-10-02T09:00:00Z' }),
  vorgang(3, { status: 'erledigt', art: 'zugang', bereich: null, betreff: 'Konto entsperrt', archiviert_am: '2026-10-01T12:00:00Z' }),
];

beforeEach(() => {
  vi.clearAllMocks();
  h.alert = null;
  h.online = true;
  h.user = { id: 9, role_name: 'super_admin', is_super_admin: true };
  supportMailZaehlerZuruecksetzen();
  server = vorgaengeServer({ vorgaenge: VORGAENGE(), mails: FADEN() });
  server.installieren({ get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete });
});

const oeffnen = async (id = 31, text: string | RegExp = 'Faden mit 3 Mails') => {
  render(<SupportPostDetailPage nachrichtId={id} />);
  await screen.findByText(text);
  // Die offenen Vorgänge für „Einsortieren“ kommen nach dem Öffnen.
  await waitFor(() => expect((screen.getByLabelText('Vorgang') as HTMLSelectElement).options.length).toBeGreaterThan(1));
};
const bestaetigen = async (knopf: string) => { await act(async () => { h.alert?.buttons?.find((b) => b.text === knopf)?.handler?.(); }); };
// „Betreff“ gibt es zweimal: im Formular „Neuer Vorgang“ (oben) und im Antwort-Editor (unten).
const betreffNeu = () => screen.getAllByLabelText('Betreff')[0];
const vorgangWahl = () => screen.getByLabelText('Vorgang') as HTMLSelectElement;

describe('Mail: Faden', () => {
  it('chronologisch, ein- und ausgehend unterscheidbar; ungelesene als gelesen gemeldet und für diesen Besuch „Neu“', async () => {
    await oeffnen();
    const mails = screen.getAllByRole('article');
    expect(mails.map((m) => m.getAttribute('aria-label'))).toEqual([
      'Eingegangen am 02.10.2026, 10:00',
      'Gesendet am 02.10.2026, 12:00',
      'Eingegangen am 03.10.2026, 11:00',
    ]);
    expect(mails[1]).toHaveClass('app-list-item--success');
    expect(mails[0]).toHaveClass('app-list-item--info');
    expect(mails[1]).toHaveTextContent('Von: Support <moin@konfi-quest.de> · An: anna@example.org');
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledWith('/support/mail/gelesen', { ids: [29, 31] }));
    expect(mails.map((m) => m.textContent?.includes('Neu'))).toEqual([true, false, true]);
  });

  it('Zitate sind eingeklappt und lassen sich aufklappen; Anhänge nur als Namen', async () => {
    await oeffnen();
    expect(screen.getByText('Danke! Und noch eins.')).toBeInTheDocument();
    expect(screen.queryByText(/alte Antwort/)).toBeNull();
    const knopf = screen.getByRole('button', { name: 'Zitat einblenden' });
    expect(knopf).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(knopf);
    expect(screen.getByRole('button', { name: 'Zitat ausblenden' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/alte Antwort/).textContent).toBe('Am 02.10.2026 um 12:00 schrieb Support <moin@konfi-quest.de>:\n> alte Antwort');
    expect(screen.getByRole('list', { name: 'Anhänge' }).textContent).toBe('plan.pdf');
  });

  it('nichts ungelesen: kein Aufruf „gelesen“', async () => {
    server.stand.mails = [mail(40, null, { betreff: 'Allein', gelesen_am: '2026-10-03T09:30:00Z' })];
    render(<SupportPostDetailPage nachrichtId={40} />);
    await screen.findByText('Über support@');
    await act(async () => {});
    expect(h.apiPost).not.toHaveBeenCalled();
  });

  it('404: „Mail nicht gefunden“; eine ungültige Kennung ruft nichts ab', async () => {
    const { unmount } = render(<SupportPostDetailPage nachrichtId={999} />);
    expect(await screen.findByText('Mail nicht gefunden')).toBeInTheDocument();
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
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Erneut versuchen/ })); });
    expect(await screen.findByText('Faden mit 3 Mails')).toBeInTheDocument();
  });
});

describe('Mail: einsortieren', () => {
  it('die offenen Vorgänge stehen zur Wahl -- mit Nummer, Betreff, Gemeinde, Art und Stand --, das Archiv nicht', async () => {
    await oeffnen();
    expect([...vorgangWahl().options].map((o) => o.textContent)).toEqual([
      'Bitte wählen',
      'Nr. 1 · Chat zeigt nichts Neues · Kirchengemeinde Musterdorf · Fehler · Neu',
      'Nr. 2 · Wie lege ich einen Jahrgang an? · Keine Gemeinde · Frage · In Arbeit',
    ]);
  });

  it('die Suche engt die Vorgänge ein (Nummer, Betreff oder Gemeinde)', async () => {
    await oeffnen();
    fireEvent.change(screen.getByLabelText('Vorgang suchen'), { target: { value: 'jahrgang' } });
    expect([...vorgangWahl().options].map((o) => o.textContent)).toEqual(['Bitte wählen', 'Nr. 2 · Wie lege ich einen Jahrgang an? · Keine Gemeinde · Frage · In Arbeit']);
    fireEvent.change(screen.getByLabelText('Vorgang suchen'), { target: { value: 'musterdorf' } });
    expect([...vorgangWahl().options].map((o) => o.textContent.split(' · ')[0])).toEqual(['Bitte wählen', 'Nr. 1']);
  });

  it('einen bestehenden Vorgang wählen: ein Aufruf mit der Nummer; der ganze Faden geht mit; die Seite öffnet den Vorgang', async () => {
    await oeffnen();
    fireEvent.change(vorgangWahl(), { target: { value: '2' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Einsortieren' })); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/einsortieren').map((a) => a.koerper)).toEqual([{ vorgang_id: 2 }]);
    expect(h.setSuccess).toHaveBeenCalledWith('Mail in Vorgang 2 einsortiert');
    expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge/2');
    expect(server.stand.mails.map((m) => [m.id, m.vorgang_id]).sort()).toEqual([[29, 2], [30, 2], [31, 2]]);
  });

  it('ohne Wahl: ein Satz sagt, was fehlt -- nichts geht raus', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Einsortieren' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Bitte einen Vorgang wählen');
    expect(server.aufrufe('post', /einsortieren$/)).toHaveLength(0);
  });

  it('neuer Vorgang: Betreff aus der Mail; Art, Bereich, Dringlichkeit und Gemeinde gehen genau so an den Server', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('tab', { name: 'Neuer Vorgang' }));
    expect((betreffNeu() as HTMLInputElement).value).toBe('Frage zum Zugang');
    fireEvent.change(screen.getByLabelText('Art'), { target: { value: 'fehler' } });
    fireEvent.change(screen.getByLabelText('Bereich'), { target: { value: 'chat' } });
    fireEvent.change(screen.getByLabelText('Dringlichkeit'), { target: { value: 'dringend' } });
    fireEvent.change(betreffNeu(), { target: { value: '  Anmeldung klappt nicht ' } });
    await waitFor(() => expect((screen.getByLabelText('Gemeinde') as HTMLSelectElement).options.length).toBeGreaterThan(1));
    fireEvent.change(screen.getByLabelText('Gemeinde'), { target: { value: '8' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Einsortieren' })); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/einsortieren').map((a) => a.koerper)).toEqual([
      { neu: { art: 'fehler', bereich: 'chat', dringlichkeit: 'dringend', betreff: 'Anmeldung klappt nicht', organization_id: 8 } },
    ]);
    expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge/100');
  });

  it('neuer Vorgang: ohne Art, ohne Bereich bei Frage, Fehler, Wunsch und ohne Betreff sagt je ein Satz, was fehlt', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('tab', { name: 'Neuer Vorgang' }));
    fireEvent.click(screen.getByRole('button', { name: 'Einsortieren' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Bitte eine Art wählen');
    fireEvent.change(screen.getByLabelText('Art'), { target: { value: 'wunsch' } });
    fireEvent.click(screen.getByRole('button', { name: 'Einsortieren' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Bitte einen Bereich wählen');
    fireEvent.change(screen.getByLabelText('Art'), { target: { value: 'lizenz' } });
    fireEvent.change(betreffNeu(), { target: { value: ' ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Einsortieren' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Bitte einen Betreff eingeben');
    expect(server.aufrufe('post', /einsortieren$/)).toHaveLength(0);
  });

  it('ein Fehler des Servers: er steht auf der Seite, nichts öffnet sich', async () => {
    server.stand.fehler.set('POST /support/mail/nachrichten/31/einsortieren', Object.assign(new Error('x'), { response: { status: 500, data: { error: 'Datenbankfehler' } } }));
    await oeffnen();
    fireEvent.change(vorgangWahl(), { target: { value: '1' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Einsortieren' })); });
    expect(screen.getByRole('alert')).toHaveTextContent('Datenbankfehler');
    expect(h.push).not.toHaveBeenCalled();
  });

  it('liegt die Mail schon in einem Vorgang: Hinweis mit Weg dorthin, „Anderem Vorgang zuordnen“, kein Antwort-Editor', async () => {
    server.stand.mails.forEach((m) => { m.vorgang_id = 2; });
    await oeffnen();
    expect(screen.getByText('Einsortiert in Vorgang 2')).toBeInTheDocument();
    expect(screen.getByText('Anderem Vorgang zuordnen')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Vorgang öffnen' }));
    expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge/2');
    expect(screen.queryByRole('button', { name: 'Antwort senden' })).toBeNull();
  });

  it('ohne Netz ist „Einsortieren“ gesperrt', async () => {
    h.online = false;
    await oeffnen();
    expect(screen.getByRole('button', { name: 'Einsortieren' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Archivieren' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Löschen' })).toBeDisabled();
  });
});

describe('Mail: archivieren, wiederherstellen, löschen', () => {
  it('Archivieren: eine Anfrage an die Mail; die Seite zeigt, dass sie im Archiv liegt, und bietet „Wiederherstellen“', async () => {
    await oeffnen();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Archivieren' })); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/archivieren')).toHaveLength(1);
    expect(h.setSuccess).toHaveBeenCalledWith('1 Mail archiviert');
    expect(await screen.findByText('Diese Mail liegt im Archiv')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wiederherstellen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archivieren' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Antwort senden' })).toBeNull();
  });

  it('Wiederherstellen: die Mail ist wieder im Posteingang, der Editor ist wieder da', async () => {
    server.stand.mails.find((m) => m.id === 31)!.archiviert_am = '2026-10-02T12:00:00Z';
    await oeffnen();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Wiederherstellen' })); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/wiederherstellen')).toHaveLength(1);
    expect(h.setSuccess).toHaveBeenCalledWith('1 Mail wiederhergestellt – wieder im Posteingang');
    await waitFor(() => expect(screen.queryByText('Diese Mail liegt im Archiv')).toBeNull());
    expect(await screen.findByRole('button', { name: 'Antwort senden' })).toBeInTheDocument();
  });

  it('Löschen fragt zuerst; erst „Löschen“ löscht und führt zurück zum Posteingang', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    await bestaetigen('Abbrechen');
    expect(server.aufrufe('delete')).toHaveLength(0);
    expect(h.push).not.toHaveBeenCalled();
  });
});

describe('Mail: antworten', () => {
  it('an den Absender der letzten eingehenden Mail, Betreff vorgeschlagen, mit Rückfrage; danach neu geladen', async () => {
    await oeffnen();
    expect(screen.getByText('anna@example.org', { selector: 'strong' })).toBeInTheDocument();
    expect((screen.getByLabelText('Betreff', { selector: 'input' }) as HTMLInputElement).value).toBe('Re: Frage zum Zugang');
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

describe('Mail: nur für den Support', () => {
  it('eine Gemeindeleitung ohne Merkmal sieht den Hinweis, ohne Abruf', () => {
    h.user = { id: 5, role_name: 'org_admin', is_super_admin: false };
    render(<SupportPostDetailPage nachrichtId={31} />);
    expect(screen.getByText('Nur für den Support')).toBeInTheDocument();
    expect(h.apiGet).not.toHaveBeenCalled();
  });
});
