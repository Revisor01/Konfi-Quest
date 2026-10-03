// Eine Mail aus dem Posteingang (/admin/support/post/:id), gerendert: Faden
// chronologisch mit ein- und ausgehenden Mails, Zitate eingeklappt,
// Anhaenge nur als Namen, ungelesene als gelesen gemeldet; Zuordnen zu
// Anfrage (offene zuerst) oder Gemeinde und zurueck; Antworten an den
// Absender mit Rueckfrage (Support-Mail, 03.10.2026).
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

import SupportPostDetailPage from '../../../components/support/SupportPostDetailPage';
import { supportMailZaehlerZuruecksetzen } from '../../../navigation/supportMailZaehler';

const mail = (id: number, extra: Record<string, unknown> = {}) => ({
  id, postfach: 'moin', richtung: 'ein', anfrage_id: null, organization_id: null,
  von_adresse: 'anna@example.org', von_name: 'Anna Beispiel', an_adressen: ['moin@konfi-quest.de'],
  betreff: 'Frage zum Zugang', text: 'Hallo', anhaenge: [], gesendet_am: '2026-10-03T09:00:00Z', gelesen_am: null,
  ...extra,
});

// Server-Reihenfolge absichtlich durcheinander: die Seite sortiert.
const FADEN = [
  mail(31, { text: 'Danke! Und noch eins.\n\nAm 02.10.2026 um 12:00 schrieb Support <moin@konfi-quest.de>:\n> alte Antwort', anhaenge: [{ name: 'plan.pdf', groesse: 1200, typ: 'application/pdf' }] }),
  mail(29, { gesendet_am: '2026-10-02T08:00:00Z', text: 'Wie melde ich mich an?' }),
  mail(30, { richtung: 'aus', von_adresse: 'moin@konfi-quest.de', von_name: 'Support', an_adressen: ['anna@example.org'],
    betreff: 'Re: Frage zum Zugang', gesendet_am: '2026-10-02T10:00:00Z', gelesen_am: '2026-10-02T10:00:00Z', text: 'So geht es.' }),
];
const ANFRAGEN = [
  { id: 1, gemeinde: 'Wesselburen', kontakt_name: 'Carla', status: 'angelegt', created_at: '2026-10-03T08:00:00Z' },
  { id: 4, gemeinde: 'Kirchengemeinde Heide', kontakt_name: 'Anna Beispiel', status: 'neu', created_at: '2026-10-01T08:00:00Z' },
  { id: 5, gemeinde: 'Büsum', kontakt_name: 'Ben', status: 'in_arbeit', created_at: '2026-10-02T08:00:00Z' },
];
const GEMEINDEN = [{ id: 7, name: 'heide', display_name: 'Kirchengemeinde Heide' }, { id: 8, name: 'buesum', display_name: 'Büsum' }];

let nachricht: Record<string, unknown>;
let antworten: Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  h.apiGet.mockReset();
  h.apiPost.mockReset();
  h.alert = null;
  h.user = { id: 9, role_name: 'super_admin', is_super_admin: true };
  supportMailZaehlerZuruecksetzen();
  nachricht = { ...FADEN[0], verlauf: FADEN };
  antworten = {
    '/support/anfragen': ANFRAGEN,
    '/organizations': GEMEINDEN,
    '/support/mail/bausteine': [],
    '/support/mail/einstellungen': { fusszeile: 'Konfi Quest', absendername: 'Support-Team' },
    '/support/mail/status': { postfaecher: [{ postfach: 'moin', adresse: 'moin@konfi-quest.de', eingerichtet: true, abgeholt_am: null, fehler: null, fehler_am: null }] },
  };
  h.apiGet.mockImplementation((pfad: string) => {
    if (pfad === '/support/mail/nachrichten/31') {
      return nachricht instanceof Error ? Promise.reject(nachricht) : Promise.resolve({ data: nachricht });
    }
    const wert = antworten[pfad];
    if (wert === undefined) return Promise.reject(new Error(`unerwartet: ${pfad}`));
    return Promise.resolve({ data: wert });
  });
  h.apiPost.mockResolvedValue({ data: {} });
});

const oeffnen = async () => {
  render(<SupportPostDetailPage nachrichtId={31} />);
  await screen.findByText('Faden mit 3 Mails');
};

describe('Mail: Faden', () => {
  it('chronologisch, ein- und ausgehend unterscheidbar; ungelesene als gelesen gemeldet und fuer diesen Besuch „Neu"', async () => {
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

  it('Zitate sind eingeklappt und lassen sich aufklappen; Anhaenge nur als Namen', async () => {
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

  it('nichts ungelesen: kein Aufruf „gelesen"', async () => {
    nachricht = { ...FADEN[0], gelesen_am: '2026-10-03T09:30:00Z', verlauf: [{ ...FADEN[0], gelesen_am: '2026-10-03T09:30:00Z' }] };
    render(<SupportPostDetailPage nachrichtId={31} />);
    await screen.findByText('Mail');
    await act(async () => {});
    expect(h.apiPost).not.toHaveBeenCalled();
  });

  it('404: „Mail nicht gefunden"; eine ungueltige Kennung ruft nichts ab', async () => {
    nachricht = Object.assign(new Error('weg'), { response: { status: 404 } }) as unknown as Record<string, unknown>;
    const { unmount } = render(<SupportPostDetailPage nachrichtId={31} />);
    expect(await screen.findByText('Mail nicht gefunden')).toBeInTheDocument();
    unmount();
    h.apiGet.mockClear();
    render(<SupportPostDetailPage nachrichtId={Number.NaN} />);
    expect(await screen.findByText('Mail nicht gefunden')).toBeInTheDocument();
    expect(h.apiGet).not.toHaveBeenCalledWith(expect.stringMatching(/^\/support\/mail\/nachrichten/));
  });
});

describe('Mail: zuordnen', () => {
  it('Auswahl der Anfragen: offene zuerst, darin die neuesten; Zuordnen schickt die Kennung und zeigt den Weg zur Anfrage', async () => {
    await oeffnen();
    const auswahl = screen.getByLabelText('Anfrage') as HTMLSelectElement;
    expect([...auswahl.options].map((o) => o.textContent)).toEqual([
      'Anfrage wählen',
      'Büsum · Ben (In Arbeit)',
      'Kirchengemeinde Heide · Anna Beispiel (Neu)',
      'Wesselburen · Carla (Angelegt)',
    ]);
    expect(screen.getByRole('button', { name: 'Einer Anfrage zuordnen' })).toBeDisabled();
    fireEvent.change(auswahl, { target: { value: '4' } });

    nachricht = { ...nachricht, anfrage_id: 4 };
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Einer Anfrage zuordnen' })); });
    expect(h.apiPost).toHaveBeenCalledWith('/support/mail/nachrichten/31/zuordnen', { anfrage_id: 4 });
    expect(h.setSuccess).toHaveBeenCalledWith('Mail der Anfrage zugeordnet');
    expect(await screen.findByText('Zugeordnet zur Anfrage „Kirchengemeinde Heide“')).toBeInTheDocument();
    // Zugeordnet: Antworten ueber die Anfrage, nicht von hier.
    expect(screen.queryByRole('button', { name: 'Antwort senden' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Anfrage öffnen' }));
    expect(h.push).toHaveBeenCalledWith('/admin/support/anfragen/4');
  });

  it('einer Gemeinde zuordnen, danach zurueck in den Posteingang', async () => {
    await oeffnen();
    expect(screen.queryByRole('button', { name: 'Zurück in den Posteingang' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Gemeinde'), { target: { value: '7' } });
    nachricht = { ...nachricht, organization_id: 7 };
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Einer Gemeinde zuordnen' })); });
    expect(h.apiPost).toHaveBeenCalledWith('/support/mail/nachrichten/31/zuordnen', { organization_id: 7 });
    expect(await screen.findByText('Zugeordnet zur Gemeinde „Kirchengemeinde Heide“')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Schriftwechsel öffnen' }));
    expect(h.push).toHaveBeenCalledWith('/admin/support/post/gemeinde/7');

    nachricht = { ...nachricht, organization_id: null };
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Zurück in den Posteingang' })); });
    // Die Attrappe laesst die Mails ungelesen; nach dem Neuladen meldet die
    // Seite sie erneut -- geprueft werden deshalb nur die Zuordnungen.
    const zuordnungen = h.apiPost.mock.calls.filter(([p]) => p === '/support/mail/nachrichten/31/zuordnen').map(([, k]) => k);
    expect(zuordnungen).toEqual([{ organization_id: 7 }, {}]);
    expect(h.setSuccess).toHaveBeenLastCalledWith('Mail zurück im Posteingang');
    expect(await screen.findByRole('button', { name: 'Antwort senden' })).toBeInTheDocument();
  });

  it('Fehler beim Zuordnen: Meldung, die Mail bleibt', async () => {
    await oeffnen();
    fireEvent.change(screen.getByLabelText('Anfrage'), { target: { value: '5' } });
    h.apiPost.mockRejectedValueOnce({ response: { status: 404, data: { error: 'Anfrage nicht gefunden' } } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Einer Anfrage zuordnen' })); });
    expect(h.setError).toHaveBeenCalledWith('Anfrage nicht gefunden');
    expect(screen.getByText('Faden mit 3 Mails')).toBeInTheDocument();
  });
});

describe('Mail: antworten', () => {
  it('an den Absender der letzten eingehenden Mail, Betreff vorgeschlagen, mit Rueckfrage; danach neu geladen', async () => {
    await oeffnen();
    expect(screen.getByText('anna@example.org', { selector: 'strong' })).toBeInTheDocument();
    expect((screen.getByLabelText('Betreff') as HTMLInputElement).value).toBe('Re: Frage zum Zugang');
    fireEvent.change(screen.getByLabelText('Text der Antwort'), { target: { value: 'Hallo Anna,\nso geht es.' } });
    expect(screen.getByRole('region', { name: 'Vorschau der Antwort' }).textContent).toBe('Hallo Anna,\nso geht es.\n\n-- \nKonfi Quest');

    fireEvent.click(screen.getByRole('button', { name: 'Antwort senden' }));
    expect(h.alert?.header).toBe('Antwort senden');
    expect(h.alert?.message).toBe('An anna@example.org: „Re: Frage zum Zugang“ von moin@ senden?');
    expect(h.apiPost).not.toHaveBeenCalledWith('/support/mail/nachrichten/31/antworten', expect.anything());

    const abrufeVorher = h.apiGet.mock.calls.filter(([p]) => p === '/support/mail/nachrichten/31').length;
    await act(async () => { h.alert?.buttons?.find((b) => b.text === 'Senden')?.handler?.(); });
    expect(h.apiPost).toHaveBeenCalledWith('/support/mail/nachrichten/31/antworten', { text: 'Hallo Anna,\nso geht es.', betreff: 'Re: Frage zum Zugang' });
    expect(h.setSuccess).toHaveBeenCalledWith('Antwort gesendet');
    await waitFor(() => expect(h.apiGet.mock.calls.filter(([p]) => p === '/support/mail/nachrichten/31').length).toBe(abrufeVorher + 1));
    expect((screen.getByLabelText('Text der Antwort') as HTMLTextAreaElement).value).toBe('');
  });
});

describe('Mail: nur fuer Super-Admin', () => {
  it('eine Gemeindeleitung ohne Merkmal sieht den Hinweis, ohne Abruf', () => {
    h.user = { id: 5, role_name: 'org_admin', is_super_admin: false };
    render(<SupportPostDetailPage nachrichtId={31} />);
    expect(screen.getByText('Nur für den Support')).toBeInTheDocument();
    expect(h.apiGet).not.toHaveBeenCalled();
  });
});
