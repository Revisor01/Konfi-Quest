// Die alte Adresse einer Anfrage (/admin/support/anfragen/:id), gerendert
// (docs/planung/support-vorgaenge.md, Entscheidung 7): Die Anfrage hat keine
// eigene Seite mehr, ihre Angaben stehen im Vorgang. Die Seite sucht den Vorgang
// über `anfrage_id` -- in den offenen und in den archivierten -- und ersetzt
// sich durch ihn, damit Lesezeichen, alte Mitteilungen und Mails mit dem
// Kennzeichen „[Anfrage N]“ weiter ankommen. Gibt es ihn nicht, sagt die Seite
// das und führt zur Liste der Anfragen.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { vorgang, vorgaengeServer } from './vorgaengeServer';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  push: vi.fn(),
  breit: false,
  user: { id: 9, role_name: 'super_admin', is_super_admin: true } as Record<string, unknown>,
}));

vi.mock('@ionic/react', async () => (await import('./ionicAttrappe')).ionicAttrappe({
  router: { push: h.push, goBack: vi.fn(), canGoBack: () => false },
}));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('./ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: ({ message }: { message: string }) => <p>{message}</p> }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: vi.fn(), setSuccess: vi.fn(), isOnline: true }),
}));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));

import SupportAnfrageWeiterleitungPage from '../../../components/support/SupportAnfrageWeiterleitungPage';

let server: ReturnType<typeof vorgaengeServer>;

beforeEach(() => {
  vi.clearAllMocks();
  h.breit = false;
  h.user = { id: 9, role_name: 'super_admin', is_super_admin: true };
  server = vorgaengeServer({
    vorgaenge: [
      vorgang(1, { art: 'fehler', betreff: 'Kein Bezug zu einer Anfrage' }),
      vorgang(3, { art: 'neue_gemeinde', quelle: 'anfrage', anfrage_id: 41, betreff: 'Anfrage Kirchengemeinde Lindenau' }),
      vorgang(8, { art: 'neue_gemeinde', quelle: 'anfrage', anfrage_id: 40, status: 'erledigt', archiviert_am: '2026-10-01T12:00:00Z', betreff: 'Anfrage Kirchengemeinde Wiesengrund' }),
    ],
  });
  server.installieren({ get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete });
});

describe('Anfrage-Adresse: führt zum Vorgang', () => {
  it('ein offener Vorgang: die Seite ersetzt sich durch ihn -- ohne neuen Eintrag im Verlauf', async () => {
    render(<SupportAnfrageWeiterleitungPage anfrageId={41} />);
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge/3', 'none', 'replace'));
    expect(h.push).toHaveBeenCalledTimes(1);
  });

  it('ein archivierter (erledigter) Vorgang: gefunden im Archiv', async () => {
    render(<SupportAnfrageWeiterleitungPage anfrageId={40} />);
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge/8', 'none', 'replace'));
    expect(server.aufrufe('get', '/support/vorgaenge').map((a) => a.optionen)).toEqual([{ params: { filter: 'offen' } }, { params: { filter: 'archiv' } }]);
  });

  it('solange die Suche läuft, sagt die Seite, dass sie die Anfrage öffnet', () => {
    h.apiGet.mockImplementation(() => new Promise(() => {}));
    render(<SupportAnfrageWeiterleitungPage anfrageId={41} />);
    expect(screen.getByText('Anfrage wird geöffnet...')).toBeInTheDocument();
    expect(h.push).not.toHaveBeenCalled();
  });

  it('eine Liste scheitert, die andere hat den Vorgang: er wird trotzdem gefunden', async () => {
    // Nur die Liste der offenen scheitert.
    const vorher = h.apiGet.getMockImplementation()!;
    h.apiGet.mockImplementation((pfad: string, o?: { params?: { filter?: string } }) => (
      o?.params?.filter === 'archiv' ? vorher(pfad, o as never) : Promise.reject(new Error('Netz weg'))));
    render(<SupportAnfrageWeiterleitungPage anfrageId={40} />);
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge/8', 'none', 'replace'));
  });
});

describe('Anfrage-Adresse: kein Vorgang', () => {
  it('es gibt keinen Vorgang zu dieser Anfrage: „Anfrage nicht gefunden“, keine Weiterleitung', async () => {
    render(<SupportAnfrageWeiterleitungPage anfrageId={99} />);
    expect(await screen.findByText('Anfrage nicht gefunden')).toBeInTheDocument();
    expect(screen.getByText('Zu dieser Anfrage gibt es keinen Vorgang (mehr).')).toBeInTheDocument();
    expect(h.push).not.toHaveBeenCalled();
  });

  it('eine ungültige Kennung: „nicht gefunden“ ohne Abruf', async () => {
    render(<SupportAnfrageWeiterleitungPage anfrageId={Number.NaN} />);
    expect(await screen.findByText('Anfrage nicht gefunden')).toBeInTheDocument();
    expect(server.aufrufe('get', '/support/vorgaenge')).toHaveLength(0);
  });

  it('beide Listen scheitern: „Nicht geladen“ mit erneutem Versuch, der den Vorgang dann findet', async () => {
    server.stand.fehler.set('GET /support/vorgaenge', new Error('Netz weg'));
    render(<SupportAnfrageWeiterleitungPage anfrageId={41} />);
    expect(await screen.findByText('Nicht geladen')).toBeInTheDocument();
    expect(h.push).not.toHaveBeenCalled();
    server.stand.fehler.delete('GET /support/vorgaenge');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' })); });
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge/3', 'none', 'replace'));
  });
});

describe('Anfrage-Adresse: im breiten Fenster', () => {
  it('„nicht gefunden“ mit Link auf die Anfragen unter den Vorgängen', async () => {
    h.breit = true;
    render(<SupportAnfrageWeiterleitungPage anfrageId={99} />);
    expect(await screen.findByText('Anfrage nicht gefunden')).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: 'Alle Anfragen' });
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) expect(l).toHaveAttribute('href', '/admin/support/vorgaenge?art=neue_gemeinde');
  });

  it('ein offener Vorgang führt auch hier weiter', async () => {
    h.breit = true;
    render(<SupportAnfrageWeiterleitungPage anfrageId={41} />);
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge/3', 'none', 'replace'));
  });
});

describe('Anfrage-Adresse: nur für den Support', () => {
  it('eine Gemeindeleitung ohne Merkmal sieht den Hinweis, ohne Abruf und ohne Weiterleitung', () => {
    h.user = { id: 5, role_name: 'org_admin', is_super_admin: false };
    render(<SupportAnfrageWeiterleitungPage anfrageId={41} />);
    expect(screen.getByText('Nur für den Support')).toBeInTheDocument();
    expect(h.apiGet).not.toHaveBeenCalled();
    expect(h.push).not.toHaveBeenCalled();
  });
});
