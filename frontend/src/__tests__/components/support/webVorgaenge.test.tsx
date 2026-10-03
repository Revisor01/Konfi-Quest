// Vorgänge in der Web-Fassung, gerendert (docs/planung/support-vorgaenge.md,
// Entscheidung 7): der Eingang des Supports als Tabelle -- Nr., Betreff, Art,
// Gemeinde, Status, Dringlichkeit, letzte Aktivität, ungelesen --, Filter
// (Offen, Neu, In Arbeit, Wartet, Archiv), Auswahl nach Art und Gemeinde, Suche,
// Sammelaktionen, „Neuer Vorgang" und „Schreiben". Im schmalen Fenster bleibt
// die Liste der App.
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import type { AlertOptionen } from './ionicAttrappe';
import { mail, vorgang, vorgaengeServer } from './vorgaengeServer';

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
  standort: { pathname: '/admin/support/vorgaenge', search: '', state: null } as { pathname: string; search: string; state: null },
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

import SupportVorgaengePage from '../../../components/support/SupportVorgaengePage';
import { supportMailZaehlerZuruecksetzen } from '../../../navigation/supportMailZaehler';

let vorherTZ: string | undefined;
beforeAll(() => { vorherTZ = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherTZ === undefined) delete process.env.TZ; else process.env.TZ = vorherTZ; });

let server: ReturnType<typeof vorgaengeServer>;

const stand = () => [
  vorgang(1, { status: 'neu', art: 'fehler', bereich: 'chat', betreff: 'Chat zeigt nichts Neues', organization_id: 7, dringlichkeit: 'dringend', created_at: '2026-10-03T07:00:00Z' }),
  vorgang(2, { status: 'in_arbeit', art: 'frage', bereich: 'konten', betreff: 'Passwort zurücksetzen', organization_id: 8, created_at: '2026-10-02T09:00:00Z' }),
  vorgang(3, { status: 'wartet', art: 'neue_gemeinde', bereich: null, betreff: 'Anfrage Kirchengemeinde Lindenau', quelle: 'anfrage', anfrage_id: 41, created_at: '2026-10-01T09:00:00Z' }),
  vorgang(4, { status: 'neu', art: 'lizenz', bereich: null, betreff: 'Rechnung für Büsum', quelle: 'mail', created_at: '2026-09-30T09:00:00Z' }),
  vorgang(5, { status: 'erledigt', art: 'zugang', bereich: null, betreff: 'Konto entsperrt', organization_id: 7, archiviert_am: '2026-10-01T12:00:00Z', created_at: '2026-09-20T09:00:00Z' }),
  vorgang(6, { status: 'in_arbeit', art: 'wunsch', bereich: 'termine', betreff: 'Termine als Kalender', archiviert_am: '2026-09-29T12:00:00Z', created_at: '2026-09-10T09:00:00Z' }),
];

beforeEach(() => {
  vi.clearAllMocks();
  h.alert = null;
  h.breit = true;
  h.online = true;
  h.user = { id: 9, role_name: 'super_admin', is_super_admin: true };
  h.standort = { pathname: '/admin/support/vorgaenge', search: '', state: null };
  supportMailZaehlerZuruecksetzen();
  server = vorgaengeServer({
    vorgaenge: stand(),
    mails: [mail(11, 1, { gelesen_am: null }), mail(12, 1, { gelesen_am: null, gesendet_am: '2026-10-03T08:30:00Z' }), mail(31, 3, { gelesen_am: '2026-10-02T10:00:00Z' })],
  });
  server.installieren({ get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete });
});

const zeigen = async () => {
  render(<SupportVorgaengePage />);
  await screen.findByRole('table', { name: 'Vorgänge' });
};
const zeilen = () => within(screen.getByRole('table', { name: 'Vorgänge' })).getAllByRole('row').slice(1);
const nummern = () => zeilen().map((z) => within(z).getAllByRole('cell')[1].textContent);
const chip = (name: RegExp) => within(screen.getByRole('group', { name: 'Vorgänge nach Stand' })).getByRole('button', { name });
const zelle = (z: HTMLElement, spalte: number) => within(z).getAllByRole('cell')[spalte];
const bestaetigen = async (knopf: string) => { await act(async () => { h.alert?.buttons?.find((b) => b.text === knopf)?.handler?.(); }); };

describe('Vorgänge (Web): was geladen wird', () => {
  it('ruft die offenen Vorgänge ab -- nicht das Archiv, solange der Filter es nicht zeigt', async () => {
    await zeigen();
    const abrufe = server.aufrufe('get', '/support/vorgaenge');
    expect(abrufe.map((a) => a.optionen)).toEqual([{ params: { filter: 'offen' } }]);
    expect(server.aufrufe('get', '/organizations')).toHaveLength(1);
  });

  it('ein Filterwechsel unter Offen, Neu, In Arbeit und Wartet ruft nicht neu ab -- alle Zahlen stehen aus einer Antwort da', async () => {
    await zeigen();
    fireEvent.click(chip(/^Neu/));
    fireEvent.click(chip(/^In Arbeit/));
    fireEvent.click(chip(/^Wartet/));
    expect(server.aufrufe('get', '/support/vorgaenge')).toHaveLength(1);
  });

  it('das Archiv wird erst beim Wählen des Filters geladen (filter=archiv)', async () => {
    await zeigen();
    fireEvent.click(chip(/^Archiv/));
    await waitFor(() => expect(server.aufrufe('get', '/support/vorgaenge').map((a) => a.optionen)).toContainEqual({ params: { filter: 'archiv' } }));
    await waitFor(() => expect(nummern()).toEqual(['5', '6']));
  });
});

describe('Vorgänge (Web): Tabelle', () => {
  it('eine Zeile je offenem Vorgang, die jüngste Aktivität zuerst', async () => {
    await zeigen();
    // Nach Aktivität: Vorgang 1 hat die jüngste Mail (08:30), Vorgang 3 eine von 08:00; 2 und 4 haben nur ihren Eingang.
    expect(nummern()).toEqual(['1', '3', '2', '4']);
    expect(screen.getByRole('heading', { level: 1, name: 'Vorgänge' })).toBeInTheDocument();
    expect(screen.getByText('4 Vorgänge offen')).toBeInTheDocument();
  });

  it('Nr., Betreff mit Bereich, Art, Gemeinde, Status, Dringlichkeit und Ungelesen stehen in der Zeile', async () => {
    await zeigen();
    const z = zeilen()[0];
    expect(zelle(z, 1)).toHaveTextContent('1');
    expect(zelle(z, 2)).toHaveTextContent('Chat zeigt nichts Neues');
    expect(zelle(z, 2)).toHaveTextContent('Chat');
    expect(zelle(z, 3)).toHaveTextContent('Fehler');
    expect(zelle(z, 4)).toHaveTextContent('Kirchengemeinde Musterdorf');
    expect(zelle(z, 5)).toHaveTextContent('Neu');
    expect(zelle(z, 6)).toHaveTextContent('Dringend');
    expect(zelle(z, 8)).toHaveTextContent('2');
    expect(zelle(z, 8).querySelector('.web-chip__zahl--rot')).not.toBeNull();
  });

  it('ohne Gemeinde steht „Nicht zugeordnet“; Normal und fehlende Ungelesene stehen gedämpft', async () => {
    await zeigen();
    const z = zeilen().find((x) => zelle(x, 1).textContent === '4')!;
    expect(zelle(z, 4)).toHaveTextContent('Nicht zugeordnet');
    expect(zelle(z, 6)).toHaveTextContent('Normal');
    expect(zelle(z, 8)).toHaveTextContent('–');
  });

  it('die Zeile öffnet den Vorgang: ein echter Link auf der ganzen Zeile, Klick bleibt in der App', async () => {
    await zeigen();
    const link = within(zeilen().find((z) => zelle(z, 1).textContent === '2')!).getByRole('link', { name: 'Passwort zurücksetzen' });
    expect(link).toHaveAttribute('href', '/admin/support/vorgaenge/2');
    expect(link.className).toContain('web-link--zeile');
    fireEvent.click(link);
    expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge/2', 'none', 'push');
  });

  it('neue und ungelesene Vorgänge stehen fett mit Punkt-Zeile; in Arbeit ohne Ungelesenes nicht', async () => {
    await zeigen();
    expect(nummern()).toEqual(['1', '3', '2', '4']);
    expect(zeilen().map((z) => z.classList.contains('web-zeile--ungelesen'))).toEqual([true, false, false, true]);
    expect(within(zeilen()[0]).getByRole('link', { name: /Chat zeigt nichts Neues, 2 ungelesene Mails/ })).toBeInTheDocument();
  });

  it('der Betreff „ohne Betreff“ steht nicht leer da', async () => {
    server.stand.vorgaenge.push(vorgang(8, { betreff: '', status: 'neu' }));
    await zeigen();
    expect(screen.getByRole('link', { name: '(ohne Betreff)' })).toHaveAttribute('href', '/admin/support/vorgaenge/8');
  });
});

describe('Vorgänge (Web): Filter-Chips', () => {
  it('Offen ist voreingestellt und zählt alle offenen; Neu, In Arbeit und Wartet zählen je Status', async () => {
    await zeigen();
    expect(chip(/^Offen/)).toHaveAttribute('aria-pressed', 'true');
    expect(chip(/^Offen/)).toHaveTextContent('4');
    expect(chip(/^Neu/)).toHaveTextContent('2');
    expect(chip(/^In Arbeit/)).toHaveTextContent('1');
    expect(chip(/^Wartet/)).toHaveTextContent('1');
    // Die Neuen sind Arbeit: ihre Zahl ist rot.
    expect(chip(/^Neu/).querySelector('.web-chip__zahl--rot')).not.toBeNull();
    expect(chip(/^Archiv/)).toHaveTextContent(/^Archiv$/);
  });

  it('jeder Filter zeigt seine Vorgänge', async () => {
    await zeigen();
    fireEvent.click(chip(/^Neu/));
    expect(nummern()).toEqual(['1', '4']);
    fireEvent.click(chip(/^In Arbeit/));
    expect(nummern()).toEqual(['2']);
    fireEvent.click(chip(/^Wartet/));
    expect(nummern()).toEqual(['3']);
    expect(chip(/^Wartet/)).toHaveAttribute('aria-pressed', 'true');
    expect(chip(/^Offen/)).toHaveAttribute('aria-pressed', 'false');
  });

  it('das Archiv zeigt auch die erledigten; seine Zahl steht erst, wenn es geladen ist', async () => {
    await zeigen();
    fireEvent.click(chip(/^Archiv/));
    await waitFor(() => expect(nummern()).toEqual(['5', '6']));
    expect(chip(/^Archiv/)).toHaveTextContent('2');
    expect(within(zeilen()[0]).getByText('Erledigt')).toBeInTheDocument();
    expect(within(zeilen()[1]).getByText('In Arbeit')).toBeInTheDocument();
    expect(screen.getByText('2 Vorgänge im Archiv')).toBeInTheDocument();
    // Die Spalte nennt das Archivdatum statt der Aktivität.
    expect(screen.getByRole('columnheader', { name: 'Archiviert' })).toBeInTheDocument();
  });

  it('ein Filter ohne Vorgänge: eigener Hinweis', async () => {
    server.stand.vorgaenge = server.stand.vorgaenge.filter((v) => v.status !== 'wartet');
    await zeigen();
    fireEvent.click(chip(/^Wartet/));
    expect(screen.getByText('Nichts wartet')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('Vorgänge (Web): Art, Gemeinde und Suche', () => {
  it('Art grenzt ein, die Auswahl nennt alle acht Arten', async () => {
    await zeigen();
    const art = screen.getByLabelText('Art') as HTMLSelectElement;
    expect([...art.options].map((o) => o.textContent)).toEqual([
      'Alle Arten', 'Neue Gemeinde', 'Frage zur Bedienung', 'Fehler melden', 'Wunsch oder Idee', 'Zugang und Konten', 'Lizenz und Abrechnung', 'Datenschutz', 'Sonstiges',
    ]);
    fireEvent.change(art, { target: { value: 'neue_gemeinde' } });
    expect(nummern()).toEqual(['3']);
  });

  it('Gemeinde grenzt ein; die Auswahl bietet alle Gemeinden', async () => {
    await zeigen();
    const gemeinde = await waitFor(() => {
      const el = screen.getByLabelText('Gemeinde') as HTMLSelectElement;
      expect(el.options.length).toBe(3);
      return el;
    });
    expect([...gemeinde.options].map((o) => o.textContent)).toEqual(['Alle Gemeinden', 'Kirchengemeinde Musterdorf', 'Kirchengemeinde Wiesengrund']);
    fireEvent.change(gemeinde, { target: { value: '7' } });
    expect(nummern()).toEqual(['1']);
  });

  it('die Suche findet Nummer, Betreff und Gemeinde -- „buesum“ findet „Büsum“ -- und hebt den Treffer hervor', async () => {
    await zeigen();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Vorgänge durchsuchen' }), { target: { value: 'buesum' } });
    expect(nummern()).toEqual(['4']);
    expect(within(zeilen()[0]).getByText('Büsum').tagName).toBe('MARK');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Vorgänge durchsuchen' }), { target: { value: 'musterdorf' } });
    expect(nummern()).toEqual(['1']);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Vorgänge durchsuchen' }), { target: { value: 'Vorgang 2' } });
    expect(nummern()).toEqual(['2']);
  });

  it('ohne Treffer: Hinweis mit „Auswahl zurücksetzen“', async () => {
    await zeigen();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Vorgänge durchsuchen' }), { target: { value: 'gibtesnicht' } });
    expect(screen.getByText('Keine Treffer')).toBeInTheDocument();
    expect(screen.getByText('In dieser Auswahl gibt es keinen Vorgang zu „gibtesnicht“.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Auswahl zurücksetzen' }));
    expect(nummern()).toEqual(['1', '3', '2', '4']);
    expect((screen.getByRole('searchbox', { name: 'Vorgänge durchsuchen' }) as HTMLInputElement).value).toBe('');
  });
});

describe('Vorgänge (Web): Auswahl aus der Adresse', () => {
  it('?art=neue_gemeinde zeigt die Anfragen -- so führt die alte Adresse /admin/support/anfragen hierher', async () => {
    h.standort = { pathname: '/admin/support/vorgaenge', search: '?art=neue_gemeinde', state: null };
    await zeigen();
    expect(nummern()).toEqual(['3']);
    expect((screen.getByLabelText('Art') as HTMLSelectElement).value).toBe('neue_gemeinde');
  });

  it('?gemeinde=7 zeigt die Vorgänge der Gemeinde; der Knopf heißt „Schreiben“ und die Zeile sagt, von wem', async () => {
    h.standort = { pathname: '/admin/support/vorgaenge', search: '?gemeinde=7', state: null };
    await zeigen();
    expect(nummern()).toEqual(['1']);
    expect(await screen.findByText(/Vorgänge von Kirchengemeinde Musterdorf/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Schreiben' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Neuer Vorgang' })).toBeNull();
  });

  it('?filter=neu stellt den Filter ein; ein unbekannter Wert lässt es bei Offen', async () => {
    h.standort = { pathname: '/admin/support/vorgaenge', search: '?filter=neu', state: null };
    await zeigen();
    expect(chip(/^Neu/)).toHaveAttribute('aria-pressed', 'true');
    expect(nummern()).toEqual(['1', '4']);
  });

  it('?filter=archiv lädt das Archiv', async () => {
    h.standort = { pathname: '/admin/support/vorgaenge', search: '?filter=archiv', state: null };
    await zeigen();
    await waitFor(() => expect(nummern()).toEqual(['5', '6']));
  });

  it('eine neue Adresse bei offener Seite stellt die Auswahl um; auf einer anderen Seite rührt sie nichts an', async () => {
    const { rerender } = render(<SupportVorgaengePage />);
    await screen.findByRole('table', { name: 'Vorgänge' });
    expect(nummern()).toEqual(['1', '3', '2', '4']);
    h.standort = { pathname: '/admin/support/vorgaenge', search: '?art=lizenz', state: null };
    rerender(<SupportVorgaengePage />);
    expect(nummern()).toEqual(['4']);
    // Ionic lässt die verlassene Seite noch stehen: ihr Standort zeigt schon auf die nächste.
    h.standort = { pathname: '/admin/support/vorgaenge/2', search: '?art=fehler', state: null };
    rerender(<SupportVorgaengePage />);
    expect(nummern()).toEqual(['4']);
  });

  it('eine gewählte Art und die Suche bleiben beim Wechsel der Adresse auf dieselbe Seite -- die Suche gehört nicht in die Adresse', async () => {
    const { rerender } = render(<SupportVorgaengePage />);
    await screen.findByRole('table', { name: 'Vorgänge' });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Vorgänge durchsuchen' }), { target: { value: 'chat' } });
    h.standort = { pathname: '/admin/support/vorgaenge', search: '?filter=neu', state: null };
    rerender(<SupportVorgaengePage />);
    expect((screen.getByRole('searchbox', { name: 'Vorgänge durchsuchen' }) as HTMLInputElement).value).toBe('chat');
    expect(nummern()).toEqual(['1']);
  });
});

describe('Vorgänge (Web): Sammelaktionen', () => {
  const auswaehlen = (...nr: number[]) => { for (const n of nr) fireEvent.click(within(zeilen().find((z) => zelle(z, 1).textContent === String(n))!).getByRole('checkbox')); };

  it('ohne Auswahl keine Aktionen; „Alle auswählen“ wählt alle sichtbaren', async () => {
    await zeigen();
    expect(screen.queryByRole('button', { name: 'Archivieren' })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Alle auswählen' }));
    expect(screen.getByText('4 Vorgänge ausgewählt')).toBeInTheDocument();
    expect(zeilen().every((z) => (within(z).getByRole('checkbox') as HTMLInputElement).checked)).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: '4 Vorgänge ausgewählt' }));
    expect(screen.getByRole('checkbox', { name: 'Alle auswählen' })).not.toBeChecked();
  });

  it('eine Zeile ausgewählt: „1 Vorgang ausgewählt“, der Alle-Kasten steht dazwischen', async () => {
    await zeigen();
    auswaehlen(2);
    const alle = screen.getByRole('checkbox', { name: '1 Vorgang ausgewählt' }) as HTMLInputElement;
    expect(alle.indeterminate).toBe(true);
    expect(alle.checked).toBe(false);
  });

  it('Archivieren: eine Sammelanfrage mit den Nummern; die Zeilen verschwinden, die Auswahl ist leer', async () => {
    await zeigen();
    auswaehlen(2, 3);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Archivieren' })); });
    expect(server.aufrufe('post', '/support/vorgaenge/sammel')[0].koerper).toEqual({ ids: [2, 3], aktion: 'archivieren' });
    await waitFor(() => expect(nummern()).toEqual(['1', '4']));
    expect(h.setSuccess).toHaveBeenCalledWith('2 Vorgänge archiviert');
    expect(screen.queryByRole('button', { name: 'Archivieren' })).toBeNull();
  });

  it('Status setzen: ein Auswahlfeld mit den vier Status; „Erledigt“ sagt, dass es ins Archiv geht', async () => {
    await zeigen();
    auswaehlen(1, 4);
    const status = screen.getByLabelText('Status setzen') as HTMLSelectElement;
    expect([...status.options].map((o) => o.textContent)).toEqual(['Status setzen …', 'Neu', 'In Arbeit', 'Wartet auf Rückmeldung', 'Erledigt (ins Archiv)']);
    await act(async () => { fireEvent.change(status, { target: { value: 'wartet' } }); });
    expect(server.aufrufe('post', '/support/vorgaenge/sammel')[0].koerper).toEqual({ ids: [1, 4], aktion: 'status', status: 'wartet' });
    expect(h.setSuccess).toHaveBeenCalledWith('2 Vorgänge auf „Wartet auf Rückmeldung“ gesetzt');
    await waitFor(() => expect(zeilen().map((z) => zelle(z, 5).textContent)).toEqual(['Wartet', 'Wartet', 'In Arbeit', 'Wartet']));
  });

  it('Erledigt setzen legt die Vorgänge ins Archiv: sie verlassen die offene Liste', async () => {
    await zeigen();
    auswaehlen(2);
    await act(async () => { fireEvent.change(screen.getByLabelText('Status setzen'), { target: { value: 'erledigt' } }); });
    expect(server.aufrufe('post', '/support/vorgaenge/sammel')[0].koerper).toEqual({ ids: [2], aktion: 'status', status: 'erledigt' });
    expect(h.setSuccess).toHaveBeenCalledWith('1 Vorgang erledigt und ins Archiv gelegt');
    await waitFor(() => expect(nummern()).toEqual(['1', '3', '4']));
  });

  it('Löschen fragt zuerst und sagt, was gelöscht wird; erst „Löschen“ im Dialog löscht', async () => {
    await zeigen();
    auswaehlen(4);
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    expect(h.alert?.header).toBe('Vorgang löschen');
    expect(h.alert?.message).toContain('Im Postfach selbst bleibt alles stehen');
    expect(server.aufrufe('post', '/support/vorgaenge/sammel')).toHaveLength(0);
    await bestaetigen('Löschen');
    expect(server.aufrufe('post', '/support/vorgaenge/sammel')[0].koerper).toEqual({ ids: [4], aktion: 'loeschen' });
    await waitFor(() => expect(nummern()).toEqual(['1', '3', '2']));
    expect(h.setSuccess).toHaveBeenCalledWith('1 Vorgang gelöscht');
  });

  it('Abbrechen löscht nichts', async () => {
    await zeigen();
    auswaehlen(4);
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    expect(h.alert?.buttons?.find((b) => b.role === 'cancel')?.text).toBe('Abbrechen');
    expect(server.aufrufe('post', '/support/vorgaenge/sammel')).toHaveLength(0);
  });

  it('im Archiv steht „Wiederherstellen“ statt „Archivieren“; die Vorgänge stehen danach „In Arbeit“ in der offenen Liste', async () => {
    await zeigen();
    fireEvent.click(chip(/^Archiv/));
    await waitFor(() => expect(nummern()).toEqual(['5', '6']));
    auswaehlen(5);
    expect(screen.queryByRole('button', { name: 'Archivieren' })).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Wiederherstellen' })); });
    expect(server.aufrufe('post', '/support/vorgaenge/sammel')[0].koerper).toEqual({ ids: [5], aktion: 'wiederherstellen' });
    await waitFor(() => expect(nummern()).toEqual(['6']));
    fireEvent.click(chip(/^Offen/));
    await waitFor(() => expect(nummern()).toContain('5'));
    expect(zeilen().find((z) => zelle(z, 1).textContent === '5')).toHaveTextContent('In Arbeit');
  });

  it('eine gescheiterte Sammelaktion meldet den Fehler und lässt die Auswahl stehen', async () => {
    await zeigen();
    server.stand.fehler.set('POST /support/vorgaenge/sammel', Object.assign(new Error('x'), { response: { status: 500, data: { error: 'Datenbankfehler' } } }));
    auswaehlen(2);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Archivieren' })); });
    expect(h.setError).toHaveBeenCalled();
    expect(screen.getByText('1 Vorgang ausgewählt')).toBeInTheDocument();
    expect(nummern()).toEqual(['1', '3', '2', '4']);
  });

  it('ohne Netz sind die Sammelaktionen gesperrt', async () => {
    h.online = false;
    await zeigen();
    auswaehlen(2);
    expect(screen.getByRole('button', { name: 'Archivieren' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Löschen' })).toBeDisabled();
  });
});

describe('Vorgänge (Web): Neuer Vorgang', () => {
  const dialog = () => screen.getByRole('dialog', { name: 'Neuer Vorgang' });
  const oeffnen = async () => {
    await zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Neuer Vorgang' }));
  };

  it('öffnet einen Dialog mit Art, Bereich, Dringlichkeit, Betreff, Gemeinde und erster Mail', async () => {
    await oeffnen();
    const d = within(dialog());
    for (const name of ['Art', 'Bereich', 'Dringlichkeit', 'Betreff', 'Gemeinde', 'Text der Mail']) expect(d.getByLabelText(name), name).toBeInTheDocument();
    expect((d.getByLabelText('Art') as HTMLSelectElement).value).toBe('');
    expect((d.getByLabelText('Dringlichkeit') as HTMLSelectElement).value).toBe('normal');
    expect(d.getByLabelText('An (E-Mail-Adresse)')).toBeInTheDocument();
    expect(d.getByRole('button', { name: 'Vorgang anlegen' })).toBeInTheDocument();
  });

  it('ohne Art: ein Satz sagt, was fehlt -- nichts geht raus', async () => {
    await oeffnen();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Vorgang anlegen' }));
    expect(within(dialog()).getByRole('alert')).toHaveTextContent('Bitte eine Art wählen');
    expect(server.aufrufe('post', '/support/vorgaenge')).toHaveLength(0);
  });

  it('Frage, Fehler und Wunsch brauchen einen Bereich -- der Stern erscheint, andere Arten brauchen keinen', async () => {
    await oeffnen();
    const d = within(dialog());
    expect(d.getByText('Bereich').className).not.toContain('--pflicht');
    fireEvent.change(d.getByLabelText('Art'), { target: { value: 'fehler' } });
    expect(d.getByText('Bereich').className).toContain('web-feld__label--pflicht');
    fireEvent.change(d.getByLabelText('Betreff'), { target: { value: 'Chat' } });
    fireEvent.click(d.getByRole('button', { name: 'Vorgang anlegen' }));
    expect(d.getByRole('alert')).toHaveTextContent('Bitte einen Bereich wählen');
    fireEvent.change(d.getByLabelText('Art'), { target: { value: 'sonstiges' } });
    expect(d.getByText('Bereich').className).not.toContain('--pflicht');
  });

  it('legt den Vorgang mit genau den gewählten Werten an und öffnet ihn', async () => {
    await oeffnen();
    const d = within(dialog());
    fireEvent.change(d.getByLabelText('Art'), { target: { value: 'fehler' } });
    fireEvent.change(d.getByLabelText('Bereich'), { target: { value: 'chat' } });
    fireEvent.change(d.getByLabelText('Dringlichkeit'), { target: { value: 'dringend' } });
    fireEvent.change(d.getByLabelText('Betreff'), { target: { value: '  Chat geht nicht  ' } });
    await act(async () => { fireEvent.click(d.getByRole('button', { name: 'Vorgang anlegen' })); });
    expect(server.aufrufe('post', '/support/vorgaenge')[0].koerper).toEqual({ art: 'fehler', bereich: 'chat', dringlichkeit: 'dringend', betreff: 'Chat geht nicht' });
    expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge/100');
    expect(h.setSuccess).toHaveBeenCalledWith('Vorgang 100 angelegt');
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(nummern()).toContain('100'));
  });

  it('mit Gemeinde und erster Mail: die Adressen der Gemeinde stehen zur Wahl, die Mail geht an die gewählte', async () => {
    await oeffnen();
    const d = within(dialog());
    fireEvent.change(d.getByLabelText('Art'), { target: { value: 'zugang' } });
    fireEvent.change(d.getByLabelText('Betreff'), { target: { value: 'Zugang geprüft' } });
    await waitFor(() => expect((d.getByLabelText('Gemeinde') as HTMLSelectElement).options.length).toBe(3));
    fireEvent.change(d.getByLabelText('Gemeinde'), { target: { value: '7' } });
    // Genau eine Adresse: vorgewählt.
    const an = await waitFor(() => {
      const el = d.getByLabelText('An') as HTMLSelectElement;
      expect(el.value).toBe('lena.probe@example.org');
      return el;
    });
    expect([...an.options].map((o) => o.textContent)).toEqual(['Bitte wählen', 'Pastorin Lena Probe <lena.probe@example.org> · Gemeindeleitung']);
    fireEvent.change(d.getByLabelText('Text der Mail'), { target: { value: 'Euer Zugang ist geprüft.' } });
    await act(async () => { fireEvent.click(d.getByRole('button', { name: 'Vorgang anlegen' })); });
    expect(server.aufrufe('post', '/support/vorgaenge')[0].koerper).toEqual({
      art: 'zugang', dringlichkeit: 'normal', betreff: 'Zugang geprüft', organization_id: 7, text: 'Euer Zugang ist geprüft.', an: 'lena.probe@example.org',
    });
  });

  it('eine erste Mail ohne Adresse: ein Satz sagt es', async () => {
    await oeffnen();
    const d = within(dialog());
    fireEvent.change(d.getByLabelText('Art'), { target: { value: 'sonstiges' } });
    fireEvent.change(d.getByLabelText('Betreff'), { target: { value: 'Hallo' } });
    fireEvent.change(d.getByLabelText('Text der Mail'), { target: { value: 'Text' } });
    fireEvent.click(d.getByRole('button', { name: 'Vorgang anlegen' }));
    expect(d.getByRole('alert')).toHaveTextContent('Bitte die E-Mail-Adresse eingeben, an die die Mail geht');
  });

  it('Abbrechen und Escape schließen, ohne etwas anzulegen', async () => {
    await oeffnen();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Neuer Vorgang' }));
    fireEvent.keyDown(dialog(), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(server.aufrufe('post', '/support/vorgaenge')).toHaveLength(0);
  });

  it('scheitert das Anlegen, bleibt der Dialog stehen und sagt es', async () => {
    await oeffnen();
    server.stand.fehler.set('POST /support/vorgaenge', Object.assign(new Error('x'), { response: { status: 500, data: { error: 'Datenbankfehler' } } }));
    const d = within(dialog());
    fireEvent.change(d.getByLabelText('Art'), { target: { value: 'sonstiges' } });
    fireEvent.change(d.getByLabelText('Betreff'), { target: { value: 'Hallo' } });
    await act(async () => { fireEvent.click(d.getByRole('button', { name: 'Vorgang anlegen' })); });
    expect(d.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Neuer Vorgang' })).toBeInTheDocument();
  });

  it('„Schreiben“ bei gewählter Gemeinde: der Dialog heißt „Gemeinde anschreiben“, die Gemeinde und die Art „Sonstiges“ stehen schon da', async () => {
    h.standort = { pathname: '/admin/support/vorgaenge', search: '?gemeinde=7', state: null };
    await zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Schreiben' }));
    const d = within(screen.getByRole('dialog', { name: 'Gemeinde anschreiben' }));
    expect((d.getByLabelText('Art') as HTMLSelectElement).value).toBe('sonstiges');
    await waitFor(() => expect((d.getByLabelText('Gemeinde') as HTMLSelectElement).value).toBe('7'));
    expect(d.getByRole('button', { name: 'Vorgang anlegen und senden' })).toBeInTheDocument();
    await waitFor(() => expect((d.getByLabelText('An') as HTMLSelectElement).value).toBe('lena.probe@example.org'));
  });
});

describe('Vorgänge (Web): Laden, Fehler, leer', () => {
  it('beim Laden: Platzhalter statt leerer Tabelle', () => {
    h.apiGet.mockImplementation(() => new Promise(() => {}));
    render(<SupportVorgaengePage />);
    expect(screen.getByText('Die Vorgänge werden geladen.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('Fehler: Hinweis mit erneutem Versuch, der wirklich neu lädt', async () => {
    server.stand.fehler.set('GET /support/vorgaenge', new Error('Netz'));
    render(<SupportVorgaengePage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Vorgänge konnten nicht geladen werden.');
    server.stand.fehler.delete('GET /support/vorgaenge');
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    await screen.findByRole('table', { name: 'Vorgänge' });
  });

  it('eine Antwort in unbekannter Form ist ein Fehler, kein Absturz', async () => {
    h.apiGet.mockImplementation((pfad: string) => (pfad === '/support/vorgaenge' ? Promise.resolve({ data: { kaputt: true } }) : Promise.resolve({ data: [] })));
    render(<SupportVorgaengePage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Vorgänge konnten nicht geladen werden.');
  });

  it('keine Vorgänge: eigener Hinweis', async () => {
    server.stand.vorgaenge = [];
    await (async () => { render(<SupportVorgaengePage />); await screen.findByText('Nichts zu tun'); })();
    expect(screen.getByText('Es gibt keinen offenen Vorgang. Neue Anfragen, Formulare und Mails erscheinen hier.')).toBeInTheDocument();
  });

  it('„Aktualisieren“ lädt neu', async () => {
    await zeigen();
    server.stand.vorgaenge.push(vorgang(9, { betreff: 'Frisch hereingekommen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aktualisieren' }));
    expect(await screen.findByRole('link', { name: 'Frisch hereingekommen' })).toBeInTheDocument();
  });
});

describe('Vorgänge: zwei Gesichter, eine Seite', () => {
  it('im schmalen Fenster bleibt die Darstellung der App -- mit denselben Daten', async () => {
    h.breit = false;
    render(<SupportVorgaengePage />);
    expect(await screen.findByText('Chat zeigt nichts Neues')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('tablist', { name: 'Stand' })).toBeInTheDocument();
  });

  it('ohne Super-Admin-Recht: Hinweis, kein Abruf', () => {
    h.user = { id: 5, role_name: 'org_admin', is_super_admin: false };
    render(<SupportVorgaengePage />);
    expect(screen.getByText('Nur für den Support')).toBeInTheDocument();
    expect(h.apiGet).not.toHaveBeenCalled();
  });
});
