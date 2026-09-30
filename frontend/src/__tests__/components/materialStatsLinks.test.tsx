// Simons Wunsch (01.09.2026): Der Kopf der Materialseite soll neben Material
// und Dateien auch die Links zaehlen. Seit Migration 135 kann ein Material
// statt Dateien einen Link tragen (link_url) -- diese Eintraege tauchten in
// keiner der beiden Kacheln auf: 0 Dateien, und der Link blieb unsichtbar.
//
// Drei Werte passen ins Layout: die Stats-Zeile des SectionHeader bleibt bis
// vier Eintraege einzeilig (app-stats-row, Grid erst ab >4).
//
// Die Kacheln beider Materialseiten sind gerendert geprueft (Audit Tests
// 26.09.2026, BF-02; bis 30.09.2026 am Quelltext der Seiten).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { materialStats } from '../../utils/materialStats';

vi.mock('@capacitor/filesystem', async () => (await import('../medienAttrappen')).dateisystemModul);

const apiGet = vi.fn();
vi.mock('../../services/api', () => ({
  default: {
    get: (...a: unknown[]) => apiGet(...a),
    post: vi.fn(async () => ({ data: {} })),
    put: vi.fn(async () => ({ data: {} })),
    delete: vi.fn(async () => ({ data: {} })),
  },
  DATEI_TIMEOUT_MS: 180000,
}));
vi.mock('../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true, subscribe: () => () => undefined } }));
vi.mock('../../utils/haptics', () => ({ haptik: vi.fn(async () => undefined), ImpactStyle: { Light: 'LIGHT' }, triggerPullHaptic: vi.fn() }));
vi.mock('../../utils/nativeFileViewer', () => ({ openFileNatively: vi.fn(async () => false) }));

let angemeldet: Record<string, unknown> = { id: 4, organization_id: 1, role_name: 'admin' };
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: angemeldet, setError: vi.fn(), setSuccess: vi.fn(), isOnline: true }),
}));
vi.mock('../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: vi.fn() }));
vi.mock('../../contexts/ModalContext', () => ({ useModalPage: vi.fn() }));
vi.mock('../../components/shared/OrgSwitcherButton', () => ({ default: () => null }));
vi.mock('../../components/shared/PostfachGlocke', () => ({ default: () => null }));
vi.mock('../../services/analytics', async (original) => ({
  ...(await original<typeof import('../../services/analytics')>()),
  track: vi.fn(), trackHandlung: vi.fn(),
}));
vi.mock('../../services/writeQueue', () => ({ writeQueue: { enqueue: vi.fn() } }));
vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  useIonModal: () => [vi.fn(), vi.fn()],
  useIonAlert: () => [vi.fn(), vi.fn()],
}));

import AdminMaterialPage from '../../components/admin/pages/AdminMaterialPage';
import TeamerMaterialPage from '../../components/teamer/pages/TeamerMaterialPage';

describe('materialStats zaehlt Material, Dateien und Links', () => {
  it('nur Datei-Material: Links sind 0', () => {
    const s = materialStats([
      { file_count: 2 },
      { file_count: 3, link_url: null },
    ]);
    expect(s.material).toBe(2);
    expect(s.dateien).toBe(5);
    expect(s.links).toBe(0);
  });

  it('nur Link-Material: Dateien sind 0', () => {
    const s = materialStats([
      { link_url: 'https://konfi-quest.de/gottesbilder' },
      { file_count: 0, link_url: 'https://example.org' },
    ]);
    expect(s.material).toBe(2);
    expect(s.dateien).toBe(0);
    expect(s.links).toBe(2);
  });

  it('gemischt: jede Kachel zaehlt ihr eigenes', () => {
    const s = materialStats([
      { file_count: 4 },
      { link_url: 'https://konfi-quest.de/gottesbilder' },
      { file_count: 1 },
      // Alter Offline-Cache-Eintrag ohne link_url-Feld: zaehlt als Datei-
      // Material ohne Dateien, nie als Fehler.
      {},
    ]);
    expect(s.material).toBe(4);
    expect(s.dateien).toBe(5);
    expect(s.links).toBe(1);
  });

  it('leere Liste: alles 0', () => {
    const s = materialStats([]);
    expect(s.material).toBe(0);
    expect(s.dateien).toBe(0);
    expect(s.links).toBe(0);
  });
});

// Drei Eintraege: 4 Dateien, ein Link, 1 Datei und ein Link -- so hat jede
// Kachel eine andere Zahl (3 Material, 5 Dateien, 2 Links).
const LISTE = [
  { id: 1, title: 'Freizeit-Ablauf', file_count: 4, link_url: null, created_at: '2026-09-01T10:00:00Z', created_by: 4 },
  { id: 2, title: 'Gottesbilder', file_count: 0, link_url: 'https://example.org/gottesbilder', created_at: '2026-09-02T10:00:00Z', created_by: 4 },
  { id: 3, title: 'Liedblatt', file_count: 1, link_url: 'https://example.org/lieder', created_at: '2026-09-03T10:00:00Z', created_by: 4 },
];

const kacheln = () => Object.fromEntries(
  [...document.querySelectorAll('.app-stats-row__item')].map((k) => [
    k.querySelector('.app-stats-row__label')?.textContent,
    k.querySelector('.app-stats-row__value')?.textContent,
  ]),
);

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  apiGet.mockReset();
  apiGet.mockImplementation(async (route: string) => (route === '/material' ? { data: LISTE } : { data: [] }));
});
afterEach(() => cleanup());

describe('beide Materialseiten zeigen die dritte Kachel', () => {
  it('Leitung: Material, Dateien und Links aus der Liste', async () => {
    angemeldet = { id: 4, organization_id: 1, role_name: 'admin' };
    render(<AdminMaterialPage />);
    await screen.findByText('Gottesbilder');
    expect(kacheln()).toEqual({ Material: '3', Dateien: '5', Links: '2' });
  });

  it('Teamer: dieselben drei Zahlen', async () => {
    angemeldet = { id: 9, organization_id: 1, role_name: 'teamer' };
    render(<MemoryRouter initialEntries={['/teamer/profile/material']}><TeamerMaterialPage /></MemoryRouter>);
    await screen.findByText('Gottesbilder');
    expect(kacheln()).toEqual({ Material: '3', Dateien: '5', Links: '2' });
  });
});

void React;
