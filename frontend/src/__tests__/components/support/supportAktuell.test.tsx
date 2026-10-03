// Liste, Detail, Posteingang und rote Zahlen bleiben aktuell (Simon, 03.10.2026:
// „Die Postfächer im Support und die Listen aktualisieren sich nicht gut, wenn
// ich den Status ändere oder sonst was."; docs/planung/support-vorgaenge.md,
// Entscheidung 8).
//
// Ionic hält besuchte Seiten im Speicher: Liste, Vorgang, Posteingang und die
// Leiste stehen gleichzeitig eingehängt, und jede sah eine Änderung der anderen
// nie. Hier stehen sie in EINEM Baum, mit einem Server, der seinen Stand
// behält (vorgaengeServer.ts) -- wie in der App. Was die eine Seite ändert,
// zeigt die andere ohne Neuladen und ohne Zutun.
//
// Gegenprobe: Nimmt man useSupportGeaendert aus useSupportDaten oder
// meldeSupportGeaendert aus einer Aktion heraus, fällt der jeweilige Test.
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import type { AlertOptionen } from './ionicAttrappe';
import { GEMEINDEN, mail, vorgang, vorgaengeServer } from './vorgaengeServer';

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
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: true }),
}));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../../navigation/useAppLocation', () => ({ useAppLocation: () => ({ pathname: '/admin/support/vorgaenge', search: '', state: null }) }));

import SupportVorgaengePage from '../../../components/support/SupportVorgaengePage';
import SupportVorgangDetailPage from '../../../components/support/SupportVorgangDetailPage';
import SupportPosteingangPage from '../../../components/support/SupportPosteingangPage';
import { supportMailZaehlerZuruecksetzen, useSupportMailZaehler } from '../../../navigation/supportMailZaehler';
import { meldeSupportGeaendert } from '../../../utils/supportAktualisieren';
import { seiteBetreten } from './ionicAttrappe';

let vorherTZ: string | undefined;
beforeAll(() => { vorherTZ = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherTZ === undefined) delete process.env.TZ; else process.env.TZ = vorherTZ; });

/** Die roten Zahlen der Leiste: so liest sie dieselbe Stelle wie die Seitenleiste. */
const Leiste: React.FC = () => {
  const zaehler = useSupportMailZaehler(true);
  return <span data-testid="leiste">{zaehler ? `${zaehler.vorgaenge}/${zaehler.posteingang}` : '–'}</span>;
};

/** Alles, was in der App gleichzeitig im Speicher steht. */
const Baum: React.FC<{ vorgangId: number }> = ({ vorgangId }) => (
  <>
    <Leiste />
    <div data-testid="liste"><SupportVorgaengePage /></div>
    <div data-testid="detail"><SupportVorgangDetailPage vorgangId={vorgangId} /></div>
    <div data-testid="post"><SupportPosteingangPage /></div>
  </>
);

const liste = () => within(screen.getByTestId('liste'));
const detail = () => within(screen.getByTestId('detail'));
const post = () => within(screen.getByTestId('post'));
const leiste = () => screen.getByTestId('leiste');
const chip = (name: RegExp) => within(liste().getByRole('group', { name: 'Vorgänge nach Stand' })).getByRole('button', { name });
const tabelle = () => liste().getByRole('table', { name: 'Vorgänge' });
const zeile = (nummer: number) => within(tabelle()).getAllByRole('row').slice(1).find((z) => within(z).queryByRole('link', { name: new RegExp(`Betreff ${nummer}`) }));

let server: ReturnType<typeof vorgaengeServer>;

beforeEach(() => {
  vi.clearAllMocks();
  h.alert = null;
  h.breit = true;
  h.user = { id: 9, role_name: 'super_admin', is_super_admin: true };
  supportMailZaehlerZuruecksetzen();
  server = vorgaengeServer({
    vorgaenge: [
      vorgang(1, { status: 'neu', organization_id: 7, kontakt_name: 'Pastorin Lena Probe', kontakt_email: 'lena.probe@example.org' }),
      vorgang(2, { status: 'in_arbeit' }),
      vorgang(3, { status: 'wartet', organization_id: 8 }),
    ],
    mails: [
      mail(11, 1, { gelesen_am: '2026-10-03T08:10:00Z' }),
      mail(21, 2, { betreff: 'Frage zu Vorgang 2' }),
      mail(91, null, { postfach: 'moin', betreff: 'Lose Mail im Posteingang', von_adresse: 'info@beispiel-verein.example', von_name: null }),
      mail(92, null, { postfach: 'support', betreff: 'Zweite lose Mail', von_adresse: 'sam@example.org', von_name: 'Sam Muster', gelesen_am: '2026-10-03T08:20:00Z' }),
    ],
  });
  server.installieren({ get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete });
});

const zeigen = async (vorgangId = 1) => {
  render(<Baum vorgangId={vorgangId} />);
  await liste().findByRole('table', { name: 'Vorgänge' });
  await detail().findByRole('heading', { level: 1, name: new RegExp(`Betreff ${vorgangId}`) });
  await post().findByRole('table', { name: 'Mails im Posteingang' });
  // Die rote Zahl der Leiste: Vorgang 1 ist neu, Vorgang 2 hat eine ungelesene Mail -- und eine lose Mail ist ungelesen.
  // (Wer Vorgang 2 öffnet, meldet dessen Mail sofort gelesen; der Test sieht dann nur den Endstand.)
  if (vorgangId !== 2) await waitFor(() => expect(leiste()).toHaveTextContent('2/1'));
};

describe('Aktuell bleiben: Änderungen im Vorgang, Liste, Posteingang und Leiste daneben', () => {
  it('Statuswechsel im Vorgang: die Liste zeigt ohne Neuladen den neuen Status, die Zahl am Chip und die rote Zahl sinken', async () => {
    await zeigen();
    expect(within(zeile(1)!).getByText('Neu')).toBeInTheDocument();
    expect(chip(/^Neu/)).toHaveTextContent('1');

    fireEvent.change(detail().getByLabelText('Status'), { target: { value: 'in_arbeit' } });

    // Dieselbe Seite, derselbe Baum -- niemand hat neu geladen oder die Seite betreten.
    await waitFor(() => expect(within(zeile(1)!).getByText('In Arbeit')).toBeInTheDocument());
    expect(within(zeile(1)!).queryByText('Neu')).toBeNull();
    expect(chip(/^Neu/)).toHaveTextContent('0');
    expect(chip(/^In Arbeit/)).toHaveTextContent('2');
    await waitFor(() => expect(leiste()).toHaveTextContent('1/1'));
    expect(server.aufrufe('patch')).toHaveLength(1);
    expect(server.aufrufe('patch')[0]).toMatchObject({ pfad: '/support/vorgaenge/1', koerper: { status: 'in_arbeit' } });
  });

  it('Erledigt im Vorgang legt ihn ins Archiv: er verschwindet aus der offenen Liste, die Zahlen sinken, der Vorgang zeigt das Archiv', async () => {
    await zeigen();
    fireEvent.change(detail().getByLabelText('Status'), { target: { value: 'erledigt' } });

    await waitFor(() => expect(zeile(1)).toBeUndefined());
    expect(within(tabelle()).getAllByRole('row').slice(1)).toHaveLength(2);
    expect(chip(/^Offen/)).toHaveTextContent('2');
    await waitFor(() => expect(leiste()).toHaveTextContent('1/1'));
    // Der Vorgang selbst zeigt, wo er jetzt liegt -- vom Server, nicht aus einer Vermutung.
    expect(await detail().findByText('Erledigt und im Archiv')).toBeInTheDocument();
    expect(detail().getByRole('button', { name: 'Wiederherstellen' })).toBeInTheDocument();
    expect(detail().queryByRole('button', { name: 'Archivieren' })).toBeNull();
    expect(h.setSuccess).toHaveBeenCalledWith('Vorgang erledigt und ins Archiv gelegt');
  });

  it('Wiederherstellen im Vorgang: er steht wieder in der offenen Liste, „In Arbeit“', async () => {
    server.stand.vorgaenge[2].archiviert_am = '2026-10-02T08:00:00Z';
    server.stand.vorgaenge[2].status = 'erledigt';
    await zeigen(3);
    expect(zeile(3)).toBeUndefined();
    fireEvent.click(detail().getByRole('button', { name: 'Wiederherstellen' }));

    await waitFor(() => expect(zeile(3)).toBeDefined());
    expect(within(zeile(3)!).getByText('In Arbeit')).toBeInTheDocument();
    expect(detail().queryByText('Erledigt und im Archiv')).toBeNull();
  });

  it('der Vorgang wird geöffnet: seine ungelesene Mail gilt als gelesen -- die Liste zeigt keine rote Zahl mehr, die Leiste sinkt', async () => {
    await zeigen(2);
    // Vorgang 2 trug beim Laden der Liste noch eine ungelesene Mail; der Besuch im Vorgang meldet sie gelesen.
    await waitFor(() => expect(within(zeile(2)!).queryByText('Frage zu Vorgang 2')).toBeNull());
    await waitFor(() => expect(within(zeile(2)!).getByText('–', { selector: '.web-gedaempft' })).toBeInTheDocument());
    await waitFor(() => expect(leiste()).toHaveTextContent('1/1'));
    expect(within(zeile(2)!).queryByText('1', { selector: '.web-chip__zahl--rot' })).toBeNull();
  });

  it('Einsortieren im Posteingang: die Mail verschwindet dort, der Vorgang zeigt sie, die rote Zahl des Posteingangs sinkt', async () => {
    await zeigen();
    fireEvent.click(post().getByRole('button', { name: 'Einsortieren: Lose Mail im Posteingang' }));
    const dialog = screen.getByRole('dialog', { name: 'Mail einsortieren' });
    fireEvent.click(await within(dialog).findByRole('radio', { name: /Nr\. 2 · Betreff 2/ }));
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Einsortieren' })); });

    await waitFor(() => expect(post().queryByRole('link', { name: 'Lose Mail im Posteingang' })).toBeNull());
    await waitFor(() => expect(leiste()).toHaveTextContent('2/0'));
    expect(server.stand.mails.find((m) => m.id === 91)?.vorgang_id).toBe(2);
  });

  it('Archivieren mehrerer Vorgänge in der Liste: der offene Vorgang daneben zeigt sofort sein Archiv', async () => {
    await zeigen(2);
    fireEvent.click(within(zeile(2)!).getByRole('checkbox'));
    fireEvent.click(within(zeile(3)!).getByRole('checkbox'));
    await act(async () => { fireEvent.click(liste().getByRole('button', { name: 'Archivieren' })); });

    await waitFor(() => expect(zeile(2)).toBeUndefined());
    expect(zeile(3)).toBeUndefined();
    expect(await detail().findByText('Dieser Vorgang liegt im Archiv')).toBeInTheDocument();
    expect(server.aufrufe('post', '/support/vorgaenge/sammel')[0].koerper).toEqual({ ids: [2, 3], aktion: 'archivieren' });
  });

  it('Löschen im Vorgang: die Liste zeigt ihn nicht mehr, die Leiste sinkt', async () => {
    await zeigen();
    fireEvent.click(detail().getByRole('button', { name: 'Löschen' }));
    expect(h.alert?.header).toBe('Vorgang löschen');
    await act(async () => { h.alert?.buttons?.find((b) => b.text === 'Löschen')?.handler?.(); });

    await waitFor(() => expect(zeile(1)).toBeUndefined());
    await waitFor(() => expect(leiste()).toHaveTextContent('1/1'));
    expect(server.aufrufe('delete')[0].pfad).toBe('/support/vorgaenge/1');
    expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge', 'back', 'replace');
  });

  it('eine Änderung von draußen (anderes Fenster, Mail abgeholt) erreicht alle Ansichten über die Meldung „Support-Daten geändert“', async () => {
    await zeigen();
    server.stand.vorgaenge.push(vorgang(5, { status: 'neu', betreff: 'Neu hereingekommen' }));
    server.stand.mails.push(mail(95, null, { betreff: 'Noch eine lose Mail', von_adresse: 'neu@example.org', von_name: null }));
    expect(zeile(5)).toBeUndefined();

    act(() => { meldeSupportGeaendert(); });

    expect(await liste().findByRole('link', { name: 'Neu hereingekommen' })).toBeInTheDocument();
    expect(await post().findByRole('link', { name: 'Noch eine lose Mail' })).toBeInTheDocument();
    await waitFor(() => expect(leiste()).toHaveTextContent('3/2'));
  });

  it('zurück auf die Seite (Ionic hält sie im Speicher) und das Fenster wieder sichtbar: alle laden neu', async () => {
    await zeigen();
    server.stand.vorgaenge.push(vorgang(6, { status: 'neu', betreff: 'Beim Wegsein gekommen' }));
    act(() => { seiteBetreten(); seiteBetreten(); });
    expect(await liste().findByRole('link', { name: 'Beim Wegsein gekommen' })).toBeInTheDocument();

    server.stand.vorgaenge.push(vorgang(7, { status: 'neu', betreff: 'Im anderen Tab gekommen' }));
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(liste().queryByRole('link', { name: 'Im anderen Tab gekommen' })).toBeNull();
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(await liste().findByRole('link', { name: 'Im anderen Tab gekommen' })).toBeInTheDocument();
    await waitFor(() => expect(leiste()).toHaveTextContent('4/1'));
  });

  it('eine Notiz, die noch nicht gespeichert ist, überlebt das Neuladen -- auch eine Änderung an anderer Stelle', async () => {
    await zeigen();
    fireEvent.change(detail().getByLabelText('Interne Notiz'), { target: { value: 'Bitte zurückrufen' } });
    server.stand.vorgaenge[1].betreff = 'Betreff 2 geändert';
    act(() => { meldeSupportGeaendert(); });
    await liste().findByRole('link', { name: /^Betreff 2 geändert/ });
    expect((detail().getByLabelText('Interne Notiz') as HTMLTextAreaElement).value).toBe('Bitte zurückrufen');
  });

  it('die eigene Änderung lädt den Vorgang genau einmal neu, nicht in einer Schleife', async () => {
    await zeigen();
    const vorher = server.aufrufe('get', '/support/vorgaenge/1').length;
    fireEvent.change(detail().getByLabelText('Dringlichkeit'), { target: { value: 'dringend' } });
    await waitFor(() => expect(server.aufrufe('get', '/support/vorgaenge/1').length).toBe(vorher + 1));
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(server.aufrufe('get', '/support/vorgaenge/1').length).toBe(vorher + 1);
    expect(GEMEINDEN.length).toBe(2);
  });
});
