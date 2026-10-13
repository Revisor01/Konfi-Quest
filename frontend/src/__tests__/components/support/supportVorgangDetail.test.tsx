// Ein Vorgang der Support-Ansicht in der App-Fassung (/admin/support/
// vorgaenge/:id), gerendert (docs/planung/support-detailseiten.md, „In der
// App", Skizzen App A bis C und F; Simon, 11.10.2026):
//   - Kopfzeile „Vorgang N" bzw. „Anfrage N" mit Einordnen und Archiv;
//   - farbiger Kopf mit „Nr. N · Gemeinde" und drei Zahlen-Kacheln;
//   - Karte „Stand": Marken (antippen = Einordnen), Satz, Hauptknopf nach der
//     Stand-Regel, Nebenknöpfe, Notiz;
//   - flacher Verlauf mit Antwortzeile und Menü je Mail;
//   - Angaben (Anfrage, Kontakt mit Mobil, Gemeinde mit eingeklappter Leitung);
//   - Löschen allein ganz unten;
//   - Modale: Antworten („Du antwortest auf", Danach), Einordnen mit EINEM
//     Speichern, Notiz, Gemeinde anlegen, Verschieben -- mit Rückfrage beim
//     Schließen, wenn etwas verloren ginge.
// Die Web-Fassung (Lesebereich neben der Liste) steht in
// webVorgangDetail.test.tsx -- beide teilen die Logik. Der Lizenz-Vorgang
// steht in supportLizenzVorgang.test.tsx.
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor, within, cleanup } from '@testing-library/react';
import { ziehenZumAktualisieren, type AlertOptionen } from './ionicAttrappe';
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
  online: true,
  user: { id: 9, role_name: 'super_admin', is_super_admin: true } as Record<string, unknown>,
  standort: { pathname: '/admin/support/vorgaenge/1', search: '', state: null } as { pathname: string; search: string; state: null },
}));

// Das Modal wie Ionic: Schließen läuft über dismiss() und fragt canDismiss --
// so lässt sich die Rückfrage beim Schließen prüfen (die gemeinsame Attrappe
// zeigt nur offen/zu).
vi.mock('@ionic/react', async () => {
  const basis = (await import('./ionicAttrappe')).ionicAttrappe({
    presentAlert: (o) => { h.alert = o; },
    router: { push: h.push, goBack: vi.fn(), canGoBack: () => false },
  });
  const { createElement, forwardRef, useImperativeHandle } = await import('react');
  type ModalProps = { isOpen?: boolean; children?: unknown; 'aria-label'?: string; canDismiss?: boolean | (() => Promise<boolean>); onDidDismiss?: () => void };
  const IonModal = forwardRef<unknown, ModalProps>((p, ref) => {
    useImperativeHandle(ref, () => ({
      dismiss: async () => {
        const darf = typeof p.canDismiss === 'function' ? await p.canDismiss() : p.canDismiss !== false;
        if (darf) p.onDidDismiss?.();
        return darf;
      },
    }));
    return p.isOpen ? createElement('div', { role: 'dialog', 'aria-label': p['aria-label'] }, p.children as never) : null;
  });
  return { ...basis, IonModal };
});
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('./ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: ({ message }: { message: string }) => <p>{message}</p> }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: h.online }),
}));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => false }));
vi.mock('../../../navigation/useAppLocation', () => ({ useAppLocation: () => h.standort }));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));

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
  // „heute" ist der Tag der Testdaten (nur die Uhr der Daten, die Zeitgeber bleiben echt).
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-03T09:00:00Z'));
  h.alert = null;
  h.online = true;
  h.user = { id: 9, role_name: 'super_admin', is_super_admin: true };
  h.standort = { pathname: '/admin/support/vorgaenge/1', search: '', state: null };
  supportMailZaehlerZuruecksetzen();
  server = vorgaengeServer({
    gemeindeNameWieServer: true,
    vorgaenge: [
      vorgang(1, { art: 'fehler', bereich: 'chat', dringlichkeit: 'dringend', status: 'neu', betreff: 'Chat zeigt nichts Neues', organization_id: 7,
        beschreibung: 'Seit gestern erscheint im Chat nichts Neues.', kontakt_name: 'Pastorin Lena Probe', kontakt_email: 'lena.probe@example.org', kontakt_funktion: 'Gemeindeleitung',
        gemeinde_angabe: 'Kirchengemeinde Musterdorf' }),
      vorgang(2, { art: 'frage', bereich: null, status: 'neu', betreff: 'Wie lege ich einen Jahrgang an?', organization_id: null,
        beschreibung: 'Wir sind neu dabei.', kontakt_name: 'Anna Beispiel', kontakt_email: 'anna@example.org', gemeinde_angabe: 'Kirchengemeinde Heide' }),
      vorgang(3, { art: 'neue_gemeinde', bereich: null, status: 'neu', betreff: 'Anfrage Kirchengemeinde Lindenau', quelle: 'anfrage', anfrage_id: 41, anfrage: { ...ANFRAGE_41 } }),
      vorgang(4, { art: 'zugang', bereich: null, status: 'erledigt', betreff: 'Konto entsperrt', organization_id: 7, archiviert_am: '2026-10-02T12:00:00Z' }),
      vorgang(5, { art: 'sonstiges', bereich: null, status: 'in_arbeit', betreff: 'Intern notiert', quelle: 'support' }),
      vorgang(6, { art: 'sonstiges', bereich: null, status: 'neu', betreff: 'Frage per Mail', quelle: 'mail', organization_id: 7 }),
    ],
    mails: [
      mail(11, 1, { betreff: 'Chat zeigt nichts Neues', text: 'Seit gestern erscheint im Chat nichts Neues.', gesendet_am: '2026-10-03T07:00:00Z' }),
      mail(12, 1, { richtung: 'aus', von_adresse: 'support@konfi-quest.example', von_name: 'Support', an_adressen: ['lena.probe@example.org'], betreff: 'Re: Chat zeigt nichts Neues [Vorgang 1]', text: 'Wir schauen nach.', gesendet_am: '2026-10-03T07:30:00Z', gelesen_am: '2026-10-03T07:30:00Z' }),
      mail(61, 6, { von_adresse: 'kuester.hans@example.org', von_name: 'Küster Hans', betreff: 'Frage per Mail', text: 'Wie geht das?', gelesen_am: '2026-10-03T08:00:00Z' }),
      mail(31, 3, { postfach: 'moin', von_adresse: 'anna@example.org', von_name: 'Anna Beispiel', an_adressen: ['moin@konfi-quest.example'], betreff: 'Eure Anfrage bei Konfi Quest [Anfrage 41]', text: 'Wann geht es los?', gelesen_am: '2026-10-03T07:00:00Z' }),
    ],
  });
  server.installieren({ get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete });
});

afterEach(() => { vi.useRealTimers(); });

const oeffnen = async (id = 1) => {
  render(<SupportVorgangDetailPage vorgangId={id} />);
  await screen.findByRole('region', { name: 'Stand' });
};
const stand = () => within(screen.getByRole('region', { name: 'Stand' }));
const kopfzeile = () => within(document.querySelector('header') as HTMLElement);
const dialog = (name: string) => within(screen.getByRole('dialog', { name }));
const auswahl = (name: string) => screen.getByLabelText(name) as HTMLSelectElement;
const optionen = (el: HTMLSelectElement) => [...el.options].map((o) => o.textContent);
const patches = () => server.aufrufe('patch');
const bestaetigen = async (knopf: string) => { await act(async () => { h.alert?.buttons?.find((b) => b.text === knopf)?.handler?.(); }); };
const klicken = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el); }); };
/** Die Mails des Verlaufs in der Reihenfolge auf der Seite (ohne die Nachricht aus dem Formular). */
const mailZeilen = () => [...screen.getByRole('region', { name: 'Verlauf' }).querySelectorAll('li.mail-zeile')] as HTMLElement[];
/** Der Wert einer Angabe („Bezeichnung | Wert") in einer Karte, ohne die Aktion darunter. */
const wert = (karte: string, label: string): string | null => {
  const zeile = [...document.querySelectorAll(`[data-karte="${karte}"] .support-angabe`)]
    .find((z) => z.querySelector('.support-angabe__label')?.textContent === label);
  return zeile?.querySelector('.support-angabe__wert')?.firstChild?.textContent ?? null;
};
/** Die Knöpfe des Stands: der erste ist der Hauptknopf (die Attrappe von IonButton trägt keine Klasse). */
const knoepfe = () => [...document.querySelectorAll('.support-stand__knoepfe button')] as HTMLButtonElement[];
const haupt = () => knoepfe()[0];
/** Wo eine Adresse umbrechen darf: jede Umbruchstelle (<wbr>) als „|". */
const umbruchStellen = (el: Element) => [...el.childNodes].map((n) => (n.nodeName === 'WBR' ? '|' : n.textContent)).join('');
const kartenReihe = () => [...document.querySelectorAll('[data-karte]')].map((k) => k.getAttribute('data-karte'));

describe('Vorgang (App): Kopf', () => {
  it('Kopfzeile „Vorgang 1" mit Einordnen und Archivieren; Kopf mit Betreff, „Nr. 1 · Gemeinde" und drei Zahlen', async () => {
    await oeffnen();
    expect(kopfzeile().getByRole('heading', { level: 1 })).toHaveTextContent('Vorgang 1');
    expect(kopfzeile().getByRole('button', { name: 'Einordnen' })).toBeEnabled();
    expect(kopfzeile().getByRole('button', { name: 'Archivieren' })).toBeEnabled();
    expect(screen.getByRole('heading', { level: 2, name: 'Chat zeigt nichts Neues' })).toBeInTheDocument();
    expect(document.querySelector('.app-header-banner__subtitle')).toHaveTextContent(/^Nr\. 1 · Kirchengemeinde Musterdorf$/);
    // Fehler vorab 5: nur Zahlen in den Kacheln -- Status, Art und Dringlichkeit stehen als Marken im Stand.
    // „Mails“ zählt wie der Verlauf („3 Nachrichten“) das Anliegen aus dem Formular mit.
    expect([...document.querySelectorAll('.app-stats-row__value')].map((k) => k.textContent)).toEqual(['3', '1', '0']);
    expect(screen.getByRole('region', { name: 'Verlauf' })).toHaveTextContent(/3 Nachrichten/);
    expect([...document.querySelectorAll('.app-stats-row__label')].map((k) => k.textContent)).toEqual(['Mails', 'Neu', 'Tage offen']);
  });

  it('eine Anfrage: „Anfrage 3", Untertitel „Nr. 3" (den Stand nennt die Marke, einmal), Kacheln Konfis · Teamer:innen · Mails', async () => {
    await oeffnen(3);
    expect(kopfzeile().getByRole('heading', { level: 1 })).toHaveTextContent('Anfrage 3');
    expect(document.querySelector('.app-header-banner__subtitle')).toHaveTextContent(/^Nr\. 3$/);
    // Jede Angabe einmal (Leitidee 4): „noch nicht angelegt" nur als Marke im Stand.
    expect(screen.getAllByText(/noch nicht angelegt/i).map((e) => e.className)).toEqual(['support-marke support-marke--warnung']);
    expect([...document.querySelectorAll('.app-stats-row__value')].map((k) => k.textContent)).toEqual(['25', '6', '2']);
    expect(screen.getByRole('region', { name: 'Verlauf' })).toHaveTextContent(/2 Nachrichten/);
    expect([...document.querySelectorAll('.app-stats-row__label')].map((k) => k.textContent)).toEqual(['Konfis', 'Teamer:innen', 'Mails']);
  });

  it('ohne Zuordnung steht keine Gemeinde im Kopf -- auch wenn der Server den Freitext als gemeinde_name liefert', async () => {
    await oeffnen(2);
    expect(document.querySelector('.app-header-banner__subtitle')).toHaveTextContent(/^Nr\. 2$/);
  });

  it('Laden, nicht gefunden und Netzfehler', async () => {
    const { unmount } = render(<SupportVorgangDetailPage vorgangId={999} />);
    expect(await screen.findByText('Vorgang nicht gefunden')).toBeInTheDocument();
    unmount();
    server.stand.fehler.set('GET /support/vorgaenge/1', new Error('Netz weg'));
    render(<SupportVorgangDetailPage vorgangId={1} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Der Vorgang konnte nicht geladen werden.');
    server.stand.fehler.delete('GET /support/vorgaenge/1');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Erneut versuchen/ })); });
    expect(await screen.findByRole('region', { name: 'Stand' })).toBeInTheDocument();
  });

  it('Ziehen zum Aktualisieren lädt den Vorgang neu; danach verschwindet der Kreisel (complete)', async () => {
    await oeffnen();
    const vorher = server.aufrufe('get', '/support/vorgaenge/1').length;
    server.stand.vorgaenge[0].betreff = 'Chat zeigt wieder alles';
    let zug: ReturnType<typeof ziehenZumAktualisieren> = { refresher: 0, fertig: () => 0 };
    await act(async () => { zug = ziehenZumAktualisieren(); });
    expect(zug.refresher).toBe(1);
    await waitFor(() => expect(zug.fertig()).toBe(1));
    expect(server.aufrufe('get', '/support/vorgaenge/1')).toHaveLength(vorher + 1);
    expect(await screen.findByRole('heading', { level: 2, name: 'Chat zeigt wieder alles' })).toBeInTheDocument();
  });
});

describe('Vorgang (App): Karte „Stand"', () => {
  it('die jüngste Nachricht kam von außen: Marken, Satz, Hauptknopf „Antworten", Nebenknopf „Erledigt", Notiz', async () => {
    await oeffnen();
    expect([...document.querySelectorAll('.support-stand .support-marke')].map((m) => m.textContent)).toEqual(['Neu', 'Dringend', 'Fehler › Chat']);
    expect(stand().getByText('Pastorin Lena Probe wartet seit heute, 09:00 auf Antwort.')).toBeInTheDocument();
    expect(knoepfe().map((k) => k.textContent)).toEqual(['Antworten', 'Erledigt']);
    expect(stand().getByRole('button', { name: 'Interne Notiz hinzufügen' })).toBeInTheDocument();
    // Ein Knopf mit eigenem Namen, keine Gruppe drumherum, die Vorlesehilfen zusätzlich ankündigten.
    expect(stand().queryByRole('group')).toBeNull();
  });

  it('eine Marke antippen öffnet „Einordnen"', async () => {
    await oeffnen();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(stand().getByRole('button', { name: 'Dringend – Einordnen' }));
    expect(screen.getByRole('dialog', { name: 'Einordnen' })).toBeInTheDocument();
  });

  it('ohne Zuordnung: Marken „Bereich fehlt" und „Keine Gemeinde"', async () => {
    await oeffnen(2);
    expect([...document.querySelectorAll('.support-stand .support-marke')].map((m) => m.textContent)).toEqual(['Neu', 'Frage', 'Bereich fehlt', 'Keine Gemeinde']);
  });

  it('„Erledigt" ist ein Aufruf; danach steht der Vorgang im Archiv und „Wiederherstellen" ist der Hauptknopf', async () => {
    await oeffnen();
    await klicken(stand().getByRole('button', { name: 'Erledigt' }));
    expect(patches().map((p) => [p.pfad, p.koerper])).toEqual([['/support/vorgaenge/1', { status: 'erledigt' }]]);
    expect(h.setSuccess).toHaveBeenCalledWith('Vorgang erledigt und ins Archiv gelegt');
    expect(await stand().findByText('Erledigt am 03.10.2026. Eine neue Mail holt ihn zurück.')).toBeInTheDocument();
    expect(haupt()).toHaveTextContent('Wiederherstellen');
    expect(kopfzeile().getByRole('button', { name: 'Wiederherstellen' })).toBeInTheDocument();
    expect(kopfzeile().queryByRole('button', { name: 'Archivieren' })).toBeNull();
  });

  it('niemand, dem sich antworten ließe: der Satz sagt es, „Gemeinde zuordnen" öffnet Einordnen, die Antwortzeile ist gesperrt', async () => {
    await oeffnen(5);
    expect(stand().getByText('Niemand, dem sich antworten ließe: keine Gemeinde, kein Kontakt.')).toBeInTheDocument();
    expect(document.querySelector('.support-antwortzeile')).toBeDisabled();
    fireEvent.click(stand().getByRole('button', { name: 'Gemeinde zuordnen' }));
    expect(screen.getByRole('dialog', { name: 'Einordnen' })).toBeInTheDocument();
  });

  it('eine Anfrage: Hauptknopf „Antworten", darunter „Gemeinde anlegen" und „Ablehnen"; „Noch nicht angelegt" ist kein Knopf', async () => {
    await oeffnen(3);
    expect(stand().getByText('Anna Beispiel wartet seit heute, 10:00 auf Antwort.')).toBeInTheDocument();
    expect(knoepfe().map((k) => k.textContent)).toEqual(['Antworten', 'Gemeinde anlegen', 'Ablehnen']);
    expect(stand().getByText('Noch nicht angelegt').tagName).toBe('SPAN');
  });

  it('Ablehnen fragt mit der Folge zurück; erst „Ablehnen" schickt den Status erledigt -- Abbrechen nichts', async () => {
    await oeffnen(3);
    fireEvent.click(stand().getByRole('button', { name: 'Ablehnen' }));
    expect(h.alert?.header).toBe('Anfrage ablehnen?');
    expect(h.alert?.message).toContain('wird nach 180 Tagen gelöscht');
    await bestaetigen('Abbrechen');
    expect(patches()).toHaveLength(0);
    fireEvent.click(stand().getByRole('button', { name: 'Ablehnen' }));
    await bestaetigen('Ablehnen');
    expect(patches().map((p) => [p.pfad, p.koerper])).toEqual([['/support/vorgaenge/3', { status: 'erledigt' }]]);
    expect(h.setSuccess).toHaveBeenCalledWith('Anfrage abgelehnt');
  });

  it('Wiederherstellen (Hauptknopf im Archiv): danach „In Arbeit"', async () => {
    await oeffnen(4);
    expect(stand().getByText('Erledigt am 03.10.2026. Eine neue Mail holt ihn zurück.')).toBeInTheDocument();
    await klicken(haupt());
    expect(server.aufrufe('post', '/support/vorgaenge/4/wiederherstellen')).toHaveLength(1);
    await waitFor(() => expect([...document.querySelectorAll('.support-stand .support-marke')][0]).toHaveTextContent('In Arbeit'));
    expect(haupt()).toHaveTextContent('Antworten');
  });

  it('Archivieren in der Kopfzeile: ein Aufruf, danach der Satz zum Archiv', async () => {
    await oeffnen();
    await klicken(kopfzeile().getByRole('button', { name: 'Archivieren' }));
    expect(server.aufrufe('post', '/support/vorgaenge/1/archivieren')).toHaveLength(1);
    expect(await stand().findByText('Im Archiv seit 03.10.2026. Eine neue Mail holt ihn zurück.')).toBeInTheDocument();
    expect(kopfzeile().getByRole('button', { name: 'Wiederherstellen' })).toBeInTheDocument();
  });

  it('ohne Netz sind Einordnen, Antworten, die Antwortzeile und Löschen gesperrt', async () => {
    h.online = false;
    await oeffnen();
    expect(kopfzeile().getByRole('button', { name: 'Einordnen' })).toBeDisabled();
    expect(haupt()).toBeDisabled();
    expect(document.querySelector('.support-antwortzeile')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Vorgang löschen' })).toBeDisabled();
  });
});

describe('Vorgang (App): Notiz im Modal', () => {
  it('leer: „Interne Notiz"; Speichern erst nach einer Änderung, getrimmt; danach steht die Notiz in der Karte', async () => {
    await oeffnen();
    fireEvent.click(stand().getByRole('button', { name: 'Interne Notiz hinzufügen' }));
    const modal = dialog('Notiz');
    expect(modal.getByRole('button', { name: 'Speichern' })).toBeDisabled();
    fireEvent.change(modal.getByLabelText('Interne Notiz'), { target: { value: '  Rückruf am Montag ' } });
    await klicken(modal.getByRole('button', { name: 'Speichern' }));
    expect(patches().map((p) => p.koerper)).toEqual([{ notiz: 'Rückruf am Montag' }]);
    expect(h.setSuccess).toHaveBeenCalledWith('Notiz gespeichert');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await stand().findByRole('button', { name: 'Interne Notiz bearbeiten: Rückruf am Montag' })).toBeInTheDocument();
  });

  it('Abbrechen mit Änderung fragt zurück; „Verwerfen" schließt ohne Aufruf, die Notiz ist wieder die alte', async () => {
    server.stand.vorgaenge[0].notiz = 'Alt';
    await oeffnen();
    fireEvent.click(stand().getByRole('button', { name: 'Interne Notiz bearbeiten: Alt' }));
    fireEvent.change(dialog('Notiz').getByLabelText('Interne Notiz'), { target: { value: 'Neu geschrieben' } });
    await klicken(dialog('Notiz').getByRole('button', { name: 'Abbrechen' }));
    expect(h.alert?.header).toBe('Ungespeicherte Änderungen');
    await bestaetigen('Abbrechen');
    expect(screen.getByRole('dialog', { name: 'Notiz' })).toBeInTheDocument();
    await klicken(dialog('Notiz').getByRole('button', { name: 'Abbrechen' }));
    await bestaetigen('Verwerfen');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(patches()).toHaveLength(0);
    fireEvent.click(stand().getByRole('button', { name: 'Interne Notiz bearbeiten: Alt' }));
    expect((dialog('Notiz').getByLabelText('Interne Notiz') as HTMLTextAreaElement).value).toBe('Alt');
  });

  it('Abbrechen ohne Änderung schließt ohne Rückfrage', async () => {
    await oeffnen();
    fireEvent.click(stand().getByRole('button', { name: 'Interne Notiz hinzufügen' }));
    await klicken(dialog('Notiz').getByRole('button', { name: 'Abbrechen' }));
    expect(h.alert).toBeNull();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('Vorgang (App): Einordnen mit Speichern', () => {
  const einordnen = () => {
    fireEvent.click(kopfzeile().getByRole('button', { name: 'Einordnen' }));
    return dialog('Einordnen');
  };

  it('die Felder zeigen den Stand; Status, Art und Dringlichkeit nennen alle Werte; der Betreff ist änderbar', async () => {
    await oeffnen();
    einordnen();
    expect(auswahl('Status').value).toBe('neu');
    expect(optionen(auswahl('Status'))).toEqual(['Neu', 'In Arbeit', 'Wartet auf Rückmeldung', 'Erledigt']);
    expect(auswahl('Art').value).toBe('fehler');
    expect(optionen(auswahl('Art'))).toEqual(['Neue Gemeinde', 'Frage zur Bedienung', 'Fehler melden', 'Wunsch oder Idee', 'Zugang und Konten', 'Lizenz und Abrechnung', 'Datenschutz', 'Sonstiges']);
    expect(auswahl('Bereich').value).toBe('chat');
    expect(auswahl('Dringlichkeit').value).toBe('dringend');
    expect(optionen(auswahl('Dringlichkeit'))).toEqual(['Normal', 'Dringend – wir können gerade nicht weiterarbeiten']);
    await waitFor(() => expect(auswahl('Gemeinde').value).toBe('7'));
    expect((screen.getByLabelText('Betreff') as HTMLInputElement).value).toBe('Chat zeigt nichts Neues');
  });

  it('ändern speichert nichts; „Speichern" schickt EIN PATCH mit genau den geänderten Feldern und schließt', async () => {
    await oeffnen();
    const modal = einordnen();
    fireEvent.change(auswahl('Art'), { target: { value: 'wunsch' } });
    fireEvent.change(auswahl('Bereich'), { target: { value: 'termine' } });
    fireEvent.change(screen.getByLabelText('Betreff'), { target: { value: 'Chat lädt keine neuen Nachrichten' } });
    expect(patches()).toHaveLength(0);
    await klicken(modal.getByRole('button', { name: 'Speichern' }));
    expect(patches().map((p) => [p.pfad, p.koerper])).toEqual([
      ['/support/vorgaenge/1', { art: 'wunsch', bereich: 'termine', betreff: 'Chat lädt keine neuen Nachrichten' }],
    ]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByRole('heading', { level: 2, name: 'Chat lädt keine neuen Nachrichten' })).toBeInTheDocument();
  });

  it('„Speichern" ohne Änderung schließt ohne Aufruf', async () => {
    await oeffnen();
    await klicken(einordnen().getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(patches()).toHaveLength(0);
  });

  it('der Bereich ist bei Frage, Fehler und Wunsch Pflicht: ohne ihn kein Aufruf, das Modal bleibt offen', async () => {
    await oeffnen(2);
    const modal = einordnen();
    expect(modal.getByText('Bereich *')).toBeInTheDocument();
    expect(optionen(auswahl('Bereich'))[0]).toBe('Bitte wählen');
    fireEvent.change(auswahl('Dringlichkeit'), { target: { value: 'dringend' } });
    await klicken(modal.getByRole('button', { name: 'Speichern' }));
    expect(modal.getByRole('alert')).toHaveTextContent('Bitte einen Bereich wählen');
    expect(patches()).toHaveLength(0);
    fireEvent.change(auswahl('Bereich'), { target: { value: 'konten' } });
    await klicken(modal.getByRole('button', { name: 'Speichern' }));
    expect(patches().map((p) => p.koerper)).toEqual([{ bereich: 'konten', dringlichkeit: 'dringend' }]);
  });

  it('„Keine Gemeinde" geht als null an den Server', async () => {
    await oeffnen();
    const modal = einordnen();
    await waitFor(() => expect(auswahl('Gemeinde').value).toBe('7'));
    fireEvent.change(auswahl('Gemeinde'), { target: { value: '' } });
    await klicken(modal.getByRole('button', { name: 'Speichern' }));
    expect(patches().map((p) => p.koerper)).toEqual([{ organization_id: null }]);
  });

  it('der Hinweis zu „Erledigt" erst bei Erledigt -- bei einer Anfrage, dass sie abgelehnt wird', async () => {
    await oeffnen(3);
    const modal = einordnen();
    expect(modal.queryByText(/Erledigt lehnt die Anfrage ab/)).toBeNull();
    fireEvent.change(auswahl('Status'), { target: { value: 'erledigt' } });
    expect(modal.getByText('Erledigt lehnt die Anfrage ab; sie wird nach 180 Tagen gelöscht.')).toBeInTheDocument();
  });

  it('ein Fehler beim Speichern: Meldung, das Modal bleibt mit der Eingabe offen', async () => {
    await oeffnen();
    const modal = einordnen();
    server.stand.fehler.set('PATCH /support/vorgaenge/1', Object.assign(new Error('x'), { response: { status: 500, data: { error: 'Datenbankfehler' } } }));
    fireEvent.change(auswahl('Art'), { target: { value: 'wunsch' } });
    await klicken(modal.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(h.setError).toHaveBeenCalledWith('Datenbankfehler'));
    expect(screen.getByRole('dialog', { name: 'Einordnen' })).toBeInTheDocument();
    expect(auswahl('Art').value).toBe('wunsch');
  });

  it('Abbrechen mit Änderung fragt zurück; ohne Änderung nicht', async () => {
    await oeffnen();
    await klicken(einordnen().getByRole('button', { name: 'Abbrechen' }));
    expect(h.alert).toBeNull();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const modal = einordnen();
    fireEvent.change(auswahl('Art'), { target: { value: 'wunsch' } });
    await klicken(modal.getByRole('button', { name: 'Abbrechen' }));
    expect(h.alert?.header).toBe('Ungespeicherte Änderungen');
    await bestaetigen('Verwerfen');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(patches()).toHaveLength(0);
  });
});

describe('Vorgang (App): Verlauf und Antworten', () => {
  it('der Verlauf: die Nachricht aus dem Formular vorn, dann die Mails, älteste zuerst; die neue als gelesen gemeldet', async () => {
    await oeffnen();
    const anliegen = screen.getByRole('region', { name: 'Anliegen aus dem Formular' });
    expect(within(anliegen).getByText('Seit gestern erscheint im Chat nichts Neues.')).toBeInTheDocument();
    // Die Adresse steht im Abschnitt „Kontakt"; am Anfang nur der Name -- jede Angabe einmal, wie im Browser.
    expect(anliegen).toHaveTextContent('Pastorin Lena Probe');
    expect(anliegen).not.toHaveTextContent('lena.probe@example.org');
    const zeilen = mailZeilen();
    expect(zeilen.map((z) => z.querySelector('time')?.getAttribute('dateTime'))).toEqual(['2026-10-03T07:00:00Z', '2026-10-03T07:30:00Z']);
    expect(within(zeilen[1]).getByText('Gesendet')).toBeInTheDocument();
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledWith('/support/mail/gelesen', { ids: [11] }));
  });

  it('?mail= in der Adresse: diese Mail ist offen und hervorgehoben', async () => {
    h.standort = { pathname: '/admin/support/vorgaenge/1', search: '?mail=11', state: null };
    await oeffnen();
    expect(document.querySelector('li[data-mail-id="11"]')).toHaveClass('mail-zeile--hervorgehoben');
    expect(document.querySelector('li[data-mail-id="12"]')).not.toHaveClass('mail-zeile--hervorgehoben');
  });

  it('die Antwortzeile unter der jüngsten Mail öffnet das Modal: „Du antwortest auf", feste Zeile „An", Betreff, Danach', async () => {
    await oeffnen();
    const zeile = screen.getByRole('button', { name: 'Antwort an Pastorin Lena Probe …' });
    // Sie steht direkt unter der jüngsten Mail.
    expect(zeile.closest('li')?.previousElementSibling).toBe(document.querySelector('li[data-mail-id="12"]'));
    fireEvent.click(zeile);
    const modal = dialog('Antworten');
    const beantwortet = within(modal.getByRole('region', { name: 'Du antwortest auf' }));
    expect(beantwortet.getByText('Du antwortest auf · Pastorin Lena Probe · heute, 09:00')).toBeInTheDocument();
    expect(beantwortet.getByText('Seit gestern erscheint im Chat nichts Neues.')).toBeInTheDocument();
    // Genau eine Adresse: eine feste Zeile mit lesbarer Herkunft statt einer Wahl.
    expect(modal.queryByLabelText('Empfänger')).toBeNull();
    expect(document.querySelector('.support-antwort__feste')).toHaveTextContent('AnPastorin Lena Probe <lena.probe@example.org> · schrieb uns · von support@');
    await waitFor(() => expect((modal.getByLabelText('Betreff') as HTMLInputElement).value).toBe('Re: Chat zeigt nichts Neues'));
    const danach = within(modal.getByRole('tablist', { name: 'Danach' }));
    expect(danach.getAllByRole('tab').map((t) => [t.textContent, t.getAttribute('aria-selected')])).toEqual([
      ['Wartet', 'true'], ['In Arbeit', 'false'], ['Erledigt', 'false'],
    ]);
    // Die Vorschau ist eingeklappt.
    expect(modal.queryByRole('region', { name: 'Vorschau der Antwort' })).toBeNull();
  });

  it('„Du antwortest auf": „ganz lesen" steht da, sobald die drei Zeilen nicht reichen -- gemessen, nicht nach Zeichen gezählt', async () => {
    // jsdom rechnet kein Layout: die Höhen kommen hier herein. Gekürzt (drei Zeilen) misst der Text 60 px, braucht aber `noetig`.
    let noetig = 90;
    const hoehe = (el: Element, gekuerzt: number) => (el.classList.contains('support-beantwortet__text') ? gekuerzt : 0);
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get() { return hoehe(this, noetig); } });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get() { return hoehe(this, 60); } });
    try {
      // Kurzer Text (44 Zeichen), große Schrift: Er läuft über -- bis 11.10.2026 gab es dann keinen Weg, ihn ganz zu lesen.
      await oeffnen();
      fireEvent.click(document.querySelector('.support-antwortzeile') as HTMLElement);
      const beantwortet = within(dialog('Antworten').getByRole('region', { name: 'Du antwortest auf' }));
      const knopf = beantwortet.getByRole('button', { name: 'ganz lesen' });
      expect(knopf).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(knopf);
      expect(beantwortet.getByRole('button', { name: 'kürzer' })).toHaveAttribute('aria-expanded', 'true');
      cleanup();

      // Langer Text, der in drei Zeilen passt (breites Gerät): kein Knopf, der nichts täte.
      noetig = 60;
      server.stand.mails.find((m) => m.id === 11)!.text = 'Seit gestern erscheint im Chat nichts Neues. '.repeat(4).trim();
      await oeffnen();
      fireEvent.click(document.querySelector('.support-antwortzeile') as HTMLElement);
      const lang = within(dialog('Antworten').getByRole('region', { name: 'Du antwortest auf' }));
      expect(lang.getByText(/^Seit gestern/).textContent?.length).toBeGreaterThan(120);
      expect(lang.queryByRole('button', { name: 'ganz lesen' })).toBeNull();
    } finally {
      delete (HTMLElement.prototype as { scrollHeight?: number }).scrollHeight;
      delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
    }
  });

  it('Senden in der Kopfzeile: Rückfrage, dann EIN Aufruf mit Adresse, gewähltem Status und der beantworteten Mail; das Modal schließt', async () => {
    await oeffnen();
    fireEvent.click(haupt());
    const modal = dialog('Antworten');
    fireEvent.change(modal.getByLabelText('Text der Antwort'), { target: { value: 'Danke für die Rückmeldung.\n\n' } });
    fireEvent.click(modal.getByRole('tab', { name: 'In Arbeit' }));
    fireEvent.click(modal.getByRole('button', { name: 'Senden' }));
    expect(h.alert?.header).toBe('Antwort senden');
    expect(server.aufrufe('post', /antworten$/)).toHaveLength(0);
    await bestaetigen('Senden');
    // Seit 12.10.2026 geht „Danach" im Körper mit, dazu die Mail aus „Du antwortest auf" (11, die jüngste eingehende --
    // nicht die eigene Antwort 12 danach). Der Server bestätigt den Status: kein PATCH mehr (bis dahin ein zweiter Aufruf).
    expect(server.aufrufe('post', '/support/vorgaenge/1/antworten')[0].koerper).toEqual({
      text: 'Danke für die Rückmeldung.', betreff: 'Re: Chat zeigt nichts Neues', an: 'lena.probe@example.org', status: 'in_arbeit', antwort_auf: 11,
    });
    await waitFor(() => expect(h.setSuccess).toHaveBeenCalledWith('Antwort gesendet'));
    expect(patches()).toEqual([]);
    expect(server.stand.vorgaenge[0].status).toBe('in_arbeit');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Antworten' })).toBeNull());
    await waitFor(() => expect(mailZeilen()).toHaveLength(3));
  });

  it('bei einer Anfrage, die noch nicht angelegt ist, bietet „Danach" kein Erledigt', async () => {
    await oeffnen(3);
    fireEvent.click(document.querySelector('.support-antwortzeile') as HTMLElement);
    const danach = within(dialog('Antworten').getByRole('tablist', { name: 'Danach' }));
    expect(danach.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Wartet', 'In Arbeit']);
  });

  it('eine abgelehnte Anfrage (erledigt, im Archiv): die Antwort geht ohne „Danach“, der Status bleibt -- kein PATCH', async () => {
    // Ablehnen schickt keine Absage-Mail; wer sie danach schreibt, darf die Ablehnung nicht still zurücknehmen.
    Object.assign(server.stand.vorgaenge[2], { status: 'erledigt', archiviert_am: '2026-10-02T12:00:00Z', anfrage: { ...ANFRAGE_41, status: 'abgelehnt' } });
    await oeffnen(3);
    expect(haupt()).toHaveTextContent('Wiederherstellen');
    fireEvent.click(document.querySelector('.support-antwortzeile') as HTMLElement);
    const modal = dialog('Antworten');
    expect(modal.queryByRole('tablist', { name: 'Danach' })).toBeNull();
    fireEvent.change(modal.getByLabelText('Text der Antwort'), { target: { value: 'Leider können wir euch derzeit keinen Zugang geben.' } });
    fireEvent.click(modal.getByRole('button', { name: 'Senden' }));
    await bestaetigen('Senden');
    await waitFor(() => expect(server.aufrufe('post', '/support/vorgaenge/3/antworten')).toHaveLength(1));
    expect(h.setSuccess).toHaveBeenCalledWith('Antwort gesendet');
    expect(patches()).toEqual([]);
    // Ohne „Danach" auch kein Status im Körper -- nur die beantwortete Mail.
    const koerper = server.aufrufe('post', '/support/vorgaenge/3/antworten')[0].koerper as Record<string, unknown>;
    expect(koerper.antwort_auf).toBe(31);
    expect(Object.keys(koerper).sort()).toEqual(['antwort_auf', 'betreff', 'text']);
    expect(server.aufrufe('post', '/support/vorgaenge/3/wiederherstellen')).toEqual([]);
  });

  it('mehrere Adressen: die Wahl mit Herkunft, vorgewählt ist, wer zuletzt schrieb', async () => {
    server.stand.vorgaenge[0].kontakt_email = 'sekretariat@example.org';
    await oeffnen();
    fireEvent.click(document.querySelector('.support-antwortzeile') as HTMLElement);
    const empfaenger = dialog('Antworten').getByLabelText('Empfänger') as HTMLSelectElement;
    expect(optionen(empfaenger)).toEqual([
      'Bitte wählen', 'Pastorin Lena Probe <lena.probe@example.org> · schrieb uns', 'Pastorin Lena Probe <sekretariat@example.org> · Kontakt aus dem Formular',
    ]);
    expect(empfaenger.value).toBe('lena.probe@example.org');
  });

  it('„Im Vorgang antworten" am Kontakt öffnet das Modal mit dieser Adresse', async () => {
    server.stand.vorgaenge[0].kontakt_email = 'sekretariat@example.org';
    await oeffnen();
    const kontakt = document.querySelector('[data-karte="kontakt"]') as HTMLElement;
    fireEvent.click(within(kontakt).getByRole('button', { name: 'Im Vorgang antworten' }));
    expect((dialog('Antworten').getByLabelText('Empfänger') as HTMLSelectElement).value).toBe('sekretariat@example.org');
  });

  it('Abbrechen mit getipptem Text fragt zurück, bevor die Antwort verloren geht', async () => {
    await oeffnen();
    fireEvent.click(document.querySelector('.support-antwortzeile') as HTMLElement);
    fireEvent.change(dialog('Antworten').getByLabelText('Text der Antwort'), { target: { value: 'Halb geschrieben' } });
    await klicken(dialog('Antworten').getByRole('button', { name: 'Abbrechen' }));
    expect(h.alert?.header).toBe('Ungespeicherte Änderungen');
    await bestaetigen('Abbrechen');
    expect((dialog('Antworten').getByLabelText('Text der Antwort') as HTMLTextAreaElement).value).toBe('Halb geschrieben');
  });

  it('Menü einer Mail: „In anderen Vorgang verschieben" -- der eigene Vorgang steht nicht zur Wahl, die Mail geht allein', async () => {
    await oeffnen();
    fireEvent.click(screen.getAllByRole('button', { name: 'Aktionen zur Mail von Pastorin Lena Probe' })[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'In anderen Vorgang verschieben' }));
    const modal = dialog('In anderen Vorgang verschieben');
    expect(modal.getByText('Nur diese Mail wird verschoben; der Rest des Vorgangs bleibt, wo er ist.')).toBeInTheDocument();
    // Die Handlung ist im Menü gewählt: keine Wahl „Einsortieren in" -- Titel und Knopf können nicht auseinanderlaufen.
    expect(modal.queryByRole('tablist', { name: 'Einsortieren in' })).toBeNull();
    const wahl = await waitFor(() => {
      const el = modal.getByLabelText('Vorgang') as HTMLSelectElement;
      expect(el.options.length).toBeGreaterThan(1);
      return el;
    });
    expect([...wahl.options].map((o) => o.value)).not.toContain('1');
    fireEvent.change(wahl, { target: { value: '6' } });
    await klicken(modal.getByRole('button', { name: 'Verschieben' }));
    expect(server.aufrufe('post', '/support/mail/nachrichten/11/einsortieren').map((a) => a.koerper)).toEqual([{ vorgang_id: 6 }]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Menü einer Mail: „In neuen Vorgang herauslösen" zeigt gleich die Felder des neuen Vorgangs; Titel und Knopf nennen dieselbe Handlung', async () => {
    await oeffnen();
    fireEvent.click(screen.getAllByRole('button', { name: 'Aktionen zur Mail von Pastorin Lena Probe' })[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'In neuen Vorgang herauslösen' }));
    const modal = dialog('In neuen Vorgang herauslösen');
    expect(modal.queryByRole('tablist', { name: 'Einsortieren in' })).toBeNull();
    expect(modal.getByLabelText('Art')).toBeInTheDocument();
    expect(modal.queryByLabelText('Vorgang')).toBeNull();
    expect(modal.getByRole('button', { name: 'Herauslösen' })).toBeInTheDocument();
    expect(modal.queryByRole('button', { name: 'Verschieben' })).toBeNull();
  });
});

describe('Vorgang (App): Angaben', () => {
  it('Kontakt und Gemeinde in dieser Reihenfolge; jede Angabe einmal', async () => {
    await oeffnen();
    expect(kartenReihe()).toEqual(['kontakt', 'gemeinde']);
    expect(wert('kontakt', 'Person')).toBe('Pastorin Lena Probe (Gemeindeleitung)');
    const adresse = within(document.querySelector('[data-karte="kontakt"]') as HTMLElement).getByRole('link', { name: 'lena.probe@example.org' });
    expect(adresse).toHaveAttribute('href', 'mailto:lena.probe@example.org');
    // Eine lange Adresse bricht vor dem @ und vor Punkten um, nicht mitten im Wort.
    expect(umbruchStellen(adresse)).toBe('lena|.probe|@example|.org');
    expect(wert('kontakt', 'Eingang')).toBe('Support-Formular auf der Homepage');
    expect(wert('gemeinde', 'Laufzeit')).toBe('Testphase bis 02.11.');
    expect(wert('gemeinde', 'Konfis')).toBe('3 von 5');
    expect(wert('gemeinde', 'Kreis')).toBe('Dithmarschen › Nordkirche');
    // Ein Name aus dem Formular erscheint nicht neben der zugeordneten Gemeinde.
    expect(wert('kontakt', 'Gemeinde')).toBeNull();
  });

  it('die Gemeindeleitung ist eingeklappt; aufgeklappt mit Adresse und letzter Anmeldung', async () => {
    await oeffnen();
    const knopf = screen.getByRole('button', { name: 'Gemeindeleitung (1)' });
    expect(knopf).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelector('.support-leitung')).toBeNull();
    fireEvent.click(knopf);
    const leitung = within(document.querySelector('.support-leitung') as HTMLElement);
    expect(leitung.getByText('Pastorin Lena Probe')).toBeInTheDocument();
    const adresse = leitung.getByRole('link', { name: 'lena.probe@example.org' });
    expect(adresse).toHaveAttribute('href', 'mailto:lena.probe@example.org');
    expect(umbruchStellen(adresse)).toBe('lena|.probe|@example|.org');
    expect(leitung.getByText(/zuletzt angemeldet 02\.10\.2026/)).toBeInTheDocument();
  });

  it('Gemeinde öffnen und Alle Vorgänge führen zu ihr', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Gemeinde öffnen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Alle Vorgänge' }));
    expect(h.push.mock.calls.map((c) => c[0])).toEqual(['/admin/organizations?gemeinde=7', '/admin/support/vorgaenge?gemeinde=7']);
  });

  it('ohne Zuordnung: „Nicht zugeordnet – laut Formular" im Kontakt, „Zuordnen" öffnet Einordnen; keine Gemeinde-Karte', async () => {
    await oeffnen(2);
    expect(kartenReihe()).toEqual(['kontakt']);
    expect(wert('kontakt', 'Gemeinde')).toBe('Nicht zugeordnet – laut Formular: Kirchengemeinde Heide');
    fireEvent.click(screen.getByRole('button', { name: 'Zuordnen' }));
    expect(screen.getByRole('dialog', { name: 'Einordnen' })).toBeInTheDocument();
    expect(document.querySelectorAll('a[href*="gemeinde=null"]')).toHaveLength(0);
  });

  it('eine Anfrage: Karte „Anfrage" vor dem Kontakt; der Kontakt mit Mobil -- auch in der App', async () => {
    await oeffnen(3);
    expect(kartenReihe()).toEqual(['anfrage', 'kontakt']);
    expect(wert('anfrage', 'Gemeinde')).toBe('Kirchengemeinde Lindenau (angefragt)');
    expect(wert('anfrage', 'Wunsch')).toBe('Standard — bis 50 Konfis · 99\u00a0€ pro Jahr');
    expect(wert('anfrage', 'Eingang')).toBe('Anfrage über die Homepage');
    expect(wert('kontakt', 'Person')).toBe('Anna Beispiel (Pastorin)');
    expect(screen.getByRole('link', { name: '0170 1234567' })).toHaveAttribute('href', 'tel:01701234567');
  });

  it('der Kirchenkreis der Anfrage: „steht in der Struktur" ohne Knopf; fehlt er, „fehlt noch" und „Als Kirchenkreis anlegen" legt ihn an', async () => {
    const { unmount } = render(<SupportVorgangDetailPage vorgangId={3} />);
    await waitFor(() => expect(wert('anfrage', 'Kreis')).toBe('Dithmarschen › Nordkirche · steht in der Struktur'));
    expect(screen.queryByRole('button', { name: 'Als Kirchenkreis anlegen' })).toBeNull();
    unmount();

    server.stand.vorgaenge[2].anfrage = { ...ANFRAGE_41, kirchenkreis: 'Steinburg' };
    await oeffnen(3);
    await waitFor(() => expect(wert('anfrage', 'Kreis')).toBe('Steinburg › Nordkirche · fehlt noch'));
    const karte = within(document.querySelector('[data-karte="anfrage"]') as HTMLElement);
    await klicken(karte.getByRole('button', { name: 'Als Kirchenkreis anlegen' }));
    expect(server.aufrufe('post', '/support/kirchenkreise').map((a) => a.koerper)).toEqual([{ name: 'Steinburg', landeskirche_id: 1 }]);
  });

  it('ein Vorgang aus einer Mail: Kontakt ist, wer die erste eingehende Mail schrieb', async () => {
    await oeffnen(6);
    expect(wert('kontakt', 'Person')).toBe('Küster Hans');
    expect(wert('kontakt', 'Eingang')).toBe('Mail an support@');
  });
});

describe('Vorgang (App): Gemeinde anlegen im Vollbild-Modal', () => {
  const feld = (name: string) => screen.getByLabelText(name) as HTMLInputElement;
  const anlegenOeffnen = async () => {
    await oeffnen(3);
    const knopf = stand().getByRole('button', { name: 'Gemeinde anlegen' });
    await waitFor(() => expect(knopf).toBeEnabled());
    fireEvent.click(knopf);
    return dialog('Gemeinde anlegen');
  };

  it('oben die Zeile aus der Anfrage, darunter das vorbelegte Formular', async () => {
    const modal = await anlegenOeffnen();
    expect(modal.getByText('Anna Beispiel (Pastorin) · 25 Konfis · 6 Teamer:innen · Wunsch Standard')).toBeInTheDocument();
    await waitFor(() => expect(auswahl('Kirchenkreis').value).toBe('11'));
    expect(feld('Name der Gemeinde').value).toBe('Kirchengemeinde Lindenau');
    expect(feld('Benutzername').value).toBe('anna.beispiel');
    expect(feld('Passwort').value).toBe('');
  });

  it('ohne Passwort: Meldung, keine Rückfrage, kein Aufruf', async () => {
    const modal = await anlegenOeffnen();
    fireEvent.click(modal.getByRole('button', { name: 'Anlegen' }));
    expect(h.setError).toHaveBeenCalledWith('Alle Felder der Gemeindeleitung sind erforderlich');
    expect(h.alert).toBeNull();
    expect(server.aufrufe('post', /anlegen$/)).toHaveLength(0);
  });

  it('fragt nach, legt an; das Modal schließt, der Stand nennt den Benutzernamen, „Gemeinde öffnen" führt hin', async () => {
    const modal = await anlegenOeffnen();
    await waitFor(() => expect(auswahl('Kirchenkreis').value).toBe('11'));
    fireEvent.change(feld('Passwort'), { target: { value: BEISPIELWERT } });
    fireEvent.click(modal.getByRole('button', { name: 'Anlegen' }));
    expect(h.alert?.message).toBe('„Kirchengemeinde Lindenau“ mit der Gemeindeleitung „Anna Beispiel“ (anna.beispiel) anlegen?');
    expect(server.aufrufe('post', /anlegen$/)).toHaveLength(0);
    await bestaetigen('Anlegen');
    await waitFor(() => expect(server.aufrufe('post', '/support/anfragen/41/anlegen')).toHaveLength(1));
    expect(server.aufrufe('post', '/support/anfragen/41/anlegen')[0].koerper).toMatchObject({
      display_name: 'Kirchengemeinde Lindenau', kirchenkreis_id: 11, admin_username: 'anna.beispiel', admin_password: BEISPIELWERT,
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(h.alert?.header).toBe('Gemeinde anlegen');
    expect(await stand().findByText('Gemeinde angelegt am 03.10.2026. Benutzername der Gemeindeleitung: anna.beispiel – Benutzername und Passwort getrennt weitergeben.')).toBeInTheDocument();
    fireEvent.click(stand().getByRole('button', { name: 'Gemeinde öffnen' }));
    expect(h.push).toHaveBeenCalledWith('/admin/organizations?gemeinde=77');
  });

  it('Schließen mit Eingaben fragt zurück; „Verwerfen" setzt das Formular auf die Anfrage zurück', async () => {
    const modal = await anlegenOeffnen();
    fireEvent.change(feld('Passwort'), { target: { value: BEISPIELWERT } });
    await klicken(modal.getByRole('button', { name: 'Abbrechen' }));
    expect(h.alert?.header).toBe('Ungespeicherte Änderungen');
    await bestaetigen('Abbrechen');
    expect(feld('Passwort').value).toBe(BEISPIELWERT);
    await klicken(dialog('Gemeinde anlegen').getByRole('button', { name: 'Abbrechen' }));
    await bestaetigen('Verwerfen');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(stand().getByRole('button', { name: 'Gemeinde anlegen' }));
    expect(feld('Passwort').value).toBe('');
  });

  it('ein Vorgang ohne Anfrage hat weder ihre Angaben noch „Gemeinde anlegen"', async () => {
    await oeffnen(1);
    expect(document.querySelector('[data-karte="anfrage"]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Gemeinde anlegen' })).toBeNull();
  });
});

describe('Vorgang (App): Löschen allein ganz unten', () => {
  it('fragt zuerst; erst „Löschen" löscht und führt zur Liste', async () => {
    await oeffnen();
    const knopf = screen.getByRole('button', { name: 'Vorgang löschen' });
    // Der einzige Knopf nach den Angaben.
    const letzteKarte = [...document.querySelectorAll('[data-karte]')].pop() as HTMLElement;
    expect(letzteKarte.compareDocumentPosition(knopf) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(knopf);
    expect(h.alert?.header).toBe('Vorgang löschen');
    expect(server.aufrufe('delete')).toHaveLength(0);
    await bestaetigen('Löschen');
    expect(server.aufrufe('delete', '/support/vorgaenge/1')).toHaveLength(1);
    expect(h.setSuccess).toHaveBeenCalledWith('Vorgang gelöscht');
    expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge', 'back', 'replace');
  });

  it('Abbrechen löscht nichts', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Vorgang löschen' }));
    await bestaetigen('Abbrechen');
    expect(server.aufrufe('delete')).toHaveLength(0);
    expect(h.push).not.toHaveBeenCalled();
  });

  it('bei einer Anfrage heißt der Knopf „Vorgang und Anfrage löschen"', async () => {
    await oeffnen(3);
    fireEvent.click(screen.getByRole('button', { name: 'Vorgang und Anfrage löschen' }));
    expect(h.alert?.message).toContain('und der Anfrage gelöscht');
  });
});

describe('Vorgang: nur für den Support', () => {
  it('eine Gemeindeleitung ohne Merkmal sieht den Hinweis, ohne Abruf', () => {
    h.user = { id: 5, role_name: 'org_admin', is_super_admin: false };
    render(<SupportVorgangDetailPage vorgangId={1} />);
    expect(screen.getByText('Nur für den Support')).toBeInTheDocument();
    expect(h.apiGet).not.toHaveBeenCalled();
  });
});
