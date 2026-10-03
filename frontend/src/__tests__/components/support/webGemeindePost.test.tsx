// Der Schriftwechsel einer Gemeinde in der Web-Fassung
// (/admin/support/post/gemeinde/:id), gerendert (docs/planung/support-web.md,
// Phase 2): links Verlauf und Antwort-Editor mit Empfaengerauswahl wie in der
// App, rechts die Gemeinde (Status, Laufzeit, Konfis, Limit) und die
// Gemeindeleitung mit dem Link "Bearbeiten". Name und Angaben kommen aus
// GET /organizations/:id -- auch fuer eine interne Gemeinde, die in der Liste
// fehlt (Migration 194); die Leitung aus GET /support/gemeinden, falls die
// Gemeinde dort steht.
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
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

import SupportGemeindePostPage from '../../../components/support/SupportGemeindePostPage';
import { supportMailZaehlerZuruecksetzen } from '../../../navigation/supportMailZaehler';

let vorherTZ: string | undefined;
beforeAll(() => { vorherTZ = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherTZ === undefined) delete process.env.TZ; else process.env.TZ = vorherTZ; });

const mail = (id: number, extra: Record<string, unknown> = {}) => ({
  id, postfach: 'support', richtung: 'ein', anfrage_id: null, organization_id: 7,
  von_adresse: 'leitung@example.org', von_name: 'Pastorin Anna', an_adressen: ['support@konfi-quest.example'],
  betreff: 'Jahrgang anlegen [Gemeinde 7]', text: 'Wie lege ich einen Jahrgang an?', anhaenge: [],
  gesendet_am: '2026-10-02T09:00:00Z', gelesen_am: null, ...extra,
});
const EMPFAENGER = [
  { adresse: 'leitung@example.org', name: 'Pastorin Anna', herkunft: 'Gemeindeleitung' },
  { adresse: 'team@example.org', name: null, herkunft: 'Absender im Verlauf' },
];
// GET /organizations/7: eine Gemeinde mit Testphase, Limit und Wunschlizenz.
const ORGANISATION = {
  id: 7, name: 'heide', display_name: 'Kirchengemeinde Heide', is_active: true, is_trial: true, trial_ends_at: '2026-10-20T00:00:00Z',
  max_konfis: 50, konfi_count: 12, user_count: 4, wunsch_lizenz: 'standard',
};
const LISTE = [{
  id: 7, name: 'heide', display_name: 'Kirchengemeinde Heide', is_active: true, is_trial: true, trial_ends_at: '2026-10-20T00:00:00Z',
  max_konfis: 50, konfi_count: 12, team_count: 4, created_at: '2026-09-01T00:00:00Z',
  kirchenkreis_id: 11, kirchenkreis: 'Kirchenkreis Dithmarschen', landeskirche_id: 1, landeskirche: 'Nordkirche', wunsch_lizenz: 'standard',
  leitung: [
    { id: 301, display_name: 'Pastorin Anna', username: 'anna.beispiel', email: 'leitung@example.org', is_active: true, last_login_at: '2026-10-03T07:30:00Z' },
    { id: 302, display_name: 'Ben Muster', username: 'ben.muster', email: null, is_active: false, last_login_at: null },
  ],
}];

let antworten: Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  h.apiGet.mockReset();
  h.apiPost.mockReset();
  h.alert = null;
  h.breit = true;
  h.user = { id: 9, role_name: 'super_admin', is_super_admin: true };
  supportMailZaehlerZuruecksetzen();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-03T08:30:00Z'));
  antworten = {
    '/organizations/7': ORGANISATION,
    '/support/gemeinden': LISTE,
    '/support/gemeinden/7/verlauf': [
      mail(22, { richtung: 'aus', von_adresse: 'support@konfi-quest.example', von_name: 'Support', gesendet_am: '2026-10-02T10:00:00Z', gelesen_am: '2026-10-02T10:00:00Z', betreff: 'Re: Jahrgang anlegen [Gemeinde 7]', text: 'Unter Mehr.' }),
      mail(21),
      mail(23, { gesendet_am: '2026-10-02T12:00:00Z', text: 'Danke!' }),
    ],
    '/support/gemeinden/7/empfaenger': EMPFAENGER,
    '/support/mail/bausteine': [
      { id: 1, titel: 'Zugangsdaten unterwegs', betreff: 'Zugang für {{gemeinde}}', text: 'Hallo {{name}}, dein Benutzername ist {{benutzername}}.', postfach: 'support', sortierung: 1 },
      { id: 2, titel: 'Eingang bestätigt', betreff: null, text: 'Danke.', postfach: 'moin', sortierung: 1 },
    ],
    '/support/mail/einstellungen': { fusszeile: 'Konfi Quest', absendername: 'Support-Team' },
    '/support/mail/status': { postfaecher: [{ postfach: 'support', adresse: 'support@konfi-quest.example', eingerichtet: true, abgeholt_am: null, fehler: null, fehler_am: null, auf_diesem_server: true }] },
    '/support/mail/platzhalter': { name: 'Pastorin Anna', gemeinde: 'Kirchengemeinde Heide', lizenz: 'Standard', testphase_bis: '2026-11-02', benutzername: 'anna.beispiel', absender: 'Support-Team' },
  };
  h.apiGet.mockImplementation((pfad: string) => {
    const wert = antworten[pfad];
    if (wert === undefined) return Promise.reject(new Error(`unerwartet: ${pfad}`));
    return wert instanceof Error ? Promise.reject(wert) : Promise.resolve({ data: wert });
  });
  h.apiPost.mockResolvedValue({ data: {} });
});
afterEach(() => { vi.useRealTimers(); });

const oeffnen = async () => {
  render(<SupportGemeindePostPage organizationId={7} />);
  await screen.findByRole('heading', { level: 1, name: 'Kirchengemeinde Heide' });
  await screen.findAllByRole('article');
  await waitFor(() => expect((screen.getByLabelText('Empfänger') as HTMLSelectElement).options.length).toBe(3));
  await waitFor(() => expect((screen.getByLabelText('Textbaustein') as HTMLSelectElement).options.length).toBeGreaterThan(1));
};

const seite = () => screen.getByRole('complementary', { name: 'Angaben zur Gemeinde' });
const empfaenger = () => screen.getByLabelText('Empfänger') as HTMLSelectElement;
const text = () => screen.getByLabelText('Text der Antwort') as HTMLTextAreaElement;
const angabe = (label: string) => [...seite().querySelectorAll('.web-angaben__zeile')]
  .find((z) => z.querySelector('dt')!.textContent === label)!.querySelector('dd')!;

describe('Schriftwechsel einer Gemeinde (Web): Aufbau', () => {
  it('zwei Spalten: links Schriftwechsel und Antworten, rechts Gemeinde und Gemeindeleitung', async () => {
    await oeffnen();
    const haupt = document.querySelector('.web-spalten__haupt') as HTMLElement;
    expect([...haupt.querySelectorAll('h2.web-karte__titel')].map((t) => t.textContent)).toEqual(['Schriftwechsel', 'Antworten']);
    expect([...seite().querySelectorAll('h2.web-karte__titel')].map((t) => t.textContent)).toEqual(['Gemeinde', 'Gemeindeleitung']);
    expect(screen.getByText('Schriftwechsel über support@')).toBeInTheDocument();
    const zurueck = screen.getByRole('link', { name: 'Posteingang' });
    expect(zurueck).toHaveAttribute('href', '/admin/support/post');
  });

  it('der Name kommt aus /organizations/:id, nie aus der Liste /organizations', async () => {
    await oeffnen();
    expect(h.apiGet).toHaveBeenCalledWith('/organizations/7');
    expect(h.apiGet).not.toHaveBeenCalledWith('/organizations');
  });
});

describe('Schriftwechsel einer Gemeinde (Web): Karte Gemeinde', () => {
  it('Status, Laufzeit, Konfis und Limit, Team, Wunschlizenz, Kirchenkreis und Landeskirche', async () => {
    await oeffnen();
    await waitFor(() => expect(angabe('Kirchenkreis')).toHaveTextContent('Kirchenkreis Dithmarschen'));
    expect(angabe('Name')).toHaveTextContent('Kirchengemeinde Heide');
    expect(angabe('Status')).toHaveTextContent('Aktiv');
    expect(angabe('Laufzeit')).toHaveTextContent('Testphase bis 20.10.');
    expect(angabe('Laufzeit').querySelector('.web-pill')!.className).toContain('web-pill--info');
    expect(angabe('Konfis')).toHaveTextContent('12 Konfis von 50');
    expect(angabe('Team')).toHaveTextContent('4');
    expect(angabe('Wunschlizenz')).toHaveTextContent('Standard');
    expect(angabe('Landeskirche')).toHaveTextContent('Nordkirche');
  });

  it('ohne Limit: "ohne Limit"; gesperrt: Marke "Gesperrt"; Limit erreicht: ein Wort dazu', async () => {
    antworten['/organizations/7'] = { ...ORGANISATION, max_konfis: null, is_active: false, is_trial: false, trial_ends_at: null };
    await oeffnen();
    expect(angabe('Konfis')).toHaveTextContent('12 Konfis · ohne Limit');
    expect(angabe('Status')).toHaveTextContent('Gesperrt');
    expect(angabe('Laufzeit')).toHaveTextContent('Unbegrenzt');
  });

  it('Limit erreicht steht dabei', async () => {
    antworten['/organizations/7'] = { ...ORGANISATION, max_konfis: 12 };
    await oeffnen();
    expect(angabe('Konfis')).toHaveTextContent('12 Konfis von 12 — Limit erreicht');
  });

  it('der Link "Bearbeiten" oeffnet das Formular der Gemeinde gleich im Bearbeiten-Modus und bleibt in der App', async () => {
    await oeffnen();
    const link = within(seite()).getByRole('link', { name: 'Bearbeiten' });
    expect(link).toHaveAttribute('href', '/admin/organizations?gemeinde=7&bearbeiten=1');
    fireEvent.click(link);
    expect(h.push).toHaveBeenCalledWith('/admin/organizations?gemeinde=7&bearbeiten=1', 'none', 'push');
  });

  it('Gemeinde nicht lesbar: Hinweis, der Schriftwechsel geht trotzdem; der Titel nennt die Kennung', async () => {
    antworten['/organizations/7'] = new Error('nicht da');
    render(<SupportGemeindePostPage organizationId={7} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Gemeinde 7' })).toBeInTheDocument();
    expect(await screen.findByText('Die Angaben zur Gemeinde konnten nicht geladen werden.')).toBeInTheDocument();
    expect((await screen.findAllByRole('article')).length).toBe(3);
  });
});

describe('Schriftwechsel einer Gemeinde (Web): Gemeindeleitung', () => {
  it('Name, Benutzername, E-Mail als Link, zuletzt angemeldet; gesperrt und "noch nie angemeldet"', async () => {
    await oeffnen();
    const leitung = await waitFor(() => {
      const karte = screen.getByRole('heading', { level: 2, name: 'Gemeindeleitung' }).closest('section')!;
      const personen = karte.querySelectorAll('.web-person');
      expect(personen).toHaveLength(2);
      return [...personen] as HTMLElement[];
    });
    expect(leitung[0]).toHaveTextContent('Pastorin Anna');
    expect(leitung[0]).toHaveTextContent('@anna.beispiel');
    expect(within(leitung[0]).getByRole('link', { name: 'leitung@example.org' })).toHaveAttribute('href', 'mailto:leitung@example.org');
    expect(leitung[0]).toHaveTextContent('zuletzt angemeldet vor 1 Std.');
    expect(leitung[0]).not.toHaveTextContent('gesperrt');
    expect(leitung[1]).toHaveTextContent('Ben Muster');
    expect(leitung[1]).toHaveTextContent('gesperrt');
    expect(leitung[1]).toHaveTextContent('noch nie angemeldet');
    expect(within(leitung[1]).queryByRole('link')).toBeNull();
  });

  it('eine Gemeinde, die nicht in der Liste steht (z. B. intern): Name und Angaben aus der einzelnen Route, ohne Leitung', async () => {
    antworten['/support/gemeinden'] = [{ ...LISTE[0], id: 3, display_name: 'Andere Gemeinde' }];
    await oeffnen();
    expect(await screen.findByText('Diese Gemeinde steht nicht in der Liste der Gemeinden; ihre Leitung lässt sich hier nicht anzeigen.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Kirchengemeinde Heide' })).toBeInTheDocument();
    expect(angabe('Konfis')).toHaveTextContent('12 Konfis von 50');
    // Die Wunschlizenz kommt aus der einzelnen Route, nicht aus der Liste.
    expect(angabe('Wunschlizenz')).toHaveTextContent('Standard');
    // Ohne Eintrag in der Liste gibt es weder Kirchenkreis noch Landeskirche -- es steht ein Strich da.
    expect(angabe('Kirchenkreis')).toHaveTextContent('–');
    expect(document.querySelector('.web-person')).toBeNull();
  });

  it('die Liste der Gemeinden nicht ladbar: Hinweis zur Leitung, der Rest bleibt', async () => {
    antworten['/support/gemeinden'] = new Error('kaputt');
    await oeffnen();
    expect(await screen.findByText('Die Gemeindeleitung konnte nicht geladen werden.')).toBeInTheDocument();
    expect(angabe('Name')).toHaveTextContent('Kirchengemeinde Heide');
  });

  it('eine Gemeinde ohne Leitung in der Liste: ein Satz dazu', async () => {
    antworten['/support/gemeinden'] = [{ ...LISTE[0], leitung: [] }];
    await oeffnen();
    expect(await screen.findByText('Für diese Gemeinde ist keine Gemeindeleitung hinterlegt.')).toBeInTheDocument();
  });
});

describe('Schriftwechsel einer Gemeinde (Web): Verlauf', () => {
  it('aelteste zuerst; die ungelesenen werden gemeldet und tragen "Neu"', async () => {
    await oeffnen();
    const mails = screen.getAllByRole('article');
    expect(mails.map((m) => m.getAttribute('aria-label'))).toEqual([
      'Eingegangen am 02.10.2026, 11:00',
      'Gesendet am 02.10.2026, 12:00',
      'Eingegangen am 02.10.2026, 14:00',
    ]);
    expect(mails.map((m) => m.textContent?.includes('Neu'))).toEqual([true, false, true]);
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledWith('/support/mail/gelesen', { ids: [21, 23] }));
    expect(screen.getByText('3 Mails über support@')).toBeInTheDocument();
  });

  it('Verlauf nicht ladbar: Hinweis mit neuem Versuch', async () => {
    antworten['/support/gemeinden/7/verlauf'] = new Error('Netz weg');
    render(<SupportGemeindePostPage organizationId={7} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Der Schriftwechsel konnte nicht geladen werden.');
    antworten['/support/gemeinden/7/verlauf'] = [];
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' })); });
    expect(await screen.findByText('Noch keine Mails mit dieser Gemeinde.')).toBeInTheDocument();
    // Ohne Mails heisst die Karte "Schreiben", nicht "Antworten".
    expect(screen.getByRole('heading', { level: 2, name: 'Schreiben' })).toBeInTheDocument();
  });
});

describe('Schriftwechsel einer Gemeinde (Web): Antworten', () => {
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
      .toEqual(['Baustein wählen', 'Zugangsdaten unterwegs']);
    expect((screen.getByLabelText('Betreff') as HTMLInputElement).value).toBe('Re: Jahrgang anlegen [Gemeinde 7]');
    fireEvent.change(screen.getByLabelText('Textbaustein'), { target: { value: '1' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Baustein einfügen' })); });
    expect(h.apiGet).toHaveBeenCalledWith('/support/mail/platzhalter', { params: { organization_id: 7 } });
    expect(text().value).toBe('Hallo Pastorin Anna, dein Benutzername ist anna.beispiel.');
    expect((screen.getByLabelText('Betreff') as HTMLInputElement).value).toBe('Zugang für Kirchengemeinde Heide');
  });

  it('Senden an den gewaehlten Empfaenger mit Rueckfrage; Koerper an den Server; danach Verlauf neu', async () => {
    await oeffnen();
    fireEvent.change(empfaenger(), { target: { value: 'leitung@example.org' } });
    fireEvent.change(text(), { target: { value: 'Hallo Anna' } });
    fireEvent.click(screen.getByRole('button', { name: 'Antwort senden' }));
    expect(h.alert?.message).toBe('An leitung@example.org: „Re: Jahrgang anlegen [Gemeinde 7]“ von support@ senden?');
    const verlaufVorher = h.apiGet.mock.calls.filter(([p]) => p === '/support/gemeinden/7/verlauf').length;
    await act(async () => { h.alert?.buttons?.find((b) => b.text === 'Senden')?.handler?.(); });
    expect(h.apiPost).toHaveBeenCalledWith('/support/gemeinden/7/antworten', {
      text: 'Hallo Anna',
      betreff: 'Re: Jahrgang anlegen [Gemeinde 7]',
      an: 'leitung@example.org',
    });
    expect(h.setSuccess).toHaveBeenCalledWith('Antwort gesendet');
    await waitFor(() => expect(h.apiGet.mock.calls.filter(([p]) => p === '/support/gemeinden/7/verlauf').length).toBe(verlaufVorher + 1));
  });

  it('genau ein moeglicher Empfaenger ist vorgewaehlt; keiner: ein Satz dazu', async () => {
    antworten['/support/gemeinden/7/empfaenger'] = [EMPFAENGER[0]];
    render(<SupportGemeindePostPage organizationId={7} />);
    await screen.findAllByRole('article');
    await waitFor(() => expect((screen.getByLabelText('Empfänger') as HTMLSelectElement).options.length).toBe(2));
    expect(empfaenger().value).toBe('leitung@example.org');
  });

  it('keine Empfaenger: Hinweis; Empfaenger nicht ladbar: eigener Hinweis', async () => {
    antworten['/support/gemeinden/7/empfaenger'] = [];
    const { unmount } = render(<SupportGemeindePostPage organizationId={7} />);
    expect(await screen.findByText('Für diese Gemeinde ist keine Adresse bekannt.')).toBeInTheDocument();
    unmount();
    antworten['/support/gemeinden/7/empfaenger'] = new Error('kaputt');
    render(<SupportGemeindePostPage organizationId={7} />);
    expect(await screen.findByText('Die möglichen Empfänger konnten nicht geladen werden.')).toBeInTheDocument();
  });
});

describe('Schriftwechsel einer Gemeinde: zwei Gesichter, eine Seite', () => {
  it('keine gueltige Kennung: Hinweis, kein Abruf -- auch in der Web-Fassung', () => {
    render(<SupportGemeindePostPage organizationId={Number.NaN} />);
    expect(screen.getByText('Gemeinde nicht gefunden')).toBeInTheDocument();
    expect(document.querySelector('.web-seite')).not.toBeNull();
    expect(h.apiGet).not.toHaveBeenCalled();
  });

  it('im schmalen Fenster bleibt die App-Darstellung -- mit demselben Abruf der einzelnen Gemeinde', async () => {
    h.breit = false;
    render(<SupportGemeindePostPage organizationId={7} />);
    await screen.findByText('Kirchengemeinde Heide');
    await screen.findAllByRole('article');
    expect(document.querySelector('.web-seite')).toBeNull();
    expect(screen.getByRole('button', { name: 'Gemeinde öffnen' })).toBeInTheDocument();
    expect(h.apiGet).toHaveBeenCalledWith('/organizations/7');
    expect(h.apiGet).not.toHaveBeenCalledWith('/support/gemeinden');
  });

  it('ohne Super-Admin-Recht: Hinweis, kein Abruf', () => {
    h.user = { id: 5, role_name: 'org_admin', is_super_admin: false };
    render(<SupportGemeindePostPage organizationId={7} />);
    expect(screen.getByText('Nur für den Support')).toBeInTheDocument();
    expect(h.apiGet).not.toHaveBeenCalled();
  });
});
