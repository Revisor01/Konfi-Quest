// Rückblick, Betrieb und Dashboard-Einstellungen: App und Web-Fassung lesen
// ihre Reiter aus EINER Beschreibung (seiten/rueckblick.ts, seiten/betrieb.ts,
// seiten/dashboardEinstellungen.ts; 09.10.2026). Gerendert werden die echten
// Seiten; nur die Weiche (useBreitesLayout) wird umgestellt.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, within, act } from '@testing-library/react';
import { konto, neuerStand, type LeitungTestStand } from '../components/leitung/leitungTestHilfe';

const h = vi.hoisted(() => ({
  breit: true,
  stand: { alert: null, fenster: [], push: vi.fn() } as unknown as LeitungTestStand,
  user: {} as Record<string, unknown>,
  daten: {} as Record<string, unknown>,
  apiGet: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
}));

vi.mock('@ionic/react', async () => (await import('../components/leitung/leitungTestHilfe')).ionicFuerLeitung(h.stand));
vi.mock('../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../components/shared/AppKopfzeile', async () => (await import('../components/support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('../../services/api', () => ({
  default: { get: (...a: unknown[]) => h.apiGet(...a), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true } }));
vi.mock('../../services/writeQueue', () => ({ writeQueue: { enqueue: vi.fn() } }));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: true }),
}));
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (schluessel: string) => ({ data: h.daten[schluessel.split(':')[1]] ?? [], loading: false, refresh: vi.fn(), refreshLive: vi.fn() }),
}));

import AdminWrappedPage from '../../components/admin/pages/AdminWrappedPage';
import AdminMetricsPage from '../../components/admin/pages/AdminMetricsPage';
import AdminDashboardSettingsPage from '../../components/admin/pages/AdminDashboardSettingsPage';
import { inFassung } from '../../seiten/beschreibung';
import { RUECKBLICK_FUER, RUECKBLICK_FUER_BESCHRIFTUNG, RUECKBLICK_LEER_TITEL, rueckblickLeerText } from '../../seiten/rueckblick';
import { BETRIEB_REITER, BETRIEB_REITER_BESCHRIFTUNG, ROUTEN_SORTIERUNG, ROUTEN_SORTIERUNG_BESCHRIFTUNG } from '../../seiten/betrieb';
import { DASHBOARD_FUER, DASHBOARD_LISTE_TITEL } from '../../seiten/dashboardEinstellungen';

const warten = async () => { for (let i = 0; i < 6; i += 1) await act(async () => { await Promise.resolve(); }); };
const appReiter = (leiste: HTMLElement): string[] => within(leiste).getAllByRole('tab').map((t) => t.textContent ?? '');
const webChips = (gruppe: string): string[] =>
  within(screen.getByRole('group', { name: gruppe })).getAllByRole('button').map((b) => b.childNodes[0]?.textContent ?? '');

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(h.stand, neuerStand());
  h.breit = true;
  h.user = konto('org_admin');
  h.daten = {};
  h.apiGet.mockResolvedValue({ data: [], headers: {} });
});

describe('Jahresrückblick: eine Beschreibung', () => {
  it('die App zeigt die Reiter der Beschreibung, der Browser dieselben als Chips', async () => {
    h.breit = false;
    const app = render(<AdminWrappedPage />);
    await warten();
    expect(appReiter(screen.getByRole('tablist'))).toEqual(inFassung(RUECKBLICK_FUER, 'app').map((r) => r.label));
    expect(screen.getByText(RUECKBLICK_LEER_TITEL)).toBeInTheDocument();
    expect(screen.getByText(rueckblickLeerText('app', 'konfi', true))).toBeInTheDocument();
    app.unmount();

    h.breit = true;
    render(<AdminWrappedPage />);
    await warten();
    expect(webChips(RUECKBLICK_FUER_BESCHRIFTUNG)).toEqual(inFassung(RUECKBLICK_FUER, 'web').map((r) => r.label));
    expect(screen.getByText(rueckblickLeerText('web', 'konfi', true))).toBeInTheDocument();
  });

  it('ohne Leitungsrecht: die App graut „Team" aus, der Browser lässt den Chip weg', async () => {
    h.user = konto('admin', [11]);
    h.breit = false;
    const app = render(<AdminWrappedPage />);
    await warten();
    expect(screen.getByRole('tab', { name: 'Team' })).toBeInTheDocument();
    app.unmount();

    h.breit = true;
    render(<AdminWrappedPage />);
    await warten();
    expect(webChips(RUECKBLICK_FUER_BESCHRIFTUNG)).toEqual(['Konfis']);
  });
});

const SNAP = {
  uptimeSeconds: 3600, totalRequests: 100, totalErrors: 1, errorRate: 0, inFlight: 0, maxInFlight: 1, rps: 1,
  routesSlowest: [], routesBusiest: [], routesPotenzial: [], recentErrors: [], timeline: [], replicas: [],
  fehlerGruppen: [
    { route: '/api/a', status: 500, anzahl: 1, seit: new Date().toISOString(), zuletzt: new Date().toISOString(), beispielUrl: '/api/a' },
    { route: '/api/b', status: 404, anzahl: 2, seit: new Date().toISOString(), zuletzt: new Date().toISOString(), beispielUrl: '/api/b' },
  ],
};

describe('Betrieb: eine Beschreibung', () => {
  beforeEach(() => {
    h.apiGet.mockImplementation(async (url: string) => ({ data: url === '/metrics' ? SNAP : { snapshots: [] } }));
  });

  it('die App zeigt die Reiter der Beschreibung, die Fehlerzahl in Klammern', async () => {
    h.breit = false;
    render(<AdminMetricsPage />);
    await warten();
    const namen = inFassung(BETRIEB_REITER, 'app').map((r) => (r.zahlText ? `${r.label} (2)` : r.label));
    expect(appReiter(screen.getAllByRole('tablist')[0])).toEqual(namen);
  });

  it('der Browser zeigt dieselben Reiter als Chips, die Fehlerzahl rot mit Satz', async () => {
    render(<AdminMetricsPage />);
    await warten();
    expect(webChips(BETRIEB_REITER_BESCHRIFTUNG)).toEqual(inFassung(BETRIEB_REITER, 'web').map((r) => r.label));
    const fehler = within(screen.getByRole('group', { name: BETRIEB_REITER_BESCHRIFTUNG })).getByRole('button', { name: /^Fehler/ });
    expect(fehler).toHaveTextContent('2 Fehlerarten seit dem letzten Neustart');
  });

  // Simon, 10.10.2026: Die Auswertung der Konfisprüche gehört nicht in den
  // Betrieb. Die Reiter stehen hier ausdrücklich, damit „Sprüche“ nicht still
  // zurückkommt -- weder in der App noch im Browser.
  it('Betrieb hat genau Überblick, Fehler, Routen und Verlauf -- keinen Reiter „Sprüche“', async () => {
    h.breit = false;
    const { unmount } = render(<AdminMetricsPage />);
    await warten();
    expect(appReiter(screen.getAllByRole('tablist')[0])).toEqual(['Überblick', 'Fehler (2)', 'Routen', 'Verlauf']);
    unmount();
    h.breit = true;
    render(<AdminMetricsPage />);
    await warten();
    expect(webChips(BETRIEB_REITER_BESCHRIFTUNG)).toEqual(['Überblick', 'Fehler', 'Routen', 'Verlauf']);
  });

  it('die Sortierung der Routen: dieselben zwei Wahlen in beiden Fassungen', async () => {
    h.breit = false;
    const app = render(<AdminMetricsPage />);
    await warten();
    act(() => { within(screen.getAllByRole('tablist')[0]).getByRole('tab', { name: 'Routen' }).click(); });
    expect(appReiter(screen.getAllByRole('tablist')[1])).toEqual(inFassung(ROUTEN_SORTIERUNG, 'app').map((s) => s.label));
    app.unmount();

    h.breit = true;
    render(<AdminMetricsPage />);
    await warten();
    act(() => { within(screen.getByRole('group', { name: BETRIEB_REITER_BESCHRIFTUNG })).getByRole('button', { name: 'Routen' }).click(); });
    expect(webChips(ROUTEN_SORTIERUNG_BESCHRIFTUNG)).toEqual(inFassung(ROUTEN_SORTIERUNG, 'web').map((s) => s.label));
  });
});

describe('Dashboard-Einstellungen: eine Beschreibung', () => {
  beforeEach(() => { h.daten = { settings: { dashboard_section_order: ['events'] } }; });

  it('die App zeigt die Reiter der Beschreibung und die Überschrift der Liste', async () => {
    h.breit = false;
    render(<AdminDashboardSettingsPage />);
    await warten();
    expect(appReiter(screen.getByRole('tablist'))).toEqual(inFassung(DASHBOARD_FUER, 'app').map((r) => r.label));
    expect(screen.getByText(DASHBOARD_LISTE_TITEL.konfi)).toBeInTheDocument();
  });

  it('der Browser zeigt keine Reiter, sondern beide Listen mit denselben Überschriften', async () => {
    render(<AdminDashboardSettingsPage />);
    await warten();
    expect(screen.queryByRole('tablist')).toBeNull();
    for (const r of DASHBOARD_FUER) {
      expect(screen.getByRole('heading', { name: DASHBOARD_LISTE_TITEL[r.schluessel] })).toBeInTheDocument();
    }
  });
});
