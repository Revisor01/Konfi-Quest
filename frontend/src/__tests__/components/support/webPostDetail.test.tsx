// Eine Mail aus dem Posteingang in der Web-Fassung (/admin/support/post/:id),
// gerendert (docs/planung/support-detailseiten.md, Skizzen D und E): Die
// Adresse öffnet den Posteingang mit dieser Mail im Lesebereich rechts. Kopf
// wie bei einem Vorgang -- Kreis mit Initialen, Kern des Betreffs, „Von Name
// <adresse> · an Postfach · Zeit · N Mails · Anhänge", rechts Löschen und
// Archivieren als Symbole, Antworten und rechts außen „Einsortieren". Ein
// Stand-Satz nur im Archiv. Der Verlauf flach mit der Antwortzeile unter der
// jüngsten Mail; der Editor öffnet sich dort. Liegt die Mail in einem Vorgang,
// leitet die Seite mit replace dorthin (?mail=). Nach Archivieren oder Löschen
// öffnet sich die nächste Mail der Liste. Die Logik ist die der App
// (usePostDetail, useEinsortieren). Im schmalen Fenster bleibt die Seite der App.
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
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
  standort: { pathname: '/admin/support/post/31', search: '', state: null },
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
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));

import SupportPostDetailPage from '../../../components/support/SupportPostDetailPage';
import { supportMailZaehlerZuruecksetzen } from '../../../navigation/supportMailZaehler';
import { meldeSupportGeaendert } from '../../../utils/supportAktualisieren';

let vorherTZ: string | undefined;
beforeAll(() => { vorherTZ = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherTZ === undefined) delete process.env.TZ; else process.env.TZ = vorherTZ; });

let server: ReturnType<typeof vorgaengeServer>;
const rollen = vi.fn();
const rollenVorher = Element.prototype.scrollIntoView;

// Ein Faden aus drei Mails ohne Vorgang; Reihenfolge im Speicher absichtlich
// durcheinander. Die Kopfzeilen verketten sie: 29 <- 30 <- 31. Dazu eine
// weitere, ältere Mail im Posteingang (42).
const FADEN = () => [
  mail(31, null, {
    faden: 'zugang', postfach: 'moin', von_adresse: 'anna@example.org', von_name: 'Anna Beispiel', an_adressen: ['moin@konfi-quest.example'],
    betreff: 'AW: Re: Frage zum Zugang', gesendet_am: '2026-10-03T09:00:00Z', message_id: '<z3@ex>', in_reply_to: '<z2@kq>', referenzen: ['<z1@ex>', '<z2@kq>'],
    text: 'Danke! Und noch eins.\n\nAm 02.10.2026 um 12:00 schrieb Support <moin@konfi-quest.example>:\n> alte Antwort', anhaenge: [{ name: 'plan.pdf' }],
  }),
  mail(29, null, { faden: 'zugang', postfach: 'moin', von_adresse: 'anna@example.org', von_name: 'Anna Beispiel', betreff: 'Frage zum Zugang', gesendet_am: '2026-10-02T08:00:00Z', text: 'Wie melde ich mich an?', message_id: '<z1@ex>' }),
  mail(30, null, {
    faden: 'zugang', postfach: 'moin', richtung: 'aus', von_adresse: 'moin@konfi-quest.example', von_name: 'Support', an_adressen: ['anna@example.org'],
    betreff: 'Re: Frage zum Zugang', gesendet_am: '2026-10-02T10:00:00Z', gelesen_am: '2026-10-02T10:00:00Z', text: 'So geht es.\n\n-- \nKonfi Quest · Fußzeile',
    message_id: '<z2@kq>', in_reply_to: '<z1@ex>', referenzen: ['<z1@ex>'],
  }),
  mail(42, null, { postfach: 'support', von_adresse: 'ben@example.org', von_name: 'Ben Vorlage', betreff: 'Termin-Export', gesendet_am: '2026-10-01T08:00:00Z', gelesen_am: '2026-10-01T09:00:00Z' }),
];

const VORGAENGE = () => [
  vorgang(1, { status: 'neu', art: 'fehler', bereich: 'chat', betreff: 'Chat zeigt nichts Neues', organization_id: 7, created_at: '2026-10-03T07:00:00Z' }),
  vorgang(2, { status: 'in_arbeit', art: 'frage', bereich: 'konten', betreff: 'Wie lege ich einen Jahrgang an?', created_at: '2026-10-02T09:00:00Z' }),
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));
  Element.prototype.scrollIntoView = rollen;
  h.alert = null;
  h.breit = true;
  h.online = true;
  h.user = { id: 9, role_name: 'super_admin', is_super_admin: true };
  h.standort = { pathname: '/admin/support/post/31', search: '', state: null };
  window.history.replaceState(null, '', '/admin/support/post/31');
  try { window.localStorage.clear(); } catch { /* ohne Speicher */ }
  supportMailZaehlerZuruecksetzen();
  server = vorgaengeServer({ vorgaenge: VORGAENGE(), mails: FADEN() });
  server.installieren({ get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete });
});

afterEach(() => {
  vi.useRealTimers();
  Element.prototype.scrollIntoView = rollenVorher;
});

const oeffnen = async (id = 31, titel = 'Frage zum Zugang') => {
  render(<SupportPostDetailPage nachrichtId={id} />);
  await screen.findByRole('article', { name: titel });
};
/** Der Lesebereich rechts: die gewählte Mail mit ihrem Verlauf. */
const lesen = (titel = 'Frage zum Zugang') => screen.getByRole('article', { name: titel });
const kopf = () => lesen().querySelector('.web-lesen__kopf') as HTMLElement;
const kennzeichen = () => lesen().querySelector('.web-lesen__angaben') as HTMLElement;
/** Die Knöpfe im Kopf, sortiert: welche es gibt, nicht wo sie stehen (Symbolknöpfe tragen den Namen in aria-label). */
const aktionen = () => [...kopf().querySelectorAll<HTMLElement>('.web-kopfaktionen > .web-kopfknopf')];
const aktionNamen = () => aktionen().map((k) => k.getAttribute('aria-label') ?? k.textContent!.trim()).sort();
const knopf = (name: string) => within(kopf()).getByRole('button', { name });
const liste = () => screen.getByRole('navigation', { name: 'Mails im Posteingang' });
const gewaehlteZeile = () => within(liste()).getByRole('button', { current: true });
const bestaetigen = async (k: string) => { await act(async () => { h.alert?.buttons?.find((b) => b.text === k)?.handler?.(); }); };
const dialog = () => screen.getByRole('dialog', { name: 'Mail einsortieren' });
const antwortzeile = () => lesen().querySelector('button.web-antwortzeile') as HTMLButtonElement | null;

describe('Mail (Web): im Lesebereich neben dem Posteingang', () => {
  it('die Adresse einer Mail öffnet den Posteingang; die Mail steht rechts, ihre Zeile links ist gewählt', async () => {
    await oeffnen();
    expect(screen.getByRole('heading', { level: 1, name: 'Posteingang' })).toBeInTheDocument();
    // 29 und 31 tragen denselben Namen; gewählt ist genau eine Zeile -- die von 31 (die jüngere steht oben).
    const gewaehlt = within(liste()).getAllByRole('button', { current: true });
    expect(gewaehlt).toHaveLength(1);
    expect(gewaehlt[0]).toHaveAccessibleName(/^Anna Beispiel: Frage zum Zugang/);
    expect(within(liste()).getAllByRole('button', { name: /^Anna Beispiel: Frage zum Zugang/ }).indexOf(gewaehlt[0])).toBe(0);
  });

  it('der Kopf: Kreis mit Initialen, der Kern des Betreffs (ohne „AW: Re:"), „Von Name <adresse>", Postfach, Zeit, Mails und Anhänge (D)', async () => {
    await oeffnen();
    expect(within(lesen()).getByRole('heading', { level: 2, name: 'Frage zum Zugang' })).toHaveAttribute('title', 'Frage zum Zugang');
    const kreis = kopf().querySelector('.web-lesen__kreis > span')!;
    expect(kreis).toHaveTextContent('AB');
    expect(kreis).toHaveAttribute('aria-hidden', 'true');
    expect([...kennzeichen().children].map((c) => c.textContent!.trim())).toEqual([
      'Von Anna Beispiel <anna@example.org>', 'an moin@', 'heute, 11:00', '3 Mails', '1 Anhang',
    ]);
  });

  it('im Kopf: Löschen, Archivieren, Antworten und „Einsortieren"; kein Stand-Satz', async () => {
    await oeffnen();
    expect(aktionNamen()).toEqual(['Antworten', 'Archivieren', 'Einsortieren', 'Löschen']);
    expect(lesen().querySelector('.web-stand')).toBeNull();
  });

  it('der Verlauf, das Älteste oben; offen sind die jüngste und die ungelesenen; keine Aktionen je Mail', async () => {
    await oeffnen();
    const verlauf = within(lesen()).getByRole('region', { name: 'Verlauf' });
    const zeilen = [...verlauf.querySelectorAll<HTMLElement>('li.mail-zeile')];
    expect(zeilen.map((z) => z.querySelector('.mail-zeile__absender')?.textContent)).toEqual(['Anna Beispiel', 'Support', 'Anna Beispiel']);
    // 29 und 31 waren ungelesen: offen und „Neu“; die gesendete 30 ist zu und trägt „Gesendet“.
    const koepfe = zeilen.map((z) => within(z).getAllByRole('button')[0]);
    expect(koepfe.map((k) => k.getAttribute('aria-expanded'))).toEqual(['true', 'false', 'true']);
    expect(koepfe.map((k) => k.textContent?.includes('Neu'))).toEqual([true, false, true]);
    expect(koepfe[1]).toHaveTextContent('Gesendet');
    // Das Menü einer Mail bietet nur „Kopfzeilen zeigen" -- Verschieben und Herauslösen gibt es nur im Vorgang.
    fireEvent.click(within(zeilen[2]).getByRole('button', { name: /^Aktionen zur Mail von/ }));
    expect(within(zeilen[2]).getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Kopfzeilen zeigen']);
  });

  it('Text mit eingeklapptem Zitat, Anhänge nur als Namen', async () => {
    await oeffnen();
    expect(within(lesen()).getByText('Danke! Und noch eins.')).toBeInTheDocument();
    expect(within(lesen()).queryByText(/alte Antwort/)).toBeNull();
    fireEvent.click(within(lesen()).getByRole('button', { name: 'Zitat einblenden' }));
    expect(within(lesen()).getByText(/alte Antwort/).textContent).toBe('Am 02.10.2026 um 12:00 schrieb Support <moin@konfi-quest.example>:\n> alte Antwort');
    expect(within(lesen()).getByRole('list', { name: 'Anhänge' }).textContent).toBe('plan.pdf');
  });

  it('die ungelesenen Mails des Fadens werden mit einem Aufruf gemeldet', async () => {
    await oeffnen();
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledWith('/support/mail/gelesen', { ids: [29, 31] }));
    await waitFor(() => expect(server.stand.mails.filter((m) => m.gelesen_am).map((m) => m.id).sort()).toEqual([29, 30, 31, 42]));
  });

  it('eine einzelne Mail ohne Anhang: weder „Mails" noch „Anhänge" in den Kennzeichen', async () => {
    server.stand.mails = [mail(40, null, { betreff: 'Allein', von_name: 'Ben', gesendet_am: '2026-10-02T09:00:00Z' })];
    h.standort = { pathname: '/admin/support/post/40', search: '', state: null };
    await oeffnen(40, 'Allein');
    expect([...lesen('Allein').querySelector('.web-lesen__angaben')!.children].map((c) => c.textContent!.trim())).toEqual([
      'Von Ben <lena.probe@example.org>', 'an support@', 'gestern, 11:00',
    ]);
    expect(lesen('Allein').querySelectorAll('li.mail-zeile')).toHaveLength(1);
  });

  it('nichts ungelesen: kein Aufruf „gelesen“', async () => {
    server.stand.mails = [mail(40, null, { betreff: 'Allein', gelesen_am: '2026-10-03T09:30:00Z' })];
    await oeffnen(40, 'Allein');
    await act(async () => {});
    expect(h.apiPost).not.toHaveBeenCalled();
  });
});

describe('Mail (Web): liegt sie in einem Vorgang, öffnet sie sich dort (E)', () => {
  it('Weiterleitung mit replace auf /vorgaenge/N?mail=ID; Archivieren, Löschen und Einsortieren gibt es dann nicht (Fehler vorab 2)', async () => {
    server.stand.mails.forEach((m) => { if (m.faden === 'zugang') m.vorgang_id = 2; });
    render(<SupportPostDetailPage nachrichtId={31} />);
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge/2?mail=31', 'none', 'replace'));
    expect(h.push).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Die Mail liegt in Vorgang 2 – sie öffnet sich dort.')).toBeInTheDocument();
    expect(screen.queryByRole('article')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Archivieren' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Löschen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Einsortieren' })).toBeNull();
  });

  // Weitergeleitet wird nur, was schon beim Öffnen woanders lag (Direktlink, Übersicht). Wird die
  // gewählte Mail später anderswo einsortiert -- anderer Reiter, Handy, zweite Person --, ersetzte
  // die Weiterleitung sonst den ganzen Posteingang durch den Vorgang, und „Zurück" führte nicht
  // mehr zur Liste.
  it('wird die gewählte Mail später woanders einsortiert, bleibt der Posteingang stehen; der Lesebereich sagt es und öffnet den Vorgang auf Wunsch', async () => {
    await oeffnen();
    server.stand.mails.forEach((m) => { if (m.faden === 'zugang') m.vorgang_id = 2; });
    await act(async () => { meldeSupportGeaendert(); });
    expect(await screen.findByText('Die Mail liegt inzwischen in Vorgang 2.')).toBeInTheDocument();
    expect(h.push).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 1, name: 'Posteingang' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Im Vorgang 2 öffnen' }));
    expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge/2?mail=31');
    expect(h.push).toHaveBeenCalledTimes(1);
  });

  it('steht der Posteingang nicht mehr vorn (Ionic hält die Seite im Speicher), leitet sie nicht weiter', async () => {
    server.stand.mails.forEach((m) => { if (m.faden === 'zugang') m.vorgang_id = 2; });
    h.standort = { pathname: '/admin/support/vorgaenge/2', search: '?mail=31', state: null };
    render(<SupportPostDetailPage nachrichtId={31} />);
    expect(await screen.findByText('Die Mail liegt in Vorgang 2 – sie öffnet sich dort.')).toBeInTheDocument();
    await act(async () => {});
    expect(h.push).not.toHaveBeenCalled();
  });
});

describe('Mail (Web): einsortieren', () => {
  it('„Einsortieren“ öffnet den Dialog; in einen bestehenden Vorgang: ein Aufruf mit der Nummer, der ganze Faden geht mit, der Vorgang öffnet sich mit dieser Mail', async () => {
    await oeffnen();
    fireEvent.click(knopf('Einsortieren'));
    await screen.findByRole('dialog', { name: 'Mail einsortieren' });
    // Der Betreff als Kern wie im Kopf (roh hieße er „AW: Re: Frage zum Zugang").
    expect(dialog()).toHaveAccessibleDescription('„Frage zum Zugang“ kommt in einen Vorgang. Spätere Antworten darauf ordnet der Server dann selbst zu.');
    await waitFor(() => expect(within(dialog()).queryAllByRole('radio').length).toBe(2));
    fireEvent.click(within(dialog()).getByRole('radio', { name: /Nr\. 2/ }));
    await act(async () => { fireEvent.click(within(dialog()).getByRole('button', { name: 'Einsortieren' })); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/einsortieren').map((a) => a.koerper)).toEqual([{ vorgang_id: 2 }]);
    expect(h.setSuccess).toHaveBeenCalledWith('Mail in Vorgang 2 einsortiert');
    expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge/2?mail=31');
    expect(server.stand.mails.filter((m) => m.faden === 'zugang').map((m) => [m.id, m.vorgang_id]).sort()).toEqual([[29, 2], [30, 2], [31, 2]]);
  });

  it('in einen neuen Vorgang: Art und der Kern des Betreffs gehen mit; danach öffnet sich der neue Vorgang', async () => {
    await oeffnen();
    fireEvent.click(knopf('Einsortieren'));
    await screen.findByRole('dialog', { name: 'Mail einsortieren' });
    const d = within(dialog());
    fireEvent.click(d.getByRole('button', { name: 'Neuer Vorgang' }));
    expect((d.getByLabelText('Betreff') as HTMLInputElement).value).toBe('Frage zum Zugang');
    fireEvent.change(d.getByLabelText('Art'), { target: { value: 'zugang' } });
    await act(async () => { fireEvent.click(d.getByRole('button', { name: 'Einsortieren' })); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/einsortieren').map((a) => a.koerper)).toEqual([
      { neu: { art: 'zugang', dringlichkeit: 'normal', betreff: 'Frage zum Zugang' } },
    ]);
    expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge/100?mail=31');
  });

  it('ein Fehler des Servers steht im Dialog; nichts öffnet sich', async () => {
    server.stand.fehler.set('POST /support/mail/nachrichten/31/einsortieren', Object.assign(new Error('x'), { response: { status: 500, data: { error: 'Datenbankfehler' } } }));
    await oeffnen();
    fireEvent.click(knopf('Einsortieren'));
    await screen.findByRole('dialog', { name: 'Mail einsortieren' });
    await waitFor(() => expect(within(dialog()).queryAllByRole('radio').length).toBe(2));
    fireEvent.click(within(dialog()).getByRole('radio', { name: /Nr\. 1/ }));
    await act(async () => { fireEvent.click(within(dialog()).getByRole('button', { name: 'Einsortieren' })); });
    expect(within(dialog()).getByRole('alert')).toHaveTextContent('Datenbankfehler');
    expect(h.push).not.toHaveBeenCalled();
  });

  it('ohne Netz sind Antworten, Einsortieren, Archivieren und Löschen gesperrt -- auch die Antwortzeile', async () => {
    h.online = false;
    await oeffnen();
    for (const name of ['Antworten', 'Einsortieren', 'Archivieren', 'Löschen']) expect(knopf(name), name).toBeDisabled();
    expect(antwortzeile()).toBeDisabled();
  });
});

describe('Mail (Web): der Absender gehört zu einer Gemeinde (Frage 11, absender_bekannt)', () => {
  /** Anna gehört zu Musterdorf (7); dort sind 1 und -- jünger -- 5 offen, 6 ist erledigt. */
  const bekannt = () => {
    server.stand.bekannteAbsender['anna@example.org'] = 7;
    server.stand.vorgaenge.push(
      vorgang(5, { status: 'wartet', art: 'frage', bereich: 'chat', betreff: 'Chat-Benachrichtigungen', organization_id: 7, created_at: '2026-10-03T08:00:00Z' }),
      vorgang(6, { status: 'erledigt', art: 'zugang', bereich: null, betreff: 'Konto entsperrt', organization_id: 7, created_at: '2026-10-03T09:00:00Z', archiviert_am: '2026-10-03T09:30:00Z' }),
    );
  };
  const zeile = () => lesen().querySelector('.web-absender') as HTMLElement | null;

  it('kennt der Server den Absender nicht (oder ein älterer Server), steht keine Zeile da', async () => {
    await oeffnen();
    expect(zeile()).toBeNull();
    expect(within(lesen()).queryByRole('button', { name: /^In Vorgang/ })).toBeNull();
  });

  it('die Zeile nennt Gemeinde und offene Vorgänge; der Knopf daneben den jüngsten offenen -- er sortiert ohne Dialog ein, wie aus dem Dialog', async () => {
    bekannt();
    await oeffnen();
    expect(zeile()).toHaveTextContent('Absender gehört zu Kirchengemeinde Musterdorf · 2 offene Vorgänge');
    const direkt = within(zeile()!).getByRole('button', { name: 'In Vorgang 5 einsortieren' });
    expect(direkt).toHaveAttribute('title', 'Die Mail in Vorgang 5 legen – den jüngsten offenen Vorgang dieser Gemeinde');
    // Kein Knopf im Knopf: der Knopf steht neben dem Satz, die Zeile selbst ist keiner.
    expect(zeile()!.querySelectorAll('button')).toHaveLength(1);
    expect(zeile()!.closest('button')).toBeNull();
    await act(async () => { fireEvent.click(direkt); });
    expect(screen.queryByRole('dialog', { name: 'Mail einsortieren' })).toBeNull();
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/einsortieren').map((a) => a.koerper)).toEqual([{ vorgang_id: 5 }]);
    expect(h.setSuccess).toHaveBeenCalledWith('Mail in Vorgang 5 einsortiert');
    expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge/5?mail=31');
    expect(server.stand.mails.filter((m) => m.faden === 'zugang').map((m) => [m.id, m.vorgang_id]).sort()).toEqual([[29, 5], [30, 5], [31, 5]]);
  });

  it('mit getippter Antwort fragt „In Vorgang N einsortieren" erst nach -- „Abbrechen" lässt Entwurf und Mail stehen, „Verwerfen" sortiert ein', async () => {
    bekannt();
    await oeffnen();
    fireEvent.click(antwortzeile()!);
    fireEvent.change(screen.getByLabelText('Text der Antwort'), { target: { value: 'Hallo Anna, gleich …' } });
    const direkt = () => within(zeile()!).getByRole('button', { name: 'In Vorgang 5 einsortieren' });
    await act(async () => { fireEvent.click(direkt()); });
    expect(h.alert).toMatchObject({ header: 'Ungespeicherte Änderungen', message: 'Die Antwort ist noch nicht gesendet. Möchtest du sie verwerfen?' });
    await bestaetigen('Abbrechen');
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/einsortieren')).toEqual([]);
    expect((screen.getByLabelText('Text der Antwort') as HTMLTextAreaElement).value).toBe('Hallo Anna, gleich …');

    await act(async () => { fireEvent.click(direkt()); });
    await bestaetigen('Verwerfen');
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/einsortieren').map((x) => x.koerper)).toEqual([{ vorgang_id: 5 }]);
    expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge/5?mail=31');
  });

  it('mit getippter Antwort fragt auch „Einsortieren" im Kopf erst nach -- „Abbrechen" lässt Entwurf stehen und öffnet keinen Dialog', async () => {
    bekannt();
    await oeffnen();
    fireEvent.click(antwortzeile()!);
    fireEvent.change(screen.getByLabelText('Text der Antwort'), { target: { value: 'Hallo Anna, gleich …' } });
    await act(async () => { fireEvent.click(knopf('Einsortieren')); });
    expect(h.alert).toMatchObject({ header: 'Ungespeicherte Änderungen', message: 'Die Antwort ist noch nicht gesendet. Möchtest du sie verwerfen?' });
    await bestaetigen('Abbrechen');
    expect(screen.queryByRole('dialog', { name: 'Mail einsortieren' })).toBeNull();
    expect((screen.getByLabelText('Text der Antwort') as HTMLTextAreaElement).value).toBe('Hallo Anna, gleich …');

    await act(async () => { fireEvent.click(knopf('Einsortieren')); });
    await bestaetigen('Verwerfen');
    expect(await screen.findByRole('dialog', { name: 'Mail einsortieren' })).toBeInTheDocument();
  });

  it('kein offener Vorgang: „kein offener Vorgang", kein Knopf -- Einsortieren bleibt der Weg', async () => {
    server.stand.bekannteAbsender['anna@example.org'] = 8;
    await oeffnen();
    expect(zeile()).toHaveTextContent('Absender gehört zu Kirchengemeinde Wiesengrund · kein offener Vorgang');
    expect(within(zeile()!).queryByRole('button')).toBeNull();
  });

  it('ein Vorgang offen: die Einzahl', async () => {
    server.stand.bekannteAbsender['anna@example.org'] = 7;
    await oeffnen();
    expect(zeile()).toHaveTextContent('Absender gehört zu Kirchengemeinde Musterdorf · 1 offener Vorgang');
    expect(within(zeile()!).getByRole('button', { name: 'In Vorgang 1 einsortieren' })).toBeEnabled();
  });

  it('der Dialog „Einsortieren" ist vorbelegt: der jüngste offene Vorgang der Gemeinde, beim neuen Vorgang die Gemeinde', async () => {
    bekannt();
    await oeffnen();
    fireEvent.click(knopf('Einsortieren'));
    await screen.findByRole('dialog', { name: 'Mail einsortieren' });
    await waitFor(() => expect(within(dialog()).queryAllByRole('radio').length).toBe(3));
    expect(within(dialog()).getByRole('radio', { name: /Nr\. 5/ })).toBeChecked();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Neuer Vorgang' }));
    expect((within(dialog()).getByLabelText('Gemeinde') as HTMLSelectElement).value).toBe('7');
    // Zurück zu „Bestehender Vorgang": die Wahl ist noch da; Einsortieren nimmt sie.
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Bestehender Vorgang' }));
    await act(async () => { fireEvent.click(within(dialog()).getByRole('button', { name: 'Einsortieren' })); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/einsortieren').map((a) => a.koerper)).toEqual([{ vorgang_id: 5 }]);
  });

  it('ohne Absender bleibt der Dialog unbelegt: kein Vorgang gewählt, keine Gemeinde', async () => {
    await oeffnen();
    fireEvent.click(knopf('Einsortieren'));
    await screen.findByRole('dialog', { name: 'Mail einsortieren' });
    await waitFor(() => expect(within(dialog()).queryAllByRole('radio').length).toBe(2));
    expect(within(dialog()).queryAllByRole('radio', { checked: true })).toHaveLength(0);
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Neuer Vorgang' }));
    expect((within(dialog()).getByLabelText('Gemeinde') as HTMLSelectElement).value).toBe('');
  });

  it('ohne Netz ist der Knopf gesperrt; ein Fehler des Servers kommt als Meldung, nichts öffnet sich', async () => {
    bekannt();
    h.online = false;
    const { unmount } = render(<SupportPostDetailPage nachrichtId={31} />);
    await screen.findByRole('article', { name: 'Frage zum Zugang' });
    expect(within(zeile()!).getByRole('button', { name: 'In Vorgang 5 einsortieren' })).toBeDisabled();
    unmount();

    h.online = true;
    server.stand.fehler.set('POST /support/mail/nachrichten/31/einsortieren', Object.assign(new Error('x'), { response: { status: 500, data: { error: 'Datenbankfehler' } } }));
    await oeffnen();
    await act(async () => { fireEvent.click(within(zeile()!).getByRole('button', { name: 'In Vorgang 5 einsortieren' })); });
    expect(h.setError).toHaveBeenCalledWith('Datenbankfehler');
    expect(h.push).not.toHaveBeenCalled();
    expect(server.stand.mails.find((m) => m.id === 31)?.vorgang_id).toBeNull();
  });
});

describe('Mail (Web): archivieren, wiederherstellen, löschen', () => {
  it('im Archiv: der Archiv-Satz (Fehler vorab 6) ohne zweite Marke „Archiv", Wiederherstellen statt Antworten und Archivieren; Einsortieren bleibt', async () => {
    server.stand.mails.find((m) => m.id === 31)!.archiviert_am = '2026-10-02T12:00:00Z';
    await oeffnen();
    const stand = lesen().querySelector('.web-stand') as HTMLElement;
    expect(stand).toHaveTextContent('Im Archiv seit 02.10.2026 · wird nach 180 Tagen gelöscht · Einsortieren holt sie zurück.');
    // Jede Angabe einmal: Der Satz sagt es, die Kennzeichen wiederholen es nicht.
    expect(kennzeichen()).not.toHaveTextContent('Archiv');
    expect(aktionNamen()).toEqual(['Einsortieren', 'Löschen', 'Wiederherstellen']);
    expect(antwortzeile()).toBeNull();
    // „Stelle sie wieder her, wenn sie einsortiert werden soll" widersprach dem Knopf daneben.
    expect(lesen()).not.toHaveTextContent('Stelle sie wieder her');
  });

  it('Wiederherstellen: die Mail ist wieder im Posteingang, „Antworten“ ist wieder da', async () => {
    server.stand.mails.find((m) => m.id === 31)!.archiviert_am = '2026-10-02T12:00:00Z';
    await oeffnen();
    await act(async () => { fireEvent.click(knopf('Wiederherstellen')); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/wiederherstellen')).toHaveLength(1);
    expect(h.setSuccess).toHaveBeenCalledWith('1 Mail wiederhergestellt – wieder im Posteingang');
    await waitFor(() => expect(lesen().querySelector('.web-stand')).toBeNull());
    expect(await within(kopf()).findByRole('button', { name: 'Antworten' })).toBeInTheDocument();
  });

  it('Archivieren: eine Anfrage an die Mail; sie fällt aus der Liste, die nächste öffnet sich (Frage 6)', async () => {
    await oeffnen();
    await act(async () => { fireEvent.click(knopf('Archivieren')); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/archivieren')).toHaveLength(1);
    expect(h.setSuccess).toHaveBeenCalledWith('1 Mail archiviert');
    await waitFor(() => expect(window.location.pathname).toBe('/admin/support/post/29'));
    await waitFor(() => expect(gewaehlteZeile()).toHaveAccessibleName(/^Anna Beispiel: Frage zum Zugang/));
    await waitFor(() => expect(within(liste()).getAllByRole('button', { name: /^Anna Beispiel/ })).toHaveLength(1));
    expect(screen.queryByText('Keine Mail gewählt')).toBeNull();
  });

  it('Archivieren mit getippter Antwort: erst die Rückfrage -- „Abbrechen" lässt Entwurf und Mail stehen, „Verwerfen" archiviert und öffnet die nächste', async () => {
    await oeffnen();
    fireEvent.click(antwortzeile()!);
    fireEvent.change(screen.getByLabelText('Text der Antwort'), { target: { value: 'Hallo Anna, gleich …' } });
    await act(async () => { fireEvent.click(knopf('Archivieren')); });
    expect(h.alert).toMatchObject({ header: 'Ungespeicherte Änderungen', message: 'Die Antwort ist noch nicht gesendet. Möchtest du sie verwerfen?' });
    await bestaetigen('Abbrechen');
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/archivieren')).toEqual([]);
    expect((screen.getByLabelText('Text der Antwort') as HTMLTextAreaElement).value).toBe('Hallo Anna, gleich …');

    await act(async () => { fireEvent.click(knopf('Archivieren')); });
    await bestaetigen('Verwerfen');
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/archivieren')).toHaveLength(1);
    await waitFor(() => expect(window.location.pathname).toBe('/admin/support/post/29'));
  });

  it('Archivieren per Tastatur: der Knopf ist mit der Mail fort -- der Fokus steht danach auf dem Titel der nächsten, nicht auf <body>', async () => {
    await oeffnen();
    knopf('Archivieren').focus();
    await act(async () => { fireEvent.click(knopf('Archivieren')); });
    await waitFor(() => expect(window.location.pathname).toBe('/admin/support/post/29'));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Frage zum Zugang' })));
    // Der Titel ist Ziel, kein Halt beim Tabben.
    expect(document.activeElement).toHaveAttribute('tabindex', '-1');
  });

  it('Löschen per Tastatur: nach der Rückfrage steht der Fokus auf dem Titel der nächsten Mail', async () => {
    await oeffnen();
    knopf('Löschen').focus();
    fireEvent.click(knopf('Löschen'));
    await bestaetigen('Löschen');
    await waitFor(() => expect(window.location.pathname).toBe('/admin/support/post/29'));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Frage zum Zugang' })));
  });

  it('wer in der Liste eine andere Mail wählt, behält den Fokus in der Liste', async () => {
    await oeffnen();
    const zeile = within(liste()).getByRole('button', { name: /^Ben Vorlage/ });
    zeile.focus();
    fireEvent.click(zeile);
    await screen.findByRole('article', { name: 'Termin-Export' });
    expect(document.activeElement).toBe(zeile);
  });

  it('Löschen fragt zuerst und sagt, dass im Postfach alles stehen bleibt; erst „Löschen“ löscht -- danach öffnet sich die nächste Mail', async () => {
    await oeffnen();
    fireEvent.click(knopf('Löschen'));
    expect(h.alert?.header).toBe('Mail löschen');
    expect(h.alert?.message).toContain('Im Postfach selbst bleibt alles stehen');
    expect(server.aufrufe('delete')).toHaveLength(0);
    await bestaetigen('Löschen');
    expect(server.aufrufe('delete', '/support/mail/nachrichten/31')).toHaveLength(1);
    expect(h.setSuccess).toHaveBeenCalledWith('1 Mail gelöscht');
    await waitFor(() => expect(window.location.pathname).toBe('/admin/support/post/29'));
    expect(screen.queryByText('Keine Mail gewählt')).toBeNull();
    expect(h.push).not.toHaveBeenCalled();
  });

  it('die letzte Mail gelöscht: der Lesebereich ist leer, die Seite bleibt', async () => {
    server.stand.mails = [mail(40, null, { betreff: 'Allein', von_name: 'Ben' })];
    await oeffnen(40, 'Allein');
    fireEvent.click(within(lesen('Allein')).getByRole('button', { name: 'Löschen' }));
    await bestaetigen('Löschen');
    expect(await screen.findByText('Keine Mail gewählt')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/admin/support/post');
  });

  it('Abbrechen löscht nichts', async () => {
    await oeffnen();
    fireEvent.click(knopf('Löschen'));
    await bestaetigen('Abbrechen');
    expect(server.aufrufe('delete')).toHaveLength(0);
    expect(lesen()).toBeInTheDocument();
  });

  it('ein Fehler beim Löschen: Meldung, die Mail bleibt im Lesebereich', async () => {
    server.stand.fehler.set('DELETE /support/mail/nachrichten/31', new Error('Netz weg'));
    await oeffnen();
    fireEvent.click(knopf('Löschen'));
    await bestaetigen('Löschen');
    expect(h.setError).toHaveBeenCalledWith('Löschen hat nicht geklappt');
    expect(lesen()).toBeInTheDocument();
    expect(window.location.pathname).toBe('/admin/support/post/31');
  });
});

describe('Mail (Web): antworten unter der jüngsten Mail (G)', () => {
  it('die Antwortzeile nennt Empfänger und Postfach', async () => {
    await oeffnen();
    const zeile = antwortzeile()!;
    expect(zeile).toHaveTextContent('Antwort an Anna Beispiel schreiben …');
    expect(zeile).toHaveTextContent('von moin@');
  });

  it('ein Klick öffnet den Editor an dieser Stelle: Fokus im Text, gerollt nur bis zu seinem Ende; „An" fest mit Name und Adresse', async () => {
    await oeffnen();
    fireEvent.click(antwortzeile()!);
    const bereich = screen.getByRole('region', { name: 'Antwort schreiben' });
    expect(document.activeElement).toBe(within(bereich).getByLabelText('Text der Antwort'));
    expect(rollen).toHaveBeenCalledWith({ block: 'end' });
    expect(rollen.mock.instances.at(-1)).toBe(bereich);
    expect(antwortzeile()).toBeNull();
    await waitFor(() => expect(bereich.querySelector('p.web-antwort__an')).not.toBeNull());
    expect(bereich.querySelector('p.web-antwort__an')).toHaveTextContent('Anna Beispiel <anna@example.org>');
    expect(bereich.querySelector('p.web-antwort__an')).toHaveTextContent('von moin@');
  });

  it('„Antworten" im Kopf öffnet denselben Editor; Senden mit Rückfrage, danach zu und neu geladen, der Fokus zurück an der Antwortzeile', async () => {
    await oeffnen();
    fireEvent.click(knopf('Antworten'));
    const bereich = within(screen.getByRole('region', { name: 'Antwort schreiben' }));
    expect((bereich.getByLabelText('Betreff') as HTMLInputElement).value).toBe('Re: Frage zum Zugang');
    fireEvent.change(bereich.getByLabelText('Text der Antwort'), { target: { value: 'Hallo Anna,\nso geht es.' } });
    fireEvent.click(bereich.getByRole('button', { name: 'Vorschau mit Fußzeile' }));
    await waitFor(() => expect(bereich.getByRole('region', { name: 'Vorschau der Antwort' }).textContent).toBe('Hallo Anna,\nso geht es.\n\n-- \nKonfi Quest'));
    fireEvent.click(bereich.getByRole('button', { name: 'Antwort senden' }));
    expect(h.alert?.header).toBe('Antwort senden');
    expect(h.alert?.message).toBe('An anna@example.org: „Re: Frage zum Zugang“ von moin@ senden?');
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/antworten')).toHaveLength(0);

    const abrufeVorher = server.aufrufe('get', '/support/mail/nachrichten/31').length;
    await act(async () => { h.alert?.buttons?.find((b) => b.text === 'Senden')?.handler?.(); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/31/antworten').map((a) => a.koerper)).toEqual([{ text: 'Hallo Anna,\nso geht es.', betreff: 'Re: Frage zum Zugang' }]);
    expect(h.setSuccess).toHaveBeenCalledWith('Antwort gesendet');
    await waitFor(() => expect(server.aufrufe('get', '/support/mail/nachrichten/31').length).toBe(abrufeVorher + 1));
    expect(screen.queryByRole('region', { name: 'Antwort schreiben' })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(antwortzeile()));
  });

  it('„Verwerfen“ schließt den Editor ohne Aufruf; der Fokus geht zurück an die Antwortzeile', async () => {
    await oeffnen();
    fireEvent.click(antwortzeile()!);
    fireEvent.click(within(screen.getByRole('region', { name: 'Antwort schreiben' })).getByRole('button', { name: 'Verwerfen' }));
    expect(screen.queryByRole('region', { name: 'Antwort schreiben' })).toBeNull();
    expect(server.aufrufe('post', /antworten$/)).toHaveLength(0);
    expect(document.activeElement).toBe(antwortzeile());
  });
});

describe('Mail (Web): Laden, Fehler, nicht gefunden', () => {
  it('404: „Mail nicht gefunden“ im Lesebereich, der Posteingang daneben bleibt', async () => {
    render(<SupportPostDetailPage nachrichtId={999} />);
    expect(await screen.findByText('Mail nicht gefunden')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Posteingang' })).toBeInTheDocument();
    expect(liste()).toBeInTheDocument();
    expect(server.aufrufe('get', '/support/mail/nachrichten/999')).toHaveLength(1);
  });

  it('Netzfehler: Hinweis mit erneutem Versuch, der wirklich neu lädt', async () => {
    server.stand.fehler.set('GET /support/mail/nachrichten/31', new Error('Netz weg'));
    render(<SupportPostDetailPage nachrichtId={31} />);
    expect(await screen.findByText('Die Mail konnte nicht geladen werden.')).toBeInTheDocument();
    server.stand.fehler.delete('GET /support/mail/nachrichten/31');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' })); });
    expect(await screen.findByRole('heading', { level: 2, name: 'Frage zum Zugang' })).toBeInTheDocument();
  });

  it('beim Laden steht ein Platzhalter', () => {
    h.apiGet.mockImplementation(() => new Promise(() => {}));
    render(<SupportPostDetailPage nachrichtId={31} />);
    expect(screen.getByText('Der Posteingang wird geladen.')).toBeInTheDocument();
  });
});

describe('Mail: zwei Gesichter, eine Seite', () => {
  it('im schmalen Fenster bleibt die App-Darstellung -- mit derselben Logik', async () => {
    h.breit = false;
    render(<SupportPostDetailPage nachrichtId={31} />);
    await screen.findByRole('heading', { level: 2, name: 'Frage zum Zugang' });
    expect(document.querySelector('.web-seite')).toBeNull();
    expect(screen.getByRole('button', { name: 'Einsortieren' })).toBeInTheDocument();
  });

  it('ohne Super-Admin-Recht: Hinweis, kein Abruf', () => {
    h.user = { id: 5, role_name: 'org_admin', is_super_admin: false };
    render(<SupportPostDetailPage nachrichtId={31} />);
    expect(screen.getByText('Nur für den Support')).toBeInTheDocument();
    expect(h.apiGet).not.toHaveBeenCalled();
  });
});
