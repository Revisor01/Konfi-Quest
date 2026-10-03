// Verlauf und Antworten in einer Anfrage (/admin/support/anfragen/:id),
// gerendert (Support-Mail, 03.10.2026, docs/planung/support-mail.md):
// Verlauf chronologisch, ein- und ausgehend unterscheidbar, Zitate
// eingeklappt, ungelesene als gelesen gemeldet; Antworten mit Bausteinen
// (moin@ und beide), Platzhaltern der Anfrage, Vorschau mit Fusszeile,
// Rueckfrage; 503/502 verstaendlich, der Text bleibt; auf diesem Server aus.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import type { AlertOptionen } from './ionicAttrappe';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
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
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost, patch: h.apiPatch } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: true }),
}));

import SupportAnfrageDetailPage from '../../../components/support/SupportAnfrageDetailPage';
import { supportMailZaehlerZuruecksetzen } from '../../../navigation/supportMailZaehler';

const ANFRAGE = {
  id: 4, gemeinde: 'Kirchengemeinde Heide', kirchenkreis: 'Dithmarschen', landeskirche: 'Nordkirche',
  kontakt_name: 'Anna Beispiel', funktion: 'Pastorin', email: 'anna@example.org', mobil: null,
  anzahl_konfis: 25, anzahl_teamer: 6, nachricht: 'Wir starten im November.', status: 'neu', notiz: null,
  organization_id: null, created_at: '2026-10-02T08:00:00Z', updated_at: '2026-10-02T08:00:00Z', ungelesen: 1,
};
const mail = (id: number, extra: Record<string, unknown> = {}) => ({
  id, postfach: 'moin', richtung: 'ein', anfrage_id: 4, organization_id: null,
  von_adresse: 'anna@example.org', von_name: 'Anna Beispiel', an_adressen: ['moin@konfi-quest.de'],
  betreff: 'Re: Eure Anfrage bei Konfi Quest [Anfrage 4]', text: 'Hallo', anhaenge: [],
  gesendet_am: '2026-10-02T09:00:00Z', gelesen_am: null, ...extra,
});
// Absichtlich nicht chronologisch: die Seite sortiert.
const VERLAUF = [
  mail(12, { richtung: 'aus', von_adresse: 'moin@konfi-quest.de', von_name: 'Support', an_adressen: ['anna@example.org'],
    gesendet_am: '2026-10-02T11:00:00Z', gelesen_am: '2026-10-02T11:00:00Z', text: 'Gern, hier die Schritte.\n\n> Hallo\n> wie geht es weiter?' }),
  mail(11, { text: 'Hallo\nwie geht es weiter?' }),
];
const BAUSTEINE = [
  { id: 1, titel: 'Zugangsdaten unterwegs', betreff: 'Zugang für {{gemeinde}}', text: 'Zugang für {{benutzername}} ist unterwegs.', postfach: 'support', sortierung: 1 },
  { id: 2, titel: 'Eingang bestätigt', betreff: null, text: 'Hallo {{name}},\ndanke für eure Anfrage für {{gemeinde}} ({{lizenz}}). {{unbekannt}}\n{{absender}}', postfach: 'moin', sortierung: 1 },
  { id: 3, titel: 'Absage', betreff: null, text: 'Leider nein.', postfach: null, sortierung: 2 },
];
const PLATZHALTER = { name: 'Anna Beispiel', gemeinde: 'Kirchengemeinde Heide', lizenz: 'Standard', testphase_bis: null, benutzername: null, absender: null };
const statusMit = (extra: Record<string, unknown> = {}) => ({
  postfaecher: [{ postfach: 'moin', adresse: 'moin@konfi-quest.de', eingerichtet: true, abgeholt_am: null, fehler: null, fehler_am: null, ...extra }],
});

let antworten: Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  h.apiGet.mockReset();
  h.apiPost.mockReset();
  h.alert = null;
  h.user = { id: 9, role_name: 'super_admin', is_super_admin: true };
  supportMailZaehlerZuruecksetzen();
  antworten = {
    '/support/anfragen': [ANFRAGE],
    '/support/kirchenkreise': [],
    '/support/landeskirchen': [],
    '/support/anfragen/4/verlauf': VERLAUF,
    '/support/mail/bausteine': BAUSTEINE,
    '/support/mail/einstellungen': { fusszeile: 'Konfi Quest\nmoin@konfi-quest.de', absendername: 'Support-Team' },
    '/support/mail/status': statusMit({ auf_diesem_server: true }),
    '/support/mail/platzhalter': PLATZHALTER,
  };
  h.apiGet.mockImplementation((pfad: string) => {
    const wert = antworten[pfad];
    if (wert === undefined) return Promise.reject(new Error(`unerwartet: ${pfad}`));
    return wert instanceof Error ? Promise.reject(wert) : Promise.resolve({ data: wert });
  });
  h.apiPost.mockResolvedValue({ data: {} });
});

const oeffnen = async () => {
  render(<SupportAnfrageDetailPage anfrageId={4} />);
  await screen.findByText('Wir starten im November.');
  await screen.findAllByRole('article');
  // Bausteine, Einstellungen und Zustand laden im Formular fuer sich.
  await waitFor(() => expect((screen.getByLabelText('Textbaustein') as HTMLSelectElement).options.length).toBeGreaterThan(1));
};

const text = () => screen.getByLabelText('Text der Antwort') as HTMLTextAreaElement;
const senden = () => screen.getByRole('button', { name: 'Antwort senden' });
const bestaetigen = async () => { await act(async () => { h.alert?.buttons?.find((b) => b.text === 'Senden')?.handler?.(); }); };

describe('Anfrage: Verlauf', () => {
  it('aelteste zuerst, ein- und ausgehend unterscheidbar; die ungelesene wird gemeldet und traegt „Neu"', async () => {
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

  it('leer: ein Satz; Fehler: Hinweis mit neuem Versuch, die Anfrage bleibt bedienbar', async () => {
    antworten['/support/anfragen/4/verlauf'] = new Error('Netz weg');
    render(<SupportAnfrageDetailPage anfrageId={4} />);
    await screen.findByText('Wir starten im November.');
    expect(await screen.findByText('Der Verlauf konnte nicht geladen werden.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeInTheDocument();
    antworten['/support/anfragen/4/verlauf'] = [];
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Verlauf neu laden' })); });
    expect(await screen.findByText('Noch keine Mails zu dieser Anfrage.')).toBeInTheDocument();
    // Ohne Verlauf antwortet der Support auf die automatische Bestaetigung.
    expect((screen.getByLabelText('Betreff') as HTMLInputElement).value).toBe('Re: Eure Anfrage bei Konfi Quest');
  });
});

describe('Anfrage: Antworten', () => {
  it('Bausteine nur fuer moin@ und beide; Einfuegen fuellt die Platzhalter der Anfrage, Unbekanntes bleibt stehen', async () => {
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
    expect((screen.getByLabelText('Betreff') as HTMLInputElement).value).toBe('Re: Eure Anfrage bei Konfi Quest [Anfrage 4]');
  });

  it('ein zweiter Baustein kommt unter den Text, nichts geht verloren', async () => {
    await oeffnen();
    fireEvent.change(text(), { target: { value: 'Hallo Anna,' } });
    fireEvent.change(screen.getByLabelText('Textbaustein'), { target: { value: '3' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Baustein einfügen' })); });
    expect(text().value).toBe('Hallo Anna,\n\nLeider nein.');
  });

  it('Vorschau: Text, darunter „-- " und die Fusszeile', async () => {
    await oeffnen();
    fireEvent.change(text(), { target: { value: 'Hallo Anna,\nes geht los.' } });
    expect(screen.getByRole('region', { name: 'Vorschau der Antwort' }).textContent)
      .toBe('Hallo Anna,\nes geht los.\n\n-- \nKonfi Quest\nmoin@konfi-quest.de');
  });

  it('ohne Text: Meldung, keine Rueckfrage, kein Versand', async () => {
    await oeffnen();
    fireEvent.click(senden());
    expect(h.setError).toHaveBeenCalledWith('Bitte einen Text schreiben');
    expect(h.alert).toBeNull();
  });

  it('Senden mit Rueckfrage; Koerper an den Server; danach Verlauf neu, Text leer, Status „In Arbeit"', async () => {
    await oeffnen();
    fireEvent.change(text(), { target: { value: 'Hallo Anna,\nes geht los.\n\n' } });
    fireEvent.click(senden());
    expect(h.alert?.message).toBe('An anna@example.org: „Re: Eure Anfrage bei Konfi Quest [Anfrage 4]“ von moin@ senden?');
    expect(h.apiPost).not.toHaveBeenCalledWith('/support/anfragen/4/antworten', expect.anything());

    const verlaufVorher = h.apiGet.mock.calls.filter(([p]) => p === '/support/anfragen/4/verlauf').length;
    await bestaetigen();
    expect(h.apiPost).toHaveBeenCalledWith('/support/anfragen/4/antworten', {
      text: 'Hallo Anna,\nes geht los.',
      betreff: 'Re: Eure Anfrage bei Konfi Quest [Anfrage 4]',
    });
    expect(h.setSuccess).toHaveBeenCalledWith('Antwort gesendet');
    expect(text().value).toBe('');
    await waitFor(() => expect(h.apiGet.mock.calls.filter(([p]) => p === '/support/anfragen/4/verlauf').length).toBe(verlaufVorher + 1));
    expect(screen.getAllByText('In Arbeit').length).toBeGreaterThan(0);
    expect((screen.getByLabelText('Status') as HTMLSelectElement).value).toBe('in_arbeit');
  });

  it('der unberuehrte Betreff folgt dem Vorschlag aus dem neuen Verlauf; ein getippter bleibt', async () => {
    antworten['/support/anfragen/4/verlauf'] = [];
    render(<SupportAnfrageDetailPage anfrageId={4} />);
    await screen.findByText('Noch keine Mails zu dieser Anfrage.');
    expect((screen.getByLabelText('Betreff') as HTMLInputElement).value).toBe('Re: Eure Anfrage bei Konfi Quest');
    fireEvent.change(text(), { target: { value: 'Hallo Anna' } });
    fireEvent.click(senden());
    // Der Server hat die Kennung in den Betreff gesetzt.
    antworten['/support/anfragen/4/verlauf'] = [mail(13, { richtung: 'aus', gelesen_am: '2026-10-03T08:00:00Z', betreff: 'Re: Eure Anfrage bei Konfi Quest [Anfrage 4]' })];
    await bestaetigen();
    await waitFor(() => expect((screen.getByLabelText('Betreff') as HTMLInputElement).value).toBe('Re: Eure Anfrage bei Konfi Quest [Anfrage 4]'));

    fireEvent.change(screen.getByLabelText('Betreff'), { target: { value: 'Termine im November' } });
    fireEvent.change(text(), { target: { value: 'Noch etwas' } });
    fireEvent.click(senden());
    antworten['/support/anfragen/4/verlauf'] = [
      mail(13, { richtung: 'aus', gelesen_am: '2026-10-03T08:00:00Z', betreff: 'Re: Eure Anfrage bei Konfi Quest [Anfrage 4]' }),
      mail(14, { gesendet_am: '2026-10-03T09:00:00Z', betreff: 'AW: Re: Eure Anfrage bei Konfi Quest [Anfrage 4]' }),
    ];
    h.apiPost.mockRejectedValueOnce({ response: { status: 502, data: {} } });
    await bestaetigen();
    expect((screen.getByLabelText('Betreff') as HTMLInputElement).value).toBe('Termine im November');
  });

  it('503 ohne Text: „Postfach noch nicht eingerichtet", der Text bleibt', async () => {
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

  it('503 „Auf diesem Server ist der Versand aus.": der Text des Servers, der Entwurf bleibt', async () => {
    await oeffnen();
    fireEvent.change(text(), { target: { value: 'Hallo Anna' } });
    fireEvent.change(screen.getByLabelText('Betreff'), { target: { value: 'Eigener Betreff' } });
    fireEvent.click(senden());
    h.apiPost.mockRejectedValueOnce({ response: { status: 503, data: { error: 'Auf diesem Server ist der Versand aus.' } } });
    await bestaetigen();
    const hinweis = await screen.findByRole('alert');
    expect(hinweis).toHaveTextContent('Nicht gesendet');
    expect(hinweis).toHaveTextContent('Auf diesem Server ist der Versand aus. Dein Text bleibt hier stehen.');
    expect(hinweis).not.toHaveTextContent('Zugangsdaten');
    expect(text().value).toBe('Hallo Anna');
    expect((screen.getByLabelText('Betreff') as HTMLInputElement).value).toBe('Eigener Betreff');
  });

  it('502: „Versand gescheitert", der Text bleibt; ein neuer Versuch raeumt den Hinweis', async () => {
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
    antworten['/support/mail/status'] = statusMit({ auf_diesem_server: false });
    await oeffnen();
    await waitFor(() => expect(senden()).toBeDisabled());
    expect(screen.getByText('Auf diesem Server aus – Versand und Abholen laufen auf dem Hauptserver')).toBeInTheDocument();
    expect(screen.getByText('Senden ist aus: Auf diesem Server aus – Versand und Abholen laufen auf dem Hauptserver.')).toBeInTheDocument();
  });

  it('Gegenprobe: ohne das Feld auf_diesem_server (aelterer Server) bleibt Senden an', async () => {
    antworten['/support/mail/status'] = statusMit();
    await oeffnen();
    await act(async () => {});
    expect(senden()).not.toBeDisabled();
    expect(screen.queryByText(/Senden ist aus/)).toBeNull();
  });

  it('Postfach nicht eingerichtet: Hinweis schon vor dem Senden, Senden bleibt moeglich', async () => {
    antworten['/support/mail/status'] = statusMit({ eingerichtet: false });
    await oeffnen();
    expect(await screen.findByText('Postfach noch nicht eingerichtet')).toBeInTheDocument();
    expect(senden()).not.toBeDisabled();
  });
});
