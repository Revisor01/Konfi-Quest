// Ein Vorgang in der Web-Fassung, gerendert (docs/planung/support-vorgaenge.md,
// Entscheidung 7): zwei Spalten -- links der Verlauf und die Antwort mit
// Textbausteinen, rechts „Einordnen“ (Art, Bereich, Dringlichkeit, Status,
// Gemeinde, sofort gespeichert), Kontakt, Gemeinde mit Gemeindeleitung, bei einer
// Anfrage deren Angaben und „Gemeinde anlegen“, die interne Notiz; im Kopf
// Archivieren, Wiederherstellen und Löschen mit Rückfrage. Die Logik ist die der
// App (useVorgangDetail, useGemeindeAnlegen, useAntwortEditor).
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
    const t = document.querySelector('.web-titel');
    expect(t).not.toBeNull();
    if (titel) expect(t!.textContent).toMatch(titel);
  });
  return ergebnis;
};
const seite = () => screen.getByRole('complementary', { name: 'Einordnen und Angaben' });
const haupt = () => document.querySelector('.web-spalten__haupt') as HTMLElement;
const kartenTitel = (wurzel: HTMLElement) => [...wurzel.querySelectorAll('h2.web-karte__titel')].map((t) => t.textContent);
const auswahl = (name: string) => within(seite()).getByRole('combobox', { name }) as HTMLSelectElement;
const optionen = (el: HTMLSelectElement) => [...el.options].map((o) => o.textContent);
const patches = () => server.aufrufe('patch');
const bestaetigen = async (knopf: string) => { await act(async () => { h.alert?.buttons?.find((b) => b.text === knopf)?.handler?.(); }); };
const text = () => screen.getByLabelText('Text der Antwort') as HTMLTextAreaElement;
const feld = (name: string) => screen.getByLabelText(name) as HTMLInputElement;

describe('Vorgang (Web): Aufbau', () => {
  it('Kopf: Betreff als Überschrift, Nummer, Status, Dringlichkeit und Gemeinde; der Weg zurück ist ein Link auf die Liste', async () => {
    await oeffnen();
    expect(screen.getByRole('heading', { level: 1, name: 'Chat zeigt nichts Neues' })).toBeInTheDocument();
    const kopf = document.querySelector('.web-vorgangskopf') as HTMLElement;
    expect(kopf).toHaveTextContent('Vorgang 1');
    expect(within(kopf).getByText('Neu')).toBeInTheDocument();
    expect(within(kopf).getByText('Dringend')).toBeInTheDocument();
    expect(kopf).toHaveTextContent('Kirchengemeinde Musterdorf');
    const zurueck = within(screen.getByRole('navigation', { name: 'Zurück' })).getByRole('link', { name: 'Alle Vorgänge' });
    expect(zurueck).toHaveAttribute('href', '/admin/support/vorgaenge');
    fireEvent.click(zurueck);
    expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge', 'none', 'push');
  });

  it('zwei Spalten: links Anliegen, Schriftwechsel und Antworten, rechts Einordnen, Kontakt, Gemeinde und Notiz', async () => {
    await oeffnen();
    await waitFor(() => expect((screen.getByLabelText('Textbaustein') as HTMLSelectElement).options.length).toBeGreaterThan(1));
    expect(kartenTitel(haupt())).toEqual(['Anliegen', 'Schriftwechsel', 'Antworten']);
    expect(kartenTitel(seite())).toEqual(['Einordnen', 'Kontakt', 'Gemeinde', 'Notiz']);
  });

  it('das Anliegen steht als eigene Karte, mit Absender und Zeit; ohne Text fehlt die Karte', async () => {
    await oeffnen();
    const karte = within(screen.getByRole('heading', { level: 2, name: 'Anliegen' }).closest('section')!);
    expect(karte.getByText('Seit gestern erscheint im Chat nichts Neues.')).toBeInTheDocument();
    expect(karte.getByText('Von Pastorin Lena Probe, 03.10.2026, 09:00')).toBeInTheDocument();
  });

  it('ohne Text aus dem Formular keine Karte „Anliegen“', async () => {
    await oeffnen(5, /Intern notiert/);
    expect(screen.queryByRole('heading', { level: 2, name: 'Anliegen' })).toBeNull();
  });

  it('die Anfrage-Nachricht heißt „Nachricht aus dem Formular“', async () => {
    await oeffnen(3, /Lindenau/);
    expect(screen.getByRole('heading', { level: 2, name: 'Nachricht aus dem Formular' })).toBeInTheDocument();
    expect(screen.getByText('Wir starten im November.')).toBeInTheDocument();
  });
});

describe('Vorgang (Web): Schriftwechsel', () => {
  it('älteste zuerst, ein- und ausgehend unterscheidbar; die ungelesenen werden gemeldet und tragen „Neu“', async () => {
    await oeffnen();
    const mails = screen.getAllByRole('article');
    expect(mails.map((m) => m.getAttribute('aria-label'))).toEqual([
      'Eingegangen am 03.10.2026, 09:00', 'Gesendet am 03.10.2026, 09:30', 'Eingegangen am 03.10.2026, 10:00',
    ]);
    expect(within(mails[0]).getByText('Neu')).toBeInTheDocument();
    expect(within(mails[1]).queryByText('Neu')).toBeNull();
    expect(within(mails[2]).getByRole('list', { name: 'Anhänge' })).toHaveTextContent('bildschirmfoto.png');
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledWith('/support/mail/gelesen', { ids: [11, 13] }));
    // Nach dem Melden tragen sie die Marke weiter -- für diesen Besuch.
    expect(within(screen.getAllByRole('article')[0]).getByText('Neu')).toBeInTheDocument();
    expect(screen.getByText('3 Mails')).toBeInTheDocument();
  });

  it('das Zitat in der Antwort ist eingeklappt und lässt sich aufklappen', async () => {
    await oeffnen();
    expect(screen.getByText('Wir schauen nach.')).toBeInTheDocument();
    expect(screen.queryByText(/> erscheint nichts/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Zitat einblenden' }));
    expect(screen.getByText(/> erscheint nichts/)).toBeInTheDocument();
  });

  it('ein Vorgang ohne Mails sagt das', async () => {
    await oeffnen(2, /Jahrgang/);
    expect(screen.getByText('Noch keine Mails in diesem Vorgang.')).toBeInTheDocument();
  });
});

describe('Vorgang (Web): Einordnen', () => {
  it('die fünf Auswahlfelder zeigen den Stand; Art und Status nennen alle Werte', async () => {
    await oeffnen();
    expect(auswahl('Art').value).toBe('fehler');
    expect(optionen(auswahl('Art'))).toEqual(['Neue Gemeinde', 'Frage zur Bedienung', 'Fehler melden', 'Wunsch oder Idee', 'Zugang und Konten', 'Lizenz und Abrechnung', 'Datenschutz', 'Sonstiges']);
    expect(auswahl('Bereich').value).toBe('chat');
    expect(optionen(auswahl('Bereich'))).toEqual(['Kein Bereich', 'Konfis', 'Events', 'Punkte und Anträge', 'Challenges', 'Chat', 'Badges', 'Material', 'Konten und Einladungen', 'Einstellungen', 'Sonstiges']);
    expect(auswahl('Dringlichkeit').value).toBe('dringend');
    expect(optionen(auswahl('Dringlichkeit'))).toEqual(['Normal', 'Dringend – wir können gerade nicht weiterarbeiten']);
    expect(auswahl('Status').value).toBe('neu');
    expect(optionen(auswahl('Status'))).toEqual(['Neu', 'In Arbeit', 'Wartet auf Rückmeldung', 'Erledigt']);
    expect(auswahl('Gemeinde').value).toBe('7');
  });

  it('jede Änderung wird sofort gespeichert -- ein Aufruf je Feld, nur mit dem geänderten Feld', async () => {
    await oeffnen();
    fireEvent.change(auswahl('Art'), { target: { value: 'wunsch' } });
    await waitFor(() => expect(patches()).toHaveLength(1));
    fireEvent.change(auswahl('Bereich'), { target: { value: 'termine' } });
    await waitFor(() => expect(patches()).toHaveLength(2));
    fireEvent.change(auswahl('Dringlichkeit'), { target: { value: 'normal' } });
    await waitFor(() => expect(patches()).toHaveLength(3));
    fireEvent.change(auswahl('Status'), { target: { value: 'wartet' } });
    await waitFor(() => expect(patches()).toHaveLength(4));
    fireEvent.change(auswahl('Gemeinde'), { target: { value: '8' } });
    await waitFor(() => expect(patches()).toHaveLength(5));
    expect(patches().map((p) => [p.pfad, p.koerper])).toEqual([
      ['/support/vorgaenge/1', { art: 'wunsch' }],
      ['/support/vorgaenge/1', { bereich: 'termine' }],
      ['/support/vorgaenge/1', { dringlichkeit: 'normal' }],
      ['/support/vorgaenge/1', { status: 'wartet' }],
      ['/support/vorgaenge/1', { organization_id: 8 }],
    ]);
    expect(h.setSuccess).toHaveBeenCalledWith('Gespeichert');
    // Der Server hat es: nach dem Neuladen steht es da.
    await waitFor(() => expect(auswahl('Gemeinde').value).toBe('8'));
    expect(screen.getByText('Wartet')).toBeInTheDocument();
  });

  it('„Kein Bereich“ und „Keine Gemeinde“ gehen als null an den Server', async () => {
    await oeffnen();
    fireEvent.change(auswahl('Bereich'), { target: { value: '' } });
    await waitFor(() => expect(patches()).toHaveLength(1));
    fireEvent.change(auswahl('Gemeinde'), { target: { value: '' } });
    await waitFor(() => expect(patches()).toHaveLength(2));
    expect(patches()[0].koerper).toEqual({ bereich: null });
    expect(patches()[1].koerper).toEqual({ organization_id: null });
    await waitFor(() => expect(auswahl('Gemeinde').value).toBe(''));
  });

  it('Status „Erledigt“: der Hinweis steht schon beim Auswählen da; danach liegt der Vorgang im Archiv', async () => {
    await oeffnen();
    expect(auswahl('Status')).toHaveAccessibleDescription('Erledigte Vorgänge liegen im Archiv. Eine neue Mail holt den Vorgang zurück.');
    fireEvent.change(auswahl('Status'), { target: { value: 'erledigt' } });
    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(patches()[0].koerper).toEqual({ status: 'erledigt' });
    expect(h.setSuccess).toHaveBeenCalledWith('Vorgang erledigt und ins Archiv gelegt');
    expect(await screen.findByText('Erledigt und im Archiv')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wiederherstellen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archivieren' })).toBeNull();
  });

  it('Frage, Fehler und Wunsch ohne Bereich: der Bereich trägt den Stern und sagt, dass er dazugehört', async () => {
    await oeffnen(2, /Jahrgang/);
    expect(auswahl('Bereich').value).toBe('');
    expect(optionen(auswahl('Bereich'))[0]).toBe('Bitte wählen');
    expect(auswahl('Bereich')).toHaveAccessibleDescription('Bei Frage, Fehler und Wunsch gehört ein Bereich dazu.');
    expect(within(seite()).getByText('Bereich').className).toContain('web-feld__label--pflicht');
  });

  it('ein Fehler beim Speichern: Meldung, der Stand vom Server kommt zurück', async () => {
    await oeffnen();
    server.stand.fehler.set('PATCH /support/vorgaenge/1', Object.assign(new Error('x'), { response: { status: 500, data: { error: 'Datenbankfehler' } } }));
    fireEvent.change(auswahl('Art'), { target: { value: 'wunsch' } });
    await waitFor(() => expect(h.setError).toHaveBeenCalledWith('Datenbankfehler'));
    await waitFor(() => expect(auswahl('Art').value).toBe('fehler'));
  });

  it('ohne Netz sind die Felder gesperrt', async () => {
    h.online = false;
    await oeffnen();
    for (const name of ['Art', 'Bereich', 'Dringlichkeit', 'Status', 'Gemeinde']) expect(auswahl(name), name).toBeDisabled();
  });
});

describe('Vorgang (Web): Kontakt und Gemeinde', () => {
  const angabe = (karte: HTMLElement, label: string) => [...karte.querySelectorAll('.web-angaben__zeile')].find((z) => z.querySelector('dt')!.textContent === label)!.querySelector('dd')!;

  it('Kontakt: Name, E-Mail als Verweis, Funktion, Gemeinde laut Formular, woher und wann', async () => {
    await oeffnen();
    const kontakt = screen.getByLabelText('Kontakt aus dem Formular');
    expect(angabe(kontakt, 'Name')).toHaveTextContent('Pastorin Lena Probe');
    expect(within(angabe(kontakt, 'E-Mail') as HTMLElement).getByRole('link', { name: 'lena.probe@example.org' })).toHaveAttribute('href', 'mailto:lena.probe@example.org');
    expect(angabe(kontakt, 'Funktion')).toHaveTextContent('Gemeindeleitung');
    expect(angabe(kontakt, 'Gemeinde laut Formular')).toHaveTextContent('Kirchengemeinde Musterdorf');
    expect(angabe(kontakt, 'Eingegangen über')).toHaveTextContent('Support-Formular auf der Homepage');
    expect(angabe(kontakt, 'Eingegangen')).toHaveTextContent('03.10.2026, 09:00');
  });

  it('bei einer Anfrage stehen Name und Adresse aus deren Angaben da', async () => {
    await oeffnen(3, /Lindenau/);
    const kontakt = screen.getByLabelText('Kontakt aus dem Formular');
    expect(angabe(kontakt, 'Name')).toHaveTextContent('Anna Beispiel');
    expect(angabe(kontakt, 'E-Mail')).toHaveTextContent('anna@example.org');
    expect(angabe(kontakt, 'Funktion')).toHaveTextContent('Pastorin');
    expect(angabe(kontakt, 'Gemeinde laut Formular')).toHaveTextContent('Kirchengemeinde Lindenau');
    expect(angabe(kontakt, 'Eingegangen über')).toHaveTextContent('Anfrage von der Homepage');
  });

  it('Gemeinde und Gemeindeleitung: Laufzeit, Konfis, Kirchenkreis, Leitung mit Adresse und letzter Anmeldung', async () => {
    await oeffnen();
    const gemeinde = screen.getByLabelText('Gemeinde des Vorgangs');
    expect(within(angabe(gemeinde, 'Gemeinde') as HTMLElement).getByRole('link', { name: 'Kirchengemeinde Musterdorf' })).toHaveAttribute('href', '/admin/organizations?gemeinde=7');
    expect(angabe(gemeinde, 'Konfis')).toHaveTextContent('3 von 5');
    expect(angabe(gemeinde, 'Kirchenkreis')).toHaveTextContent('Dithmarschen');
    expect(angabe(gemeinde, 'Landeskirche')).toHaveTextContent('Nordkirche');
    const leitung = screen.getByRole('list', { name: 'Gemeindeleitung' });
    expect(within(leitung).getByText('Pastorin Lena Probe')).toBeInTheDocument();
    expect(within(leitung).getByRole('link', { name: 'lena.probe@example.org' })).toHaveAttribute('href', 'mailto:lena.probe@example.org');
    expect(leitung).toHaveTextContent('Zuletzt angemeldet 02.10.2026');
    expect(within(seite()).getByRole('link', { name: /Alle Vorgänge/ })).toHaveAttribute('href', '/admin/support/vorgaenge?gemeinde=7');
  });

  it('eine Leitung ohne Adresse und ohne Anmeldung sagt das; eine gesperrte trägt eine Marke', async () => {
    LEITUNG[7] = [{ id: 22, display_name: 'Sam Muster', username: 'sam.muster', email: null, is_active: false, last_login_at: null }];
    await oeffnen();
    const leitung = screen.getByRole('list', { name: 'Gemeindeleitung' });
    expect(leitung).toHaveTextContent('Keine E-Mail');
    expect(leitung).toHaveTextContent('Noch nicht angemeldet');
    expect(within(leitung).getByText('Gesperrt')).toBeInTheDocument();
    LEITUNG[7] = [{ id: 21, display_name: 'Pastorin Lena Probe', username: 'lena.probe', email: 'lena.probe@example.org', is_active: true, last_login_at: '2026-10-02T08:00:00Z' }];
  });

  it('ohne Gemeinde: die Angabe aus dem Formular steht prominent da, daneben die Auswahl der Gemeinde', async () => {
    await oeffnen(2, /Jahrgang/);
    const hinweis = screen.getByText('Noch keiner Gemeinde zugeordnet').closest('.web-hinweis') as HTMLElement;
    expect(hinweis.className).toContain('web-hinweis--warnung');
    expect(within(hinweis).getByText('Kirchengemeinde Heide').className).toContain('web-gemeindeangabe');
    expect(hinweis).toHaveTextContent('Wähle unter „Einordnen“ die passende Gemeinde.');
    expect(auswahl('Gemeinde').value).toBe('');
    expect(screen.queryByLabelText('Gemeinde des Vorgangs')).toBeNull();
  });

  it('die Gemeinde wählen: der Hinweis verschwindet, die Karte „Gemeinde“ mit der Leitung erscheint', async () => {
    await oeffnen(2, /Jahrgang/);
    fireEvent.change(auswahl('Gemeinde'), { target: { value: '7' } });
    await waitFor(() => expect(patches()[0].koerper).toEqual({ organization_id: 7 }));
    expect(await screen.findByLabelText('Gemeinde des Vorgangs')).toBeInTheDocument();
    expect(screen.queryByText('Noch keiner Gemeinde zugeordnet')).toBeNull();
    expect(screen.getByRole('list', { name: 'Gemeindeleitung' })).toHaveTextContent('Pastorin Lena Probe');
  });

  it('ohne Gemeinde und ohne Angabe im Formular sagt der Hinweis das', async () => {
    await oeffnen(5, /Intern notiert/);
    expect(screen.getByText('Im Formular wurde keine Gemeinde genannt.')).toBeInTheDocument();
  });
});

describe('Vorgang (Web): Antworten', () => {
  it('mit Gemeinde: von support@ an eine Adresse der Gemeinde -- der Kontakt des Formulars steht zur Wahl, die Bausteine für support@ und beide', async () => {
    await oeffnen();
    const empfaenger = await waitFor(() => {
      const el = screen.getByLabelText('Empfänger') as HTMLSelectElement;
      expect(el.options.length).toBeGreaterThan(1);
      return el;
    });
    // Die Gemeindeleitung ist zugleich der Kontakt: nur einmal -- als Gemeindeleitung.
    await waitFor(() => expect([...empfaenger.options].map((o) => o.textContent)).toEqual(['Bitte wählen', 'Pastorin Lena Probe <lena.probe@example.org> · Gemeindeleitung']));
    expect(screen.getByText('Von support@ an die Gemeinde; die Nummer des Vorgangs steht im Betreff')).toBeInTheDocument();
    await waitFor(() => expect((screen.getByLabelText('Textbaustein') as HTMLSelectElement).options.length).toBeGreaterThan(1));
  });

  it('der Kontakt, der nicht zur Gemeindeleitung gehört, steht vorn in der Wahl', async () => {
    server.stand.vorgaenge[0].kontakt_email = 'sekretariat@example.org';
    server.stand.vorgaenge[0].kontakt_name = 'Das Sekretariat';
    await oeffnen();
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
  });

  it('Senden mit Rückfrage an den Vorgang; Körper mit Betreff, Text und gewählter Adresse; danach steht die Mail im Verlauf', async () => {
    await oeffnen();
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
    expect(text().value).toBe('');
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(4));
    expect(screen.getByText('4 Mails')).toBeInTheDocument();
  });

  it('bei mehreren Adressen ohne gewählten Empfänger: Meldung, keine Rückfrage, kein Versand', async () => {
    server.stand.vorgaenge[0].kontakt_email = 'sekretariat@example.org';
    await oeffnen();
    await waitFor(() => expect((screen.getByLabelText('Empfänger') as HTMLSelectElement).options.length).toBe(3));
    fireEvent.change(text(), { target: { value: 'Hallo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Antwort senden' }));
    expect(h.setError).toHaveBeenCalledWith('Bitte einen Empfänger wählen');
    expect(h.alert).toBeNull();
  });

  it('bei einer Anfrage: von moin@ an die Adresse der Anfrage, fest; die Platzhalter kommen von der Anfrage', async () => {
    await oeffnen(3, /Lindenau/);
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
    expect(screen.getByText(/^An:/, { selector: 'p.web-antwort__an' })).toHaveTextContent('An: anna@example.org · von support@');
    expect((feld('Betreff')).value).toBe('Re: Wie lege ich einen Jahrgang an?');
  });

  it('niemand zum Antworten: Hinweis statt Formular', async () => {
    await oeffnen(5, /Intern notiert/);
    expect(screen.getByText('Es gibt noch niemanden, dem sich antworten ließe')).toBeInTheDocument();
    expect(screen.queryByLabelText('Text der Antwort')).toBeNull();
  });
});

describe('Vorgang (Web): Notiz', () => {
  it('Speichern erst nach einer Änderung; die Notiz geht getrimmt an den Server, leer als null', async () => {
    await oeffnen();
    const speichern = screen.getByRole('button', { name: 'Notiz speichern' });
    expect(speichern).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Interne Notiz'), { target: { value: '  Rückruf am Montag ' } });
    expect(speichern).toBeEnabled();
    await act(async () => { fireEvent.click(speichern); });
    expect(patches()[0]).toMatchObject({ pfad: '/support/vorgaenge/1', koerper: { notiz: 'Rückruf am Montag' } });
    expect(h.setSuccess).toHaveBeenCalledWith('Notiz gespeichert');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Notiz speichern' })).toBeDisabled());
    fireEvent.change(screen.getByLabelText('Interne Notiz'), { target: { value: '   ' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Notiz speichern' })); });
    expect(patches()[1].koerper).toEqual({ notiz: null });
  });

  it('eine vorhandene Notiz steht im Feld', async () => {
    server.stand.vorgaenge[0].notiz = 'Nachfragen';
    await oeffnen();
    expect((screen.getByLabelText('Interne Notiz') as HTMLTextAreaElement).value).toBe('Nachfragen');
  });

  it('ein Fehler beim Speichern: Meldung, die Eingabe bleibt', async () => {
    await oeffnen();
    server.stand.fehler.set('PATCH /support/vorgaenge/1', Object.assign(new Error('x'), { response: { status: 500, data: { error: 'Datenbankfehler' } } }));
    fireEvent.change(screen.getByLabelText('Interne Notiz'), { target: { value: 'Neu' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Notiz speichern' })); });
    expect(h.setError).toHaveBeenCalledWith('Datenbankfehler');
    expect((screen.getByLabelText('Interne Notiz') as HTMLTextAreaElement).value).toBe('Neu');
  });
});

describe('Vorgang (Web): Archivieren, Wiederherstellen, Löschen', () => {
  it('Archivieren: eine Anfrage an den Vorgang; er zeigt danach, dass er im Archiv liegt', async () => {
    await oeffnen();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Archivieren' })); });
    expect(server.aufrufe('post', '/support/vorgaenge/1/archivieren')).toHaveLength(1);
    expect(h.setSuccess).toHaveBeenCalledWith('Vorgang archiviert');
    expect(await screen.findByText('Dieser Vorgang liegt im Archiv')).toBeInTheDocument();
    expect(screen.getByText('Archiv', { selector: '.web-pill' })).toBeInTheDocument();
  });

  it('ein erledigter Vorgang liegt im Archiv und lässt sich wiederherstellen: danach „In Arbeit“', async () => {
    await oeffnen(4, /Konto entsperrt/);
    expect(screen.getByText('Erledigt und im Archiv')).toBeInTheDocument();
    expect(screen.getByText(/Archiviert am 02\.10\.2026/)).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Wiederherstellen' })); });
    expect(server.aufrufe('post', '/support/vorgaenge/4/wiederherstellen')).toHaveLength(1);
    expect(h.setSuccess).toHaveBeenCalledWith('Vorgang wiederhergestellt – Status „In Arbeit“');
    await waitFor(() => expect(screen.queryByText('Erledigt und im Archiv')).toBeNull());
    expect(auswahl('Status').value).toBe('in_arbeit');
    expect(screen.getByRole('button', { name: 'Archivieren' })).toBeInTheDocument();
  });

  it('ein manuell archivierter Vorgang trägt den Hinweis „liegt im Archiv“, nicht „erledigt“', async () => {
    await oeffnen(6, /Rechnung/);
    expect(screen.getByText('Dieser Vorgang liegt im Archiv')).toBeInTheDocument();
    expect(screen.queryByText('Erledigt und im Archiv')).toBeNull();
  });

  it('Löschen fragt zuerst und nennt, was gelöscht wird -- bei einer Anfrage auch sie; erst „Löschen“ löscht und führt zur Liste', async () => {
    await oeffnen(3, /Lindenau/);
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    expect(h.alert?.header).toBe('Vorgang löschen');
    expect(h.alert?.message).toBe('„Anfrage Kirchengemeinde Lindenau“ wird mit seinen Mails in Konfi Quest und der Anfrage gelöscht. Im Postfach selbst bleibt alles stehen. Das lässt sich nicht rückgängig machen.');
    expect(server.aufrufe('delete')).toHaveLength(0);
    await bestaetigen('Löschen');
    expect(server.aufrufe('delete')[0].pfad).toBe('/support/vorgaenge/3');
    expect(h.setSuccess).toHaveBeenCalledWith('Vorgang gelöscht');
    expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge', 'back', 'replace');
  });

  it('Abbrechen löscht nichts; ein Fehler beim Löschen meldet ihn und bleibt auf der Seite', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    expect(h.alert?.buttons?.find((b) => b.role === 'cancel')?.text).toBe('Abbrechen');
    expect(server.aufrufe('delete')).toHaveLength(0);
    server.stand.fehler.set('DELETE /support/vorgaenge/1', Object.assign(new Error('x'), { response: { status: 500, data: { error: 'Datenbankfehler' } } }));
    await bestaetigen('Löschen');
    expect(h.setError).toHaveBeenCalledWith('Datenbankfehler');
    expect(h.push).not.toHaveBeenCalled();
  });

  it('ohne Netz sind Archivieren und Löschen gesperrt', async () => {
    h.online = false;
    await oeffnen();
    // findBy: Der Titel steht schon, bevor die Knopfleiste nachkommt; im
    // vollen CI-Lauf fiel getBy deshalb einmal (09.10.2026).
    expect(await screen.findByRole('button', { name: 'Archivieren' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Löschen' })).toBeDisabled();
  });
});

describe('Vorgang (Web): Angaben der Anfrage und Gemeinde anlegen', () => {
  const tarif = () => screen.getByLabelText('Tarif') as HTMLSelectElement;
  const anlegenKnopf = () => screen.getByRole('button', { name: 'Gemeinde anlegen' });
  const angaben = () => screen.getByLabelText('Angaben aus dem Formular der Anfrage');
  const wert = (label: string) => [...angaben().querySelectorAll('.web-angaben__zeile')].find((z) => z.querySelector('dt')!.textContent === label)!.querySelector('dd')!;

  it('die Angaben aus der Anfrage: Mail und Telefon sind Verweise, die Wunschlizenz steht mit Preis da', async () => {
    await oeffnen(3, /Lindenau/);
    expect(wert('Gemeinde')).toHaveTextContent('Kirchengemeinde Lindenau');
    expect(wert('Verantwortlich')).toHaveTextContent('Anna Beispiel (Pastorin)');
    expect(within(wert('E-Mail') as HTMLElement).getByRole('link', { name: 'anna@example.org' })).toHaveAttribute('href', 'mailto:anna@example.org');
    expect(within(wert('Mobilnummer') as HTMLElement).getByRole('link', { name: '0170 1234567' })).toHaveAttribute('href', 'tel:01701234567');
    expect(wert('Ungefähre Zahl')).toHaveTextContent('25 Konfis · 6 Teamer:innen');
    expect(wert('Wunschlizenz')).toHaveTextContent('Standard — bis 50 Konfis, 99 € pro Jahr');
  });

  it('ein Vorgang ohne Anfrage hat weder ihre Angaben noch „Gemeinde anlegen“', async () => {
    await oeffnen();
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
  it('nicht gefunden (404): eigener Hinweis, der Weg zurück bleibt', async () => {
    render(<SupportVorgangDetailPage vorgangId={999} />);
    expect(await screen.findByText('Vorgang nicht gefunden')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alle Vorgänge' })).toBeInTheDocument();
  });

  it('Fehler beim Laden: Hinweis mit erneutem Versuch, der wirklich neu lädt', async () => {
    server.stand.fehler.set('GET /support/vorgaenge/1', new Error('Netz weg'));
    render(<SupportVorgangDetailPage vorgangId={1} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Der Vorgang konnte nicht geladen werden.');
    server.stand.fehler.delete('GET /support/vorgaenge/1');
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Chat zeigt nichts Neues' })).toBeInTheDocument();
  });

  it('beim Laden steht ein Platzhalter, der sich als „wird geladen“ meldet', () => {
    h.apiGet.mockImplementation(() => new Promise(() => {}));
    render(<SupportVorgangDetailPage vorgangId={1} />);
    expect(screen.getByRole('status')).toHaveTextContent('Der Vorgang wird geladen.');
  });

  it('eine ungültige Nummer in der Adresse: „nicht gefunden“ ohne Abruf', async () => {
    render(<SupportVorgangDetailPage vorgangId={Number.NaN} />);
    expect(await screen.findByText('Vorgang nicht gefunden')).toBeInTheDocument();
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
