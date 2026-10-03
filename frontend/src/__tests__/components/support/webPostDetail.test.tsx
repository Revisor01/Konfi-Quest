// Eine Mail aus dem Posteingang in der Web-Fassung (/admin/support/post/:id),
// gerendert (docs/planung/support-web.md, Phase 2): wie ein Mailprogramm --
// Kopf (Von, An, Datum, Postfach), Text, Anhaenge, die weiteren Mails des
// Fadens, rechts "Zuordnen" mit Suche in der Auswahl, darunter der
// Antwort-Editor. Die Logik ist die der App (usePostDetail). Im schmalen
// Fenster bleibt die Seite der App.
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import type { AlertOptionen } from './ionicAttrappe';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  push: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  alert: null as null | AlertOptionen,
  breit: true,
  user: { id: 9, role_name: 'super_admin', is_super_admin: true } as Record<string, unknown>,
}));

vi.mock('@ionic/react', async () => (await import('./ionicAttrappe')).ionicAttrappe({
  presentAlert: (o) => { h.alert = o; },
  router: { push: h.push, goBack: vi.fn(), canGoBack: () => false },
}));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('./ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: ({ message }: { message: string }) => <p>{message}</p> }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: true }),
}));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));

import SupportPostDetailPage from '../../../components/support/SupportPostDetailPage';
import { supportMailZaehlerZuruecksetzen } from '../../../navigation/supportMailZaehler';

let vorherTZ: string | undefined;
beforeAll(() => { vorherTZ = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherTZ === undefined) delete process.env.TZ; else process.env.TZ = vorherTZ; });

const mail = (id: number, extra: Record<string, unknown> = {}) => ({
  id, postfach: 'moin', richtung: 'ein', anfrage_id: null, organization_id: null,
  von_adresse: 'anna@example.org', von_name: 'Anna Beispiel', an_adressen: ['moin@konfi-quest.example'],
  betreff: 'Frage zum Zugang', text: 'Hallo', anhaenge: [], gesendet_am: '2026-10-03T09:00:00Z', gelesen_am: null,
  ...extra,
});

// Server-Reihenfolge absichtlich durcheinander: die Seite sortiert.
const FADEN = [
  mail(31, { text: 'Danke! Und noch eins.\n\nAm 02.10.2026 um 12:00 schrieb Support <moin@konfi-quest.example>:\n> alte Antwort', anhaenge: [{ name: 'plan.pdf', groesse: 1200, typ: 'application/pdf' }] }),
  mail(29, { gesendet_am: '2026-10-02T08:00:00Z', text: 'Wie melde ich mich an?' }),
  mail(30, { richtung: 'aus', von_adresse: 'moin@konfi-quest.example', von_name: 'Support', an_adressen: ['anna@example.org'],
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
  h.breit = true;
  h.user = { id: 9, role_name: 'super_admin', is_super_admin: true };
  supportMailZaehlerZuruecksetzen();
  nachricht = { ...FADEN[0], verlauf: FADEN };
  antworten = {
    '/support/anfragen': ANFRAGEN,
    '/organizations': GEMEINDEN,
    '/support/mail/bausteine': [],
    '/support/mail/einstellungen': { fusszeile: 'Konfi Quest', absendername: 'Support-Team' },
    '/support/mail/status': { postfaecher: [{ postfach: 'moin', adresse: 'moin@konfi-quest.example', eingerichtet: true, abgeholt_am: null, fehler: null, fehler_am: null }] },
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
  await screen.findByRole('heading', { level: 2, name: 'Frage zum Zugang' });
  await waitFor(() => expect(screen.getAllByRole('radio').length).toBeGreaterThan(0));
};

const seite = () => screen.getByRole('complementary', { name: 'Zuordnung' });
const radios = () => screen.getAllByRole('radio').map((r) => r.closest('label')!.querySelector('.web-wahl__titel')!.textContent);
const zuordnungen = () => h.apiPost.mock.calls.filter(([p]) => p === '/support/mail/nachrichten/31/zuordnen').map(([, k]) => k);

describe('Mail (Web): wie ein Mailprogramm', () => {
  it('der Betreff ist die Ueberschrift der Karte; der Kopf nennt Von, An, Datum und Postfach', async () => {
    await oeffnen();
    expect(screen.getByRole('heading', { level: 1, name: 'Mail' })).toBeInTheDocument();
    const karte = screen.getByRole('heading', { level: 2, name: 'Frage zum Zugang' }).closest('section')!;
    const kopf = karte.querySelector('.web-mail__kopfdaten')!;
    expect([...kopf.querySelectorAll('dt')].map((d) => d.textContent)).toEqual(['Von', 'An', 'Datum', 'Postfach']);
    const werte = [...kopf.querySelectorAll('dd')].map((d) => d.textContent);
    expect(werte[0]).toBe('Anna Beispiel <anna@example.org>');
    expect(werte[1]).toBe('moin@konfi-quest.example');
    expect(werte[2]).toBe('03.10.2026, 11:00');
    expect(werte[3]).toContain('moin@');
    expect(werte[3]).toContain('Eingegangen');
    // Die geoeffnete Mail war ungelesen: "Neu" an ihr, fuer diesen Besuch.
    expect(werte[3]).toContain('Neu');
    expect(screen.getByText('03.10.2026, 11:00 · Faden mit 3 Mails')).toBeInTheDocument();
  });

  it('der Weg zurueck ist ein Link auf den Posteingang, der in der App bleibt', async () => {
    await oeffnen();
    const zurueck = screen.getByRole('link', { name: 'Posteingang' });
    expect(zurueck).toHaveAttribute('href', '/admin/support/post');
    fireEvent.click(zurueck);
    expect(h.push).toHaveBeenCalledWith('/admin/support/post', 'none', 'push');
  });

  it('Text mit eingeklapptem Zitat, Anhaenge nur als Namen', async () => {
    await oeffnen();
    const karte = screen.getByRole('heading', { level: 2, name: 'Frage zum Zugang' }).closest('section')!;
    expect(within(karte).getByText('Danke! Und noch eins.')).toBeInTheDocument();
    expect(screen.queryByText(/alte Antwort/)).toBeNull();
    fireEvent.click(within(karte).getByRole('button', { name: 'Zitat einblenden' }));
    expect(screen.getByText(/alte Antwort/).textContent).toBe('Am 02.10.2026 um 12:00 schrieb Support <moin@konfi-quest.example>:\n> alte Antwort');
    expect(within(karte).getByRole('list', { name: 'Anhänge' }).textContent).toBe('plan.pdf');
  });

  it('die weiteren Mails des Fadens stehen darunter, aelteste zuerst -- ohne die geoeffnete', async () => {
    await oeffnen();
    const faden = screen.getByRole('list', { name: 'Weitere Mails im Faden' });
    expect(within(faden).getAllByRole('article').map((m) => m.getAttribute('aria-label'))).toEqual([
      'Eingegangen am 02.10.2026, 10:00',
      'Gesendet am 02.10.2026, 12:00',
    ]);
    expect(screen.getByRole('heading', { level: 2, name: 'Weitere Mails im Faden (2)' })).toBeInTheDocument();
    // Beim Oeffnen waren 29 und 31 ungelesen: gemeldet, und 29 traegt "Neu".
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledWith('/support/mail/gelesen', { ids: [29, 31] }));
    expect(within(faden).getAllByRole('article').map((m) => m.textContent?.includes('Neu'))).toEqual([true, false]);
  });

  it('eine einzelne Mail hat keine Karte fuer weitere Mails', async () => {
    nachricht = { ...FADEN[0], verlauf: [FADEN[0]] };
    render(<SupportPostDetailPage nachrichtId={31} />);
    await screen.findByRole('heading', { level: 2, name: 'Frage zum Zugang' });
    expect(screen.queryByRole('heading', { name: /Weitere Mails/ })).toBeNull();
    expect(screen.getByText('03.10.2026, 11:00 · einzelne Mail')).toBeInTheDocument();
  });

  it('nichts ungelesen: kein Aufruf "gelesen"', async () => {
    nachricht = { ...FADEN[0], gelesen_am: '2026-10-03T09:30:00Z', verlauf: [{ ...FADEN[0], gelesen_am: '2026-10-03T09:30:00Z' }] };
    render(<SupportPostDetailPage nachrichtId={31} />);
    await screen.findByRole('heading', { level: 2, name: 'Frage zum Zugang' });
    await act(async () => {});
    expect(h.apiPost).not.toHaveBeenCalled();
  });
});

describe('Mail (Web): zuordnen', () => {
  it('Anfragen zur Auswahl: offene zuerst, darin die neuesten; Zuordnen schickt die Kennung und zeigt den Weg zur Anfrage', async () => {
    await oeffnen();
    expect(screen.getByRole('group', { name: 'Anfrage' })).toBeInTheDocument();
    expect(radios()).toEqual(['Büsum', 'Kirchengemeinde Heide', 'Wesselburen']);
    expect(within(seite()).getByRole('radio', { name: /Büsum/ }).closest('label')).toHaveTextContent('Ben · In Arbeit');
    const zuordnen = screen.getByRole('button', { name: 'Einer Anfrage zuordnen' });
    expect(zuordnen).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: /Kirchengemeinde Heide/ }));
    expect(zuordnen).toBeEnabled();

    nachricht = { ...nachricht, anfrage_id: 4 };
    await act(async () => { fireEvent.click(zuordnen); });
    expect(zuordnungen()).toEqual([{ anfrage_id: 4 }]);
    expect(h.setSuccess).toHaveBeenCalledWith('Mail der Anfrage zugeordnet');
    expect(await screen.findByText('Zugeordnet zur Anfrage „Kirchengemeinde Heide“')).toBeInTheDocument();
    // Zugeordnet: Antworten ueber die Anfrage, nicht von hier.
    expect(screen.queryByRole('button', { name: 'Antwort senden' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 2, name: 'Antworten' })).toBeNull();
    const link = screen.getByRole('link', { name: 'Anfrage öffnen' });
    expect(link).toHaveAttribute('href', '/admin/support/anfragen/4');
    fireEvent.click(link);
    expect(h.push).toHaveBeenCalledWith('/admin/support/anfragen/4', 'none', 'push');
  });

  it('die Suche in der Auswahl: "buesum" findet Büsum, der Rest verschwindet; die Wahl bleibt beim Filtern', async () => {
    await oeffnen();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Anfrage suchen' }), { target: { value: 'buesum' } });
    expect(radios()).toEqual(['Büsum']);
    fireEvent.click(screen.getByRole('radio', { name: /Büsum/ }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Anfrage suchen' }), { target: { value: '' } });
    expect(screen.getByRole('radio', { name: /Büsum/ })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Einer Anfrage zuordnen' })).toBeEnabled();
  });

  it('die Anfrage, der die Mail schon gehoert, laesst sich nicht noch einmal zuordnen', async () => {
    nachricht = { ...FADEN[0], anfrage_id: 4, verlauf: FADEN };
    await oeffnen();
    fireEvent.click(screen.getByRole('radio', { name: /Kirchengemeinde Heide/ }));
    expect(screen.getByRole('button', { name: 'Einer Anfrage zuordnen' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: /Büsum/ }));
    expect(screen.getByRole('button', { name: 'Einer Anfrage zuordnen' })).toBeEnabled();
  });

  it('einer Gemeinde zuordnen -- mit Suche --, danach zurueck in den Posteingang', async () => {
    await oeffnen();
    expect(screen.queryByRole('button', { name: 'Zurück in den Posteingang' })).toBeNull();
    fireEvent.click(within(seite()).getByRole('button', { name: 'Gemeinde' }));
    expect(screen.getByRole('group', { name: 'Gemeinde' })).toBeInTheDocument();
    expect(radios()).toEqual(['Büsum', 'Kirchengemeinde Heide']);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Gemeinde suchen' }), { target: { value: 'heide' } });
    fireEvent.click(screen.getByRole('radio', { name: /Kirchengemeinde Heide/ }));

    nachricht = { ...nachricht, organization_id: 7 };
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Einer Gemeinde zuordnen' })); });
    expect(zuordnungen()).toEqual([{ organization_id: 7 }]);
    expect(await screen.findByText('Zugeordnet zur Gemeinde „Kirchengemeinde Heide“')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Schriftwechsel öffnen' });
    expect(link).toHaveAttribute('href', '/admin/support/post/gemeinde/7');

    nachricht = { ...nachricht, organization_id: null };
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Zurück in den Posteingang' })); });
    expect(zuordnungen()).toEqual([{ organization_id: 7 }, {}]);
    expect(h.setSuccess).toHaveBeenLastCalledWith('Mail zurück im Posteingang');
    expect(await screen.findByRole('button', { name: 'Antwort senden' })).toBeInTheDocument();
  });

  it('eine Gemeinde, die nicht in der Liste steht (z. B. eine interne), erscheint mit ihrer Kennung', async () => {
    nachricht = { ...FADEN[0], organization_id: 99, verlauf: FADEN };
    await oeffnen();
    expect(screen.getByText('Zugeordnet zur Gemeinde 99')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Schriftwechsel öffnen' })).toHaveAttribute('href', '/admin/support/post/gemeinde/99');
  });

  it('Fehler beim Zuordnen: Meldung, die Mail bleibt', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('radio', { name: /Büsum/ }));
    h.apiPost.mockRejectedValueOnce({ response: { status: 404, data: { error: 'Anfrage nicht gefunden' } } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Einer Anfrage zuordnen' })); });
    expect(h.setError).toHaveBeenCalledWith('Anfrage nicht gefunden');
    expect(screen.getByRole('heading', { level: 2, name: 'Frage zum Zugang' })).toBeInTheDocument();
  });

  it('Anfragen oder Gemeinden nicht ladbar: Hinweis, die Mail bleibt lesbar', async () => {
    antworten['/organizations'] = new Error('kaputt') as unknown as unknown[];
    h.apiGet.mockImplementation((pfad: string) => {
      if (pfad === '/support/mail/nachrichten/31') return Promise.resolve({ data: nachricht });
      if (pfad === '/organizations') return Promise.reject(new Error('kaputt'));
      const wert = antworten[pfad];
      return wert === undefined ? Promise.reject(new Error(`unerwartet: ${pfad}`)) : Promise.resolve({ data: wert });
    });
    render(<SupportPostDetailPage nachrichtId={31} />);
    expect(await screen.findByText('Anfragen oder Gemeinden konnten nicht vollständig geladen werden.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Frage zum Zugang' })).toBeInTheDocument();
  });
});

describe('Mail (Web): antworten', () => {
  it('an den Absender der letzten eingehenden Mail, Betreff vorgeschlagen, mit Rueckfrage; danach neu geladen', async () => {
    await oeffnen();
    expect(screen.getByText(/^An:/, { selector: 'p.web-antwort__an' })).toHaveTextContent('An: anna@example.org · von moin@');
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

describe('Mail (Web): Laden, Fehler, nicht gefunden', () => {
  it('404: "Mail nicht gefunden"; eine ungueltige Kennung ruft nichts ab', async () => {
    nachricht = Object.assign(new Error('weg'), { response: { status: 404 } }) as unknown as Record<string, unknown>;
    const { unmount } = render(<SupportPostDetailPage nachrichtId={31} />);
    expect(await screen.findByText('Mail nicht gefunden')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Posteingang' })).toBeInTheDocument();
    unmount();
    h.apiGet.mockClear();
    render(<SupportPostDetailPage nachrichtId={Number.NaN} />);
    expect(await screen.findByText('Mail nicht gefunden')).toBeInTheDocument();
    expect(h.apiGet).not.toHaveBeenCalledWith(expect.stringMatching(/^\/support\/mail\/nachrichten/));
  });

  it('Netzfehler: Hinweis mit erneutem Versuch, der wirklich neu laedt', async () => {
    nachricht = new Error('Netz weg') as unknown as Record<string, unknown>;
    render(<SupportPostDetailPage nachrichtId={31} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Mail konnte nicht geladen werden.');
    nachricht = { ...FADEN[0], verlauf: FADEN };
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' })); });
    expect(await screen.findByRole('heading', { level: 2, name: 'Frage zum Zugang' })).toBeInTheDocument();
  });
});

describe('Mail: zwei Gesichter, eine Seite', () => {
  it('im schmalen Fenster bleibt die App-Darstellung -- mit derselben Logik', async () => {
    h.breit = false;
    render(<SupportPostDetailPage nachrichtId={31} />);
    await screen.findByText('Faden mit 3 Mails');
    expect(document.querySelector('.web-seite')).toBeNull();
    expect(screen.getByLabelText('Anfrage')).toBeInTheDocument();
  });

  it('ohne Super-Admin-Recht: Hinweis, kein Abruf', () => {
    h.user = { id: 5, role_name: 'org_admin', is_super_admin: false };
    render(<SupportPostDetailPage nachrichtId={31} />);
    expect(screen.getByText('Nur für den Support')).toBeInTheDocument();
    expect(h.apiGet).not.toHaveBeenCalled();
  });
});
