// Ein Vorgang der Support-Ansicht in der App-Fassung (/admin/support/
// vorgaenge/:id), gerendert (docs/planung/support-vorgaenge.md, Entscheidung 7):
// Kopf mit Betreff, Nummer und Status; „Einordnen“ (Art, Bereich, Dringlichkeit,
// Status, Gemeinde -- jede Änderung sofort gespeichert); Kontakt; Gemeinde mit
// Gemeindeleitung; Angaben der Anfrage und „Gemeinde anlegen“; Verlauf und
// Antwort; Notiz; Archivieren, Wiederherstellen, Löschen. Die zweispaltige
// Web-Fassung steht in webVorgangDetail.test.tsx -- beide teilen die Logik.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import type { AlertOptionen } from './ionicAttrappe';
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
}));

vi.mock('@ionic/react', async () => (await import('./ionicAttrappe')).ionicAttrappe({
  presentAlert: (o) => { h.alert = o; },
  router: { push: h.push, goBack: vi.fn(), canGoBack: () => false },
}));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('./ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: ({ message }: { message: string }) => <p>{message}</p> }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: h.online }),
}));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => false }));

import SupportVorgangDetailPage from '../../../components/support/SupportVorgangDetailPage';
import { supportMailZaehlerZuruecksetzen } from '../../../navigation/supportMailZaehler';

// Erfundener Wert fuer das Passwortfeld. Zusammengesetzt statt als
// Zeichenkette, damit Geheimnis-Scanner (GitGuardian, PR #220) einen
// Testwert nicht als Passwort im oeffentlichen Repo melden.
const BEISPIELWERT = ['Beispiel', '2026', 'Wert!'].join('-');

let server: ReturnType<typeof vorgaengeServer>;

beforeEach(() => {
  vi.clearAllMocks();
  h.alert = null;
  h.online = true;
  h.user = { id: 9, role_name: 'super_admin', is_super_admin: true };
  supportMailZaehlerZuruecksetzen();
  server = vorgaengeServer({
    vorgaenge: [
      vorgang(1, { art: 'fehler', bereich: 'chat', dringlichkeit: 'dringend', status: 'neu', betreff: 'Chat zeigt nichts Neues', organization_id: 7,
        beschreibung: 'Seit gestern erscheint im Chat nichts Neues.', kontakt_name: 'Pastorin Lena Probe', kontakt_email: 'lena.probe@example.org', kontakt_funktion: 'Gemeindeleitung',
        gemeinde_angabe: 'Kirchengemeinde Musterdorf' }),
      vorgang(2, { art: 'frage', bereich: null, status: 'neu', betreff: 'Wie lege ich einen Jahrgang an?', organization_id: null,
        beschreibung: 'Wir sind neu dabei.', kontakt_name: 'Anna Beispiel', kontakt_email: 'anna@example.org', gemeinde_angabe: 'Kirchengemeinde Heide' }),
      vorgang(3, { art: 'neue_gemeinde', bereich: null, status: 'neu', betreff: 'Anfrage Kirchengemeinde Lindenau', quelle: 'anfrage', anfrage_id: 41, anfrage: { ...ANFRAGE_41 } }),
      vorgang(4, { art: 'zugang', bereich: null, status: 'erledigt', betreff: 'Konto entsperrt', organization_id: 7, archiviert_am: '2026-10-02T12:00:00Z' }),
      vorgang(5, { art: 'sonstiges', bereich: null, status: 'in_arbeit', betreff: 'Intern notiert', quelle: 'support' }),
    ],
    mails: [
      mail(11, 1, { betreff: 'Chat zeigt nichts Neues', text: 'Seit gestern erscheint im Chat nichts Neues.', gesendet_am: '2026-10-03T07:00:00Z' }),
      mail(12, 1, { richtung: 'aus', von_adresse: 'support@konfi-quest.example', von_name: 'Support', an_adressen: ['lena.probe@example.org'], betreff: 'Re: Chat zeigt nichts Neues [Vorgang 1]', text: 'Wir schauen nach.', gesendet_am: '2026-10-03T07:30:00Z', gelesen_am: '2026-10-03T07:30:00Z' }),
      mail(31, 3, { postfach: 'moin', von_adresse: 'anna@example.org', von_name: 'Anna Beispiel', an_adressen: ['moin@konfi-quest.example'], betreff: 'Eure Anfrage bei Konfi Quest [Anfrage 41]', text: 'Wann geht es los?', gelesen_am: '2026-10-03T07:00:00Z' }),
    ],
  });
  server.installieren({ get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete });
});

const oeffnen = async (id = 1) => {
  render(<SupportVorgangDetailPage vorgangId={id} />);
  await screen.findByRole('button', { name: 'Notiz speichern' });
};
const auswahl = (name: string) => screen.getByLabelText(name) as HTMLSelectElement;
const optionen = (el: HTMLSelectElement) => [...el.options].map((o) => o.textContent);
const patches = () => server.aufrufe('patch');
const bestaetigen = async (knopf: string) => { await act(async () => { h.alert?.buttons?.find((b) => b.text === knopf)?.handler?.(); }); };

describe('Vorgang (App): Aufbau', () => {
  it('Kopf: Betreff, Nummer mit Herkunft und die drei Kennzahlen', async () => {
    await oeffnen();
    expect(screen.getByRole('heading', { level: 2, name: 'Chat zeigt nichts Neues' })).toBeInTheDocument();
    expect(screen.getByText('Vorgang 1 · Support-Formular auf der Homepage')).toBeInTheDocument();
    expect(screen.getByText('Fehler')).toBeInTheDocument();
    expect(screen.getByText('Dringend')).toBeInTheDocument();
  });

  it('das Anliegen steht als eigener Abschnitt; der Verlauf zeigt die Mails, älteste zuerst', async () => {
    await oeffnen();
    expect(screen.getAllByText('Seit gestern erscheint im Chat nichts Neues.').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('article').map((m) => m.getAttribute('aria-label'))).toEqual([
      'Eingegangen am 03.10.2026, 09:00', 'Gesendet am 03.10.2026, 09:30',
    ]);
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledWith('/support/mail/gelesen', { ids: [11] }));
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
    expect(await screen.findByRole('button', { name: 'Notiz speichern' })).toBeInTheDocument();
  });
});

describe('Vorgang (App): Einordnen', () => {
  it('die fünf Auswahlfelder zeigen den Stand; Art, Status und Dringlichkeit nennen alle Werte', async () => {
    await oeffnen();
    expect(auswahl('Art').value).toBe('fehler');
    expect(optionen(auswahl('Art'))).toEqual(['Neue Gemeinde', 'Frage zur Bedienung', 'Fehler melden', 'Wunsch oder Idee', 'Zugang und Konten', 'Lizenz und Abrechnung', 'Datenschutz', 'Sonstiges']);
    expect(auswahl('Bereich').value).toBe('chat');
    expect(auswahl('Dringlichkeit').value).toBe('dringend');
    expect(optionen(auswahl('Dringlichkeit'))).toEqual(['Normal', 'Dringend – wir können gerade nicht weiterarbeiten']);
    expect(auswahl('Status').value).toBe('neu');
    expect(optionen(auswahl('Status'))).toEqual(['Neu', 'In Arbeit', 'Wartet auf Rückmeldung', 'Erledigt']);
    expect(auswahl('Gemeinde').value).toBe('7');
    expect(screen.getByText('Erledigte Vorgänge liegen im Archiv. Eine neue Mail holt den Vorgang zurück.')).toBeInTheDocument();
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
    await waitFor(() => expect(auswahl('Gemeinde').value).toBe('8'));
  });

  it('„Kein Bereich“ und „Keine Gemeinde“ gehen als null an den Server', async () => {
    await oeffnen();
    fireEvent.change(auswahl('Bereich'), { target: { value: '' } });
    await waitFor(() => expect(patches()).toHaveLength(1));
    fireEvent.change(auswahl('Gemeinde'), { target: { value: '' } });
    await waitFor(() => expect(patches()).toHaveLength(2));
    expect(patches()[0].koerper).toEqual({ bereich: null });
    expect(patches()[1].koerper).toEqual({ organization_id: null });
  });

  it('Status „Erledigt“: der Vorgang liegt danach im Archiv und bietet „Wiederherstellen“', async () => {
    await oeffnen();
    fireEvent.change(auswahl('Status'), { target: { value: 'erledigt' } });
    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(h.setSuccess).toHaveBeenCalledWith('Vorgang erledigt und ins Archiv gelegt');
    expect(await screen.findByText('Erledigt und im Archiv')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wiederherstellen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archivieren' })).toBeNull();
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

describe('Vorgang (App): Kontakt und Gemeinde', () => {
  it('Kontakt aus dem Formular und die Gemeinde mit ihrer Gemeindeleitung', async () => {
    await oeffnen();
    expect(screen.getByText('Pastorin Lena Probe')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'lena.probe@example.org' })[0]).toHaveAttribute('href', 'mailto:lena.probe@example.org');
    expect(screen.getByText('Gemeinde laut Formular')).toBeInTheDocument();
    expect(screen.getByText('Gemeindeleitung', { selector: '.app-info-row__label' })).toBeInTheDocument();
    expect(screen.getByText(/zuletzt angemeldet/)).toBeInTheDocument();
  });

  it('ohne Gemeinde: der Hinweis nennt die Angabe aus dem Formular; mit gewählter Gemeinde verschwindet er', async () => {
    await oeffnen(2);
    expect(screen.getByText('Noch keiner Gemeinde zugeordnet')).toBeInTheDocument();
    expect(screen.getByText('Kirchengemeinde Heide', { selector: 'strong' })).toBeInTheDocument();
    fireEvent.change(auswahl('Gemeinde'), { target: { value: '7' } });
    await waitFor(() => expect(patches()[0].koerper).toEqual({ organization_id: 7 }));
    await waitFor(() => expect(screen.queryByText('Noch keiner Gemeinde zugeordnet')).toBeNull());
  });

  it('ohne Gemeinde und ohne Angabe im Formular sagt der Hinweis das', async () => {
    await oeffnen(5);
    expect(screen.getByText(/Im Formular wurde keine Gemeinde genannt/)).toBeInTheDocument();
  });
});

describe('Vorgang (App): Antworten', () => {
  it('mit Gemeinde: von support@ an eine Adresse der Gemeindeleitung; Senden mit Rückfrage an den Vorgang', async () => {
    await oeffnen();
    const empfaenger = await waitFor(() => {
      const el = screen.getByLabelText('Empfänger') as HTMLSelectElement;
      expect(el.options.length).toBeGreaterThan(1);
      return el;
    });
    await waitFor(() => expect([...empfaenger.options].map((o) => o.textContent)).toEqual(['Bitte wählen', 'Pastorin Lena Probe <lena.probe@example.org> · Gemeindeleitung']));
    fireEvent.change(empfaenger, { target: { value: 'lena.probe@example.org' } });
    fireEvent.change(screen.getByLabelText('Text der Antwort'), { target: { value: 'Danke für die Rückmeldung.\n\n' } });
    fireEvent.click(screen.getByRole('button', { name: 'Antwort senden' }));
    expect(h.alert?.header).toBe('Antwort senden');
    expect(server.aufrufe('post', /antworten$/)).toHaveLength(0);
    await bestaetigen('Senden');
    expect(server.aufrufe('post', '/support/vorgaenge/1/antworten')[0].koerper).toEqual({
      text: 'Danke für die Rückmeldung.', betreff: 'Re: Chat zeigt nichts Neues [Vorgang 1]', an: 'lena.probe@example.org',
    });
    expect(h.setSuccess).toHaveBeenCalledWith('Antwort gesendet');
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(3));
  });

  it('ohne gewählten Empfänger: Meldung, keine Rückfrage, kein Versand', async () => {
    server.stand.vorgaenge[0].kontakt_email = 'sekretariat@example.org';
    await oeffnen();
    await waitFor(() => expect((screen.getByLabelText('Empfänger') as HTMLSelectElement).options.length).toBe(3));
    fireEvent.change(screen.getByLabelText('Text der Antwort'), { target: { value: 'Hallo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Antwort senden' }));
    expect(h.setError).toHaveBeenCalledWith('Bitte einen Empfänger wählen');
    expect(h.alert).toBeNull();
  });

  it('niemand zum Antworten: Hinweis statt Formular', async () => {
    await oeffnen(5);
    expect(screen.getByText('Es gibt noch niemanden, dem sich antworten ließe')).toBeInTheDocument();
    expect(screen.queryByLabelText('Text der Antwort')).toBeNull();
  });
});

describe('Vorgang (App): Notiz, Archivieren, Löschen', () => {
  it('Notiz: Speichern erst nach einer Änderung; getrimmt an den Server, leer als null', async () => {
    await oeffnen();
    const speichern = screen.getByRole('button', { name: 'Notiz speichern' });
    expect(speichern).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Notiz'), { target: { value: '  Rückruf am Montag ' } });
    expect(speichern).toBeEnabled();
    await act(async () => { fireEvent.click(speichern); });
    expect(patches()[0]).toMatchObject({ pfad: '/support/vorgaenge/1', koerper: { notiz: 'Rückruf am Montag' } });
    expect(h.setSuccess).toHaveBeenCalledWith('Notiz gespeichert');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Notiz speichern' })).toBeDisabled());
    fireEvent.change(screen.getByLabelText('Notiz'), { target: { value: '   ' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Notiz speichern' })); });
    expect(patches()[1].koerper).toEqual({ notiz: null });
  });

  it('Archivieren: eine Anfrage an den Vorgang; er zeigt danach, dass er im Archiv liegt', async () => {
    await oeffnen();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Archivieren' })); });
    expect(server.aufrufe('post', '/support/vorgaenge/1/archivieren')).toHaveLength(1);
    expect(await screen.findByText('Dieser Vorgang liegt im Archiv')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wiederherstellen' })).toBeInTheDocument();
  });

  it('Wiederherstellen: danach steht der Vorgang „In Arbeit“', async () => {
    await oeffnen(4);
    expect(screen.getByText('Erledigt und im Archiv')).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Wiederherstellen' })); });
    expect(server.aufrufe('post', '/support/vorgaenge/4/wiederherstellen')).toHaveLength(1);
    await waitFor(() => expect(screen.queryByText('Erledigt und im Archiv')).toBeNull());
    expect(auswahl('Status').value).toBe('in_arbeit');
  });

  it('Löschen fragt zuerst; erst „Löschen“ löscht und führt zur Liste', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    expect(h.alert?.header).toBe('Vorgang löschen');
    expect(server.aufrufe('delete')).toHaveLength(0);
    await bestaetigen('Löschen');
    expect(server.aufrufe('delete', '/support/vorgaenge/1')).toHaveLength(1);
    expect(h.setSuccess).toHaveBeenCalledWith('Vorgang gelöscht');
    expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge', 'back', 'replace');
  });

  it('Abbrechen löscht nichts', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    await bestaetigen('Abbrechen');
    expect(server.aufrufe('delete')).toHaveLength(0);
    expect(h.push).not.toHaveBeenCalled();
  });
});

describe('Vorgang (App): Anfrage und Gemeinde anlegen', () => {
  const feld = (name: string) => screen.getByLabelText(name) as HTMLInputElement;

  it('der Anfrage-Vorgang zeigt ihre Angaben, die Wunschlizenz mit Preis und das Formular „Gemeinde anlegen“ -- vorbelegt', async () => {
    await oeffnen(3);
    expect(screen.getByText('Angaben aus der Anfrage')).toBeInTheDocument();
    expect(screen.getByText('Anna Beispiel (Pastorin)')).toBeInTheDocument();
    expect(screen.getByText('25 Konfis · 6 Teamer:innen')).toBeInTheDocument();
    expect(screen.getByText('Standard — bis 50 Konfis, 99 € pro Jahr')).toBeInTheDocument();
    await waitFor(() => expect((screen.getByLabelText('Kirchenkreis') as HTMLSelectElement).value).toBe('11'));
    expect(feld('Name der Gemeinde').value).toBe('Kirchengemeinde Lindenau');
    expect(feld('Benutzername').value).toBe('anna.beispiel');
    expect(feld('Passwort').value).toBe('');
  });

  it('ein Vorgang ohne Anfrage hat weder ihre Angaben noch „Gemeinde anlegen“', async () => {
    await oeffnen(1);
    expect(screen.queryByText('Angaben aus der Anfrage')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Gemeinde anlegen' })).toBeNull();
  });

  it('ohne Passwort: Meldung, keine Rückfrage, kein Aufruf', async () => {
    await oeffnen(3);
    fireEvent.click(await screen.findByRole('button', { name: 'Gemeinde anlegen' }));
    expect(h.setError).toHaveBeenCalledWith('Alle Felder der Gemeindeleitung sind erforderlich');
    expect(h.alert).toBeNull();
    expect(server.aufrufe('post', /anlegen$/)).toHaveLength(0);
  });

  it('fragt nach, legt an; der Vorgang ist danach erledigt und liegt im Archiv', async () => {
    await oeffnen(3);
    await waitFor(() => expect((screen.getByLabelText('Kirchenkreis') as HTMLSelectElement).value).toBe('11'));
    fireEvent.change(feld('Passwort'), { target: { value: BEISPIELWERT } });
    fireEvent.click(await screen.findByRole('button', { name: 'Gemeinde anlegen' }));
    expect(h.alert?.header).toBe('Gemeinde anlegen');
    expect(h.alert?.message).toBe('„Kirchengemeinde Lindenau“ mit der Gemeindeleitung „Anna Beispiel“ (anna.beispiel) anlegen?');
    expect(server.aufrufe('post', /anlegen$/)).toHaveLength(0);
    await bestaetigen('Anlegen');
    await waitFor(() => expect(server.aufrufe('post', '/support/anfragen/41/anlegen')).toHaveLength(1));
    expect(server.aufrufe('post', '/support/anfragen/41/anlegen')[0].koerper).toMatchObject({
      name: 'kirchengemeinde-lindenau', display_name: 'Kirchengemeinde Lindenau', kirchenkreis_id: 11, admin_username: 'anna.beispiel', admin_password: BEISPIELWERT,
    });
    expect(h.setSuccess).toHaveBeenCalledWith('Gemeinde angelegt');
    expect(await screen.findByText('Die Gemeinde ist angelegt.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gemeinde anlegen' })).toBeNull();
    expect(server.stand.vorgaenge.find((v) => v.id === 3)).toMatchObject({ status: 'erledigt', organization_id: 77 });
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
