// Material aus einem Event -- das Modal der App
// (teamer/pages/TeamerMaterialDetailPage) und das Fenster der Web-Fassung
// (shared/web/termine/WebTerminMaterialDialog -> WebMaterialDialog, dasselbe
// wie unter „Material verwalten") im Vergleich (Simon, 15.10.2026: im
// Browser ab 992 px jedes Fenster kompakt).
//
// Geladen wird in beiden über denselben Hook (useMaterialAnsicht:
// GET /material/:id, ohne Netz der zuletzt geladene Stand). Beide zeigen
// dasselbe nur zum Lesen -- wie in der App, wo Material aus einem Event nur
// angesehen wird --, öffnen Dateien über denselben Weg (useDateiOeffnen, mit
// dem Betrachter der App) und Links über die Hülle der App, und beide zählen
// „Material angesehen" genau einmal.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act, cleanup, within } from '@testing-library/react';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  track: vi.fn(),
  dateiOeffnen: vi.fn(),
  linkOeffnen: vi.fn(),
}));

vi.mock('../../../services/api', () => ({
  default: { get: (u: string) => h.apiGet(u), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  DATEI_TIMEOUT_MS: 180000,
}));
vi.mock('../../../services/analytics', async () => ({
  ...(await vi.importActual<typeof import('../../../services/analytics')>('../../../services/analytics')),
  trackHandlung: (...a: unknown[]) => h.track(...a),
}));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 9, organization_id: 1, role_name: 'teamer' }, setError: vi.fn(), setSuccess: vi.fn(), isOnline: true }),
}));
vi.mock('../../../services/offlineCache', () => ({
  CACHE_TTL: { PROFILE: 1000, STAMMDATEN: 1000 },
  offlineCache: { get: vi.fn(async () => null), set: vi.fn(async () => undefined), remove: vi.fn(async () => undefined), isStale: () => false },
}));
vi.mock('../../../services/networkMonitor', () => ({
  networkMonitor: { isOnline: true, subscribe: () => () => undefined },
}));
vi.mock('../../../hooks/useDateiOeffnen', () => ({
  useDateiOeffnen: () => ({ dateiOeffnen: (...a: unknown[]) => h.dateiOeffnen(...a), ladendeDatei: null }),
}));
vi.mock('../../../services/systemDialoge', async (original) => ({
  ...(await original<typeof import('../../../services/systemDialoge')>()),
  linkOeffnen: (...a: unknown[]) => h.linkOeffnen(...a),
}));
vi.mock('../../../utils/haptics', () => ({
  haptik: vi.fn(async () => undefined),
  triggerPullHaptic: vi.fn(),
  ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' },
}));
// Das Modal der App zeigt seine eigene Fassung, nicht die Karten des Browsers.
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => false }));
vi.mock('../../../components/shared/AppKopfzeile', () => ({
  default: ({ titel }: { titel?: string }) => <h1>{titel}</h1>,
  AppKopfzeileGross: () => null,
}));

import TeamerMaterialDetailPage from '../../../components/teamer/pages/TeamerMaterialDetailPage';
import WebTerminMaterialDialog from '../../../components/shared/web/termine/WebTerminMaterialDialog';

const DATEI = { id: 1, original_name: 'Packliste.pdf', stored_name: 'a1b2.pdf', mime_type: 'application/pdf', file_size: 2048, created_at: '2026-10-01T10:00:00Z' };
const MATERIAL = {
  id: 11, title: 'Packliste Freizeit', description: 'Was alle mitbringen', files: [DATEI],
  links: [{ id: 1, url: 'https://example.org/programm' }], events: [{ id: 7, name: 'Konfi-Freizeit' }], jahrgaenge: [],
  created_by_name: 'Lea Leitung', created_at: '2026-10-01T10:00:00Z',
};

type Fassung = 'app' | 'web';
const zu = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  h.apiGet.mockImplementation(async (pfad: string) => {
    if (pfad === '/material/11') return { data: MATERIAL };
    return { data: [] };
  });
  h.dateiOeffnen.mockResolvedValue(true);
});
afterEach(() => cleanup());

const oeffnen = async (fassung: Fassung) => {
  if (fassung === 'app') render(<TeamerMaterialDetailPage materialId={11} onClose={zu} />);
  else render(<WebTerminMaterialDialog materialId={11} onSchliessen={zu} />);
  for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
};

/** Die Datei öffnen: in der App die Zeile, im Browser der Knopf „… ansehen". */
const dateiKnopf = (fassung: Fassung) => (fassung === 'app'
  ? screen.getByText('Packliste.pdf').closest('[role="button"]') as HTMLElement
  : screen.getByRole('button', { name: 'Packliste.pdf ansehen' }));
/** Den Link öffnen: in der App die Zeile mit dem Host, im Browser der echte Link. */
const linkKnopf = (fassung: Fassung) => (fassung === 'app'
  ? screen.getByText('example.org').closest('[role="button"]') as HTMLElement
  : screen.getByRole('link', { name: /example\.org/ }));

describe.each<Fassung>(['app', 'web'])('Material aus einem Event (%s): dieselbe Logik in App und Browser', (fassung) => {
  it('lädt GET /material/11 und zeigt Titel, Beschreibung, Datei und Link -- nur zum Lesen', async () => {
    await oeffnen(fassung);
    expect(h.apiGet).toHaveBeenCalledWith('/material/11');
    await waitFor(() => expect(screen.getAllByText('Packliste Freizeit').length).toBeGreaterThan(0));
    expect(screen.getByText('Was alle mitbringen')).toBeInTheDocument();
    expect(screen.getByText('Packliste.pdf')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /speichern/i })).toBe(null);
    expect(screen.queryByRole('textbox')).toBe(null);
  });

  it('„Material angesehen" genau einmal, mit der Art des Inhalts', async () => {
    await oeffnen(fassung);
    await waitFor(() => expect(screen.getByText('Packliste.pdf')).toBeInTheDocument());
    expect(h.track.mock.calls.filter(([n]) => n === 'material-angesehen')).toEqual([['material-angesehen', { inhalt: 'beides' }]]);
  });

  it('eine Datei öffnet über den gemeinsamen Weg und zählt als abgerufen', async () => {
    await oeffnen(fassung);
    await waitFor(() => expect(screen.getByText('Packliste.pdf')).toBeInTheDocument());
    await act(async () => { fireEvent.click(dateiKnopf(fassung)); });
    expect(h.dateiOeffnen).toHaveBeenCalledWith('a1b2.pdf', 'Packliste.pdf', 'application/pdf');
    expect(h.track).toHaveBeenCalledWith('material-abgerufen', { inhalt: 'datei' });
  });

  it('ein Link öffnet über die Hülle der App und zählt als abgerufen', async () => {
    await oeffnen(fassung);
    await waitFor(() => expect(screen.getByText('Packliste.pdf')).toBeInTheDocument());
    await act(async () => { fireEvent.click(linkKnopf(fassung)); });
    expect(h.linkOeffnen).toHaveBeenCalledWith('https://example.org/programm');
    expect(h.track).toHaveBeenCalledWith('material-abgerufen', { inhalt: 'link' });
  });

  it('scheitert das Laden, derselbe Satz', async () => {
    h.apiGet.mockRejectedValue({ response: { status: 404 } });
    await oeffnen(fassung);
    await waitFor(() => expect(screen.getByText('Das Material konnte nicht geladen werden.')).toBeInTheDocument());
    expect(h.track.mock.calls.filter(([n]) => n === 'material-angesehen')).toEqual([]);
  });
});

describe('Material aus einem Event (web): das Fenster', () => {
  it('heißt „Material ansehen" -- beim Laden, mit Material und ohne', async () => {
    let freigeben: (v: unknown) => void = () => undefined;
    h.apiGet.mockImplementationOnce(() => new Promise((ok) => { freigeben = ok; }));
    render(<WebTerminMaterialDialog materialId={11} onSchliessen={zu} />);
    expect(screen.getByRole('dialog', { name: 'Material ansehen' })).toHaveTextContent('Das Material wird geladen.');
    await waitFor(() => expect(h.apiGet).toHaveBeenCalledWith('/material/11'));
    await act(async () => { freigeben({ data: MATERIAL }); });
    await waitFor(() => expect(within(screen.getByRole('dialog', { name: 'Material ansehen' })).getByText('Packliste.pdf')).toBeInTheDocument());
    const fenster = screen.getByRole('dialog', { name: 'Material ansehen' });
    fireEvent.click(within(fenster).getAllByRole('button', { name: 'Schließen' })[0]);
    expect(zu).toHaveBeenCalledTimes(1);
  });

  it('ohne Material steht der Grund als Meldung im Fenster', async () => {
    h.apiGet.mockRejectedValue({ response: { status: 403 } });
    await oeffnen('web');
    await waitFor(() => expect(within(screen.getByRole('dialog', { name: 'Material ansehen' })).getByRole('alert'))
      .toHaveTextContent('Das Material konnte nicht geladen werden.'));
  });
});
