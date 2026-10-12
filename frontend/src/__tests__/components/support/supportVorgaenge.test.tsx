// Vorgänge der Support-Ansicht in der App-Fassung (/admin/support/vorgaenge),
// gerendert (docs/planung/support-vorgaenge.md, Entscheidung 7): eine einfache
// Liste mit denselben Reitern wie der Browser (Offen, Neu, In Arbeit, Wartet,
// Archiv -- darin auch die erledigten), Auswahl nach Art und Gemeinde und
// Suche hinter dem Knopf „Filter“ (12.10.2026), „Neuer Vorgang“ als
// Abschnitt der Seite. Die Tabelle mit Sammelaktionen steht in
// webVorgaenge.test.tsx -- beide teilen die Logik.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import { mail, vorgang, vorgaengeServer } from './vorgaengeServer';
import { ART_SYMBOL } from '../../../utils/supportVorgaenge';
import { datumUhrzeit } from '../../../utils/dateUtils';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  push: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  online: true,
  user: { id: 9, role_name: 'super_admin', is_super_admin: true } as Record<string, unknown>,
  standort: { pathname: '/admin/support/vorgaenge', search: '', state: null } as { pathname: string; search: string; state: null },
}));

vi.mock('@ionic/react', async () => ({
  ...(await import('./ionicAttrappe')).ionicAttrappe({
    router: { push: h.push, goBack: vi.fn(), canGoBack: () => false },
  }),
  // Das Symbol sichtbar machen: Der Kreis der Zeile trägt das der Art.
  IonIcon: ({ icon, className }: { icon?: string; className?: string }) => <span data-icon={icon} className={className} />,
}));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('./ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: ({ message }: { message: string }) => <p>{message}</p> }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: h.online }),
}));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => false }));
vi.mock('../../../navigation/useAppLocation', () => ({ useAppLocation: () => h.standort }));

import SupportVorgaengePage from '../../../components/support/SupportVorgaengePage';
import { supportMailZaehlerZuruecksetzen } from '../../../navigation/supportMailZaehler';

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
  h.online = true;
  h.user = { id: 9, role_name: 'super_admin', is_super_admin: true };
  h.standort = { pathname: '/admin/support/vorgaenge', search: '', state: null };
  supportMailZaehlerZuruecksetzen();
  server = vorgaengeServer({
    vorgaenge: stand(),
    mails: [mail(11, 1), mail(12, 1, { gesendet_am: '2026-10-03T08:30:00Z' }), mail(31, 3, { gelesen_am: '2026-10-02T10:00:00Z', gesendet_am: '2026-10-03T08:00:00Z' })],
  });
  server.installieren({ get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete });
});

const zeigen = async () => {
  render(<SupportVorgaengePage />);
  await screen.findByRole('button', { name: /^Vorgang 1:/ });
};
const eintraege = () => screen.getAllByRole('button', { name: /^Vorgang \d+:/ }).map((e) => e.getAttribute('aria-label'));
const nummern = () => screen.queryAllByRole('button', { name: /^Vorgang \d+:/ }).map((e) => /^Vorgang (\d+):/.exec(e.getAttribute('aria-label') ?? '')![1]);
const segment = (name: string | RegExp) => screen.getByRole('tab', { name });
const filterKnopf = () => screen.getByRole('button', { name: /^Filter/ });
/** Klappt Art, Gemeinde und Suche auf (sie stehen hinter dem Knopf „Filter“). */
const filterOeffnen = () => {
  if (filterKnopf().getAttribute('aria-expanded') !== 'true') fireEvent.click(filterKnopf());
};

describe('Vorgänge (App): Liste', () => {
  it('eine Zeile je offenem Vorgang, die jüngste Aktivität zuerst; Nummer, Art mit Bereich, Gemeinde und Stand stehen da', async () => {
    await zeigen();
    expect(eintraege()).toEqual([
      'Vorgang 1: Chat zeigt nichts Neues, Neu, 2 ungelesene Mails',
      'Vorgang 3: Anfrage Kirchengemeinde Lindenau, Wartet auf Rückmeldung',
      'Vorgang 2: Passwort zurücksetzen, In Arbeit',
      'Vorgang 4: Rechnung für Büsum, Neu',
    ]);
    expect(screen.getByText('4 Vorgänge')).toBeInTheDocument();
    const erster = screen.getByRole('button', { name: /^Vorgang 1:/ });
    expect(erster).toHaveTextContent('Nr. 1');
    expect(erster).toHaveTextContent('Fehler · Chat');
    expect(erster).toHaveTextContent('Kirchengemeinde Musterdorf');
    expect(erster).toHaveTextContent('Dringend');
    expect(erster.querySelector('.app-zaehler-kugel')).toHaveTextContent('2');
    expect(screen.getByRole('button', { name: /^Vorgang 4:/ })).toHaveTextContent('Nicht zugeordnet');
    expect(screen.getByRole('button', { name: /^Vorgang 3:/ }).querySelector('.app-zaehler-kugel')).toBeNull();
  });

  it('die Zeile: Kreis mit dem Symbol der Art, Betreff über die volle Breite, darunter Angaben und Marken (12.10.2026)', async () => {
    await zeigen();
    const zeile = (n: number) => screen.getByRole('button', { name: new RegExp(`^Vorgang ${n}:`) });
    const kreis = (n: number) => zeile(n).querySelector('.app-icon-circle') as HTMLElement;
    const symbol = (n: number) => kreis(n).querySelector('[data-icon]')!.getAttribute('data-icon');
    // Je Art ein eigenes Symbol auf ihrer Farbe -- bis dahin trug jede Zeile dasselbe Gebäude.
    expect([1, 2, 3, 4].map((n) => [symbol(n), [...kreis(n).classList].filter((k) => k !== 'app-icon-circle' && k !== 'app-icon-circle--lg')])).toEqual([
      [ART_SYMBOL.fehler, ['app-icon-circle--danger']],
      [ART_SYMBOL.frage, ['app-icon-circle--info']],
      [ART_SYMBOL.neue_gemeinde, ['app-icon-circle--success']],
      [ART_SYMBOL.lizenz, ['app-icon-circle--categories']],
    ]);
    // Der Inhalt: Betreff, Angaben, Marken -- in dieser Reihenfolge untereinander.
    const inhalt = zeile(1).querySelector('.app-list-item__content') as HTMLElement;
    expect([...inhalt.children].map((k) => [k.className, k.textContent])).toEqual([
      ['app-list-item__title', 'Chat zeigt nichts Neues'],
      ['app-list-item__meta support-listenzeile__meta', `Nr. 1 · Fehler · Chat · Kirchengemeinde Musterdorf · ${datumUhrzeit('2026-10-03T08:30:00Z')}`],
      ['support-listenzeile__marken', 'DringendNeu'],
    ]);
    expect(datumUhrzeit('2026-10-03T08:30:00Z')).toBe('03.10.2026, 10:30');
    // Keine erzwungene Silbentrennung mehr am Betreff.
    expect((inhalt.children[0] as HTMLElement).getAttribute('style')).toBeNull();
    // Rechts neben dem Inhalt steht nur noch der Pfeil -- keine Marke nimmt dem Betreff die Breite.
    const reihe = zeile(1).querySelector('.app-list-item__row') as HTMLElement;
    expect([...reihe.children].map((k) => k.className)).toEqual(['app-list-item__main', 'support-listenzeile__pfeil']);
    // Ohne Bereich und ohne Dringend: nur der Status in der Zeile der Marken.
    expect(zeile(3).querySelector('.support-listenzeile__marken')!.textContent).toBe('Wartet');
    expect(zeile(3).querySelector('.support-listenzeile__meta')!.textContent).toMatch(/^Nr\. 3 · Neue Gemeinde · Noch nicht angelegt · /);
  });

  it('lädt die offenen Vorgänge -- das Archiv erst, wenn der Filter es zeigt', async () => {
    await zeigen();
    expect(server.aufrufe('get', '/support/vorgaenge').map((a) => a.optionen)).toEqual([{ params: { filter: 'offen' } }]);
  });

  it('ein Antippen öffnet den Vorgang', async () => {
    await zeigen();
    fireEvent.click(screen.getByRole('button', { name: /^Vorgang 2:/ }));
    expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge/2');
  });

  it('die Zähler der Filter stehen aus einer Antwort da; ein Wechsel ruft nicht neu ab', async () => {
    await zeigen();
    expect(segment('Offen 4')).toHaveAttribute('aria-selected', 'true');
    expect(segment('Neu 2')).toBeInTheDocument();
    expect(segment('In Arbeit 1')).toBeInTheDocument();
    expect(segment('Wartet 1')).toHaveAttribute('aria-selected', 'false');
    fireEvent.click(segment('Wartet 1'));
    fireEvent.click(segment('Neu 2'));
    expect(server.aufrufe('get', '/support/vorgaenge')).toHaveLength(1);
  });
});

describe('Vorgänge (App): Filter, Auswahl, Suche', () => {
  it('Neu, In Arbeit und Wartet zeigen genau ihre Vorgänge', async () => {
    await zeigen();
    fireEvent.click(segment('Neu 2'));
    expect(nummern()).toEqual(['1', '4']);
    fireEvent.click(segment('In Arbeit 1'));
    expect(nummern()).toEqual(['2']);
    fireEvent.click(segment('Wartet 1'));
    expect(nummern()).toEqual(['3']);
    expect(server.aufrufe('get', '/support/vorgaenge')).toHaveLength(1);
  });

  it('Archiv lädt erst beim Wählen (filter=archiv) und zeigt die erledigten und archivierten', async () => {
    await zeigen();
    await act(async () => { fireEvent.click(segment('Archiv')); });
    await waitFor(() => expect(nummern()).toEqual(['5', '6']));
    expect(server.aufrufe('get', '/support/vorgaenge').map((a) => a.optionen)).toEqual([{ params: { filter: 'offen' } }, { params: { filter: 'archiv' } }]);
    expect(screen.getByRole('button', { name: /^Vorgang 5:/ })).toHaveTextContent('Erledigt');
  });

  it('Art und Gemeinde engen ein; die Gemeinden kommen aus den Vorgängen', async () => {
    await zeigen();
    filterOeffnen();
    fireEvent.change(screen.getByLabelText('Art filtern'), { target: { value: 'lizenz' } });
    expect(nummern()).toEqual(['4']);
    fireEvent.change(screen.getByLabelText('Art filtern'), { target: { value: 'alle' } });
    const gemeinden = [...(screen.getByLabelText('Gemeinde filtern') as HTMLSelectElement).options].map((o) => o.textContent);
    expect(gemeinden).toEqual(['Alle Gemeinden', 'Kirchengemeinde Musterdorf', 'Kirchengemeinde Wiesengrund']);
    fireEvent.change(screen.getByLabelText('Gemeinde filtern'), { target: { value: '8' } });
    expect(nummern()).toEqual(['2']);
  });

  it('die Suche findet nach Nummer, Betreff und Gemeinde -- Umlaute auch ohne Umlaut getippt', async () => {
    await zeigen();
    filterOeffnen();
    fireEvent.change(screen.getByLabelText('Suche'), { target: { value: 'buesum' } });
    expect(nummern()).toEqual(['4']);
    fireEvent.change(screen.getByLabelText('Suche'), { target: { value: 'wiesengrund' } });
    expect(nummern()).toEqual(['2']);
    fireEvent.change(screen.getByLabelText('Suche'), { target: { value: '3' } });
    expect(nummern()).toEqual(['3']);
  });

  it('ein Filter ohne Vorgänge: eigener Hinweis', async () => {
    await zeigen();
    filterOeffnen();
    // Leer durch die Suche: Das sagt der Hinweis, mit dem Weg zurück (wie im Browser, seit 09.10.2026).
    fireEvent.change(screen.getByLabelText('Suche'), { target: { value: 'gibt es nicht' } });
    expect(screen.getByText('Keine Treffer')).toBeInTheDocument();
    expect(screen.getByText('In dieser Auswahl gibt es keinen Vorgang zu „gibt es nicht“.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Auswahl zurücksetzen' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Suche'), { target: { value: '' } });
    fireEvent.click(segment('Neu 2'));
    server.stand.vorgaenge.forEach((v) => { v.status = 'in_arbeit'; });
    await act(async () => { (await import('../../../utils/supportAktualisieren')).meldeSupportGeaendert(); });
    await waitFor(() => expect(screen.getByText('Alle Vorgänge sind schon in Arbeit.')).toBeInTheDocument());
    expect(screen.getByText('Nichts Neues')).toBeInTheDocument();
  });

  it('?filter=neu und ?art=lizenz aus der Adresse stellen die Auswahl ein; die alte Anfragen-Liste führt auf die Art „Neue Gemeinde“', async () => {
    h.standort = { pathname: '/admin/support/vorgaenge', search: '?art=neue_gemeinde', state: null };
    await zeigen().catch(() => undefined);
    await waitFor(() => expect(nummern()).toEqual(['3']));
    // Gesetzt beim Laden: Der Bereich steht offen, sonst filterte etwas, das man nicht sieht.
    expect(filterKnopf()).toHaveAttribute('aria-label', 'Filter, 1 aktiv');
    expect(filterKnopf()).toHaveAttribute('aria-expanded', 'true');
    expect((screen.getByLabelText('Art filtern') as HTMLSelectElement).value).toBe('neue_gemeinde');
  });

  it('?gemeinde=7 zeigt die Vorgänge einer Gemeinde und aus dem Plus wird „Gemeinde anschreiben“', async () => {
    h.standort = { pathname: '/admin/support/vorgaenge', search: '?gemeinde=7', state: null };
    render(<SupportVorgaengePage />);
    await waitFor(() => expect(nummern()).toEqual(['1']));
    expect(screen.getByRole('button', { name: 'Gemeinde anschreiben' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Neuer Vorgang' })).toBeNull();
    expect(filterKnopf()).toHaveAttribute('aria-label', 'Filter, 1 aktiv');
    expect((screen.getByLabelText('Gemeinde filtern') as HTMLSelectElement).value).toBe('7');
  });
});

describe('Vorgänge (App): Art, Gemeinde und Suche hinter dem Knopf „Filter“', () => {
  it('ohne Auswahl ist der Bereich zu: keine Felder, der Knopf sagt „Filter“ und zeigt auf den Bereich', async () => {
    await zeigen();
    expect(screen.queryByRole('group', { name: 'Filter' })).toBeNull();
    for (const feld of ['Art filtern', 'Gemeinde filtern', 'Suche']) expect(screen.queryByLabelText(feld), feld).toBeNull();
    expect(filterKnopf()).toHaveAttribute('aria-label', 'Filter');
    expect(filterKnopf()).toHaveAttribute('aria-expanded', 'false');
    expect(filterKnopf().getAttribute('aria-controls')).toMatch(/\S/);
    // Keine Zahl am Knopf, solange nichts eingrenzt.
    expect(filterKnopf().textContent).toBe('');
    // Die Reiter stehen immer da.
    expect(screen.getByRole('tablist', { name: 'Vorgänge nach Stand' })).toBeInTheDocument();
  });

  it('der Knopf klappt den Bereich mit Art, Gemeinde und Suche auf und wieder zu', async () => {
    await zeigen();
    fireEvent.click(filterKnopf());
    expect(filterKnopf()).toHaveAttribute('aria-expanded', 'true');
    const bereich = screen.getByRole('group', { name: 'Filter' });
    expect(bereich.id).toBe(filterKnopf().getAttribute('aria-controls'));
    expect(within(bereich).getByLabelText('Art filtern')).toBeInTheDocument();
    expect(within(bereich).getByLabelText('Gemeinde filtern')).toBeInTheDocument();
    expect(within(bereich).getByLabelText('Suche')).toBeInTheDocument();
    fireEvent.click(filterKnopf());
    expect(filterKnopf()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('group', { name: 'Filter' })).toBeNull();
  });

  it('der Knopf zählt, was eingrenzt -- Art, Gemeinde und Suche --, auch zugeklappt; die Liste bleibt eingegrenzt', async () => {
    await zeigen();
    fireEvent.click(filterKnopf());
    fireEvent.change(screen.getByLabelText('Art filtern'), { target: { value: 'frage' } });
    expect(filterKnopf()).toHaveAttribute('aria-label', 'Filter, 1 aktiv');
    fireEvent.change(screen.getByLabelText('Gemeinde filtern'), { target: { value: '8' } });
    expect(filterKnopf()).toHaveAttribute('aria-label', 'Filter, 2 aktiv');
    fireEvent.change(screen.getByLabelText('Suche'), { target: { value: 'passwort' } });
    expect(filterKnopf()).toHaveAttribute('aria-label', 'Filter, 3 aktiv');
    expect(filterKnopf().textContent).toBe('3');
    expect(nummern()).toEqual(['2']);
    fireEvent.click(filterKnopf());
    expect(screen.queryByRole('group', { name: 'Filter' })).toBeNull();
    expect(filterKnopf()).toHaveAttribute('aria-label', 'Filter, 3 aktiv');
    expect(nummern()).toEqual(['2']);
    // Nur Leerzeichen in der Suche grenzen nicht ein und zählen nicht.
    fireEvent.click(filterKnopf());
    fireEvent.change(screen.getByLabelText('Suche'), { target: { value: '   ' } });
    expect(filterKnopf()).toHaveAttribute('aria-label', 'Filter, 2 aktiv');
  });

  it('„Auswahl zurücksetzen“ nimmt alle drei zurück: keine Zahl mehr am Knopf', async () => {
    await zeigen();
    fireEvent.click(filterKnopf());
    fireEvent.change(screen.getByLabelText('Art filtern'), { target: { value: 'lizenz' } });
    fireEvent.change(screen.getByLabelText('Suche'), { target: { value: 'gibt es nicht' } });
    expect(filterKnopf()).toHaveAttribute('aria-label', 'Filter, 2 aktiv');
    fireEvent.click(screen.getByRole('button', { name: 'Auswahl zurücksetzen' }));
    expect(filterKnopf()).toHaveAttribute('aria-label', 'Filter');
    expect(filterKnopf().textContent).toBe('');
    expect(nummern()).toEqual(['1', '3', '2', '4']);
  });

  it('eine neue Adresse mit ?gemeinde= klappt den Bereich auf, auch wenn die Seite schon offen war (Ionic hält sie im Speicher)', async () => {
    const { rerender } = render(<SupportVorgaengePage />);
    await screen.findByRole('button', { name: /^Vorgang 1:/ });
    expect(filterKnopf()).toHaveAttribute('aria-expanded', 'false');
    h.standort = { pathname: '/admin/support/vorgaenge', search: '?gemeinde=7', state: null };
    rerender(<SupportVorgaengePage />);
    await waitFor(() => expect(nummern()).toEqual(['1']));
    expect(filterKnopf()).toHaveAttribute('aria-expanded', 'true');
    expect(filterKnopf()).toHaveAttribute('aria-label', 'Filter, 1 aktiv');
    expect((screen.getByLabelText('Gemeinde filtern') as HTMLSelectElement).value).toBe('7');
  });
});

describe('Vorgänge (App): Neuer Vorgang', () => {
  const oeffnen = async () => {
    await zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Neuer Vorgang' }));
  };

  it('das Plus öffnet den Abschnitt mit Art, Bereich, Dringlichkeit, Betreff, Gemeinde und erster Mail; ein zweites Antippen schließt ihn', async () => {
    await oeffnen();
    for (const name of ['Art', 'Bereich', 'Dringlichkeit', 'Betreff', 'Gemeinde', 'Text der Mail']) expect(screen.getByLabelText(name), name).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vorgang anlegen' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Neuer Vorgang' }));
    expect(screen.queryByRole('button', { name: 'Vorgang anlegen' })).toBeNull();
  });

  it('ohne Art: ein Satz sagt, was fehlt -- nichts geht raus', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Vorgang anlegen' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Bitte eine Art wählen');
    expect(server.aufrufe('post', '/support/vorgaenge')).toHaveLength(0);
  });

  it('legt den Vorgang mit genau den gewählten Werten an und öffnet ihn', async () => {
    await oeffnen();
    fireEvent.change(screen.getByLabelText('Art'), { target: { value: 'fehler' } });
    fireEvent.change(screen.getByLabelText('Bereich'), { target: { value: 'chat' } });
    fireEvent.change(screen.getByLabelText('Dringlichkeit'), { target: { value: 'dringend' } });
    fireEvent.change(screen.getByLabelText('Betreff'), { target: { value: '  Chat geht nicht  ' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Vorgang anlegen' })); });
    expect(server.aufrufe('post', '/support/vorgaenge').map((a) => a.koerper)).toEqual([
      { art: 'fehler', bereich: 'chat', dringlichkeit: 'dringend', betreff: 'Chat geht nicht' },
    ]);
    expect(h.setSuccess).toHaveBeenCalledWith('Vorgang 100 angelegt');
    expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge/100');
  });

  it('mit Gemeinde und erster Mail: die Adresse kommt aus der Gemeindeleitung und geht mit', async () => {
    await oeffnen();
    fireEvent.change(screen.getByLabelText('Art'), { target: { value: 'sonstiges' } });
    fireEvent.change(screen.getByLabelText('Betreff'), { target: { value: 'Willkommen' } });
    await waitFor(() => expect((screen.getByLabelText('Gemeinde') as HTMLSelectElement).options.length).toBeGreaterThan(1));
    fireEvent.change(screen.getByLabelText('Gemeinde'), { target: { value: '7' } });
    await waitFor(() => expect((screen.getByLabelText('An') as HTMLSelectElement).value).toBe('lena.probe@example.org'));
    fireEvent.change(screen.getByLabelText('Text der Mail'), { target: { value: 'Willkommen bei Konfi Quest.' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Vorgang anlegen' })); });
    expect(server.aufrufe('post', '/support/vorgaenge').map((a) => a.koerper)).toEqual([
      { art: 'sonstiges', dringlichkeit: 'normal', betreff: 'Willkommen', organization_id: 7, text: 'Willkommen bei Konfi Quest.', an: 'lena.probe@example.org' },
    ]);
  });

  it('ein Fehler des Servers steht im Abschnitt, der Abschnitt bleibt offen', async () => {
    server.stand.fehler.set('POST /support/vorgaenge', Object.assign(new Error('x'), { response: { status: 500, data: { error: 'Datenbankfehler' } } }));
    await oeffnen();
    fireEvent.change(screen.getByLabelText('Art'), { target: { value: 'sonstiges' } });
    fireEvent.change(screen.getByLabelText('Betreff'), { target: { value: 'Etwas' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Vorgang anlegen' })); });
    expect(screen.getByRole('alert')).toHaveTextContent('Datenbankfehler');
    expect(h.push).not.toHaveBeenCalled();
  });

  it('ohne Netz ist „Vorgang anlegen“ gesperrt', async () => {
    h.online = false;
    await oeffnen();
    expect(screen.getByRole('button', { name: 'Vorgang anlegen' })).toBeDisabled();
  });
});

describe('Vorgänge (App): Laden, Fehler, nur für den Support', () => {
  it('Fehler: Hinweis mit erneutem Versuch, der wirklich neu lädt', async () => {
    server.stand.fehler.set('GET /support/vorgaenge', new Error('Netz weg'));
    render(<SupportVorgaengePage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Vorgänge konnten nicht geladen werden.');
    server.stand.fehler.delete('GET /support/vorgaenge');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Erneut versuchen/ })); });
    expect(await screen.findByRole('button', { name: /^Vorgang 1:/ })).toBeInTheDocument();
  });

  it('eine Gemeindeleitung ohne Merkmal sieht den Hinweis, ohne Abruf', () => {
    h.user = { id: 5, role_name: 'org_admin', is_super_admin: false };
    render(<SupportVorgaengePage />);
    expect(screen.getByText('Nur für den Support')).toBeInTheDocument();
    expect(server.aufrufe('get', '/support/vorgaenge')).toHaveLength(0);
  });

  it('die Marke „Dringend“ und der Zähler stehen in der Zeile -- und nur dort, wo sie gelten', async () => {
    await zeigen();
    const zeilen = screen.getAllByRole('button', { name: /^Vorgang \d+:/ });
    expect(zeilen.map((z) => within(z).queryByText('Dringend') !== null)).toEqual([true, false, false, false]);
  });
});
