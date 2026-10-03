// Verlauf und Antworten in einem Vorgang, gerendert (Support-Mail, 03.10.2026,
// docs/planung/support-mail.md; seit den Vorgängen unter /admin/support/
// vorgaenge/:id): Verlauf chronologisch, ein- und ausgehend unterscheidbar,
// Zitate eingeklappt, ungelesene als gelesen gemeldet; Antworten mit Bausteinen
// (moin@ und beide), Platzhaltern der Anfrage, Vorschau mit Fußzeile,
// Rückfrage; 503/502 verständlich, der Text bleibt; auf diesem Server aus.
// Ein Vorgang aus einer Anfrage antwortet immer von moin@ an die Adresse der
// Anfrage; derselbe Antwort-Editor dient auch den Vorgängen ohne Anfrage und den
// Mails im Posteingang. Die Seite des Vorgangs selbst steht in
// supportVorgangDetail.test.tsx und webVorgangDetail.test.tsx.
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import type { AlertOptionen } from './ionicAttrappe';
import { ANFRAGE_41, mail, vorgang, vorgaengeServer } from './vorgaengeServer';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  push: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  alert: null as null | AlertOptionen,
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
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: true }),
}));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => false }));

import SupportVorgangDetailPage from '../../../components/support/SupportVorgangDetailPage';
import { supportMailZaehlerZuruecksetzen } from '../../../navigation/supportMailZaehler';

let vorherTZ: string | undefined;
beforeAll(() => { vorherTZ = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherTZ === undefined) delete process.env.TZ; else process.env.TZ = vorherTZ; });

const ANFRAGE = {
  ...ANFRAGE_41, id: 4, gemeinde: 'Kirchengemeinde Heide', kirchenkreis: 'Dithmarschen', mobil: null, wunsch_lizenz: null, ungelesen: 1,
};
const BAUSTEINE = [
  { id: 1, titel: 'Zugangsdaten unterwegs', betreff: 'Zugang für {{gemeinde}}', text: 'Zugang für {{benutzername}} ist unterwegs.', postfach: 'support', sortierung: 1 },
  { id: 2, titel: 'Eingang bestätigt', betreff: null, text: 'Hallo {{name}},\ndanke für eure Anfrage für {{gemeinde}} ({{lizenz}}). {{unbekannt}}\n{{absender}}', postfach: 'moin', sortierung: 1 },
  { id: 3, titel: 'Absage', betreff: null, text: 'Leider nein.', postfach: null, sortierung: 2 },
];
const PLATZHALTER = { name: 'Anna Beispiel', gemeinde: 'Kirchengemeinde Heide', lizenz: 'Standard', testphase_bis: null, benutzername: null, absender: null };
const statusMit = (extra: Record<string, unknown> = {}) => ({
  postfaecher: [{ postfach: 'moin', adresse: 'moin@konfi-quest.de', eingerichtet: true, abgeholt_am: null, fehler: null, fehler_am: null, ...extra }],
});

let server: ReturnType<typeof vorgaengeServer>;
let status: unknown;

beforeEach(() => {
  vi.clearAllMocks();
  h.alert = null;
  h.user = { id: 9, role_name: 'super_admin', is_super_admin: true };
  supportMailZaehlerZuruecksetzen();
  status = statusMit({ auf_diesem_server: true });
  server = vorgaengeServer({
    vorgaenge: [vorgang(4, { art: 'neue_gemeinde', bereich: null, status: 'neu', betreff: 'Anfrage Kirchengemeinde Heide', quelle: 'anfrage', anfrage_id: 4, anfrage: { ...ANFRAGE } })],
    mails: [
      // Absichtlich nicht chronologisch im Speicher: die Seite sortiert.
      mail(12, 4, { postfach: 'moin', richtung: 'aus', von_adresse: 'moin@konfi-quest.de', von_name: 'Support', an_adressen: ['anna@example.org'], betreff: 'Re: Eure Anfrage bei Konfi Quest [Anfrage 4]',
        gesendet_am: '2026-10-02T11:00:00Z', gelesen_am: '2026-10-02T11:00:00Z', text: 'Gern, hier die Schritte.\n\n> Hallo\n> wie geht es weiter?' }),
      mail(11, 4, { postfach: 'moin', von_adresse: 'anna@example.org', von_name: 'Anna Beispiel', an_adressen: ['moin@konfi-quest.de'], betreff: 'Re: Eure Anfrage bei Konfi Quest [Anfrage 4]',
        gesendet_am: '2026-10-02T09:00:00Z', text: 'Hallo\nwie geht es weiter?' }),
    ],
  });
  server.installieren({ get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete });
  const vorher = h.apiGet.getMockImplementation()!;
  h.apiGet.mockImplementation((pfad: string, o?: unknown) => {
    if (pfad === '/support/mail/bausteine') return Promise.resolve({ data: BAUSTEINE });
    if (pfad === '/support/mail/einstellungen') return Promise.resolve({ data: { fusszeile: 'Konfi Quest\nmoin@konfi-quest.de', absendername: 'Support-Team' } });
    if (pfad === '/support/mail/platzhalter') return Promise.resolve({ data: PLATZHALTER });
    if (pfad === '/support/mail/status') return Promise.resolve({ data: status });
    return vorher(pfad, o as never);
  });
});

const oeffnen = async () => {
  render(<SupportVorgangDetailPage vorgangId={4} />);
  await screen.findAllByRole('article');
  // Bausteine, Einstellungen und Zustand laden im Formular für sich.
  await waitFor(() => expect((screen.getByLabelText('Textbaustein') as HTMLSelectElement).options.length).toBeGreaterThan(1));
};

const text = () => screen.getByLabelText('Text der Antwort') as HTMLTextAreaElement;
const senden = () => screen.getByRole('button', { name: 'Antwort senden' });
const bestaetigen = async () => { await act(async () => { h.alert?.buttons?.find((b) => b.text === 'Senden')?.handler?.(); }); };
const betreff = () => screen.getByLabelText('Betreff') as HTMLInputElement;

describe('Vorgang aus einer Anfrage: Verlauf', () => {
  it('älteste zuerst, ein- und ausgehend unterscheidbar; die ungelesene wird gemeldet und trägt „Neu“', async () => {
    await oeffnen();
    const mails = screen.getAllByRole('article');
    expect(mails.map((m) => m.getAttribute('aria-label'))).toEqual([
      'Eingegangen am 02.10.2026, 11:00',
      'Gesendet am 02.10.2026, 13:00',
    ]);
    expect(mails[0]).toHaveTextContent('Neu');
    expect(mails[1]).not.toHaveTextContent('Neu');
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledWith('/support/mail/gelesen', { ids: [11] }));
  });

  it('das Zitat in der Antwort ist eingeklappt', async () => {
    await oeffnen();
    expect(screen.getByText('Gern, hier die Schritte.')).toBeInTheDocument();
    expect(screen.queryByText(/> wie geht es weiter\?/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Zitat einblenden' }));
    expect(screen.getByText(/> wie geht es weiter\?/)).toBeInTheDocument();
  });

  it('ohne Mails: ein Satz; der Betreff antwortet auf die automatische Bestätigung', async () => {
    server.stand.mails = [];
    render(<SupportVorgangDetailPage vorgangId={4} />);
    expect(await screen.findByText('Noch keine Mails in diesem Vorgang.')).toBeInTheDocument();
    await waitFor(() => expect((screen.getByLabelText('Textbaustein') as HTMLSelectElement).options.length).toBeGreaterThan(1));
    expect(betreff().value).toBe('Re: Eure Anfrage bei Konfi Quest');
  });
});

describe('Vorgang aus einer Anfrage: Antworten', () => {
  it('Bausteine nur für moin@ und beide; Einfügen füllt die Platzhalter der Anfrage, Unbekanntes bleibt stehen', async () => {
    await oeffnen();
    const auswahl = screen.getByLabelText('Textbaustein') as HTMLSelectElement;
    expect([...auswahl.options].map((o) => o.textContent)).toEqual(['Baustein wählen', 'Eingang bestätigt', 'Absage']);
    expect(screen.getByRole('button', { name: 'Baustein einfügen' })).toBeDisabled();
    fireEvent.change(auswahl, { target: { value: '2' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Baustein einfügen' })); });
    expect(h.apiGet).toHaveBeenCalledWith('/support/mail/platzhalter', { params: { anfrage_id: 4 } });
    // {{absender}} fehlt in den Platzhaltern -> Absendername aus den Einstellungen.
    expect(text().value).toBe('Hallo Anna Beispiel,\ndanke für eure Anfrage für Kirchengemeinde Heide (Standard). {{unbekannt}}\nSupport-Team');
    // Der Betreff bleibt der Vorschlag aus dem Verlauf.
    expect(betreff().value).toBe('Re: Eure Anfrage bei Konfi Quest [Anfrage 4]');
  });

  it('ein zweiter Baustein kommt unter den Text, nichts geht verloren', async () => {
    await oeffnen();
    fireEvent.change(text(), { target: { value: 'Hallo Anna,' } });
    fireEvent.change(screen.getByLabelText('Textbaustein'), { target: { value: '3' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Baustein einfügen' })); });
    expect(text().value).toBe('Hallo Anna,\n\nLeider nein.');
  });

  it('Vorschau: Text, darunter „-- “ und die Fußzeile', async () => {
    await oeffnen();
    fireEvent.change(text(), { target: { value: 'Hallo Anna,\nes geht los.' } });
    expect(screen.getByRole('region', { name: 'Vorschau der Antwort' }).textContent)
      .toBe('Hallo Anna,\nes geht los.\n\n-- \nKonfi Quest\nmoin@konfi-quest.de');
  });

  it('ohne Text: Meldung, keine Rückfrage, kein Versand', async () => {
    await oeffnen();
    fireEvent.click(senden());
    expect(h.setError).toHaveBeenCalledWith('Bitte einen Text schreiben');
    expect(h.alert).toBeNull();
  });

  it('Senden mit Rückfrage; Körper an den Vorgang; danach Verlauf neu, Text leer, Status „In Arbeit“', async () => {
    await oeffnen();
    fireEvent.change(text(), { target: { value: 'Hallo Anna,\nes geht los.\n\n' } });
    fireEvent.click(senden());
    expect(h.alert?.message).toBe('An anna@example.org: „Re: Eure Anfrage bei Konfi Quest [Anfrage 4]“ von moin@ senden?');
    expect(server.aufrufe('post', /antworten$/)).toHaveLength(0);

    const abrufeVorher = server.aufrufe('get', '/support/vorgaenge/4').length;
    await bestaetigen();
    expect(server.aufrufe('post', '/support/vorgaenge/4/antworten').map((a) => a.koerper)).toEqual([{
      text: 'Hallo Anna,\nes geht los.',
      betreff: 'Re: Eure Anfrage bei Konfi Quest [Anfrage 4]',
    }]);
    expect(h.setSuccess).toHaveBeenCalledWith('Antwort gesendet');
    expect(text().value).toBe('');
    await waitFor(() => expect(server.aufrufe('get', '/support/vorgaenge/4').length).toBeGreaterThan(abrufeVorher));
    await waitFor(() => expect((screen.getByLabelText('Status') as HTMLSelectElement).value).toBe('in_arbeit'));
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });

  it('der unberührte Betreff folgt dem Vorschlag aus dem neuen Verlauf; ein getippter bleibt', async () => {
    server.stand.mails = [];
    render(<SupportVorgangDetailPage vorgangId={4} />);
    await screen.findByText('Noch keine Mails in diesem Vorgang.');
    await waitFor(() => expect(betreff().value).toBe('Re: Eure Anfrage bei Konfi Quest'));
    fireEvent.change(text(), { target: { value: 'Hallo Anna' } });
    fireEvent.click(senden());
    await bestaetigen();
    // Der Server hat die Nummer des Vorgangs in den Betreff gesetzt.
    await waitFor(() => expect(betreff().value).toBe('Re: Eure Anfrage bei Konfi Quest [Vorgang 4]'));

    fireEvent.change(betreff(), { target: { value: 'Termine im November' } });
    fireEvent.change(text(), { target: { value: 'Noch etwas' } });
    fireEvent.click(senden());
    h.apiPost.mockRejectedValueOnce({ response: { status: 502, data: {} } });
    await bestaetigen();
    expect(betreff().value).toBe('Termine im November');
  });

  it('503 ohne Text: „Postfach noch nicht eingerichtet“, der Text bleibt', async () => {
    await oeffnen();
    fireEvent.change(text(), { target: { value: 'Hallo Anna' } });
    fireEvent.click(senden());
    h.apiPost.mockRejectedValueOnce({ response: { status: 503, data: {} } });
    await bestaetigen();
    expect(await screen.findByRole('alert')).toHaveTextContent('Postfach noch nicht eingerichtet');
    expect(screen.getByRole('alert')).toHaveTextContent('Für moin@ fehlen auf dem Server noch die Zugangsdaten.');
    expect(text().value).toBe('Hallo Anna');
    expect(h.setSuccess).not.toHaveBeenCalledWith('Antwort gesendet');
    expect(h.setError).not.toHaveBeenCalled();
  });

  it('503 „Auf diesem Server ist der Versand aus.“: der Text des Servers, der Entwurf bleibt', async () => {
    await oeffnen();
    fireEvent.change(text(), { target: { value: 'Hallo Anna' } });
    fireEvent.change(betreff(), { target: { value: 'Eigener Betreff' } });
    fireEvent.click(senden());
    h.apiPost.mockRejectedValueOnce({ response: { status: 503, data: { error: 'Auf diesem Server ist der Versand aus.' } } });
    await bestaetigen();
    const hinweis = await screen.findByRole('alert');
    expect(hinweis).toHaveTextContent('Nicht gesendet');
    expect(hinweis).toHaveTextContent('Auf diesem Server ist der Versand aus. Dein Text bleibt hier stehen.');
    expect(hinweis).not.toHaveTextContent('Zugangsdaten');
    expect(text().value).toBe('Hallo Anna');
    expect(betreff().value).toBe('Eigener Betreff');
  });

  it('502: „Versand gescheitert“, der Text bleibt; ein neuer Versuch räumt den Hinweis', async () => {
    await oeffnen();
    fireEvent.change(text(), { target: { value: 'Hallo Anna' } });
    fireEvent.click(senden());
    h.apiPost.mockRejectedValueOnce({ response: { status: 502, data: { error: 'SMTP' } } });
    await bestaetigen();
    expect(await screen.findByRole('alert')).toHaveTextContent('Versand gescheitert');
    expect(text().value).toBe('Hallo Anna');

    fireEvent.click(senden());
    await bestaetigen();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(h.setSuccess).toHaveBeenCalledWith('Antwort gesendet');
  });

  it('anderer Fehler: die Meldung des Servers als Fehlermeldung, der Text bleibt', async () => {
    await oeffnen();
    fireEvent.change(text(), { target: { value: 'Hallo Anna' } });
    fireEvent.click(senden());
    h.apiPost.mockRejectedValueOnce({ response: { status: 400, data: { error: 'Text fehlt' } } });
    await bestaetigen();
    expect(h.setError).toHaveBeenCalledWith('Text fehlt');
    expect(text().value).toBe('Hallo Anna');
  });

  it('auf diesem Server aus: Hinweis, Senden aus -- mit Grund daneben', async () => {
    status = statusMit({ auf_diesem_server: false });
    await oeffnen();
    await waitFor(() => expect(senden()).toBeDisabled());
    expect(screen.getByText('Auf diesem Server aus – Versand und Abholen laufen auf dem Hauptserver')).toBeInTheDocument();
    expect(screen.getByText('Senden ist aus: Auf diesem Server aus – Versand und Abholen laufen auf dem Hauptserver.')).toBeInTheDocument();
  });

  it('Gegenprobe: ohne das Feld auf_diesem_server (älterer Server) bleibt Senden an', async () => {
    status = statusMit();
    await oeffnen();
    await act(async () => {});
    expect(senden()).not.toBeDisabled();
    expect(screen.queryByText(/Senden ist aus/)).toBeNull();
  });

  it('Postfach nicht eingerichtet: Hinweis schon vor dem Senden, Senden bleibt möglich', async () => {
    status = statusMit({ eingerichtet: false });
    await oeffnen();
    expect(await screen.findByText('Postfach noch nicht eingerichtet')).toBeInTheDocument();
    expect(senden()).not.toBeDisabled();
  });
});
