// Eine Mail aus dem Posteingang in der App-Fassung (/admin/support/post/:id),
// gerendert (docs/planung/support-detailseiten.md, Skizze App D und E):
// Kopfzeile „Mail" mit Archivieren, Kopf mit dem Kern des Betreffs, Name UND
// Adresse und den Kacheln Mails · Neu · Anhänge; die Karte „Stand" mit dem
// Postfach als Marke, Hauptknopf „Einsortieren" und daneben Antworten bzw.
// Wiederherstellen; der Verlauf mit der Antwortzeile; „Mail löschen" ganz
// unten; Ziehen zum Aktualisieren. Eine Mail, die in einem Vorgang liegt,
// leitet mit replace dorthin weiter (?mail=). Einsortieren und Antworten als
// Modal. Die Web-Fassung steht in webPostDetail.test.tsx -- beide teilen die
// Logik (usePostDetail).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import { ziehenZumAktualisieren, type AlertOptionen } from './ionicAttrappe';
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
  online: true,
  user: { id: 9, role_name: 'super_admin', is_super_admin: true } as Record<string, unknown>,
  standort: { pathname: '/admin/support/post/31', search: '', state: null },
  zweitzeileEingehaengt: false,
}));

vi.mock('@ionic/react', async () => (await import('./ionicAttrappe')).ionicAttrappe({
  presentAlert: (o) => { h.alert = o; },
  router: { push: h.push, goBack: vi.fn(), canGoBack: () => false },
}));
// Die eingeklappte Zweitzeile (AppKopfzeileGross) hier sichtbar, nicht als null
// wie in der gemeinsamen Attrappe: Ionic (iOS) blendet den Titel der Kopfzeile
// aus, sobald sie eingehängt wird (header-collapse-condense-inactive), und holt
// ihn erst beim Rollen über sie zurück. Verschwindet sie wieder, bleibt er
// ausgeblendet -- die Attrappe merkt sich deshalb, ob sie je eingehängt war.
vi.mock('../../../components/shared/AppKopfzeile', async () => {
  const { KopfzeileAttrappe } = await import('./ionicAttrappe');
  const Zweitzeile = ({ titel }: { titel: React.ReactNode }) => {
    React.useEffect(() => { h.zweitzeileEingehaengt = true; }, []);
    return <div className="kopfzeile-gross">{titel}</div>;
  };
  return { ...KopfzeileAttrappe, AppKopfzeileGross: Zweitzeile };
});
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: ({ message }: { message: string }) => <p>{message}</p> }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: h.online }),
}));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => false }));
vi.mock('../../../navigation/useAppLocation', () => ({ useAppLocation: () => h.standort }));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));

import SupportPostDetailPage from '../../../components/support/SupportPostDetailPage';
import { supportMailZaehlerZuruecksetzen } from '../../../navigation/supportMailZaehler';

let server: ReturnType<typeof vorgaengeServer>;

// Ein Faden aus drei Mails ohne Vorgang; Reihenfolge im Speicher absichtlich durcheinander.
const FADEN = () => [
  mail(31, null, {
    faden: 'zugang', postfach: 'moin', von_adresse: 'anna@example.org', von_name: 'Anna Beispiel', an_adressen: ['moin@konfi-quest.de'],
    betreff: 'AW: Re: Frage zum Zugang', gesendet_am: '2026-10-03T09:00:00Z',
    text: 'Danke! Und noch eins.\n\nAm 02.10.2026 um 12:00 schrieb Support <moin@konfi-quest.de>:\n> alte Antwort', anhaenge: [{ name: 'plan.pdf' }],
  }),
  mail(29, null, { faden: 'zugang', postfach: 'moin', von_adresse: 'anna@example.org', von_name: 'Anna Beispiel', betreff: 'Frage zum Zugang', gesendet_am: '2026-10-02T08:00:00Z', text: 'Wie melde ich mich an?' }),
  mail(30, null, {
    faden: 'zugang', postfach: 'moin', richtung: 'aus', von_adresse: 'moin@konfi-quest.de', von_name: 'Support', an_adressen: ['anna@example.org'],
    betreff: 'Re: Frage zum Zugang', gesendet_am: '2026-10-02T10:00:00Z', gelesen_am: '2026-10-02T10:00:00Z', text: 'So geht es.',
  }),
];

const VORGAENGE = () => [
  vorgang(1, { status: 'neu', art: 'fehler', bereich: 'chat', betreff: 'Chat zeigt nichts Neues', organization_id: 7, created_at: '2026-10-03T07:00:00Z' }),
  vorgang(2, { status: 'in_arbeit', art: 'frage', bereich: 'konten', betreff: 'Wie lege ich einen Jahrgang an?', created_at: '2026-10-02T09:00:00Z' }),
  vorgang(3, { status: 'erledigt', art: 'zugang', bereich: null, betreff: 'Konto entsperrt', archiviert_am: '2026-10-01T12:00:00Z' }),
];

beforeEach(() => {
  vi.clearAllMocks();
  h.alert = null;
  h.online = true;
  h.user = { id: 9, role_name: 'super_admin', is_super_admin: true };
  h.standort = { pathname: '/admin/support/post/31', search: '', state: null };
  h.zweitzeileEingehaengt = false;
  supportMailZaehlerZuruecksetzen();
  server = vorgaengeServer({ vorgaenge: VORGAENGE(), mails: FADEN() });
  server.installieren({ get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete });
});

const oeffnen = async (id = 31) => {
  render(<SupportPostDetailPage nachrichtId={id} />);
  await screen.findByRole('region', { name: 'Verlauf' });
};
const bestaetigen = async (knopf: string) => { await act(async () => { h.alert?.buttons?.find((b) => b.text === knopf)?.handler?.(); }); };
const mailZeilen = () => [...screen.getByRole('region', { name: 'Verlauf' }).querySelectorAll('li.mail-zeile')] as HTMLElement[];
const kopfzeile = () => within(document.querySelector('header') as HTMLElement);
const stand = () => within(screen.getByRole('region', { name: 'Stand' }));
/** Die Knöpfe der Karte „Stand": der erste ist der Hauptknopf. */
const knoepfe = () => [...document.querySelectorAll('.support-stand__knoepfe button')] as HTMLButtonElement[];
const marken = () => [...document.querySelectorAll('.support-stand__marken .support-marke')].map((m) => m.textContent);
const kacheln = () => [...document.querySelectorAll('.app-stats-row__value')].map((k, i) => `${document.querySelectorAll('.app-stats-row__label')[i].textContent} ${k.textContent}`);
/** „Einsortieren“ steht im Modal (11.10.2026); die offenen Vorgänge kommen beim Öffnen. */
const einsortieren = async () => {
  fireEvent.click(stand().getByRole('button', { name: 'Einsortieren' }));
  const dialog = await screen.findByRole('dialog', { name: 'Einsortieren' });
  await waitFor(() => expect((within(dialog).getByLabelText('Vorgang') as HTMLSelectElement).options.length).toBeGreaterThan(1));
  return within(dialog);
};
const antworten = async () => {
  fireEvent.click(stand().getByRole('button', { name: 'Antworten' }));
  return within(await screen.findByRole('dialog', { name: 'Antworten' }));
};
const vorgangWahl = () => screen.getByLabelText('Vorgang') as HTMLSelectElement;

describe('Mail (App): Kopf und Stand', () => {
  it('Kopfzeile „Mail" mit Archivieren; Kopf mit dem Kern des Betreffs, Name UND Adresse und den Kacheln Mails · Neu · Anhänge', async () => {
    await oeffnen();
    expect(kopfzeile().getByRole('heading', { level: 1 })).toHaveTextContent('Mail');
    expect(kopfzeile().getByRole('button', { name: 'Archivieren' })).toBeEnabled();
    // Kern ohne „AW: Re:" (Fehler vorab 1); bis 11.10.2026 nannte die App nur den Namen.
    expect(screen.getByRole('heading', { level: 2, name: 'Frage zum Zugang' })).toBeInTheDocument();
    expect(document.querySelector('.app-header-banner__subtitle')).toHaveTextContent(/^Anna Beispiel <anna@example\.org>$/);
    // Nur Zahlen (Fehler vorab 5: „support@Eingang" lief über); neu waren 29 und 31.
    // Bei 1 die Einzahl („1 Anhang", nicht „1 Anhänge").
    expect(kacheln()).toEqual(['Mails 3', 'Neu 2', 'Anhang 1']);
  });

  it('die Karte „Stand": das Postfach als Marke, kein Satz, Hauptknopf „Einsortieren", daneben „Antworten"; „Mail löschen" ganz unten', async () => {
    await oeffnen();
    expect(marken()).toEqual(['moin@']);
    expect(document.querySelector('.support-stand__satz')).toBeNull();
    expect(knoepfe().map((k) => k.textContent)).toEqual(['Einsortieren', 'Antworten']);
    expect(screen.getByRole('button', { name: 'Mail löschen' })).toBeEnabled();
    expect(screen.queryByText('Einsortiert in Vorgang', { exact: false })).toBeNull();
  });

  it('ohne Absendernamen steht nur die Adresse im Kopf', async () => {
    server.stand.mails = [mail(40, null, { betreff: 'Allein', von_name: null, von_adresse: 'info@verein.example' })];
    await oeffnen(40);
    expect(document.querySelector('.app-header-banner__subtitle')).toHaveTextContent(/^info@verein\.example$/);
    expect(kacheln()).toEqual(['Mail 1', 'Neu 1', 'Anhänge 0']);
  });

  it('im Archiv: der Archiv-Satz (Fehler vorab 6) ohne zweite Marke „Archiv", Einsortieren bleibt Hauptknopf, Wiederherstellen daneben und in der Kopfzeile; kein Antworten, kein Archivieren', async () => {
    server.stand.mails.find((m) => m.id === 31)!.archiviert_am = '2026-10-02T12:00:00Z';
    await oeffnen();
    // Jede Angabe einmal: Der Satz der Karte sagt es, die Marken wiederholen es nicht.
    expect(marken()).toEqual(['moin@']);
    expect(stand().getByText('Im Archiv seit 02.10.2026 · wird nach 180 Tagen gelöscht · Einsortieren holt sie zurück.')).toBeInTheDocument();
    expect(knoepfe().map((k) => k.textContent)).toEqual(['Einsortieren', 'Wiederherstellen']);
    expect(kopfzeile().getByRole('button', { name: 'Wiederherstellen' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Archivieren' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Antworten' })).toBeNull();
    expect(document.querySelector('button.support-antwortzeile')).toBeNull();
    expect(screen.getByRole('button', { name: 'Mail löschen' })).toBeEnabled();
  });

  it('Ziehen zum Aktualisieren lädt die Mail neu; danach verschwindet der Kreisel (complete)', async () => {
    await oeffnen();
    const vorher = server.aufrufe('get', '/support/mail/nachrichten/31').length;
    server.stand.mails.find((m) => m.id === 31)!.betreff = 'Frage zum Zugang (erledigt?)';
    let zug: ReturnType<typeof ziehenZumAktualisieren> = { refresher: 0, fertig: () => 0 };
    await act(async () => { zug = ziehenZumAktualisieren(); });
    expect(zug.refresher).toBe(1);
    await waitFor(() => expect(zug.fertig()).toBe(1));
    expect(server.aufrufe('get', '/support/mail/nachrichten/31')).toHaveLength(vorher + 1);
    expect(await screen.findByRole('heading', { level: 2, name: 'Frage zum Zugang (erledigt?)' })).toBeInTheDocument();
  });

  it('ohne Netz sind Einsortieren, Antworten, Archivieren und Löschen gesperrt', async () => {
    h.online = false;
    await oeffnen();
    expect(stand().getByRole('button', { name: 'Einsortieren' })).toBeDisabled();
    expect(stand().getByRole('button', { name: 'Antworten' })).toBeDisabled();
    expect(kopfzeile().getByRole('button', { name: 'Archivieren' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mail löschen' })).toBeDisabled();
  });
});

describe('Mail (App): der Titel der Kopfzeile bleibt sichtbar (iOS)', () => {
  /** Wie Ionic ihn zeigt: Er fehlt, wenn die Zweitzeile einmal eingehängt war und jetzt nicht mehr dasteht. */
  const titelSichtbar = () => !h.zweitzeileEingehaengt || document.querySelector('.kopfzeile-gross') !== null;
  /** Hält die Abrufe an, bis der Test sie freigibt -- so steht der Ladezustand da. */
  const abrufeAnhalten = () => {
    const echt = h.apiGet.getMockImplementation() as (...args: unknown[]) => Promise<unknown>;
    let freigeben = () => {};
    const tor = new Promise<void>((r) => { freigeben = r; });
    h.apiGet.mockImplementation(async (...args: unknown[]) => { await tor; return echt(...args); });
    return async () => { await act(async () => { freigeben(); }); };
  };

  it('beim Laden steht „Mail“ in der Kopfzeile; geladen bleibt der Titel sichtbar', async () => {
    const freigeben = abrufeAnhalten();
    render(<SupportPostDetailPage nachrichtId={31} />);
    expect(screen.getByText('Mail wird geladen...')).toBeInTheDocument();
    expect(kopfzeile().getByRole('heading', { level: 1 })).toHaveTextContent('Mail');
    await freigeben();
    await screen.findByRole('region', { name: 'Verlauf' });
    expect(titelSichtbar()).toBe(true);
  });

  it('nach einem Netzfehler und „Erneut versuchen“ bleibt der Titel sichtbar', async () => {
    server.stand.fehler.set('GET /support/mail/nachrichten/31', new Error('Netz weg'));
    render(<SupportPostDetailPage nachrichtId={31} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Mail konnte nicht geladen werden.');
    expect(titelSichtbar()).toBe(true);
    server.stand.fehler.delete('GET /support/mail/nachrichten/31');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Erneut versuchen/ })); });
    await screen.findByRole('region', { name: 'Verlauf' });
    expect(titelSichtbar()).toBe(true);
  });

  it('„Mail nicht gefunden“ und die Weiterleitung in den Vorgang: der Titel ist sichtbar', async () => {
    const { unmount } = render(<SupportPostDetailPage nachrichtId={999} />);
    expect(await screen.findByText('Mail nicht gefunden')).toBeInTheDocument();
    expect(titelSichtbar()).toBe(true);
    unmount();
    h.zweitzeileEingehaengt = false;
    server.stand.mails.forEach((m) => { m.vorgang_id = 2; });
    render(<SupportPostDetailPage nachrichtId={31} />);
    expect(await screen.findByText('Die Mail liegt in Vorgang 2 – sie öffnet sich dort.')).toBeInTheDocument();
    expect(titelSichtbar()).toBe(true);
  });
});

describe('Mail (App): liegt sie in einem Vorgang, öffnet sie sich dort (E)', () => {
  it('Weiterleitung mit replace auf den Vorgang, die Mail offen (?mail=); Archivieren und Löschen stehen nicht da (Fehler vorab 2)', async () => {
    server.stand.mails.forEach((m) => { m.vorgang_id = 2; });
    render(<SupportPostDetailPage nachrichtId={31} />);
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge/2?mail=31', 'none', 'replace'));
    expect(h.push).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Die Mail liegt in Vorgang 2 – sie öffnet sich dort.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archivieren' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mail löschen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Einsortieren' })).toBeNull();
    // Gelesen gemeldet wird trotzdem -- wie heute beim Öffnen.
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledWith('/support/mail/gelesen', { ids: [29, 31] }));
  });

  it('steht der Posteingang nicht mehr vorn (Ionic hält die Seite im Speicher), leitet sie nicht weiter', async () => {
    server.stand.mails.forEach((m) => { m.vorgang_id = 2; });
    h.standort = { pathname: '/admin/support/vorgaenge/2', search: '', state: null };
    render(<SupportPostDetailPage nachrichtId={31} />);
    expect(await screen.findByText('Die Mail liegt in Vorgang 2 – sie öffnet sich dort.')).toBeInTheDocument();
    await act(async () => {});
    expect(h.push).not.toHaveBeenCalled();
  });

  it('gehört sie (ältere Server) nur zu einer Anfrage, geht es zur Anfrage', async () => {
    h.apiGet.mockImplementation((pfad: string) => (pfad === '/support/mail/nachrichten/31'
      ? Promise.resolve({ data: { ...FADEN()[0], vorgang_id: null, anfrage_id: 41, organization_id: null, verlauf: [] } })
      : Promise.reject(new Error(`unerwartet ${pfad}`))));
    render(<SupportPostDetailPage nachrichtId={31} />);
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/admin/support/anfragen/41', 'none', 'replace'));
    expect(screen.getByText('Die Mail ist schon zugeordnet – sie öffnet sich dort.')).toBeInTheDocument();
  });
});

describe('Mail (App): Verlauf', () => {
  it('chronologisch, ein- und ausgehend unterscheidbar; ungelesene als gelesen gemeldet und für diesen Besuch „Neu“', async () => {
    await oeffnen();
    const mails = mailZeilen();
    expect(mails.map((m) => m.querySelector('time')?.getAttribute('dateTime'))).toEqual(['2026-10-02T08:00:00Z', '2026-10-02T10:00:00Z', '2026-10-03T09:00:00Z']);
    expect(mails.map((m) => within(m).queryByText('Gesendet') !== null)).toEqual([false, true, false]);
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledWith('/support/mail/gelesen', { ids: [29, 31] }));
    expect(mails.map((m) => within(m).queryByText('Neu') !== null)).toEqual([true, false, true]);
  });

  it('eingeklappt steht eine Zeile Vorschau; Antippen klappt auf und zeigt Empfänger und Postfach', async () => {
    await oeffnen();
    const gesendet = mailZeilen()[1];
    const kopf = gesendet.querySelector('button.mail-zeile__kopf') as HTMLButtonElement;
    expect(kopf).toHaveAttribute('aria-expanded', 'false');
    expect(within(gesendet).getByText('So geht es.')).toBeInTheDocument();
    fireEvent.click(kopf);
    expect(kopf).toHaveAttribute('aria-expanded', 'true');
    expect(within(gesendet).getByText('An anna@example.org · von moin@')).toBeInTheDocument();
  });

  it('unter der jüngsten Mail die Antwortzeile; antippen öffnet das Modal „Antworten"', async () => {
    await oeffnen();
    const zeile = document.querySelector('button.support-antwortzeile') as HTMLButtonElement;
    expect(zeile).toHaveTextContent('Antwort an Anna Beispiel …');
    expect(zeile.closest('li.mail-zeile, .mail-gespraeche')).not.toBeNull();
    fireEvent.click(zeile);
    expect(await screen.findByRole('dialog', { name: 'Antworten' })).toBeInTheDocument();
  });

  it('nichts ungelesen: kein Aufruf „gelesen“', async () => {
    server.stand.mails = [mail(40, null, { betreff: 'Allein', gelesen_am: '2026-10-03T09:30:00Z' })];
    await oeffnen(40);
    await act(async () => {});
    expect(h.apiPost).not.toHaveBeenCalled();
  });

  it('404: „Mail nicht gefunden“; eine ungültige Kennung ruft nichts ab', async () => {
    const { unmount } = render(<SupportPostDetailPage nachrichtId={999} />);
    expect(await screen.findByText('Mail nicht gefunden')).toBeInTheDocument();
    unmount();
    server.stand.aufrufe.length = 0;
    render(<SupportPostDetailPage nachrichtId={Number.NaN} />);
    expect(await screen.findByText('Mail nicht gefunden')).toBeInTheDocument();
    expect(server.aufrufe('get', /^\/support\/mail\/nachrichten/)).toHaveLength(0);
  });

  it('Netzfehler: Hinweis mit erneutem Versuch, der wirklich neu lädt', async () => {
    server.stand.fehler.set('GET /support/mail/nachrichten/31', new Error('Netz weg'));
    render(<SupportPostDetailPage nachrichtId={31} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Mail konnte nicht geladen werden.');
    server.stand.fehler.delete('GET /support/mail/nachrichten/31');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Erneut versuchen/ })); });
    expect(await screen.findByRole('region', { name: 'Verlauf' })).toBeInTheDocument();
    expect(mailZeilen()).toHaveLength(3);
  });
});

describe('Mail (App): einsortieren im Modal', () => {
  it('erst nach dem Antippen offen; die offenen Vorgänge stehen zur Wahl -- mit Nummer, Betreff, Gemeinde, Art und Stand --, das Archiv nicht', async () => {
    await oeffnen();
    expect(screen.queryByRole('dialog')).toBeNull();
    const modal = await einsortieren();
    expect(modal.getByText('Die Mails desselben Gesprächs, die noch im Posteingang liegen, gehen mit.')).toBeInTheDocument();
    expect([...vorgangWahl().options].map((o) => o.textContent)).toEqual([
      'Bitte wählen',
      'Nr. 1 · Chat zeigt nichts Neues · Kirchengemeinde Musterdorf · Fehler · Neu',
      'Nr. 2 · Wie lege ich einen Jahrgang an? · Keine Gemeinde · Frage · In Arbeit',
    ]);
  });

  it('die Suche engt die Vorgänge ein (Nummer, Betreff oder Gemeinde)', async () => {
    await oeffnen();
    const modal = await einsortieren();
    fireEvent.change(modal.getByLabelText('Vorgang suchen'), { target: { value: 'jahrgang' } });
    expect([...vorgangWahl().options].map((o) => o.textContent)).toEqual(['Bitte wählen', 'Nr. 2 · Wie lege ich einen Jahrgang an? · Keine Gemeinde · Frage · In Arbeit']);
    fireEvent.change(modal.getByLabelText('Vorgang suchen'), { target: { value: 'musterdorf' } });
    expect([...vorgangWahl().options].map((o) => o.textContent.split(' · ')[0])).toEqual(['Bitte wählen', 'Nr. 1']);
  });

  it('einen bestehenden Vorgang wählen: ein Aufruf mit der Nummer; der ganze Faden geht mit; der Vorgang ersetzt die Seite, die Mail darin offen', async () => {
    await oeffnen();
    const modal = await einsortieren();
    fireEvent.change(vorgangWahl(), { target: { value: '2' } });
    await act(async () => { fireEvent.click(modal.getByRole('button', { name: 'Einsortieren' })); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/einsortieren').map((a) => a.koerper)).toEqual([{ vorgang_id: 2 }]);
    expect(h.setSuccess).toHaveBeenCalledWith('Mail in Vorgang 2 einsortiert');
    // replace: Die Mail liegt nicht mehr im Posteingang -- „Zurück" führt dorthin, nicht in eine Seite, die weiterleitet.
    expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge/2?mail=31', 'forward', 'replace');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(server.stand.mails.map((m) => [m.id, m.vorgang_id]).sort()).toEqual([[29, 2], [30, 2], [31, 2]]);
  });

  it('ohne Wahl: ein Satz sagt, was fehlt -- nichts geht raus', async () => {
    await oeffnen();
    const modal = await einsortieren();
    fireEvent.click(modal.getByRole('button', { name: 'Einsortieren' }));
    expect(modal.getByRole('alert')).toHaveTextContent('Bitte einen Vorgang wählen');
    expect(server.aufrufe('post', /einsortieren$/)).toHaveLength(0);
  });

  it('neuer Vorgang: Betreff aus der Mail (als Kern); Art, Bereich, Dringlichkeit und Gemeinde gehen genau so an den Server', async () => {
    await oeffnen();
    const modal = await einsortieren();
    fireEvent.click(modal.getByRole('tab', { name: 'Neuer Vorgang' }));
    const betreff = modal.getByLabelText('Betreff') as HTMLInputElement;
    expect(betreff.value).toBe('Frage zum Zugang');
    fireEvent.change(modal.getByLabelText('Art'), { target: { value: 'fehler' } });
    fireEvent.change(modal.getByLabelText('Bereich'), { target: { value: 'chat' } });
    fireEvent.change(modal.getByLabelText('Dringlichkeit'), { target: { value: 'dringend' } });
    fireEvent.change(betreff, { target: { value: '  Anmeldung klappt nicht ' } });
    await waitFor(() => expect((modal.getByLabelText('Gemeinde') as HTMLSelectElement).options.length).toBeGreaterThan(1));
    fireEvent.change(modal.getByLabelText('Gemeinde'), { target: { value: '8' } });
    await act(async () => { fireEvent.click(modal.getByRole('button', { name: 'Einsortieren' })); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/einsortieren').map((a) => a.koerper)).toEqual([
      { neu: { art: 'fehler', bereich: 'chat', dringlichkeit: 'dringend', betreff: 'Anmeldung klappt nicht', organization_id: 8 } },
    ]);
    expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge/100?mail=31', 'forward', 'replace');
  });

  it('neuer Vorgang: ohne Art, ohne Bereich bei Frage, Fehler, Wunsch und ohne Betreff sagt je ein Satz, was fehlt', async () => {
    await oeffnen();
    const modal = await einsortieren();
    fireEvent.click(modal.getByRole('tab', { name: 'Neuer Vorgang' }));
    fireEvent.click(modal.getByRole('button', { name: 'Einsortieren' }));
    expect(modal.getByRole('alert')).toHaveTextContent('Bitte eine Art wählen');
    fireEvent.change(modal.getByLabelText('Art'), { target: { value: 'wunsch' } });
    fireEvent.click(modal.getByRole('button', { name: 'Einsortieren' }));
    expect(modal.getByRole('alert')).toHaveTextContent('Bitte einen Bereich wählen');
    fireEvent.change(modal.getByLabelText('Art'), { target: { value: 'lizenz' } });
    fireEvent.change(modal.getByLabelText('Betreff'), { target: { value: ' ' } });
    fireEvent.click(modal.getByRole('button', { name: 'Einsortieren' }));
    expect(modal.getByRole('alert')).toHaveTextContent('Bitte einen Betreff eingeben');
    expect(server.aufrufe('post', /einsortieren$/)).toHaveLength(0);
  });

  it('ein Fehler des Servers: er steht im Modal, es bleibt offen, nichts öffnet sich', async () => {
    server.stand.fehler.set('POST /support/mail/nachrichten/31/einsortieren', Object.assign(new Error('x'), { response: { status: 500, data: { error: 'Datenbankfehler' } } }));
    await oeffnen();
    const modal = await einsortieren();
    fireEvent.change(vorgangWahl(), { target: { value: '1' } });
    await act(async () => { fireEvent.click(modal.getByRole('button', { name: 'Einsortieren' })); });
    expect(modal.getByRole('alert')).toHaveTextContent('Datenbankfehler');
    expect(screen.getByRole('dialog', { name: 'Einsortieren' })).toBeInTheDocument();
    expect(h.push).not.toHaveBeenCalled();
  });
});

describe('Mail (App): archivieren, wiederherstellen, löschen', () => {
  it('Archivieren (Kopfzeile): eine Anfrage an die Mail; danach der Archiv-Satz und „Wiederherstellen“', async () => {
    await oeffnen();
    await act(async () => { fireEvent.click(kopfzeile().getByRole('button', { name: 'Archivieren' })); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/archivieren')).toHaveLength(1);
    expect(h.setSuccess).toHaveBeenCalledWith('1 Mail archiviert');
    expect(await screen.findByText(/^Im Archiv seit \d\d\.\d\d\.\d{4} · wird nach 180 Tagen gelöscht/)).toBeInTheDocument();
    expect(stand().getByRole('button', { name: 'Wiederherstellen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archivieren' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Antworten' })).toBeNull();
  });

  it('Wiederherstellen: die Mail ist wieder im Posteingang, „Antworten“ ist wieder da', async () => {
    server.stand.mails.find((m) => m.id === 31)!.archiviert_am = '2026-10-02T12:00:00Z';
    await oeffnen();
    await act(async () => { fireEvent.click(stand().getByRole('button', { name: 'Wiederherstellen' })); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/wiederherstellen')).toHaveLength(1);
    expect(h.setSuccess).toHaveBeenCalledWith('1 Mail wiederhergestellt – wieder im Posteingang');
    await waitFor(() => expect(document.querySelector('.support-stand__satz')).toBeNull());
    expect(await stand().findByRole('button', { name: 'Antworten' })).toBeInTheDocument();
  });

  it('„Mail löschen“ fragt zuerst; erst „Löschen“ löscht und führt zurück zum Posteingang', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Mail löschen' }));
    expect(h.alert?.header).toBe('Mail löschen');
    expect(h.alert?.message).toContain('Im Postfach selbst bleibt alles stehen');
    expect(server.aufrufe('delete')).toHaveLength(0);
    await bestaetigen('Löschen');
    expect(server.aufrufe('delete', '/support/mail/nachrichten/31')).toHaveLength(1);
    expect(h.setSuccess).toHaveBeenCalledWith('1 Mail gelöscht');
    expect(h.push).toHaveBeenCalledWith('/admin/support/post', 'back', 'replace');
  });

  it('Abbrechen löscht nichts', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Mail löschen' }));
    await bestaetigen('Abbrechen');
    expect(server.aufrufe('delete')).toHaveLength(0);
    expect(h.push).not.toHaveBeenCalled();
  });
});

describe('Mail (App): antworten', () => {
  it('an den Absender der letzten eingehenden Mail, Betreff „Re: " + Kern, mit Rückfrage; danach schließt das Modal und die Mail lädt neu', async () => {
    await oeffnen();
    const modal = await antworten();
    // „Du antwortest auf": die beantwortete Mail im Modal.
    expect(modal.getByText(/^Du antwortest auf/)).toBeInTheDocument();
    // Eine feste Zeile mit Name UND Adresse (der beantworteten Mail), von welchem Postfach.
    expect(modal.getByText('Anna Beispiel <anna@example.org>', { selector: 'strong' })).toBeInTheDocument();
    await waitFor(() => expect((modal.getByLabelText('Betreff', { selector: 'input' }) as HTMLInputElement).value).toBe('Re: Frage zum Zugang'));
    fireEvent.change(modal.getByLabelText('Text der Antwort'), { target: { value: 'Hallo Anna,\nso geht es.' } });
    fireEvent.click(modal.getByRole('button', { name: 'Vorschau mit Fußzeile' }));
    expect(modal.getByRole('region', { name: 'Vorschau der Antwort' }).textContent).toBe('Hallo Anna,\nso geht es.\n\n-- \nKonfi Quest');

    fireEvent.click(modal.getByRole('button', { name: 'Antwort senden' }));
    expect(h.alert?.header).toBe('Antwort senden');
    expect(h.alert?.message).toBe('An anna@example.org: „Re: Frage zum Zugang“ von moin@ senden?');
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/antworten')).toHaveLength(0);

    const abrufeVorher = server.aufrufe('get', '/support/mail/nachrichten/31').length;
    await act(async () => { h.alert?.buttons?.find((b) => b.text === 'Senden')?.handler?.(); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/antworten').map((a) => a.koerper)).toEqual([{ text: 'Hallo Anna,\nso geht es.', betreff: 'Re: Frage zum Zugang' }]);
    expect(h.setSuccess).toHaveBeenCalledWith('Antwort gesendet');
    await waitFor(() => expect(server.aufrufe('get', '/support/mail/nachrichten/31').length).toBe(abrufeVorher + 1));
    expect(screen.queryByRole('dialog', { name: 'Antworten' })).toBeNull();
    await waitFor(() => expect(mailZeilen()).toHaveLength(4));
  });

  it('eine ältere Mail des Fadens geöffnet: die Antwort geht an die angezeigte, beantwortete Mail -- Empfänger und Bezug wie im Modal', async () => {
    // Die jüngste eingehende Mail kam von einer anderen Adresse als die geöffnete ältere (29).
    const juengste = server.stand.mails.find((m) => m.id === 31)!;
    juengste.von_adresse = 'sekretariat@example.org';
    juengste.von_name = 'Sekretariat Lindenau';
    await oeffnen(29);
    const modal = await antworten();
    expect(modal.getByText(/^Du antwortest auf/)).toHaveTextContent('Sekretariat Lindenau');
    expect(modal.getByText('Sekretariat Lindenau <sekretariat@example.org>', { selector: 'strong' })).toBeInTheDocument();
    fireEvent.change(modal.getByLabelText('Text der Antwort'), { target: { value: 'Hallo zusammen' } });
    fireEvent.click(modal.getByRole('button', { name: 'Antwort senden' }));
    expect(h.alert?.message).toBe('An sekretariat@example.org: „Re: Frage zum Zugang“ von moin@ senden?');
    await bestaetigen('Senden');
    // Bis 12.10.2026 ging sie an die Mail aus der Adresse (29): an anna@ statt an die angezeigte Adresse,
    // mit 29 als Bezug -- die Anzeige nannte die jüngste eingehende Mail des Fadens.
    expect(server.aufrufe('post', /\/antworten$/).map((a) => a.pfad)).toEqual(['/support/mail/nachrichten/31/antworten']);
    expect(server.stand.mails.find((m) => m.richtung === 'aus' && m.text === 'Hallo zusammen')?.an_adressen).toEqual(['sekretariat@example.org']);
  });

  it('ein Fehler beim Senden: das Modal bleibt offen, der Text steht noch da', async () => {
    await oeffnen();
    const modal = await antworten();
    fireEvent.change(modal.getByLabelText('Text der Antwort'), { target: { value: 'Hallo Anna' } });
    fireEvent.click(modal.getByRole('button', { name: 'Antwort senden' }));
    h.apiPost.mockRejectedValueOnce({ response: { status: 502, data: { error: 'SMTP' } } });
    await bestaetigen('Senden');
    expect(await modal.findByRole('alert')).toHaveTextContent('Versand gescheitert');
    expect(screen.getByRole('dialog', { name: 'Antworten' })).toBeInTheDocument();
    expect((modal.getByLabelText('Text der Antwort') as HTMLTextAreaElement).value).toBe('Hallo Anna');
  });
});

describe('Mail: nur für den Support', () => {
  it('eine Gemeindeleitung ohne Merkmal sieht den Hinweis, ohne Abruf', () => {
    h.user = { id: 5, role_name: 'org_admin', is_super_admin: false };
    render(<SupportPostDetailPage nachrichtId={31} />);
    expect(screen.getByText('Nur für den Support')).toBeInTheDocument();
    expect(h.apiGet).not.toHaveBeenCalled();
  });
});
