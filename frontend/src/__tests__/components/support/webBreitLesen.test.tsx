// Der Rahmen von Liste und Lesebereich im Browser, gerendert
// (docs/planung/support-detailseiten.md, E, F und „Rahmen"; Simon, 11.10.2026:
// Fragen 6 und 9): „Breit lesen" als Schalter im Kopf der Liste, je Gerät
// gemerkt, ein Direktlink öffnet mit Liste; ‹ › blättern durch die Liste, wie
// sie dasteht; nach Archivieren der nächste Eintrag, auch breit; `?mail=`
// öffnet den Vorgang mit dieser Mail offen und hervorgehoben, und Wählen nimmt
// es aus der Adresse. Dieselbe Bedienung im Posteingang. Verschwindet der
// Knopf, auf dem der Fokus stand, kommt er auf das Gegenstück (12.10.2026);
// die Pfeiltasten blättern auch breit. Ionic hält die Seite im Speicher: Wer
// sie wieder betritt, bekommt Eintrag, ?mail= und „Breit lesen" wie beim
// ersten Öffnen (seiteBetreten/seiteVerlassen der Attrappe).
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import React from 'react';
import { render, renderHook, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import { seiteBetreten, seiteVerlassen, type AlertOptionen } from './ionicAttrappe';
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
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: true }),
}));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => true }));
vi.mock('../../../navigation/useAppLocation', () => ({ useAppLocation: () => h.standort }));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));

import SupportVorgaengePage from '../../../components/support/SupportVorgaengePage';
import SupportVorgangDetailPage from '../../../components/support/SupportVorgangDetailPage';
import SupportPostDetailPage from '../../../components/support/SupportPostDetailPage';
import SupportPosteingangPage from '../../../components/support/SupportPosteingangPage';
import { SCHLUESSEL_BREIT_LESEN } from '../../../components/support/web/WebLeseRahmen';
import { useListenRahmen } from '../../../components/support/web/useListenRahmen';
import { useLeseAuswahl } from '../../../components/support/web/useLeseAuswahl';
import { supportMailZaehlerZuruecksetzen } from '../../../navigation/supportMailZaehler';

let vorherTZ: string | undefined;
beforeAll(() => { vorherTZ = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherTZ === undefined) delete process.env.TZ; else process.env.TZ = vorherTZ; });

let server: ReturnType<typeof vorgaengeServer>;
const rollen = vi.fn();
const rollenVorher = Element.prototype.scrollIntoView;

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  Element.prototype.scrollIntoView = rollen;
  h.alert = null;
  h.user = { id: 9, role_name: 'super_admin', is_super_admin: true };
  h.standort = { pathname: '/admin/support/vorgaenge', search: '', state: null };
  window.history.replaceState(null, '', '/admin/support/vorgaenge');
  window.localStorage.clear();
  supportMailZaehlerZuruecksetzen();
  server = vorgaengeServer({
    // Die Liste nach der jüngsten Aktivität: 1 (Mail 08:30), 2, 3.
    vorgaenge: [
      vorgang(1, { status: 'in_arbeit', art: 'fehler', bereich: 'chat', betreff: 'Chat zeigt nichts Neues', organization_id: 7, created_at: '2026-10-03T06:00:00Z' }),
      vorgang(2, { status: 'in_arbeit', art: 'frage', bereich: 'konten', betreff: 'Wie lege ich einen Jahrgang an?', created_at: '2026-10-03T07:00:00Z' }),
      vorgang(3, { status: 'in_arbeit', art: 'zugang', bereich: null, betreff: 'Passwort vergessen', created_at: '2026-10-03T05:00:00Z' }),
    ],
    mails: [
      mail(11, 1, { betreff: 'Chat zeigt nichts Neues', text: 'Seit gestern nichts.', gesendet_am: '2026-10-03T07:30:00Z', gelesen_am: '2026-10-03T07:40:00Z' }),
      mail(12, 1, { betreff: 'Re: Chat zeigt nichts Neues', text: 'Noch eine Frage dazu.', gesendet_am: '2026-10-03T07:45:00Z', gelesen_am: '2026-10-03T07:50:00Z' }),
      mail(13, 1, { betreff: 'Re: Chat zeigt nichts Neues', text: 'Und die letzte.', gesendet_am: '2026-10-03T08:30:00Z', gelesen_am: '2026-10-03T08:40:00Z' }),
      mail(41, null, { postfach: 'moin', von_name: 'Anna Beispiel', von_adresse: 'anna@example.org', betreff: 'Frage zum Zugang', gesendet_am: '2026-10-03T09:00:00Z' }),
      mail(42, null, { postfach: 'support', von_name: 'Ben Vorlage', von_adresse: 'ben@example.org', betreff: 'Termin-Export', gesendet_am: '2026-10-03T08:00:00Z' }),
    ],
  });
  server.installieren({ get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete });
});

afterEach(() => {
  Element.prototype.scrollIntoView = rollenVorher;
});

/** Die Seite eines Vorgangs, wie sie ein Direktlink öffnet (…/vorgaenge/N). */
const vorgangOeffnen = async (id: number) => {
  h.standort = { ...h.standort, pathname: `/admin/support/vorgaenge/${id}` };
  window.history.replaceState(null, '', `/admin/support/vorgaenge/${id}${h.standort.search}`);
  render(<SupportVorgangDetailPage vorgangId={id} />);
  await titel();
};
/** Der Titel im Lesebereich, sobald er steht. */
const titel = async (erwartet?: string) => waitFor(() => {
  const t = document.querySelector('.web-lesen__titel');
  expect(t).not.toBeNull();
  if (erwartet) expect(t).toHaveTextContent(erwartet);
  return t as HTMLElement;
});
const liste = (name = 'Vorgänge') => screen.queryByRole('navigation', { name });
const schalter = () => screen.getByRole('button', { name: 'Breit lesen' });
const blaettern = () => within(screen.getByRole('navigation', { name: 'Blättern' }));
const gemerkt = () => window.localStorage.getItem(SCHLUESSEL_BREIT_LESEN);

describe('Breit lesen: der Schalter im Kopf der Liste', () => {
  it('ohne gewählten Eintrag ist er gesperrt -- rechts stünde nichts, und die Liste wäre fort', async () => {
    render(<SupportVorgaengePage />);
    await screen.findByRole('navigation', { name: 'Vorgänge' });
    expect(schalter()).toBeDisabled();
    expect(schalter()).toHaveAttribute('title', 'Breit lesen – die Liste ausblenden');
    // Er steht im Kopf der Liste, neben „Alle auswählen".
    expect(schalter().closest('.web-postfach__listekopf')).not.toBeNull();
  });

  it('ein Klick blendet die Liste aus; über dem Lesebereich „‹ Alle Vorgänge" und ‹ ›; die Wahl ist im Gerät gemerkt', async () => {
    await vorgangOeffnen(2);
    expect(liste()).not.toBeNull();
    fireEvent.click(schalter());
    expect(liste()).toBeNull();
    expect(document.querySelector('.web-postfach')!.className).toBe('web-postfach web-postfach--breit');
    const zurueck = blaettern().getByRole('button', { name: 'Zurück zu „Alle Vorgänge“' });
    expect(zurueck).toHaveTextContent('Alle Vorgänge');
    expect(blaettern().getByRole('button', { name: 'Voriger Eintrag' })).toBeEnabled();
    expect(blaettern().getByRole('button', { name: 'Nächster Eintrag' })).toBeEnabled();
    expect(gemerkt()).toBe('1');
  });

  it('‹ › blättern durch die Liste, wie sie dasteht; die Adresse folgt; am Ende ist Schluss', async () => {
    await vorgangOeffnen(2);
    fireEvent.click(schalter());
    fireEvent.click(blaettern().getByRole('button', { name: 'Nächster Eintrag' }));
    await titel('Passwort vergessen');
    expect(window.location.pathname).toBe('/admin/support/vorgaenge/3');
    expect(blaettern().getByRole('button', { name: 'Nächster Eintrag' })).toBeDisabled();
    fireEvent.click(blaettern().getByRole('button', { name: 'Voriger Eintrag' }));
    await titel('Wie lege ich einen Jahrgang an?');
    fireEvent.click(blaettern().getByRole('button', { name: 'Voriger Eintrag' }));
    await titel('Chat zeigt nichts Neues');
    expect(window.location.pathname).toBe('/admin/support/vorgaenge/1');
    expect(blaettern().getByRole('button', { name: 'Voriger Eintrag' })).toBeDisabled();
    // Die Liste bleibt dabei aus.
    expect(liste()).toBeNull();
  });

  it('„‹ Alle Vorgänge" zeigt die Liste wieder -- mit dem gewählten Eintrag; gemerkt ist „mit Liste"', async () => {
    await vorgangOeffnen(2);
    fireEvent.click(schalter());
    fireEvent.click(blaettern().getByRole('button', { name: 'Zurück zu „Alle Vorgänge“' }));
    expect(liste()).not.toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Blättern' })).toBeNull();
    expect(within(liste()!).getByRole('button', { current: true })).toHaveAccessibleName(/^Vorgang 2:/);
    expect(gemerkt()).toBe('0');
  });

  it('gemerkt „breit": ohne Eintrag in der Adresse steht erst die Liste da; wer wählt, liest breit', async () => {
    window.localStorage.setItem(SCHLUESSEL_BREIT_LESEN, '1');
    render(<SupportVorgaengePage />);
    await screen.findByRole('navigation', { name: 'Vorgänge' });
    expect(screen.getByText('Kein Vorgang gewählt')).toBeInTheDocument();
    fireEvent.click(within(liste()!).getByRole('button', { name: /^Vorgang 3:/ }));
    await titel('Passwort vergessen');
    expect(liste()).toBeNull();
    expect(blaettern().getByRole('button', { name: 'Voriger Eintrag' })).toBeEnabled();
  });

  it('ein Direktlink öffnet mit Liste, auch wenn „breit" gemerkt ist -- die gemerkte Wahl bleibt', async () => {
    window.localStorage.setItem(SCHLUESSEL_BREIT_LESEN, '1');
    await vorgangOeffnen(2);
    expect(liste()).not.toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Blättern' })).toBeNull();
    expect(gemerkt()).toBe('1');
  });

  it('ohne Speicher (privates Fenster, gesperrte Website-Daten) geht es trotzdem -- bis zum Neuladen', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('gesperrt'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('gesperrt'); });
    await vorgangOeffnen(2);
    fireEvent.click(schalter());
    expect(liste()).toBeNull();
    fireEvent.click(blaettern().getByRole('button', { name: 'Zurück zu „Alle Vorgänge“' }));
    expect(liste()).not.toBeNull();
  });

  it('Sammelleiste: Archivieren mit dem offenen Eintrag öffnet den nächsten (Frage 6); ebenso Löschen -- statt „nicht gefunden"', async () => {
    await vorgangOeffnen(2);
    const nav = () => within(liste()!);
    fireEvent.click(nav().getByRole('checkbox', { name: 'Auswählen: Vorgang 2: Wie lege ich einen Jahrgang an?' }));
    await act(async () => { fireEvent.click(within(screen.getByRole('group', { name: 'Auswahl' })).getByRole('button', { name: 'Archivieren' })); });
    expect(server.aufrufe('post', '/support/vorgaenge/sammel').map((a) => a.koerper)).toEqual([{ ids: [2], aktion: 'archivieren' }]);
    await titel('Passwort vergessen');
    expect(window.location.pathname).toBe('/admin/support/vorgaenge/3');

    fireEvent.click(nav().getByRole('checkbox', { name: 'Auswählen: Vorgang 3: Passwort vergessen' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Auswahl' })).getByRole('button', { name: 'Löschen' }));
    await act(async () => { h.alert?.buttons?.find((b) => b.text === 'Löschen')?.handler?.(); });
    await titel('Chat zeigt nichts Neues');
    expect(window.location.pathname).toBe('/admin/support/vorgaenge/1');
    expect(screen.queryByText('Vorgang nicht gefunden')).toBeNull();
  });

  it('breit nach Archivieren: der nächste Eintrag steht da, die Liste bleibt aus (Frage 6)', async () => {
    await vorgangOeffnen(2);
    fireEvent.click(schalter());
    await act(async () => { fireEvent.click(within(document.querySelector('.web-lesen__kopf') as HTMLElement).getByRole('button', { name: 'Archivieren' })); });
    expect(server.aufrufe('post', '/support/vorgaenge/2/archivieren')).toHaveLength(1);
    await titel('Passwort vergessen');
    expect(window.location.pathname).toBe('/admin/support/vorgaenge/3');
    expect(liste()).toBeNull();
    // Der archivierte fällt aus der Liste: vor 3 steht jetzt 1.
    await waitFor(() => expect(blaettern().getByRole('button', { name: 'Voriger Eintrag' })).toBeEnabled());
    fireEvent.click(blaettern().getByRole('button', { name: 'Voriger Eintrag' }));
    await titel('Chat zeigt nichts Neues');
  });

  it('„Danach: Erledigt" beim Senden: ein Aufruf, den der Server bestätigt -- danach der nächste Eintrag wie nach Erledigt (Frage 6)', async () => {
    await vorgangOeffnen(1);
    fireEvent.click(within(document.querySelector('.web-lesen__kopf') as HTMLElement).getByRole('button', { name: 'Antworten' }));
    const editor = within(screen.getByRole('region', { name: 'Antwort schreiben' }));
    fireEvent.change(editor.getByRole('combobox', { name: 'Danach' }), { target: { value: 'erledigt' } });
    fireEvent.change(editor.getByLabelText('Text der Antwort'), { target: { value: 'Dann ist alles gut.' } });
    fireEvent.click(editor.getByRole('button', { name: 'Antwort senden' }));
    await act(async () => { h.alert?.buttons?.find((b) => b.text === 'Senden')?.handler?.(); });
    await titel('Wie lege ich einen Jahrgang an?');
    expect(window.location.pathname).toBe('/admin/support/vorgaenge/2');
    expect(server.aufrufe('post', '/support/vorgaenge/1/antworten').map((a) => (a.koerper as { status?: string }).status)).toEqual(['erledigt']);
    expect(server.aufrufe('patch')).toEqual([]);
    expect(server.stand.vorgaenge.find((v) => v.id === 1)).toMatchObject({ status: 'erledigt', archiviert_am: server.stand.jetzt });
  });
});

describe('Breit lesen: der Fokus geht mit, wenn sein Knopf verschwindet', () => {
  const knopfDerLeiste = (name: string) => blaettern().getByRole('button', { name });

  it('„Breit lesen" per Tastatur: Der Schalter ist mit der Liste fort -- der Fokus steht auf „‹ Alle Vorgänge"', async () => {
    await vorgangOeffnen(2);
    schalter().focus();
    fireEvent.click(schalter());
    expect(liste()).toBeNull();
    expect(document.activeElement).toBe(knopfDerLeiste('Zurück zu „Alle Vorgänge“'));
  });

  it('„‹ Alle Vorgänge" per Tastatur: Der Knopf ist fort -- der Fokus steht auf der gewählten Zeile der Liste', async () => {
    await vorgangOeffnen(2);
    fireEvent.click(schalter());
    knopfDerLeiste('Zurück zu „Alle Vorgänge“').focus();
    fireEvent.click(knopfDerLeiste('Zurück zu „Alle Vorgänge“'));
    const zeile = within(liste()!).getByRole('button', { current: true });
    expect(zeile).toHaveAccessibleName(/^Vorgang 2:/);
    expect(document.activeElement).toBe(zeile);
  });

  it('‹ › per Tastatur: Der Lesebereich entsteht neu -- der Fokus steht wieder auf demselben Knopf, am Ende auf dem der anderen Richtung', async () => {
    await vorgangOeffnen(1);
    fireEvent.click(schalter());
    knopfDerLeiste('Nächster Eintrag').focus();
    fireEvent.click(knopfDerLeiste('Nächster Eintrag'));
    await titel('Wie lege ich einen Jahrgang an?');
    await waitFor(() => expect(document.activeElement).toBe(knopfDerLeiste('Nächster Eintrag')));
    fireEvent.click(knopfDerLeiste('Nächster Eintrag'));
    await titel('Passwort vergessen');
    // Der letzte Eintrag: „Nächster" ist gesperrt, der Fokus kommt auf „Voriger".
    expect(knopfDerLeiste('Nächster Eintrag')).toBeDisabled();
    await waitFor(() => expect(document.activeElement).toBe(knopfDerLeiste('Voriger Eintrag')));
  });

  it('Pfeiltasten wirken auch breit (Plan F): runter der nächste, hoch der vorige Eintrag; der Fokus bleibt auf seinem Knopf', async () => {
    await vorgangOeffnen(1);
    fireEvent.click(schalter());
    const zurueck = knopfDerLeiste('Zurück zu „Alle Vorgänge“');
    zurueck.focus();
    fireEvent.keyDown(zurueck, { key: 'ArrowDown' });
    await titel('Wie lege ich einen Jahrgang an?');
    expect(window.location.pathname).toBe('/admin/support/vorgaenge/2');
    expect(liste()).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(knopfDerLeiste('Zurück zu „Alle Vorgänge“')));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    await titel('Chat zeigt nichts Neues');
    expect(window.location.pathname).toBe('/admin/support/vorgaenge/1');
    await waitFor(() => expect(document.activeElement).toBe(knopfDerLeiste('Zurück zu „Alle Vorgänge“')));
    // Am Anfang der Liste tut „hoch" nichts.
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(window.location.pathname).toBe('/admin/support/vorgaenge/1');
  });

  it('nach Archivieren (Frage 6): der Fokus steht auf dem Titel des nächsten Eintrags', async () => {
    await vorgangOeffnen(2);
    const archivieren = within(document.querySelector('.web-lesen__kopf') as HTMLElement).getByRole('button', { name: 'Archivieren' });
    archivieren.focus();
    await act(async () => { fireEvent.click(archivieren); });
    await titel('Passwort vergessen');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Passwort vergessen' })));
  });

  it('wer während des Ladens woanders hingeht, bleibt dort -- der neue Eintrag holt den Fokus nicht zurück', async () => {
    await vorgangOeffnen(1);
    fireEvent.click(schalter());
    knopfDerLeiste('Nächster Eintrag').focus();
    fireEvent.click(knopfDerLeiste('Nächster Eintrag'));
    const suche = screen.getByLabelText('Vorgänge durchsuchen');
    suche.focus();
    await titel('Wie lege ich einen Jahrgang an?');
    expect(knopfDerLeiste('Nächster Eintrag')).toBeEnabled();
    expect(document.activeElement).toBe(suche);
  });

  it('wer in der Liste wählt, behält den Fokus in der Liste -- der Titel holt ihn nicht', async () => {
    await vorgangOeffnen(2);
    const zeile = within(liste()!).getByRole('button', { name: /^Vorgang 3:/ });
    zeile.focus();
    fireEvent.click(zeile);
    await titel('Passwort vergessen');
    expect(document.activeElement).toBe(zeile);
  });
});

// Gefunden am 12.10.2026 beim Ansehen: Die Leiste stand nur im Kopf des
// geladenen Eintrags. Solange der nächste lud oder wenn er fehlte, stand rechts
// nur der Hinweis -- ohne „‹ Alle …“ und ‹ ›, die Liste war aus, und der
// Fokus fiel auf <body>.
describe('Breit lesen: die Leiste steht auch, solange der Eintrag lädt oder fehlt', () => {
  const knopfDerLeiste = (name: string) => blaettern().getByRole('button', { name });
  const ZURUECK = 'Zurück zu „Alle Vorgänge“';
  /** Hält den Abruf eines Eintrags an, bis der Test ihn freigibt. */
  const anhalten = (pfad: string) => {
    const echt = h.apiGet.getMockImplementation() as (p: string, ...rest: unknown[]) => Promise<unknown>;
    let freigeben = () => {};
    const tor = new Promise<void>((r) => { freigeben = r; });
    h.apiGet.mockImplementation(async (p: string, ...rest: unknown[]) => {
      if (p === pfad) await tor;
      return echt(p, ...rest);
    });
    return async () => { await act(async () => { freigeben(); }); };
  };
  const nichtGefunden = () => Object.assign(new Error('nicht gefunden'), { response: { status: 404, data: { error: 'Nicht gefunden' } } });

  it('die Leiste steht über dem Lesebereich, nicht im Artikel des Eintrags, und bleibt beim Blättern dieselbe', async () => {
    await vorgangOeffnen(1);
    fireEvent.click(schalter());
    const leiste = screen.getByRole('navigation', { name: 'Blättern' });
    expect(leiste.closest('article')).toBeNull();
    expect(leiste.parentElement).toHaveClass('web-postfach__lesen');
    fireEvent.click(knopfDerLeiste('Nächster Eintrag'));
    await titel('Wie lege ich einen Jahrgang an?');
    expect(screen.getByRole('navigation', { name: 'Blättern' })).toBe(leiste);
  });

  it('lädt der nächste Eintrag noch: „‹ Alle Vorgänge“ und ‹ › stehen da, der Fokus bleibt auf „Nächster Eintrag“ -- auch, wenn er geladen ist', async () => {
    await vorgangOeffnen(1);
    fireEvent.click(schalter());
    const freigeben = anhalten('/support/vorgaenge/2');
    knopfDerLeiste('Nächster Eintrag').focus();
    fireEvent.click(knopfDerLeiste('Nächster Eintrag'));
    expect(await screen.findByText('Der Vorgang wird geladen.')).toBeInTheDocument();
    expect(knopfDerLeiste(ZURUECK)).toBeEnabled();
    expect(knopfDerLeiste('Voriger Eintrag')).toBeEnabled();
    expect(knopfDerLeiste('Nächster Eintrag')).toBeEnabled();
    expect(document.activeElement).toBe(knopfDerLeiste('Nächster Eintrag'));
    await freigeben();
    await titel('Wie lege ich einen Jahrgang an?');
    expect(document.activeElement).toBe(knopfDerLeiste('Nächster Eintrag'));
  });

  it('nicht gefunden: die Leiste steht, der Fokus bleibt auf „Nächster Eintrag“; ‹ blättert zurück, „‹ Alle Vorgänge“ holt die Liste', async () => {
    await vorgangOeffnen(1);
    fireEvent.click(schalter());
    server.stand.fehler.set('GET /support/vorgaenge/2', nichtGefunden());
    knopfDerLeiste('Nächster Eintrag').focus();
    fireEvent.click(knopfDerLeiste('Nächster Eintrag'));
    expect(await screen.findByText('Vorgang nicht gefunden')).toBeInTheDocument();
    expect(liste()).toBeNull();
    expect(document.activeElement).toBe(knopfDerLeiste('Nächster Eintrag'));
    // Weiter geht es auch von hier: per Pfeiltaste zum nächsten, dann zurück vor den fehlenden.
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    await titel('Passwort vergessen');
    expect(document.activeElement).toBe(knopfDerLeiste('Voriger Eintrag'));
    fireEvent.click(knopfDerLeiste('Voriger Eintrag'));
    expect(await screen.findByText('Vorgang nicht gefunden')).toBeInTheDocument();
    fireEvent.click(knopfDerLeiste('Voriger Eintrag'));
    await titel('Chat zeigt nichts Neues');
    // Und zur Liste, mit dem Fokus auf der gewählten Zeile.
    knopfDerLeiste('Nächster Eintrag').focus();
    fireEvent.click(knopfDerLeiste('Nächster Eintrag'));
    expect(await screen.findByText('Vorgang nicht gefunden')).toBeInTheDocument();
    knopfDerLeiste(ZURUECK).focus();
    fireEvent.click(knopfDerLeiste(ZURUECK));
    expect(liste()).not.toBeNull();
    const zeile = within(liste()!).getByRole('button', { current: true });
    expect(zeile).toHaveAccessibleName(/^Vorgang 2:/);
    expect(document.activeElement).toBe(zeile);
  });

  it('Netzfehler: die Leiste steht neben „Erneut versuchen“, der Fokus bleibt; der neue Versuch lädt den Eintrag', async () => {
    await vorgangOeffnen(1);
    fireEvent.click(schalter());
    server.stand.fehler.set('GET /support/vorgaenge/2', new Error('Netz weg'));
    knopfDerLeiste('Nächster Eintrag').focus();
    fireEvent.click(knopfDerLeiste('Nächster Eintrag'));
    expect(await screen.findByText('Der Vorgang konnte nicht geladen werden.')).toBeInTheDocument();
    expect(knopfDerLeiste(ZURUECK)).toBeEnabled();
    expect(document.activeElement).toBe(knopfDerLeiste('Nächster Eintrag'));
    server.stand.fehler.delete('GET /support/vorgaenge/2');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' })); });
    await titel('Wie lege ich einen Jahrgang an?');
  });

  it('Posteingang: lädt die nächste Mail noch oder fehlt sie, stehen „‹ Posteingang“ und ‹ › da; der Fokus bleibt in der Leiste', async () => {
    h.standort = { pathname: '/admin/support/post/41', search: '', state: null };
    window.history.replaceState(null, '', '/admin/support/post/41');
    render(<SupportPostDetailPage nachrichtId={41} />);
    await titel('Frage zum Zugang');
    fireEvent.click(schalter());
    const freigeben = anhalten('/support/mail/nachrichten/42');
    knopfDerLeiste('Nächster Eintrag').focus();
    fireEvent.click(knopfDerLeiste('Nächster Eintrag'));
    expect(await screen.findByText('Die Mail wird geladen.')).toBeInTheDocument();
    expect(knopfDerLeiste('Zurück zu „Posteingang“')).toBeEnabled();
    // 42 ist die letzte Mail: „Nächster“ ist gesperrt, der Fokus steht auf „Voriger“.
    expect(knopfDerLeiste('Nächster Eintrag')).toBeDisabled();
    expect(document.activeElement).toBe(knopfDerLeiste('Voriger Eintrag'));
    server.stand.fehler.set('GET /support/mail/nachrichten/42', nichtGefunden());
    await freigeben();
    expect(await screen.findByText('Mail nicht gefunden')).toBeInTheDocument();
    expect(document.activeElement).toBe(knopfDerLeiste('Voriger Eintrag'));
    fireEvent.click(knopfDerLeiste('Voriger Eintrag'));
    await titel('Frage zum Zugang');
  });
});

describe('Ionic hält die Seite im Speicher: wieder betreten', () => {
  const mailZeile = (id: number) => [...document.querySelectorAll<HTMLElement>('li.mail-zeile')]
    .find((z) => z.querySelector('time')?.getAttribute('dateTime') === server.stand.mails.find((m) => m.id === id)!.gesendet_am)!;
  /** Erneut auf …/vorgaenge/1?mail=11, wie über denselben Link der Übersicht (der Router setzt die Adresse). */
  const nochmal = () => {
    act(() => { seiteVerlassen(); });
    window.history.replaceState(null, '', '/admin/support/vorgaenge/1?mail=11');
    act(() => { seiteBetreten(); });
  };

  beforeEach(() => {
    h.standort = { pathname: '/admin/support/vorgaenge/1', search: '?mail=11', state: null };
  });

  it('dieselbe Adresse zweimal, dazwischen ein anderer Vorgang gewählt: Es gilt wieder Vorgang 1, die Mail offen und markiert', async () => {
    await vorgangOeffnen(1);
    act(() => { seiteBetreten(); });
    await waitFor(() => expect(mailZeile(11)).toHaveClass('mail-zeile--hervorgehoben'));
    fireEvent.click(within(liste()!).getByRole('button', { name: /^Vorgang 3:/ }));
    await titel('Passwort vergessen');
    rollen.mockClear();
    nochmal();
    await titel('Chat zeigt nichts Neues');
    expect(within(liste()!).getByRole('button', { current: true })).toHaveAccessibleName(/^Vorgang 1:/);
    await waitFor(() => expect(mailZeile(11)).toHaveClass('mail-zeile--hervorgehoben'));
    expect(within(mailZeile(11)).getAllByRole('button')[0]).toHaveAttribute('aria-expanded', 'true');
    expect(rollen).toHaveBeenCalledWith({ block: 'center' });
  });

  it('dieselbe Adresse zweimal ohne Wahl dazwischen: Die Mail wird wieder in den Blick gerollt und markiert', async () => {
    await vorgangOeffnen(1);
    act(() => { seiteBetreten(); });
    await waitFor(() => expect(mailZeile(11)).toHaveClass('mail-zeile--hervorgehoben'));
    act(() => { seiteVerlassen(); });
    // Weg von der Seite: Die Markierung erlischt.
    expect(mailZeile(11)).not.toHaveClass('mail-zeile--hervorgehoben');
    rollen.mockClear();
    act(() => { seiteBetreten(); });
    await waitFor(() => expect(mailZeile(11)).toHaveClass('mail-zeile--hervorgehoben'));
    expect(rollen).toHaveBeenCalledWith({ block: 'center' });
  });

  it('die Liste ohne Eintrag in der Adresse behält beim Wiederbetreten ihre Wahl', async () => {
    h.standort = { pathname: '/admin/support/vorgaenge', search: '', state: null };
    render(<SupportVorgaengePage />);
    await screen.findByRole('navigation', { name: 'Vorgänge' });
    act(() => { seiteBetreten(); });
    fireEvent.click(within(liste()!).getByRole('button', { name: /^Vorgang 3:/ }));
    await titel('Passwort vergessen');
    act(() => { seiteVerlassen(); });
    act(() => { seiteBetreten(); });
    await titel('Passwort vergessen');
  });

  it('„Breit lesen" je Gerät gilt auch für die schon besuchte andere Liste', async () => {
    window.localStorage.setItem(SCHLUESSEL_BREIT_LESEN, '0');
    h.standort = { pathname: '/admin/support/post', search: '', state: null };
    window.history.replaceState(null, '', '/admin/support/post');
    render(<SupportPosteingangPage />);
    await screen.findByRole('navigation', { name: 'Mails im Posteingang' });
    act(() => { seiteBetreten(); });
    act(() => { seiteVerlassen(); });
    // Inzwischen in „Vorgänge" breit gelesen (dieselbe Wahl des Geräts).
    window.localStorage.setItem(SCHLUESSEL_BREIT_LESEN, '1');
    act(() => { seiteBetreten(); });
    fireEvent.click(within(liste('Mails im Posteingang')!).getByRole('button', { name: /^Anna Beispiel/ }));
    await titel('Frage zum Zugang');
    expect(liste('Mails im Posteingang')).toBeNull();
    expect(blaettern().getByRole('button', { name: 'Zurück zu „Posteingang“' })).toBeInTheDocument();
  });

  it('ein Direktlink öffnet auch beim Wiederbetreten mit Liste; die gemerkte Wahl bleibt', async () => {
    h.standort = { pathname: '/admin/support/vorgaenge/2', search: '', state: null };
    await vorgangOeffnen(2);
    act(() => { seiteBetreten(); });
    fireEvent.click(schalter());
    expect(liste()).toBeNull();
    act(() => { seiteVerlassen(); });
    act(() => { seiteBetreten(); });
    expect(liste()).not.toBeNull();
    expect(gemerkt()).toBe('1');
  });
});

describe('?mail=: der Vorgang mit dieser Mail offen und hervorgehoben (E)', () => {
  const mailZeile = (id: number) => [...document.querySelectorAll<HTMLElement>('li.mail-zeile')]
    .find((z) => z.querySelector('time')?.getAttribute('dateTime') === server.stand.mails.find((m) => m.id === id)!.gesendet_am)!;

  it('die Mail aus der Adresse steht offen, wird in die Mitte gerollt und markiert', async () => {
    h.standort = { pathname: '/admin/support/vorgaenge/1', search: '?mail=11', state: null };
    await vorgangOeffnen(1);
    await waitFor(() => expect(mailZeile(11)).toHaveClass('mail-zeile--hervorgehoben'));
    expect(within(mailZeile(11)).getAllByRole('button')[0]).toHaveAttribute('aria-expanded', 'true');
    expect(rollen).toHaveBeenCalledWith({ block: 'center' });
    // Ohne ?mail= wäre die älteste gelesene Mail zu.
    expect(mailZeile(12)).not.toHaveClass('mail-zeile--hervorgehoben');
  });

  it('Wählen nimmt ?mail= aus der Adresse, die übrige Abfrage bleibt; zurück im Vorgang ist nichts mehr markiert', async () => {
    h.standort = { pathname: '/admin/support/vorgaenge/1', search: '?filter=offen&mail=11', state: null };
    await vorgangOeffnen(1);
    await waitFor(() => expect(mailZeile(11)).toHaveClass('mail-zeile--hervorgehoben'));
    fireEvent.click(within(liste()!).getByRole('button', { name: /^Vorgang 2:/ }));
    await titel('Wie lege ich einen Jahrgang an?');
    expect(`${window.location.pathname}${window.location.search}`).toBe('/admin/support/vorgaenge/2?filter=offen');
    fireEvent.click(within(liste()!).getByRole('button', { name: /^Vorgang 1:/ }));
    await titel('Chat zeigt nichts Neues');
    expect(window.location.search).toBe('?filter=offen');
    expect(mailZeile(11)).not.toHaveClass('mail-zeile--hervorgehoben');
    expect(within(mailZeile(11)).getAllByRole('button')[0]).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('useListenRahmen: der nächste Eintrag nach einem Abschluss', () => {
  it('lädt die Liste neu, bevor der Abschluss gemeldet wird, gilt die Reihenfolge, in der der Eintrag zuletzt stand', () => {
    const waehlen = vi.fn();
    const { result, rerender } = renderHook((p: { ids: number[] }) => useListenRahmen({ ids: p.ids, gewaehlt: 2, waehlen, listeLabel: 'Alle Vorgänge', direktlink: true }), {
      initialProps: { ids: [5, 2, 9] },
    });
    // Die Liste kommt neu, ohne den eben erledigten Eintrag 2 ...
    rerender({ ids: [5, 9] });
    // ... und erst danach meldet der Vorgang den Abschluss: geöffnet wird der nach ihm, nicht keiner.
    act(() => { result.current.rahmen.abgeschlossen(2); });
    expect(waehlen).toHaveBeenLastCalledWith(9);
  });

  // Ohne Abschluss fällt der offene Eintrag etwa aus der Liste, wenn „Danach: Wartet" ihn aus dem
  // Filter „Neu" nimmt, die Gemeinde angelegt ist oder er im Archiv wiederhergestellt wird. Er
  // bleibt offen -- und ‹ › blättern in der Reihenfolge, in der er zuletzt stand.
  it('fällt der offene Eintrag ohne Abschluss aus der Liste, blättern ‹ › in der Reihenfolge, in der er zuletzt stand', () => {
    const waehlen = vi.fn();
    const { result, rerender } = renderHook((p: { ids: number[] }) => useListenRahmen({ ids: p.ids, gewaehlt: 2, waehlen, listeLabel: 'Alle Vorgänge', direktlink: true }), {
      initialProps: { ids: [5, 2, 9, 4] },
    });
    rerender({ ids: [5, 9, 4] });
    expect(result.current.rahmen).toMatchObject({ vorheriger: 5, naechster: 9 });
    act(() => { result.current.rahmen.blaettern('weiter'); });
    expect(waehlen).toHaveBeenLastCalledWith(9);
    // Fehlt auch der Nachbar, gilt der nächste, der noch dasteht.
    rerender({ ids: [5, 4] });
    expect(result.current.rahmen).toMatchObject({ vorheriger: 5, naechster: 4 });
  });

  it('Sammelaktion: ist der offene Eintrag dabei, öffnet sich der nächste, der nicht dabei ist -- außer bei einem Entwurf im Lesebereich', () => {
    const waehlen = vi.fn();
    const { result } = renderHook(() => useListenRahmen({ ids: [5, 2, 9, 4], gewaehlt: 2, waehlen, listeLabel: '', direktlink: true }));
    act(() => { result.current.rahmen.sammelAbgeschlossen([7, 8], false); });
    expect(waehlen).not.toHaveBeenCalled();
    act(() => { result.current.rahmen.sammelAbgeschlossen([2, 9], false); });
    expect(waehlen).toHaveBeenLastCalledWith(4);
    waehlen.mockClear();
    act(() => { result.current.rahmen.entwurfMelden(() => true); });
    act(() => { result.current.rahmen.sammelAbgeschlossen([2], false); });
    expect(waehlen).not.toHaveBeenCalled();
    // Gelöscht ist er fort, mit oder ohne Entwurf: dann der nächste.
    act(() => { result.current.rahmen.sammelAbgeschlossen([2], true); });
    expect(waehlen).toHaveBeenLastCalledWith(9);
  });

  it('der letzte Eintrag: der davor; der einzige: keiner', () => {
    const waehlen = vi.fn();
    const { result, rerender } = renderHook((p: { ids: number[]; gewaehlt: number }) => useListenRahmen({ ids: p.ids, gewaehlt: p.gewaehlt, waehlen, listeLabel: '', direktlink: true }), {
      initialProps: { ids: [5, 2, 9], gewaehlt: 9 },
    });
    act(() => { result.current.rahmen.abgeschlossen(9); });
    expect(waehlen).toHaveBeenLastCalledWith(2);
    rerender({ ids: [4], gewaehlt: 4 });
    act(() => { result.current.rahmen.abgeschlossen(4); });
    expect(waehlen).toHaveBeenLastCalledWith(null);
  });
});

describe('useLeseAuswahl: die Adresse folgt der Wahl, ohne ?mail=', () => {
  it('auch wer an der Liste vorbei wählt, nimmt ?mail= mit; die übrige Abfrage bleibt', () => {
    window.history.replaceState(null, '', '/admin/support/vorgaenge/1?filter=offen&mail=11');
    const { result } = renderHook(() => useLeseAuswahl('/admin/support/vorgaenge', 1));
    act(() => { result.current[1](2); });
    expect(result.current[0]).toBe(2);
    expect(`${window.location.pathname}${window.location.search}`).toBe('/admin/support/vorgaenge/2?filter=offen');
  });

  it('nur ?mail= in der Abfrage: danach gar keine; ohne Wahl die Liste', () => {
    window.history.replaceState(null, '', '/admin/support/post/5?mail=5');
    const { result } = renderHook(() => useLeseAuswahl('/admin/support/post', 5));
    act(() => { result.current[1](null); });
    expect(`${window.location.pathname}${window.location.search}`).toBe('/admin/support/post');
  });
});

describe('Breit lesen im Posteingang', () => {
  it('„‹ Posteingang" und ‹ › durch die Mails; die Liste ist aus', async () => {
    h.standort = { pathname: '/admin/support/post/41', search: '', state: null };
    window.history.replaceState(null, '', '/admin/support/post/41');
    render(<SupportPostDetailPage nachrichtId={41} />);
    await titel('Frage zum Zugang');
    fireEvent.click(schalter());
    expect(liste('Mails im Posteingang')).toBeNull();
    expect(blaettern().getByRole('button', { name: 'Zurück zu „Posteingang“' })).toHaveTextContent('Posteingang');
    expect(blaettern().getByRole('button', { name: 'Voriger Eintrag' })).toBeDisabled();
    fireEvent.click(blaettern().getByRole('button', { name: 'Nächster Eintrag' }));
    await titel('Termin-Export');
    expect(window.location.pathname).toBe('/admin/support/post/42');
    expect(gemerkt()).toBe('1');
  });
});
