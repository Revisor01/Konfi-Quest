// Ein Vorgang in der Web-Fassung, gerendert (docs/planung/support-detailseiten.md,
// Skizzen A bis C, F bis H; Simon, 11.10.2026): Er steht im Lesebereich rechts
// neben der Liste, wie in einem guten Mailprogramm.
//
//   Kopf: Kreis der Art, Betreff, Kennzeichen (Nr., Status, Dringend,
//     Art › Bereich, die Gemeinde nur mit Zuordnung); rechts alle Aktionen,
//     ganz rechts der eine Hauptknopf, der dem Stand folgt.
//   Rumpf: die Stand-Zeile, die Kennzahlen, die Notiz oben, der flache
//     Verlauf mit der Antwort direkt unter der jüngsten Mail, die Angaben als
//     offene Karten (Lizenz, Anfrage, Kontakt, Gemeinde) statt eines Akkordeons.
//   Dialoge: Einordnen (mit Betreff), Gemeinde anlegen (Rückfragen vor dem
//     Anlegen und beim Schließen als zweites Fenster darüber -- ein ion-alert
//     läge im Browser hinter dem Dialog), Mail verschieben oder herauslösen;
//     Ablehnen mit Rückfrage.
//   Nach Erledigt, Archivieren und Löschen öffnet der Lese-Rahmen der Liste
//   den nächsten Eintrag.
//   Fokus: Öffnen setzt ihn in den Text der Antwort; Verwerfen und Senden
//   geben ihn an die Antwortzeile zurück, Abbrechen und Speichern der Notiz an
//   „Bearbeiten" bzw. „+ Interne Notiz".
//
// Die Logik ist die der App (useVorgangDetail, useGemeindeAnlegen,
// useAntwortEditor, useEinordnenFormular, useEinsortieren). Der Lizenz-Vorgang
// steht in webLizenzVorgang.test.tsx.
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
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
import WebVorgangDetail from '../../../components/support/web/WebVorgangDetail';
import { LESE_RAHMEN_NEUTRAL, LeseRahmenProvider, type LeseRahmen } from '../../../components/support/web/WebLeseRahmen';
import { supportMailZaehlerZuruecksetzen } from '../../../navigation/supportMailZaehler';
import { meldeSupportGeaendert } from '../../../utils/supportAktualisieren';

// Erfundener Wert fuer das Passwortfeld. Zusammengesetzt statt als
// Zeichenkette, damit Geheimnis-Scanner (GitGuardian, PR #220) einen
// Testwert nicht als Passwort im oeffentlichen Repo melden.
const BEISPIELWERT = ['Beispiel', '2026', 'Wert!'].join('-');

let vorherTZ: string | undefined;
beforeAll(() => { vorherTZ = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherTZ === undefined) delete process.env.TZ; else process.env.TZ = vorherTZ; });

let server: ReturnType<typeof vorgaengeServer>;
const rollen = vi.fn();
const rollenVorher = Element.prototype.scrollIntoView;

beforeEach(() => {
  vi.clearAllMocks();
  // Die Stand-Sätze nennen Zeiten relativ zu heute: „heute" ist der Tag des Testservers.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-03T09:00:00Z'));
  Element.prototype.scrollIntoView = rollen;
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
      vorgang(4, { art: 'zugang', bereich: null, status: 'erledigt', betreff: 'Konto entsperrt', organization_id: 7, archiviert_am: '2026-10-02T12:00:00Z', status_seit: '2026-10-02T12:00:00Z' }),
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

afterEach(() => {
  vi.useRealTimers();
  Element.prototype.scrollIntoView = rollenVorher;
});

/** Eine Antwort des Supports (mit Konto): Danach schrieb der Support zuletzt. */
const supportAntwort = (id: number, vorgangId: number, gesendet: string) => mail(id, vorgangId, {
  richtung: 'aus', von_adresse: 'support@konfi-quest.example', von_name: 'Support', an_adressen: ['lena.probe@example.org'],
  betreff: 'Re: Chat zeigt nichts Neues [Vorgang 1]', text: 'Ist behoben.', gesendet_am: gesendet, gelesen_am: gesendet, verfasst_von: 9, verfasst_von_name: 'Test Super-Admin',
});

const oeffnen = async (id = 1, titel?: RegExp) => {
  const ergebnis = render(<SupportVorgangDetailPage vorgangId={id} />);
  await bereit(titel);
  return ergebnis;
};
/**
 * Der Vorgang allein, ohne die Liste daneben (Lese-Rahmen neutral). In der
 * Liste öffnet sich nach Erledigt, Archivieren, Ablehnen oder Löschen der
 * nächste Eintrag (Simon, 11.10.2026: Frage 6; webBreitLesen.test.tsx) --
 * was der Vorgang danach selbst zeigt, prüfen die Tests hier allein.
 */
const allein = async (id = 1, titel?: RegExp) => {
  const ergebnis = render(<WebVorgangDetail vorgangId={id} />);
  await bereit(titel);
  return ergebnis;
};
const bereit = async (titel?: RegExp) => {
  await waitFor(() => {
    const t = document.querySelector('.web-lesen__titel');
    expect(t).not.toBeNull();
    if (titel) expect(t!.textContent).toMatch(titel);
    expect(screen.queryByRole('button', { name: 'Löschen' })).not.toBeNull();
  });
};
/** Der Lesebereich rechts neben der Liste. */
const lesen = () => document.querySelector('.web-lesen') as HTMLElement;
const kopf = () => document.querySelector('.web-lesen__kopf') as HTMLElement;
const kennzeichen = () => document.querySelector('.web-lesen__angaben') as HTMLElement;
const teile = (el: HTMLElement) => [...el.children].map((c) => c.textContent!.trim());
/** Die Knöpfe rechts im Kopf, in ihrer Reihenfolge, mit Namen (Symbolknöpfe tragen ihn in aria-label). */
const aktionen = () => [...kopf().querySelectorAll<HTMLElement>('.web-kopfaktionen > .web-kopfknopf')];
const aktionNamen = () => aktionen().map((k) => k.getAttribute('aria-label') ?? k.textContent!.trim());
const hauptknopf = () => aktionen().at(-1)!;
const stand = () => document.querySelector('.web-stand') as HTMLElement;
const kennzahlen = () => [...document.querySelectorAll('.web-detail__kennzahlen .web-kachel')].map((k) => k.textContent!.trim());
const karte = (titel: string) => screen.getByRole('region', { name: titel });
const kartenTitel = () => [...document.querySelectorAll('.web-vorgang-karte .web-vorgang-karte__titel')].map((t) => t.textContent!.trim());
/** Wo eine Adresse umbrechen darf: jede Umbruchstelle (<wbr>) als „|". */
const umbruchStellen = (el: Element) => [...el.childNodes].map((n) => (n.nodeName === 'WBR' ? '|' : n.textContent)).join('');
const zeile = (k: HTMLElement, label: string) => [...k.querySelectorAll('.web-angaben__zeile')].find((z) => z.querySelector('dt')!.textContent === label)?.querySelector('dd') as HTMLElement;
const mails = () => [...document.querySelectorAll('li.mail-zeile')] as HTMLElement[];
const mailKopf = (m: HTMLElement) => m.querySelector('button.mail-zeile__kopf') as HTMLButtonElement;
const absender = () => mails().map((m) => m.querySelector('.mail-zeile__absender')!.textContent);
const dialog = (name = 'Einordnen') => screen.getByRole('dialog', { name });
const einordnen = () => { fireEvent.click(within(kopf()).getByRole('button', { name: 'Einordnen' })); return dialog(); };
const auswahl = (name: string, d = dialog()) => within(d).getByRole('combobox', { name }) as HTMLSelectElement;
const speichern = async () => { await act(async () => { fireEvent.click(within(dialog()).getByRole('button', { name: 'Speichern' })); }); };
const optionen = (el: HTMLSelectElement) => [...el.options].map((o) => o.textContent);
const patches = () => server.aufrufe('patch');
const bestaetigen = async (knopf: string) => { await act(async () => { h.alert?.buttons?.find((b) => b.text === knopf)?.handler?.(); }); };
const text = () => screen.getByLabelText('Text der Antwort') as HTMLTextAreaElement;
const feld = (name: string, d?: HTMLElement) => (d ? within(d).getByLabelText(name) : screen.getByLabelText(name)) as HTMLInputElement;
const antwortzeile = () => document.querySelector('button.web-antwortzeile') as HTMLButtonElement;
const antworten = () => fireEvent.click(within(kopf()).getByRole('button', { name: 'Antworten' }));
const editor = () => screen.getByRole('region', { name: 'Antwort schreiben' });
const an = () => screen.getByRole('combobox', { name: 'An' }) as HTMLSelectElement;

describe('Vorgang (Web): Kopf', () => {
  it('Kreis der Art, Betreff als Überschrift, Kennzeichen: Nr., Status, Dringend, Art › Bereich und die Gemeinde als Verweis', async () => {
    await oeffnen();
    expect(within(lesen()).getByRole('heading', { level: 2, name: 'Chat zeigt nichts Neues' })).toHaveAttribute('title', 'Chat zeigt nichts Neues');
    const kreis = kopf().querySelector('.web-lesen__kreis > span') as HTMLElement;
    expect(kreis.className).toBe('web-vorgang-kreis web-vorgang-kreis--gross');
    // Die Farbe der Art aus ART_FARBE, derselben Zuordnung wie der Kreis der App.
    expect(kreis.style.getPropertyValue('--web-vorgang-kreis-farbe')).toBe('var(--app-color-danger)');
    expect(kreis).toHaveAttribute('aria-hidden', 'true');
    expect(teile(kennzeichen())).toEqual(['Nr. 1', 'Neu', 'Dringend', 'Fehler › Chat', 'Kirchengemeinde Musterdorf']);
    expect(within(kennzeichen()).getByRole('link', { name: 'Kirchengemeinde Musterdorf' })).toHaveAttribute('href', '/admin/organizations?gemeinde=7');
  });

  it('ohne Zuordnung steht keine Gemeinde im Kopf -- auch nicht der Freitext, den der Server als gemeinde_name nennt; „Bereich fehlt" und „Keine Gemeinde" öffnen Einordnen', async () => {
    server = vorgaengeServer({ vorgaenge: server.stand.vorgaenge, mails: server.stand.mails, gemeindeNameWieServer: true });
    server.installieren({ get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete });
    await oeffnen(2, /Jahrgang/);
    expect(teile(kennzeichen())).toEqual(['Nr. 2', 'Neu', 'Frage', 'Bereich fehlt', 'Keine Gemeinde']);
    expect(within(kennzeichen()).queryByRole('link')).toBeNull();
    expect(kennzeichen()).not.toHaveTextContent('Heide');
    fireEvent.click(within(kennzeichen()).getByRole('button', { name: 'Keine Gemeinde: Einordnen' }));
    expect(auswahl('Gemeinde').value).toBe('');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Abbrechen' }));
    fireEvent.click(within(kennzeichen()).getByRole('button', { name: 'Bereich fehlt: Einordnen' }));
    expect(auswahl('Bereich').value).toBe('');
  });

  it('alle Aktionen rechts: Löschen, Archivieren, Einordnen, die Nebenknöpfe -- ganz rechts der Hauptknopf; jeder trägt einen Tooltip', async () => {
    await oeffnen();
    // Fall 3: Die jüngste Mail kam von außen -- Antworten ist dran, Erledigt daneben.
    expect(aktionNamen()).toEqual(['Löschen', 'Archivieren', 'Einordnen', 'Erledigt', 'Antworten']);
    expect(hauptknopf().className).toContain('web-knopf--primaer');
    expect(aktionen().filter((k) => k.className.includes('web-knopf--primaer'))).toHaveLength(1);
    expect(aktionen().map((k) => k.getAttribute('title'))).toEqual([
      'Löschen', 'Archivieren', 'Status, Art, Bereich, Gemeinde und Betreff', 'Als erledigt ins Archiv legen', 'Antwort schreiben',
    ]);
    // Löschen und Archivieren sind immer nur Symbole; der Hauptknopf trägt immer Text.
    expect(aktionen()[0].className).toContain('web-knopf--symbol');
    expect(aktionen()[0].className).toContain('web-knopf--gefahr');
    expect(aktionen()[1].className).toContain('web-knopf--symbol');
    expect(aktionen()[2].className).toContain('web-kopfknopf--unter760');
    expect(aktionen()[3].className).toContain('web-kopfknopf--unter600');
    expect(hauptknopf()).not.toHaveAttribute('aria-label');
    expect(hauptknopf()).toHaveTextContent('Antworten');
  });

  it('der Hauptknopf folgt dem Stand: schrieb der Support zuletzt, ist es „Erledigt", Antworten steht daneben', async () => {
    server.stand.mails.push(supportAntwort(14, 1, '2026-10-03T08:30:00Z'));
    await allein();
    expect(aktionNamen()).toEqual(['Löschen', 'Archivieren', 'Einordnen', 'Antworten', 'Erledigt']);
    await act(async () => { fireEvent.click(hauptknopf()); });
    expect(patches().map((p) => [p.pfad, p.koerper])).toEqual([['/support/vorgaenge/1', { status: 'erledigt' }]]);
    // Erledigt liegt im Archiv: Wiederherstellen ist jetzt der Hauptknopf, Archivieren entfällt.
    await waitFor(() => expect(aktionNamen()).toEqual(['Löschen', 'Einordnen', 'Wiederherstellen']));
  });

  it('eine Anfrage: Ablehnen als Symbol neben Einordnen, Gemeinde anlegen daneben, die Zahlen der Anfrage im Kopf (schmal)', async () => {
    await oeffnen(3, /Lindenau/);
    expect(aktionNamen()).toEqual(['Löschen', 'Archivieren', 'Einordnen', 'Ablehnen', 'Gemeinde anlegen', 'Antworten']);
    expect(aktionen()[3].className).toContain('web-knopf--symbol');
    // Bei einer Anfrage sagt der Kreis die Art; im Kopf steht, dass sie noch nicht angelegt ist.
    expect(teile(kennzeichen())).toEqual(['Nr. 3', 'Neu', 'Noch nicht angelegt', '25 Konfis · 6 Teamer:innen']);
    expect(kennzeichen().lastElementChild!.className).toBe('web-lesen__nur-schmal');
  });

  it('ohne Netz sind die Aktionen gesperrt', async () => {
    h.online = false;
    await oeffnen();
    expect(aktionen().map((k) => (k as HTMLButtonElement).disabled)).toEqual([true, true, true, true, true]);
    expect(antwortzeile()).toBeDisabled();
  });
});

describe('Vorgang (Web): Stand und Kennzahlen', () => {
  it('die Stand-Zeile sagt, wer dran ist und seit wann -- im Ton des Falls', async () => {
    await oeffnen();
    expect(stand()).toHaveAttribute('role', 'status');
    expect(stand().className).toBe('web-stand web-stand--warnung');
    expect(stand()).toHaveTextContent('Pastorin Lena Probe wartet seit heute, 10:00 auf Antwort.');
  });

  it('der Support schrieb zuletzt; Status „Wartet": auf wen und seit wann', async () => {
    server.stand.mails.push(supportAntwort(14, 1, '2026-10-03T08:30:00Z'));
    server.stand.vorgaenge[0].status = 'wartet';
    server.stand.vorgaenge[0].status_seit = '2026-10-03T08:30:00Z';
    await oeffnen();
    expect(stand()).toHaveTextContent('Wartet seit heute, 10:30 auf Pastorin Lena Probe.');
    expect(stand().className).toBe('web-stand web-stand--neutral');
    expect(hauptknopf()).toHaveTextContent('Erledigt');
  });

  it('erledigt und im Archiv: der Satz sagt, wann, und dass eine neue Mail ihn zurückholt', async () => {
    await oeffnen(4, /Konto entsperrt/);
    expect(stand()).toHaveTextContent('Erledigt am 02.10.2026. Eine neue Mail holt ihn zurück.');
    expect(stand().className).toBe('web-stand web-stand--hinweis');
    expect(hauptknopf()).toHaveTextContent('Wiederherstellen');
  });

  it('manuell archiviert: „Im Archiv seit", nicht „Erledigt"', async () => {
    await oeffnen(6, /Rechnung/);
    expect(stand()).toHaveTextContent('Im Archiv seit 01.10.2026. Eine neue Mail holt ihn zurück.');
    expect(stand()).not.toHaveTextContent('Erledigt');
  });

  it('niemand, dem sich antworten ließe: der Stand sagt es, „Gemeinde zuordnen" ist der Hauptknopf, Antworten ist gesperrt', async () => {
    await oeffnen(5, /Intern notiert/);
    expect(stand()).toHaveTextContent('Niemand, dem sich antworten ließe: keine Gemeinde, kein Kontakt.');
    expect(aktionNamen()).toEqual(['Löschen', 'Archivieren', 'Einordnen', 'Gemeinde zuordnen']);
    expect(antwortzeile()).toBeNull();
    expect(screen.getByText('Antworten geht erst, wenn jemand dafür da ist – siehe Stand oben.')).toBeInTheDocument();
    fireEvent.click(hauptknopf());
    expect(auswahl('Gemeinde').value).toBe('');
  });

  it('Kennzahlen: Mails, Neu, Tage offen -- bei einer Anfrage Konfis, Teamer:innen, Mails', async () => {
    // „Mails" zählt wie der Verlauf den Anfang mit (Formular bzw. Anfrage):
    // drei Mails + Anliegen = 4, eine Mail + Anfrage = 2.
    const { unmount } = await oeffnen();
    expect(kennzahlen()).toEqual(['Mails4', 'Neu2', 'Tage offen0']);
    unmount();
    await oeffnen(3, /Lindenau/);
    expect(kennzahlen()).toEqual(['Konfis25', 'Teamer:innen6', 'Mails2']);
  });

  it('Reihenfolge im Rumpf: Stand, Kennzahlen, Notiz, Verlauf; die Karten in der Seitenspalte', async () => {
    await oeffnen();
    const rumpf = lesen().querySelector('.web-lesen__inhalt > .web-detail')!;
    expect(rumpf.firstElementChild).toBe(stand());
    expect(rumpf.children[1].className).toContain('web-detail__kennzahlen');
    const hauptspalte = rumpf.querySelector('.web-spalten__haupt')!;
    expect(hauptspalte.firstElementChild!.className).toContain('web-notiz');
    expect(within(hauptspalte as HTMLElement).getByRole('region', { name: 'Verlauf' })).toBeInTheDocument();
    expect(rumpf.querySelector('.web-spalten__seite .web-vorgang-karten')).not.toBeNull();
    // Kein Akkordeon mehr.
    expect(screen.queryByRole('button', { name: /Gemeinde, Anfrage und Notiz/ })).toBeNull();
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
    expect(within(mails()[0]).getByText('Neu')).toBeInTheDocument();
    // Flach (11.10.2026): eine Zahl für den ganzen Verlauf, das Anliegen aus dem Formular zählt mit.
    expect(screen.getByText('4 Nachrichten, 2 neu')).toBeInTheDocument();
  });

  it('das Anliegen steht vorn, mit Name und Zeit -- die Adresse steht in der Karte „Kontakt", nicht noch einmal hier', async () => {
    await oeffnen();
    const anliegen = screen.getByRole('region', { name: 'Anliegen aus dem Formular' });
    expect(within(anliegen).getByText('Seit gestern erscheint im Chat nichts Neues.')).toBeInTheDocument();
    expect(within(anliegen).getByText('Pastorin Lena Probe')).toBeInTheDocument();
    expect(anliegen).not.toHaveTextContent('lena.probe@example.org');
    expect(anliegen.querySelector('time')).toHaveAttribute('title', '03.10.2026, 09:00');
  });

  it('ohne Text aus dem Formular kein Anliegen -- der Verlauf beginnt mit der ersten Mail', async () => {
    server.stand.vorgaenge[0].beschreibung = null;
    await oeffnen();
    expect(screen.queryByRole('region', { name: 'Anliegen aus dem Formular' })).toBeNull();
    expect(document.querySelector('ol.mail-verlauf')!.firstElementChild).toBe(mails()[0]);
    expect(screen.getByText('3 Nachrichten, 2 neu')).toBeInTheDocument();
  });

  it('ohne Namen nennt der Anfang die Adresse', async () => {
    server.stand.vorgaenge[1].kontakt_name = null;
    await oeffnen(2, /Jahrgang/);
    expect(screen.getByRole('region', { name: 'Anliegen aus dem Formular' })).toHaveTextContent('anna@example.org');
  });

  it('die Anfrage-Nachricht heißt „Nachricht aus der Anfrage“', async () => {
    await oeffnen(3, /Lindenau/);
    const nachricht = screen.getByRole('region', { name: 'Nachricht aus der Anfrage' });
    expect(within(nachricht).getByText('Wir starten im November.')).toBeInTheDocument();
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
    expect(mails()[1].querySelector('.mail-zeile__unten')).toHaveTextContent('An lena.probe@example.org · von support@');
  });

  it('„Alle aufklappen“ klappt jede Mail auf, „Alle einklappen“ stellt das Bild beim Öffnen wieder her', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Alle aufklappen' }));
    expect(mails().map((m) => mailKopf(m).getAttribute('aria-expanded'))).toEqual(['true', 'true', 'true']);
    fireEvent.click(screen.getByRole('button', { name: 'Alle einklappen' }));
    expect(mails().map((m) => mailKopf(m).getAttribute('aria-expanded'))).toEqual(['true', 'false', 'true']);
  });

  it('ein Vorgang ohne Mails und ohne Anliegen sagt das', async () => {
    await oeffnen(5, /Intern notiert/);
    expect(screen.getByText('Noch keine Mails in diesem Vorgang.')).toBeInTheDocument();
  });

  it('nur ein Anliegen, keine Mails: das Anliegen steht da, die Antwortzeile direkt darunter', async () => {
    await oeffnen(2, /Jahrgang/);
    const anliegen = screen.getByRole('region', { name: 'Anliegen aus dem Formular' });
    expect(anliegen).toHaveTextContent('Wir sind neu dabei.');
    expect(mails()).toHaveLength(0);
    expect(antwortzeile().closest('li')!.previousElementSibling).toBe(anliegen.closest('li'));
  });
});

describe('Vorgang (Web): Menü an einer Mail', () => {
  const menue = (m: HTMLElement) => {
    fireEvent.click(within(m).getByRole('button', { name: /^Aktionen zur Mail von / }));
    return within(m).getByRole('menu');
  };

  it('an jeder offenen Mail: verschieben und herauslösen', async () => {
    await oeffnen();
    const liste = menue(mails()[2]);
    expect(within(liste).getAllByRole('menuitem').map((p) => p.textContent)).toEqual([
      'In anderen Vorgang verschieben', 'In neuen Vorgang herauslösen', 'Kopfzeilen zeigen',
    ]);
  });

  it('verschieben: der eigene Vorgang steht nicht zur Wahl, nur diese Mail geht -- danach fehlt sie im Verlauf', async () => {
    await oeffnen();
    fireEvent.click(within(menue(mails()[2])).getByRole('menuitem', { name: 'In anderen Vorgang verschieben' }));
    const d = dialog('In anderen Vorgang verschieben');
    // Der Betreff als Kern wie im Kopf (roh: „Re: Chat zeigt nichts Neues [Vorgang 1]").
    expect(d).toHaveAccessibleDescription('„Chat zeigt nichts Neues“ – Nur diese Mail wird verschoben; der Rest des Vorgangs bleibt, wo er ist.');
    // Keine Wahl „bestehend/neu" -- die Handlung ist schon gewählt.
    expect(within(d).queryByRole('radiogroup')).toBeNull();
    await waitFor(() => expect(within(d).getAllByRole('radio').length).toBeGreaterThan(0));
    expect(within(d).queryByRole('radio', { name: /Chat zeigt nichts Neues/ })).toBeNull();
    fireEvent.click(within(d).getByRole('radio', { name: /Wie lege ich einen Jahrgang an\?/ }));
    await act(async () => { fireEvent.click(within(d).getByRole('button', { name: 'Verschieben' })); });
    expect(server.aufrufe('post', /einsortieren$/).map((a) => [a.pfad, a.koerper])).toEqual([
      ['/support/mail/nachrichten/13/einsortieren', { vorgang_id: 2 }],
    ]);
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(absender()).toEqual(['Pastorin Lena Probe', 'Support']));
  });

  it('herauslösen: ein neuer Vorgang aus dieser einen Mail', async () => {
    await oeffnen();
    fireEvent.click(within(menue(mails()[2])).getByRole('menuitem', { name: 'In neuen Vorgang herauslösen' }));
    const d = dialog('In neuen Vorgang herauslösen');
    fireEvent.change(auswahl('Art', d), { target: { value: 'sonstiges' } });
    await act(async () => { fireEvent.click(within(d).getByRole('button', { name: 'Herauslösen' })); });
    const [aufruf] = server.aufrufe('post', /einsortieren$/);
    expect(aufruf.pfad).toBe('/support/mail/nachrichten/13/einsortieren');
    expect(aufruf.koerper).toMatchObject({ neu: { art: 'sonstiges' } });
    await waitFor(() => expect(mails()).toHaveLength(2));
  });

  it('Abbrechen verschiebt nichts', async () => {
    await oeffnen();
    fireEvent.click(within(menue(mails()[2])).getByRole('menuitem', { name: 'In anderen Vorgang verschieben' }));
    fireEvent.click(within(dialog('In anderen Vorgang verschieben')).getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(server.aufrufe('post', /einsortieren$/)).toHaveLength(0);
  });

  // Beim Öffnen des Dialogs ist der Menüpunkt schon fort; der Dialog kehrt zu dem zurück, was beim
  // Öffnen den Fokus hatte. Bis 12.10.2026 war das <body> -- wer nur mit der Tastatur arbeitet,
  // verlor seine Stelle im Verlauf.
  it('nach dem Dialog steht der Fokus wieder auf dem Menüknopf der Mail -- nach Abbrechen wie nach Escape', async () => {
    await oeffnen();
    const m = mails()[2];
    const knopf = within(m).getByRole('button', { name: /^Aktionen zur Mail von / });
    menue(m);
    fireEvent.click(within(m).getByRole('menuitem', { name: 'In anderen Vorgang verschieben' }));
    fireEvent.click(within(dialog('In anderen Vorgang verschieben')).getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(knopf);

    menue(m);
    fireEvent.click(within(m).getByRole('menuitem', { name: 'In neuen Vorgang herauslösen' }));
    const d = dialog('In neuen Vorgang herauslösen');
    fireEvent.keyDown(d.contains(document.activeElement) ? document.activeElement as HTMLElement : d, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(knopf);
  });
});

describe('Vorgang (Web): Lese-Rahmen der Liste', () => {
  const imRahmen = async (teil: Partial<LeseRahmen>, id = 1, onGeloescht = vi.fn()) => {
    const rahmen: LeseRahmen = { ...LESE_RAHMEN_NEUTRAL, abgeschlossen: vi.fn(), ...teil };
    render(<LeseRahmenProvider wert={rahmen}><WebVorgangDetail vorgangId={id} onGeloescht={onGeloescht} /></LeseRahmenProvider>);
    await bereit();
    return { rahmen, onGeloescht };
  };

  it('Erledigt meldet den Abschluss -- die Liste öffnet den nächsten Eintrag (Frage 6)', async () => {
    const { rahmen } = await imRahmen({});
    await act(async () => { fireEvent.click(within(kopf()).getByRole('button', { name: 'Erledigt' })); });
    await waitFor(() => expect(rahmen.abgeschlossen).toHaveBeenCalledWith(1));
    expect(rahmen.abgeschlossen).toHaveBeenCalledTimes(1);
  });

  it('Archivieren meldet den Abschluss ebenso', async () => {
    const { rahmen } = await imRahmen({});
    await act(async () => { fireEvent.click(within(kopf()).getByRole('button', { name: 'Archivieren' })); });
    await waitFor(() => expect(rahmen.abgeschlossen).toHaveBeenCalledWith(1));
  });

  it('Löschen im Rahmen: der Rahmen öffnet den nächsten, onGeloescht leert den Lesebereich nicht dazwischen', async () => {
    const { rahmen, onGeloescht } = await imRahmen({});
    fireEvent.click(within(kopf()).getByRole('button', { name: 'Löschen' }));
    await bestaetigen('Löschen');
    await waitFor(() => expect(rahmen.abgeschlossen).toHaveBeenCalledWith(1));
    expect(onGeloescht).not.toHaveBeenCalled();
  });

  it('ohne Rahmen leert onGeloescht den Lesebereich', async () => {
    const onGeloescht = vi.fn();
    render(<WebVorgangDetail vorgangId={1} onGeloescht={onGeloescht} />);
    await bereit();
    fireEvent.click(within(kopf()).getByRole('button', { name: 'Löschen' }));
    await bestaetigen('Löschen');
    await waitFor(() => expect(onGeloescht).toHaveBeenCalledTimes(1));
  });

  // Ein Abschluss öffnet den nächsten Eintrag, und der Lesebereich entsteht neu: Was im Editor
  // oder in der Notiz steht, ginge verloren. In der App fragt das Antwort-Fenster vor dem
  // Schließen; im Browser fragt der Abschluss.
  it('ein getippter Entwurf der Antwort: „Erledigt" fragt erst; „Abbrechen" lässt Entwurf, Status und Eintrag stehen', async () => {
    const { rahmen } = await imRahmen({});
    fireEvent.click(antwortzeile());
    fireEvent.change(text(), { target: { value: 'Lange Antwort, noch nicht gesendet' } });
    await act(async () => { fireEvent.click(within(kopf()).getByRole('button', { name: 'Erledigt' })); });
    expect(h.alert).toMatchObject({ header: 'Ungespeicherte Änderungen', message: 'Die Antwort ist noch nicht gesendet. Möchtest du sie verwerfen?' });
    expect(h.alert?.buttons?.map((b) => b.text)).toEqual(['Abbrechen', 'Verwerfen']);
    expect(patches()).toEqual([]);
    await bestaetigen('Abbrechen');
    expect(patches()).toEqual([]);
    expect(rahmen.abgeschlossen).not.toHaveBeenCalled();
    expect(text().value).toBe('Lange Antwort, noch nicht gesendet');
  });

  it('„Verwerfen": dann erst Erledigt, und der Rahmen öffnet den nächsten Eintrag', async () => {
    const { rahmen } = await imRahmen({});
    fireEvent.click(antwortzeile());
    fireEvent.change(text(), { target: { value: 'Doch nicht' } });
    await act(async () => { fireEvent.click(within(kopf()).getByRole('button', { name: 'Erledigt' })); });
    await bestaetigen('Verwerfen');
    await waitFor(() => expect(rahmen.abgeschlossen).toHaveBeenCalledWith(1));
    expect(patches().map((a) => a.koerper)).toEqual([{ status: 'erledigt' }]);
  });

  it('eine Notiz in Bearbeitung: „Archivieren" fragt ebenso; ein offener, leerer Editor nicht', async () => {
    const { rahmen } = await imRahmen({});
    fireEvent.click(screen.getByRole('button', { name: 'Interne Notiz' }));
    fireEvent.change(screen.getByLabelText('Interne Notiz (nur für den Support)'), { target: { value: 'Rückruf am Montag' } });
    await act(async () => { fireEvent.click(within(kopf()).getByRole('button', { name: 'Archivieren' })); });
    expect(h.alert?.message).toBe('Die Notiz ist noch nicht gespeichert. Möchtest du sie verwerfen?');
    await bestaetigen('Abbrechen');
    expect(server.aufrufe('post', '/support/vorgaenge/1/archivieren')).toEqual([]);
    expect(rahmen.abgeschlossen).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    h.alert = null;
    fireEvent.click(antwortzeile());
    await act(async () => { fireEvent.click(within(kopf()).getByRole('button', { name: 'Archivieren' })); });
    expect(h.alert).toBeNull();
    await waitFor(() => expect(rahmen.abgeschlossen).toHaveBeenCalledWith(1));
  });

  it('Ablehnen mit Entwurf (etwa einer Absage): erst die Frage zum Entwurf, dann die zum Ablehnen', async () => {
    const { rahmen } = await imRahmen({}, 3);
    fireEvent.click(antwortzeile());
    fireEvent.change(text(), { target: { value: 'Leider können wir …' } });
    fireEvent.click(within(kopf()).getByRole('button', { name: 'Ablehnen' }));
    expect(h.alert?.header).toBe('Ungespeicherte Änderungen');
    await bestaetigen('Verwerfen');
    expect(h.alert?.header).toBe('Anfrage ablehnen?');
    await bestaetigen('Ablehnen');
    await waitFor(() => expect(rahmen.abgeschlossen).toHaveBeenCalledWith(3));
  });

  it('ohne Rahmen bleibt der Vorgang stehen -- dann ist nichts verloren, und es gibt keine Frage', async () => {
    await allein();
    fireEvent.click(antwortzeile());
    fireEvent.change(text(), { target: { value: 'Bleibt stehen' } });
    await act(async () => { fireEvent.click(within(kopf()).getByRole('button', { name: 'Erledigt' })); });
    expect(h.alert).toBeNull();
    expect(patches().map((a) => a.koerper)).toEqual([{ status: 'erledigt' }]);
    expect(text().value).toBe('Bleibt stehen');
  });

  it('?mail= hebt eine Mail hervor: sie ist aufgeklappt und markiert, auch wenn sie sonst zu wäre', async () => {
    await imRahmen({ hervorheben: 12 });
    const mitte = mails()[1];
    expect(mailKopf(mitte)).toHaveAttribute('aria-expanded', 'true');
    expect(mitte.className).toContain('mail-zeile--hervorgehoben');
    expect(mails().filter((m) => m.className.includes('mail-zeile--hervorgehoben'))).toHaveLength(1);
  });
});

describe('Vorgang (Web): Einordnen im Dialog', () => {
  it('der Dialog zeigt den Stand: Betreff, Status, Dringlichkeit, Art, Bereich und Gemeinde', async () => {
    await oeffnen();
    einordnen();
    expect(feld('Betreff', dialog()).value).toBe('Chat zeigt nichts Neues');
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
    // Status und Dringlichkeit, Art und Bereich je zu zweit; die Gemeinde über die ganze Breite.
    const paare = [...dialog().querySelectorAll('.web-feldpaar')].map((p) => [...p.querySelectorAll('select')].map((s) => s.labels[0].textContent));
    expect(paare).toEqual([['Status', 'Dringlichkeit'], ['Art', 'Bereich']]);
    expect(auswahl('Gemeinde').closest('.web-feldpaar')).toBeNull();
    expect(feld('Betreff', dialog()).closest('.web-feldpaar')).toBeNull();
  });

  it('Ändern speichert noch nichts; „Speichern“ schickt einen Aufruf mit genau den geänderten Feldern und schließt', async () => {
    await oeffnen();
    einordnen();
    fireEvent.change(feld('Betreff', dialog()), { target: { value: '  Chat   bleibt leer ' } });
    fireEvent.change(auswahl('Art'), { target: { value: 'wunsch' } });
    fireEvent.change(auswahl('Bereich'), { target: { value: 'termine' } });
    fireEvent.change(auswahl('Dringlichkeit'), { target: { value: 'normal' } });
    fireEvent.change(auswahl('Status'), { target: { value: 'wartet' } });
    fireEvent.change(auswahl('Gemeinde'), { target: { value: '8' } });
    expect(patches()).toHaveLength(0);
    await speichern();
    expect(patches().map((p) => [p.pfad, p.koerper])).toEqual([
      ['/support/vorgaenge/1', { status: 'wartet', art: 'wunsch', bereich: 'termine', dringlichkeit: 'normal', organization_id: 8, betreff: 'Chat bleibt leer' }],
    ]);
    expect(h.setSuccess).toHaveBeenCalledWith('Gespeichert');
    expect(screen.queryByRole('dialog')).toBeNull();
    // Der Server hat es: nach dem Neuladen steht es im Kopf.
    await waitFor(() => expect(teile(kennzeichen())).toEqual(['Nr. 1', 'Wartet', 'Wunsch › Events', 'Kirchengemeinde Wiesengrund']));
    expect(within(lesen()).getByRole('heading', { level: 2, name: 'Chat bleibt leer' })).toBeInTheDocument();
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
    await waitFor(() => expect(teile(kennzeichen())).toEqual(['Nr. 1', 'Neu', 'Dringend', 'Sonstiges', 'Keine Gemeinde']));
  });

  it('Frage, Fehler und Wunsch ohne Bereich: Meldung im Dialog, nichts geht raus', async () => {
    await oeffnen();
    einordnen();
    fireEvent.change(auswahl('Bereich'), { target: { value: '' } });
    await speichern();
    expect(within(dialog()).getByRole('alert')).toHaveTextContent('Bitte einen Bereich wählen');
    expect(patches()).toHaveLength(0);
  });

  it('ein leerer Betreff: Meldung im Dialog, nichts geht raus', async () => {
    await oeffnen();
    einordnen();
    fireEvent.change(feld('Betreff', dialog()), { target: { value: '   ' } });
    await speichern();
    expect(within(dialog()).getByRole('alert')).toHaveTextContent('Bitte einen Betreff eingeben');
    expect(patches()).toHaveLength(0);
  });

  it('Status „Erledigt“: der Hinweis steht beim Auswählen da; danach liegt der Vorgang im Archiv', async () => {
    await allein();
    einordnen();
    expect(auswahl('Status')).not.toHaveAccessibleDescription();
    fireEvent.change(auswahl('Status'), { target: { value: 'erledigt' } });
    expect(auswahl('Status')).toHaveAccessibleDescription('Erledigte Vorgänge liegen im Archiv. Eine neue Mail holt den Vorgang zurück.');
    await speichern();
    expect(patches()[0].koerper).toEqual({ status: 'erledigt' });
    expect(h.setSuccess).toHaveBeenCalledWith('Vorgang erledigt und ins Archiv gelegt');
    await waitFor(() => expect(stand()).toHaveTextContent('Erledigt am 03.10.2026. Eine neue Mail holt ihn zurück.'));
    expect(within(kopf()).getByRole('button', { name: 'Wiederherstellen' })).toBeInTheDocument();
    expect(within(kopf()).queryByRole('button', { name: 'Archivieren' })).toBeNull();
  });

  it('bei einer Anfrage sagt der Hinweis zu „Erledigt", dass sie damit abgelehnt wird', async () => {
    await oeffnen(3, /Lindenau/);
    einordnen();
    fireEvent.change(auswahl('Status'), { target: { value: 'erledigt' } });
    expect(auswahl('Status')).toHaveAccessibleDescription('Erledigt lehnt die Anfrage ab; sie wird nach 180 Tagen gelöscht.');
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
    await waitFor(() => expect(teile(kennzeichen())).toContain('Fehler › Chat'));
  });

  it('ohne Netz lässt sich der Dialog nicht öffnen', async () => {
    h.online = false;
    await oeffnen();
    expect(within(kopf()).getByRole('button', { name: 'Einordnen' })).toBeDisabled();
  });
});

describe('Vorgang (Web): Angaben als Karten', () => {
  it('offene Karten statt eines Akkordeons: Kontakt, dann die Gemeinde -- jede Angabe einmal', async () => {
    await oeffnen();
    expect(kartenTitel()).toEqual(['Kontakt', 'Kirchengemeinde Musterdorf']);
    const kontakt = karte('Kontakt');
    expect(zeile(kontakt, 'Person')).toHaveTextContent('Pastorin Lena Probe (Gemeindeleitung)');
    const adresse = within(zeile(kontakt, 'E-Mail')).getByRole('link', { name: 'lena.probe@example.org' });
    expect(adresse).toHaveAttribute('href', 'mailto:lena.probe@example.org');
    // Eine lange Adresse bricht vor dem @ und vor Punkten um, nicht mitten im Wort.
    expect(umbruchStellen(adresse)).toBe('lena|.probe|@example|.org');
    expect(zeile(kontakt, 'Eingang')).toHaveTextContent('Support-Formular auf der Homepage');
    expect(zeile(kontakt, 'Gemeinde')).toBeUndefined();
  });

  it('die Gemeinde: Laufzeit, Konfis, Kreis, die Leitung mit Adresse und letzter Anmeldung; „Gemeinde öffnen" im Kopf der Karte', async () => {
    await oeffnen();
    const gemeinde = karte('Kirchengemeinde Musterdorf');
    expect(within(gemeinde).getByRole('link', { name: 'Gemeinde öffnen' })).toHaveAttribute('href', '/admin/organizations?gemeinde=7');
    expect(within(gemeinde).getByRole('link', { name: 'Alle Vorgänge' })).toHaveAttribute('href', '/admin/support/vorgaenge?gemeinde=7');
    expect(zeile(gemeinde, 'Laufzeit')).toHaveTextContent('Testphase bis 02.11.');
    expect(zeile(gemeinde, 'Konfis')).toHaveTextContent('3 von 5');
    expect(zeile(gemeinde, 'Kreis')).toHaveTextContent('Dithmarschen › Nordkirche');
    expect(within(gemeinde).getByRole('heading', { level: 4, name: 'Gemeindeleitung (1)' })).toBeInTheDocument();
    const leitung = within(gemeinde).getByRole('list', { name: 'Gemeindeleitung' });
    expect(within(leitung).getByText('Pastorin Lena Probe')).toBeInTheDocument();
    const adresse = within(leitung).getByRole('link', { name: 'lena.probe@example.org' });
    expect(adresse).toHaveAttribute('href', 'mailto:lena.probe@example.org');
    expect(umbruchStellen(adresse)).toBe('lena|.probe|@example|.org');
    expect(leitung).toHaveTextContent('zuletzt angemeldet 02.10.2026');
  });

  it('eine Leitung ohne Adresse und ohne Anmeldung sagt das; eine gesperrte trägt eine Marke', async () => {
    const vorher = LEITUNG[7];
    LEITUNG[7] = [{ id: 22, display_name: 'Sam Muster', username: 'sam.muster', email: null, is_active: false, last_login_at: null }];
    try {
      await oeffnen();
      const leitung = screen.getByRole('list', { name: 'Gemeindeleitung' });
      expect(leitung).toHaveTextContent('Keine E-Mail');
      expect(leitung).toHaveTextContent('noch nicht angemeldet');
      expect(within(leitung).getByText('Gesperrt')).toBeInTheDocument();
      expect(within(leitung).queryByRole('button', { name: /^Im Vorgang antworten/ })).toBeNull();
    } finally {
      LEITUNG[7] = vorher;
    }
  });

  it('ohne Gemeinde: die Angabe aus dem Formular steht in „Kontakt", „Zuordnen" öffnet Einordnen; keine Karte der Gemeinde', async () => {
    await oeffnen(2, /Jahrgang/);
    expect(kartenTitel()).toEqual(['Kontakt']);
    const zuordnung = zeile(karte('Kontakt'), 'Gemeinde');
    expect(zuordnung).toHaveTextContent('Nicht zugeordnet – laut Formular: Kirchengemeinde Heide');
    fireEvent.click(within(zuordnung).getByRole('button', { name: 'Zuordnen' }));
    expect(auswahl('Gemeinde').value).toBe('');
  });

  it('die Gemeinde zuordnen: die Zeile verschwindet, die Karte der Gemeinde mit Leitung steht da', async () => {
    await oeffnen(2, /Jahrgang/);
    einordnen();
    fireEvent.change(auswahl('Bereich'), { target: { value: 'konfis' } });
    await waitFor(() => expect(auswahl('Gemeinde').options.length).toBe(3));
    fireEvent.change(auswahl('Gemeinde'), { target: { value: '7' } });
    await speichern();
    expect(patches()[0].koerper).toEqual({ bereich: 'konfis', organization_id: 7 });
    await waitFor(() => expect(kartenTitel()).toEqual(['Kontakt', 'Kirchengemeinde Musterdorf']));
    expect(zeile(karte('Kontakt'), 'Gemeinde')).toBeUndefined();
    expect(screen.getByRole('list', { name: 'Gemeindeleitung' })).toHaveTextContent('Pastorin Lena Probe');
  });

  it('eine Anfrage: Karte „Anfrage" vor „Kontakt" -- Gemeinde laut Anfrage, Kreis in der Struktur, Wunsch mit Preis; Mobil als Verweis', async () => {
    await oeffnen(3, /Lindenau/);
    expect(kartenTitel()).toEqual(['Anfrage', 'Kontakt']);
    const anfrage = karte('Anfrage');
    expect(zeile(anfrage, 'Gemeinde')).toHaveTextContent('Kirchengemeinde Lindenau (angefragt)');
    await waitFor(() => expect(zeile(anfrage, 'Kreis')).toHaveTextContent('Dithmarschen › Nordkirche · steht in der Struktur'));
    expect(zeile(anfrage, 'Wunsch')).toHaveTextContent('Standard — bis 50 Konfis · 99 € pro Jahr');
    expect(zeile(anfrage, 'Eingang')).toHaveTextContent('Anfrage über die Homepage');
    const kontakt = karte('Kontakt');
    expect(zeile(kontakt, 'Person')).toHaveTextContent('Anna Beispiel (Pastorin)');
    expect(within(zeile(kontakt, 'Mobil')).getByRole('link', { name: '0170 1234567' })).toHaveAttribute('href', 'tel:01701234567');
    // Der Eingang steht nur in „Anfrage".
    expect(zeile(kontakt, 'Eingang')).toBeUndefined();
  });

  it('Kirchenkreis noch nicht in der Struktur: „Als Kirchenkreis anlegen" an der Zeile legt ihn an', async () => {
    server.stand.vorgaenge[2].anfrage = { ...ANFRAGE_41, kirchenkreis: 'Steinburg' };
    await oeffnen(3, /Lindenau/);
    const kreis = await waitFor(() => {
      const z = zeile(karte('Anfrage'), 'Kreis');
      expect(z).toHaveTextContent('Steinburg › Nordkirche · fehlt noch');
      return z;
    });
    await act(async () => { fireEvent.click(within(kreis).getByRole('button', { name: 'Als Kirchenkreis anlegen' })); });
    expect(server.aufrufe('post', '/support/kirchenkreise')[0].koerper).toEqual({ name: 'Steinburg', landeskirche_id: 1 });
  });

  it('eine noch leere Struktur: auch dann fehlt der Kirchenkreis -- „Als Kirchenkreis anlegen" steht an der Zeile', async () => {
    const alt = h.apiGet.getMockImplementation()!;
    h.apiGet.mockImplementation((pfad: string, o?: unknown) => (pfad === '/support/kirchenkreise' ? Promise.resolve({ data: [] }) : alt(pfad, o as never)));
    await oeffnen(3, /Lindenau/);
    const kreis = await waitFor(() => {
      const z = zeile(karte('Anfrage'), 'Kreis');
      expect(z).toHaveTextContent('Dithmarschen › Nordkirche · fehlt noch');
      return z;
    });
    expect(within(kreis).getByRole('button', { name: 'Als Kirchenkreis anlegen' })).toBeInTheDocument();
  });

  it('„Im Vorgang antworten" an einer Adresse öffnet den Editor mit ihr als Empfänger', async () => {
    server.stand.vorgaenge[0].kontakt_email = 'sekretariat@example.org';
    server.stand.vorgaenge[0].kontakt_name = 'Das Sekretariat';
    await oeffnen();
    fireEvent.click(within(zeile(karte('Kontakt'), 'E-Mail')).getByRole('button', { name: 'Im Vorgang antworten an sekretariat@example.org' }));
    await waitFor(() => expect(an().value).toBe('sekretariat@example.org'));
    expect(editor()).toBeInTheDocument();
  });

  it('jedes „Im Vorgang antworten" sagt im Namen, an wen -- Vorleseprogramme unterscheiden sie; sichtbar bleibt der kurze Text', async () => {
    const zweite = { id: 22, display_name: 'Pastor Tim Probe', username: 'tim.probe', email: 'tim.probe@example.org', is_active: true, last_login_at: null };
    LEITUNG[7].push(zweite);
    try {
      await oeffnen();
      const knoepfe = screen.getAllByRole('button', { name: /^Im Vorgang antworten/ });
      expect(knoepfe.map((k) => k.getAttribute('aria-label'))).toEqual([
        'Im Vorgang antworten an lena.probe@example.org',
        'Im Vorgang antworten an Pastorin Lena Probe',
        'Im Vorgang antworten an Pastor Tim Probe',
      ]);
      expect(knoepfe.map((k) => k.textContent)).toEqual(['Im Vorgang antworten', 'Im Vorgang antworten', 'Im Vorgang antworten']);
      fireEvent.click(knoepfe[2]);
      await waitFor(() => expect(an().value).toBe('tim.probe@example.org'));
    } finally {
      LEITUNG[7].splice(LEITUNG[7].indexOf(zweite), 1);
    }
  });
});

describe('Vorgang (Web): Antworten', () => {
  it('unter der jüngsten Mail steht die Antwortzeile mit Name und Postfach; ein Klick öffnet den Editor an derselben Stelle', async () => {
    await oeffnen();
    expect(antwortzeile()).toHaveTextContent('Antwort an Pastorin Lena Probe schreiben …von support@');
    const juengste = mails()[2];
    expect(antwortzeile().closest('li')!.previousElementSibling).toBe(juengste);
    fireEvent.click(antwortzeile());
    expect(editor().closest('li')!.previousElementSibling).toBe(juengste);
    expect(antwortzeile()).toBeNull();
    fireEvent.click(within(editor()).getByRole('button', { name: 'Verwerfen' }));
    expect(screen.queryByRole('region', { name: 'Antwort schreiben' })).toBeNull();
    expect(antwortzeile()).not.toBeNull();
  });

  it('Fokus: die Antwortzeile öffnet den Editor mit dem Fokus im Text; „Verwerfen" gibt ihn an die Antwortzeile zurück', async () => {
    await oeffnen();
    antwortzeile().focus();
    fireEvent.click(antwortzeile());
    expect(text()).toHaveFocus();
    const verwerfen = within(editor()).getByRole('button', { name: 'Verwerfen' });
    verwerfen.focus();
    fireEvent.click(verwerfen);
    expect(antwortzeile()).toHaveFocus();
  });

  it('Fokus: „Antworten" im Kopf und „Im Vorgang antworten" setzen ihn ebenso in den Text der Antwort', async () => {
    await oeffnen();
    antworten();
    expect(text()).toHaveFocus();
    fireEvent.click(within(editor()).getByRole('button', { name: 'Verwerfen' }));
    fireEvent.click(within(zeile(karte('Kontakt'), 'E-Mail')).getByRole('button', { name: /^Im Vorgang antworten/ }));
    expect(text()).toHaveFocus();
  });

  it('Fokus: nach dem Senden steht er wieder auf der Antwortzeile -- auch wenn sie unter der neuen Mail neu entsteht', async () => {
    await oeffnen();
    antworten();
    await waitFor(() => expect(editor().querySelector('p.web-antwort__an')).not.toBeNull());
    fireEvent.change(text(), { target: { value: 'Danke.' } });
    const senden = screen.getByRole('button', { name: 'Antwort senden' });
    senden.focus();
    fireEvent.click(senden);
    await bestaetigen('Senden');
    await waitFor(() => expect(mails()).toHaveLength(4));
    expect(antwortzeile().closest('li')!.previousElementSibling).toBe(mails()[3]);
    expect(antwortzeile()).toHaveFocus();
  });

  it('Fokus: hält die Rückfrage (Ionic-Alert) ihn beim Schließen noch fest, kommt er danach an die Antwortzeile zurück', async () => {
    await oeffnen();
    antworten();
    await waitFor(() => expect(editor().querySelector('p.web-antwort__an')).not.toBeNull());
    fireEvent.change(text(), { target: { value: 'Danke.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Antwort senden' }));
    await bestaetigen('Senden');
    await waitFor(() => expect(mails()).toHaveLength(4));
    // Wie der echte Alert bei schneller Antwort des Servers: Er schließt sich noch, sein Fokusfang zieht den Fokus
    // zu sich; dann meldet er „geschlossen" und verschwindet -- der Fokus stünde auf <body>.
    const alert = document.createElement('ion-alert');
    const knopf = document.createElement('button');
    alert.append(knopf);
    document.body.append(alert);
    knopf.focus();
    expect(knopf).toHaveFocus();
    alert.dispatchEvent(new CustomEvent('ionAlertDidDismiss', { bubbles: true }));
    alert.remove();
    await waitFor(() => expect(antwortzeile()).toHaveFocus());
  });

  it('Fokus: wer danach woanders hinklickt, behält seinen Platz -- eine neue Mail holt den Fokus nicht zurück', async () => {
    await oeffnen();
    antworten();
    fireEvent.click(within(editor()).getByRole('button', { name: 'Verwerfen' }));
    expect(antwortzeile()).toHaveFocus();
    const notiz = screen.getByRole('button', { name: 'Interne Notiz' });
    fireEvent.pointerDown(notiz);
    notiz.focus();
    (document.activeElement as HTMLElement).blur();
    server.stand.mails.push(mail(14, 1, { betreff: 'Re: Chat zeigt nichts Neues [Vorgang 1]', text: 'Noch etwas.', gesendet_am: '2026-10-03T08:45:00Z' }));
    await act(async () => { meldeSupportGeaendert(); });
    await waitFor(() => expect(mails()).toHaveLength(4));
    expect(document.activeElement).toBe(document.body);
  });

  it('der Editor rollt nur so weit, dass sein Ende im Bild ist (block: end) -- auch über „Antworten" im Kopf', async () => {
    await oeffnen();
    rollen.mockClear();
    antworten();
    const aufrufe = rollen.mock.contexts.map((el, i) => [el, rollen.mock.calls[i][0]]);
    expect(aufrufe).toContainEqual([editor(), { block: 'end' }]);
    expect(rollen.mock.calls.every(([o]) => (o as ScrollIntoViewOptions).block !== 'start')).toBe(true);
  });

  it('mehrere Adressen: „An" mit lesbarem Etikett, vorgewählt ist, wer zuletzt schrieb; das Postfach daneben', async () => {
    server.stand.vorgaenge[0].kontakt_email = 'sekretariat@example.org';
    server.stand.vorgaenge[0].kontakt_name = 'Das Sekretariat';
    await oeffnen();
    antworten();
    await waitFor(() => expect(an().options.length).toBe(3));
    expect(optionen(an())).toEqual([
      'Bitte wählen',
      'Pastorin Lena Probe <lena.probe@example.org> · schrieb uns',
      'Das Sekretariat <sekretariat@example.org> · Kontakt aus dem Formular',
    ]);
    expect(an().value).toBe('lena.probe@example.org');
    expect(editor().querySelector('.web-antwort__von')).toHaveTextContent('von support@');
    expect(server.aufrufe('get', /\/empfaenger$/)).toEqual([]);
  });

  it('genau eine Adresse: eine feste Zeile „An: … · von …"', async () => {
    await oeffnen();
    antworten();
    const zeileAn = await waitFor(() => {
      const p = editor().querySelector('p.web-antwort__an');
      expect(p).not.toBeNull();
      return p as HTMLElement;
    });
    expect(zeileAn).toHaveTextContent('An: Pastorin Lena Probe <lena.probe@example.org> · schrieb uns · von support@');
    expect(screen.queryByRole('combobox', { name: 'An' })).toBeNull();
  });

  it('Senden mit Rückfrage; Körper mit Betreff, Text und Adresse; danach „Danach" (Vorgabe Wartet), der Editor schließt, die Mail steht im Verlauf', async () => {
    server.stand.vorgaenge[0].kontakt_email = 'sekretariat@example.org';
    await oeffnen();
    antworten();
    await waitFor(() => expect(an().options.length).toBe(3));
    // Der Betreff ist eine feste Zeile; der Vorschlag trägt die Nummer nicht -- sie hängt der Server an.
    expect(feld('Betreff', editor()).value).toBe('Re: Chat zeigt nichts Neues');
    expect(feld('Betreff', editor())).toHaveAttribute('readonly');
    expect((within(editor()).getByRole('combobox', { name: 'Danach' }) as HTMLSelectElement).value).toBe('wartet');
    expect(optionen(within(editor()).getByRole('combobox', { name: 'Danach' }) as HTMLSelectElement)).toEqual(['Wartet auf Rückmeldung', 'In Arbeit', 'Erledigt']);
    fireEvent.change(text(), { target: { value: 'Danke für die Rückmeldung.\n\n' } });
    fireEvent.click(screen.getByRole('button', { name: 'Antwort senden' }));
    expect(h.alert?.header).toBe('Antwort senden');
    expect(server.aufrufe('post', /antworten$/)).toHaveLength(0);

    await bestaetigen('Senden');
    expect(server.aufrufe('post', '/support/vorgaenge/1/antworten')[0].koerper).toEqual({
      text: 'Danke für die Rückmeldung.', betreff: 'Re: Chat zeigt nichts Neues', an: 'lena.probe@example.org',
    });
    expect(h.setSuccess).toHaveBeenCalledWith('Antwort gesendet');
    await waitFor(() => expect(server.aufrufe('patch', '/support/vorgaenge/1').map((a) => a.koerper)).toEqual([{ status: 'wartet' }]));
    expect(screen.queryByRole('region', { name: 'Antwort schreiben' })).toBeNull();
    await waitFor(() => expect(mails()).toHaveLength(4));
    expect(mailKopf(mails()[3])).toHaveAttribute('aria-expanded', 'true');
  });

  it('„Danach: Erledigt" legt den Vorgang nach dem Senden ins Archiv', async () => {
    await allein();
    antworten();
    await waitFor(() => expect(editor().querySelector('p.web-antwort__an')).not.toBeNull());
    fireEvent.change(within(editor()).getByRole('combobox', { name: 'Danach' }), { target: { value: 'erledigt' } });
    fireEvent.change(text(), { target: { value: 'Erledigt.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Antwort senden' }));
    await bestaetigen('Senden');
    await waitFor(() => expect(server.aufrufe('patch', '/support/vorgaenge/1').map((a) => a.koerper)).toEqual([{ status: 'erledigt' }]));
    await waitFor(() => expect(stand()).toHaveTextContent('Erledigt am 03.10.2026.'));
  });

  it('scheitert „Danach", ist die Antwort trotzdem gesendet: „Gesendet, Status nicht gesetzt." -- nie Stille', async () => {
    await oeffnen();
    antworten();
    await waitFor(() => expect(editor().querySelector('p.web-antwort__an')).not.toBeNull());
    fireEvent.change(text(), { target: { value: 'Danke.' } });
    server.stand.fehler.set('PATCH /support/vorgaenge/1', Object.assign(new Error('x'), { response: { status: 500, data: { error: 'Datenbankfehler' } } }));
    fireEvent.click(screen.getByRole('button', { name: 'Antwort senden' }));
    await bestaetigen('Senden');
    await waitFor(() => expect(h.setError).toHaveBeenCalledWith('Gesendet, Status nicht gesetzt.'));
    expect(server.aufrufe('post', '/support/vorgaenge/1/antworten')).toHaveLength(1);
    expect(server.aufrufe('patch', '/support/vorgaenge/1').map((a) => a.koerper)).toEqual([{ status: 'wartet' }]);
    expect(h.setSuccess).not.toHaveBeenCalledWith('Antwort gesendet');
    expect(screen.queryByRole('region', { name: 'Antwort schreiben' })).toBeNull();
  });

  it('Sendefehler 503 und 502 erklären sich im Editor; der Text bleibt, „Danach" wird nicht gesetzt', async () => {
    await oeffnen();
    antworten();
    await waitFor(() => expect(editor().querySelector('p.web-antwort__an')).not.toBeNull());
    fireEvent.change(text(), { target: { value: 'Danke.' } });
    server.stand.fehler.set('POST /support/vorgaenge/1/antworten', { response: { status: 503, data: {} } });
    fireEvent.click(screen.getByRole('button', { name: 'Antwort senden' }));
    await bestaetigen('Senden');
    await waitFor(() => expect(within(editor()).getByRole('alert')).toHaveTextContent('Postfach noch nicht eingerichtet'));
    expect(within(editor()).getByRole('alert')).toHaveTextContent('Für support@ fehlen auf dem Server noch die Zugangsdaten. Die Antwort wurde nicht gesendet; dein Text bleibt hier stehen.');
    expect(text().value).toBe('Danke.');

    server.stand.fehler.set('POST /support/vorgaenge/1/antworten', { response: { status: 502, data: {} } });
    fireEvent.click(screen.getByRole('button', { name: 'Antwort senden' }));
    await bestaetigen('Senden');
    await waitFor(() => expect(within(editor()).getByRole('alert')).toHaveTextContent('Versand gescheitert'));
    expect(text().value).toBe('Danke.');
    expect(server.aufrufe('patch', '/support/vorgaenge/1')).toEqual([]);
    expect(h.setError).not.toHaveBeenCalled();
  });

  it('„Ändern" macht den Betreff bearbeitbar und erklärt, was der Server ergänzt; ein eigener Betreff geht mit', async () => {
    await oeffnen();
    antworten();
    await waitFor(() => expect(editor().querySelector('p.web-antwort__an')).not.toBeNull());
    fireEvent.click(within(editor()).getByRole('button', { name: 'Betreff ändern' }));
    expect(feld('Betreff', editor())).not.toHaveAttribute('readonly');
    expect(feld('Betreff', editor())).toHaveAccessibleDescription('Leer: Der Server setzt den Betreff. Die Kennung in eckigen Klammern ergänzt er selbst.');
    expect(within(editor()).queryByRole('button', { name: 'Betreff ändern' })).toBeNull();
    fireEvent.change(feld('Betreff', editor()), { target: { value: 'Rückfrage zum Chat' } });
    fireEvent.change(text(), { target: { value: 'Noch eine Frage.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Antwort senden' }));
    await bestaetigen('Senden');
    expect(server.aufrufe('post', '/support/vorgaenge/1/antworten')[0].koerper).toMatchObject({ betreff: 'Rückfrage zum Chat' });
  });

  it('die Vorschau mit Fußzeile ist zugeklappt und lässt sich aufklappen', async () => {
    await oeffnen();
    antworten();
    const knopf = within(editor()).getByRole('button', { name: 'Vorschau mit Fußzeile' });
    expect(knopf).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: 'Vorschau der Antwort' })).toBeNull();
    fireEvent.change(text(), { target: { value: 'Hallo' } });
    fireEvent.click(knopf);
    expect(knopf).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(screen.getByRole('region', { name: 'Vorschau der Antwort' })).toHaveTextContent('Hallo'));
  });

  it('schrieb zuletzt jemand außerhalb von Kontakt und Leitung: er steht als „schrieb uns" zur Wahl und ist vorgewählt', async () => {
    server.stand.vorgaenge[0].kontakt_email = 'sekretariat@example.org';
    for (const m of server.stand.mails) if (m.richtung === 'ein') { m.von_adresse = 'fremd@example.org'; m.von_name = 'Küster Hans'; }
    await oeffnen();
    expect(antwortzeile()).toHaveTextContent('Antwort an Küster Hans schreiben …');
    antworten();
    await waitFor(() => expect(an().options.length).toBe(4));
    expect(optionen(an())).toEqual([
      'Bitte wählen',
      'Küster Hans <fremd@example.org> · schrieb uns',
      'Pastorin Lena Probe <sekretariat@example.org> · Kontakt aus dem Formular',
      'Pastorin Lena Probe <lena.probe@example.org> · Gemeindeleitung',
    ]);
    expect(an().value).toBe('fremd@example.org');
  });

  it('ohne eingehende Mail und ohne Kontakt, aber mit mehreren Adressen: nichts vorgewählt -- Meldung, keine Rückfrage, kein Versand', async () => {
    server.stand.vorgaenge[0].kontakt_email = null;
    server.stand.mails = server.stand.mails.filter((m) => m.richtung !== 'ein');
    const zweite = { id: 22, display_name: 'Pastor Tim Probe', username: 'tim.probe', email: 'tim.probe@example.org', is_active: true, last_login_at: null };
    LEITUNG[7].push(zweite);
    try {
      await oeffnen();
      // Die Antwortzeile nennt nur, wen der Editor vorwählt -- hier niemanden (bis 11.10.2026 nannte sie die erste Adresse).
      expect(antwortzeile()).toHaveTextContent('Antwort schreiben …von support@');
      expect(antwortzeile()).not.toHaveTextContent('Probe');
      antworten();
      await waitFor(() => expect(an().options.length).toBe(3));
      expect(an().value).toBe('');
      fireEvent.change(text(), { target: { value: 'Hallo' } });
      fireEvent.click(screen.getByRole('button', { name: 'Antwort senden' }));
      expect(h.setError).toHaveBeenCalledWith('Bitte einen Empfänger wählen');
      expect(h.alert).toBeNull();
    } finally {
      LEITUNG[7].splice(LEITUNG[7].indexOf(zweite), 1);
    }
  });

  it('bei einer Anfrage: von moin@ an die Adresse der Anfrage, fest; „Danach" ohne Erledigt; die Platzhalter kommen von der Anfrage', async () => {
    await oeffnen(3, /Lindenau/);
    antworten();
    expect(editor().querySelector('p.web-antwort__an')).toHaveTextContent('An: Anna Beispiel <anna@example.org> · von moin@');
    expect(screen.queryByRole('combobox', { name: 'An' })).toBeNull();
    expect(optionen(within(editor()).getByRole('combobox', { name: 'Danach' }) as HTMLSelectElement)).toEqual(['Wartet auf Rückmeldung', 'In Arbeit']);
    expect(feld('Betreff', editor()).value).toBe('Re: Eure Anfrage bei Konfi Quest');
    await waitFor(() => expect((screen.getByLabelText('Textbaustein') as HTMLSelectElement).options.length).toBeGreaterThan(1));
    fireEvent.change(screen.getByLabelText('Textbaustein'), { target: { value: '1' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Baustein einfügen' })); });
    expect(h.apiGet).toHaveBeenCalledWith('/support/mail/platzhalter', { params: { anfrage_id: 41 } });
    expect(text().value).toBe('Danke, Anna Beispiel.');
    fireEvent.click(screen.getByRole('button', { name: 'Antwort senden' }));
    await bestaetigen('Senden');
    expect(server.aufrufe('post', '/support/vorgaenge/3/antworten')[0].koerper).toEqual({ text: 'Danke, Anna Beispiel.', betreff: 'Re: Eure Anfrage bei Konfi Quest' });
  });

  it('ohne Gemeinde, aber mit Kontakt des Formulars: von support@ an dessen Adresse', async () => {
    await oeffnen(2, /Jahrgang/);
    expect(antwortzeile()).toHaveTextContent('Antwort an Anna Beispiel schreiben …von support@');
    fireEvent.click(antwortzeile());
    // Die feste Zeile nennt den Namen nur, wenn er aus einer Mail bekannt ist (useAntwortEditor).
    expect(editor().querySelector('p.web-antwort__an')).toHaveTextContent('An: anna@example.org · von support@');
    expect(feld('Betreff', editor()).value).toBe('Re: Wie lege ich einen Jahrgang an?');
  });
});

describe('Vorgang (Web): Notiz', () => {
  const notizFeld = () => screen.getByLabelText('Interne Notiz (nur für den Support)') as HTMLTextAreaElement;

  it('leer steht oben nur „+ Interne Notiz"; erst nach einer Änderung „Notiz speichern"; getrimmt an den Server, leer als null', async () => {
    await oeffnen();
    expect(screen.queryByLabelText('Interne Notiz (nur für den Support)')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Interne Notiz' }));
    expect(notizFeld()).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Notiz speichern' })).toBeNull();
    fireEvent.change(notizFeld(), { target: { value: '  Rückruf am Montag ' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Notiz speichern' })); });
    expect(patches()[0]).toMatchObject({ pfad: '/support/vorgaenge/1', koerper: { notiz: 'Rückruf am Montag' } });
    expect(h.setSuccess).toHaveBeenCalledWith('Notiz gespeichert');
    // Gespeichert: die Notiz steht als Text da, mit „Bearbeiten".
    const notiz = await screen.findByRole('region', { name: 'Interne Notiz' });
    expect(notiz).toHaveTextContent('Rückruf am Montag');
    fireEvent.click(within(notiz).getByRole('button', { name: 'Bearbeiten' }));
    fireEvent.change(notizFeld(), { target: { value: '   ' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Notiz speichern' })); });
    expect(patches()[1].koerper).toEqual({ notiz: null });
  });

  it('eine vorhandene Notiz steht oben, beim Öffnen sichtbar; Abbrechen verwirft den Entwurf', async () => {
    server.stand.vorgaenge[0].notiz = 'Nachfragen';
    await oeffnen();
    const notiz = screen.getByRole('region', { name: 'Interne Notiz' });
    expect(notiz).toHaveTextContent('Nachfragen');
    expect(within(notiz).queryByRole('button', { name: 'mehr' })).toBeNull();
    fireEvent.click(within(notiz).getByRole('button', { name: 'Bearbeiten' }));
    expect(notizFeld().value).toBe('Nachfragen');
    fireEvent.change(notizFeld(), { target: { value: 'Anders' } });
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(screen.getByRole('region', { name: 'Interne Notiz' })).toHaveTextContent('Nachfragen');
    expect(patches()).toHaveLength(0);
  });

  it('Fokus: „Abbrechen" gibt ihn an „+ Interne Notiz" zurück, „Notiz speichern" an „Bearbeiten"', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Interne Notiz' }));
    expect(notizFeld()).toHaveFocus();
    fireEvent.change(notizFeld(), { target: { value: 'Rückruf' } });
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(screen.getByRole('button', { name: 'Interne Notiz' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Interne Notiz' }));
    fireEvent.change(notizFeld(), { target: { value: 'Rückruf am Montag' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Notiz speichern' })); });
    const notiz = await screen.findByRole('region', { name: 'Interne Notiz' });
    await waitFor(() => expect(within(notiz).getByRole('button', { name: 'Bearbeiten' })).toHaveFocus());
  });

  it('Fokus: „Abbrechen" beim Bearbeiten einer vorhandenen Notiz gibt ihn an „Bearbeiten" zurück', async () => {
    server.stand.vorgaenge[0].notiz = 'Nachfragen';
    await oeffnen();
    fireEvent.click(within(screen.getByRole('region', { name: 'Interne Notiz' })).getByRole('button', { name: 'Bearbeiten' }));
    expect(notizFeld()).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(within(screen.getByRole('region', { name: 'Interne Notiz' })).getByRole('button', { name: 'Bearbeiten' })).toHaveFocus();
  });

  it('eine lange Notiz ist auf drei Zeilen gekürzt und hat „mehr"', async () => {
    server.stand.vorgaenge[0].notiz = 'Eins\nZwei\nDrei\nVier';
    await oeffnen();
    const notiz = screen.getByRole('region', { name: 'Interne Notiz' });
    expect(notiz.querySelector('.web-notiz__text')!.className).toContain('web-notiz__text--kurz');
    fireEvent.click(within(notiz).getByRole('button', { name: 'mehr' }));
    expect(notiz.querySelector('.web-notiz__text')!.className).not.toContain('web-notiz__text--kurz');
    expect(within(notiz).getByRole('button', { name: 'weniger' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('ein Fehler beim Speichern: Meldung, die Eingabe bleibt', async () => {
    await oeffnen();
    server.stand.fehler.set('PATCH /support/vorgaenge/1', Object.assign(new Error('x'), { response: { status: 500, data: { error: 'Datenbankfehler' } } }));
    fireEvent.click(screen.getByRole('button', { name: 'Interne Notiz' }));
    fireEvent.change(notizFeld(), { target: { value: 'Neu' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Notiz speichern' })); });
    expect(h.setError).toHaveBeenCalledWith('Datenbankfehler');
    expect(notizFeld().value).toBe('Neu');
  });
});

describe('Vorgang (Web): Archivieren, Wiederherstellen, Löschen', () => {
  it('Archivieren: eine Anfrage an den Vorgang; danach sagt der Stand, dass er im Archiv liegt', async () => {
    await allein();
    await act(async () => { fireEvent.click(within(kopf()).getByRole('button', { name: 'Archivieren' })); });
    expect(server.aufrufe('post', '/support/vorgaenge/1/archivieren')).toHaveLength(1);
    expect(h.setSuccess).toHaveBeenCalledWith('Vorgang archiviert');
    await waitFor(() => expect(stand()).toHaveTextContent('Im Archiv seit 03.10.2026. Eine neue Mail holt ihn zurück.'));
    expect(hauptknopf()).toHaveTextContent('Wiederherstellen');
  });

  it('ein erledigter Vorgang lässt sich wiederherstellen: danach „In Arbeit"', async () => {
    await oeffnen(4, /Konto entsperrt/);
    await act(async () => { fireEvent.click(hauptknopf()); });
    expect(server.aufrufe('post', '/support/vorgaenge/4/wiederherstellen')).toHaveLength(1);
    expect(h.setSuccess).toHaveBeenCalledWith('Vorgang wiederhergestellt – Status „In Arbeit“');
    await waitFor(() => expect(teile(kennzeichen())).toContain('In Arbeit'));
    expect(within(kopf()).getByRole('button', { name: 'Archivieren' })).toBeInTheDocument();
  });

  it('Löschen fragt zuerst und nennt, was gelöscht wird -- bei einer Anfrage auch sie; erst „Löschen“ löscht, die Liste öffnet den nächsten Eintrag', async () => {
    await oeffnen(3, /Lindenau/);
    const liste = screen.getByRole('navigation', { name: 'Vorgänge' });
    const vorher = within(liste).getAllByRole('button', { name: /^Vorgang \d+:/ }).map((k) => Number(/^Vorgang (\d+):/.exec(k.getAttribute('aria-label')!)![1]));
    const i = vorher.indexOf(3);
    const naechster = vorher[i + 1] ?? vorher[i - 1];
    expect(naechster).toBeDefined();
    fireEvent.click(within(kopf()).getByRole('button', { name: 'Löschen' }));
    expect(h.alert?.header).toBe('Vorgang löschen');
    expect(h.alert?.message).toBe('„Anfrage Kirchengemeinde Lindenau“ wird mit seinen Mails in Konfi Quest und der Anfrage gelöscht. Im Postfach selbst bleibt alles stehen. Das lässt sich nicht rückgängig machen.');
    expect(server.aufrufe('delete')).toHaveLength(0);
    await bestaetigen('Löschen');
    expect(server.aufrufe('delete')[0].pfad).toBe('/support/vorgaenge/3');
    expect(h.setSuccess).toHaveBeenCalledWith('Vorgang gelöscht');
    expect(h.push).not.toHaveBeenCalled();
    // Kein leerer Lesebereich mehr (Frage 6): der nächste Eintrag steht da.
    await waitFor(() => expect(window.location.pathname).toBe(`/admin/support/vorgaenge/${naechster}`));
    expect(screen.queryByText('Kein Vorgang gewählt')).toBeNull();
    await waitFor(() => expect(within(liste).queryByRole('button', { name: /^Vorgang 3:/ })).toBeNull());
    expect(within(liste).getByRole('button', { current: true })).toHaveAccessibleName(new RegExp(`^Vorgang ${naechster}:`));
  });

  it('Abbrechen löscht nichts; ein Fehler beim Löschen meldet ihn und der Vorgang bleibt offen', async () => {
    await oeffnen();
    fireEvent.click(within(kopf()).getByRole('button', { name: 'Löschen' }));
    expect(h.alert?.buttons?.find((b) => b.role === 'cancel')?.text).toBe('Abbrechen');
    expect(server.aufrufe('delete')).toHaveLength(0);
    server.stand.fehler.set('DELETE /support/vorgaenge/1', Object.assign(new Error('x'), { response: { status: 500, data: { error: 'Datenbankfehler' } } }));
    await bestaetigen('Löschen');
    expect(h.setError).toHaveBeenCalledWith('Datenbankfehler');
    expect(h.push).not.toHaveBeenCalled();
    expect(within(lesen()).getByRole('heading', { level: 2, name: 'Chat zeigt nichts Neues' })).toBeInTheDocument();
  });
});

describe('Vorgang (Web): Ablehnen einer Anfrage', () => {
  it('fragt zurück und nennt die Folge; erst „Ablehnen" schickt PATCH { status: erledigt }', async () => {
    await allein(3, /Lindenau/);
    fireEvent.click(within(kopf()).getByRole('button', { name: 'Ablehnen' }));
    expect(h.alert?.header).toBe('Anfrage ablehnen?');
    expect(h.alert?.message).toBe('Der Vorgang wird erledigt und archiviert, die Anfrage gilt als abgelehnt und wird nach 180 Tagen gelöscht. Eine Absage-Mail geht dabei nicht hinaus. Wiederherstellen holt beides zurück.');
    expect(patches()).toHaveLength(0);
    await bestaetigen('Ablehnen');
    expect(patches().map((p) => [p.pfad, p.koerper])).toEqual([['/support/vorgaenge/3', { status: 'erledigt' }]]);
    await waitFor(() => expect(hauptknopf()).toHaveTextContent('Wiederherstellen'));
  });

  it('Abbrechen lehnt nichts ab', async () => {
    await oeffnen(3, /Lindenau/);
    fireEvent.click(within(kopf()).getByRole('button', { name: 'Ablehnen' }));
    await bestaetigen('Abbrechen');
    expect(patches()).toHaveLength(0);
  });

  it('eine abgelehnte Anfrage (Fall 1b): Wiederherstellen ist der Hauptknopf, „Gemeinde anlegen" steht daneben, Ablehnen und Archivieren nicht', async () => {
    Object.assign(server.stand.vorgaenge[2], {
      anfrage: { ...ANFRAGE_41, status: 'abgelehnt' }, status: 'erledigt', archiviert_am: '2026-10-02T10:00:00Z', status_seit: '2026-10-02T10:00:00Z',
    });
    await oeffnen(3, /Lindenau/);
    expect(aktionNamen()).toEqual(['Löschen', 'Einordnen', 'Gemeinde anlegen', 'Wiederherstellen']);
    expect(stand()).toHaveTextContent('Anfrage abgelehnt am 02.10.2026. Sie wird nach 180 Tagen gelöscht; Wiederherstellen holt sie zurück.');
    expect(stand().className).toBe('web-stand web-stand--hinweis');
    // Eine abgelehnte Anfrage bleibt anlegbar.
    fireEvent.click(within(kopf()).getByRole('button', { name: 'Gemeinde anlegen' }));
    expect(dialog('Gemeinde anlegen')).toBeInTheDocument();
  });

  it('ein Vorgang ohne Anfrage hat kein Ablehnen', async () => {
    await oeffnen();
    expect(within(kopf()).queryByRole('button', { name: 'Ablehnen' })).toBeNull();
  });
});

describe('Vorgang (Web): Gemeinde anlegen im Dialog', () => {
  const anlegenDialog = () => dialog('Gemeinde anlegen');
  const oeffneAnlegen = async () => {
    await oeffnen(3, /Lindenau/);
    fireEvent.click(within(kopf()).getByRole('button', { name: 'Gemeinde anlegen' }));
    await waitFor(() => expect(feld('Name der Gemeinde', anlegenDialog()).value).toBe('Kirchengemeinde Lindenau'));
    return anlegenDialog();
  };
  const tarif = () => within(anlegenDialog()).getByRole('combobox', { name: 'Tarif' }) as HTMLSelectElement;
  /**
   * Die Rückfragen sind ein zweites Fenster über dem Dialog, kein ion-alert:
   * Der läge im Browser hinter dem Dialog (WebDialog hängt an <body>), das
   * Anlegen ginge nicht und Schließen mit Änderungen wirkte tot.
   */
  const rueckfrageKnopf = async (name: string, knopf: string) => {
    await act(async () => { fireEvent.click(within(dialog(name)).getByRole('button', { name: knopf })); });
  };
  const knoepfe = (d: HTMLElement) => [...d.querySelectorAll('.web-dialog__aktionen button')].map((b) => b.textContent);
  const offeneDialoge = () => screen.getAllByRole('dialog').map((d) => d.querySelector('h2')!.textContent);

  it('breit und in zwei Spalten: Gemeinde links, erste Gemeindeleitung rechts; oben die Kurzzeile der Anfrage', async () => {
    const d = await oeffneAnlegen();
    expect(d.className).toBe('web-dialog web-dialog--breit');
    expect([...d.querySelectorAll('fieldset.web-anlegen__spalte > legend')].map((l) => l.textContent)).toEqual(['Gemeinde', 'Erste Gemeindeleitung']);
    expect(d.querySelector('.web-anlegen__kurz')).toHaveTextContent('Aus der Anfrage: Anna Beispiel (Pastorin) · 25 Konfis · 6 Teamer:innen · Wunsch: Standard');
  });

  it('belegt das Formular aus der Anfrage vor -- Kirchenkreis aus der Struktur, Benutzername als Vorschlag', async () => {
    const d = await oeffneAnlegen();
    expect((within(d).getByLabelText('Kirchenkreis') as HTMLSelectElement).value).toBe('11');
    expect(within(d).getByLabelText('Kirchenkreis')).toHaveAccessibleDescription('Landeskirche: Nordkirche');
    expect(feld('Ansprechperson', d).value).toBe('Anna Beispiel');
    expect(feld('E-Mail der Gemeinde', d).value).toBe('anna@example.org');
    expect(feld('Telefon', d).value).toBe('0170 1234567');
    expect(tarif().value).toBe('5');
    expect((within(d).getByRole('switch', { name: 'Testphase (30 Tage)' }) as HTMLInputElement).checked).toBe(true);
    expect(feld('Benutzername', d).value).toBe('anna.beispiel');
    expect(feld('Anzeigename', d).value).toBe('Anna Beispiel');
    expect(feld('Passwort', d).value).toBe('');
  });

  it('der Tarif ist eine Auswahl mit Preis; Wunschlizenz: Testphase aus stellt das Limit auf ihre Konfi-Zahl', async () => {
    const d = await oeffneAnlegen();
    expect(optionen(tarif())).toEqual([
      'Testphase — bis 5 Konfis · kostenlos, 30 Tage',
      'Klein — bis 15 Konfis · 49\u00a0€ pro Jahr',
      'Standard — bis 50 Konfis · 99\u00a0€ pro Jahr',
      'Plus — bis 75 Konfis · 139\u00a0€ pro Jahr',
      'Groß — bis 100 Konfis · 179\u00a0€ pro Jahr',
      'Unbegrenzt — ohne Konfi-Grenze',
      'Eigenes Limit…',
    ]);
    expect(tarif()).toHaveAccessibleDescription('In der Testphase 5, danach 50 (Wunschlizenz Standard).');
    fireEvent.click(within(d).getByRole('switch', { name: 'Testphase (30 Tage)' }));
    expect(tarif().value).toBe('50');
    fireEvent.click(within(d).getByRole('switch', { name: 'Testphase (30 Tage)' }));
    expect(tarif().value).toBe('5');
  });

  it('Schließen ohne Änderung schließt gleich; mit Änderung fragt ein zweites Fenster darüber zurück -- „Weiter bearbeiten" behält die Eingaben', async () => {
    let d = await oeffneAnlegen();
    fireEvent.click(within(d).getByRole('button', { name: 'Schließen' }));
    expect(h.alert).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(within(kopf()).getByRole('button', { name: 'Gemeinde anlegen' }));
    d = anlegenDialog();
    fireEvent.change(feld('Telefon', d), { target: { value: '04821 1234' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Abbrechen' }));
    expect(h.alert).toBeNull();
    const frage = dialog('Eingaben verwerfen?');
    expect(frage).toHaveAccessibleDescription('Die Angaben zur neuen Gemeinde und ein vorgeschlagenes Passwort gehen verloren.');
    expect(knoepfe(frage)).toEqual(['Weiter bearbeiten', 'Verwerfen']);
    // Obenauf: nach dem Dialog an <body> gehängt, der Fokus steht darin.
    expect(offeneDialoge()).toEqual(['Gemeinde anlegen', 'Eingaben verwerfen?']);
    expect(frage).toContainElement(document.activeElement as HTMLElement);
    await rueckfrageKnopf('Eingaben verwerfen?', 'Weiter bearbeiten');
    expect(offeneDialoge()).toEqual(['Gemeinde anlegen']);
    expect(feld('Telefon', anlegenDialog()).value).toBe('04821 1234');
  });

  it('Escape in der Rückfrage schließt nur sie; der Dialog mit den Eingaben bleibt', async () => {
    const d = await oeffneAnlegen();
    fireEvent.change(feld('Telefon', d), { target: { value: '04821 1234' } });
    fireEvent.keyDown(d, { key: 'Escape' });
    fireEvent.keyDown(dialog('Eingaben verwerfen?'), { key: 'Escape' });
    expect(offeneDialoge()).toEqual(['Gemeinde anlegen']);
    expect(feld('Telefon', anlegenDialog()).value).toBe('04821 1234');
  });

  it('„Verwerfen" schließt und stellt die Vorbelegung wieder her', async () => {
    const d = await oeffneAnlegen();
    fireEvent.change(feld('Telefon', d), { target: { value: '04821 1234' } });
    fireEvent.keyDown(d, { key: 'Escape' });
    await rueckfrageKnopf('Eingaben verwerfen?', 'Verwerfen');
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(within(kopf()).getByRole('button', { name: 'Gemeinde anlegen' }));
    expect(feld('Telefon', anlegenDialog()).value).toBe('0170 1234567');
    expect(server.aufrufe('post', /anlegen$/)).toHaveLength(0);
  });

  it('ohne Passwort: Meldung, keine Rückfrage, kein Aufruf', async () => {
    const d = await oeffneAnlegen();
    await act(async () => { fireEvent.click(within(d).getByRole('button', { name: 'Gemeinde anlegen' })); });
    expect(h.setError).toHaveBeenCalledWith('Alle Felder der Gemeindeleitung sind erforderlich');
    expect(h.alert).toBeNull();
    expect(offeneDialoge()).toEqual(['Gemeinde anlegen']);
    expect(server.aufrufe('post', /anlegen$/)).toHaveLength(0);
  });

  it('fragt in einem zweiten Fenster nach, legt an, schließt; der Stand nennt den Benutzernamen, „Gemeinde öffnen" ist der Hauptknopf', async () => {
    const d = await oeffneAnlegen();
    fireEvent.change(feld('Passwort', d), { target: { value: BEISPIELWERT } });
    await act(async () => { fireEvent.click(within(d).getByRole('button', { name: 'Gemeinde anlegen' })); });
    expect(h.alert).toBeNull();
    const frage = dialog('Gemeinde anlegen?');
    expect(frage).toHaveAccessibleDescription('„Kirchengemeinde Lindenau“ mit der Gemeindeleitung „Anna Beispiel“ (anna.beispiel) anlegen?');
    expect(knoepfe(frage)).toEqual(['Abbrechen', 'Anlegen']);
    expect(offeneDialoge()).toEqual(['Gemeinde anlegen', 'Gemeinde anlegen?']);
    expect(frage).toContainElement(document.activeElement as HTMLElement);

    // Abbrechen: nichts angelegt, der Dialog mit den Eingaben bleibt.
    await rueckfrageKnopf('Gemeinde anlegen?', 'Abbrechen');
    expect(offeneDialoge()).toEqual(['Gemeinde anlegen']);
    expect(server.aufrufe('post', /anlegen$/)).toHaveLength(0);
    expect(feld('Passwort', anlegenDialog()).value).toBe(BEISPIELWERT);

    await act(async () => { fireEvent.click(within(anlegenDialog()).getByRole('button', { name: 'Gemeinde anlegen' })); });
    await rueckfrageKnopf('Gemeinde anlegen?', 'Anlegen');
    await waitFor(() => expect(server.aufrufe('post', /anlegen$/)).toHaveLength(1));
    const { pfad, koerper } = server.aufrufe('post', /anlegen$/)[0];
    expect(pfad).toBe('/support/anfragen/41/anlegen');
    const { trial_ends_at: ende, ...rest } = koerper as Record<string, unknown> & { trial_ends_at: string };
    expect(rest).toEqual({
      name: 'kirchengemeinde-lindenau', display_name: 'Kirchengemeinde Lindenau', kirchenkreis_id: 11, contact_name: 'Anna Beispiel',
      contact_email: 'anna@example.org', contact_phone: '0170 1234567', max_konfis: 5, is_trial: true, admin_username: 'anna.beispiel',
      admin_display_name: 'Anna Beispiel', admin_email: 'anna@example.org', admin_password: BEISPIELWERT,
    });
    expect(Math.round((new Date(ende).getTime() - Date.now()) / (24 * 60 * 60 * 1000))).toBe(30);
    expect(h.setSuccess).toHaveBeenCalledWith('Gemeinde angelegt');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(stand()).toHaveTextContent('Gemeinde angelegt am 03.10.2026. Benutzername der Gemeindeleitung: anna.beispiel – Benutzername und Passwort getrennt weitergeben.'));
    expect(hauptknopf()).toHaveAttribute('href', '/admin/organizations?gemeinde=77');
    expect(hauptknopf()).toHaveTextContent('Gemeinde öffnen');
  });

  it('Benutzername vergeben (409): die Meldung des Servers, der Dialog bleibt', async () => {
    const d = await oeffneAnlegen();
    fireEvent.change(feld('Passwort', d), { target: { value: BEISPIELWERT } });
    await act(async () => { fireEvent.click(within(d).getByRole('button', { name: 'Gemeinde anlegen' })); });
    server.stand.fehler.set('POST /support/anfragen/41/anlegen', { response: { status: 409, data: { error: 'Benutzername existiert bereits (muss systemweit eindeutig sein)' } } });
    await rueckfrageKnopf('Gemeinde anlegen?', 'Anlegen');
    await waitFor(() => expect(h.setError).toHaveBeenCalledWith('Benutzername existiert bereits (muss systemweit eindeutig sein)'));
    expect(anlegenDialog()).toBeInTheDocument();
  });

  it('Kirchenkreis noch nicht in der Struktur: ein Schritt im Dialog legt ihn an und wählt ihn', async () => {
    server.stand.vorgaenge[2].anfrage = { ...ANFRAGE_41, kirchenkreis: 'Steinburg' };
    await oeffnen(3, /Lindenau/);
    fireEvent.click(within(kopf()).getByRole('button', { name: 'Gemeinde anlegen' }));
    const d = anlegenDialog();
    await within(d).findByText(/steht noch nicht in der Struktur/);
    expect((within(d).getByLabelText('Kirchenkreis') as HTMLSelectElement).value).toBe('ohne');
    const alt = h.apiGet.getMockImplementation()!;
    h.apiGet.mockImplementation((pfad: string, o?: unknown) => (pfad === '/support/kirchenkreise'
      ? Promise.resolve({ data: [{ id: 11, name: 'Kirchenkreis Dithmarschen', landeskirche_id: 1, landeskirche: 'Nordkirche' }, { id: 13, name: 'Steinburg', landeskirche_id: 1, landeskirche: 'Nordkirche' }] })
      : alt(pfad, o as never)));
    await act(async () => { fireEvent.click(within(d).getByRole('button', { name: 'Als Kirchenkreis anlegen' })); });
    expect(server.aufrufe('post', '/support/kirchenkreise')[0].koerper).toEqual({ name: 'Steinburg', landeskirche_id: 1 });
    await waitFor(() => expect((within(anlegenDialog()).getByLabelText('Kirchenkreis') as HTMLSelectElement).value).toBe('13'));
  });

  /** Ab jetzt liefert die Struktur auch den eben angelegten Kirchenkreis „Steinburg“ (Nr. 13). */
  const mitSteinburg = () => {
    const alt = h.apiGet.getMockImplementation()!;
    h.apiGet.mockImplementation((pfad: string, o?: unknown) => (pfad === '/support/kirchenkreise'
      ? Promise.resolve({ data: [{ id: 11, name: 'Kirchenkreis Dithmarschen', landeskirche_id: 1, landeskirche: 'Nordkirche' }, { id: 13, name: 'Steinburg', landeskirche_id: 1, landeskirche: 'Nordkirche' }] })
      : alt(pfad, o as never)));
  };
  const kreisWahl = () => within(anlegenDialog()).getByLabelText('Kirchenkreis') as HTMLSelectElement;

  it('„Als Kirchenkreis anlegen" an der Karte ist keine Eingabe im Formular: Schließen ohne eigene Änderung fragt nicht zurück', async () => {
    server.stand.vorgaenge[2].anfrage = { ...ANFRAGE_41, kirchenkreis: 'Steinburg' };
    await oeffnen(3, /Lindenau/);
    const kreis = await waitFor(() => {
      const z = zeile(karte('Anfrage'), 'Kreis');
      expect(z).toHaveTextContent('Steinburg › Nordkirche · fehlt noch');
      return z;
    });
    mitSteinburg();
    await act(async () => { fireEvent.click(within(kreis).getByRole('button', { name: 'Als Kirchenkreis anlegen' })); });
    await waitFor(() => expect(zeile(karte('Anfrage'), 'Kreis')).toHaveTextContent('Steinburg › Nordkirche · steht in der Struktur'));
    fireEvent.click(within(kopf()).getByRole('button', { name: 'Gemeinde anlegen' }));
    expect(kreisWahl().value).toBe('13');
    fireEvent.click(within(anlegenDialog()).getByRole('button', { name: 'Abbrechen' }));
    expect(h.alert).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('nach „Verwerfen" gilt wieder die Vorbelegung -- auch mit dem eben angelegten Kirchenkreis; erneutes Schließen fragt nicht noch einmal', async () => {
    server.stand.vorgaenge[2].anfrage = { ...ANFRAGE_41, kirchenkreis: 'Steinburg' };
    await oeffnen(3, /Lindenau/);
    fireEvent.click(within(kopf()).getByRole('button', { name: 'Gemeinde anlegen' }));
    await within(anlegenDialog()).findByText(/steht noch nicht in der Struktur/);
    mitSteinburg();
    await act(async () => { fireEvent.click(within(anlegenDialog()).getByRole('button', { name: 'Als Kirchenkreis anlegen' })); });
    await waitFor(() => expect(kreisWahl().value).toBe('13'));
    fireEvent.change(feld('Telefon', anlegenDialog()), { target: { value: '04821 1234' } });
    fireEvent.click(within(anlegenDialog()).getByRole('button', { name: 'Abbrechen' }));
    await rueckfrageKnopf('Eingaben verwerfen?', 'Verwerfen');
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(within(kopf()).getByRole('button', { name: 'Gemeinde anlegen' }));
    expect(feld('Telefon', anlegenDialog()).value).toBe('0170 1234567');
    expect(kreisWahl().value).toBe('13');
    fireEvent.click(within(anlegenDialog()).getByRole('button', { name: 'Abbrechen' }));
    expect(h.alert).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('eine schon angelegte Anfrage: kein Anlegen mehr, „Gemeinde öffnen" ist der Hauptknopf', async () => {
    server.stand.vorgaenge[2].anfrage = { ...ANFRAGE_41, status: 'angelegt', organization_id: 55 };
    server.stand.vorgaenge[2].organization_id = 55;
    server.stand.vorgaenge[2].status = 'erledigt';
    server.stand.vorgaenge[2].archiviert_am = '2026-10-02T10:00:00Z';
    await oeffnen(3, /Lindenau/);
    expect(within(kopf()).queryByRole('button', { name: 'Gemeinde anlegen' })).toBeNull();
    expect(hauptknopf()).toHaveAttribute('href', '/admin/organizations?gemeinde=55');
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
    expect(await screen.findByRole('button', { name: /Interne Notiz/ })).toBeInTheDocument();
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
