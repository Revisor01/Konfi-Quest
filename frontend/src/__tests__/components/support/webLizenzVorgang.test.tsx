// Der Vorgang „Lizenz und Abrechnung" in der Web-Fassung, gerendert
// (docs/planung/support-detailseiten.md, Abschnitt „Lizenz-Vorgang"; Simon,
// 11.10.2026: „Antrag meint bitte um Lizenz"): Die Karte „Lizenz" steht vor
// „Kontakt", die Gemeinde-Karte trägt Laufzeit und Konfis dann nicht noch
// einmal; im Kopf steht „Lizenz ändern" neben dem Hauptknopf, im Stand die
// Zeile „Lizenz heute: …". Der Dialog „Lizenz ändern" speichert nur über
// bestehende Routen: PATCH /organizations/:id/limit, dann GET und PUT
// /organizations/:id mit dem vollen Körper. Ohne Gemeinde ist „Ändern"
// gesperrt; „Zuordnen" öffnet Einordnen.
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import type { AlertOptionen } from './ionicAttrappe';
import { mail, vorgang, vorgaengeServer } from './vorgaengeServer';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
  push: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  alert: null as null | AlertOptionen,
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
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost, patch: h.apiPatch, put: h.apiPut, delete: h.apiDelete } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: h.online }),
}));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => true }));
vi.mock('../../../navigation/useAppLocation', () => ({ useAppLocation: () => h.standort }));

import SupportVorgangDetailPage from '../../../components/support/SupportVorgangDetailPage';
import { supportMailZaehlerZuruecksetzen } from '../../../navigation/supportMailZaehler';

let vorherTZ: string | undefined;
beforeAll(() => { vorherTZ = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherTZ === undefined) delete process.env.TZ; else process.env.TZ = vorherTZ; });

let server: ReturnType<typeof vorgaengeServer>;

beforeEach(() => {
  vi.clearAllMocks();
  // Laufzeiten rechnen ab heute: „heute" ist der Tag des Testservers.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-03T09:00:00Z'));
  h.alert = null;
  h.online = true;
  supportMailZaehlerZuruecksetzen();
  window.history.replaceState(null, '', '/admin/support/vorgaenge/1');
  server = vorgaengeServer({
    vorgaenge: [
      // 1: Bitte um eine Lizenz -- Gemeinde zugeordnet, in der Testphase, Wunsch Standard
      vorgang(1, { art: 'lizenz', bereich: null, status: 'neu', betreff: 'Bitte um die Lizenz Standard', organization_id: 7,
        beschreibung: 'Wir brauchen Platz für 40 Konfis.', kontakt_name: 'Pastorin Lena Probe', kontakt_email: 'lena.probe@example.org' }),
      // 2: Bitte um eine Lizenz -- noch keiner Gemeinde zugeordnet
      vorgang(2, { art: 'lizenz', bereich: null, status: 'neu', betreff: 'Lizenz verlängern', organization_id: null,
        beschreibung: 'Bitte um ein weiteres Jahr.', kontakt_name: 'Anna Beispiel', kontakt_email: 'anna@example.org', gemeinde_angabe: 'Kirchengemeinde Heide' }),
    ],
    mails: [
      mail(11, 1, { betreff: 'Bitte um die Lizenz Standard', text: 'Geht das bis Ende des Monats?', gesendet_am: '2026-10-03T08:00:00Z' }),
    ],
    gemeinden: { 7: { wunsch_lizenz: 'standard' } },
  });
  server.installieren({ get: h.apiGet, post: h.apiPost, patch: h.apiPatch, put: h.apiPut, delete: h.apiDelete });
});

afterEach(() => {
  vi.useRealTimers();
});

const oeffnen = async (id = 1) => {
  render(<SupportVorgangDetailPage vorgangId={id} />);
  await waitFor(() => {
    expect(document.querySelector('.web-lesen__titel')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Löschen' })).not.toBeNull();
  });
};
const kopf = () => document.querySelector('.web-lesen__kopf') as HTMLElement;
/** Die Knöpfe im Kopf und die Karten, sortiert: welche es gibt, nicht wo sie stehen. */
const aktionNamen = () => [...kopf().querySelectorAll<HTMLElement>('.web-kopfaktionen > .web-kopfknopf')].map((k) => k.getAttribute('aria-label') ?? k.textContent!.trim()).sort();
const kartenTitel = () => [...document.querySelectorAll('.web-vorgang-karte .web-vorgang-karte__titel')].map((t) => t.textContent!.trim()).sort();
const karte = (titel: string) => screen.getByRole('region', { name: titel });
const zeilen = (k: HTMLElement) => [...k.querySelectorAll('.web-angaben__zeile')].map((z) => [z.querySelector('dt')!.textContent, z.querySelector('dd')!.textContent]);
const dialog = () => screen.getByRole('dialog', { name: 'Lizenz ändern' });
const auswahl = (name: string) => within(dialog()).getByRole('combobox', { name }) as HTMLSelectElement;
/** Die Aufrufe an die Gemeinde 7 -- ohne das Neuladen von Vorgang und Liste. */
const gemeindeAufrufe = () => server.stand.aufrufe.filter((a) => a.pfad.startsWith('/organizations/7'));

describe('Lizenz-Vorgang (Web): Karten und Kopf', () => {
  it('die Karte „Lizenz" neben „Kontakt" und der Gemeinde: Tarif, Konfis, Laufzeit und der Wunsch bei der Anmeldung', async () => {
    await oeffnen();
    expect(kartenTitel()).toEqual(['Kirchengemeinde Musterdorf', 'Kontakt', 'Lizenz']);
    expect(zeilen(karte('Lizenz'))).toEqual([
      ['Tarif', 'Testphase — bis 5 Konfis · kostenlos'],
      ['Konfis', '3 von 5'],
      ['Laufzeit', 'Testphase bis 02.11.'],
      ['Wunsch bei der Anmeldung', 'Standard — bis 50 Konfis · 99\u00a0€ pro Jahr'],
    ]);
    expect(within(karte('Lizenz')).getByRole('button', { name: 'Ändern' })).toBeEnabled();
  });

  it('die Gemeinde-Karte nennt Laufzeit und Konfis nicht noch einmal -- jede Angabe einmal', async () => {
    await oeffnen();
    expect(zeilen(karte('Kirchengemeinde Musterdorf')).map(([label]) => label)).toEqual(['Kreis']);
  });

  it('im Kopf auch „Lizenz ändern"; im Stand die Zeile „Lizenz heute"', async () => {
    await oeffnen();
    expect(aktionNamen()).toEqual(['Antworten', 'Archivieren', 'Einordnen', 'Erledigt', 'Lizenz ändern', 'Löschen']);
    const zusatz = document.querySelector('.web-stand__zusatz') as HTMLElement;
    expect(zusatz).toHaveTextContent('Lizenz heute: Testphase bis 02.11. · bei der Anmeldung gewünscht: Standard.');
  });

  it('ohne Gemeinde: „Ändern" ist gesperrt und sagt warum; „Zuordnen" öffnet Einordnen, im Kopf steht „Gemeinde zuordnen"', async () => {
    await oeffnen(2);
    expect(kartenTitel()).toEqual(['Kontakt', 'Lizenz']);
    const lizenz = karte('Lizenz');
    expect(zeilen(lizenz)).toEqual([['Gemeinde', 'Nicht zugeordnet – laut Formular: Kirchengemeinde HeideZuordnen']]);
    const aendern = within(lizenz).getByRole('button', { name: 'Ändern' });
    expect(aendern).toBeDisabled();
    expect(aendern).toHaveAttribute('title', 'Erst eine Gemeinde zuordnen');
    // Die Zeile steht nur in „Lizenz", nicht noch einmal in „Kontakt".
    expect(zeilen(karte('Kontakt')).map(([label]) => label)).not.toContain('Gemeinde');
    expect(aktionNamen()).toEqual(['Antworten', 'Archivieren', 'Einordnen', 'Erledigt', 'Gemeinde zuordnen', 'Löschen']);
    expect(document.querySelector('.web-stand__zusatz')).toHaveTextContent('Die Lizenz lässt sich erst ändern, wenn eine Gemeinde zugeordnet ist – laut Formular: Kirchengemeinde Heide.');
    fireEvent.click(within(lizenz).getByRole('button', { name: 'Zuordnen' }));
    expect((within(screen.getByRole('dialog', { name: 'Einordnen' })).getByRole('combobox', { name: 'Gemeinde' }) as HTMLSelectElement).value).toBe('');
  });
});

describe('Lizenz-Vorgang (Web): Lizenz ändern', () => {
  it('der Dialog nennt den heutigen Stand; ohne Änderung ist Speichern gesperrt', async () => {
    await oeffnen();
    fireEvent.click(within(kopf()).getByRole('button', { name: 'Lizenz ändern' }));
    expect(dialog()).toHaveAccessibleDescription('Kirchengemeinde Musterdorf · heute: Testphase bis 02.11. · 3 von 5 Konfis');
    expect(auswahl('Tarif').value).toBe('5');
    expect(within(dialog()).getByRole('button', { name: 'Speichern' })).toBeDisabled();
  });

  it('„Wunschlizenz übernehmen" belegt Tarif und Laufzeit vor, die Vorschau sagt, was gilt; Speichern: PATCH …/limit, dann GET und PUT mit dem vollen Körper', async () => {
    await oeffnen();
    fireEvent.click(within(karte('Lizenz')).getByRole('button', { name: 'Ändern' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Wunschlizenz übernehmen: Standard' }));
    expect(auswahl('Tarif').value).toBe('50');
    // Die Testphase läuft noch: Das Jahr beginnt mit ihrem Ende.
    expect(auswahl('Laufzeit').value).toBe('jahr_ab_ende');
    expect((within(dialog()).getByRole('switch', { name: 'Testphase (Hinweis auf den Startseiten)' }) as HTMLInputElement).checked).toBe(false);
    expect(dialog().querySelector('.web-lizenz__danach')).toHaveTextContent('Danach: Standard — bis 50 Konfis · 99 € pro Jahr · Lizenz bis 02.11.2027.');
    expect(gemeindeAufrufe()).toEqual([]);

    await act(async () => { fireEvent.click(within(dialog()).getByRole('button', { name: 'Speichern' })); });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(gemeindeAufrufe().map((a) => [a.methode, a.pfad, a.koerper])).toEqual([
      ['patch', '/organizations/7/limit', { max_konfis: 50 }],
      ['get', '/organizations/7', undefined],
      ['put', '/organizations/7', {
        name: 'musterdorf', slug: 'musterdorf', display_name: 'Kirchengemeinde Musterdorf', description: null, contact_name: null,
        contact_email: null, contact_phone: null, address: null, website_url: null, kirchenkreis: 'Dithmarschen', is_active: true,
        kirchenkreis_id: 11, trial_ends_at: '2027-11-02T00:00:00.000Z', is_trial: false,
      }],
    ]);
    expect(h.setSuccess).toHaveBeenCalledWith('Lizenz geändert: Standard bis 02.11.2027');
    // Neu geladen: Die Karte zeigt, was jetzt gilt.
    await waitFor(() => expect(zeilen(karte('Lizenz'))[0]).toEqual(['Tarif', 'Standard — bis 50 Konfis · 99\u00a0€ pro Jahr']));
  });

  it('nur der Tarif: nur PATCH …/limit, kein PUT', async () => {
    await oeffnen();
    fireEvent.click(within(kopf()).getByRole('button', { name: 'Lizenz ändern' }));
    fireEvent.change(auswahl('Tarif'), { target: { value: '15' } });
    await act(async () => { fireEvent.click(within(dialog()).getByRole('button', { name: 'Speichern' })); });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(gemeindeAufrufe().map((a) => [a.methode, a.pfad, a.koerper])).toEqual([['patch', '/organizations/7/limit', { max_konfis: 15 }]]);
  });

  it('Abbrechen und Escape schließen ohne einen Aufruf', async () => {
    await oeffnen();
    fireEvent.click(within(kopf()).getByRole('button', { name: 'Lizenz ändern' }));
    fireEvent.change(auswahl('Tarif'), { target: { value: '50' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(within(kopf()).getByRole('button', { name: 'Lizenz ändern' }));
    fireEvent.change(auswahl('Tarif'), { target: { value: '50' } });
    fireEvent.keyDown(dialog(), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(gemeindeAufrufe()).toEqual([]);
  });

  it('ein ungültiges eigenes Limit oder ein fehlendes Enddatum: der Dialog sagt es, die Vorschau rechnet nicht damit, Speichern ist gesperrt', async () => {
    await oeffnen();
    fireEvent.click(within(kopf()).getByRole('button', { name: 'Lizenz ändern' }));
    const speichernKnopf = () => within(dialog()).getByRole('button', { name: 'Speichern' });
    const danach = () => dialog().querySelector('.web-lizenz__danach');
    fireEvent.change(auswahl('Tarif'), { target: { value: '__eigen__' } });
    const limit = within(dialog()).getByLabelText('Konfi-Limit');

    for (const falsch of ['0', 'abc', '']) {
      fireEvent.change(limit, { target: { value: falsch } });
      expect(within(dialog()).getByText('Das Konfi-Limit muss eine ganze Zahl ab 1 sein')).toBeInTheDocument();
      expect(danach()).toBeNull();
      expect(speichernKnopf()).toBeDisabled();
    }

    fireEvent.change(limit, { target: { value: '40' } });
    expect(within(dialog()).queryByText('Das Konfi-Limit muss eine ganze Zahl ab 1 sein')).toBeNull();
    expect(danach()).toHaveTextContent('Danach: Eigenes Limit — 40 Konfis · Testphase bis 02.11.');
    expect(speichernKnopf()).toBeEnabled();

    // „Eigenes Datum…" beginnt mit dem heutigen Ende; geleert fehlt es.
    fireEvent.change(auswahl('Laufzeit'), { target: { value: 'datum' } });
    expect((within(dialog()).getByLabelText('Enddatum') as HTMLInputElement).value).toBe('2026-11-02');
    expect(within(dialog()).queryByText('Bitte ein Enddatum wählen')).toBeNull();
    fireEvent.change(within(dialog()).getByLabelText('Enddatum'), { target: { value: '' } });
    expect(within(dialog()).getByText('Bitte ein Enddatum wählen')).toBeInTheDocument();
    expect(danach()).toBeNull();
    expect(speichernKnopf()).toBeDisabled();
    expect(gemeindeAufrufe()).toEqual([]);
  });

  it('scheitert der Tarif, bleibt der Dialog offen und nichts weiter geht hinaus', async () => {
    await oeffnen();
    server.stand.fehler.set('PATCH /organizations/7/limit', Object.assign(new Error('x'), { response: { status: 500, data: { error: 'Datenbankfehler' } } }));
    fireEvent.click(within(kopf()).getByRole('button', { name: 'Lizenz ändern' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Wunschlizenz übernehmen: Standard' }));
    await act(async () => { fireEvent.click(within(dialog()).getByRole('button', { name: 'Speichern' })); });
    expect(h.setError).toHaveBeenCalledWith('Datenbankfehler');
    expect(dialog()).toBeInTheDocument();
    expect(gemeindeAufrufe().map((a) => [a.methode, a.pfad])).toEqual([['patch', '/organizations/7/limit']]);
  });

  it('ohne Netz ist „Lizenz ändern" im Kopf gesperrt', async () => {
    h.online = false;
    await oeffnen();
    expect(within(kopf()).getByRole('button', { name: 'Lizenz ändern' })).toBeDisabled();
    expect(within(karte('Lizenz')).getByRole('button', { name: 'Ändern' })).toBeDisabled();
  });
});
