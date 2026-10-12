// Ein Gemeindename aus dem Formular ist keine zugeordnete Gemeinde
// (Fehler vorab 3, docs/planung/support-detailseiten.md). Der Server liefert
// `gemeinde_name` als COALESCE aus dem Namen der zugeordneten Gemeinde, der
// Gemeinde der Anfrage und der Angabe im Formular
// (backend/routes/supportVorgaenge.js, LISTE_SPALTEN). Ob ein Vorgang einer
// Gemeinde zugeordnet ist, sagt deshalb nur `organization_id`
// (istZugeordnet). Bis 11.10.2026 zeigte der Web-Kopf den Freitext mit dem
// Gemeinde-Symbol, die Links führten auf `?gemeinde=null`, und Listenzeile,
// Übersicht, App-Untertitel und die Auswahl beim Einsortieren nannten ihn wie
// eine Gemeinde. Die Attrappe liefert dafür `gemeinde_name` wie der Server
// (gemeindeNameWieServer).
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { ANFRAGE_41, vorgang, vorgaengeServer } from './vorgaengeServer';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  breit: true,
  user: { id: 9, role_name: 'super_admin', is_super_admin: true } as Record<string, unknown>,
  standort: { pathname: '/admin/support/vorgaenge', search: '', state: null } as { pathname: string; search: string; state: null },
}));

vi.mock('@ionic/react', async () => (await import('./ionicAttrappe')).ionicAttrappe({
  presentAlert: () => undefined,
  router: { push: vi.fn(), goBack: vi.fn(), canGoBack: () => false },
}));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('./ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: ({ message }: { message: string }) => <p>{message}</p> }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, signOut: vi.fn(), setError: vi.fn(), setSuccess: vi.fn(), isOnline: true }),
}));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../../navigation/useAppLocation', () => ({ useAppLocation: () => h.standort }));

import SupportVorgangDetailPage from '../../../components/support/SupportVorgangDetailPage';
import SupportVorgaengePage from '../../../components/support/SupportVorgaengePage';
import SupportUebersichtPage from '../../../components/support/SupportUebersichtPage';
import { supportMailZaehlerZuruecksetzen } from '../../../navigation/supportMailZaehler';
import { vorgangEintrag } from '../../../seiten/supportEinsortieren';

let vorherTZ: string | undefined;
beforeAll(() => { vorherTZ = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherTZ === undefined) delete process.env.TZ; else process.env.TZ = vorherTZ; });

beforeEach(() => {
  vi.clearAllMocks();
  h.breit = true;
  h.standort = { pathname: '/admin/support/vorgaenge', search: '', state: null };
  supportMailZaehlerZuruecksetzen();
  window.history.replaceState(null, '', '/admin/support/vorgaenge');
  const server = vorgaengeServer({
    gemeindeNameWieServer: true,
    vorgaenge: [
      // zugeordnet: die Gemeinde 7 (erlaubter Fall)
      vorgang(1, { art: 'fehler', bereich: 'chat', betreff: 'Chat zeigt nichts Neues', organization_id: 7, gemeinde_angabe: 'Kirchengemeinde Musterdorf', created_at: '2026-10-03T07:00:00Z' }),
      // nicht zugeordnet, aber mit Gemeinde im Formular
      vorgang(2, { art: 'frage', bereich: 'konten', betreff: 'Wie lege ich einen Jahrgang an?', organization_id: null, kontakt_name: 'Anna Beispiel',
        kontakt_email: 'anna@example.org', gemeinde_angabe: 'Kirchengemeinde Heide', created_at: '2026-10-02T09:00:00Z' }),
      // Anfrage: die Gemeinde gibt es noch nicht
      vorgang(3, { art: 'neue_gemeinde', bereich: null, betreff: 'Anfrage Kirchengemeinde Lindenau', quelle: 'anfrage', anfrage_id: 41,
        anfrage: { ...ANFRAGE_41 }, created_at: '2026-10-01T09:00:00Z' }),
    ],
  });
  server.installieren({ get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete });
  // Die Übersicht braucht zwei Routen, die die Attrappe nicht kennt.
  const vorher = h.apiGet.getMockImplementation()!;
  h.apiGet.mockImplementation((pfad: string, o?: unknown) => {
    if (pfad === '/support/uebersicht') return Promise.resolve({ data: { kennzahlen: {}, neueste_anfragen: [], neueste_mails: [], testphase_endet: [] } });
    if (pfad === '/support/statistik') return Promise.resolve({ data: { stand: '2026-10-03T08:00:00Z', gemeinden: [] } });
    if (pfad === '/support/anfragen') return Promise.resolve({ data: [] });
    return vorher(pfad, o as never);
  });
});

/**
 * Die Gemeinde im Kopf des Lesebereichs (Verweis neben Nr. und Status) und
 * ihre Karte unter den Angaben -- seit 11.10.2026 offen statt im Akkordeon
 * „Gemeinde, Anfrage und Notiz".
 */
const kopfGemeinde = () => document.querySelector('.web-lesen__gemeinde');
const gemeindeKarte = (name: string) => screen.queryByRole('region', { name });

describe('Gemeinde nur mit organization_id: Vorgang im Browser', () => {
  const oeffnen = async (id: number) => {
    render(<SupportVorgangDetailPage vorgangId={id} />);
    await waitFor(() => expect(document.querySelector('.web-lesen__titel')).not.toBeNull());
    await waitFor(() => expect(document.querySelector('.web-vorgang-karten')).not.toBeNull());
  };

  it('ohne Zuordnung: kein Gemeindename im Kopf, keine Gemeinde-Karte, kein Link auf „?gemeinde=null“', async () => {
    await oeffnen(2);
    expect(kopfGemeinde()).toBeNull();
    expect(document.querySelector('.web-lesen__kopf')).not.toHaveTextContent('Kirchengemeinde Heide');
    expect(gemeindeKarte('Kirchengemeinde Heide')).toBeNull();
    expect(document.querySelectorAll('a[href*="gemeinde=null"]')).toHaveLength(0);
    // Der Freitext steht dort, wo er hingehört: als Angabe aus dem Formular in der Karte „Kontakt".
    expect(within(screen.getByRole('region', { name: 'Kontakt' })).getByText('Nicht zugeordnet – laut Formular: Kirchengemeinde Heide')).toBeInTheDocument();
  });

  it('eine Anfrage ist keiner Gemeinde zugeordnet, auch wenn der Server ihren Gemeindenamen liefert', async () => {
    await oeffnen(3);
    expect(kopfGemeinde()).toBeNull();
    expect(gemeindeKarte('Kirchengemeinde Lindenau')).toBeNull();
    expect(document.querySelectorAll('a[href*="gemeinde=null"]')).toHaveLength(0);
  });

  it('mit Zuordnung: Gemeinde im Kopf und ihre Links', async () => {
    await oeffnen(1);
    expect(kopfGemeinde()).toHaveTextContent('Kirchengemeinde Musterdorf');
    expect(kopfGemeinde()).toHaveAttribute('href', '/admin/organizations?gemeinde=7');
    const gemeinde = gemeindeKarte('Kirchengemeinde Musterdorf') as HTMLElement;
    expect(within(gemeinde).getByRole('link', { name: 'Gemeinde öffnen' })).toHaveAttribute('href', '/admin/organizations?gemeinde=7');
    expect(within(gemeinde).getByRole('link', { name: 'Alle Vorgänge' })).toHaveAttribute('href', '/admin/support/vorgaenge?gemeinde=7');
  });
});

describe('Gemeinde nur mit organization_id: Vorgang in der App', () => {
  const untertitel = async (id: number) => {
    h.breit = false;
    render(<SupportVorgangDetailPage vorgangId={id} />);
    await screen.findByText(/^Nr\. \d+/, { selector: '.app-header-banner__subtitle' });
    return document.querySelector('.app-header-banner__subtitle')!.textContent;
  };

  // Seit 11.10.2026 „Nr. N · Gemeinde" (docs/planung/support-detailseiten.md, App A); ohne Zuordnung nur die Nummer.
  it('der Untertitel nennt den Freitext nicht als Gemeinde', async () => {
    expect(await untertitel(2)).toBe('Nr. 2');
  });

  it('mit Zuordnung nennt er die Gemeinde', async () => {
    expect(await untertitel(1)).toBe('Nr. 1 · Kirchengemeinde Musterdorf');
  });
});

describe('Gemeinde nur mit organization_id: Listen', () => {
  it('Browser: die Zeile sagt „Nicht zugeordnet“, mit Zuordnung den Namen', async () => {
    render(<SupportVorgaengePage />);
    // Zeile 2 seit 11.10.2026 „Nr. · Art · Gemeinde" (docs/planung/support-detailseiten.md, „Rahmen").
    await waitFor(() => expect(document.querySelectorAll('.web-postfachzeile__mitte')).toHaveLength(3));
    const texte = [...document.querySelectorAll('.web-postfachzeile__mitte')].map((z) => z.textContent);
    // Die Anfrage (Nr. 3) sagt wie im Kopf „Noch nicht angelegt“ -- auch nicht den Freitext.
    expect(texte).toEqual(['Nr. 1 · Fehler · Kirchengemeinde Musterdorf', 'Nr. 2 · Frage · Nicht zugeordnet', 'Nr. 3 · Neue Gemeinde · Noch nicht angelegt']);
  });

  it('App: die Zeile sagt „Nicht zugeordnet“, mit Zuordnung den Namen', async () => {
    h.breit = false;
    render(<SupportVorgaengePage />);
    const zwei = await screen.findByRole('button', { name: /^Vorgang 2:/ });
    expect(zwei).toHaveTextContent('Nicht zugeordnet');
    expect(zwei).not.toHaveTextContent('Kirchengemeinde Heide');
    expect(screen.getByRole('button', { name: /^Vorgang 3:/ })).toHaveTextContent('Noch nicht angelegt');
    expect(screen.getByRole('button', { name: /^Vorgang 1:/ })).toHaveTextContent('Kirchengemeinde Musterdorf');
  });

  it('Übersicht: die neuesten Vorgänge nennen nur zugeordnete Gemeinden', async () => {
    render(<SupportUebersichtPage />);
    const karte = (await screen.findByRole('heading', { name: 'Neueste Vorgänge' })).closest('section') as HTMLElement;
    await waitFor(() => expect(within(karte).getAllByRole('listitem')).toHaveLength(3));
    const zeilen = within(karte).getAllByRole('listitem').map((z) => z.querySelector('.web-feed__meta')!.textContent);
    expect(zeilen).toEqual(['FehlerKirchengemeinde Musterdorf', 'FrageNicht zugeordnet', 'Neue GemeindeNoch nicht angelegt']);
  });

  it('Einsortieren: die Auswahl nennt „Keine Gemeinde“ statt des Freitexts', () => {
    const basis = { betreff: 'Wie lege ich einen Jahrgang an?', art: 'frage' as const, status: 'neu' as const };
    expect(vorgangEintrag({ ...basis, id: 2, organization_id: null, gemeinde_name: 'Kirchengemeinde Heide' }).beschreibung).toBe('Keine Gemeinde · Frage · Neu');
    expect(vorgangEintrag({ ...basis, id: 1, organization_id: 7, gemeinde_name: 'Kirchengemeinde Musterdorf' }).beschreibung).toBe('Kirchengemeinde Musterdorf · Frage · Neu');
  });
});
