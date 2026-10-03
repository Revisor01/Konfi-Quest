// Eine Anfrage in der Web-Fassung (/admin/support/anfragen/:id), gerendert
// (docs/planung/support-web.md, Phase 2): zwei Spalten -- links der
// Schriftwechsel (Mailverlauf) und der Antwort-Editor, rechts Angaben,
// Bearbeiten und "Gemeinde anlegen" mit Tarif samt Preisen. Die Logik ist die
// der App (useAnfrageDetail, useAntwortEditor); hier steht, dass die Web-Seite
// sie bedient. Im schmalen Fenster bleibt die Seite der App.
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import type { AlertOptionen } from './ionicAttrappe';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
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
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost, patch: h.apiPatch } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: true }),
}));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));

import SupportAnfrageDetailPage from '../../../components/support/SupportAnfrageDetailPage';
import { supportMailZaehlerZuruecksetzen } from '../../../navigation/supportMailZaehler';

let vorherTZ: string | undefined;
beforeAll(() => { vorherTZ = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherTZ === undefined) delete process.env.TZ; else process.env.TZ = vorherTZ; });

const ANFRAGE = {
  id: 4, gemeinde: 'Kirchengemeinde Heide', kirchenkreis: 'Dithmarschen', landeskirche: 'Nordkirche',
  kontakt_name: 'Anna Beispiel', funktion: 'Pastorin', email: 'anna@example.org', mobil: '0170 1234567',
  anzahl_konfis: 25, anzahl_teamer: 6, nachricht: 'Wir starten im November.', status: 'neu', notiz: null,
  organization_id: null, created_at: '2026-10-02T08:00:00Z', updated_at: '2026-10-02T08:00:00Z', ungelesen: 1,
};
const KREISE = [
  { id: 11, name: 'Kirchenkreis Dithmarschen', landeskirche_id: 1, landeskirche: 'Nordkirche' },
  { id: 12, name: 'Kirchenkreis Plön-Segeberg', landeskirche_id: 1, landeskirche: 'Nordkirche' },
];
const LANDESKIRCHEN = [{ id: 1, name: 'Nordkirche', kirchenkreise: [] }];
const mail = (id: number, extra: Record<string, unknown> = {}) => ({
  id, postfach: 'moin', richtung: 'ein', anfrage_id: 4, organization_id: null,
  von_adresse: 'anna@example.org', von_name: 'Anna Beispiel', an_adressen: ['moin@konfi-quest.example'],
  betreff: 'Re: Eure Anfrage bei Konfi Quest [Anfrage 4]', text: 'Hallo', anhaenge: [],
  gesendet_am: '2026-10-02T09:00:00Z', gelesen_am: null, ...extra,
});
// Absichtlich nicht chronologisch: die Seite sortiert.
const VERLAUF = [
  mail(12, { richtung: 'aus', von_adresse: 'moin@konfi-quest.example', von_name: 'Support', an_adressen: ['anna@example.org'],
    gesendet_am: '2026-10-02T11:00:00Z', gelesen_am: '2026-10-02T11:00:00Z', text: 'Gern, hier die Schritte.\n\n> Hallo\n> wie geht es weiter?' }),
  mail(11, { text: 'Hallo\nwie geht es weiter?', anhaenge: [{ name: 'angebot.pdf' }] }),
];
const BAUSTEINE = [
  { id: 1, titel: 'Zugangsdaten unterwegs', betreff: 'Zugang für {{gemeinde}}', text: 'Zugang für {{benutzername}} ist unterwegs.', postfach: 'support', sortierung: 1 },
  { id: 2, titel: 'Eingang bestätigt', betreff: null, text: 'Hallo {{name}},\ndanke für eure Anfrage für {{gemeinde}} ({{lizenz}}). {{unbekannt}}\n{{absender}}', postfach: 'moin', sortierung: 1 },
  { id: 3, titel: 'Absage', betreff: null, text: 'Leider nein.', postfach: null, sortierung: 2 },
];
const PLATZHALTER = { name: 'Anna Beispiel', gemeinde: 'Kirchengemeinde Heide', lizenz: 'Standard', testphase_bis: null, benutzername: null, absender: null };

let antworten: Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  h.apiGet.mockReset();
  h.apiPost.mockReset();
  h.apiPatch.mockReset();
  h.alert = null;
  h.breit = true;
  h.user = { id: 9, role_name: 'super_admin', is_super_admin: true };
  supportMailZaehlerZuruecksetzen();
  antworten = {
    '/support/anfragen': [ANFRAGE],
    '/support/kirchenkreise': KREISE,
    '/support/landeskirchen': LANDESKIRCHEN,
    '/support/anfragen/4/verlauf': VERLAUF,
    '/support/mail/bausteine': BAUSTEINE,
    '/support/mail/einstellungen': { fusszeile: 'Konfi Quest\nmoin@konfi-quest.example', absendername: 'Support-Team' },
    '/support/mail/status': { postfaecher: [{ postfach: 'moin', adresse: 'moin@konfi-quest.example', eingerichtet: true, abgeholt_am: null, fehler: null, fehler_am: null, auf_diesem_server: true }] },
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
  await screen.findByRole('heading', { level: 1, name: 'Kirchengemeinde Heide' });
  await screen.findAllByRole('article');
  // Bausteine, Einstellungen und Zustand laden im Editor fuer sich.
  await waitFor(() => expect((screen.getByLabelText('Textbaustein') as HTMLSelectElement).options.length).toBeGreaterThan(1));
};

const seite = () => screen.getByRole('complementary', { name: 'Angaben und Bearbeitung' });
const feld = (name: string) => screen.getByLabelText(name) as HTMLInputElement;
const tarif = () => screen.getByLabelText('Tarif') as HTMLSelectElement;
const text = () => screen.getByLabelText('Text der Antwort') as HTMLTextAreaElement;
const kopie = (name: string) => screen.getByRole('heading', { level: 2, name });
const anlegenKnopf = () => screen.getByRole('button', { name: 'Gemeinde anlegen' });
/** Schreibende Aufrufe ohne das stille "als gelesen melden" des Verlaufs. */
const posts = () => h.apiPost.mock.calls.filter(([pfad]) => pfad !== '/support/mail/gelesen');
const bestaetigen = async (knopf: string) => { await act(async () => { h.alert?.buttons?.find((b) => b.text === knopf)?.handler?.(); }); };

describe('Anfrage (Web): Aufbau', () => {
  it('zwei Spalten: links Schriftwechsel und Antworten, rechts Angaben, Bearbeiten und Gemeinde anlegen', async () => {
    await oeffnen();
    const haupt = document.querySelector('.web-spalten__haupt') as HTMLElement;
    expect([...haupt.querySelectorAll('h2.web-karte__titel')].map((t) => t.textContent)).toEqual(['Nachricht aus dem Formular', 'Schriftwechsel', 'Antworten']);
    expect([...seite().querySelectorAll('h2.web-karte__titel')].map((t) => t.textContent)).toEqual(['Angaben', 'Bearbeiten', 'Gemeinde anlegen']);
    expect(screen.getByRole('heading', { level: 1, name: 'Kirchengemeinde Heide' })).toBeInTheDocument();
    expect(screen.getByText('Anfrage vom 02.10.2026, 10:00')).toBeInTheDocument();
  });

  it('der Weg zurueck ist ein Link auf die Liste der Anfragen, der in der App bleibt', async () => {
    await oeffnen();
    const zurueck = screen.getByRole('link', { name: 'Alle Anfragen' });
    expect(zurueck).toHaveAttribute('href', '/admin/support/anfragen');
    fireEvent.click(zurueck);
    expect(h.push).toHaveBeenCalledWith('/admin/support/anfragen', 'none', 'push');
  });

  it('die Nachricht aus dem Formular steht als eigene Karte; ohne Nachricht fehlt die Karte', async () => {
    await oeffnen();
    expect(within(kopie('Nachricht aus dem Formular').closest('section')!).getByText('Wir starten im November.')).toBeInTheDocument();
  });

  it('ohne Nachricht keine Karte dafuer', async () => {
    antworten['/support/anfragen'] = [{ ...ANFRAGE, nachricht: null }];
    await oeffnen();
    expect(screen.queryByRole('heading', { level: 2, name: 'Nachricht aus dem Formular' })).toBeNull();
  });
});

describe('Anfrage (Web): Angaben', () => {
  it('alle Angaben aus dem Formular; Mail und Telefon sind Verweise', async () => {
    await oeffnen();
    const angaben = within(seite()).getByLabelText('Angaben aus dem Formular');
    const wert = (label: string) => [...angaben.querySelectorAll('.web-angaben__zeile')]
      .find((z) => z.querySelector('dt')!.textContent === label)!.querySelector('dd')!;
    expect(wert('Gemeinde')).toHaveTextContent('Kirchengemeinde Heide');
    expect(wert('Verantwortlich')).toHaveTextContent('Anna Beispiel (Pastorin)');
    expect(within(wert('E-Mail')).getByRole('link', { name: 'anna@example.org' })).toHaveAttribute('href', 'mailto:anna@example.org');
    expect(within(wert('Mobilnummer')).getByRole('link', { name: '0170 1234567' })).toHaveAttribute('href', 'tel:01701234567');
    expect(wert('Kirchenkreis')).toHaveTextContent('Dithmarschen');
    expect(wert('Landeskirche')).toHaveTextContent('Nordkirche');
    expect(wert('Ungefähre Zahl')).toHaveTextContent('25 Konfis · 6 Teamer:innen');
    expect(wert('Wunschlizenz')).toHaveTextContent('Noch offen');
    expect(wert('Eingegangen')).toHaveTextContent('02.10.2026, 10:00');
  });

  it('die Wunschlizenz steht mit Preis da; ohne Mobilnummer und Kirchenkreis stehen Striche', async () => {
    antworten['/support/anfragen'] = [{ ...ANFRAGE, wunsch_lizenz: 'standard', mobil: null, kirchenkreis: null, landeskirche: null }];
    await oeffnen();
    const angaben = within(seite()).getByLabelText('Angaben aus dem Formular');
    const wert = (label: string) => [...angaben.querySelectorAll('.web-angaben__zeile')]
      .find((z) => z.querySelector('dt')!.textContent === label)!.querySelector('dd')!.textContent;
    expect(wert('Wunschlizenz')).toBe('Standard — bis 50 Konfis, 99 € pro Jahr');
    expect(wert('Mobilnummer')).toBe('–');
    expect(wert('Kirchenkreis')).toBe('–');
    expect(wert('Landeskirche')).toBe('–');
  });

  it('"zuletzt geaendert" steht nur, wenn sich die Anfrage nach dem Eingang geaendert hat', async () => {
    antworten['/support/anfragen'] = [{ ...ANFRAGE, updated_at: '2026-10-03T07:30:00Z' }];
    await oeffnen();
    expect(within(seite()).getByText('02.10.2026, 10:00 · zuletzt geändert 03.10.2026, 09:30')).toBeInTheDocument();
  });
});

describe('Anfrage (Web): Schriftwechsel', () => {
  it('aelteste zuerst, ein- und ausgehend unterscheidbar; die ungelesene wird gemeldet und traegt "Neu"', async () => {
    await oeffnen();
    const mails = screen.getAllByRole('article');
    expect(mails.map((m) => m.getAttribute('aria-label'))).toEqual([
      'Eingegangen am 02.10.2026, 11:00',
      'Gesendet am 02.10.2026, 13:00',
    ]);
    expect(mails[0]).toHaveTextContent('Neu');
    expect(mails[1]).not.toHaveTextContent('Neu');
    expect(within(mails[0]).getByRole('list', { name: 'Anhänge' })).toHaveTextContent('angebot.pdf');
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledWith('/support/mail/gelesen', { ids: [11] }));
    expect(screen.getByText('2 Mails mit anna@example.org')).toBeInTheDocument();
  });

  it('das Zitat in der Antwort ist eingeklappt und laesst sich aufklappen', async () => {
    await oeffnen();
    expect(screen.getByText('Gern, hier die Schritte.')).toBeInTheDocument();
    expect(screen.queryByText(/> wie geht es weiter\?/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Zitat einblenden' }));
    expect(screen.getByText(/> wie geht es weiter\?/)).toBeInTheDocument();
  });

  it('Verlauf nicht ladbar: Hinweis mit neuem Versuch, die Anfrage bleibt bedienbar', async () => {
    antworten['/support/anfragen/4/verlauf'] = new Error('Netz weg');
    render(<SupportAnfrageDetailPage anfrageId={4} />);
    await screen.findByRole('heading', { level: 1, name: 'Kirchengemeinde Heide' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Der Verlauf konnte nicht geladen werden.');
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeInTheDocument();
    antworten['/support/anfragen/4/verlauf'] = [];
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' })); });
    expect(await screen.findByText('Noch keine Mails zu dieser Anfrage.')).toBeInTheDocument();
    // Ohne Verlauf antwortet der Support auf die automatische Bestaetigung.
    expect(feld('Betreff').value).toBe('Re: Eure Anfrage bei Konfi Quest');
  });
});

describe('Anfrage (Web): Antworten', () => {
  it('Bausteine nur fuer moin@ und beide; Einfuegen fuellt die Platzhalter der Anfrage, Unbekanntes bleibt stehen', async () => {
    await oeffnen();
    const auswahl = screen.getByLabelText('Textbaustein') as HTMLSelectElement;
    expect([...auswahl.options].map((o) => o.textContent)).toEqual(['Baustein wählen', 'Eingang bestätigt', 'Absage']);
    expect(screen.getByRole('button', { name: 'Baustein einfügen' })).toBeDisabled();
    fireEvent.change(auswahl, { target: { value: '2' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Baustein einfügen' })); });
    expect(h.apiGet).toHaveBeenCalledWith('/support/mail/platzhalter', { params: { anfrage_id: 4 } });
    expect(text().value).toBe('Hallo Anna Beispiel,\ndanke für eure Anfrage für Kirchengemeinde Heide (Standard). {{unbekannt}}\nSupport-Team');
    expect(feld('Betreff').value).toBe('Re: Eure Anfrage bei Konfi Quest [Anfrage 4]');
  });

  it('die Empfaengerin steht fest da (An: ... von moin@); Vorschau mit Fusszeile', async () => {
    await oeffnen();
    expect(screen.getByText(/^An:/, { selector: 'p.web-antwort__an' })).toHaveTextContent('An: anna@example.org · von moin@');
    fireEvent.change(text(), { target: { value: 'Hallo Anna,\nes geht los.' } });
    expect(screen.getByRole('region', { name: 'Vorschau der Antwort' }).textContent)
      .toBe('Hallo Anna,\nes geht los.\n\n-- \nKonfi Quest\nmoin@konfi-quest.example');
  });

  it('ohne Text: Meldung, keine Rueckfrage, kein Versand', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Antwort senden' }));
    expect(h.setError).toHaveBeenCalledWith('Bitte einen Text schreiben');
    expect(h.alert).toBeNull();
  });

  it('Senden mit Rueckfrage; Koerper an den Server; danach Verlauf neu, Text leer, Status "In Arbeit"', async () => {
    await oeffnen();
    fireEvent.change(text(), { target: { value: 'Hallo Anna,\nes geht los.\n\n' } });
    fireEvent.click(screen.getByRole('button', { name: 'Antwort senden' }));
    expect(h.alert?.message).toBe('An anna@example.org: „Re: Eure Anfrage bei Konfi Quest [Anfrage 4]“ von moin@ senden?');
    expect(h.apiPost).not.toHaveBeenCalledWith('/support/anfragen/4/antworten', expect.anything());

    const verlaufVorher = h.apiGet.mock.calls.filter(([p]) => p === '/support/anfragen/4/verlauf').length;
    await bestaetigen('Senden');
    expect(h.apiPost).toHaveBeenCalledWith('/support/anfragen/4/antworten', {
      text: 'Hallo Anna,\nes geht los.',
      betreff: 'Re: Eure Anfrage bei Konfi Quest [Anfrage 4]',
    });
    expect(h.setSuccess).toHaveBeenCalledWith('Antwort gesendet');
    expect(text().value).toBe('');
    await waitFor(() => expect(h.apiGet.mock.calls.filter(([p]) => p === '/support/anfragen/4/verlauf').length).toBe(verlaufVorher + 1));
    expect((screen.getByLabelText('Status') as HTMLSelectElement).value).toBe('in_arbeit');
  });

  it('502: "Versand gescheitert", der Text bleibt', async () => {
    await oeffnen();
    fireEvent.change(text(), { target: { value: 'Hallo Anna' } });
    fireEvent.click(screen.getByRole('button', { name: 'Antwort senden' }));
    h.apiPost.mockRejectedValueOnce({ response: { status: 502, data: { error: 'SMTP' } } });
    await bestaetigen('Senden');
    expect(await screen.findByRole('alert')).toHaveTextContent('Versand gescheitert');
    expect(text().value).toBe('Hallo Anna');
    expect(h.setSuccess).not.toHaveBeenCalledWith('Antwort gesendet');
  });

  it('503 "Auf diesem Server ist der Versand aus.": der Text des Servers, der Entwurf bleibt', async () => {
    await oeffnen();
    fireEvent.change(text(), { target: { value: 'Hallo Anna' } });
    fireEvent.click(screen.getByRole('button', { name: 'Antwort senden' }));
    h.apiPost.mockRejectedValueOnce({ response: { status: 503, data: { error: 'Auf diesem Server ist der Versand aus.' } } });
    await bestaetigen('Senden');
    const hinweis = await screen.findByRole('alert');
    expect(hinweis).toHaveTextContent('Nicht gesendet');
    expect(hinweis).toHaveTextContent('Auf diesem Server ist der Versand aus. Dein Text bleibt hier stehen.');
    expect(text().value).toBe('Hallo Anna');
  });

  it('auf diesem Server aus: Hinweis, Senden aus -- mit Grund daneben', async () => {
    antworten['/support/mail/status'] = { postfaecher: [{ postfach: 'moin', adresse: 'moin@konfi-quest.example', eingerichtet: true, abgeholt_am: null, fehler: null, fehler_am: null, auf_diesem_server: false }] };
    await oeffnen();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Antwort senden' })).toBeDisabled());
    expect(screen.getByText('Auf diesem Server aus – Versand und Abholen laufen auf dem Hauptserver')).toBeInTheDocument();
    expect(screen.getByText('Senden ist aus: Auf diesem Server aus – Versand und Abholen laufen auf dem Hauptserver.')).toBeInTheDocument();
  });
});

describe('Anfrage (Web): Bearbeiten', () => {
  it('Speichern erst nach einer Aenderung; schickt Status und Notiz', async () => {
    await oeffnen();
    const speichern = screen.getByRole('button', { name: 'Speichern' });
    expect(speichern).toBeDisabled();
    expect([...(screen.getByLabelText('Status') as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(['Neu', 'In Arbeit', 'Abgelehnt']);

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'in_arbeit' } });
    fireEvent.change(screen.getByLabelText('Notiz (nur für den Support)'), { target: { value: 'Rückruf am Montag' } });
    h.apiPatch.mockResolvedValue({ data: { ...ANFRAGE, status: 'in_arbeit', notiz: 'Rückruf am Montag' } });
    await act(async () => { fireEvent.click(speichern); });

    expect(h.apiPatch).toHaveBeenCalledWith('/support/anfragen/4', { status: 'in_arbeit', notiz: 'Rückruf am Montag' });
    expect(h.setSuccess).toHaveBeenCalledWith('Anfrage gespeichert');
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled();
    // Der Status steht auch als Marke am Kopf der Karte.
    expect(within(kopie('Bearbeiten').closest('section')!).getByText('In Arbeit', { selector: '.web-pill' })).toBeInTheDocument();
  });

  it('nur die Notiz: ohne Status im Koerper', async () => {
    await oeffnen();
    fireEvent.change(screen.getByLabelText('Notiz (nur für den Support)'), { target: { value: 'Mail geschickt' } });
    h.apiPatch.mockResolvedValue({ data: { ...ANFRAGE, notiz: 'Mail geschickt' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Speichern' })); });
    expect(h.apiPatch).toHaveBeenCalledWith('/support/anfragen/4', { notiz: 'Mail geschickt' });
  });

  it('ein Fehler beim Speichern: Meldung, die Eingabe bleibt', async () => {
    await oeffnen();
    fireEvent.change(screen.getByLabelText('Notiz (nur für den Support)'), { target: { value: 'Neu' } });
    h.apiPatch.mockRejectedValue({ response: { status: 500, data: { error: 'Datenbankfehler' } } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Speichern' })); });
    expect(h.setError).toHaveBeenCalledWith('Datenbankfehler');
    expect((screen.getByLabelText('Notiz (nur für den Support)') as HTMLTextAreaElement).value).toBe('Neu');
  });
});

describe('Anfrage (Web): Gemeinde anlegen', () => {
  it('belegt das Formular aus der Anfrage vor -- Kirchenkreis aus der Struktur, Benutzername als Vorschlag', async () => {
    await oeffnen();
    expect(feld('Name der Gemeinde').value).toBe('Kirchengemeinde Heide');
    expect((screen.getByLabelText('Kirchenkreis') as HTMLSelectElement).value).toBe('11');
    expect(screen.getByLabelText('Kirchenkreis')).toHaveAccessibleDescription('Landeskirche: Nordkirche');
    expect(feld('Ansprechperson').value).toBe('Anna Beispiel');
    expect(feld('E-Mail der Gemeinde').value).toBe('anna@example.org');
    expect(feld('Telefon').value).toBe('0170 1234567');
    expect(tarif().value).toBe('5');
    expect((screen.getByRole('switch', { name: 'Testphase (30 Tage)' }) as HTMLInputElement).checked).toBe(true);
    expect(feld('Benutzername').value).toBe('anna.beispiel');
    expect(feld('Anzeigename').value).toBe('Anna Beispiel');
    expect(feld('E-Mail der Gemeindeleitung').value).toBe('anna@example.org');
    expect(feld('Passwort').value).toBe('');
  });

  it('der Tarif ist eine Auswahl mit Preis; Unbegrenzt und "Eigenes Limit…" sind dabei', async () => {
    await oeffnen();
    expect([...tarif().options].map((o) => o.textContent)).toEqual([
      'Testphase — bis 5 Konfis · kostenlos, 30 Tage',
      'Klein — bis 15 Konfis · 49 € pro Jahr',
      'Standard — bis 50 Konfis · 99 € pro Jahr',
      'Plus — bis 75 Konfis · 139 € pro Jahr',
      'Groß — bis 100 Konfis · 179 € pro Jahr',
      'Unbegrenzt — ohne Konfi-Grenze',
      'Eigenes Limit…',
    ]);
  });

  it('Wunschlizenz: Testphase aus stellt das Limit auf ihre Konfi-Zahl, wieder an auf 5', async () => {
    antworten['/support/anfragen'] = [{ ...ANFRAGE, wunsch_lizenz: 'standard' }];
    await oeffnen();
    expect(tarif()).toHaveAccessibleDescription('In der Testphase 5, danach 50 (Wunschlizenz Standard).');
    fireEvent.click(screen.getByRole('switch', { name: 'Testphase (30 Tage)' }));
    expect(tarif().value).toBe('50');
    expect(screen.getByRole('switch', { name: 'Testphase (30 Tage)' })).toHaveAccessibleDescription('Ohne Ablaufdatum. Laufzeit und Lizenz lassen sich später unter Gemeinden setzen.');
    fireEvent.click(screen.getByRole('switch', { name: 'Testphase (30 Tage)' }));
    expect(tarif().value).toBe('5');
  });

  it('ohne Wunschlizenz stellt Testphase aus das Limit auf unbegrenzt; Verbund hat keine feste Zahl', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('switch', { name: 'Testphase (30 Tage)' }));
    expect(tarif().value).toBe('');
  });

  it('Eigenes Limit: ein Zahlenfeld, die Zahl geht an den Server', async () => {
    await oeffnen();
    expect(screen.queryByLabelText('Eigenes Limit')).toBeNull();
    fireEvent.change(tarif(), { target: { value: '__eigen__' } });
    fireEvent.change(feld('Eigenes Limit'), { target: { value: '30' } });
    fireEvent.change(feld('Passwort'), { target: { value: 'Heide-2026!' } });
    fireEvent.click(anlegenKnopf());
    h.apiPost.mockResolvedValue({ data: { organization_id: 77, admin_id: 301 } });
    await bestaetigen('Anlegen');
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0][1]).toMatchObject({ max_konfis: 30 });
  });

  it('ohne Passwort: Meldung, keine Rueckfrage, kein Aufruf; ohne Sonderzeichen keine Anlage', async () => {
    await oeffnen();
    fireEvent.click(anlegenKnopf());
    expect(h.setError).toHaveBeenCalledWith('Alle Felder der Gemeindeleitung sind erforderlich');
    expect(h.alert).toBeNull();
    fireEvent.change(feld('Passwort'), { target: { value: 'Heide2026' } });
    fireEvent.click(anlegenKnopf());
    expect(h.setError).toHaveBeenCalledWith('Das Passwort muss ein Sonderzeichen enthalten');
    expect(posts()).toHaveLength(0);
  });

  it('fragt nach, legt an und zeigt den Weg zur neuen Gemeinde', async () => {
    await oeffnen();
    fireEvent.change(feld('Passwort'), { target: { value: 'Heide-2026!' } });
    fireEvent.change(screen.getByLabelText('Kirchenkreis'), { target: { value: '12' } });
    fireEvent.click(anlegenKnopf());

    expect(h.alert?.header).toBe('Gemeinde anlegen');
    expect(h.alert?.message).toBe('„Kirchengemeinde Heide“ mit der Gemeindeleitung „Anna Beispiel“ (anna.beispiel) anlegen?');
    expect(posts()).toHaveLength(0);

    h.apiPost.mockResolvedValue({ data: { organization_id: 77, admin_id: 301 } });
    const vorher = Date.now();
    await bestaetigen('Anlegen');
    await waitFor(() => expect(posts()).toHaveLength(1));

    const [pfad, koerper] = posts()[0];
    expect(pfad).toBe('/support/anfragen/4/anlegen');
    const { trial_ends_at: ende, ...rest } = koerper;
    expect(rest).toEqual({
      name: 'kirchengemeinde-heide',
      display_name: 'Kirchengemeinde Heide',
      kirchenkreis_id: 12,
      contact_name: 'Anna Beispiel',
      contact_email: 'anna@example.org',
      contact_phone: '0170 1234567',
      max_konfis: 5,
      is_trial: true,
      admin_username: 'anna.beispiel',
      admin_display_name: 'Anna Beispiel',
      admin_email: 'anna@example.org',
      admin_password: 'Heide-2026!',
    });
    expect(Math.round((new Date(ende).getTime() - vorher) / (24 * 60 * 60 * 1000))).toBe(30);

    expect(await screen.findByText('Die Gemeinde ist angelegt.')).toBeInTheDocument();
    expect(screen.getByText('anna.beispiel', { selector: 'strong' })).toBeInTheDocument();
    expect(h.setSuccess).toHaveBeenCalledWith('Gemeinde angelegt');
    expect(screen.queryByRole('button', { name: 'Gemeinde anlegen' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 2, name: 'Gemeinde anlegen' })).toBeNull();
    const oeffnenLink = screen.getByRole('link', { name: 'Gemeinde öffnen' });
    expect(oeffnenLink).toHaveAttribute('href', '/admin/organizations?gemeinde=77');
    fireEvent.click(oeffnenLink);
    expect(h.push).toHaveBeenCalledWith('/admin/organizations?gemeinde=77', 'none', 'push');
  });

  it('Benutzername vergeben (409): die Meldung des Servers, das Formular bleibt', async () => {
    await oeffnen();
    fireEvent.change(feld('Passwort'), { target: { value: 'Heide-2026!' } });
    fireEvent.click(anlegenKnopf());
    h.apiPost.mockRejectedValue({ response: { status: 409, data: { error: 'Benutzername existiert bereits (muss systemweit eindeutig sein)' } } });
    await bestaetigen('Anlegen');
    await waitFor(() => expect(h.setError).toHaveBeenCalledWith('Benutzername existiert bereits (muss systemweit eindeutig sein)'));
    expect(anlegenKnopf()).toBeInTheDocument();
    expect(screen.queryByText('Die Gemeinde ist angelegt.')).toBeNull();
  });

  it('Kirchenkreis noch nicht in der Struktur: ein Schritt legt ihn an und waehlt ihn', async () => {
    antworten['/support/anfragen'] = [{ ...ANFRAGE, kirchenkreis: 'Steinburg' }];
    await oeffnen();
    expect((screen.getByLabelText('Kirchenkreis') as HTMLSelectElement).value).toBe('ohne');
    expect(screen.getByText('„Steinburg“ steht noch nicht in der Struktur.', { exact: false })).toBeInTheDocument();

    h.apiPost.mockResolvedValue({ data: { id: 13 } });
    antworten['/support/kirchenkreise'] = [...KREISE, { id: 13, name: 'Steinburg', landeskirche_id: 1, landeskirche: 'Nordkirche' }];
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Als Kirchenkreis anlegen' })); });

    expect(h.apiPost).toHaveBeenCalledWith('/support/kirchenkreise', { name: 'Steinburg', landeskirche_id: 1 });
    await waitFor(() => expect((screen.getByLabelText('Kirchenkreis') as HTMLSelectElement).value).toBe('13'));
    expect(screen.queryByText(/steht noch nicht in der Struktur/)).toBeNull();
  });

  it('Passwort zeigen und ein sicheres vorschlagen', async () => {
    await oeffnen();
    expect(feld('Passwort')).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Passwort zeigen' }));
    expect(feld('Passwort')).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: 'Sicheres Passwort vorschlagen' }));
    expect(feld('Passwort').value.length).toBeGreaterThanOrEqual(8);
    expect(screen.getByRole('button', { name: 'Passwort verbergen' })).toBeInTheDocument();
  });

  it('eine schon angelegte Anfrage zeigt den Weg zur Gemeinde statt des Formulars -- ohne Auswahl fuer den Status', async () => {
    antworten['/support/anfragen'] = [{ ...ANFRAGE, status: 'angelegt', organization_id: 55 }];
    await oeffnen();
    expect(screen.getByText('Die Gemeinde ist angelegt.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gemeinde anlegen' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 2, name: 'Gemeinde anlegen' })).toBeNull();
    expect(screen.queryByLabelText('Status')).toBeNull();
    expect(screen.getByRole('link', { name: 'Gemeinde öffnen' })).toHaveAttribute('href', '/admin/organizations?gemeinde=55');
  });
});

describe('Anfrage (Web): Laden, Fehler, nicht gefunden', () => {
  it('nicht gefunden: eigener Hinweis, der Weg zurueck bleibt', async () => {
    antworten['/support/anfragen'] = [];
    render(<SupportAnfrageDetailPage anfrageId={4} />);
    expect(await screen.findByText('Anfrage nicht gefunden')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alle Anfragen' })).toBeInTheDocument();
  });

  it('Fehler beim Laden: Hinweis mit erneutem Versuch, der wirklich neu laedt', async () => {
    h.apiGet.mockImplementationOnce(() => Promise.reject(new Error('Netz weg')));
    render(<SupportAnfrageDetailPage anfrageId={4} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Anfrage konnte nicht geladen werden.');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' })); });
    expect(await screen.findByRole('heading', { level: 1, name: 'Kirchengemeinde Heide' })).toBeInTheDocument();
  });

  it('beim Laden steht ein Platzhalter, der sich als "wird geladen" meldet', () => {
    h.apiGet.mockImplementation(() => new Promise(() => {}));
    render(<SupportAnfrageDetailPage anfrageId={4} />);
    expect(screen.getByRole('status')).toHaveTextContent('Die Anfrage wird geladen.');
  });
});

describe('Anfrage: zwei Gesichter, eine Seite', () => {
  it('im schmalen Fenster bleibt die App-Darstellung -- mit derselben Logik', async () => {
    h.breit = false;
    render(<SupportAnfrageDetailPage anfrageId={4} />);
    await screen.findByText('Wir starten im November.');
    expect(document.querySelector('.web-seite')).toBeNull();
    expect(screen.getByLabelText('Notiz')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gemeinde anlegen' })).toBeInTheDocument();
  });

  it('ohne Super-Admin-Recht: Hinweis, kein Abruf', () => {
    h.user = { id: 5, role_name: 'org_admin', is_super_admin: false };
    render(<SupportAnfrageDetailPage anfrageId={4} />);
    expect(screen.getByText('Nur für den Support')).toBeInTheDocument();
    expect(h.apiGet).not.toHaveBeenCalled();
  });
});
