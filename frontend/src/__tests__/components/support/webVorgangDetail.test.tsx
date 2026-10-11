// Ein Vorgang in der Web-Fassung, gerendert (docs/planung/support-vorgaenge.md,
// Entscheidung 7): wie in einem Mailprogramm (11.10.2026) steht er im
// Lesebereich rechts neben der Liste. Kopf mit Betreff, Nummer, Status,
// Dringlichkeit und Gemeinde; Antworten, Einordnen (Dialog mit „Speichern“),
// Archivieren, Wiederherstellen und Loeschen mit Rueckfrage. Darunter die
// Angaben in einer Zeile, der Verlauf als Gespraeche (MailGespraeche), das
// Antwortformular erst auf „Antworten“, eingeklappt Gemeinde, Anfrage und
// Notiz, dazu „Gemeinde anlegen“ einer Anfrage. Die Logik ist die der App
// (useVorgangDetail, useGemeindeAnlegen, useAntwortEditor).
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import type { AlertOptionen } from './ionicAttrappe';
import { ANFRAGE_41, LEITUNG, mail, vorgang, vorgaengeServer } from './vorgaengeServer';

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
  standort: { pathname: '/admin/support/vorgaenge/1', search: '', state: null } as { pathname: string; search: string; state: null },
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

import SupportVorgangDetailPage from '../../../components/support/SupportVorgangDetailPage';
import { supportMailZaehlerZuruecksetzen } from '../../../navigation/supportMailZaehler';

// Erfundener Wert fuer das Passwortfeld. Zusammengesetzt statt als
// Zeichenkette, damit Geheimnis-Scanner (GitGuardian, PR #220) einen
// Testwert nicht als Passwort im oeffentlichen Repo melden.
const BEISPIELWERT = ['Beispiel', '2026', 'Wert!'].join('-');

let vorherTZ: string | undefined;
beforeAll(() => { vorherTZ = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherTZ === undefined) delete process.env.TZ; else process.env.TZ = vorherTZ; });

let server: ReturnType<typeof vorgaengeServer>;

beforeEach(() => {
  vi.clearAllMocks();
  h.alert = null;
  h.breit = true;
  h.online = true;
  h.user = { id: 9, role_name: 'super_admin', is_super_admin: true };
  supportMailZaehlerZuruecksetzen();
  window.history.replaceState(null, '', '/admin/support/vorgaenge/1');
  server = vorgaengeServer({
    vorgaenge: [
      // 1: Formular einer bekannten Gemeinde, dringend, mit drei Mails (zwei ungelesen)
      vorgang(1, { art: 'fehler', bereich: 'chat', dringlichkeit: 'dringend', status: 'neu', betreff: 'Chat zeigt nichts Neues', organization_id: 7,
        beschreibung: 'Seit gestern erscheint im Chat nichts Neues.', kontakt_name: 'Pastorin Lena Probe', kontakt_email: 'lena.probe@example.org', kontakt_funktion: 'Gemeindeleitung',
        gemeinde_angabe: 'Kirchengemeinde Musterdorf' }),
      // 2: Formular, Gemeinde noch unbekannt, Bereich fehlt
      vorgang(2, { art: 'frage', bereich: null, status: 'neu', betreff: 'Wie lege ich einen Jahrgang an?', organization_id: null,
        beschreibung: 'Wir sind neu dabei.', kontakt_name: 'Anna Beispiel', kontakt_email: 'anna@example.org', gemeinde_angabe: 'Kirchengemeinde Heide' }),
      // 3: Anfrage von der Homepage
      vorgang(3, { art: 'neue_gemeinde', bereich: null, status: 'neu', betreff: 'Anfrage Kirchengemeinde Lindenau', quelle: 'anfrage', anfrage_id: 41, anfrage: { ...ANFRAGE_41 } }),
      // 4: erledigt, im Archiv
      vorgang(4, { art: 'zugang', bereich: null, status: 'erledigt', betreff: 'Konto entsperrt', organization_id: 7, archiviert_am: '2026-10-02T12:00:00Z' }),
      // 5: niemand, dem sich antworten liesse
      vorgang(5, { art: 'sonstiges', bereich: null, status: 'in_arbeit', betreff: 'Intern notiert', quelle: 'support' }),
      // 6: manuell archiviert, Status wartet
      vorgang(6, { art: 'lizenz', bereich: null, status: 'wartet', betreff: 'Rechnung', organization_id: 8, archiviert_am: '2026-10-01T12:00:00Z' }),
    ],
    mails: [
      mail(11, 1, { betreff: 'Chat zeigt nichts Neues', text: 'Seit gestern erscheint im Chat nichts Neues.', gesendet_am: '2026-10-03T07:00:00Z' }),
      mail(12, 1, { richtung: 'aus', von_adresse: 'support@konfi-quest.example', von_name: 'Support', an_adressen: ['lena.probe@example.org'], betreff: 'Re: Chat zeigt nichts Neues [Vorgang 1]', text: 'Wir schauen nach.\n\n> Seit gestern\n> erscheint nichts', gesendet_am: '2026-10-03T07:30:00Z', gelesen_am: '2026-10-03T07:30:00Z' }),
      mail(13, 1, { betreff: 'Re: Chat zeigt nichts Neues [Vorgang 1]', text: 'Danke, es klappt wieder.', gesendet_am: '2026-10-03T08:00:00Z', anhaenge: [{ name: 'bildschirmfoto.png' }] }),
      mail(31, 3, { postfach: 'moin', von_adresse: 'anna@example.org', von_name: 'Anna Beispiel', an_adressen: ['moin@konfi-quest.example'], betreff: 'Eure Anfrage bei Konfi Quest [Anfrage 41]', text: 'Wann geht es los?', gelesen_am: '2026-10-03T07:00:00Z' }),
    ],
  });
  server.installieren({ get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete });
});

const oeffnen = async (id = 1, titel?: RegExp) => {
  const ergebnis = render(<SupportVorgangDetailPage vorgangId={id} />);
  await waitFor(() => {
    const t = document.querySelector('.web-lesen__titel');
    expect(t).not.toBeNull();
    if (titel) expect(t!.textContent).toMatch(titel);
    expect(screen.queryByRole('button', { name: 'Löschen' })).not.toBeNull();
  });
  return ergebnis;
};
/** Der Lesebereich rechts neben der Liste. */
const lesen = () => document.querySelector('.web-lesen') as HTMLElement;
const angaben = () => document.querySelector('.web-lesen__angaben') as HTMLElement;
const steckbrief = () => screen.getByLabelText('Angaben zum Vorgang');
const steckbriefWert = (label: string) => [...steckbrief().querySelectorAll('div')].find((z) => z.querySelector('dt')!.textContent === label)!.querySelector('dd')!;
const mails = () => [...document.querySelectorAll('li.mail-zeile')] as HTMLElement[];
const mailKopf = (m: HTMLElement) => m.querySelector('button.mail-zeile__kopf') as HTMLButtonElement;
const absender = () => mails().map((m) => m.querySelector('.mail-zeile__absender')!.textContent);
const dialog = () => screen.getByRole('dialog', { name: 'Einordnen' });
const einordnen = () => { fireEvent.click(screen.getByRole('button', { name: 'Einordnen' })); return dialog(); };
const auswahl = (name: string) => within(dialog()).getByRole('combobox', { name }) as HTMLSelectElement;
const speichern = async () => { await act(async () => { fireEvent.click(within(dialog()).getByRole('button', { name: 'Speichern' })); }); };
const optionen = (el: HTMLSelectElement) => [...el.options].map((o) => o.textContent);
const patches = () => server.aufrufe('patch');
const bestaetigen = async (knopf: string) => { await act(async () => { h.alert?.buttons?.find((b) => b.text === knopf)?.handler?.(); }); };
const text = () => screen.getByLabelText('Text der Antwort') as HTMLTextAreaElement;
const feld = (name: string) => screen.getByLabelText(name) as HTMLInputElement;
const antworten = () => fireEvent.click(screen.getByRole('button', { name: 'Antworten' }));
const mehr = () => screen.getByRole('button', { name: /^Gemeinde, Anfrage und Notiz/ });
const mehrAufklappen = () => { if (mehr().getAttribute('aria-expanded') === 'false') fireEvent.click(mehr()); };

describe('Vorgang (Web): Aufbau', () => {
  it('Kopf: Betreff als Überschrift, Nummer, Status, Dringlichkeit und Gemeinde', async () => {
    await oeffnen();
    expect(within(lesen()).getByRole('heading', { level: 2, name: 'Chat zeigt nichts Neues' })).toBeInTheDocument();
    expect(angaben()).toHaveTextContent('Vorgang 1');
    expect(within(angaben()).getByText('Neu')).toBeInTheDocument();
    expect(within(angaben()).getByText('Dringend')).toBeInTheDocument();
    expect(angaben()).toHaveTextContent('Kirchengemeinde Musterdorf');
  });

  it('der Vorgang steht neben der Liste: seine Zeile ist gewählt, die Seite heißt „Vorgänge“', async () => {
    await oeffnen();
    expect(screen.getByRole('heading', { level: 1, name: 'Vorgänge' })).toBeInTheDocument();
    const liste = screen.getByRole('navigation', { name: 'Vorgänge' });
    expect(within(liste).getByRole('button', { name: /^Vorgang 1: Chat zeigt nichts Neues/ })).toHaveAttribute('aria-current', 'true');
    expect(within(liste).getByRole('button', { name: /^Vorgang 2:/ })).not.toHaveAttribute('aria-current');
  });

  it('ein anderer Vorgang in der Liste ersetzt den Lesebereich, die Adresse folgt', async () => {
    await oeffnen();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Vorgänge' })).getByRole('button', { name: /^Vorgang 2:/ }));
    // Der Lesebereich baut sich fuer den neuen Vorgang neu auf (laden, dann zeigen).
    expect(await screen.findByRole('heading', { level: 2, name: 'Wie lege ich einen Jahrgang an?' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Chat zeigt nichts Neues' })).toBeNull();
    expect(window.location.pathname).toBe('/admin/support/vorgaenge/2');
    expect(h.push).not.toHaveBeenCalled();
  });

  it('Reihenfolge: Angaben, Verlauf, eingeklappt Gemeinde, Anfrage und Notiz -- das Antwortformular erst auf „Antworten“', async () => {
    await oeffnen();
    const steck = steckbrief();
    const verlauf = screen.getByRole('region', { name: 'Verlauf' });
    expect(steck.compareDocumentPosition(verlauf) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(verlauf.compareDocumentPosition(mehr()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(mehr()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('Text der Antwort')).toBeNull();
    expect(screen.queryByLabelText(/Interne Notiz/)).toBeNull();
  });

  it('das Anliegen steht vorn im Verlauf, mit Absender und Zeit', async () => {
    await oeffnen();
    const anliegen = screen.getByRole('region', { name: 'Anliegen aus dem Formular' });
    expect(within(anliegen).getByText('Seit gestern erscheint im Chat nichts Neues.')).toBeInTheDocument();
    expect(within(anliegen).getByText('Pastorin Lena Probe')).toBeInTheDocument();
    expect(anliegen.querySelector('time')).toHaveAttribute('title', '03.10.2026, 09:00');
  });

  it('ohne Text aus dem Formular kein Anliegen', async () => {
    await oeffnen(5, /Intern notiert/);
    expect(screen.queryByRole('region', { name: 'Anliegen aus dem Formular' })).toBeNull();
  });

  it('die Anfrage-Nachricht heißt „Nachricht aus der Anfrage“', async () => {
    await oeffnen(3, /Lindenau/);
    const nachricht = screen.getByRole('region', { name: 'Nachricht aus der Anfrage' });
    expect(within(nachricht).getByText('Wir starten im November.')).toBeInTheDocument();
  });
});

describe('Vorgang (Web): Verlauf', () => {
  it('älteste zuerst, Gesendetes trägt „Gesendet“; aufgeklappt sind die jüngste und die ungelesenen, die als gelesen gemeldet werden und „Neu“ tragen', async () => {
    await oeffnen();
    expect(absender()).toEqual(['Pastorin Lena Probe', 'Support', 'Pastorin Lena Probe']);
    expect(mails().map((m) => within(m).queryByText('Gesendet') !== null)).toEqual([false, true, false]);
    expect(mails().map((m) => mailKopf(m).getAttribute('aria-expanded'))).toEqual(['true', 'false', 'true']);
    expect(mails().map((m) => within(m).queryByText('Neu') !== null)).toEqual([true, false, true]);
    expect(within(mails()[2]).getByRole('list', { name: 'Anhänge' })).toHaveTextContent('bildschirmfoto.png');
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledWith('/support/mail/gelesen', { ids: [11, 13] }));
    // Nach dem Melden tragen sie die Marke weiter -- für diesen Besuch.
    expect(within(mails()[0]).getByText('Neu')).toBeInTheDocument();
    expect(screen.getByText('3 Mails in 3 Gesprächen')).toBeInTheDocument();
  });

  it('eine eingeklappte Mail zeigt eine Zeile Vorschau ohne Zitat; aufgeklappt ist das Zitat eingeklappt und lässt sich aufklappen', async () => {
    await oeffnen();
    const antwort = mails()[1];
    expect(antwort.querySelector('.mail-zeile__vorschau')).toHaveTextContent('Wir schauen nach.');
    expect(antwort.querySelector('.mail-zeile__vorschau')!.textContent).not.toContain('erscheint nichts');
    fireEvent.click(mailKopf(antwort));
    expect(mailKopf(mails()[1])).toHaveAttribute('aria-expanded', 'true');
    expect(within(mails()[1]).getByText('Wir schauen nach.', { selector: 'p' })).toBeInTheDocument();
    expect(within(mails()[1]).queryByText(/> erscheint nichts/)).toBeNull();
    fireEvent.click(within(mails()[1]).getByRole('button', { name: 'Zitat einblenden' }));
    expect(within(mails()[1]).getByText(/> erscheint nichts/)).toBeInTheDocument();
    // Ausgehend: an wen und von welchem Postfach.
    expect(mails()[1].querySelector('.mail-zeile__unten')).toHaveTextContent('An lena.probe@example.org · von support@');
  });

  it('„Alle aufklappen“ klappt jede Mail auf, „Alle einklappen“ wieder zu', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Alle aufklappen' }));
    expect(mails().map((m) => mailKopf(m).getAttribute('aria-expanded'))).toEqual(['true', 'true', 'true']);
    fireEvent.click(screen.getByRole('button', { name: 'Alle einklappen' }));
    expect(mails().map((m) => mailKopf(m).getAttribute('aria-expanded'))).toEqual(['false', 'false', 'false']);
  });

  it('ein Vorgang ohne Mails und ohne Anliegen sagt das', async () => {
    await oeffnen(5, /Intern notiert/);
    expect(screen.getByText('Noch keine Mails in diesem Vorgang.')).toBeInTheDocument();
  });

  it('nur ein Anliegen, keine Mails: das Anliegen steht da, keine Mailzeile', async () => {
    await oeffnen(2, /Jahrgang/);
    expect(screen.getByRole('region', { name: 'Anliegen aus dem Formular' })).toHaveTextContent('Wir sind neu dabei.');
    expect(mails()).toHaveLength(0);
  });
});

describe('Vorgang (Web): Einordnen im Dialog', () => {
  it('der Dialog zeigt den Stand; Art und Status nennen alle Werte', async () => {
    await oeffnen();
    einordnen();
    expect(auswahl('Art').value).toBe('fehler');
    expect(optionen(auswahl('Art'))).toEqual(['Neue Gemeinde', 'Frage zur Bedienung', 'Fehler melden', 'Wunsch oder Idee', 'Zugang und Konten', 'Lizenz und Abrechnung', 'Datenschutz', 'Sonstiges']);
    expect(auswahl('Bereich').value).toBe('chat');
    expect(optionen(auswahl('Bereich'))).toEqual(['Bitte wählen', 'Konfis', 'Events', 'Punkte und Anträge', 'Challenges', 'Chat', 'Badges', 'Material', 'Konten und Einladungen', 'Einstellungen', 'Sonstiges']);
    expect(auswahl('Dringlichkeit').value).toBe('dringend');
    expect(optionen(auswahl('Dringlichkeit'))).toEqual(['Normal', 'Dringend – wir können gerade nicht weiterarbeiten']);
    expect(auswahl('Status').value).toBe('neu');
    expect(optionen(auswahl('Status'))).toEqual(['Neu', 'In Arbeit', 'Wartet auf Rückmeldung', 'Erledigt']);
    await waitFor(() => expect(auswahl('Gemeinde').value).toBe('7'));
    expect(dialog()).toHaveAccessibleDescription('Vorgang 1: Chat zeigt nichts Neues');
  });

  it('Ändern speichert noch nichts; „Speichern“ schickt einen Aufruf mit genau den geänderten Feldern und schließt', async () => {
    await oeffnen();
    einordnen();
    fireEvent.change(auswahl('Art'), { target: { value: 'wunsch' } });
    fireEvent.change(auswahl('Bereich'), { target: { value: 'termine' } });
    fireEvent.change(auswahl('Dringlichkeit'), { target: { value: 'normal' } });
    fireEvent.change(auswahl('Status'), { target: { value: 'wartet' } });
    fireEvent.change(auswahl('Gemeinde'), { target: { value: '8' } });
    expect(patches()).toHaveLength(0);
    await speichern();
    expect(patches().map((p) => [p.pfad, p.koerper])).toEqual([
      ['/support/vorgaenge/1', { status: 'wartet', art: 'wunsch', bereich: 'termine', dringlichkeit: 'normal', organization_id: 8 }],
    ]);
    expect(h.setSuccess).toHaveBeenCalledWith('Gespeichert');
    expect(screen.queryByRole('dialog')).toBeNull();
    // Der Server hat es: nach dem Neuladen steht es im Kopf.
    await waitFor(() => expect(angaben()).toHaveTextContent('Kirchengemeinde Wiesengrund'));
    expect(within(angaben()).getByText('Wartet')).toBeInTheDocument();
    expect(steckbriefWert('Art')).toHaveTextContent('Wunsch · Events');
  });

  it('nur eine Änderung: nur dieses Feld geht an den Server', async () => {
    await oeffnen();
    einordnen();
    fireEvent.change(auswahl('Dringlichkeit'), { target: { value: 'normal' } });
    await speichern();
    expect(patches().map((p) => p.koerper)).toEqual([{ dringlichkeit: 'normal' }]);
  });

  it('ohne Änderung schließt „Speichern“ ohne Aufruf; „Abbrechen“ verwirft', async () => {
    await oeffnen();
    einordnen();
    await speichern();
    expect(screen.queryByRole('dialog')).toBeNull();
    einordnen();
    fireEvent.change(auswahl('Status'), { target: { value: 'wartet' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(patches()).toHaveLength(0);
  });

  it('„Kein Bereich“ und „Keine Gemeinde“ gehen als null an den Server', async () => {
    await oeffnen();
    einordnen();
    fireEvent.change(auswahl('Art'), { target: { value: 'sonstiges' } });
    fireEvent.change(auswahl('Bereich'), { target: { value: '' } });
    await waitFor(() => expect(auswahl('Gemeinde').value).toBe('7'));
    fireEvent.change(auswahl('Gemeinde'), { target: { value: '' } });
    await speichern();
    expect(patches().map((p) => p.koerper)).toEqual([{ art: 'sonstiges', bereich: null, organization_id: null }]);
    expect(await screen.findByText('Noch keiner Gemeinde zugeordnet')).toBeInTheDocument();
  });

  it('Frage, Fehler und Wunsch ohne Bereich: Meldung im Dialog, nichts geht raus', async () => {
    await oeffnen();
    einordnen();
    fireEvent.change(auswahl('Bereich'), { target: { value: '' } });
    await speichern();
    expect(within(dialog()).getByRole('alert')).toHaveTextContent('Bei Frage, Fehler und Wunsch gehört ein Bereich dazu.');
    expect(patches()).toHaveLength(0);
  });

  it('Status „Erledigt“: der Hinweis steht beim Auswählen da; danach liegt der Vorgang im Archiv', async () => {
    await oeffnen();
    einordnen();
    expect(auswahl('Status')).not.toHaveAccessibleDescription();
    fireEvent.change(auswahl('Status'), { target: { value: 'erledigt' } });
    expect(auswahl('Status')).toHaveAccessibleDescription('Erledigte Vorgänge liegen im Archiv. Eine neue Mail holt den Vorgang zurück.');
    await speichern();
    expect(patches()[0].koerper).toEqual({ status: 'erledigt' });
    expect(h.setSuccess).toHaveBeenCalledWith('Vorgang erledigt und ins Archiv gelegt');
    expect(await screen.findByText('Erledigt und im Archiv')).toBeInTheDocument();
    expect(within(lesen()).getByRole('button', { name: 'Wiederherstellen' })).toBeInTheDocument();
    expect(within(lesen()).queryByRole('button', { name: 'Archivieren' })).toBeNull();
  });

  it('Frage, Fehler und Wunsch ohne Bereich: der Bereich trägt den Stern und sagt, dass er dazugehört', async () => {
    await oeffnen(2, /Jahrgang/);
    einordnen();
    expect(auswahl('Bereich').value).toBe('');
    expect(optionen(auswahl('Bereich'))[0]).toBe('Bitte wählen');
    expect(auswahl('Bereich')).toHaveAccessibleDescription('Bei Frage, Fehler und Wunsch gehört ein Bereich dazu.');
    expect(within(dialog()).getByText('Bereich').className).toContain('web-feld__label--pflicht');
  });

  it('ein Fehler beim Speichern: Meldung, der Dialog bleibt, der Stand vom Server kommt zurück', async () => {
    await oeffnen();
    server.stand.fehler.set('PATCH /support/vorgaenge/1', Object.assign(new Error('x'), { response: { status: 500, data: { error: 'Datenbankfehler' } } }));
    einordnen();
    fireEvent.change(auswahl('Art'), { target: { value: 'wunsch' } });
    await speichern();
    await waitFor(() => expect(h.setError).toHaveBeenCalledWith('Datenbankfehler'));
    expect(dialog()).toBeInTheDocument();
    await waitFor(() => expect(steckbriefWert('Art')).toHaveTextContent('Fehler · Chat'));
  });

  it('ohne Netz lässt sich der Dialog nicht öffnen', async () => {
    h.online = false;
    await oeffnen();
    expect(screen.getByRole('button', { name: 'Einordnen' })).toBeDisabled();
  });
});

describe('Vorgang (Web): Kontakt und Gemeinde', () => {
  const angabe = (karte: HTMLElement, label: string) => [...karte.querySelectorAll('.web-angaben__zeile')].find((z) => z.querySelector('dt')!.textContent === label)!.querySelector('dd')!;

  it('die Angaben in einer Zeile: Kontakt mit Adresse als Verweis und Funktion, Art mit Bereich, woher und wann', async () => {
    await oeffnen();
    expect(steckbriefWert('Kontakt')).toHaveTextContent('Pastorin Lena Probe · lena.probe@example.org (Gemeindeleitung)');
    expect(within(steckbriefWert('Kontakt') as HTMLElement).getByRole('link', { name: 'lena.probe@example.org' })).toHaveAttribute('href', 'mailto:lena.probe@example.org');
    expect(steckbriefWert('Art')).toHaveTextContent('Fehler · Chat');
    expect(steckbriefWert('Eingegangen')).toHaveTextContent('Support-Formular auf der Homepage, 03.10.2026, 09:00');
  });

  it('bei einer Anfrage stehen Name und Adresse aus deren Angaben da', async () => {
    await oeffnen(3, /Lindenau/);
    expect(steckbriefWert('Kontakt')).toHaveTextContent('Anna Beispiel · anna@example.org (Pastorin)');
    expect(steckbriefWert('Eingegangen')).toHaveTextContent('Anfrage von der Homepage');
  });

  it('Gemeinde und Gemeindeleitung (aufgeklappt): Laufzeit, Konfis, Kirchenkreis, Leitung mit Adresse und letzter Anmeldung', async () => {
    await oeffnen();
    mehrAufklappen();
    const gemeinde = screen.getByRole('region', { name: 'Gemeinde des Vorgangs' });
    expect(within(angabe(gemeinde, 'Gemeinde') as HTMLElement).getByRole('link', { name: 'Kirchengemeinde Musterdorf' })).toHaveAttribute('href', '/admin/organizations?gemeinde=7');
    expect(angabe(gemeinde, 'Konfis')).toHaveTextContent('3 von 5');
    expect(angabe(gemeinde, 'Kirchenkreis')).toHaveTextContent('Dithmarschen');
    expect(angabe(gemeinde, 'Landeskirche')).toHaveTextContent('Nordkirche');
    expect(within(angabe(gemeinde, 'Vorgänge') as HTMLElement).getByRole('link', { name: 'Alle Vorgänge dieser Gemeinde' })).toHaveAttribute('href', '/admin/support/vorgaenge?gemeinde=7');
    const leitung = screen.getByRole('list', { name: 'Gemeindeleitung' });
    expect(within(leitung).getByText('Pastorin Lena Probe')).toBeInTheDocument();
    expect(within(leitung).getByRole('link', { name: 'lena.probe@example.org' })).toHaveAttribute('href', 'mailto:lena.probe@example.org');
    expect(leitung).toHaveTextContent('zuletzt angemeldet 02.10.2026');
  });

  it('eine Leitung ohne Adresse und ohne Anmeldung sagt das; eine gesperrte trägt eine Marke', async () => {
    LEITUNG[7] = [{ id: 22, display_name: 'Sam Muster', username: 'sam.muster', email: null, is_active: false, last_login_at: null }];
    await oeffnen();
    mehrAufklappen();
    const leitung = screen.getByRole('list', { name: 'Gemeindeleitung' });
    expect(leitung).toHaveTextContent('Keine E-Mail');
    expect(leitung).toHaveTextContent('noch nicht angemeldet');
    expect(within(leitung).getByText('Gesperrt')).toBeInTheDocument();
    LEITUNG[7] = [{ id: 21, display_name: 'Pastorin Lena Probe', username: 'lena.probe', email: 'lena.probe@example.org', is_active: true, last_login_at: '2026-10-02T08:00:00Z' }];
  });

  it('ohne Gemeinde: die Angabe aus dem Formular steht prominent da, „Gemeinde zuordnen“ öffnet den Dialog', async () => {
    await oeffnen(2, /Jahrgang/);
    const hinweis = screen.getByText('Noch keiner Gemeinde zugeordnet').closest('.web-hinweis') as HTMLElement;
    expect(hinweis.className).toContain('web-hinweis--warnung');
    expect(within(hinweis).getByText('Kirchengemeinde Heide').className).toContain('web-gemeindeangabe');
    fireEvent.click(within(hinweis).getByRole('button', { name: 'Gemeinde zuordnen' }));
    expect(auswahl('Gemeinde').value).toBe('');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Abbrechen' }));
    mehrAufklappen();
    expect(screen.queryByRole('region', { name: 'Gemeinde des Vorgangs' })).toBeNull();
  });

  it('die Gemeinde zuordnen: der Hinweis verschwindet, Gemeinde und Leitung stehen bereit', async () => {
    await oeffnen(2, /Jahrgang/);
    einordnen();
    fireEvent.change(auswahl('Bereich'), { target: { value: 'konfis' } });
    await waitFor(() => expect(auswahl('Gemeinde').options.length).toBe(3));
    fireEvent.change(auswahl('Gemeinde'), { target: { value: '7' } });
    await speichern();
    expect(patches()[0].koerper).toEqual({ bereich: 'konfis', organization_id: 7 });
    await waitFor(() => expect(screen.queryByText('Noch keiner Gemeinde zugeordnet')).toBeNull());
    mehrAufklappen();
    expect(await screen.findByRole('region', { name: 'Gemeinde des Vorgangs' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Gemeindeleitung' })).toHaveTextContent('Pastorin Lena Probe');
  });

  it('ohne Gemeinde und ohne Angabe im Formular sagt der Hinweis das', async () => {
    await oeffnen(5, /Intern notiert/);
    expect(screen.getByText('Im Formular wurde keine Gemeinde genannt.')).toBeInTheDocument();
  });
});

describe('Vorgang (Web): Antworten', () => {
  it('„Antworten“ öffnet das Formular unter dem Verlauf; „Verwerfen“ schließt es', async () => {
    await oeffnen();
    expect(screen.queryByRole('region', { name: 'Antwort schreiben' })).toBeNull();
    antworten();
    const bereich = screen.getByRole('region', { name: 'Antwort schreiben' });
    expect(screen.getByRole('region', { name: 'Verlauf' }).compareDocumentPosition(bereich) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(within(bereich).getByRole('button', { name: 'Verwerfen' }));
    expect(screen.queryByRole('region', { name: 'Antwort schreiben' })).toBeNull();
  });

  it('mit Gemeinde: von support@ an eine Adresse der Gemeinde -- die einzige Adresse ist vorgewählt, die Bausteine stehen bereit', async () => {
    await oeffnen();
    antworten();
    const empfaenger = await waitFor(() => {
      const el = screen.getByLabelText('Empfänger') as HTMLSelectElement;
      expect(el.options.length).toBeGreaterThan(1);
      return el;
    });
    // Die Gemeindeleitung ist zugleich der Kontakt: nur einmal -- als Gemeindeleitung.
    await waitFor(() => expect([...empfaenger.options].map((o) => o.textContent)).toEqual(['Bitte wählen', 'Pastorin Lena Probe <lena.probe@example.org> · Gemeindeleitung']));
    expect(empfaenger.value).toBe('lena.probe@example.org');
    await waitFor(() => expect((screen.getByLabelText('Textbaustein') as HTMLSelectElement).options.length).toBeGreaterThan(1));
  });

  it('mehrere Adressen: vorgewählt ist, wer zuletzt geschrieben hat; der Kontakt außerhalb der Leitung steht vorn in der Wahl', async () => {
    server.stand.vorgaenge[0].kontakt_email = 'sekretariat@example.org';
    server.stand.vorgaenge[0].kontakt_name = 'Das Sekretariat';
    await oeffnen();
    antworten();
    const empfaenger = await waitFor(() => {
      const el = screen.getByLabelText('Empfänger') as HTMLSelectElement;
      expect(el.options.length).toBe(3);
      return el;
    });
    expect([...empfaenger.options].map((o) => o.textContent)).toEqual([
      'Bitte wählen',
      'Das Sekretariat <sekretariat@example.org> · Kontakt aus dem Formular',
      'Pastorin Lena Probe <lena.probe@example.org> · Gemeindeleitung',
    ]);
    // Die letzte eingehende Mail kam von der Leitung.
    expect(empfaenger.value).toBe('lena.probe@example.org');
  });

  it('Senden mit Rückfrage an den Vorgang; Körper mit Betreff, Text und Adresse; danach schließt das Formular und die Mail steht im Verlauf', async () => {
    await oeffnen();
    antworten();
    await waitFor(() => expect((screen.getByLabelText('Empfänger') as HTMLSelectElement).options[1]?.textContent).toContain('Gemeindeleitung'));
    fireEvent.change(screen.getByLabelText('Empfänger'), { target: { value: 'lena.probe@example.org' } });
    // Die letzte Mail des Verlaufs trägt die Nummer schon im Betreff.
    expect((screen.getByLabelText('Betreff') as HTMLInputElement).value).toBe('Re: Chat zeigt nichts Neues [Vorgang 1]');
    fireEvent.change(text(), { target: { value: 'Danke für die Rückmeldung.\n\n' } });
    fireEvent.click(screen.getByRole('button', { name: 'Antwort senden' }));
    expect(h.alert?.header).toBe('Antwort senden');
    expect(server.aufrufe('post', /antworten$/)).toHaveLength(0);

    await bestaetigen('Senden');
    expect(server.aufrufe('post', '/support/vorgaenge/1/antworten')[0].koerper).toEqual({
      text: 'Danke für die Rückmeldung.', betreff: 'Re: Chat zeigt nichts Neues [Vorgang 1]', an: 'lena.probe@example.org',
    });
    expect(h.setSuccess).toHaveBeenCalledWith('Antwort gesendet');
    expect(screen.queryByRole('region', { name: 'Antwort schreiben' })).toBeNull();
    await waitFor(() => expect(mails()).toHaveLength(4));
    // Die neue Mail steht aufgeklappt da.
    expect(mailKopf(mails()[3])).toHaveAttribute('aria-expanded', 'true');
  });

  it('bei mehreren Adressen, von denen keine zuletzt geschrieben hat: Meldung, keine Rückfrage, kein Versand', async () => {
    server.stand.vorgaenge[0].kontakt_email = 'sekretariat@example.org';
    for (const m of server.stand.mails) if (m.richtung === 'ein') m.von_adresse = 'fremd@example.org';
    await oeffnen();
    antworten();
    await waitFor(() => expect((screen.getByLabelText('Empfänger') as HTMLSelectElement).options.length).toBe(3));
    expect((screen.getByLabelText('Empfänger') as HTMLSelectElement).value).toBe('');
    fireEvent.change(text(), { target: { value: 'Hallo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Antwort senden' }));
    expect(h.setError).toHaveBeenCalledWith('Bitte einen Empfänger wählen');
    expect(h.alert).toBeNull();
  });

  it('bei einer Anfrage: von moin@ an die Adresse der Anfrage, fest; die Platzhalter kommen von der Anfrage', async () => {
    await oeffnen(3, /Lindenau/);
    antworten();
    expect(screen.getByText(/^An:/, { selector: 'p.web-antwort__an' })).toHaveTextContent('An: anna@example.org · von moin@');
    expect(screen.queryByLabelText('Empfänger')).toBeNull();
    // Die Mail der Anfrage ist die letzte im Verlauf: „Re: …“ ihres Betreffs.
    expect((feld('Betreff')).value).toBe('Re: Eure Anfrage bei Konfi Quest [Anfrage 41]');
    await waitFor(() => expect((screen.getByLabelText('Textbaustein') as HTMLSelectElement).options.length).toBeGreaterThan(1));
    fireEvent.change(screen.getByLabelText('Textbaustein'), { target: { value: '1' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Baustein einfügen' })); });
    expect(h.apiGet).toHaveBeenCalledWith('/support/mail/platzhalter', { params: { anfrage_id: 41 } });
    expect(text().value).toBe('Danke, Anna Beispiel.');
    fireEvent.click(screen.getByRole('button', { name: 'Antwort senden' }));
    await bestaetigen('Senden');
    // Ohne Empfängerwahl: der Server nimmt die Adresse der Anfrage.
    expect(server.aufrufe('post', '/support/vorgaenge/3/antworten')[0].koerper).toEqual({ text: 'Danke, Anna Beispiel.', betreff: 'Re: Eure Anfrage bei Konfi Quest [Anfrage 41]' });
  });

  it('ohne Gemeinde, aber mit Kontakt des Formulars: von support@ an dessen Adresse', async () => {
    await oeffnen(2, /Jahrgang/);
    antworten();
    expect(screen.getByText(/^An:/, { selector: 'p.web-antwort__an' })).toHaveTextContent('An: anna@example.org · von support@');
    expect((feld('Betreff')).value).toBe('Re: Wie lege ich einen Jahrgang an?');
  });

  it('niemand zum Antworten: Hinweis, „Antworten“ ist gesperrt', async () => {
    await oeffnen(5, /Intern notiert/);
    expect(screen.getByText('Es gibt noch niemanden, dem sich antworten ließe')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Antworten' })).toBeDisabled();
    expect(screen.queryByLabelText('Text der Antwort')).toBeNull();
  });
});

describe('Vorgang (Web): Notiz', () => {
  const notizFeld = () => screen.getByLabelText('Interne Notiz (nur für den Support)') as HTMLTextAreaElement;

  it('Speichern erst nach einer Änderung; die Notiz geht getrimmt an den Server, leer als null', async () => {
    await oeffnen();
    mehrAufklappen();
    const speichernKnopf = screen.getByRole('button', { name: 'Notiz speichern' });
    expect(speichernKnopf).toBeDisabled();
    fireEvent.change(notizFeld(), { target: { value: '  Rückruf am Montag ' } });
    expect(speichernKnopf).toBeEnabled();
    await act(async () => { fireEvent.click(speichernKnopf); });
    expect(patches()[0]).toMatchObject({ pfad: '/support/vorgaenge/1', koerper: { notiz: 'Rückruf am Montag' } });
    expect(h.setSuccess).toHaveBeenCalledWith('Notiz gespeichert');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Notiz speichern' })).toBeDisabled());
    fireEvent.change(notizFeld(), { target: { value: '   ' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Notiz speichern' })); });
    expect(patches()[1].koerper).toEqual({ notiz: null });
  });

  it('eine vorhandene Notiz steht im Feld; der eingeklappte Bereich sagt, dass es eine gibt', async () => {
    server.stand.vorgaenge[0].notiz = 'Nachfragen';
    await oeffnen();
    expect(mehr()).toHaveTextContent('mit Notiz');
    mehrAufklappen();
    expect(notizFeld().value).toBe('Nachfragen');
  });

  it('ein Fehler beim Speichern: Meldung, die Eingabe bleibt', async () => {
    await oeffnen();
    mehrAufklappen();
    server.stand.fehler.set('PATCH /support/vorgaenge/1', Object.assign(new Error('x'), { response: { status: 500, data: { error: 'Datenbankfehler' } } }));
    fireEvent.change(notizFeld(), { target: { value: 'Neu' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Notiz speichern' })); });
    expect(h.setError).toHaveBeenCalledWith('Datenbankfehler');
    expect(notizFeld().value).toBe('Neu');
  });
});

describe('Vorgang (Web): Archivieren, Wiederherstellen, Löschen', () => {
  it('Archivieren: eine Anfrage an den Vorgang; er zeigt danach, dass er im Archiv liegt', async () => {
    await oeffnen();
    await act(async () => { fireEvent.click(within(lesen()).getByRole('button', { name: 'Archivieren' })); });
    expect(server.aufrufe('post', '/support/vorgaenge/1/archivieren')).toHaveLength(1);
    expect(h.setSuccess).toHaveBeenCalledWith('Vorgang archiviert');
    expect(await screen.findByText('Dieser Vorgang liegt im Archiv')).toBeInTheDocument();
    expect(within(angaben()).getByText('Archiv')).toBeInTheDocument();
  });

  it('ein erledigter Vorgang liegt im Archiv und lässt sich wiederherstellen: danach „In Arbeit“', async () => {
    await oeffnen(4, /Konto entsperrt/);
    expect(screen.getByText('Erledigt und im Archiv')).toBeInTheDocument();
    expect(screen.getByText(/Archiviert am 02\.10\.2026/)).toBeInTheDocument();
    await act(async () => { fireEvent.click(within(lesen()).getByRole('button', { name: 'Wiederherstellen' })); });
    expect(server.aufrufe('post', '/support/vorgaenge/4/wiederherstellen')).toHaveLength(1);
    expect(h.setSuccess).toHaveBeenCalledWith('Vorgang wiederhergestellt – Status „In Arbeit“');
    await waitFor(() => expect(screen.queryByText('Erledigt und im Archiv')).toBeNull());
    expect(within(angaben()).getByText('In Arbeit')).toBeInTheDocument();
    expect(within(lesen()).getByRole('button', { name: 'Archivieren' })).toBeInTheDocument();
  });

  it('ein manuell archivierter Vorgang trägt den Hinweis „liegt im Archiv“, nicht „erledigt“', async () => {
    await oeffnen(6, /Rechnung/);
    expect(screen.getByText('Dieser Vorgang liegt im Archiv')).toBeInTheDocument();
    expect(screen.queryByText('Erledigt und im Archiv')).toBeNull();
  });

  it('Löschen fragt zuerst und nennt, was gelöscht wird -- bei einer Anfrage auch sie; erst „Löschen“ löscht und leert den Lesebereich', async () => {
    await oeffnen(3, /Lindenau/);
    fireEvent.click(within(lesen()).getByRole('button', { name: 'Löschen' }));
    expect(h.alert?.header).toBe('Vorgang löschen');
    expect(h.alert?.message).toBe('„Anfrage Kirchengemeinde Lindenau“ wird mit seinen Mails in Konfi Quest und der Anfrage gelöscht. Im Postfach selbst bleibt alles stehen. Das lässt sich nicht rückgängig machen.');
    expect(server.aufrufe('delete')).toHaveLength(0);
    await bestaetigen('Löschen');
    expect(server.aufrufe('delete')[0].pfad).toBe('/support/vorgaenge/3');
    expect(h.setSuccess).toHaveBeenCalledWith('Vorgang gelöscht');
    // Die Liste steht schon da: kein Seitenwechsel, nur der Lesebereich wird leer.
    expect(h.push).not.toHaveBeenCalled();
    expect(await screen.findByText('Kein Vorgang gewählt')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/admin/support/vorgaenge');
    await waitFor(() => expect(within(screen.getByRole('navigation', { name: 'Vorgänge' })).queryByRole('button', { name: /^Vorgang 3:/ })).toBeNull());
  });

  it('Abbrechen löscht nichts; ein Fehler beim Löschen meldet ihn und der Vorgang bleibt offen', async () => {
    await oeffnen();
    fireEvent.click(within(lesen()).getByRole('button', { name: 'Löschen' }));
    expect(h.alert?.buttons?.find((b) => b.role === 'cancel')?.text).toBe('Abbrechen');
    expect(server.aufrufe('delete')).toHaveLength(0);
    server.stand.fehler.set('DELETE /support/vorgaenge/1', Object.assign(new Error('x'), { response: { status: 500, data: { error: 'Datenbankfehler' } } }));
    await bestaetigen('Löschen');
    expect(h.setError).toHaveBeenCalledWith('Datenbankfehler');
    expect(h.push).not.toHaveBeenCalled();
    expect(within(lesen()).getByRole('heading', { level: 2, name: 'Chat zeigt nichts Neues' })).toBeInTheDocument();
  });

  it('ohne Netz sind Antworten, Archivieren und Löschen gesperrt', async () => {
    h.online = false;
    await oeffnen();
    expect(within(lesen()).getByRole('button', { name: 'Antworten' })).toBeDisabled();
    expect(within(lesen()).getByRole('button', { name: 'Archivieren' })).toBeDisabled();
    expect(within(lesen()).getByRole('button', { name: 'Löschen' })).toBeDisabled();
  });
});

describe('Vorgang (Web): Angaben der Anfrage und Gemeinde anlegen', () => {
  const tarif = () => screen.getByLabelText('Tarif') as HTMLSelectElement;
  const anlegenKnopf = () => screen.getByRole('button', { name: 'Gemeinde anlegen' });
  const anfrageAngaben = () => screen.getByLabelText('Angaben aus dem Formular der Anfrage');
  const wert = (label: string) => [...anfrageAngaben().querySelectorAll('.web-angaben__zeile')].find((z) => z.querySelector('dt')!.textContent === label)!.querySelector('dd')!;

  it('die Angaben aus der Anfrage (aufgeklappt): Telefon ist ein Verweis, die Wunschlizenz steht mit Preis da', async () => {
    await oeffnen(3, /Lindenau/);
    mehrAufklappen();
    expect(wert('Gemeinde laut Anfrage')).toHaveTextContent('Kirchengemeinde Lindenau');
    expect(wert('Verantwortlich')).toHaveTextContent('Anna Beispiel (Pastorin)');
    expect(within(wert('Mobilnummer') as HTMLElement).getByRole('link', { name: '0170 1234567' })).toHaveAttribute('href', 'tel:01701234567');
    expect(wert('Ungefähre Zahl')).toHaveTextContent('25 Konfis · 6 Teamer:innen');
    expect(wert('Wunschlizenz')).toHaveTextContent('Standard — bis 50 Konfis, 99 € pro Jahr');
    // Die Adresse steht schon im Kontakt oben.
    expect(within(steckbriefWert('Kontakt') as HTMLElement).getByRole('link', { name: 'anna@example.org' })).toHaveAttribute('href', 'mailto:anna@example.org');
  });

  it('ein Vorgang ohne Anfrage hat weder ihre Angaben noch „Gemeinde anlegen“', async () => {
    await oeffnen();
    mehrAufklappen();
    expect(screen.queryByLabelText('Angaben aus dem Formular der Anfrage')).toBeNull();
    expect(screen.queryByRole('heading', { level: 2, name: 'Gemeinde anlegen' })).toBeNull();
  });

  it('belegt das Formular aus der Anfrage vor -- Kirchenkreis aus der Struktur, Benutzername als Vorschlag', async () => {
    await oeffnen(3, /Lindenau/);
    await waitFor(() => expect(feld('Name der Gemeinde').value).toBe('Kirchengemeinde Lindenau'));
    expect((screen.getByLabelText('Kirchenkreis') as HTMLSelectElement).value).toBe('11');
    expect(screen.getByLabelText('Kirchenkreis')).toHaveAccessibleDescription('Landeskirche: Nordkirche');
    expect(feld('Ansprechperson').value).toBe('Anna Beispiel');
    expect(feld('E-Mail der Gemeinde').value).toBe('anna@example.org');
    expect(feld('Telefon').value).toBe('0170 1234567');
    expect(tarif().value).toBe('5');
    expect((screen.getByRole('switch', { name: 'Testphase (30 Tage)' }) as HTMLInputElement).checked).toBe(true);
    expect(feld('Benutzername').value).toBe('anna.beispiel');
    expect(feld('Anzeigename').value).toBe('Anna Beispiel');
    expect(feld('Passwort').value).toBe('');
  });

  it('der Tarif ist eine Auswahl mit Preis; Wunschlizenz: Testphase aus stellt das Limit auf ihre Konfi-Zahl', async () => {
    await oeffnen(3, /Lindenau/);
    await waitFor(() => expect(feld('Name der Gemeinde').value).toBe('Kirchengemeinde Lindenau'));
    expect([...tarif().options].map((o) => o.textContent)).toEqual([
      'Testphase — bis 5 Konfis · kostenlos, 30 Tage',
      'Klein — bis 15 Konfis · 49 € pro Jahr',
      'Standard — bis 50 Konfis · 99 € pro Jahr',
      'Plus — bis 75 Konfis · 139 € pro Jahr',
      'Groß — bis 100 Konfis · 179 € pro Jahr',
      'Unbegrenzt — ohne Konfi-Grenze',
      'Eigenes Limit…',
    ]);
    expect(tarif()).toHaveAccessibleDescription('In der Testphase 5, danach 50 (Wunschlizenz Standard).');
    fireEvent.click(screen.getByRole('switch', { name: 'Testphase (30 Tage)' }));
    expect(tarif().value).toBe('50');
    fireEvent.click(screen.getByRole('switch', { name: 'Testphase (30 Tage)' }));
    expect(tarif().value).toBe('5');
  });

  it('ohne Passwort: Meldung, keine Rückfrage, kein Aufruf', async () => {
    await oeffnen(3, /Lindenau/);
    await waitFor(() => expect(feld('Name der Gemeinde').value).toBe('Kirchengemeinde Lindenau'));
    fireEvent.click(anlegenKnopf());
    expect(h.setError).toHaveBeenCalledWith('Alle Felder der Gemeindeleitung sind erforderlich');
    expect(h.alert).toBeNull();
    expect(server.aufrufe('post', /anlegen$/)).toHaveLength(0);
  });

  it('fragt nach, legt an und zeigt den Weg zur neuen Gemeinde -- auch wenn der Vorgang danach im Archiv liegt', async () => {
    await oeffnen(3, /Lindenau/);
    await waitFor(() => expect(feld('Name der Gemeinde').value).toBe('Kirchengemeinde Lindenau'));
    fireEvent.change(feld('Passwort'), { target: { value: BEISPIELWERT } });
    fireEvent.click(anlegenKnopf());
    expect(h.alert?.header).toBe('Gemeinde anlegen');
    expect(h.alert?.message).toBe('„Kirchengemeinde Lindenau“ mit der Gemeindeleitung „Anna Beispiel“ (anna.beispiel) anlegen?');
    expect(server.aufrufe('post', /anlegen$/)).toHaveLength(0);

    const vorher = Date.now();
    await bestaetigen('Anlegen');
    await waitFor(() => expect(server.aufrufe('post', /anlegen$/)).toHaveLength(1));
    const { pfad, koerper } = server.aufrufe('post', /anlegen$/)[0];
    expect(pfad).toBe('/support/anfragen/41/anlegen');
    const { trial_ends_at: ende, ...rest } = koerper as Record<string, unknown> & { trial_ends_at: string };
    expect(rest).toEqual({
      name: 'kirchengemeinde-lindenau', display_name: 'Kirchengemeinde Lindenau', kirchenkreis_id: 11, contact_name: 'Anna Beispiel',
      contact_email: 'anna@example.org', contact_phone: '0170 1234567', max_konfis: 5, is_trial: true, admin_username: 'anna.beispiel',
      admin_display_name: 'Anna Beispiel', admin_email: 'anna@example.org', admin_password: BEISPIELWERT,
    });
    expect(Math.round((new Date(ende).getTime() - vorher) / (24 * 60 * 60 * 1000))).toBe(30);

    expect(await screen.findByText('Die Gemeinde ist angelegt.')).toBeInTheDocument();
    expect(screen.getByText('anna.beispiel', { selector: 'strong' })).toBeInTheDocument();
    expect(h.setSuccess).toHaveBeenCalledWith('Gemeinde angelegt');
    // Die Anfrage steht „angelegt“, der Vorgang ist erledigt (Archiv): das Formular ist weg, der Weg zur Gemeinde bleibt.
    await waitFor(() => expect(screen.queryByRole('heading', { level: 2, name: 'Gemeinde anlegen' })).toBeNull());
    expect(screen.getByRole('link', { name: 'Gemeinde öffnen' })).toHaveAttribute('href', '/admin/organizations?gemeinde=77');
  });

  it('Benutzername vergeben (409): die Meldung des Servers, das Formular bleibt', async () => {
    await oeffnen(3, /Lindenau/);
    await waitFor(() => expect(feld('Name der Gemeinde').value).toBe('Kirchengemeinde Lindenau'));
    fireEvent.change(feld('Passwort'), { target: { value: BEISPIELWERT } });
    fireEvent.click(anlegenKnopf());
    server.stand.fehler.set('POST /support/anfragen/41/anlegen', { response: { status: 409, data: { error: 'Benutzername existiert bereits (muss systemweit eindeutig sein)' } } });
    await bestaetigen('Anlegen');
    await waitFor(() => expect(h.setError).toHaveBeenCalledWith('Benutzername existiert bereits (muss systemweit eindeutig sein)'));
    expect(anlegenKnopf()).toBeInTheDocument();
    expect(screen.queryByText('Die Gemeinde ist angelegt.')).toBeNull();
  });

  it('Kirchenkreis noch nicht in der Struktur: ein Schritt legt ihn an und wählt ihn', async () => {
    server.stand.vorgaenge[2].anfrage = { ...ANFRAGE_41, kirchenkreis: 'Steinburg' };
    await oeffnen(3, /Lindenau/);
    await screen.findByText(/steht noch nicht in der Struktur/);
    expect((screen.getByLabelText('Kirchenkreis') as HTMLSelectElement).value).toBe('ohne');
    const alt = h.apiGet.getMockImplementation()!;
    h.apiGet.mockImplementation((pfad: string, o?: unknown) => (pfad === '/support/kirchenkreise'
      ? Promise.resolve({ data: [{ id: 11, name: 'Kirchenkreis Dithmarschen', landeskirche_id: 1, landeskirche: 'Nordkirche' }, { id: 13, name: 'Steinburg', landeskirche_id: 1, landeskirche: 'Nordkirche' }] })
      : alt(pfad, o as never)));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Als Kirchenkreis anlegen' })); });
    expect(server.aufrufe('post', '/support/kirchenkreise')[0].koerper).toEqual({ name: 'Steinburg', landeskirche_id: 1 });
    await waitFor(() => expect((screen.getByLabelText('Kirchenkreis') as HTMLSelectElement).value).toBe('13'));
  });

  it('eine schon angelegte Anfrage zeigt den Weg zur Gemeinde statt des Formulars', async () => {
    server.stand.vorgaenge[2].anfrage = { ...ANFRAGE_41, status: 'angelegt', organization_id: 55 };
    server.stand.vorgaenge[2].organization_id = 55;
    await oeffnen(3, /Lindenau/);
    expect(await screen.findByText('Die Gemeinde ist angelegt.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Gemeinde anlegen' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Gemeinde öffnen' })).toHaveAttribute('href', '/admin/organizations?gemeinde=55');
  });
});

describe('Vorgang (Web): Laden, Fehler, nicht gefunden', () => {
  it('nicht gefunden (404): eigener Hinweis im Lesebereich, die Liste bleibt', async () => {
    render(<SupportVorgangDetailPage vorgangId={999} />);
    expect(await screen.findByText('Vorgang nicht gefunden')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Vorgänge' })).toBeInTheDocument();
  });

  it('Fehler beim Laden: Hinweis mit erneutem Versuch, der wirklich neu lädt', async () => {
    server.stand.fehler.set('GET /support/vorgaenge/1', new Error('Netz weg'));
    render(<SupportVorgangDetailPage vorgangId={1} />);
    expect(await screen.findByText('Der Vorgang konnte nicht geladen werden.')).toBeInTheDocument();
    server.stand.fehler.delete('GET /support/vorgaenge/1');
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Chat zeigt nichts Neues' })).toBeInTheDocument();
  });

  it('beim Laden steht im Lesebereich ein Platzhalter, der sich als „wird geladen“ meldet', async () => {
    const alt = h.apiGet.getMockImplementation()!;
    h.apiGet.mockImplementation((pfad: string, o?: unknown) => (pfad === '/support/vorgaenge/1' ? new Promise(() => {}) : alt(pfad, o as never)));
    render(<SupportVorgangDetailPage vorgangId={1} />);
    const platzhalter = await screen.findByText('Der Vorgang wird geladen.');
    expect(platzhalter.closest('[role="status"]')).not.toBeNull();
  });

  it('eine ungültige Nummer in der Adresse: nichts gewählt, kein Abruf -- und keine Schleife', async () => {
    render(<SupportVorgangDetailPage vorgangId={Number.NaN} />);
    expect(await screen.findByText('Kein Vorgang gewählt')).toBeInTheDocument();
    expect(server.aufrufe('get', /^\/support\/vorgaenge\//)).toHaveLength(0);
  });
});

describe('Vorgang: zwei Gesichter, eine Seite', () => {
  it('im schmalen Fenster bleibt die App-Darstellung -- mit derselben Logik', async () => {
    h.breit = false;
    render(<SupportVorgangDetailPage vorgangId={1} />);
    expect(await screen.findByLabelText('Notiz')).toBeInTheDocument();
    expect(document.querySelector('.web-seite')).toBeNull();
    expect(screen.getAllByText('Seit gestern erscheint im Chat nichts Neues.').length).toBeGreaterThan(0);
  });

  it('ohne Super-Admin-Recht: Hinweis, kein Abruf', () => {
    h.user = { id: 5, role_name: 'org_admin', is_super_admin: false };
    render(<SupportVorgangDetailPage vorgangId={1} />);
    expect(screen.getByText('Nur für den Support')).toBeInTheDocument();
    expect(h.apiGet).not.toHaveBeenCalled();
  });
});
