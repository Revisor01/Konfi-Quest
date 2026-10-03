// Schriftwechsel einer Gemeinde (/admin/support/post/gemeinde/:id),
// gerendert (Support-Mail, 03.10.2026): Verlauf chronologisch, ungelesene
// gemeldet; Antworten von support@ an einen Empfaenger aus
// GET …/empfaenger (Pflicht, bei genau einem vorgewaehlt), Bausteine fuer
// support@ und beide mit den Platzhaltern der Gemeinde.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import type { AlertOptionen } from './ionicAttrappe';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
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
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: true }),
}));

import SupportGemeindePostPage from '../../../components/support/SupportGemeindePostPage';
import { supportMailZaehlerZuruecksetzen } from '../../../navigation/supportMailZaehler';

const mail = (id: number, extra: Record<string, unknown> = {}) => ({
  id, postfach: 'support', richtung: 'ein', anfrage_id: null, organization_id: 7,
  von_adresse: 'leitung@example.org', von_name: 'Pastorin Anna', an_adressen: ['support@konfi-quest.de'],
  betreff: 'Jahrgang anlegen [Gemeinde 7]', text: 'Wie lege ich einen Jahrgang an?', anhaenge: [],
  gesendet_am: '2026-10-02T09:00:00Z', gelesen_am: null, ...extra,
});
const EMPFAENGER = [
  { adresse: 'leitung@example.org', name: 'Pastorin Anna', herkunft: 'Gemeindeleitung' },
  { adresse: 'team@example.org', name: null, herkunft: 'Absender im Verlauf' },
];

let antworten: Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  h.apiGet.mockReset();
  h.apiPost.mockReset();
  h.alert = null;
  h.user = { id: 9, role_name: 'super_admin', is_super_admin: true };
  supportMailZaehlerZuruecksetzen();
  antworten = {
    // Die Liste kennt Gemeinde 7 nicht (interne Gemeinden fehlen dort, Migration 194): Name und Angaben kommen aus /organizations/:id.
    '/organizations': [{ id: 1, name: 'andere', display_name: 'Andere Gemeinde' }],
    '/organizations/7': { id: 7, name: 'heide', display_name: 'Kirchengemeinde Heide', wunsch_lizenz: 'standard' },
    '/support/gemeinden/7/verlauf': [
      mail(22, { richtung: 'aus', von_adresse: 'support@konfi-quest.de', von_name: 'Support', gesendet_am: '2026-10-02T10:00:00Z', gelesen_am: '2026-10-02T10:00:00Z', betreff: 'Re: Jahrgang anlegen [Gemeinde 7]', text: 'Unter Mehr.' }),
      mail(21),
      mail(23, { gesendet_am: '2026-10-02T12:00:00Z', text: 'Danke!' }),
    ],
    '/support/gemeinden/7/empfaenger': EMPFAENGER,
    '/support/mail/bausteine': [
      { id: 1, titel: 'Zugangsdaten unterwegs', betreff: 'Zugang für {{gemeinde}}', text: 'Hallo {{name}}, dein Benutzername ist {{benutzername}}.', postfach: 'support', sortierung: 1 },
      { id: 2, titel: 'Eingang bestätigt', betreff: null, text: 'Danke.', postfach: 'moin', sortierung: 1 },
      { id: 3, titel: 'Absage', betreff: null, text: 'Leider nein.', postfach: null, sortierung: 2 },
    ],
    '/support/mail/einstellungen': { fusszeile: 'Konfi Quest', absendername: 'Support-Team' },
    '/support/mail/status': { postfaecher: [{ postfach: 'support', adresse: 'support@konfi-quest.de', eingerichtet: true, abgeholt_am: null, fehler: null, fehler_am: null, auf_diesem_server: true }] },
    '/support/mail/platzhalter': { name: 'Pastorin Anna', gemeinde: 'Kirchengemeinde Heide', lizenz: 'Standard', testphase_bis: '2026-11-02', benutzername: 'anna.beispiel', absender: 'Support-Team' },
  };
  h.apiGet.mockImplementation((pfad: string) => {
    const wert = antworten[pfad];
    if (wert === undefined) return Promise.reject(new Error(`unerwartet: ${pfad}`));
    return wert instanceof Error ? Promise.reject(wert) : Promise.resolve({ data: wert });
  });
  h.apiPost.mockResolvedValue({ data: {} });
});

const oeffnen = async () => {
  render(<SupportGemeindePostPage organizationId={7} />);
  await screen.findByText('Kirchengemeinde Heide');
  await screen.findAllByRole('article');
  await waitFor(() => expect((screen.getByLabelText('Empfänger') as HTMLSelectElement).options.length).toBe(3));
  await waitFor(() => expect((screen.getByLabelText('Textbaustein') as HTMLSelectElement).options.length).toBeGreaterThan(1));
};

const empfaenger = () => screen.getByLabelText('Empfänger') as HTMLSelectElement;
const text = () => screen.getByLabelText('Text der Antwort') as HTMLTextAreaElement;

describe('Schriftwechsel: Verlauf', () => {
  it('aelteste zuerst; die ungelesenen werden gemeldet; Name der Gemeinde oben', async () => {
    await oeffnen();
    expect(screen.getAllByRole('article').map((m) => m.getAttribute('aria-label'))).toEqual([
      'Eingegangen am 02.10.2026, 11:00',
      'Gesendet am 02.10.2026, 12:00',
      'Eingegangen am 02.10.2026, 14:00',
    ]);
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledWith('/support/mail/gelesen', { ids: [21, 23] }));
    fireEvent.click(screen.getByRole('button', { name: 'Gemeinde öffnen' }));
    expect(h.push).toHaveBeenCalledWith('/admin/organizations?gemeinde=7');
  });

  it('der Name kommt aus /organizations/:id -- auch fuer eine Gemeinde, die nicht in der Liste steht', async () => {
    await oeffnen();
    expect(h.apiGet).toHaveBeenCalledWith('/organizations/7');
    expect(h.apiGet).not.toHaveBeenCalledWith('/organizations');
    expect(screen.queryByText('Andere Gemeinde')).toBeNull();
  });

  it('ohne lesbare Gemeinde steht ihre Kennung da, der Schriftwechsel geht trotzdem', async () => {
    antworten['/organizations/7'] = new Error('nicht da');
    render(<SupportGemeindePostPage organizationId={7} />);
    expect(await screen.findByText('Gemeinde 7')).toBeInTheDocument();
    expect((await screen.findAllByRole('article')).length).toBe(3);
  });

  it('eine Antwort mit fremder Kennung gilt nicht als diese Gemeinde', async () => {
    antworten['/organizations/7'] = { id: 8, name: 'fremd', display_name: 'Fremde Gemeinde' };
    render(<SupportGemeindePostPage organizationId={7} />);
    expect(await screen.findByText('Gemeinde 7')).toBeInTheDocument();
    expect(screen.queryByText('Fremde Gemeinde')).toBeNull();
  });

  it('Verlauf nicht ladbar: Hinweis mit neuem Versuch', async () => {
    antworten['/support/gemeinden/7/verlauf'] = new Error('Netz weg');
    render(<SupportGemeindePostPage organizationId={7} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Der Schriftwechsel konnte nicht geladen werden.');
    antworten['/support/gemeinden/7/verlauf'] = [];
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Erneut versuchen/ })); });
    expect(await screen.findByText('Noch keine Mails mit dieser Gemeinde.')).toBeInTheDocument();
  });

  it('keine gueltige Kennung: Hinweis, kein Abruf', () => {
    render(<SupportGemeindePostPage organizationId={Number.NaN} />);
    expect(screen.getByText('Gemeinde nicht gefunden')).toBeInTheDocument();
    expect(h.apiGet).not.toHaveBeenCalled();
  });
});

describe('Schriftwechsel: Antworten', () => {
  it('Empfaenger aus dem Server, mit Herkunft; ohne Wahl kein Versand', async () => {
    await oeffnen();
    expect([...empfaenger().options].map((o) => o.textContent)).toEqual([
      'Bitte wählen',
      'Pastorin Anna <leitung@example.org> · Gemeindeleitung',
      'team@example.org · Absender im Verlauf',
    ]);
    fireEvent.change(text(), { target: { value: 'Hallo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Antwort senden' }));
    expect(h.setError).toHaveBeenCalledWith('Bitte einen Empfänger wählen');
    expect(h.alert).toBeNull();
  });

  it('Bausteine fuer support@ und beide; Platzhalter der Gemeinde; der Betreff des Bausteins ersetzt den Vorschlag', async () => {
    await oeffnen();
    expect([...(screen.getByLabelText('Textbaustein') as HTMLSelectElement).options].map((o) => o.textContent))
      .toEqual(['Baustein wählen', 'Zugangsdaten unterwegs', 'Absage']);
    expect((screen.getByLabelText('Betreff') as HTMLInputElement).value).toBe('Re: Jahrgang anlegen [Gemeinde 7]');
    fireEvent.change(screen.getByLabelText('Textbaustein'), { target: { value: '1' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Baustein einfügen' })); });
    expect(h.apiGet).toHaveBeenCalledWith('/support/mail/platzhalter', { params: { organization_id: 7 } });
    expect(text().value).toBe('Hallo Pastorin Anna, dein Benutzername ist anna.beispiel.');
    expect((screen.getByLabelText('Betreff') as HTMLInputElement).value).toBe('Zugang für Kirchengemeinde Heide');
  });

  it('senden: Rueckfrage nennt Empfaenger und Postfach; Koerper mit „an"; danach Verlauf neu', async () => {
    await oeffnen();
    fireEvent.change(empfaenger(), { target: { value: 'leitung@example.org' } });
    fireEvent.change(text(), { target: { value: 'Unter Mehr → Jahrgänge.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Antwort senden' }));
    expect(h.alert?.message).toBe('An leitung@example.org: „Re: Jahrgang anlegen [Gemeinde 7]“ von support@ senden?');
    const vorher = h.apiGet.mock.calls.filter(([p]) => p === '/support/gemeinden/7/verlauf').length;
    await act(async () => { h.alert?.buttons?.find((b) => b.text === 'Senden')?.handler?.(); });
    expect(h.apiPost).toHaveBeenCalledWith('/support/gemeinden/7/antworten', {
      text: 'Unter Mehr → Jahrgänge.',
      betreff: 'Re: Jahrgang anlegen [Gemeinde 7]',
      an: 'leitung@example.org',
    });
    expect(h.setSuccess).toHaveBeenCalledWith('Antwort gesendet');
    await waitFor(() => expect(h.apiGet.mock.calls.filter(([p]) => p === '/support/gemeinden/7/verlauf').length).toBe(vorher + 1));
  });

  it('genau ein moeglicher Empfaenger: vorgewaehlt', async () => {
    antworten['/support/gemeinden/7/empfaenger'] = [EMPFAENGER[0]];
    render(<SupportGemeindePostPage organizationId={7} />);
    await waitFor(() => expect(empfaenger().value).toBe('leitung@example.org'));
  });

  it('Empfaenger nicht ladbar: Hinweis, Versand verlangt trotzdem eine Wahl', async () => {
    antworten['/support/gemeinden/7/empfaenger'] = new Error('Netz weg');
    render(<SupportGemeindePostPage organizationId={7} />);
    expect(await screen.findByText('Die möglichen Empfänger konnten nicht geladen werden.')).toBeInTheDocument();
  });

  it('auf diesem Server aus: Senden aus', async () => {
    antworten['/support/mail/status'] = { postfaecher: [{ postfach: 'support', adresse: 'support@konfi-quest.de', eingerichtet: true, abgeholt_am: null, fehler: null, fehler_am: null, auf_diesem_server: false }] };
    await oeffnen();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Antwort senden' })).toBeDisabled());
  });
});
